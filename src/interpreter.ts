import { Expression, SExpression, walk } from "./ast";
import { Context, Scope } from "./context";
import { lex } from "./lexer";
import { parse } from "./parser";
import { dotAccess, makeCommand, optimize, pipe } from "./optimize";


export const functionKind = Symbol('functionKind');

export const enum FunctionKind {
  User,
  Lib,
  Macro,
}

export class Interpreter {

  constructor(private context: Context) {
  }

  eval(raw: string, scope: Scope): any {
    const lexed = lex(raw);
    const parsed = parse(lexed);

    optimize(parsed);

    return this.interpret(parsed, scope);
  }

  interpret(ex: Expression, scope: Scope): any {
    switch (ex.kind) {
      case "sExpression":
        return this.interpretSExpression(ex, scope);
      case "arrayExpression":
        return ex.body.map(it => this.interpret(it, scope));
      case "mapExpression": {
        const out = new Map<any, any>();
        const max = ex.body.length;

        for (let i = 0; i < max; i += 2) {
          const key = this.interpret(ex.body[i], scope);
          const value = this.interpret(ex.body[i + 1], scope);
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

  private interpretSExpression(ex: SExpression, scope: Scope): any {
    const body = ex.body.slice(1);

    const call = (fun: Function): any => {
      switch ((fun as any)[functionKind]) {
        case FunctionKind.Macro:
          return fun(body, scope, this, ex.loc);
        case FunctionKind.Lib:
          return fun(body.map(it => this.interpret(it, scope)), ex.loc);
        default:
          return fun(...body.map(it => this.interpret(it, scope)));
      }
    };

    const exec = (fun: string): any => {
      const args = body.map(it => this.interpret(it, scope))
        .flatMap(it => {
          if (it instanceof Array) {
            return it;
          } else {
            return [it];
          }
        }).map(it => String(it));

      return this.context.execute(fun, args);
    };

    const first = ex.body[0];

    if (first.kind === 'command') {
      // if this is a raw, unquoted string expression, try looking it up like a variable
      const maybeFunc = scope[first.value];

      if (typeof maybeFunc === 'function') {
        // if we find a variable and it is a function, great! Call it.
        return call(maybeFunc);
      }
    }

    // otherwise we need to evaluate the argument to decide what to do
    const value = this.interpret(first, scope);

    if (typeof value === 'function') {
      // if the interpreted value is a function, great! Call it.
      return call(value);
    } else if (typeof value === 'string') {
      // finally. it wasn't a raw unquoted string, and it wasn't an expression that returned a function
      // so it must be a command
      return exec(value);
    } else {
      return ex.loc.fail('SExpression is not a function or a command')
    }
  }
}


export function interpret(ast: SExpression, scope: Scope, context: Context): any {
  return new Interpreter(context).interpret(ast, scope);
}



