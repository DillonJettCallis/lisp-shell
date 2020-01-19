import { spawnSync } from 'child_process';
import os from 'os';

export class Shell {

  private readonly shellSystem: string;

  constructor() {
    this.shellSystem = os.type() === 'Windows_NT' ? 'cmd' : 'sh';
  }

  execute(command: string, args: string[], cwd: string, logger: (s: string) => void): string {
    const out = spawnSync(command, args, { cwd, encoding: "utf-8", shell: this.shellSystem });

    if (out.error) {
      throw out.error;
    }

    if (out.stderr != null && out.stderr !== '') {
      logger(out.stderr);
    }

    return out.stdout
  }
}

