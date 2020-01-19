import { Expression, Location, SExpression, walk } from "./ast";
import { Context, Scope } from "./context";
import { lex } from "./lexer";
import { parse } from "./parser";
import { dotAccess, pipe } from "./optimize";


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

    walk(pipe, parsed);
    walk(dotAccess, parsed);
    const loc = new Location(0, 0);
    const walked: SExpression = {kind: 'sExpression', body: [{kind: "variable", name: 'do', loc}, parsed], loc};

    return this.interpret(walked, scope);
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
      const args = body.map(it => this.interpret(it, scope));

      return this.context.execute(fun, args);
    };

    const first = ex.body[0];

    const value = this.interpret(first, scope);

    if (typeof value === 'function') {
      // if the interpreted value is a function, great! Call it.
      return call(value);
    } else if (typeof value === 'string') {
      // otherwise if we got a string we need to decide if the user meant call a function or a program
      if (first.kind === 'value' && !first.quoted) {
        // if this is a raw, unquoted string expression, try looking it up like a variable
        const maybeFunc = scope[value];

        if (typeof maybeFunc === 'function') {
          // if we find a variable and it is a function, great! Call it.
          return call(maybeFunc);
        }
      }

      // if this was a string one of these is true:
      //   not a literal
      //   it was quoted
      //   we could not find a value
      //   we did find a value but it wasn't a function
      // then execute the string as a program
      return exec(value);
    } else {
      return ex.loc.fail('SExpression is not a function or a command')
    }
  }
}


export function interpret(ast: SExpression, scope: Scope, context: Context): any {
  return new Interpreter(context).interpret(ast, scope);
}



