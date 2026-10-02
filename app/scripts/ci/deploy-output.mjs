import { log } from "node:console";
import process from "node:process";
import { URL, fileURLToPath } from "node:url";
import { auditProductionOutput } from "./production-output.mjs";

const workspace = fileURLToPath(new URL("../../", import.meta.url));
const output = fileURLToPath(new URL("../../apps/web/.next/", import.meta.url));
const result = await auditProductionOutput(output, workspace);
log(JSON.stringify(result, null, 2));
if (result.issues.length) process.exitCode = 1;
