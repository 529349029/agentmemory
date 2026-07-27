#!/usr/bin/env node
/**
 * reset-lesson-confidence.js
 *
 * 将所有 lessons 的 confidence 设为 0.1。
 * 用 `state::get` 读 + `state::set` 写，通过 iii engine 操作。
 *
 * Usage:
 *   node reset-lesson-confidence.js
 *   DRY_RUN=true node reset-lesson-confidence.js   # 只预览不写入
 */

import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "dist", "iii-config.yaml");
const ENGINE_PORT = parseInt(process.env.III_ENGINE_PORT || "49134", 10);
const DRY_RUN = process.env.DRY_RUN === "true";

function runIii(functionId, payload) {
  const result = spawnSync(
    "iii",
    [
      "trigger",
      "--function-id", functionId,
      "--payload", JSON.stringify(payload),
      "--port", String(ENGINE_PORT),
      "--config", CONFIG_PATH,
    ],
    { encoding: "utf-8", stdio: "pipe", timeout: 15000 },
  );
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) throw new Error(`iii failed: ${result.stderr}`);
  return JSON.parse(result.stdout.trim());
}

function main() {
  const lessons = runIii("state::list", { scope: "mem:lessons" });
  const active = lessons.filter((l) => !l.deleted);
  console.log(`Total lessons: ${lessons.length}`);
  console.log(`Active lessons: ${active.length}\n`);

  let updated = 0;
  for (const lesson of active) {
    const oldConf = lesson.confidence;
    if (oldConf === 0.1) {
      console.log(`  = ${lesson.id.slice(0, 20)}... conf already 0.1, skip`);
      continue;
    }
    lesson.confidence = 0.1;
    lesson.updatedAt = new Date().toISOString();

    console.log(
      `  → ${lesson.id.slice(0, 20)}... conf ${oldConf} → 0.1  "${lesson.content.slice(0, 50)}..."`,
    );

    if (!DRY_RUN) {
      runIii("state::set", {
        scope: "mem:lessons",
        key: lesson.id,
        value: lesson,
      });
    }
    updated++;
  }

  console.log(`\nDone. ${updated} lessons ${DRY_RUN ? "would be" : ""} updated.`);
  if (DRY_RUN) console.log("Run without DRY_RUN=true to actually write.");
}

try {
  main();
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
