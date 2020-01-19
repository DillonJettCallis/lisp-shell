import { lex } from "./lexer";
import { parse } from "./parser";
import { Context } from "./context";
import { Shell } from "./shell";
import { initCoreLib, initModuleLib } from "./lib";
import { interpret } from "./interpreter";
import { pipe } from "./optimize";
import { Location, SExpression, walk } from "./ast";
import { inspect } from 'util';

function main() {
  const coreLib = initCoreLib('C:\\Users\\Dillon\\Projects\\Scriptly');

  const context = new Context(coreLib, new Shell());

  context.repl();
}


main();
