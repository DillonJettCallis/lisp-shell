import { Context } from "./context";
import { Shell } from "./shell";
import { initCoreLib } from "./lib";

function main() {
  const coreLib = initCoreLib(process.cwd());

  const context = new Context(coreLib, new Shell());

  context.repl();
}


main();
