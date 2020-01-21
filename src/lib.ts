import { childScope, Scope } from "./context";
import { Expression, Location } from "./ast";
import { FunctionKind, functionKind, Interpreter } from "./interpreter";
import path from "path";
import fs from 'fs';
import {
  assertFunction,
  assertIterable,
  assertKeyword,
  assertKindArray,
  assertKindVariable,
  assertLengthExact,
  assertLengthMin,
  assertLengthRange,
  assertNotEmptyArray,
  assertNumber,
  assertString,
  assertStringOrRegex
} from "./assertions";


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

function safeAccess(obj: any, key: string) {
  if (obj == null) {
    return undefined;
  } else if (obj instanceof Map) {
    return obj.get(key);
  } else {
    return obj[key];
  }
}

export function initCoreLib(cwd: string): Scope {
  const coreLib: Scope = {
    get cwd(): string {
      return cwd;
    },
    Array: initArrayLib(),
    Parse: initParseLib(),
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
      assertNotEmptyArray(loc, params.body);

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
    do: fun(args => args[args.length - 1]),
    toArray: fun((args, loc) => {
      assertLengthExact('toArray', 1, loc, args);

      const arr = args[0];

      assertIterable(loc, arr);

      return toArray(arr);
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
    get: fun((args, loc) => {
      assertLengthMin('get', 2, loc, args);

      const [map, ...keys] = args;

      return keys.reduce(safeAccess, map);
    }),
    set: fun((args, loc) => {
      assertLengthMin('set', 3, loc, args);

      const value = args.pop();
      const map = args.shift();
      const keys = args;
      const lastKey = keys.pop();

      const lastObj = keys.reduce(safeAccess, map);

      if (lastObj == null) {
        return undefined;
      } else if (lastObj instanceof Map) {
        return lastObj.set(lastKey, value);
      } else {
        lastObj[lastKey] = value;
        return lastObj;
      }
    })
  };

  coreLib.$coreLib = coreLib;

  return coreLib;
}

function initArrayLib() {
  return {
    from: fun(args => args),
    range: fun((args, loc) => {
      assertLengthExact('Array.range', 2, loc, args);

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
    map: fun((args, loc) => {
      assertLengthExact('Array.map', 2, loc, args);

      const [arr, func] = args;

      assertIterable(loc, arr);
      assertFunction(loc, func);

      return toArray(arr).map(func);
    }),
    flatMap: fun((args, loc) => {
      assertLengthExact('Array.flatMap', 2, loc, args);

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
      assertLengthExact('Array.filter', 2, loc, args);

      const [arr, func] = args;

      assertIterable(loc, arr);
      assertFunction(loc, func);

      return toArray(arr).filter(func);
    }),
    'fold': fun((args, loc) => {
      assertLengthExact('Array.fold', 3, loc, args);

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
      assertLengthExact('Array.head', 1, loc, args);

      const arr = args[0];

      assertIterable(loc, arr);

      return arr[Symbol.iterator]().next();
    }),
    'tail': fun((args, loc) => {
      assertLengthExact('Array.tail', 1, loc, args);

      const arr = args[0];

      assertIterable(loc, arr);

      const iter = arr[Symbol.iterator]();

      iter.next();

      return Array.from({[Symbol.iterator]: () => iter });
    }),
    'init': fun((args, loc) => {
      assertLengthExact('Array.init', 1, loc, args);

      const arr = args[0];

      assertIterable(loc, arr);

      const result = Array.from(arr);
      result.pop();
      return result;
    }),
    'last': fun((args, loc) => {
      assertLengthExact('Array.last', 1, loc, args);

      const arr = args[0];

      assertIterable(loc, arr);

      let last = null;

      for (const next of arr) {
        last = next;
      }

      return last;
    }),
    'take': fun((args, loc) => {
      assertLengthExact('Array.take', 2, loc, args);

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
      assertLengthExact('Array.drop', 2, loc, args);

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
  }
}

function initParseLib() {
  return {
    words: fun((args, loc) => {
      // (parseArray 'a string of words') -> ['a' 'string' 'of' words']
      assertLengthExact('Parse.words', 1, loc, args);
      const raw = args[0];

      assertString(loc, raw);

      return raw.split(/\s+/).filter(it => it);
    }),
    lines: fun((args, loc) => {
      assertLengthExact('Parse.lines', 1, loc, args);
      const raw = args[0];

      assertString(loc, raw);

      return raw.split(/\n/);
    }),
    table: fun((args, loc) => {
      // (parseTable [name age] 'Dave 26\nSara 32\nBrian 45')
      // -> [{name: 'Dave', age: 26}, {name: 'nSara', age: 32}, {name: 'nBrian', age: 45}]

      // (parseTable "|" [name age] 'Dave|26\nSara|32\nBrian|45')
      // -> [{name: 'Dave', age: 26}, {name: 'nSara', age: 32}, {name: 'nBrian', age: 45}]

      assertLengthRange('Parse.table', 2, 3, loc, args);
      const delimiter = args.length === 3 ? args.shift() : /\s+/;
      const [rawKeys, raw] = args;

      assertStringOrRegex(loc, delimiter);
      assertIterable(loc, rawKeys);
      assertString(loc, raw);

      const keys = Array.from(rawKeys);

      return raw.split(/\n+/).map(it => it.trim()).filter(it => it).map(it => {
        const values = it.split(delimiter);
        const result = new Map();
        keys.forEach((key, index) => {
          result.set(key, values[index]);
        });
        return result;
      })
    }),
    json: fun((args, loc) => {
      assertLengthExact('Parse.json', 1, loc, args);
      const raw = args[0];

      assertString(loc, raw);

      return JSON.parse(raw);
    }),
  }
}

export function initModuleLib(coreLib: Scope) {
  const module = Object.create(coreLib);
  module.$module = module; // sneaky sneaky! Store myself in a field on myself!
  return module;
}
