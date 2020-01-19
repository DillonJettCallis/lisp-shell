import { Expression, SExpression, ValueExpression, Visitor } from "./ast";
import { assertLengthExact, assertNotEmptyString, assertString } from "./assertions";

function findLastIndex<T>(src: T[], test: (t: T) => boolean): number {
  for (let i = src.length - 1; i >= 0; i--) {
    if (test(src[i])) {
      return i;
    }
  }

  return -1;
}

export const pipe: Visitor = {
  sExpression(ex) {
    const maybePipe = findLastIndex(ex.body, it => it.kind === 'value' && !it.quoted && it.value === '|');

    if (maybePipe === -1) {
      return;
    }

    const loc = ex.body[maybePipe].loc;
    const left = ex.body.slice(0, maybePipe);
    const right = ex.body.slice(maybePipe + 1);

    const inner: Expression = left.length === 1 ? left[0] : {kind: 'sExpression', body: left, loc};
    right.push(inner);
    ex.body = right;
  }
};

function doAccessVariableSwap(ex: Expression, base: string) {
  // (Array.map)
  // (get $Array map)
  const parts = base.split('.');
  const head = parts.shift();

  assertNotEmptyString(ex.loc, head);
  parts.forEach(it => assertNotEmptyString(ex.loc, it));

  const body: Expression[] = [
    {kind: 'variable', name: 'get', loc: ex.loc},
    {kind: 'variable', name: head, loc: ex.loc},
    ...parts.map(it => (<ValueExpression> {kind: 'value', value: it, loc: ex.loc, quoted: true }))
  ];

  // sometimes Javascript is amazing, allowing us to totally mutate one expression into another.
  const mutate = ex as SExpression;
  mutate.kind = 'sExpression';
  mutate.body = body;
}

export const dotAccess: Visitor = {
  sExpression(ex) {
    const first = ex.body[0];

    function doSwap(base: string) {
      // (.field $obj)
      // (get $obj 'field')
      const name = base.substring(1);

      assertLengthExact('. access', 2, ex.loc, ex.body);
      const obj = ex.body[1];

      ex.body = [
        {kind: 'variable', name: 'get', loc: ex.loc},
        obj,
        ...name.split('.').map(it => (<ValueExpression> {kind: 'value', value: it, loc: first.loc, quoted: true }))
      ];
    }

    if (first.kind === 'variable' && first.name.startsWith('.')) {
      doSwap(first.name);
    } else if (first.kind === 'value' && !first.quoted && typeof first.value === 'string' && first.value.startsWith('.')) {
      doSwap(first.value);
    }
  },
  variable(ex) {
    if (ex.name.includes('.')) {
      doAccessVariableSwap(ex, ex.name);
    }
  },
  value(ex) {
    if (!ex.quoted && typeof ex.value === 'string' && ex.value.includes('.')) {
      doAccessVariableSwap(ex, ex.value);
    }
  }
};
