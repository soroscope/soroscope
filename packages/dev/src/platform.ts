/**
 * Which prebuilt engine package matches a machine. The set mirrors
 * `engine/platforms.json`, which the release workflow reads; a unit test keeps
 * the two equal.
 */
export interface PlatformInfo {
  platform: string;
  arch: string;
  /** Linux only. Absent where it cannot be determined. */
  libc?: 'glibc' | 'musl' | undefined;
}

/** The prebuilt engine package names, keyed by `platform-arch[-libc]`. */
export const ENGINE_PACKAGES: Readonly<Record<string, string>> = {
  'linux-x64-glibc': '@soroscope/dev-linux-x64-gnu',
  'linux-arm64-glibc': '@soroscope/dev-linux-arm64-gnu',
  'darwin-x64': '@soroscope/dev-darwin-x64',
  'darwin-arm64': '@soroscope/dev-darwin-arm64',
  'win32-x64': '@soroscope/dev-win32-x64-msvc',
};

/** The file a prebuilt engine package ships, at its root. */
export const ENGINE_BINARY = 'soroscope-engine.node';

export function detectLibc(): 'glibc' | 'musl' | undefined {
  if (process.platform !== 'linux') return undefined;
  const header = (process.report?.getReport() as { header?: { glibcVersionRuntime?: string } } | undefined)?.header;
  if (header === undefined) return undefined;
  return header.glibcVersionRuntime === undefined ? 'musl' : 'glibc';
}

/** The package that holds the engine for `info`, or `undefined` when none is published for it. */
export function enginePackageFor(info: PlatformInfo): string | undefined {
  const key = info.platform === 'linux' ? `linux-${info.arch}-${info.libc ?? 'glibc'}` : `${info.platform}-${info.arch}`;
  return ENGINE_PACKAGES[key];
}
