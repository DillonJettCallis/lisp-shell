import { ArrayExpression, Expression, Location, MapExpression, SExpression, Token } from "./ast";

class Parser {

  index = 0;
  max: number;

  constructor(private src: Array<Token>) {
    this.max = src.length - 1;
  }

  parseAll(): Expression {
    const body: Expression[] = [];

    while (this.index <= this.max) {
      body.push(this.parseExpression());
    }

    if (body.length === 1) {
      const first = body[0];

      // if you have only one unquoted string, it's clearly a command so wrap that sucker in an sExpression.
      if (!(first.kind === 'value' && !first.quoted && typeof first.value === 'string')) {
        return first;
      }
    }

    const loc = body[0]?.loc;

    return { kind: 'sExpression', body, loc };
  }

  parseExpression(): Expression {
    const next = this.next();

    if (next == null) {
      return this.end().fail('Unterminated SExpression');
    } else if (next.kind === 'symbol' && next.value === '(') {
      return this.parseSExpression(next.loc);
    } else if (next.kind === 'symbol' && next.value === '[') {
      return this.parseArrayExpression(next.loc);
    } else if (next.kind === 'symbol' && next.value === '{') {
      return this.parseMapExpression(next.loc);
    } else if (next.kind === 'string') {
      return { kind: "value", value: next.value, quoted: next.quoted, loc: next.loc };
    } else if (next.kind === 'number') {
      return { kind: "value", value: next.value, quoted: false, loc: next.loc };
    } else if (next.kind === 'variable') {
      return {kind: 'variable', name: next.value, loc: next.loc};
    } else if (next.kind === 'literal') {
      return {kind: 'value', value: next.value, quoted: false, loc: next.loc};
    } else {
      return next.loc.fail('Unknown token type');
    }
  }

  parseSExpression(loc: Location): SExpression {
    const body = this.parseBraceExpression(')');

    if (body.length === 0) {
      loc.fail('Empty s expression');
    }

    return {kind: 'sExpression', body, loc};
  }

  parseArrayExpression(loc: Location): ArrayExpression {
    const body = this.parseBraceExpression(']');

    return {kind: 'arrayExpression', body, loc};
  }

  parseMapExpression(loc: Location): MapExpression {
    const body = this.parseBraceExpression('}');

    if (body.length % 2 === 1) {
      loc.fail('Map literal must have an even number of values to form key -> value pairs!')
    }

    return {kind: 'mapExpression', body, loc};
  }

  parseBraceExpression(closeBrace: string): Expression[] {
    const body: Expression[] = [];

    while (true) {
      const next = this.peek();

      if (next == null) {
        this.end().fail('Unexpected end of file');
      } else if (next.kind === 'symbol' && next.value === closeBrace) {
        this.next();
        return body;
      } else {
        body.push(this.parseExpression());
      }
    }
  }

  peek(): Token {
    return this.src[this.index];
  }

  next(): Token | null {
    return this.src[this.index++];
  }

  end(): Location {
    return this.src[this.max].loc;
  }

}


export function parse(src: Array<Token>): Expression {
  const parser = new Parser(src);
  return parser.parseAll();
}
