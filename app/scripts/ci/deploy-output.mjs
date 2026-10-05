import { log } from "node:console";
import process from "node:process";
import { URL, fileURLToPath } from "node:url";
import { auditProductionOutput } from "./production-output.mjs";
import { auditDependencyOutput } from "./dependency-output.mjs";

const workspace = fileURLToPath(new URL("../../", import.meta.url));
const output = fileURLToPath(new URL("../../apps/web/.next/", import.meta.url));
const result = await auditProductionOutput(output, workspace);
log(JSON.stringify(result, null, 2));
if (result.issues.length) process.exitCode = 1;
if (!result.issues.length) {
  const dependencyOutput = await auditDependencyOutput(output);
  log(
    JSON.stringify(
      {
        nodeVersion: process.version,
        platform: process.platform,
        dependencyOutput,
      },
      null,
      2,
    ),
  );
  if (!dependencyOutput.tracesChecked || dependencyOutput.findings.length)
    process.exitCode = 1;
}
