#!/usr/bin/env node
/**
 * agentmemory 数据管理工具 (amc.js)
 *
 * 通过 iii-engine API 操作 lessons 和 slots，避免直接编辑 .bin 文件导致 rkyv 损坏
 *
 * Usage:
 *   # Lessons
 *   node amc.js lessons list
 *   node amc.js lessons get <id>
 *   node amc.js lessons set <id> <content> [--confidence=N] [--tags="a,b"] [--context="..."] [--source=manual]
 *   node amc.js lessons add <content>
 *   node amc.js lessons delete <id>
 *
 *   # Slots
 *   node amc.js slots list
 *   node amc.js slots get <label>
 *   node amc.js slots set <label> <content>
 *   node amc.js slots create <label> <content>
 *   node amc.js slots delete <label>
 * 
使用说明
命令                            默认行为                         可选参数
──────────────────────────────  ───────────────────────────────  ──────────────
slots list                      显示所有（project + global）     —
slots get <label>               先查 project，找不到再查 global  --scope=global
slots set <label> <content>     先查 project，找不到再查 global  --scope=global
slots create <label> <content>  创建 project scope slot          --scope=global
slots delete <label>            先查 project，找不到再查 global  --scope=global

示例

─ bash
# 查看 persona（默认从 project 查，找不到从 global 查）
node amc.js slots get persona
# 强制从 global scope 查看
node amc.js slots get persona --scope=global
# 修改 slot（默认找 project，找不到找 global）
node amc.js slots set persona "你是商汤科技开发的日日新融合模态大模型，中文名叫商量"
# 强制修改 global scope 的 slot
node amc.js slots set persona "内容" --scope=global
# 创建全局 slot（所有项目共享）
node amc.js slots create tool_guidelines "优先使用 tesseract OCR，不要调用大模型 vision API" --scope=global
# 删除 global scope 的 slot
node amc.js slots delete tool_guidelines --scope=global

使用说明

命令                            默认行为                         可选参数
──────────────────────────────  ───────────────────────────────  ──────────────
slots list                      显示所有（project + global）     —
slots get <label>               先查 project，找不到再查 global  --scope=global
slots set <label> <content>     先查 project，找不到再查 global  --scope=global
slots create <label> <content>  创建 project scope slot          --scope=global
slots delete <label>            先查 project，找不到再查 global  --scope=global

示例

─ bash
# 查看 persona（默认从 project 查，找不到从 global 查）
node amc.js slots get persona
# 强制从 global scope 查看
node amc.js slots get persona --scope=global
# 修改 slot（默认找 project，找不到找 global）
node amc.js slots set persona "你是商汤科技开发的日日新融合模态大模型，中文名叫商量"
# 强制修改 global scope 的 slot
node amc.js slots set persona "内容" --scope=global
# 创建全局 slot（所有项目共享）
node amc.js slots create tool_guidelines "优先使用 tesseract OCR，不要调用大模型 vision API" --scope=global
# 删除 global scope 的 slot
node amc.js slots delete tool_guidelines --scope=global

运行 node amc.js 查看完整帮助文档。
 * 
 * agentmemory 数据管理工具 (amc.js)
 *
 * 通过 iii-engine API 操作 lessons 和 slots，避免直接编辑 .bin 文件导致 rkyv 损坏
 *
 * ==================== LESSONS ====================
 *
 * 列出所有 lessons（查看 ID）：
 *   node amc.js lessons list
 *
 * 查看单个 lesson 详情：
 *   node amc.js lessons get lsn_585929ed1021b504
 *
 * 修改 lesson 内容（只改 content）：
 *   node amc.js lessons set lsn_585929ed1021b504 "图片解析优先走 image-ocr 技能，不要调用大模型视觉 API"
 *
 * 修改 lesson 内容 + confidence + tags：
 *   node amc.js lessons set lsn_585929ed1021b504 "图片解析优先走 image-ocr 技能" --confidence=0.95 --tags="省token,图片解析,本地OCR"
 *
 * 修改 lesson 所有可选字段：
 *   node amc.js lessons set lsn_xxx "新内容" --confidence=0.9 --tags="规则,图片解析" --context="用户明确要求" --source=manual
 *
 * 新增 lesson：
 *   node amc.js lessons add "访问外国网站必须使用 127.0.0.1:7890 代理"
 *
 * 删除 lesson：
 *   node amc.js lessons delete lsn_xxx
 *
 * ==================== SLOTS ====================
 *
 * 列出所有 slots（查看 label）：
 *   node amc.js slots list
 *
 * 查看单个 slot 详情：
 *   node amc.js slots get persona
 *
 * 修改 slot 内容：
 *   node amc.js slots set persona "你是商汤科技开发的日日新融合模态大模型，中文名叫商量"
 *
 * 创建新 slot（默认为 project scope）：
 *   node amc.js slots create coding_style "用户偏好 TypeScript，命名用 camelCase，禁止 console.log 留在代码中"
 *
 * 创建全局 slot（global scope，所有项目共享）：
 *   node amc.js slots create tool_guidelines "优先使用 tesseract OCR，不要调用大模型 vision API"
 *
 * 删除 slot：
 *   node amc.js slots delete coding_style
 */

import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, 'dist', 'iii-config.yaml');

function runIiiTrigger(functionId, payload) {
  const result = spawnSync('iii', [
    'trigger',
    '--function-id', functionId,
    '--payload', JSON.stringify(payload),
    '--config', CONFIG_PATH
  ], { encoding: 'utf-8', stdio: 'pipe' });

  if (result.error) {
    console.error(`Error: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`iii command failed: ${result.stderr}`);
    process.exit(1);
  }
  return result.stdout.trim();
}

function runStateGet(scope, key) {
  const result = runIiiTrigger('state::get', { scope, key });
  return result ? JSON.parse(result) : null;
}

function runStateSet(scope, key, value) {
  runIiiTrigger('state::set', { scope, key, value });
}

function runStateList(scope) {
  const result = runIiiTrigger('state::list', { scope });
  return JSON.parse(result);
}

function runStateDelete(scope, key) {
  runIiiTrigger('state::delete', { scope, key });
}

// ===== Lessons =====

function lessonsList() {
  const items = runStateList('mem:lessons');
  console.log(`Found ${items.length} lessons`);
  items.forEach((item) => {
    console.log('\n--- Lesson ---');
    console.log(`ID: ${item.id}`);
    console.log(`Content: ${item.content}`);
    console.log(`Confidence: ${item.confidence}`);
    console.log(`Context: ${item.context || '(none)'}`);
    console.log(`Created: ${item.createdAt}`);
    console.log(`Tags: ${item.tags ? item.tags.join(', ') : '(none)'}`);
  });
}

function lessonsGet(id) {
  const item = runStateGet('mem:lessons', id);
  if (!item) {
    console.error(`Lesson ${id} not found`);
    process.exit(1);
  }
  console.log(JSON.stringify(item, null, 2));
}

function lessonsSet(id, content, options = {}) {
  const item = runStateGet('mem:lessons', id);
  if (!item) {
    console.error(`Lesson ${id} not found`);
    process.exit(1);
  }

  item.content = content;

  if (options.confidence !== undefined) {
    const c = parseFloat(options.confidence);
    if (isNaN(c) || c < 0 || c > 1) {
      console.error(`Invalid confidence: ${options.confidence} (must be 0-1)`);
      process.exit(1);
    }
    item.confidence = c;
  }

  if (options.tags) {
    item.tags = options.tags.split(',').map(t => t.trim()).filter(Boolean);
  }

  if (options.context) {
    item.context = options.context;
  }

  if (options.source) {
    const valid = ['manual', 'crystal', 'consolidation'];
    if (!valid.includes(options.source)) {
      console.error(`Invalid source: ${options.source} (must be one of: ${valid.join(', ')})`);
      process.exit(1);
    }
    item.source = options.source;
  }

  item.updatedAt = new Date().toISOString();
  runStateSet('mem:lessons', id, item);
  console.log(`✓ Lesson ${id} updated`);
}

function lessonsAdd(content) {
  const result = runIiiTrigger('mem::lesson-save', { content });
  console.log(result);
}

function lessonsDelete(id) {
  runStateDelete('mem:lessons', id);
  console.log(`✓ Lesson ${id} deleted`);
}

// ===== Slots =====

function slotsList() {
  const [project, global] = [
    runStateList('mem:slots'),
    runStateList('mem:slots:global')
  ];
  const all = [...global, ...project];
  console.log(`Found ${all.length} slots (${global.length} global, ${project.length} project)`);
  all.forEach((slot) => {
    const scope = global.includes(slot) ? 'global' : 'project';
    console.log('\n--- Slot ---');
    console.log(`Label: ${slot.label} (${scope})`);
    console.log(`Content: ${slot.content}`);
    console.log(`Size: ${slot.content.length}/${slot.sizeLimit}`);
    console.log(`Pinned: ${slot.pinned}`);
    console.log(`Description: ${slot.description}`);
  });
}

function slotsGet(label, scope = 'auto') {
  let item, actualScope;
  
  if (scope === 'auto') {
    item = runStateGet('mem:slots', label);
    actualScope = 'project';
    if (!item) {
      item = runStateGet('mem:slots:global', label);
      actualScope = 'global';
    }
  } else {
    const scopeKey = scope === 'global' ? 'mem:slots:global' : 'mem:slots';
    item = runStateGet(scopeKey, label);
    actualScope = scope;
  }
  
  if (!item) {
    console.error(`Slot ${label} not found`);
    process.exit(1);
  }
  console.log(`Scope: ${actualScope}`);
  console.log(JSON.stringify(item, null, 2));
}

function slotsSet(label, content, options = {}) {
  const scope = options.scope || 'auto';  // 'auto' means search both project and global
  let item, scopeKey;
  
  if (scope === 'auto') {
    item = runStateGet('mem:slots', label);
    scopeKey = 'mem:slots';
    if (!item) {
      item = runStateGet('mem:slots:global', label);
      scopeKey = 'mem:slots:global';
    }
  } else {
    scopeKey = scope === 'global' ? 'mem:slots:global' : 'mem:slots';
    item = runStateGet(scopeKey, label);
  }
  
  if (!item) {
    console.error(`Slot ${label} not found. Use 'slots create' first.`);
    process.exit(1);
  }
  if (content.length > item.sizeLimit) {
    console.error(`Content exceeds sizeLimit (${content.length} > ${item.sizeLimit})`);
    process.exit(1);
  }
  item.content = content;
  item.updatedAt = new Date().toISOString();
  runStateSet(scopeKey, label, item);
  console.log(`✓ Slot ${label} (${scope === 'global' ? 'global' : 'project'}) updated`);
}

function slotsCreate(label, content, options = {}) {
  const scope = options.scope || 'project';
  if (!['project', 'global'].includes(scope)) {
    console.error(`Invalid scope: ${scope} (must be 'project' or 'global')`);
    process.exit(1);
  }
  const sizeLimit = options.sizeLimit || 2000;
  
  const scopeKey = scope === 'global' ? 'mem:slots:global' : 'mem:slots';
  const existing = runStateGet(scopeKey, label);
  if (existing) {
    console.error(`Slot ${label} already exists in ${scope} scope`);
    process.exit(1);
  }
  const slot = {
    label,
    content,
    sizeLimit: parseInt(sizeLimit),
    description: '',
    pinned: true,
    readOnly: false,
    scope,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  runStateSet(scopeKey, label, slot);
  console.log(`✓ Slot ${label} (${scope}) created`);
}

function slotsDelete(label, scope = 'auto') {
  let scopeKey;
  if (scope === 'auto') {
    // Try project first, then global
    const item = runStateGet('mem:slots', label);
    scopeKey = item ? 'mem:slots' : 'mem:slots:global';
  } else {
    scopeKey = scope === 'global' ? 'mem:slots:global' : 'mem:slots';
  }
  runStateDelete(scopeKey, label);
  console.log(`✓ Slot ${label} (${scope === 'global' ? 'global' : 'project'}) deleted`);
}

// ===== CLI =====

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log(`Usage: node amc.js <command> <subcommand> [args]

================================ LESSONS ================================

  node amc.js lessons list
    → 列出所有 lessons，显示 ID、content、confidence 等信息

  node amc.js lessons get <id>
    → 查看单个 lesson 的完整 JSON 详情
    示例: node amc.js lessons get lsn_585929ed1021b504

  node amc.js lessons set <id> <content> [--confidence=N] [--tags="a,b"] [--context="..."] [--source=manual]
    → 修改 lesson 的 content（必选）及其他可选字段

    示例1 - 只修改 content:
      node amc.js lessons set lsn_xxx "图片解析优先走 image-ocr 技能"

    示例2 - 修改 content + confidence + tags:
      node amc.js lessons set lsn_xxx "图片解析优先走 image-ocr 技能" --confidence=0.95 --tags="省token,图片解析"

    示例3 - 修改所有可选字段:
      node amc.js lessons set lsn_xxx "新内容" --confidence=0.9 --tags="规则,图片解析" --context="用户明确要求" --source=manual

    可选字段说明:
      --confidence=N   置信度，0-1 之间的数字（如 0.9）
      --tags="a,b"     标签，逗号分隔（如 "省token,图片解析"）
      --context="..."  上下文描述
      --source=xxx     来源：manual | crystal | consolidation

  node amc.js lessons add <content>
    → 新增 lesson，自动通过 mem::lesson-save API 创建
    示例: node amc.js lessons add "访问外国网站必须使用 127.0.0.1:7890 代理"

  node amc.js lessons delete <id>
    → 删除 lesson
    示例: node amc.js lessons delete lsn_xxx

================================ SLOTS ==================================

  node amc.js slots list
    → 列出所有 slots（project + global），显示 label、content、size 等信息

  node amc.js slots get <label> [--scope=global|--project]
    → 查看单个 slot 的完整 JSON 详情
    默认: 先查 project scope，找不到再查 global scope
    示例: node amc.js slots get persona
    示例: node amc.js slots get persona --scope=global    # 强制从 global scope 查找

  node amc.js slots set <label> <content> [--scope=global|--project]
    → 修改 slot 的 content
    默认: 先查 project scope，找不到再查 global scope
    示例: node amc.js slots set persona "你是商汤科技开发的日日新融合模态大模型，中文名叫商量"
    示例: node amc.js slots set persona "内容" --scope=global
    注意: content 长度不能超过 slot 的 sizeLimit

  node amc.js slots create <label> <content> [--scope=global|--project] [--sizeLimit=N]
    → 创建新 slot
    默认: project scope（当前项目专用）
    示例: node amc.js slots create coding_style "用户偏好 TypeScript，命名用 camelCase"
    示例: node amc.js slots create tool_guidelines "优先使用本地工具" --scope=global
    注意: label 只能包含小写字母、数字、下划线，且以字母开头

  node amc.js slots delete <label> [--scope=global|--project]
    → 删除 slot
    默认: 先查 project scope，找不到再查 global scope
    示例: node amc.js slots delete coding_style
    示例: node amc.js slots delete coding_style --scope=global`);
  process.exit(1);
}

const cmd = args[0];
const subCmd = args[1];

if (cmd === 'lessons') {
  if (subCmd === 'list') {
    lessonsList();
  } else if (subCmd === 'get' && args[2]) {
    lessonsGet(args[2]);
  } else if (subCmd === 'set' && args[2]) {
    const id = args[2];
    let content = args[3] || '';
    if (!content) {
      console.error('Usage: lessons set <id> <content> [--confidence=N] [--tags="a,b"] [--context="..."] [--source=manual]');
      process.exit(1);
    }
    const options = {};
    for (const arg of args.slice(4)) {
      if (arg.startsWith('--confidence=')) options.confidence = arg.split('=', 2)[1];
      else if (arg.startsWith('--tags=')) options.tags = arg.split('=', 2)[1];
      else if (arg.startsWith('--context=')) options.context = arg.split('=', 2)[1];
      else if (arg.startsWith('--source=')) options.source = arg.split('=', 2)[1];
      else {
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
      }
    }
    lessonsSet(id, content, options);
  } else if (subCmd === 'add' && args[2]) {
    lessonsAdd(args[2]);
  } else if (subCmd === 'delete' && args[2]) {
    lessonsDelete(args[2]);
  } else {
    console.error('Usage: lessons <list|get|set|add|delete> [args]');
    process.exit(1);
  }
} else if (cmd === 'slots') {
  if (subCmd === 'list') {
    slotsList();
  } else if (subCmd === 'get' && args[2]) {
    const label = args[2];
    const options = {};
    for (const arg of args.slice(3)) {
      if (arg.startsWith('--scope=')) options.scope = arg.split('=', 2)[1];
      else {
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
      }
    }
    slotsGet(label, options.scope);
  } else if (subCmd === 'set' && args[2]) {
    const label = args[2];
    let content = args[3] || '';
    if (!content) {
      console.error('Usage: slots set <label> <content> [--scope=global|--project]');
      process.exit(1);
    }
    const options = {};
    for (const arg of args.slice(4)) {
      if (arg.startsWith('--scope=')) options.scope = arg.split('=', 2)[1];
      else {
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
      }
    }
    slotsSet(label, content, options);
  } else if (subCmd === 'create' && args[2]) {
    const label = args[2];
    let content = args[3] || '';
    if (!content) {
      console.error('Usage: slots create <label> <content> [--scope=global|--project]');
      process.exit(1);
    }
    const options = {};
    for (const arg of args.slice(4)) {
      if (arg.startsWith('--scope=')) options.scope = arg.split('=', 2)[1];
      else if (arg.startsWith('--sizeLimit=')) options.sizeLimit = arg.split('=', 2)[1];
      else {
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
      }
    }
    slotsCreate(label, content, options);
  } else if (subCmd === 'delete' && args[2]) {
    const label = args[2];
    const options = {};
    for (const arg of args.slice(3)) {
      if (arg.startsWith('--scope=')) options.scope = arg.split('=', 2)[1];
      else {
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
      }
    }
    slotsDelete(label, options.scope);
  } else {
    console.error('Usage: slots <list|get|set|create|delete> [args]');
    process.exit(1);
  }
} else {
  console.error(`Unknown command: ${cmd}. Use 'lessons' or 'slots'.`);
  process.exit(1);
}
