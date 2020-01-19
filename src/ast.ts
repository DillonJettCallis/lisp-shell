

export class Location {
  constructor(public line: number, public col: number) {
  }

  fail(message: string): never {
    throw new Error(`${message} at ${this.line}:${this.col}`)
  }
}

interface BaseToken {
  loc: Location;
}


export interface StringToken extends BaseToken {
  kind: 'string';
  quoted: boolean;
  value: string;
}

export interface VariableToken extends BaseToken {
  kind: 'variable';
  value: string;
}

export interface NumberToken extends BaseToken {
  kind: 'number';
  value: number;
}

export interface LiteralToken extends BaseToken {
  kind: 'literal';
  value: any;
}

export interface SymbolToken extends BaseToken {
  kind: 'symbol';
  value: string;
}

export type Token = StringToken | VariableToken | NumberToken | LiteralToken | SymbolToken;

interface BaseExpression {
  loc: Location;
}

export interface SExpression extends BaseExpression {
  kind: 'sExpression';
  body: Expression[];
}

export interface ArrayExpression extends BaseExpression {
  kind: 'arrayExpression';
  body: Expression[];
}

export interface MapExpression extends BaseExpression {
  kind: 'mapExpression';
  body: Expression[];
}

export interface ValueExpression extends BaseExpression {
  kind: 'value';
  quoted: boolean;
  value: any;
}

export interface CommandExpression extends BaseExpression {
  kind: 'command';
  value: string;
}

export interface VariableExpression extends BaseExpression {
  kind: 'variable';
  name: string;
}

export type Expression = SExpression | ArrayExpression | MapExpression | ValueExpression | CommandExpression | VariableExpression

export interface Visitor {
  sExpression?: (ex: SExpression) => void;
  arrayExpression?: (ex: ArrayExpression) => void;
  mapExpression?: (ex: MapExpression) => void;
  value?: (ex: ValueExpression) => void;
  command?: (ex: CommandExpression) => void;
  variable?: (ex: VariableExpression) => void;
}

export function walk(visitor: Visitor, ex: Expression) {
  visitor[ex.kind]?.(ex as any);

  switch (ex.kind) {
    case 'sExpression':
    case "mapExpression":
    case "arrayExpression":
      ex.body.forEach(it => walk(visitor, it));
  }
}

