import { Location, NumberToken, Token } from './ast';

const digits = '0123456789';
const whitespace = ' \t\r\n,';
const symbols = '()[]{}';
const quotes = '\'"`';

const escapeMap: { [key: string]: string } = {
  t: '\t',
  r: '\r',
  n: '\n',
};

const literals = new Map(Object.entries({
  'null': null,
  'true': true,
  'false': false
}));

class Lexer {

  tokens: Array<Token> = [];
  index = 0;
  line = 1;
  col = 0;
  max: number;

  constructor(private src: string) {
    this.max = src.length - 1;
  }

  lex() {
    while(this.index <= this.max) {
      const next = this.lexToken();
      if (next == null) {
        return;
      } else if (next instanceof Array) {
        this.tokens.push(...next);
      } else {
        this.tokens.push(next);
      }
    }
  }

  lexToken(): Token | Array<Token> | null {
    const next = this.skipWhitespace();

    const loc = this.location();

    if (next == null) {
      return null;
    } else if (symbols.includes(next)) {
      return {kind: 'symbol', value: next, loc};
    } else if (digits.includes(next)) {
      return this.lexNumber(next, loc);
    } else if (next === '$') {
      const value = this.lexWord('');
      return {kind: 'variable', value, loc };
    } else if (quotes.includes(next)) {
      return this.lexString(next, loc);
    } else {
      const value = this.lexWord(next);

      if (literals.has(value)) {
        return {kind: 'literal', value: literals.get(value), loc};
      } else {
        return {kind: "string", value, quoted: false, loc};
      }
    }
  }

  lexString(quote: string, loc: Location): Token[] {
    const stringBits: Array<Token> = [];
    let workingBit = '';
    let workingLoc = loc;

    while (true) {
      const next = this.next();

      if (next == null) {
        // unterminated string

        loc.fail('Unclosed string')
      } else if (next === quote) {
        // close quote of string

        if (stringBits.length === 0) {
          return [{ kind: 'string', value: workingBit, quoted: true, loc }];
        } else {
          return [
            { kind: 'symbol', value: '(', loc},
            { kind: "variable", value: '+', loc },
            ...stringBits,
            { kind: 'symbol', value: ')', loc: this.location() }
          ];
        }
      } if (next === '\\') {
        // whatever you are escaping, keep it as is

        const escaped = this.next();

        if (escaped == null) {
          // you can't have a \ at the end of the file

          loc.fail('Unclosed string')
        } else if (escaped in escapeMap) {
          // if you're trying to escape a whitespace char or something

          workingBit += escapeMap[escaped];
        } else {
          // just let it through, don't check anything else

          workingBit += escaped;
        }
      } else if (next === '$' && quote !== '`') {
        // unless this is a raw string (with ` ` quotes) then interpolate values inside this string

        if (workingBit.length > 0) {
          stringBits.push({ kind: "string", value: workingBit, quoted: true, loc: workingLoc });
          workingBit = '';
        }

        const maybeBrace = this.peek();

        if (maybeBrace == null) {
          loc.fail('Unclosed string')
        }

        if (maybeBrace === '(') {
          let depth = 0;

          while (true) {
            const nextToken = this.lexToken();

            if (nextToken == null) {
              loc.fail('Unclosed string');
            } else if (nextToken instanceof Array) {
              stringBits.push(...nextToken);
            } else {
              stringBits.push(nextToken);

              if (nextToken.kind === 'symbol' && nextToken.value === '(') {
                ++depth;
              } else if (nextToken.kind === 'symbol' && nextToken.value === ')') {
                if (--depth === 0) {
                  break;
                }
              }
            }
          }
        } else {
          const wordLoc = this.location();
          const word = this.lexWord('');

          if (word?.length === 0) {
            workingBit = '$';
          } else {
            stringBits.push({ kind: "variable", value: word, loc: wordLoc });
          }
        }

        workingLoc = this.location();
      } else {
        // just a normal part of string, nothing weird here
        workingBit += next;
      }
    }
  }

  lexWord(raw: string): string {
    while (true) {
      const next = this.peek();

      if (next == null || whitespace.includes(next) || symbols.includes(next)) {
        return raw;
      } else {
        this.next();
        raw += next;
      }
    }
  }

  lexNumber(raw: string, loc: Location): NumberToken {
    while (true) {
      const next = this.peek();

      if (next == null || whitespace.includes(next) || symbols.includes(next)) {
        const value = Number.parseFloat(raw);

        if (Number.isNaN(value)) {
          loc.fail('Invalid number');
        }

        return {kind: "number", value, loc};
      } else if (next === '.' || digits.includes(next)) {
        this.next();
        raw += next;
      } else {
        this.location().fail(`Expected number but found $next`);
      }
    }
  }

  location(): Location {
    return new Location(this.line, this.col);
  }

  skipWhitespace(): string | null {
    while (true) {
      const result = this.next();

      if (result == null) {
        return null;
      }

      if (!whitespace.includes(result)) {
        return result;
      }
    }
  }

  peek(): string {
    return this.src[this.index];
  }

  next(): string | null {
    if (this.index <= this.max) {
      const result = this.src[this.index++];

      this.col++;

      if (result === '\n') {
        this.line++;
        this.col = 0;
      }

      return result;
    } else {
      return null;
    }
  }

}

export function lex(src: string): Array<Token> {
  const lexer = new Lexer(src);
  lexer.lex();
  return lexer.tokens;
}