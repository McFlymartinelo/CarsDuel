// Compare scoreMecaRaw * tireModifier (src/lib/game.ts) à private.compute_sp.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { connect } from "./helpers.mjs";

const src = fs.readFileSync(new URL("../../src/lib/game.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const file = path.join(os.tmpdir(), `carsduel-game-${process.pid}.mjs`);
fs.writeFileSync(file, js);
const game = await import(pathToFileURL(file).href);

const cases = [
  { power: 1, weight: 5000, shift: 0, gum: 0, bonus: -100 },
  { power: 100, weight: 130, shift: 100, gum: 69, bonus: 0 },
];
for (let i = 0; i < 28; i++) {
  cases.push({
    power: [10, 45, 100, 180, 400, 700][i % 6],
    weight: [50, 90, 130, 250, 400, 900][i % 6],
    shift: [0, 80, 200, 450, 800, 1200][(i * 2) % 6],
    gum: [0, 10, 40, 67, 69, 70, 100][i % 7],
    bonus: [-80, -15, 0, 5, 12, 25][(i * 3) % 6],
  });
}

test("scoreMecaRaw et tireModifier suivent private.compute_sp", async () => {
  const c = connect();
  await c.connect();
  try {
    for (const k of cases) {
      const { rows } = await c.query(
        "select private.compute_sp($1::numeric, $2::numeric, $3::numeric, $4::numeric, $5::numeric) as sp",
        [k.power, k.weight, k.shift, k.gum, k.bonus],
      );
      const jsScore = game.scoreMecaRaw(k.power, k.weight, k.shift) * game.tireModifier(k.bonus, k.gum);
      const pgScore = Number(rows[0].sp);
      assert.ok(Math.abs(pgScore - jsScore) < 1e-6, `${JSON.stringify(k)} pg=${pgScore} js=${jsScore}`);
    }
  } finally {
    await c.end();
    fs.rmSync(file, { force: true });
  }
});
