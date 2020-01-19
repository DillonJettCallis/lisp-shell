import { Expression, Visitor } from "./ast";

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


