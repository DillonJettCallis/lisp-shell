import { initCoreLib } from "./lib";
import { Context } from "./context";
import { Shell } from "./shell";
import { Interpreter } from "./interpreter";


const coreLib = initCoreLib(process.cwd());

const context = new Context(coreLib, new Shell());
const interpreter = new Interpreter(context);

const result = interpreter.eval(`git log '--pretty=%H\t%an\t%aI\t%N' | Parse.table [hash, author, time] `, coreLib);

console.log(result);

