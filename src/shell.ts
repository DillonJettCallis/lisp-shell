import spawn from 'cross-spawn';

export class Shell {

  execute(command: string, args: string[], cwd: string): Promise<string> {
    const thread = spawn(command, args, { cwd });

    thread.stderr?.pipe(process.stdout);

    return new Promise<string>(((resolve, reject) => {
      const out = thread.stdout!!.setEncoding('utf-8');
      const data: string[] = [];

      out.on('data', chunk => data.push(chunk.toString()));
      out.on('end', () => resolve(data.join('')));
      out.on('error', err => reject(err));
      thread.on('error', err => reject(err));
    }));
  }
}

