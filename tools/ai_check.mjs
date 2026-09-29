/* ============================================================
   DeepSeek 真实判分接入自检
   用法：node tools/ai_check.mjs [题目id] [范文|坏文]
   检查项：① js/config.js 是否配好（打印时密钥打码）
           ② API Key 是否可用（GET /models）
           ③ 浏览器直连是否有 CORS（预检 + 实际响应头）
           ④ 走 scoring.js 真实判分全链路（四维分/批改/建议/耗时）
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const argv = process.argv.slice(2);
const QID = argv[0] || "jw06";
const WHICH = argv[1] || "范文";
const MODEL = argv[2] || "";

function readCfg() {
  const src = readFileSync(resolve(ROOT, "js/config.js"), "utf8");
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.window.APP_CONFIG;
}

const mask = k => (!k ? "(空)" : k.slice(0, 6) + "…" + k.slice(-4) + `（长度 ${k.length}）`);

const cfg = readCfg();
if (MODEL) cfg.api.model = MODEL;
console.log("=== 1. 本地配置 ===");
console.log("mockMode :", cfg.mockMode);
console.log("endpoint :", cfg.api.endpoint);
console.log("model    :", cfg.api.model);
console.log("apiKey   :", mask(cfg.api.apiKey));

const H = { Authorization: "Bearer " + cfg.api.apiKey, "Content-Type": "application/json" };

console.log("\n=== 2. API Key 可用性（GET /models）===");
try {
  const r = await fetch("https://api.deepseek.com/models", { headers: H });
  const j = await r.json();
  console.log("HTTP", r.status, Array.isArray(j.data) ? "可用模型：" + j.data.map(m => m.id).join(", ") : JSON.stringify(j).slice(0, 200));
} catch (e) {
  console.log("请求失败：", e.message);
}

console.log("\n=== 3. 浏览器直连 CORS 检查（Origin: https://peng684596.github.io）===");
try {
  const pre = await fetch(cfg.api.endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: "https://peng684596.github.io",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type"
    }
  });
  console.log("预检 HTTP", pre.status,
    "| ACAO:", pre.headers.get("access-control-allow-origin") || "(无)",
    "| ACAH:", pre.headers.get("access-control-allow-headers") || "(无)");
} catch (e) {
  console.log("预检请求失败：", e.message);
}
try {
  const post = await fetch(cfg.api.endpoint, {
    method: "POST",
    headers: { ...H, Origin: "https://peng684596.github.io" },
    body: JSON.stringify({ model: cfg.api.model, max_tokens: 1, messages: [{ role: "user", content: "hi" }] })
  });
  console.log("带 Origin 的 POST HTTP", post.status, "| ACAO:", post.headers.get("access-control-allow-origin") || "(无)");
} catch (e) {
  console.log("POST 请求失败：", e.message);
}
try {
  const nul = await fetch(cfg.api.endpoint, {
    method: "POST",
    headers: { ...H, Origin: "null" },
    body: JSON.stringify({ model: cfg.api.model, max_tokens: 1, messages: [{ role: "user", content: "hi" }] })
  });
  console.log("Origin: null（本地 file:// 双击打开）HTTP", nul.status, "| ACAO:", nul.headers.get("access-control-allow-origin") || "(无)");
} catch (e) {
  console.log("file:// 场景请求失败：", e.message);
}

console.log(`\n=== 4. 真实判分全链路（题目 ${QID}｜${WHICH}）===`);
const questions = JSON.parse(readFileSync(resolve(ROOT, "data/questions.json"), "utf8"));
const q = questions.find(x => x.id === QID);
if (!q) { console.log("找不到题目", QID); process.exit(1); }

const essay = WHICH === "坏文"
  ? "Dear Mr. Smith, I am write to you about the meeting. He go to the factory yesterday. I am very interest in your product, and I want discuss about the price. Please reply me as soon as possible. Thank you."
  : q.modelAnswer;

const ctx = {
  window: { APP_CONFIG: cfg },
  fetch, AbortController, setTimeout, clearTimeout, console,
  JSON, Math, String, Number, Array, Object, RegExp, Error, Promise, Date, isNaN, parseInt, parseFloat
};
vm.createContext(ctx);
vm.runInContext(readFileSync(resolve(ROOT, "js/scorer.js"), "utf8"), ctx);
const Scorer = ctx.window.Scorer;

const t0 = Date.now();
const r = await Scorer.scoreEssay(essay, q);
const ms = Date.now() - t0;
console.log("模式    :", r.mode, r.fallbackReason ? "｜" + r.fallbackReason : "");
console.log("总分/等级:", r.total, r.grade, "（耗时 " + (ms / 1000).toFixed(1) + "s）");
console.log("四维    :", ["content", "grammar", "organization", "format"]
  .map(k => `${k}=${r.dimensions[k].score}`).join("  "));
console.log("批改条数:", (r.errors || []).length, "｜建议条数:", (r.suggestions || []).length);
if (r.usage) console.log("token   :", JSON.stringify(r.usage));
for (const e of (r.errors || []).slice(0, 4)) {
  console.log(`  [${e.severity}] "${e.quote}" → ${e.explain} ｜改：${e.fix}`);
}
for (const s of (r.suggestions || []).slice(0, 3)) console.log("  · " + s);
console.log("\n内容维点评：", r.dimensions.content.comment);
console.log("语法维点评：", r.dimensions.grammar.comment);
