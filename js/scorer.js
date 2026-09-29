/* ============================================================
   AI 智能评分与批改核心
   - 默认模式：本地模拟评分引擎（规则化实现官方四维标准，无需 API Key）
   - 真实 AI 模式：调用 OpenAI 兼容接口（配置见 js/config.js）
   四维标准：① 内容与切题 35% ② 语法与词汇 30% ③ 组织与连贯 25% ④ 格式与字数 10%
   ============================================================ */
(function () {
  "use strict";

  /* ================= 语法/用词/标点规则库（模拟引擎） ================= */
  /* severity: error 扣3 / warning 扣1.5 / tip 扣0.4（tip 合计上限 5 分） */
  const RULES = [
    { id: "r01", type: "grammar", severity: "error", pattern: /\b(?:he|she|it)\s+(?:go|do|have|make|take|come|get|want|need|say|work|look|seem|play|study|live|use|find)\b/gi,
      title: "主谓一致：第三人称单数动词缺 -s", explain: "一般现在时中，主语为第三人称单数时谓语动词要加 -s/-es。", fix: "例：He goes / She does / It has（注意 have→has、do→does）。" },
    { id: "r02", type: "grammar", severity: "error", pattern: /\bpeople\s+(?:is|was)\b/gi,
      title: "主谓一致：people 是复数名词", explain: "people 作“人们”讲是集合名词，谓语用复数。", fix: "people are / people were。" },
    { id: "r03", type: "grammar", severity: "error", pattern: /\bthere\s+(?:have|has)\b/gi,
      title: "there be 句型误用", explain: "“有……”用 there is/are 表达，不可与 have 混用。", fix: "例：There are many reasons. / There has been an increase." },
    { id: "r04", type: "grammar", severity: "error", pattern: /\ba\s+(?!(?:university|useful|user|usual|european|one|once|uniform|unique|unit|union)\b)([aeiou][a-z]*)\b/gi,
      title: "冠词 a/an 误用", explain: "以元音音素开头的词前用 an。", fix: "an apple / an idea / an opportunity（university、useful 等以辅音音素开头，仍用 a）。" },
    { id: "r05", type: "grammar", severity: "error", pattern: /\ban\s+(?!(?:hour|honest|honor|heir)\b)([bcdfgjklmnpqrstvwxyz][a-z]*)\b/gi,
      title: "冠词 an/a 误用", explain: "以辅音音素开头的词前用 a，不用 an。", fix: "a report / a company（hour、honest 等 h 不发音，用 an）。" },
    { id: "r06", type: "grammar", severity: "error", pattern: /\b(?:although|though|even\s+though)\b[^.!?\n]{0,90}\bbut\b/gi,
      title: "连词叠加：although…but", explain: "英语中 although 与 but 不能同句连用，这是中文“虽然……但是”的负迁移。", fix: "保留 although 去掉 but，或保留 but 去掉 although。" },
    { id: "r07", type: "grammar", severity: "error", pattern: /\b(?:because|since)\b[^.!?\n]{0,90}\bso\b/gi,
      title: "连词叠加：because…so", explain: "because 与 so 不能同句连用。", fix: "保留 because 去掉 so，或保留 so 去掉 because。" },
    { id: "r08", type: "grammar", severity: "error", pattern: /\bmore\s+(?:better|worse|easier|harder|faster|higher|lower|cheaper|bigger|smaller|richer|poorer|stronger|longer|happier|healthier|heavier)\b/gi,
      title: "双重比较级", explain: "比较级词尾已含“更”义，不能再加 more。", fix: "直接用 better/faster…，或改用 more + 原级（如 more quickly）。" },
    { id: "r09", type: "grammar", severity: "error", pattern: /\bcan\s+(?:able|capable)\b|\bable\s+to\s+can\b/gi,
      title: "can / be able to 混用", explain: "can 与 be able to 语义重复，二者取其一。", fix: "can do 或 be able to do。" },
    { id: "r10", type: "vocabulary", severity: "error", pattern: /\b(?:discuss|mention)\s+about\b/gi,
      title: "及物动词误加 about", explain: "discuss / mention 是及物动词，直接接宾语。", fix: "discuss the problem / mention the issue。" },
    { id: "r11", type: "grammar", severity: "error", pattern: /\bsuggest(?:s|ed)?\s+(?:me|you|him|her|us|them|the\s+\w+)\s+to\b/gi,
      title: "suggest 用法错误", explain: "suggest 不接“宾语+to do”结构。", fix: "suggest (that) sb (should) do… 或 suggest doing…。" },
    { id: "r12", type: "grammar", severity: "error", pattern: /\blook(?:ing)?\s+forward\s+to\s+(?:see|meet|hear|do|work|get|receive|visit|attend|have)\b/gi,
      title: "look forward to 后接动名词", explain: "该短语中 to 是介词，后接名词或动名词。", fix: "look forward to seeing / meeting you。" },
    { id: "r13", type: "vocabulary", severity: "error", pattern: /\bvery\s+like\b/gi,
      title: "very like 修饰错误", explain: "like 作动词不用 very 修饰。", fix: "really like… 或 like… very much。" },
    { id: "r14", type: "vocabulary", severity: "warning", pattern: /\b(?:informations|advices|knowledges|equipments|homeworks|furnitures|researches|progresses)\b/gi,
      title: "不可数名词误加复数", explain: "这些词在英语中为不可数名词，无复数形式。", fix: "information / advice / knowledge / equipment…（表达数量用 a piece of）。" },
    { id: "r15", type: "vocabulary", severity: "warning", pattern: /\ba\s+(?:advice|information|equipment|furniture|news|progress|research|knowledge)\b/gi,
      title: "不可数名词前误加 a", explain: "不可数名词前不能直接用不定冠词 a/an。", fix: "a piece of advice / some information。" },
    { id: "r16", type: "vocabulary", severity: "error", pattern: /\b(?:childs|mans|womans)\b/gi,
      title: "不规则名词复数错误", explain: "这些名词的复数形式不规则。", fix: "children / men / women。" },
    { id: "r17", type: "grammar", severity: "warning", pattern: /\bi\b/g,
      title: "人称代词 I 未大写", explain: "第一人称单数代词 I 在句中任何位置都必须大写。", fix: "i → I（含 i'm → I'm、i'll → I'll）。" },
    { id: "r18", type: "punctuation", severity: "tip", pattern: /[,;:][A-Za-z]/g,
      title: "标点后缺空格", explain: "英文逗号/分号/冒号后应空一格再接单词。", fix: "在标点后补一个空格。" },
    { id: "r19", type: "punctuation", severity: "tip", pattern: /\s+[,.;:!?]/g,
      title: "标点前多余空格", explain: "英文标点应紧贴前一个单词，不加空格。", fix: "删除标点前的空格。" },
    { id: "r20", type: "punctuation", severity: "tip", pattern: /\t| {2,}/g,
      title: "多余空格/制表符", explain: "文中存在连续空格或制表符，显得不整洁。", fix: "统一使用单个空格分隔单词。" },
    { id: "r21", type: "grammar", severity: "error", pattern: /\b(?:everyone|everybody)\s+(?:are|were|have)\b/gi,
      title: "主谓一致：everyone 接单数谓语", explain: "everyone/everybody 视为单数。", fix: "everyone is / everybody has。" },
    { id: "r22", type: "vocabulary", severity: "error", pattern: /\bmuch\s+(?:people|students|workers|jobs|companies|ways|things|problems|reasons|benefits|countries|cities|books|teachers)\b/gi,
      title: "much/many 误用", explain: "可数名词复数前用 many。", fix: "many people / many benefits。" },
    { id: "r23", type: "vocabulary", severity: "error", pattern: /\bmany\s+(?:money|time|information|work|progress|advice|traffic|equipment|water|knowledge)\b/gi,
      title: "many/much 误用", explain: "不可数名词前用 much。", fix: "much time / much information。" },
    { id: "r24", type: "vocabulary", severity: "error", pattern: /\bborrow\s+(?:me|him|her|us|them)\b/gi,
      title: "borrow/lend 混淆", explain: "borrow 是“借入”，lend 是“借出”。", fix: "lend me… / lend him…。" },
    { id: "r25", type: "vocabulary", severity: "tip", pattern: /\breturn\s+back\b|\brepeat\s+again\b/gi,
      title: "语义重复", explain: "return 已含“回来”义，repeat 已含“再次”义。", fix: "去掉 back / again。" },
    { id: "r26", type: "vocabulary", severity: "tip", pattern: /\bvery\s+(?:excellent|perfect|unique|essential|vital|crucial|terrible|awful|wonderful|fantastic|necessary|impossible)\b/gi,
      title: "very 修饰极限形容词", explain: "这些词本身已含极限义，一般不用 very 修饰。", fix: "直接用 excellent / crucial，或换 absolutely essential。" },
    { id: "r27", type: "grammar", severity: "error", pattern: /\bdidn'?t\s+(?:went|did|took|came|got|made|saw|said|wrote|knew|brought|bought|found|gave|thought)\b/gi,
      title: "didn't 后误用过去式", explain: "助动词 didn't 已表过去时，其后用动词原形。", fix: "didn't go / didn't take / didn't know。" },
    { id: "r28", type: "grammar", severity: "error", pattern: /\bgo(?:es|ing)?\s+to\s+(?:there|home|abroad)\b/gi,
      title: "副词前误加 to", explain: "there/home/abroad 是副词，前不加 to。", fix: "go there / go home / go abroad。" },
    { id: "r29", type: "grammar", severity: "warning", pattern: /\barrive(?:s|d)?\s+to\b/gi,
      title: "arrive 介词搭配错误", explain: "arrive 后接 in（大地方）或 at（小地方），不用 to。", fix: "arrive in Shanghai / arrive at the station。" },
    { id: "r30", type: "grammar", severity: "warning", pattern: /\bin\s+(?:nowadays|these\s+days)\b/gi,
      title: "in 与 nowadays 连用冗余", explain: "nowadays / these days 本身已表时间，前不加 in。", fix: "去掉 in。" },
    { id: "r31", type: "grammar", severity: "error", pattern: /\bone\s+of\s+the\s+(?:student|worker|company|job|person|reason|way|method|benefit|problem|factor)\b/gi,
      title: "one of the 后应用复数名词", explain: "one of the + 复数名词表示“……之一”。", fix: "one of the reasons / one of the most important factors。" },
    { id: "r32", type: "grammar", severity: "warning", pattern: /\b(?:last|next)\s+(?:years|days|weeks|months|nights)\b/gi,
      title: "last/next 后接单数时间名词", explain: "last/next 修饰的时间名词用单数。", fix: "last year / next week。" },
    { id: "r33", type: "grammar", severity: "error", pattern: /\b(?:he|she|it|the\s+\w+)\s+don'?t\b/gi,
      title: "don't/doesn't 误用", explain: "第三人称单数主语用 doesn't。", fix: "he doesn't / it doesn't。" },
    { id: "r34", type: "grammar", severity: "error", pattern: /\b(?:we|they|i|you)\s+doesn'?t\b/gi,
      title: "doesn't/don't 误用", explain: "非第三人称单数主语用 don't。", fix: "we don't / they don't。" },
    { id: "r35", type: "vocabulary", severity: "error", pattern: /\baccording\s+to\s+(?:me|my)\b/gi,
      title: "according to 搭配错误", explain: "according to 后接客观来源（报告/数据），表达个人观点用 in my opinion。", fix: "In my opinion, … / According to the chart, …" },
    { id: "r36", type: "vocabulary", severity: "tip", pattern: /\bin\s+my\s+opinion,?\s+i\s+think\b|\bi\s+think,?\s+in\s+my\s+opinion\b/gi,
      title: "观点表达冗余", explain: "In my opinion 与 I think 语义重复。", fix: "二者取其一。" },
    { id: "r37", type: "grammar", severity: "error", pattern: /\bwill\s+(?:went|did|came|took|got|made|saw|said|wrote)\b/gi,
      title: "will 后误用过去式", explain: "will 后用动词原形。", fix: "will go / will take。" },
    { id: "r38", type: "grammar", severity: "error", pattern: /\b(?:want|would\s+like|hope|plan|decide|try|need)s?\s+to\s+(?:going|doing|making|having|working)\b/gi,
      title: "to 后误用动名词", explain: "这些动词接 to do 不定式，to 后用动词原形。", fix: "want to do / plan to make。" },
    { id: "r39", type: "grammar", severity: "error", pattern: /\b(?:enjoy|enjoys|enjoyed|finish|finished|mind|avoid|avoided|practice|practiced|consider|considered)\s+to\s+(?!(?:the)\b)(\w+)\b/gi,
      title: "动名词作宾语误用", explain: "这些动词后接动名词 doing，不接 to do。", fix: "enjoy doing / avoid making / consider using。" },
    { id: "r40", type: "vocabulary", severity: "warning", pattern: /\b(?:open\s+the\s+computer|open\s+the\s+light|close\s+the\s+light|learn\s+knowledge|eat\s+medicine)\b/gi,
      title: "中式英语直译", explain: "这些搭配是中文直译，英语中有固定说法。", fix: "turn on the computer / turn on (off) the light / acquire (gain) knowledge / take medicine。" },
    { id: "r41", type: "style", severity: "tip", pattern: /\b(?:don'?t|can'?t|won'?t|isn'?t|aren'?t|it'?s|i'?m|you'?re|they'?re|we'?re|i'?ve|i'?ll)\b/gi,
      title: "口语缩写建议改写", explain: "正式写作（邮件/报告/议论文）中口语缩写显得随意，建议用完整形式。", fix: "do not / cannot / it is / I am…（引用原文语句时除外）。" }
  ];

  const CONNECTIVES = ["however", "moreover", "furthermore", "therefore", "consequently", "in addition",
    "additionally", "firstly", "first of all", "secondly", "thirdly", "finally", "on the one hand",
    "on the other hand", "in conclusion", "to sum up", "for example", "for instance", "as a result",
    "in contrast", "on the contrary", "meanwhile", "in other words", "what is more", "besides", "similarly", "thus"];
  const CONCLUSION_MARKERS = ["in conclusion", "to sum up", "in summary", "finally", "overall", "all in all", "in brief", "in a word"];
  const INTRO_MARKERS = ["nowadays", "in recent years", "with the development", "as is known", "in today's", "today,"];
  const TREND_WORDS = ["increas", "decreas", "ris", "fell", "fall", "grew", "grow", "climb", "declin", "drop",
    "reach", "peak", "fluctuat", "trend", "account for", "proportion", "percentage", "doubl", "tripl",
    "respectively", "compared with", "comparison", "remain", "surpass", "exceed"];
  const POLITE_MARKERS = ["thank", "could you", "i would", "appreciate", "look forward", "please", "grateful", "it would be"];

  function wordCount(text) {
    const t = String(text || "").trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function sentenceAt(text, index) {
    const t = String(text || "");
    let start = index, end = index;
    while (start > 0 && !/[.!?\n]/.test(t[start - 1])) start--;
    while (end < t.length && !/[.!?\n]/.test(t[end])) end++;
    return t.slice(start, end).trim();
  }

  function detectErrors(text) {
    const errors = [];
    for (const rule of RULES) {
      const re = new RegExp(rule.pattern.source, rule.pattern.flags);
      re.lastIndex = 0;
      let m, count = 0;
      while ((m = re.exec(text)) !== null && count < 8) {
        const quote = sentenceAt(text, m.index);
        errors.push({
          severity: rule.severity,
          title: rule.title,
          quote,
          explain: rule.explain,
          fix: rule.fix,
          ruleId: rule.id,
          ruleTitle: rule.title
        });
        count++;
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }
    return errors;
  }

  function scoreGrammar(text, words) {
    const errors = detectErrors(text);
    let penalty = 0, tipPenalty = 0, errCount = 0, warnCount = 0, tipCount = 0;
    const typeStat = {};
    for (const e of errors) {
      if (e.severity === "error") { penalty += 3; errCount++; }
      else if (e.severity === "warning") { penalty += 1.5; warnCount++; }
      else { tipPenalty += 0.4; tipCount++; }
      typeStat[e.ruleTitle] = (typeStat[e.ruleTitle] || 0) + 1;
    }
    penalty += Math.min(5, tipPenalty);

    // 词汇丰富度
    const tokens = text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];
    const types = new Set(tokens).size;
    const richness = tokens.length ? types / tokens.length : 1;
    let vocabPenalty = 0, vocabNote = "";
    if (words >= 60 && richness < 0.45) { vocabPenalty = 4; vocabNote = "用词重复度偏高（词汇丰富度 " + (richness * 100).toFixed(0) + "%），注意同义替换。"; }
    else if (words >= 60 && richness >= 0.55) { vocabNote = "用词有一定变化，继续保持同义替换意识。"; }

    let score = Math.max(20, Math.round(100 - penalty - vocabPenalty));
    const top = Object.entries(typeStat).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([k, v]) => k + " ×" + v).join("；");
    let comment = "检测到错误 " + errCount + " 处、提醒 " + warnCount + " 处、小建议 " + tipCount + " 处。";
    if (top) comment += " 主要问题：" + top + "。";
    if (vocabNote) comment += " " + vocabNote;
    if (!errCount && !warnCount) comment = "未检测到明显语法/用词硬伤。" + (vocabNote ? " " + vocabNote : " 但注意句型的多样性仍可加强。");
    return { score, comment, errors };
  }

  function scoreOrganization(text) {
    const lines = text.split(/\n+/).map(s => s.trim()).filter(s => s.length > 0);
    const paras = lines.length;
    let base = paras >= 3 ? 90 : paras === 2 ? 65 : 40;

    const lower = text.toLowerCase();
    const words = wordCount(text) || 1;
    let connCount = 0;
    for (const c of CONNECTIVES) {
      const re = new RegExp("\\b" + c.replace(/ /g, "\\s+") + "\\b", "g");
      const mm = lower.match(re);
      if (mm) connCount += mm.length;
    }
    const density = connCount / (words / 100);
    let plus = 0, note = "";
    if (density >= 2) { plus += 10; note = "衔接词密度 " + density.toFixed(1) + " 个/百词，衔接意识较好。"; }
    else if (density >= 1) { plus += 5; note = "衔接词密度 " + density.toFixed(1) + " 个/百词，勉强够用，还可加强。"; }
    else { note = "全文几乎未使用衔接词（however/moreover/in conclusion 等），段落之间逻辑衔接弱。"; }

    const hasConcl = CONCLUSION_MARKERS.some(m => lower.includes(m));
    const hasIntro = INTRO_MARKERS.some(m => lower.includes(m));
    if (hasConcl) { plus += 10; note += " 有结论性收尾。"; } else { note += " 缺少明确收尾段。"; }
    if (hasIntro) plus += 5;

    const score = Math.max(25, Math.min(100, base + plus));
    let comment = "全文 " + paras + " 个段落。" + (paras < 3 ? " 段落偏少，正文建议 3-5 段（开头点题—主体分层—结尾总结）。" : "") + " " + note;
    return { score, comment, paras, density };
  }

  function scoreFormat(text, q) {
    const wc = wordCount(text);
    const ratio = q.minWords ? wc / q.minWords : 1;
    let score;
    if (ratio >= 1) score = Math.min(100, 80 + Math.round((ratio - 1) * 40));
    else if (ratio >= 0.8) score = 65;
    else if (ratio >= 0.5) score = 45;
    else score = 25;

    const genre = String(q.genre || "").toLowerCase();
    let comment = "字数 " + wc + "（要求 ≥" + q.minWords + "）。";
    if (ratio >= 1.5) comment += " 字数超出要求较多，篇幅冗长也会影响信息密度。";
    else if (ratio >= 1) comment += " 字数达标。";
    else if (ratio >= 0.8) comment += " 字数略不足，建议补足到 " + q.minWords + " 词以上。";
    else comment += " 字数严重不足（缺口约 " + Math.max(0, q.minWords - wc) + " 词），按评分标准将被扣分。";

    if (genre.includes("邮件") || genre.includes("email") || genre.includes("letter") || genre.includes("信")) {
      const hasGreet = /\bDear\b/i.test(text);
      const hasClose = /(Sincerely|Yours\s+(faithfully|sincerely|truly)|Best\s+regards|Regards|Kind\s+regards)/i.test(text);
      if (hasGreet) score = Math.min(100, score + 4);
      if (hasClose) score = Math.min(100, score + 4);
      if (!hasGreet) comment += " 邮件缺少称呼（Dear…）。";
      if (!hasClose) comment += " 邮件缺少结束语（Sincerely / Best regards 等）。";
    }
    if (genre.includes("议论文") || genre.includes("essay")) {
      const firstLine = (text.split(/\n+/)[0] || "").trim();
      const looksTitle = firstLine.length > 0 && firstLine.length < 80 && !/[.!?]$/.test(firstLine) && firstLine.split(/\s+/).length <= 12;
      if (looksTitle) { score = Math.min(100, score + 3); }
      else comment += " 议论文应自拟标题（首行），未见明显标题。";
    }
    score = Math.max(10, Math.min(100, score));
    return { score, comment, wc };
  }

  function scoreContent(text, q) {
    const wc = wordCount(text);
    const lower = text.toLowerCase();
    const kws = Array.isArray(q.keywords) ? q.keywords : [];
    const hits = kws.filter(k => lower.includes(String(k).toLowerCase()));
    let coverage = kws.length ? hits.length / kws.length : 0.6;

    let factor = 1, notes = [];
    if (q.qtype === "看图表信息写作") {
      const trendCount = TREND_WORDS.filter(w => lower.includes(w)).length;
      if (trendCount === 0) { factor *= 0.7; notes.push("图表题未见任何趋势/占比表达（increase、decline、account for 等），未体现数据描述能力。"); }
      else if (trendCount < 3) { factor *= 0.85; notes.push("图表趋势表达偏少（约 " + trendCount + " 类），数据描述不足。"); }
      else notes.push("使用了 " + trendCount + " 类趋势/占比表达，数据描述意识较好。");
    }
    if (q.qtype === "看文字信息写作" || q.qtype === "应用文写作" || /邮件|email|letter|信/.test(String(q.genre || ""))) {
      const polite = POLITE_MARKERS.some(m => lower.includes(m));
      if (!polite) { factor *= 0.9; notes.push("职场应用文缺少礼貌/客套表达（thank、appreciate、look forward to 等）。"); }
    }
    const completeness = 0.5 + 0.5 * Math.min(1, q.minWords ? wc / q.minWords : 1);
    let score = Math.round(100 * coverage * factor * completeness);
    score = Math.max(10, Math.min(100, score));

    let comment = "主题词覆盖 " + hits.length + "/" + kws.length + "（命中：" + (hits.slice(0, 5).join(", ") || "无") + "）。";
    if (coverage < 0.6) comment += " 与题目主题契合度不足，注意逐条回应题目要求。";
    if (completeness < 1) comment += " 因篇幅不足，信息完整性按比例下调。";
    if (notes.length) comment += " " + notes.join("");
    return { score, comment, hits, coverage };
  }

  function buildSuggestions(q, dims, text, extra) {
    const s = [];
    const wc = wordCount(text);
    if (wc < q.minWords) {
      s.push("字数未达标：" + wc + "/" + q.minWords + "。先补足篇幅——" + (q.qtype === "看图表信息写作"
        ? "按“描述图表→分析数据→评论建议”三块各写约 100 词"
        : "把每个要点展开：观点 + 1 个例子或数据 + 1 句收束") + "。");
    }
    const typeStat = {};
    for (const e of extra.errors || []) if (e.severity !== "tip") typeStat[e.ruleTitle] = (typeStat[e.ruleTitle] || 0) + 1;
    const top = Object.entries(typeStat).sort((a, b) => b[1] - a[1])[0];
    if (top) s.push("最高频问题：" + top[0] + "（" + top[1] + " 次）。交卷前专查这一类：每写完一句回头确认该规则是否满足。");
    if (dims.content.coverage < 0.6) s.push("切题度不足：对照题目材料逐条勾选要点，写一个要点划一个，避免空泛套话。");
    if (dims.organization.paras < 3) s.push("全文只有 " + dims.organization.paras + " 个段落。按“开头点题—2~3 个主体段—结论”重构，每段一个中心句。");
    if (dims.organization.density < 1) s.push("衔接词几乎为零：刻意加入 however / moreover / as a result / in conclusion 等，让阅卷老师看到清晰的逻辑链条。");
    if (dims.format.wc > q.minWords * 1.5) s.push("篇幅冗余（" + wc + " 词）：删掉重复论述与万能句，把字数用在具体数据、例子和论证上。");
    if (s.length < 4) {
      s.push("结构已成型，但距高分还差“证据感”：每个论点至少配 1 个具体例子/数据/对比，避免只用道理堆砌。");
      s.push("交卷前 2 分钟做三查：① 主语单复数与动词形式 ② 标点后空格与 I 大写 ③ 字数是否达标。");
    }
    if (s.length < 4) s.push("对照参考范文，圈出 3 处你想到但没写出来的表达，摘抄到自己的语料本。");
    return s.slice(0, 6);
  }

  function mockScore(text, q) {
    const g = scoreGrammar(text, wordCount(text));
    const o = scoreOrganization(text);
    const f = scoreFormat(text, q);
    const c = scoreContent(text, q);
    const dims = {
      content: { score: c.score, comment: c.comment, coverage: c.coverage },
      grammar: { score: g.score, comment: g.comment },
      organization: { score: o.score, comment: o.comment, paras: o.paras, density: o.density },
      format: { score: f.score, comment: f.comment, wc: f.wc }
    };
    const w = q.scoringWeights || { content: 35, grammar: 30, organization: 25, format: 10 };
    const total = Math.round((c.score * w.content + g.score * w.grammar + o.score * w.organization + f.score * w.format) / 100);
    const grade = total >= 85 ? "A" : total >= 70 ? "B" : total >= 55 ? "C" : "D";
    const suggestions = buildSuggestions(q, dims, text, { errors: g.errors });
    return { dimensions: dims, total, grade, errors: g.errors, suggestions, mode: "mock" };
  }

  /* ================= 真实 AI 适配器（接入点） =================
     调用 OpenAI 兼容的 chat/completions 接口。
     配置位于 js/config.js（mockMode: false 时启用）。
     任何支持该协议的模型（DeepSeek / GLM / 通义 / Gemini / OpenRouter）均可接入。 */
  const SYSTEM_PROMPT =
    "你是一名严格的全国职业院校英语写作大赛阅卷专家。请按以下官方四维标准为考生作文打分（每维 0-100 分），" +
    "并给出理性、客观、具体的批改意见。语气像严格的阅卷老师：不吹捧、不敷衍，直接指出问题。" +
    "\n评分标准：1. 内容与切题 35%（观点/信息是否完整、切题）；2. 语法与词汇 30%（语法准确、用词准确恰当多样）；" +
    "3. 组织与连贯 25%（逻辑严密、篇章连贯、衔接自然）；4. 格式与字数 10%（格式正确、字数达标）。" +
    "\n批改要求：逐条指出语法错误、用词不当、句子结构问题、标点错误；每条必须引用考生作文中的原句或短语（quote 字段），" +
    "说明错在哪、为什么错、如何改（explanation/fix 字段）。每维给出具体、可操作的点评，不写空话。给出 3-6 条整体提升建议。" +
    "\n只输出 JSON（不要 markdown 代码块），结构如下：" +
    '{"dimensions":{"content":{"score":0,"comment":""},"grammar":{"score":0,"comment":""},"organization":{"score":0,"comment":""},"format":{"score":0,"comment":""}},' +
    '"errors":[{"severity":"error|warning|tip","quote":"原文","explanation":"为什么错","fix":"怎么改"}],"suggestions":["..."]}';

  async function callRealAI(text, q) {
    const cfg = (window.APP_CONFIG && window.APP_CONFIG.api) || {};
    if (!cfg.endpoint || !cfg.apiKey) throw new Error("AI 接口未配置（endpoint/apiKey 为空）");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs || 60000);
    try {
      const resp = await fetch(cfg.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + cfg.apiKey },
        body: JSON.stringify({
          model: cfg.model || "deepseek-chat",
          temperature: cfg.temperature != null ? cfg.temperature : 0.3,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify({ question: { title: q.title, qtype: q.qtype, minWords: q.minWords, materials: q.materials, genre: q.genre, keywords: q.keywords }, essay: text }) }
          ]
        }),
        signal: controller.signal
      });
      if (!resp.ok) throw new Error("AI 接口返回 " + resp.status);
      const data = await resp.json();
      let raw = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content : "";
      raw = String(raw).replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(raw);
      const w = q.scoringWeights || { content: 35, grammar: 30, organization: 25, format: 10 };
      const dims = {};
      for (const k of ["content", "grammar", "organization", "format"]) {
        const d = parsed.dimensions[k] || { score: 0, comment: "" };
        dims[k] = { score: Math.max(0, Math.min(100, Number(d.score) || 0)), comment: String(d.comment || "") };
      }
      const total = Math.round((dims.content.score * w.content + dims.grammar.score * w.grammar + dims.organization.score * w.organization + dims.format.score * w.format) / 100);
      const grade = total >= 85 ? "A" : total >= 70 ? "B" : total >= 55 ? "C" : "D";
      return {
        dimensions: dims, total, grade,
        errors: Array.isArray(parsed.errors) ? parsed.errors.map(e => ({
          severity: ["error", "warning", "tip"].includes(e.severity) ? e.severity : "warning",
          title: "", quote: String(e.quote || ""), explain: String(e.explanation || ""), fix: String(e.fix || "")
        })) : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String).slice(0, 6) : [],
        mode: "ai"
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /* 统一入口：真实 AI 失败时自动回退到模拟评分并注明原因 */
  async function scoreEssay(text, question) {
    const cfg = window.APP_CONFIG || {};
    if (cfg.mockMode === false) {
      try {
        return await callRealAI(text, question);
      } catch (err) {
        const r = mockScore(text, question);
        r.mode = "mock-fallback";
        r.fallbackReason = "AI 接口调用失败（" + (err && err.message ? err.message : "未知错误") + "），已回退到本地模拟评分。请检查 js/config.js 配置。";
        return r;
      }
    }
    return mockScore(text, question);
  }

  window.Scorer = { scoreEssay, wordCount, mockScore };
})();
