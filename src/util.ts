
export function partition<Item>(arr: Item[], test: (item: Item) => boolean): [Item[], Item[]] {
  const left: Item[] = [];
  const right: Item[] = [];

  for (const next of arr) {
    if (test(next)) {
      left.push(next);
    } else {
      right.push(next);
    }
  }

  return [left, right];
}

