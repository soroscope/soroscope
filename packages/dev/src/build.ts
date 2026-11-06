import { execFile } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type Builder = 'stellar' | 'cargo';

/** Where a contract crate's WASM lands, from `cargo metadata`. */
export interface ContractProject {
  /** Directory holding the crate's Cargo.toml. */
  dir: string;
  packageName: string;
  /** The cdylib target's name (dashes become underscores in the file name). */
  libName: string;
  targetDir: string;
  wasmPath: string;
}

export interface BuildResult {
  wasm: Uint8Array;
  wasmPath: string;
  builder: Builder;
  ms: number;
}

/** A failed build, carrying the compiler's output. */
export class BuildError extends Error {
  constructor(
    message: string,
    readonly output: string,
  ) {
    super(message);
    this.name = 'BuildError';
  }
}

interface CargoMetadata {
  target_directory: string;
  packages: { name: string; manifest_path: string; targets: { name: string; kind: string[] }[] }[];
}

/**
 * Find the contract crate in `dir` (the directory with its Cargo.toml) and
 * where its WASM will be written. Works for standalone crates and workspace members.
 */
export async function resolveProject(dir: string): Promise<ContractProject> {
  // `cargo metadata` reports real paths, so a project reached through a symlink (macOS's
  // /tmp and /var are symlinks into /private) would never match the path it was given.
  const abs = await realpath(resolve(dir)).catch(() => resolve(dir));
  let meta: CargoMetadata;
  try {
    const { stdout } = await run('cargo', ['metadata', '--format-version', '1', '--no-deps'], {
      cwd: abs,
      maxBuffer: 64 * 1024 * 1024,
    });
    meta = JSON.parse(stdout) as CargoMetadata;
  } catch (err) {
    throw new BuildError(`${abs} is not a Rust crate (cargo metadata failed)`, errorOutput(err));
  }
  const pkg = meta.packages.find((p) => dirname(p.manifest_path) === abs);
  if (pkg === undefined) {
    const members = meta.packages.map((p) => `${p.name} (${dirname(p.manifest_path)})`).join(', ');
    throw new BuildError(
      `No crate has its Cargo.toml in ${abs}. Point at one contract crate: ${members}`,
      '',
    );
  }
  const lib = pkg.targets.find((t) => t.kind.includes('cdylib'));
  if (lib === undefined) {
    throw new BuildError(
      `${pkg.name} has no cdylib target. Soroban contracts need crate-type = ["cdylib"] in [lib].`,
      '',
    );
  }
  const libName = lib.name.replace(/-/g, '_');
  return {
    dir: abs,
    packageName: pkg.name,
    libName,
    targetDir: meta.target_directory,
    wasmPath: resolve(meta.target_directory, 'wasm32v1-none/release', `${libName}.wasm`),
  };
}

/** Is the `stellar` CLI on PATH? */
export async function hasStellarCli(): Promise<boolean> {
  try {
    await run('stellar', ['--version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build the contract to WASM. `stellar contract build` is used when available
 * (it embeds build metadata, as a real deploy would); otherwise plain cargo.
 * @throws {BuildError} With the compiler output when the build fails.
 */
export async function buildContract(
  project: ContractProject,
  builder: Builder,
): Promise<BuildResult> {
  const started = performance.now();
  const [cmd, args] =
    builder === 'stellar'
      ? ['stellar', ['contract', 'build', '--package', project.packageName]]
      : [
          'cargo',
          ['build', '--release', '--target', 'wasm32v1-none', '--package', project.packageName],
        ];
  try {
    await run(cmd, args, { cwd: project.dir, maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    throw new BuildError(`${cmd} ${args.join(' ')} failed`, errorOutput(err));
  }
  const wasm = new Uint8Array(await readFile(project.wasmPath));
  return { wasm, wasmPath: project.wasmPath, builder, ms: Math.round(performance.now() - started) };
}

function errorOutput(err: unknown): string {
  const e = err as { stderr?: string; stdout?: string; message?: string };
  return (
    [e.stderr, e.stdout].filter((s) => typeof s === 'string' && s.length > 0).join('\n') ||
    String(e.message ?? err)
  );
}
