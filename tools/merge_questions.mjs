/* ============================================================
   题库合并脚本
   用法：node tools/merge_questions.mjs
   功能：
   1. 读取 data/raw/*.json 中所有题目
   2. 校验必填字段、id 唯一性、图表数据一致性、范文字数
   3. 输出 data/questions.json（数据源，供人工编辑）
   4. 输出 js/questions-data.js（window.QUESTIONS 内嵌数据，
      保证双击 index.html 以 file:// 打开时也能加载题库）
   ============================================================ */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const rawDir = join(root, "data", "raw");

const REQUIRED = ["id", "stage", "qtype", "title", "theme", "difficulty", "minWords",
  "timeLimitMin", "scoringWeights", "materials", "genre", "tips", "keywords", "modelAnswer"];

const files = readdirSync(rawDir).filter(f => f.endsWith(".json")).sort();
const errors = [], warnings = [];
let all = [];

for (const f of files) {
  let arr;
  try {
    arr = JSON.parse(readFileSync(join(rawDir, f), "utf8"));
  } catch (e) {
    errors.push(`${f}: JSON 解析失败 - ${e.message}`);
    continue;
  }
  if (!Array.isArray(arr)) { errors.push(`${f}: 顶层结构不是数组`); continue; }
  for (const q of arr) {
    for (const k of REQUIRED) {
      if (q[k] == null || q[k] === "") errors.push(`${f}/${q.id || "?"}: 缺少字段 ${k}`);
    }
    if (q.scoringWeights) {
      const sum = Object.values(q.scoringWeights).reduce((a, b) => Number(a) + Number(b), 0);
      if (sum !== 100) warnings.push(`${f}/${q.id}: 评分权重合计 ${sum} ≠ 100`);
    }
    if (typeof q.chart === "string") {
      try { q.chart = JSON.parse(q.chart); }
      catch (e) { errors.push(`${f}/${q.id}: chart 字段 JSON 解析失败`); }
    }
    if (q.chart && typeof q.chart === "object") {
      const labels = Array.isArray(q.chart.labels) ? q.chart.labels : [];
      for (const s of (q.chart.series || [])) {
        if (s.data.length !== labels.length) {
          errors.push(`${f}/${q.id}: 图表系列「${s.name}」长度 ${s.data.length} ≠ labels 长度 ${labels.length}`);
        }
      }
      if (q.chart.type === "pie") {
        const s0 = q.chart.series && q.chart.series[0];
        const sum = (s0 && s0.data || []).reduce((a, b) => Number(a) + Number(b), 0);
        if (Math.abs(sum - 100) > 0.5) warnings.push(`${f}/${q.id}: 饼图百分比合计 ${sum} ≠ 100`);
      }
    }
    if (typeof q.modelAnswer === "string") {
      const t = q.modelAnswer.trim();
      const wc = t ? t.split(/\s+/).length : 0;
      if (wc < q.minWords) warnings.push(`${f}/${q.id}: 范文 ${wc} 词 < 目标 ${q.minWords} 词`);
    }
    all.push(q);
  }
}

const ids = new Set();
for (const q of all) {
  if (ids.has(q.id)) errors.push(`重复 id: ${q.id}`);
  ids.add(q.id);
}

if (errors.length) {
  console.error("❌ 校验失败（" + errors.length + " 处）：\n" + errors.join("\n"));
  process.exit(1);
}

all.sort((a, b) => a.id.localeCompare(b.id));

writeFileSync(join(root, "data", "questions.json"), JSON.stringify(all, null, 2), "utf8");
writeFileSync(join(root, "js", "questions-data.js"),
  "/* 本文件由 tools/merge_questions.mjs 自动生成，请勿手改；编辑 data/questions.json 后重新运行合并脚本。 */\n" +
  "window.QUESTIONS = " + JSON.stringify(all, null, 2) + ";\n", "utf8");

const byType = {}, byStage = {};
for (const q of all) {
  byType[q.qtype] = (byType[q.qtype] || 0) + 1;
  byStage[q.stage] = (byStage[q.stage] || 0) + 1;
}
console.log(`✅ 合并完成：共 ${all.length} 道题`);
console.log("按阶段：" + Object.entries(byStage).map(([k, v]) => `${k} ${v}`).join("，"));
console.log("按题型：" + Object.entries(byType).map(([k, v]) => `${k} ${v}`).join("，"));
console.log("已生成：data/questions.json 与 js/questions-data.js");
if (warnings.length) {
  console.warn("\n⚠ 警告（" + warnings.length + " 条，不阻断合并）：\n" + warnings.slice(0, 60).join("\n"));
}
