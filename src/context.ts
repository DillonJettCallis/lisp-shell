import { Shell } from "./shell";
import util from 'util';
import { Interpreter } from "./interpreter";
import { initModuleLib } from "./lib";
import { createInterface, Interface } from 'readline';

export class Context {

  private readonly prompt: Interface;

  constructor(private coreLib: Scope, private shell: Shell) {
    this.prompt = createInterface(process.stdin, process.stdout);
  }

  execute(command: string, args: string[]): string {
    return this.shell.execute(command, args, this.coreLib.cwd);
  }

  async repl() {
    const context = this;
    const interpreter = new Interpreter(this);
    let replScope = initModuleLib(this.coreLib);
    let resultScope = childScope(replScope);
    let resultIndex = 0;

    function initReplScope() {
      replScope.exit = () => process.exit(0);

      replScope.clearResults = () => {
        resultScope = childScope(replScope);
        resultIndex = 0;
      };

      replScope.clearDefs = () => {
        replScope = initModuleLib(context.coreLib);
        resultScope = childScope(replScope);
        resultIndex = 0;
        initReplScope();
      };

      replScope.listDefs = () => {
        Object.keys(resultScope).filter(it => !it.startsWith('result')).forEach(id => {
          console.log(id)
        });
      }
    }

    initReplScope();

    const prompt = this.prompt;

    function doPrompt(): Promise<void> {
      return new Promise(resolve => {
        console.log('');
        console.log(resultScope.cwd);
        prompt.question('λ ', async (line) => {
          try {
            const result = interpreter.eval(line, resultScope);

            if (result != null && result !== '') {
              const id = `result${resultIndex++}`;

              resultScope[id] = result;

              if (typeof result === 'string') {
                const extra = result.includes('\n') ? '\n' : '';

                console.log(`$${id}:`, `${extra}${result}`);
              } else {
                console.log(`$${id}:`, util.inspect(result, false, 3, true));
              }
            }

          } catch (e) {
            console.log(e.message);
          }

          resolve();
        });
      });
    }

    while (true) {
      await doPrompt();
    }
  }


}


export type Scope = { [key: string]: any }

export function parentScope(childScope: Scope): Scope {
  const parent = Object.getPrototypeOf(childScope.prototype);

  if (parent === Object) {
    return childScope;
  } else {
    return parent;
  }
}

export function childScope(parentScope: Scope): Scope {
  return Object.setPrototypeOf({}, parentScope);
}
