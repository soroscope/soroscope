import { watch, type FSWatcher } from 'node:fs';
import { relative, sep } from 'node:path';
import {
  BuildError,
  buildContract,
  hasStellarCli,
  resolveProject,
  type Builder,
  type ContractProject,
} from './build';
import type { DevSession, ReloadResult } from './session';

export type DevLoopEvent =
  | { type: 'building'; reason: string }
  | { type: 'reloaded'; result: ReloadResult; buildMs: number; builder: Builder }
  | { type: 'build-failed'; message: string; output: string }
  | { type: 'load-failed'; message: string };

export interface DevLoopOptions {
  /** The contract crate's directory (where its Cargo.toml is). */
  projectDir: string;
  session: DevSession;
  onEvent: (event: DevLoopEvent) => void;
  /** Default: `stellar` when the CLI is on PATH, else `cargo`. */
  builder?: Builder;
  /** Named constructor arguments for the first deploy. */
  constructorArgs?: Record<string, unknown>;
  /** Quiet period after the last file change before rebuilding. Default 150 ms. */
  debounceMs?: number;
}

/** Files whose change can change the WASM. */
function relevant(path: string): boolean {
  const parts = path.split(sep);
  if (parts.includes('target') || parts.some((p) => p.startsWith('.'))) return false;
  return path.endsWith('.rs') || path.endsWith('Cargo.toml') || path.endsWith('Cargo.lock');
}

/**
 * Watch a contract crate. On every save: rebuild, then hot-swap the new code
 * into the session's contract, keeping its storage. Builds never overlap;
 * changes made during a build trigger one more build when it finishes.
 */
export class DevLoop {
  private watcher: FSWatcher | null = null;
  private timer: NodeJS.Timeout | null = null;
  private building = false;
  private pending: string | null = null;
  private project: ContractProject | null = null;
  private builder: Builder = 'cargo';
  private idle: Promise<void> = Promise.resolve();
  private settle: (() => void) | null = null;

  constructor(private readonly options: DevLoopOptions) {}

  /** Resolve the crate, do the first build and deploy, then start watching. */
  async start(): Promise<void> {
    this.project = await resolveProject(this.options.projectDir);
    this.builder = this.options.builder ?? ((await hasStellarCli()) ? 'stellar' : 'cargo');
    await this.rebuild('start');
    this.watcher = watch(this.project.dir, { recursive: true }, (_event, file) => {
      if (file === null || !relevant(file.toString())) return;
      this.schedule(relative(this.project!.dir, `${this.project!.dir}${sep}${file.toString()}`));
    });
  }

  /** Resolves once no build is running or queued. */
  whenIdle(): Promise<void> {
    return this.idle;
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.timer !== null) clearTimeout(this.timer);
  }

  private schedule(reason: string): void {
    if (this.timer !== null) clearTimeout(this.timer);
    if (this.settle === null) this.idle = new Promise((r) => (this.settle = r));
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.rebuild(`${reason} changed`);
    }, this.options.debounceMs ?? 150);
  }

  private async rebuild(reason: string): Promise<void> {
    if (this.building) {
      this.pending = reason;
      return;
    }
    this.building = true;
    const emit = this.options.onEvent;
    try {
      emit({ type: 'building', reason });
      let built;
      try {
        built = await buildContract(this.project!, this.builder);
      } catch (err) {
        if (!(err instanceof BuildError)) throw err;
        emit({ type: 'build-failed', message: err.message, output: err.output });
        return;
      }
      try {
        const result = this.options.session.reload(built.wasm, this.options.constructorArgs);
        emit({ type: 'reloaded', result, buildMs: built.ms, builder: built.builder });
      } catch (err) {
        emit({ type: 'load-failed', message: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      this.building = false;
      const next = this.pending;
      this.pending = null;
      if (next !== null) {
        void this.rebuild(next);
      } else if (this.timer === null && this.settle !== null) {
        this.settle();
        this.settle = null;
      }
    }
  }
}
