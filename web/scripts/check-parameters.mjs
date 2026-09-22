/**
 * Fails if any parameter the interface states has drifted from the contract it mirrors.
 *
 * The interface shows two kinds of number: readings, which come from a live call and are
 * withheld when the call fails, and parameters, which are compiled into the contracts and
 * written out in copy. Readings cannot go stale. Parameters can -- silently, by somebody
 * editing a constant in Solidity -- and a page confidently describing a system that no
 * longer exists is worse than one that says nothing. This is what stops that.
 *
 * Deliberately parses the Solidity source rather than an ABI or a deployment: the claim
 * being checked is "the copy matches the code in this repo", and a build artefact could
 * be stale in exactly the way this exists to catch.
 */
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname, join} from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const contracts = join(here, "..", "..", "contracts", "src");
const web = join(here, "..", "lib");

const read = (p) => readFileSync(p, "utf8");

/** Pull `<name> = <number>` out of Solidity, tolerating underscores and an e18 suffix. */
function solConst(file, name) {
  const src = read(join(contracts, file));
  const m = new RegExp(`constant\\s+${name}\\s*=\\s*([0-9_]+)(e18)?`).exec(src);
  if (!m) throw new Error(`${name} not found in ${file}`);
  return Number(m[1].replace(/_/g, ""));
}

/** Pull a `if (level == n) return v;` table out of a Solidity pure function. */
function solTable(file, fn) {
  const src = read(join(contracts, file));
  const body = new RegExp(`function ${fn}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n    \\}`).exec(src);
  if (!body) throw new Error(`${fn} not found in ${file}`);
  const out = {};
  for (const m of body[1].matchAll(/level == (\d+)\) return ([0-9_]+)(e18)?/g)) {
    out[Number(m[1])] = Number(m[2].replace(/_/g, ""));
  }
  return out;
}

/** Pull a numeric literal out of the TypeScript config. */
function tsNumber(file, key) {
  const src = read(join(web, file));
  const m = new RegExp(`${key}:\\s*([0-9_]+)`).exec(src);
  if (!m) throw new Error(`${key} not found in ${file}`);
  return Number(m[1].replace(/_/g, ""));
}

const failures = [];
const check = (what, expected, actual) => {
  if (expected !== actual) failures.push(`${what}: contracts say ${expected}, copy says ${actual}`);
};

// --- Supply and caps -------------------------------------------------------------
check("Token.MAX_SUPPLY", solConst("Token.sol", "MAX_SUPPLY"), tsNumber("brand.ts", "tokenMaxSupply"));
const quarterCap = solConst("PropertyNFT.sol", "QUARTER_CAP");
const quarterCount = solConst("PropertyNFT.sol", "QUARTER_COUNT");
check("PropertyNFT.QUARTER_CAP", quarterCap, tsNumber("brand.ts", "quarterCap"));
check("PropertyNFT.QUARTER_COUNT", quarterCount, tsNumber("brand.ts", "quarterCount"));
check("PropertyNFT.MAX_SUPPLY", quarterCap * quarterCount, tsNumber("brand.ts", "cardSupply"));

// --- Minting ---------------------------------------------------------------------
check("Minter.MINTS_PER_WALLET", solConst("Minter.sol", "MINTS_PER_WALLET"), tsNumber("brand.ts", "mintsPerWallet"));
check("Minter.MINT_BURN", solConst("Minter.sol", "MINT_BURN"), tsNumber("brand.ts", "mintBurn"));

// --- The level schedule ----------------------------------------------------------
const lib = "libraries/ProgressionLib.sol";
const baseWeight = solTable(lib, "baseWeight");
const burnToReach = solTable(lib, "burnToReach");
const multiplierBps = tsNumber("brand.ts", "weightMultiplier") === 1 ? 10_000 : null;

const levels = [...read(join(web, "brand.ts")).matchAll(
  /\{level: (\d+), form: "([^"]+)", weight: (\d+), burnToReach: ([0-9_]+), cumulativeBurn: ([0-9_]+)\}/g,
)].map((m) => ({
  level: Number(m[1]),
  form: m[2],
  weight: Number(m[3]),
  burnToReach: Number(m[4].replace(/_/g, "")),
  cumulative: Number(m[5].replace(/_/g, "")),
}));

if (levels.length !== solConst(lib, "MAX_LEVEL")) {
  failures.push(`level count: contracts say ${solConst(lib, "MAX_LEVEL")}, copy lists ${levels.length}`);
}

// The founding edition's multiplier, as the deployer sets it.
const MULTIPLIER_BPS = 12_500;
let running = 0;
for (const l of levels) {
  const expectedWeight = Math.floor((baseWeight[l.level] * MULTIPLIER_BPS) / 10_000);
  check(`level ${l.level} weight`, expectedWeight, l.weight);

  const expectedBurn =
    l.level === 1 ? solConst("Minter.sol", "MINT_BURN") : burnToReach[l.level];
  check(`level ${l.level} burn`, expectedBurn, l.burnToReach);

  running += expectedBurn;
  check(`level ${l.level} cumulative burn`, running, l.cumulative);
}

// --- Form names have to match, or the interface renames the game ------------------
const solNames = {};
{
  const src = read(join(contracts, lib));
  for (const m of src.matchAll(/level == (\d+)\) return "([A-Za-z]+)"/g)) {
    solNames[Number(m[1])] = m[2];
  }
}
for (const l of levels) {
  if (solNames[l.level] !== l.form) {
    failures.push(`level ${l.level} name: contracts say ${solNames[l.level]}, copy says ${l.form}`);
  }
}

// --- Report ----------------------------------------------------------------------
if (failures.length) {
  console.error("Parameters in the interface no longer match the contracts:\n");
  for (const f of failures) console.error(`  - ${f}`);
  console.error("\nFix the copy, or the contract, so they agree.");
  process.exit(1);
}
console.log(`Parameters match the contracts (${levels.length} levels, ${quarterCount} quarters checked).`);
