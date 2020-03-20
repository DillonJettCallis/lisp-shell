import spawn from 'cross-spawn';

export class Shell {

  execute(command: string, args: string[], cwd: string): string {
    const thread = spawn.sync(command, args, { cwd, encoding: "utf8", stdio: ['ignore', 'pipe', process.stdout ] });

    if (thread.error) {
      throw thread.error;
    }

    return thread.stdout.trimEnd();
  }
}

