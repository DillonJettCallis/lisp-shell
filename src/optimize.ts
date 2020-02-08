import { CommandExpression, Expression, SExpression, ValueExpression, Visitor, walk } from "./ast";
import { assertLengthRange, assertNotEmptyString } from "./assertions";

function findLastIndex<T>(src: T[], test: (t: T) => boolean): number {
  for (let i = src.length - 1; i >= 0; i--) {
    if (test(src[i])) {
      return i;
    }
  }

  return -1;
}

export const makeCommand: Visitor = {
  sExpression(ex) {
    const first = ex.body[0];

    if (first.kind === 'value' && typeof first.value === 'string' && !first.quoted) {
      (first as any as CommandExpression).kind = 'command';
    }
  }
};

const pipes = new Set(['|', '|>', ';']);

export const pipe: Visitor = {
  sExpression(ex) {
    const maybePipe = findLastIndex(ex.body, it => it.kind === 'value' && !it.quoted && pipes.has(it.value));

    if (maybePipe === -1) {
      return;
    }

    const pipeEx = ex.body[maybePipe];

    if (pipeEx.kind !== 'value') {
      // literally impossible because we already checked this.
      throw new Error("Impossible!")
    }

    const loc = pipeEx.loc;
    const left = ex.body.slice(0, maybePipe);
    const right = ex.body.slice(maybePipe + 1);

    switch (pipeEx.value) {
      case '|': {
        const rightFunc = right.shift();
        right.unshift({kind: 'sExpression', body: left, loc});
        if (rightFunc != null) {
          right.unshift(rightFunc);
        }
        ex.body = right;
        break;
      }
      case '|>': {
        right.push({kind: 'sExpression', body: left, loc});
        ex.body = right;
        break;
      }
      case ';': {
        ex.body = [{kind: 'command', value: 'do', loc}, {kind: 'sExpression', body: left, loc}, {kind: 'sExpression', body: right, loc} ];
        break;
      }
    }
  }
};

export const dotAccess: Visitor = {
  sExpression(ex) {
    const first = ex.body[0];

    if (first.kind === 'command' && first.value.startsWith('.')) {
      // (.field $obj)
      // ($get $obj 'field')

      // (.field $obj 'value')
      // ($set $obj 'field' 'value')
      const name = first.value.substring(1);

      assertLengthRange('. access', 2, 3, ex.loc, ex.body);
      const obj = ex.body[1];
      const fields: ValueExpression[] = name.split('.').map(it => ({kind: 'value', value: it, loc: first.loc, quoted: true }));

      if (ex.body.length === 2) {
        ex.body = [
          {kind: 'variable', name: 'get', loc: ex.loc},
          obj,
          ...fields
        ];
      } else {
        ex.body = [
          {kind: 'variable', name: 'set', loc: ex.loc},
          obj,
          ...fields,
          ex.body[2]
        ];
      }
    }
  },
  command(ex) {
    if (ex.value.includes('.')) {
      // (Array.map)
      // ($get $Array map)
      const parts = ex.value.split('.');
      const head = parts.shift();

      assertNotEmptyString(ex.loc, head);
      parts.forEach(it => assertNotEmptyString(ex.loc, it));

      const body: Expression[] = [
        {kind: 'variable', name: 'get', loc: ex.loc},
        {kind: 'variable', name: head, loc: ex.loc},
        ...parts.map(it => (<ValueExpression> {kind: 'value', value: it, loc: ex.loc, quoted: true }))
      ];

      // sometimes Javascript is amazing, allowing us to totally mutate one expression into another.
      const mutate = ex as any as SExpression;
      mutate.kind = 'sExpression';
      mutate.body = body;
    }
  }
};

function flattenDoFunc(ex: SExpression) {
  const first = ex.body[0];

  if (first != null && first.kind === 'command' && first.value === 'do') {
    // check body for sub commands and flatten them.

    const flattenedBody = ex.body.slice(1).flatMap(next => {
      if (next.kind === 'sExpression') {
        flattenDoFunc(next);
        const nextCommand = next.body[0];

        if (nextCommand != null && nextCommand.kind === 'command' && nextCommand.value === 'do') {
          return next.body.slice(1);
        }
      }

      return [next];
    });

    flattenedBody.unshift(first);
    ex.body = flattenedBody;
  }
}

export const flattenDo: Visitor = {
  sExpression: flattenDoFunc
};

export const standardVisitors = [pipe, makeCommand, dotAccess, flattenDo];

export function optimize(ex: Expression, visitors: Visitor[] = standardVisitors) {
  visitors.forEach(visitor => walk(visitor, ex));
}
