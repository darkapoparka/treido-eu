/** Compare the complete isolated schema to the production runner. Historical
 * 0047/0049/0050 fault packets keep their explicit migration limits. */
export function currentMigrationFiles(names, runner, minimum = 57) {
  const files = names.filter(name => /^\d{4}_[a-z_]+\.sql$/.test(name)).sort();
  if (files.length < minimum || files.some((file, index) => Number(file.slice(0, 4)) !== index + 1))
    throw new Error("Current canonical schema is incomplete or not contiguous");
  const literal = runner.match(/for\s*\(const version of\s*(\[[\s\S]*?\])\s*\)/)?.[1];
  if (!literal || literal.slice(1, -1).replace(/"\d{4}_[a-z_]+"/g, "").replace(/[\s,]/g, "") !== "")
    throw new Error("Canonical migration runner sequence is not literal");
  const canonical = [...literal.matchAll(/"(\d{4}_[a-z_]+)"/g)].map(match => match[1] + ".sql");
  if (JSON.stringify(canonical) !== JSON.stringify(files))
    throw new Error("Current schema differs from canonical migration runner");
  return files;
}
