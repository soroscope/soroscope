/** Where the CLI writes. Data goes to stdout, diagnostics to stderr. */
export interface Io {
  out(text: string): void;
  err(text: string): void;
}

export const processIo: Io = {
  out: (text) => {
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
  },
  err: (text) => {
    process.stderr.write(text.endsWith('\n') ? text : `${text}\n`);
  },
};
