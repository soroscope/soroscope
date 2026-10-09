import { runCli } from './cli';

runCli(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`internal error: ${String(err)}\n`);
    process.exitCode = 4;
  },
);
