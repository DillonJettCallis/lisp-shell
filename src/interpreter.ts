import { Expression, SExpression } from "./ast";
import { Context, Scope } from "./context";
import { lex } from "./lexer";
import { parse } from "./parser";
import { optimize } from "./optimize";


export const functionKind = Symbol('functionKind');

export const enum FunctionKind {
  User,
  Lib,
  Macro,
}

export class Interpreter {

  constructor(private context: Context) {
  }

  eval(raw: string, scope: Scope): Promise<any> {
    const lexed = lex(raw);
    const parsed = parse(lexed);

    optimize(parsed);

    return this.interpret(parsed, scope);
  }

  async interpret(ex: Expression, scope: Scope): Promise<any> {
    switch (ex.kind) {
      case "sExpression":
        return await this.interpretSExpression(ex, scope);
      case "arrayExpression":
        return await Promise.all(ex.body.map(it => this.interpret(it, scope)));
      case "mapExpression": {
        const out = new Map<any, any>();
        const max = ex.body.length;

        for (let i = 0; i < max; i += 2) {
          const key = await this.interpret(ex.body[i], scope);
          const value = await this.interpret(ex.body[i + 1], scope);
          out.set(key, value);
        }

        return out;
      }
      case "variable":
        return scope[ex.name];
      case "command":
      case "value":
        return ex.value;
    }
  }

  private async interpretSExpression(ex: SExpression, scope: Scope): Promise<any> {
    const body = ex.body.slice(1);

    const call = async (fun: Function): Promise<any> => {
      switch ((fun as any)[functionKind]) {
        case FunctionKind.Macro:
          return await fun(body, scope, this, ex.loc);
        case FunctionKind.Lib:
          return fun(await Promise.all(body.map(it => this.interpret(it, scope))), ex.loc);
        default:
          return fun(...await Promise.all(body.map(it => this.interpret(it, scope))));
      }
    };

    const exec = async (fun: string): Promise<any> => {
      const args = (await Promise.all(body.map(it => this.interpret(it, scope))))
        .flatMap(it => {
          if (it instanceof Array) {
            return it;
          } else {
            return [it];
          }
        }).map(it => String(it));

      return await this.context.execute(fun, args);
    };

    const first = ex.body[0];

    if (first.kind === 'command') {
      // if this is a raw, unquoted string expression, try looking it up like a variable
      const maybeFunc = scope[first.value];

      if (typeof maybeFunc === 'function') {
        // if we find a variable and it is a function, great! Call it.
        return await call(maybeFunc);
      }
    }

    // otherwise we need to evaluate the argument to decide what to do
    const value = await this.interpret(first, scope);

    if (typeof value === 'function') {
      // if the interpreted value is a function, great! Call it.
      return await call(value);
    } else if (typeof value === 'string') {
      // finally. it wasn't a raw unquoted string, and it wasn't an expression that returned a function
      // so it must be a command
      return await exec(value);
    } else {
      return ex.loc.fail('SExpression is not a function or a command')
    }
  }
}


export function interpret(ast: SExpression, scope: Scope, context: Context): Promise<any> {
  return new Interpreter(context).interpret(ast, scope);
}



