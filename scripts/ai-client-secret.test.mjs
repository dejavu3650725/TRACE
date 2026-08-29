import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  }))).flat();
}

const sourceFiles = (await filesUnder("src")).filter((file) => /\.(?:ts|tsx|js|jsx)$/.test(file));
for (const file of sourceFiles) {
  const content = await readFile(file, "utf8");
  assert.equal(/NEXT_PUBLIC_(?:GEMINI|UPSTAGE|AI_PROVIDER|AI_API_KEY)/.test(content), false, `${file} exposes AI configuration publicly`);
  if (/^[\s\n]*["']use client["'];?/m.test(content)) {
    assert.equal(/(?:@\/lib\/ai|lib\/ai\/)/.test(content), false, `${file} imports the server-only AI boundary`);
  }
}

const clientBundleFiles = await filesUnder(".next/static");
const configuredSecrets = [process.env.GEMINI_API_KEY, process.env.UPSTAGE_API_KEY].filter(Boolean);
for (const configuredSecret of configuredSecrets) {
  for (const file of clientBundleFiles) {
    const content = await readFile(file);
    assert.equal(content.includes(Buffer.from(configuredSecret)), false, `${file} contains the configured Provider secret`);
  }
}

console.log(JSON.stringify({
  sourceFilesChecked: sourceFiles.length,
  clientBundleFilesChecked: clientBundleFiles.length,
  configuredSecretsChecked: configuredSecrets.length,
}, null, 2));
