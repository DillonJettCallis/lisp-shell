import { ValueExpression } from "./ast";
import { Shell } from "./shell";
// @ts-ignore
import Vorpal from 'vorpal';
import { Interpreter } from "./interpreter";
import { initModuleLib } from "./lib";



export class Context {

  private readonly vorpal = new Vorpal();

  constructor(private coreLib: Scope, private shell: Shell) {
  }

  execute(command: string, args: string[]): string {
    return this.shell.execute(command, args, this.coreLib.cwd, s => this.vorpal.log(s));
  }

  repl() {
    const context = this;
    const interpreter = new Interpreter(this);
    let replScope = initModuleLib(this.coreLib);
    let resultIndex = 0;

    const vorpal = this.vorpal;

    Object.defineProperty(replScope, 'exit', {
      writable: false,
      configurable: false,
      enumerable: false,
      value(){
        process.exit(0);
      }
    });

    Object.defineProperty(replScope, 'clearResults', {
      writable: false,
      configurable: false,
      enumerable: false,
      value(){
        const inScope = new Set(Object.getOwnPropertyNames(replScope));

        for (let i = 0; i <= resultIndex; i++) {
          const id = `result${resultIndex}`;

          if (inScope.has(id)) {
            delete replScope[id];
          }
        }

        resultIndex = 0;
      }
    });

    Object.defineProperty(replScope, 'clearDefs', {
      writable: false,
      configurable: false,
      enumerable: false,
      value(){
        replScope = initModuleLib(context.coreLib);

        resultIndex = 0;
      }
    });

    vorpal
      .mode('$')
      .delimiter('$')
      .init(function(this: any, args: any[], callback: () => void) {
        this.delimiter(context.coreLib.cwd);
        callback();
      })
      .action(function (this: any, command: string, callback: () => void) {
        try {
          const result = interpreter.eval(command, replScope);

          if (result != null && result !== '') {
            const id = `result${resultIndex++}`;

            replScope[id] = result;

            this.log(`$${id}: ${result}`);
          }

        } catch (e) {
          this.log(e.message);
        }

        this.delimiter(context.coreLib.cwd);
        callback();
      });

    vorpal
      .delimiter('')
      .show()
      .exec('$');
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