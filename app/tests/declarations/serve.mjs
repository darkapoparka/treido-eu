import console from "node:console";
import process from "node:process";
import { startDeclarationFixture } from "./fixture-server.mjs";
const unknown = process.argv
  .slice(2)
  .filter((argument) => !/^--port=\d+$/.test(argument));
if (unknown.length)
  throw Error("Only --port=<free loopback port> is supported.");
const argument = process.argv.find((value) => value.startsWith("--port="));
const server = await startDeclarationFixture({
  port: argument ? Number(argument.slice(7)) : 0,
});
console.log(
  JSON.stringify(
    {
      ...server.metadata,
      scope:
        "Actual production component/CSS; synthetic source model, auth and action transport. No real operator evidence.",
    },
    null,
    2,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, async () => {
    await server.close();
    process.exit(0);
  });
