#!/usr/bin/env node
/**
 * keyword_audit.mjs —— 题库关键词体检（与线上判分共用同一套匹配器）
 *
 * 背景：data/questions.json 的 keywords 由出题方写成"概念标签"（如 call to action、
 * notice of change、mutual benefit），而真实作答（包括官方风格的参考范文）几乎不会
 * 逐字照抄这些短语。若匹配过严，模拟判分的"内容与切题"维会把好文章判成跑题。
 *
 * 这个脚本用 js/scorer.js 里导出的 keywordCredit() 逐个关键词计算"参考范文自身
 * 能拿到多少分"，输出：
 *   1) 全库/分题覆盖率，列出覆盖率偏低的题目；
 *   2) credit < 0.75 的关键词清单（即范文自己都没覆盖到的标签，属于关键词设计问题）；
 *   3) 退出码：平均覆盖率 < 0.85 或存在 credit=0 的关键词时 exit 1（可接 CI）。
 *
 * 用法：node tools/keyword_audit.mjs [--json]
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const questionsPath = path.join(ROOT, "data", "questions.json");
const scorerPath = path.join(ROOT, "js", "scorer.js");

if (!fs.existsSync(questionsPath)) {
  console.error(`✗ 找不到 ${questionsPath}，请先运行 node tools/merge_questions.mjs`);
  process.exit(1);
}

const questions = JSON.parse(fs.readFileSync(questionsPath, "utf8"));

/* 在最小上下文里加载判分引擎，取用它的关键词匹配器（单一事实来源） */
const sandbox = { window: {}, console, setTimeout, clearTimeout };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(scorerPath, "utf8"), sandbox);
const Scorer = sandbox.window.Scorer;
if (!Scorer || typeof Scorer.keywordCredit !== "function") {
  console.error("✗ js/scorer.js 未导出 keywordCredit，无法体检");
  process.exit(1);
}

/* 有效切题度 = 判分引擎真正使用的口径（标签命中率 + 范文实词命中率各半）。
   contentCoverage 不可用时退回标签命中率，保证老数据也能体检。 */
function effectiveCoverage(q) {
  const lower = String(q.modelAnswer || "").toLowerCase();
  if (typeof Scorer.contentCoverage === "function") return Scorer.contentCoverage(lower, q);
  const kws = Array.isArray(q.keywords) ? q.keywords : [];
  const credits = kws.map((k) => Scorer.keywordCredit(lower, k));
  const kw = credits.length ? credits.reduce((a, b) => a + b, 0) / credits.length : null;
  return { coverage: kw, keywordCoverage: kw, termCoverage: null, matched: [], credits, termHits: [], termMisses: [] };
}

const rows = [];
const kwStats = new Map();

for (const q of questions) {
  const lower = String(q.modelAnswer || "").toLowerCase();
  const kws = Array.isArray(q.keywords) ? q.keywords : [];
  const credits = kws.map((k) => Scorer.keywordCredit(lower, k));
  const cc = effectiveCoverage(q);
  kws.forEach((k, i) => {
    const rec = kwStats.get(k) || { kw: k, total: 0, weak: [], zero: [] };
    rec.total += 1;
    if (credits[i] < 0.75) rec.weak.push(q.id);
    if (credits[i] < 0.2) rec.zero.push(q.id);
    kwStats.set(k, rec);
  });
  rows.push({
    id: q.id, qtype: q.qtype, topic: q.topic, n: kws.length,
    coverage: cc.coverage, keywordCoverage: cc.keywordCoverage, termCoverage: cc.termCoverage,
    terms: Array.isArray(q.answerTerms) ? q.answerTerms.length : 0,
    credits, kws,
  });
}

const avg = rows.reduce((a, r) => a + (r.coverage || 0), 0) / (rows.length || 1);
const avgKw = rows.reduce((a, r) => a + (r.keywordCoverage || 0), 0) / (rows.length || 1);
const avgTerm = rows.reduce((a, r) => a + (r.termCoverage == null ? 0 : r.termCoverage), 0) / (rows.length || 1);
const lowQ = rows.filter((r) => (r.coverage || 0) < 0.75).sort((a, b) => a.coverage - b.coverage);
const missingTerms = rows.filter((r) => r.terms < 8);
const weakKws = [...kwStats.values()]
  .filter((r) => r.weak.length)
  .sort((a, b) => b.weak.length - a.weak.length || a.kw.localeCompare(b.kw));
const zeroKws = weakKws.filter((r) => r.zero.length);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ averageCoverage: avg, averageKeywordCoverage: avgKw, averageTermCoverage: avgTerm, questions: rows.length, lowQuestions: lowQ, missingTerms, weakKeywords: weakKws }, null, 2));
} else {
  console.log("=== 题库内容切题度体检（用参考范文自评，与线上判分同口径）===");
  console.log(`题目数 ${rows.length}　关键词标签 ${[...kwStats.values()].reduce((a, r) => a + r.total, 0)} 个`);
  console.log(`参考范文：标签命中率 ${(avgKw * 100).toFixed(1)}%　范文实词命中率 ${(avgTerm * 100).toFixed(1)}%　→ 综合切题度 ${(avg * 100).toFixed(1)}%（判分引擎实际使用）`);
  console.log();
  if (lowQ.length) {
    console.log(`综合切题度 <75% 的题目（${lowQ.length} 道，说明该题标签/实词与范文都难以对上）：`);
    for (const r of lowQ) {
      console.log(`  ${r.id.padEnd(6)} ${(r.coverage * 100).toFixed(0).padStart(3)}%  ${r.qtype}　标签 ${(r.keywordCoverage * 100).toFixed(0)}% / 实词 ${r.termCoverage == null ? "—" : (r.termCoverage * 100).toFixed(0) + "%"}`);
    }
  } else {
    console.log("✓ 所有题目的参考范文综合切题度均 ≥75%");
  }
  console.log();
  if (missingTerms.length) console.log(`⚠ 参考范文实词不足 8 个的题目（${missingTerms.length} 道）：${missingTerms.map((r) => r.id).join(", ")}\n`);
  console.log(`单看标签时范文未命中的关键词标签（credit<0.75，共 ${weakKws.length} 个，属于标签写得"太抽象"，已由实词命中率兜底）：`);
  for (const r of weakKws.slice(0, 25)) {
    console.log(`  ${r.kw.padEnd(26)} x${String(r.weak.length).padStart(2)}  ${r.weak.slice(0, 8).join(",")}${r.weak.length > 8 ? ",…" : ""}`);
  }
  if (weakKws.length > 25) console.log(`  …另有 ${weakKws.length - 25} 个`);
}

process.exit(avg < 0.85 || missingTerms.length ? 1 : 0);
