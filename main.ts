/**
 * Token Radar v3 Entrypoint (Node 22 / TypeScript ESM)
 * Authoritative runner for snapshot parsing, model execution, gate validation,
 * dossier packaging, and asset deployment.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

// Resolve base directory for local asset bundles (dashboard and screenshots)
const WORK_DIR = fileURLToPath(new URL('.', import.meta.url));

// Configuration limits for dossier payload inspection
const TEXT_BYTE_LIMIT = 65_536;
const SCREENSHOT_CONFIG = { max: 4, max_bytes: 524_288 };
const VALID_IMAGE_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/**
 * Helper to retrieve command-line argument values supporting both `--flag value` and `--flag=value`.
 */
function fetchArgument(flagName: string, defaultValue: string): string {
  const argIndex = process.argv.indexOf(`--${flagName}`);
  if (argIndex >= 0 && argIndex + 1 < process.argv.length) {
    return process.argv[argIndex + 1]!;
  }
  const prefixMatch = process.argv.find((arg) => arg.startsWith(`--${flagName}=`));
  return prefixMatch === undefined ? defaultValue : prefixMatch.slice(flagName.length + 3);
}

// Determine input source path
const configuredInput = fetchArgument('input', '/input');
const targetInputPath = configuredInput.endsWith('.json') ? configuredInput : join(configuredInput, 'snapshot.json');

if (!existsSync(targetInputPath)) {
  process.stderr.write(`token radar error: snapshot not found at ${targetInputPath}. Provide valid --input path.\n`);
  process.exit(2);
}

// Determine output target directory
const targetOutput = fetchArgument('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// Parse snapshot data and execute radar model
const rawInputContent = readFileSync(targetInputPath, 'utf8');
const parsedSnapshot = parseSnapshot(rawInputContent);
const { board: scoredRows, radar: radarPayload } = buildRadar(parsedSnapshot);

// Validate model output against gate criteria
const modelGateError = boardIssue(scoredRows, parsedSnapshot);
if (modelGateError !== null) {
  process.stderr.write(`token radar error: model board rejected by gate: ${modelGateError}\n`);
  process.exit(1);
}

// Ensure output directory exists and persist core artifacts
mkdirSync(targetOutput, { recursive: true });
writeFileSync(join(targetOutput, 'board.json'), `${JSON.stringify({ rows: scoredRows })}\n`);
writeFileSync(join(targetOutput, 'data.js'), dataScript(radarPayload));

/**
 * Utility to copy supporting static files from source directory to destination.
 */
function mirrorStaticAssets(sourceDir: string, destDir: string): string[] {
  if (!existsSync(sourceDir)) return [];
  mkdirSync(destDir, { recursive: true });
  const transferred: string[] = [];
  for (const entryName of readdirSync(sourceDir)) {
    if (entryName.startsWith('.')) continue;
    const itemPath = join(sourceDir, entryName);
    if (!statSync(itemPath).isFile()) continue;
    copyFileSync(itemPath, join(destDir, entryName));
    transferred.push(entryName);
  }
  return transferred;
}

// Copy dashboard frontend assets
mirrorStaticAssets(join(WORK_DIR, 'dashboard'), join(targetOutput, 'dashboard'));

// Copy and validate screenshots
const capturedScreenshots = mirrorStaticAssets(join(WORK_DIR, 'screenshots'), join(targetOutput, 'screenshots'));
if (capturedScreenshots.length < 3) {
  process.stderr.write(`token radar error: found ${capturedScreenshots.length} screenshots, minimum required is 3\n`);
  process.exit(1);
}

for (const imgName of capturedScreenshots) {
  if (!VALID_IMAGE_PATTERN.test(imgName)) {
    process.stderr.write(`token radar error: invalid screenshot filename "${imgName}"\n`);
    process.exit(1);
  }
}

// Build and write dossier audit payload
const generatedDossierContent = buildDossier(targetOutput, {
  text_max_bytes: TEXT_BYTE_LIMIT,
  screenshots: SCREENSHOT_CONFIG,
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
});
const dossierFilePath = join(targetOutput, 'dossier.json');
writeFileSync(dossierFilePath, generatedDossierContent);

// Compute dossier size for summary reporting
const dossierStat = statSync(dossierFilePath);

// Report successful execution summary to stdout
process.stdout.write(
  `token radar: processed ${parsedSnapshot.protocols.length} protocols, ${parsedSnapshot.watchlist.length} watchlist, ${scoredRows.length} scored board rows.\n` +
    `token radar: successfully wrote board.json, data.js, dashboard, screenshots (${capturedScreenshots.length}), and dossier.json (${dossierStat.size} bytes) to ${targetOutput}\n`,
);
