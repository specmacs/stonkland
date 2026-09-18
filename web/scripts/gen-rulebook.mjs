/**
 * Emits docs/rulebook.md from lib/rulebook.ts, so the page a player reads and the
 * document in the repository cannot drift apart.
 *
 *   node --experimental-strip-types scripts/gen-rulebook.mjs
 */
import {writeFileSync, mkdirSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {register} from "node:module";

register("./ts-resolve.mjs", import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const {RULEBOOK, RULEBOOK_INTRO} = await import(resolve(here, "../lib/rulebook.ts"));

const lines = ["# The Rulebook", "", RULEBOOK_INTRO, ""];

for (const section of RULEBOOK) {
  lines.push(`## ${section.heading}`, "");
  for (const block of section.blocks) {
    switch (block.kind) {
      case "p":
        lines.push(block.text, "");
        break;
      case "callout":
        lines.push(`> ${block.text}`, "");
        break;
      case "list":
        for (const item of block.items) lines.push(`- ${item}`);
        lines.push("");
        break;
      case "ol":
        block.items.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
        lines.push("");
        break;
      case "table": {
        lines.push(`| ${block.head.join(" | ")} |`);
        lines.push(`|${block.head.map(() => "---").join("|")}|`);
        for (const row of block.rows) lines.push(`| ${row.join(" | ")} |`);
        lines.push("");
        break;
      }
    }
  }
}

lines.push(
  "---",
  "",
  "_Generated from `web/lib/rulebook.ts`. Edit that file, then run `npm run gen:rulebook`._",
  "",
);

const out = resolve(here, "../../docs/rulebook.md");
mkdirSync(dirname(out), {recursive: true});
writeFileSync(out, lines.join("\n"));
console.log(`wrote ${out}`);
