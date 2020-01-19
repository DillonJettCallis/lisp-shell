import { childScope, Context, Scope } from "./context";
import { ArrayExpression, Expression, Location, ValueExpression, VariableExpression } from "./ast";
import { FunctionKind, functionKind, Interpreter } from "./interpreter";
import path from "path";
import fs from 'fs';


function macroFun(func: (args: Expression[], scope: Scope, interpreter: Interpreter, loc: Location) => any): any {
  (func as any)[functionKind] = FunctionKind.Macro;
  return func
}

function fun(func: (args: any[], loc: Location) => any): any {
  (func as any)[functionKind] = FunctionKind.Lib;
  return func


}

function userFun(func: (...args: any[]) => any): any {
  (func as any)[functionKind] = FunctionKind.User;
  return func
}

function assertLengthExact(func: string, size: number, loc: Location, arr: any[]): void | never {
  if (arr.length !== size) {
    return loc.fail(`${func} takes exactly ${size} arguments: found ${arr.length}`)
  }
}

function assertLengthRange(func: string, min: number, max: number, loc: Location, arr: any[]): void | never {
  if (arr.length < min || arr.length > max) {
    return loc.fail(`${func} takes between ${min} and ${max} arguments: found ${arr.length}`)
  }
}

function assertKindVariable(func: string, position: number, ex: Expression): asserts ex is VariableExpression {
  if (ex.kind !== 'variable') {
    return ex.loc.fail(`Expected variable definition after ${func} at position ${position}: found: ${ex.kind}`)
  }
}

function assertKindArray(func: string, position: number, ex: Expression): asserts ex is ArrayExpression {
  if (ex.kind !== 'arrayExpression') {
    return ex.loc.fail(`Expected array definition after ${func} at position ${position}: found: ${ex.kind}`)
  }
}

function assertKeyword(expected: string, actual: Expression): asserts actual is ValueExpression {
  if (actual.kind !== 'value') {
    return actual.loc.fail(`Expected keyword ${expected}: found ${actual.kind}`)
  } else {
    if (actual.value !== expected) {
      return actual.loc.fail(`Expected keyword ${expected}: found ${actual.value}`)
    }
  }
}

function assertIterable(loc: Location, actual: any): asserts actual is Iterable<any> {
  if (!actual?.[Symbol.iterator]) {
    loc.fail('Expected iterable')
  }
}

function assertMap(loc: Location, actual: any): asserts actual is Map<any, any> {
  if (!(actual instanceof Map)) {
    loc.fail('Expected iterable')
  }
}

function assertFunction(loc: Location, actual: any): asserts actual is Function {
  if (typeof actual !== 'function') {
    loc.fail('Expected function')
  }
}

function assertNumber(loc: Location, actual: any): asserts actual is number {
  if (typeof actual !== 'number') {
    loc.fail('Expected number')
  }
}

function assertString(loc: Location, actual: any): asserts actual is string {
  if (typeof actual !== 'string') {
    loc.fail('Expected string')
  }
}

function assertStringOrRegex(loc: Location, actual: any): asserts actual is string | RegExp {
  if (typeof actual === 'string' || actual instanceof RegExp) {
    return;
  }

  loc.fail('Expected string')
}


function makeRegex(loc: Location, actual: any): RegExp {
  if (typeof actual === 'string') {
    return RegExp(actual);
  } else if (actual instanceof RegExp) {
    return actual;
  } else {
    loc.fail('Expected string')
  }
}

function toArray(src: Iterable<any>): any[] {
  if (src instanceof Array) {
    return src;
  } else {
    return Array.from(src);
  }
}

function assertNotEmpty(loc: Location, actual: any[]) {
  if (actual.length === 0) {
    loc.fail('Expected non-empty array')
  }
}


export function initCoreLib(cwd: string): Scope {
  const coreLib: Scope = {
    get cwd(): string {
      return cwd;
    },
    def: macroFun((args, scope, interpreter, loc) => {
      assertLengthExact('def', 2, loc, args);
      
      const [id, valueEx] = args;

      assertKindVariable('def', 1, id);
      
      scope.$module[id.name] = interpreter.interpret(valueEx, scope);
    }),
    if: macroFun((args, scope, interpreter, loc) => {
      assertLengthRange('if', 2, 3, loc, args);

      const [conditionEx, thenEx, elseEx] = args;

      if (interpreter.interpret(conditionEx, scope)) {
        return interpreter.interpret(thenEx, scope);
      } else {
        if (elseEx) {
          return interpreter.interpret(elseEx, scope);
        } else {
          return null;
        }
      }
    }),
    for: macroFun((args, scope, interpreter, loc) => {
      assertLengthExact('for', 4, loc, args);
      
      const [id, inWord, rangeEx, body] = args;

      assertKindVariable('for', 1, id);
      assertKeyword('in', inWord);

      const range = interpreter.interpret(rangeEx, scope);

      assertIterable(range, rangeEx.loc);

      const result = [];

      for (const next of range) {
        const innerScope = childScope(scope);
        innerScope[id.name] = next;
        result.push(interpreter.interpret(body, innerScope));
      }

      return result;
    }),
    fn: macroFun((args, scope, interpreter, loc) => {
      // (fn [$x, $y] (+ $x $y))
      assertLengthExact('fn', 2, loc, args);
      const [rawParams, body] = args;

      assertKindArray('fn', 1, rawParams);

      const params = rawParams.body.map((param, index) => {
        assertKindVariable('fn', index, param);
        return param.name;
      });

      return userFun((...args) => {
        const innerScope = childScope(scope);
        params.forEach((param, index) => {
          innerScope[param] = args[index];
        });

        return interpreter.interpret(body, innerScope);
      })
    }),
    defn: macroFun((args, scope, interpreter, loc) => {
      // (defn add [$x, $y] (+ $x $y))
      const [name, params, body] = args;

      const value = coreLib.fn([params, body], scope, interpreter, loc);

      return coreLib.def([name, {kind: 'value', value, quoted: false, loc}], scope, interpreter, loc);
    }),
    let: macroFun((args, scope, interpreter, loc) => {
      // (let [[$x 2] [$y 3]] (+ $x $y))
      // (let [$x 2] (+ $x 1))
      assertLengthExact('let', 2, loc, args);
      const [params, body] = args;
      assertKindArray('let', 1, params);
      assertNotEmpty(loc, params.body);

      const isNested = params.body[0].kind === 'arrayExpression';
      const pairExpressions = isNested ? params.body.map(it => {assertKindArray('let', 1, it); return it.body}) : [params.body];

      const innerScope = childScope(scope);

      pairExpressions.forEach(pair => {
        assertLengthExact('let', 2, loc, pair);
        const [key, valueEx] = pair;
        assertKindVariable('let', 2, key);

        innerScope[key.name] = interpreter.interpret(valueEx, innerScope);
      });

      return interpreter.interpret(body, innerScope);
    }),
    eval: fun((args, loc) => {
      assertLengthExact('eval', 1, loc, args);
      const raw = args[0];
      assertString(loc, raw);

      return Function(`'use strict';return (${raw})`)();
    }),
    cd: fun((args, loc) => {
      assertLengthExact('cd', 1, loc, args);
      const toPath = args[0];
      assertString(loc, toPath);

      const resultPath = path.resolve(cwd, toPath);

      if (!fs.existsSync(resultPath)) {
        throw new Error(`No such directory ${resultPath} exists`)
      }

      const stats = fs.lstatSync(resultPath);

      if (!stats.isDirectory()) {
        throw new Error(`Path ${resultPath} is a file, not a directory`)
      }

      cwd = resultPath;

      return resultPath;
    }),
    delete: macroFun((args, scope, interpreter, loc) => {
      for (const argEx of args) {
        assertKindVariable('delete', 1, argEx);
        delete scope[argEx.name];
      }
    }),
    echo: fun(args => {
      console.log(...args);
    }),
    range: fun((args, loc) => {
      assertLengthExact('range', 2, loc, args);

      const [start, end] = args;

      if (typeof start !== 'number') {
        return loc.fail('range function expects two numbers')
      }

      if (typeof end !== 'number') {
        return loc.fail('range function expects two numbers')
      }

      function *gen() {
        for (let i = start; i < end; i++) {
          yield i;
        }
      }

      return gen();
    }),
    do: fun(args => args[args.length - 1]),
    toArray: fun((args, loc) => {
      assertLengthExact('toArray', 1, loc, args);

      const arr = args[0];

      assertIterable(loc, arr);

      return toArray(arr);
    }),
    'Array.from': fun(args => args),
    'map': fun((args, loc) => {
      assertLengthExact('map', 2, loc, args);

      const [arr, func] = args;

      assertIterable(loc, arr);
      assertFunction(loc, func);

      return toArray(arr).map(func);
    }),
    'flatMap': fun((args, loc) => {
      assertLengthExact('flatMap', 2, loc, args);

      const [arr, func] = args;

      assertIterable(loc, arr);
      assertFunction(loc, func);

      function *doFlatMap() {
        for (const next of arr) {
          yield* func(next);
        }
      }

      return toArray(doFlatMap());
    }),
    'filter': fun((args, loc) => {
      assertLengthExact('filter', 2, loc, args);

      const [arr, func] = args;

      assertIterable(loc, arr);
      assertFunction(loc, func);

      return toArray(arr).filter(func);
    }),
    'fold': fun((args, loc) => {
      assertLengthExact('fold', 3, loc, args);

      const [arr, init, func] = args;

      assertIterable(loc, arr);
      assertFunction(loc, func);

      let prev = init;

      for (const next of arr) {
        prev = func(prev, next)
      }

      return prev;
    }),
    'head': fun((args, loc) => {
      assertLengthExact('head', 1, loc, args);

      const arr = args[0];

      assertIterable(loc, arr);

      return arr[Symbol.iterator]().next();
    }),
    'tail': fun((args, loc) => {
      assertLengthExact('tail', 1, loc, args);

      const arr = args[0];

      assertIterable(loc, arr);

      const iter = arr[Symbol.iterator]();

      iter.next();

      return Array.from({[Symbol.iterator]: () => iter });
    }),
    'init': fun((args, loc) => {
      assertLengthExact('init', 1, loc, args);

      const arr = args[0];

      assertIterable(loc, arr);

      const result = Array.from(arr);
      result.pop();
      return result;
    }),
    'last': fun((args, loc) => {
      assertLengthExact('last', 1, loc, args);

      const arr = args[0];

      assertIterable(loc, arr);

      let last = null;

      for (const next of arr) {
        last = next;
      }

      return last;
    }),
    'take': fun((args, loc) => {
      assertLengthExact('take', 2, loc, args);

      const [arr, size] = args;

      assertIterable(loc, arr);
      assertNumber(loc, size);

      const result = [];
      let i = 0;

      for (const next of arr) {
        if (i++ > size) {
          return result;
        } else {
          result.push(next);
        }
      }

      return result;
    }),
    'drop': fun((args, loc) => {
      assertLengthExact('drop', 2, loc, args);

      const [arr, size] = args;

      assertIterable(loc, arr);
      assertNumber(loc, size);

      const result = [];
      let i = 0;

      for (const next of arr) {
        if (i++ > size) {
          result.push(next);
        }
      }

      return result;
    }),
    '+': fun((args) => args.reduce((left, right) => left + right)),
    '-': fun((args) => args.reduce((left, right) => left - right)),
    '*': fun((args) => args.reduce((left, right) => left * right)),
    '/': fun((args) => args.reduce((left, right) => left / right)),
    'modulus': fun((args) => args.reduce((left, right) => left % right)),
    '^': fun((args) => args.reduce((left, right) => left ** right)),
    '==': fun((args, loc) => {
      assertLengthExact('==', 2, loc, args);

      const [left, right] = args;

      return left === right;
    }),
    '!=': fun((args, loc) => {
      assertLengthExact('!=', 2, loc, args);

      const [left, right] = args;

      return left !== right;
    }),
    'not': fun((args, loc) => {
      assertLengthExact('not', 1, loc, args);

      return !args[0];
    }),
    'and': macroFun((args, scope, interpreter, loc) => {
      return args.reduce((left, right) => left && interpreter.interpret(right, scope), true);
    }),
    'or': macroFun((args, scope, interpreter, loc) => {
      return args.reduce((left, right) => left || interpreter.interpret(right, scope), false);
    }),
    'xor': macroFun((args, scope, interpreter, loc) => {
      assertLengthExact('xor', 2, loc, args);

      const [left, right] = args;

      return (!left) !== (!right);
    }),
    'nil?': fun((args, loc) => {
      assertLengthExact('nil?', 1, loc, args);

      return args[0] == null;
    }),
    'parseWords': fun((args, loc) => {
      // (parseArray 'a string of words') -> ['a' 'string' 'of' words']
      assertLengthExact('parseWords', 1, loc, args);
      const raw = args[0];

      assertString(loc, raw);

      return raw.split(/\s+/);
    }),
    'parseLines': fun((args, loc) => {
      assertLengthExact('parseWords', 1, loc, args);
      const raw = args[0];

      assertString(loc, raw);

      return raw.split(/\n/);
    }),
    'parseTable': fun((args, loc) => {
      // (parseTable [name age] 'Dave 26\nSara 32\nBrian 45')
      // -> [{name: 'Dave', age: 26}, {name: 'nSara', age: 32}, {name: 'nBrian', age: 45}]

      // (parseTable "|" [name age] 'Dave|26\nSara|32\nBrian|45')
      // -> [{name: 'Dave', age: 26}, {name: 'nSara', age: 32}, {name: 'nBrian', age: 45}]

      assertLengthRange('parseTable', 2, 3, loc, args);
      const delimiter = args.length === 3 ? args.shift() : /\s+/;
      const [rawKeys, raw] = args;

      assertStringOrRegex(loc, delimiter);
      assertIterable(loc, rawKeys);
      assertString(loc, raw);

      const keys = Array.from(rawKeys);

      return raw.split(/\n/).map(it => it.trim()).filter(it => it).map(it => {
        const values = it.split(delimiter);
        const result = new Map();
        keys.forEach((key, index) => {
          result.set(key, values[index]);
        });
        return result;
      })
    }),
    'parseJson': fun((args, loc) => {
      assertLengthExact('parseJson', 1, loc, args);
      const raw = args[0];

      assertString(loc, raw);

      return JSON.parse(raw);
    }),
    'get': fun((args, loc) => {
      assertLengthExact('get', 2, loc, args);

      const [map, key] = args;

      assertMap(loc, map);

      return map.get(key);
    }),
    'set': fun((args, loc) => {
      assertLengthExact('get', 3, loc, args);

      const [map, key, value] = args;

      assertMap(loc, map);

      return map.set(key, value);
    })
  };

  coreLib.$coreLib = coreLib;

  return coreLib;
}

export function initModuleLib(coreLib: Scope) {
  const module = Object.setPrototypeOf({}, coreLib);
  module.$module = module; // sneaky sneaky! Store myself in a field on myself!
  return module;
}
