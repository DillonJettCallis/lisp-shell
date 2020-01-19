import { ArrayExpression, Expression, Location, ValueExpression, VariableExpression } from "./ast";

export function assertLengthExact(func: string, size: number, loc: Location, arr: any[]): void | never {
  if (arr.length !== size) {
    return loc.fail(`${func} takes exactly ${size} arguments: found ${arr.length}`)
  }
}

export function assertLengthRange(func: string, min: number, max: number, loc: Location, arr: any[]): void | never {
  if (arr.length < min || arr.length > max) {
    return loc.fail(`${func} takes between ${min} and ${max} arguments: found ${arr.length}`)
  }
}

export function assertLengthMin(func: string, min: number, loc: Location, arr: any[]): void | never {
  if (arr.length < min) {
    return loc.fail(`${func} takes at least ${min} arguments: found ${arr.length}`)
  }
}

export function assertKindVariable(func: string, position: number, ex: Expression): asserts ex is VariableExpression {
  if (ex.kind !== 'variable') {
    return ex.loc.fail(`Expected variable definition after ${func} at position ${position}: found: ${ex.kind}`)
  }
}

export function assertKindArray(func: string, position: number, ex: Expression): asserts ex is ArrayExpression {
  if (ex.kind !== 'arrayExpression') {
    return ex.loc.fail(`Expected array definition after ${func} at position ${position}: found: ${ex.kind}`)
  }
}

export function assertKeyword(expected: string, actual: Expression): asserts actual is ValueExpression {
  if (actual.kind !== 'value') {
    return actual.loc.fail(`Expected keyword ${expected}: found ${actual.kind}`)
  } else {
    if (actual.value !== expected) {
      return actual.loc.fail(`Expected keyword ${expected}: found ${actual.value}`)
    }
  }
}

export function assertIterable(loc: Location, actual: any): asserts actual is Iterable<any> {
  if (!actual?.[Symbol.iterator]) {
    loc.fail('Expected iterable')
  }
}

export function assertMap(loc: Location, actual: any): asserts actual is Map<any, any> {
  if (!(actual instanceof Map)) {
    loc.fail('Expected iterable')
  }
}

export function assertFunction(loc: Location, actual: any): asserts actual is Function {
  if (typeof actual !== 'function') {
    loc.fail('Expected function')
  }
}

export function assertNumber(loc: Location, actual: any): asserts actual is number {
  if (typeof actual !== 'number') {
    loc.fail('Expected number')
  }
}

export function assertString(loc: Location, actual: any): asserts actual is string {
  if (typeof actual !== 'string') {
    loc.fail('Expected string')
  }
}

export function assertStringOrRegex(loc: Location, actual: any): asserts actual is string | RegExp {
  if (typeof actual === 'string' || actual instanceof RegExp) {
    return;
  }

  loc.fail('Expected string')
}

export function assertNotEmptyString(loc: Location, actual: any): asserts actual is string {
  if (!(typeof actual === 'string' && actual.length > 0)) {
    loc.fail('Expected non-empty string')
  }
}

export function assertNotEmptyArray(loc: Location, actual: any): asserts actual is any[] {
  if (!(actual instanceof Array && actual.length > 0)) {
    loc.fail('Expected non-empty array')
  }
}

