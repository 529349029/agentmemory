#!/usr/bin/env node
/**
 * migrate-lessons-to-slots.js
 *
 * 将 lessons 数据迁移到 pinned slots。
 *
 * 迁移原因：
 *   context.ts 按 recency 排序，lessons block 的 recency 是"最旧 lesson 的日期"，
 *   排在 session summaries 后面。而 pinned slots 的 recency = Date.now()，
 *   永远排在最前面。
 *   迁移后 lessons 内容通过 pinned slots 注入，确保 lessons 不会被 session summaries 挤出预算。
 *
 * 做法：
 *   1. 读取所有活跃 lessons（非 deleted）
 *   2. 按 project 分组（global lessons 放一起）
 *   3. 写入"lessons" slot（创建或更新），pinned=true
 *   4. 写入后 lessons 数据会通过 pinned slots 注入 context
 *
 * 注意：
 *   - 迁移后 lessons 仍可通过 amc.js lessons list 查看
 *   - 脚本只复制，不删除原 lessons
 *
 * Usage:
 *   node migrate-lessons-to-slots.js
 *   DRY_RUN=true node migrate-lessons-to-slots.js   # 只预览，不写入
 */

import { spawnSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "dist", "iii-config.yaml");

// ─── iii CLI helpers ─────────────────────────────────────────────

function runIiiTrigger(functionId, payload) {
  const result = spawnSync(
    "iii",
    [
      "trigger",
      "--function-id",
      functionId,
      "--payload",
      JSON.stringify(payload),
      "--config",
      CONFIG_PATH,
    ],
    { encoding: "utf-8", stdio: "pipe" },
  );
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0)
    throw new Error(`iii command failed: ${result.stderr}`);
  return result.stdout.trim();
}

function runStateGet(scope, key) {
  const r = runIiiTrigger("state::get", { scope, key });
  return r ? JSON.parse(r) : null;
}

function runStateSet(scope, key, value) {
  runIiiTrigger("state::set", { scope, key, value });
}

function runStateList(scope) {
  return JSON.parse(runIiiTrigger("state::list", { scope }));
}

function runStateDelete(scope, key) {
  runIiiTrigger("state::delete", { scope, key });
}

// ─── Main ────────────────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN === "true";

function main() {
  // 1. 读所有 lessons
  const all = runStateList("mem:lessons");
  const active = all.filter((l) => !l.deleted);
  console.log(`Total lessons: ${all.length}`);
  console.log(`Active lessons: ${active.length}\n`);

  if (active.length === 0) {
    console.log("No active lessons to migrate.");
    return;
  }

  // 2. 按 project 分组（global lessons 放一个组）
  const groups = new Map(); // project → lessons[]
  for (const l of active) {
    const projectKey = l.project || "__global__";
    if (!groups.has(projectKey)) groups.set(projectKey, []);
    groups.get(projectKey).push(l);
  }

  console.log("Groups:");
  for (const [project, lessons] of groups) {
    console.log(`  [${project}] ${lessons.length} lessons`);
    for (const l of lessons) {
      console.log(
        `    - conf=${l.confidence} tags=${(l.tags || []).join(",")} ${l.content.slice(0, 80)}`,
      );
    }
  }
  console.log("");

  // 3. 排序：按 confidence 降序排列（高置信度的放前面）
  for (const [, lessons] of groups) {
    lessons.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  }

  // 4. 构建每个 slot 的内容
  for (const [project, lessons] of groups) {
    const slotLabel = project === "__global__" ? "lessons" : `lessons_${project}`;
    const scope = project === "__global__" ? "global" : "project";
    const scopeKey = scope === "global" ? "mem:slots:global" : "mem:slots";

    // 按置信度分段
    const highConf = lessons.filter((l) => (l.confidence || 0) >= 0.7);
    const medConf = lessons.filter(
      (l) => (l.confidence || 0) >= 0.4 && (l.confidence || 0) < 0.7,
    );
    const lowConf = lessons.filter((l) => (l.confidence || 0) < 0.4);

    const lines = [
      `# Lessons${project !== "__global__" ? ` (${project})` : ""}\n`,
    ];

    if (highConf.length > 0) {
      lines.push("## High confidence");
      for (const l of highConf) lines.push(`- ${l.content}`);
      lines.push("");
    }
    if (medConf.length > 0) {
      lines.push("## Medium confidence");
      for (const l of medConf) lines.push(`- ${l.content}`);
      lines.push("");
    }
    if (lowConf.length > 0) {
      lines.push("## Low confidence");
      for (const l of lowConf) lines.push(`- ${l.content}`);
      lines.push("");
    }

    const content = lines.join("\n").trim();
    const sizeLimit = Math.max(content.length + 500, 3000);

    // 检查已有 slot
    const existingSlot = runStateGet(scopeKey, slotLabel);
    console.log(`[${project}] Slot "${slotLabel}" (${scope}):`);
    console.log(`  Content size: ${content.length} chars`);
    console.log(`  Will set sizeLimit: ${sizeLimit}`);

    if (existingSlot) {
      console.log(
        `  Existing slot content length: ${existingSlot.content.length}`,
      );
      if (existingSlot.content === content) {
        console.log(`  ⚠️  Slot content unchanged, skipping.`);
        continue;
      }
    }

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would write to ${scopeKey}/${slotLabel}`);
    } else {
      const slot = {
        label: slotLabel,
        content,
        sizeLimit: sizeLimit,
        description:
          "Lessons learned, auto-migrated from agentmemory lessons store.",
        pinned: true,
        readOnly: false,
        scope,
        createdAt: existingSlot?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      runStateSet(scopeKey, slotLabel, slot);
      console.log(`  ✅ Written (${content.length} chars)`);
    }
  }

  console.log("\nDone.");
  if (DRY_RUN) {
    console.log("Run without DRY_RUN=true to actually write.");
  }
  console.log(
    "\nNote: lessons data still exists in KV. If you want to reduce context injection,",
  );
  console.log(
    "consider lowering LESSONS_CAP or stopping lessons injection via config.",
  );
}

try {
  main();
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
}
