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

// 字段类型契约：渲染层依赖这些类型，任何偏差都会让页面在浏览器里静默失败
const STRING_FIELDS = ["id", "stage", "qtype", "title", "theme", "difficulty", "materials", "genre", "modelAnswer"];
const NUMBER_FIELDS = ["minWords", "timeLimitMin"];
const WEIGHT_KEYS = ["content", "grammar", "organization", "format"];

/** tips 规范化为字符串数组：字符串按换行切分，数组去空去空白 */
function normalizeTips(v) {
  if (Array.isArray(v)) return v.map(t => String(t).trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/\r?\n/).map(t => t.trim()).filter(Boolean);
  return null;
}

/* ============================================================
   参考范文实词（answerTerms）自动抽取
   背景：题库的 keywords 是"概念标签"（apology、efficiency、call to
   action…），学生（甚至官方风格范文）不会逐字照抄这些标签，只看标签会把
   好文章判成跑题。这里从每道题自己的参考范文里抽取"本题特有实词"，
   作为判分引擎内容维度的第二路信号（详见 js/scorer.js contentCoverage）。
   规则：
   1. 只取范文里长度 ≥4 的实词，剔除高频功能词/套话；
   2. 剔除专有名词（句中首字母大写者，如 Mr. Miller、MiniBrew）；
   3. 按"在本题出现次数 × 跨题稀有度"排序，取前 20 个。
   ============================================================ */
const STOP_WORDS = new Set(("a an the and or but if so because as than that this these those there here we our us you your they their it its " +
  "he she his her i my me is are was were be been being am do does did done have has had will would shall should can could may might must " +
  "not no nor also very more most much many some any all both each every other another such only just even still yet then when where which " +
  "who whom whose what why how while during before after since until about above below over under between among into onto from with without " +
  "within through against toward towards upon off out up down in on at by for to of per via " +
  "dear regards sincerely faithfully best kindly thank thanks please hope look forward hello hi sir madam mr ms mrs dr yours truly " +
  "write writing written letter email reply send sent get got make made take taken come came give given know need want like well good great " +
  "important however therefore moreover furthermore finally first second third additionally conclusion conclude summarize overall example " +
  "instance reason reasons thing things people way ways time times year years day days week weeks month months today tomorrow yesterday " +
  "new high higher low lower big small large part parts need needs also may").split(/\s+/));

const LOOSE_SUFFIX = ["ations", "ation", "ibilities", "ibility", "encies", "ency",
  "ances", "ance", "ences", "ence", "ings", "ing", "edly", "ments", "ment", "ness",
  "ities", "ity", "ives", "ive", "ers", "er", "ors", "or", "ies", "ied", "ed", "es", "s"];

function looseRoot(w) {
  let s = String(w == null ? "" : w).toLowerCase().replace(/[^a-z]/g, "");
  for (const suf of LOOSE_SUFFIX) {
    if (s.endsWith(suf) && s.length - suf.length >= 4) { s = s.slice(0, -suf.length); break; }
  }
  return s.slice(0, 6);
}

function tokenize(text) {
  return String(text || "").toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [];
}

/** 句中（非句首）首字母大写的词视作专有名词，如 Mr. Miller、MiniBrew、Guangzhou。
    注意：Mr./Ms./Dr. 这类缩写里的句点会骗过"句首"判断（"Dear Mr. Miller" 会被切成
    两个句子，Miller 就成了句首词），所以先把缩写里的句点换成下划线。 */
function properNouns(text) {
  const set = new Set();
  const safe = String(text || "").replace(/\b(Mr|Ms|Mrs|Dr|Prof|St|No|Fig|approx|etc|vs|Inc|Ltd|Co)\./g, "$1_");
  for (const sent of safe.split(/(?<=[.!?])\s+/)) {
    const toks = sent.match(/[A-Za-z][A-Za-z'-]*/g) || [];
    toks.slice(1).forEach(t => { if (/^[A-Z]/.test(t)) set.add(t.toLowerCase()); });
  }
  return set;
}

/** 抽取参考范文实词：本题内高频 + 跨题稀有 */
function deriveAnswerTerms(questions) {
  const df = new Map(), perQ = [];
  for (const q of questions) {
    const toks = tokenize(q.modelAnswer).filter(t => t.length >= 4 && !STOP_WORDS.has(t));
    perQ.push(toks);
    for (const r of new Set(toks.map(looseRoot))) df.set(r, (df.get(r) || 0) + 1);
  }
  const N = questions.length || 1;
  questions.forEach((q, i) => {
    const proper = properNouns(q.modelAnswer);
    const freq = new Map();
    for (const t of perQ[i]) freq.set(t, (freq.get(t) || 0) + 1);
    q.answerTerms = [...freq.entries()]
      .filter(([t]) => !proper.has(t))
      .map(([t, c]) => {
        const commonness = (df.get(looseRoot(t)) || 1) / N;      // 跨题普遍度：越常见越不像"本题要点"
        const rarity = 1 - Math.min(1, commonness / 0.28);
        return { t, score: (1 + Math.log(c)) * rarity };
      })
      .filter(x => x.score > 0.15)
      .sort((a, b) => b.score - a.score || a.t.localeCompare(b.t))
      .slice(0, 20)
      .map(x => x.t);
  });
}

let tipsNormalized = 0;

/* 主题方向：题库里的 theme 是细粒度标签（59 个，38 个只出现一次），
   直接拿来当筛选器没有实用价值。这里映射到 9 个粗粒度方向，
   用于首页筛选；细粒度 theme 仍保留在卡片与搜索里。 */
const TOPIC_MAP = {
  "实习与求职": "求职与就业", "就业市场与薪酬": "求职与就业",
  "新能源与绿色岗位": "求职与就业", "岗位说明书": "求职与就业",
  "职场沟通": "职场沟通与协作", "主动沟通": "职场沟通与协作", "团队沟通与倾听": "职场沟通与协作",
  "团队合作": "职场沟通与协作", "跨文化沟通": "职场沟通与协作", "商务礼仪": "职场沟通与协作",
  "商务邮件": "职场沟通与协作", "商务洽谈": "职场沟通与协作", "会议管理": "职场沟通与协作",
  "商务采购": "商务运营与实务", "售后服务": "商务运营与实务", "客户投诉": "商务运营与实务",
  "投诉处理": "商务运营与实务", "销售跟进": "商务运营与实务", "品牌推广": "商务运营与实务",
  "产品介绍": "商务运营与实务", "通知变更": "商务运营与实务",
  "会议纪要": "公文与文书", "内部通知": "公文与文书", "备忘录": "公文与文书", "新闻简报": "公文与文书",
  "数字技能": "科技与数字", "数字经济": "科技与数字", "智能制造": "科技与数字",
  "AI 应用与岗位": "科技与数字", "AI 与就业": "科技与数字", "AI 时代的能力观": "科技与数字",
  "新能源与碳排放": "绿色与能源", "绿色能源": "绿色与能源", "绿色环保": "绿色与能源",
  "跨境电商": "经济与消费", "电商与快递物流": "经济与消费", "餐饮消费": "经济与消费",
  "文旅消费": "经济与消费", "交通出行": "经济与消费", "城市交通": "经济与消费", "旅游": "经济与消费",
  "乡村振兴": "社会与教育", "校园活动与志愿服务": "社会与教育", "职业教育": "社会与教育",
  "职业教育与技能": "社会与教育", "职业教育规模": "社会与教育",
  "健康运动": "社会与教育", "健身健康": "社会与教育",
  "坚持与职业韧性": "成长与思维", "失败与成长": "成长与思维", "时间管理": "成长与思维",
  "情绪管理": "成长与思维", "诚信与职业操守": "成长与思维", "工匠精神": "成长与思维",
  "终身学习": "成长与思维", "适应变化与转型": "成长与思维", "长期主义与职业规划": "成长与思维",
  "创新与容错": "成长与思维", "成长型思维": "成长与思维"
};

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
    for (const k of STRING_FIELDS) {
      if (q[k] != null && typeof q[k] !== "string") {
        errors.push(`${f}/${q.id || "?"}: 字段 ${k} 应为字符串，实际为 ${Array.isArray(q[k]) ? "array" : typeof q[k]}`);
      }
    }
    for (const k of NUMBER_FIELDS) {
      if (q[k] != null && typeof q[k] !== "number") {
        errors.push(`${f}/${q.id || "?"}: 字段 ${k} 应为数字，实际为 ${typeof q[k]}`);
      }
    }
    // tips：统一成字符串数组（题库 schema 规定为数组），渲染层只认数组
    const tips = normalizeTips(q.tips);
    if (tips === null) errors.push(`${f}/${q.id || "?"}: 字段 tips 应为字符串数组或换行分隔字符串`);
    else {
      if (typeof q.tips === "string") tipsNormalized++;
      if (!tips.length) errors.push(`${f}/${q.id || "?"}: 字段 tips 规范化后为空`);
      q.tips = tips;
    }
    // keywords：统一成非空字符串数组
    if (q.keywords != null && !Array.isArray(q.keywords)) {
      errors.push(`${f}/${q.id || "?"}: 字段 keywords 应为字符串数组，实际为 ${typeof q.keywords}`);
    } else if (Array.isArray(q.keywords)) {
      q.keywords = q.keywords.map(k => String(k).trim()).filter(Boolean);
      if (!q.keywords.length) errors.push(`${f}/${q.id || "?"}: 字段 keywords 为空数组`);
    }
    if (q.scoringWeights) {
      const sum = Object.values(q.scoringWeights).reduce((a, b) => Number(a) + Number(b), 0);
      if (sum !== 100) warnings.push(`${f}/${q.id}: 评分权重合计 ${sum} ≠ 100`);
      for (const k of WEIGHT_KEYS) {
        if (typeof q.scoringWeights[k] !== "number") errors.push(`${f}/${q.id}: scoringWeights.${k} 缺失或非数字`);
      }
      const extra = Object.keys(q.scoringWeights).filter(k => !WEIGHT_KEYS.includes(k));
      if (extra.length) errors.push(`${f}/${q.id}: scoringWeights 含未知维度 ${extra.join(",")}`);
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
    // 主题方向：细粒度 theme → 粗粒度 topic（首页筛选用）
    const topic = TOPIC_MAP[q.theme];
    if (!topic) errors.push(`${f}/${q.id || "?"}: 主题「${q.theme}」未在 TOPIC_MAP 中登记，无法归类`);
    else q.topic = topic;
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

/* 参考范文实词：判分引擎内容维度的第二路信号（见 js/scorer.js contentCoverage） */
deriveAnswerTerms(all);
for (const q of all) {
  if (!Array.isArray(q.answerTerms) || q.answerTerms.length < 8) {
    warnings.push(`${q.id}: 参考范文仅抽取出 ${(q.answerTerms || []).length} 个实词（<8），内容维度主要依赖 keywords`);
  }
}

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
const byTopic = {};
for (const q of all) byTopic[q.topic] = (byTopic[q.topic] || 0) + 1;
console.log("主题方向：" + Object.entries(byTopic).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join("，"));
if (tipsNormalized) console.log(`ℹ 已将 ${tipsNormalized} 道题的 tips 从换行字符串规范化为字符串数组`);
if (warnings.length) {
  console.warn("\n⚠ 警告（" + warnings.length + " 条，不阻断合并）：\n" + warnings.slice(0, 60).join("\n"));
}
