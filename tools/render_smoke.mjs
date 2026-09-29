/* ============================================================
   全站渲染冒烟测试（Node + 最小 DOM 桩，无需浏览器）
   覆盖四个页面脚本，全部走真实数据：
     1. practice.js —— 逐题渲染全部题目（标题/材料/体裁/提示/图表）
     2. app.js      —— 题库首页：卡片数量、主题下拉、筛选逻辑
     3. result.js   —— 判分结果页：对每道题生成一份作答记录并渲染
     4. history.js  —— 学习记录页：统计、SVG 曲线、明细表
   用法：node tools/render_smoke.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const questions = JSON.parse(readFileSync(join(root, "data", "questions.json"), "utf8"));
const SRC = {};
for (const f of ["practice", "chart", "app", "result", "history", "scorer"]) {
  SRC[f] = readFileSync(join(root, "js", f + ".js"), "utf8");
}

const failures = [];
const note = (page, msg) => failures.push(`[${page}] ${msg}`);

function makeEl(id) {
  const el = {
    id, value: "", className: "",
    dataset: {}, style: {}, removed: false,
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, removeEventListener() {},
    querySelectorAll() { return []; }, closest() { return null; },
    remove() { el.removed = true; }, showModal() {}, close() {}, click() {}, focus() {}
  };
  // 真实 DOM 会把 innerHTML/textContent 赋值强制转成字符串，桩必须一致
  let _html = "", _text = "";
  Object.defineProperty(el, "innerHTML", { get: () => _html, set: (v) => { _html = v == null ? "" : String(v); } });
  Object.defineProperty(el, "textContent", { get: () => _text, set: (v) => { _text = v == null ? "" : String(v); } });
  return el;
}

/** 建一个最小浏览器环境；history 为初始 localStorage 记录 */
function makeEnv({ search = "", history = [] } = {}) {
  const els = new Map();
  const get = (id) => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); };
  const store = new Map();
  if (history.length) store.set("wa_history", JSON.stringify(history));

  const document = {
    getElementById: get,
    createElement: (t) => makeEl(t),
    addEventListener() {},
    querySelectorAll() { return []; }
  };
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  };
  const sandbox = {
    document, localStorage, console,
    location: { search, href: "" },
    URLSearchParams, encodeURIComponent, setTimeout, clearTimeout,
    setInterval: () => 0, clearInterval() {},
    alert() {}, confirm: () => false,
    Blob: function () {}, URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
    Date, Math, JSON, Object, Array, String, Number, RegExp, Set, Map, Promise,
    fetch: async () => ({ ok: true, json: async () => questions })
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.addEventListener = () => {};
  sandbox.window.Scorer = {
    scoreEssay: async () => ({ total: 0, grade: "D", mode: "mock", dimensions: {} }),
    wordCount: (t) => (t && t.trim() ? t.trim().split(/\s+/).length : 0)
  };
  sandbox.window.QUESTIONS = questions;
  const ctx = vm.createContext(sandbox);
  return { ctx, get, run: (src, name) => vm.runInContext(src, ctx, { filename: name }) };
}

const tick = () => new Promise(r => setTimeout(r, 0));

/** 渲染结果里不该出现的东西 */
function scanHtml(page, label, html) {
  if (/undefined/.test(html)) note(page, `${label}: 渲染出现 undefined`);
  if (/\[object Object\]/.test(html)) note(page, `${label}: 渲染出现 [object Object]`);
  if (/NaN/.test(html)) note(page, `${label}: 渲染出现 NaN`);
}

/* ---------- 1. practice.js：逐题渲染 ---------- */
async function testPractice() {
  let ok = 0;
  for (const q of questions) {
    const env = makeEnv({ search: "?id=" + encodeURIComponent(q.id) });
    try {
      env.run(SRC.chart, "chart.js");
      env.run(SRC.practice, "practice.js");
      await tick();
    } catch (e) {
      note("practice", `${q.id}: 渲染抛异常 ${e.message}`);
      continue;
    }
    const html = env.get("qPanel").innerHTML || "";
    const bad = [];
    if (!html.includes("qtitle")) bad.push("题目面板为空");
    if (html.includes("题目不存在")) bad.push("被判为题目不存在");
    if (q.tips && q.tips.length && !html.includes("tips-list")) bad.push("写作提示未渲染");
    if (q.chart) {
      const svg = env.get("chartBox").innerHTML || "";
      if (!svg) bad.push("图表未渲染");
      else if (!/<svg[\s>]/.test(svg)) bad.push("图表不是 SVG");
      else {
        // 校验图表确实带上了标题、单位与坐标标签，而不是只输出一个空壳
        if (q.chart.title && !svg.includes(q.chart.title)) bad.push("图表标题缺失");
        if (q.chart.type !== "table") {
          const missLabels = (q.chart.labels || []).filter(l => !svg.includes(String(l)));
          if (missLabels.length) bad.push(`图表 label 缺失 ${missLabels.slice(0, 3).join("/")}`);
        } else {
          const firstLabel = (q.chart.labels || [])[0];
          if (firstLabel && !svg.includes(String(firstLabel))) bad.push("表格表头缺失");
        }
      }
    }
    if (env.get("minWordsTxt").textContent !== String(q.minWords)) bad.push("目标字数未写入");
    if (env.get("limitTxt").textContent !== String(q.timeLimitMin)) bad.push("限时未写入");
    if (bad.length) note("practice", `${q.id}: ${bad.join("；")}`);
    else { scanHtml("practice", q.id, html); ok++; }
  }
  console.log(`  practice.js：${ok}/${questions.length} 题正常出题`);
}

/* ---------- 2. app.js：题库首页 ---------- */
async function testIndex() {
  const env = makeEnv();
  try {
    env.run(SRC.app, "app.js");
    await tick();
  } catch (e) {
    note("index", `脚本抛异常 ${e.message}`);
    return;
  }
  const html = env.get("qGrid").innerHTML || "";
  const cards = (html.match(/class="qcard"/g) || []).length;
  if (cards !== questions.length) note("index", `卡片数 ${cards} ≠ 题库 ${questions.length}`);
  if (!/class="qtitle"/.test(html)) note("index", "卡片标题未渲染");
  scanHtml("index", "题库网格", html);
  const optCount = (env.get("fTopic").innerHTML.match(/<option/g) || []).length;
  const topics = new Set(questions.map(q => q.topic).filter(Boolean));
  if (optCount !== topics.size + 1) note("index", `主题方向下拉 ${optCount} 项 ≠ 方向数 ${topics.size}+1`);
  if (topics.size > 12) note("index", `主题方向过多（${topics.size} 个），筛选器失去意义`);
  if (env.get("statTotal").textContent !== String(questions.length)) note("index", "统计总数未写入");
  console.log(`  app.js：${cards} 张卡片、${optCount - 1} 个主题方向、统计总数 ${env.get("statTotal").textContent}`);
}

/* ---------- 3. result.js：每题一份记录渲染 ---------- */
async function testResult() {
  let ok = 0;
  for (const q of questions) {
    const entry = {
      qid: q.id, essay: "This is a sample essay body for testing purposes.", title: q.title,
      stage: q.stage, qtype: q.qtype, date: new Date().toISOString(),
      wordCount: 9, minWords: q.minWords, timeUsedSec: 600, timeLimitSec: q.timeLimitMin * 60,
      total: 72, grade: "B", mode: "mock",
      dimensions: {
        content: { score: 70, comment: "内容基本切题" }, grammar: { score: 75, comment: "语法尚可" },
        organization: { score: 72, comment: "结构清晰" }, format: { score: 68, comment: "格式待改进" }
      },
      errors: [{ severity: "error", title: "主谓一致", quote: "He go", explain: "第三人称单数", fix: "He goes" }],
      suggestions: ["注意主谓一致", "丰富衔接词"], fallbackReason: ""
    };
    const env = makeEnv({ search: "?i=0", history: [entry] });
    try {
      env.run(SRC.result, "result.js");
      await tick();
    } catch (e) {
      note("result", `${q.id}: 渲染抛异常 ${e.message}`);
      continue;
    }
    const html = env.get("resultRoot").innerHTML || "";
    if (!html.includes("score-total")) note("result", `${q.id}: 结果区为空或未渲染`);
    if (!html.includes("modelZone") && !html.includes("暂无参考范文")) note("result", `${q.id}: 范文区未渲染`);
    if (!html.includes("逐条批改")) note("result", `${q.id}: 批改区未渲染`);
    scanHtml("result", q.id, html);
    ok++;
  }
  console.log(`  result.js：${ok}/${questions.length} 题的结果页正常渲染`);
}

/* ---------- 4. history.js：空态与多条记录 ---------- */
async function testHistory() {
  const envEmpty = makeEnv();
  try { envEmpty.run(SRC.history, "history.js"); }
  catch (e) { note("history", `空记录时抛异常 ${e.message}`); }
  if (!/至少完成 2 次作答/.test(envEmpty.get("trendNote").textContent)) note("history", "空态曲线提示缺失");

  const hist = questions.slice(0, 6).map((q, i) => ({
    qid: q.id, title: q.title, qtype: q.qtype, date: new Date(Date.now() - i * 86400000).toISOString(),
    wordCount: q.minWords, minWords: q.minWords, timeUsedSec: 900, total: 55 + i * 6, grade: "C",
    dimensions: { content: { score: 60 }, grammar: { score: 62 }, organization: { score: 58 }, format: { score: 70 } }
  }));
  const env = makeEnv({ history: hist });
  try { env.run(SRC.history, "history.js"); }
  catch (e) { note("history", `多条记录时抛异常 ${e.message}`); return; }
  const svg = env.get("trendChart").innerHTML || "";
  if (!/polyline/.test(svg)) note("history", "进步曲线未渲染");
  if ((svg.match(/<circle/g) || []).length !== hist.length) note("history", "曲线数据点数量不符");
  const rows = (env.get("historyBody").innerHTML.match(/<tr>/g) || []).length;
  if (rows !== hist.length) note("history", `明细行数 ${rows} ≠ 记录数 ${hist.length}`);
  if (env.get("stTimes").textContent !== String(hist.length)) note("history", "作答次数统计不符");
  const avg = Math.round(hist.reduce((a, b) => a + b.total, 0) / hist.length);
  if (env.get("stAvg").textContent !== String(avg)) note("history", `平均分 ${env.get("stAvg").textContent} ≠ ${avg}`);
  scanHtml("history", "曲线与明细", svg + env.get("historyBody").innerHTML);
  console.log(`  history.js：空态正常；${hist.length} 条记录 → 曲线 ${(svg.match(/<circle/g) || []).length} 点、明细 ${rows} 行、平均分 ${env.get("stAvg").textContent}`);
}

/* ---------- 5. 题库内嵌数据（file:// 直开回退路径） ---------- */
function testEmbeddedFallback() {
  const src = readFileSync(join(root, "js", "questions-data.js"), "utf8");
  const env = makeEnv({});
  try { env.run(src, "questions-data.js"); }
  catch (e) { note("embedded", `questions-data.js 执行失败 ${e.message}`); return; }
  const list = env.ctx.window.QUESTIONS;
  if (!Array.isArray(list)) note("embedded", "window.QUESTIONS 不是数组");
  else if (list.length !== questions.length) note("embedded", `内嵌 ${list.length} 题 ≠ 题库 ${questions.length} 题`);
  else if (JSON.stringify(list) !== JSON.stringify(questions)) note("embedded", "内嵌题库与 data/questions.json 内容不一致");
  else console.log(`  questions-data.js：内嵌 ${list.length} 题，与 questions.json 逐字节一致`);
}

/* ---------- 6. 判分引擎回归（mock 模式） ---------- */
async function testScorer() {
  const env = makeEnv({});
  env.run(SRC.scorer, "scorer.js");
  const Scorer = env.ctx.window.Scorer;
  if (!Scorer || typeof Scorer.scoreEssay !== "function") { note("scorer", "未暴露 window.Scorer.scoreEssay"); return; }
  const q = questions.find(x => x.qtype === "应用文写作") || questions[0];
  const essay = "Dear Mr. Smith,\n\nI am writing to apply for the position. He go to the market yesterday. "
    + "I have four year experience in marketing and I am very interested in this job. "
    + "I look forward to hear from you. Thank you for your time and consideration.\n\nSincerely,\nLi Ming";
  const r = await Scorer.scoreEssay(essay, q);
  const dims = ["content", "grammar", "organization", "format"];
  for (const d of dims) {
    if (!r.dimensions || typeof r.dimensions[d]?.score !== "number") note("scorer", `维度 ${d} 缺失或非数字`);
  }
  if (typeof r.total !== "number" || r.total < 0 || r.total > 100) note("scorer", `总分异常 ${r.total}`);
  if (!["A", "B", "C", "D"].includes(r.grade)) note("scorer", `等级异常 ${r.grade}`);
  if (!Array.isArray(r.errors) || !r.errors.length) note("scorer", "未检出任何语法错误（含明显主谓一致错误）");
  if (!Array.isArray(r.suggestions) || !r.suggestions.length) note("scorer", "未生成提升建议");
  const errHit = (r.errors || []).some(e => /go/i.test(e.quote || ""));
  if (!errHit) note("scorer", "未引用原文中的主谓一致错误 He go");
  const locked = [r.dimensions.content.score, r.dimensions.grammar.score, r.dimensions.organization.score, r.dimensions.format.score];
  if (locked.some(s => s < 0 || s > 100)) note("scorer", "维度分越界");
  console.log(`  scorer.js：mock 判分总分 ${r.total}（${r.grade}）、四维 ${locked.join("/")}、批改 ${r.errors.length} 条、建议 ${r.suggestions.length} 条`);
}

/* ---------- 执行 ---------- */
console.log(`全站渲染冒烟测试（题库 ${questions.length} 题）`);
await testPractice();
await testIndex();
await testResult();
await testHistory();
testEmbeddedFallback();
await testScorer();

if (failures.length) {
  console.error(`\n❌ 失败 ${failures.length} 项：\n` + failures.join("\n"));
  process.exit(1);
}
console.log("\n✅ 四个页面 + 内嵌数据 + 判分引擎全部通过");
