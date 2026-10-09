/** Process exit codes. Scripts and CI depend on these staying stable. */
export const ExitCode = {
  /** Success. */
  Ok: 0,
  /** The command ran but its verdict is a failure (strict probe, regression found). */
  Failure: 1,
  /** Bad usage or configuration. */
  Usage: 2,
  /** No provider could be reached or none can serve the request. */
  Network: 3,
  /** Unexpected internal error. */
  Internal: 4,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/** An error that maps directly to an exit code and a user-facing message. */
export class CliError extends Error {
  readonly exitCode: ExitCodeValue;

  constructor(message: string, exitCode: ExitCodeValue = ExitCode.Failure) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}
