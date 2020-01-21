import spawn from 'cross-spawn';

export class Shell {

  execute(command: string, args: string[], cwd: string, logger: (s: string) => void): string {
    const out = spawn.sync(command, args, { cwd, encoding: "utf-8" });

    if (out.error) {
      throw out.error;
    }

    if (out.stderr != null && out.stderr !== '') {
      logger(out.stderr);
    }

    return out.stdout
  }
}

