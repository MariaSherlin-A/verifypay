/**
 * Copies the ABI (and only the ABI) of each deployed VerifyPay contract from the Foundry
 * artifact into src/abis/<Name>.json, so the frontend never depends on contracts/out/ at build time.
 * Run after `forge build`:  bun run abis:sync
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const NAMES = ['PayeeRegistry', 'SafeSend', 'AgentWallet'] as const;

interface Artifact {
  abi?: unknown;
}

await mkdir('src/abis', { recursive: true });
for (const name of NAMES) {
  const raw = await readFile(`contracts/out/${name}.sol/${name}.json`, 'utf8');
  const artifact = JSON.parse(raw) as Artifact;
  if (!Array.isArray(artifact.abi)) throw new Error(`${name}: artifact has no abi array (run forge build)`);
  await writeFile(`src/abis/${name}.json`, `${JSON.stringify(artifact.abi, null, 2)}\n`);
  console.log(`${name}: ${artifact.abi.length} ABI entries -> src/abis/${name}.json`);
}
