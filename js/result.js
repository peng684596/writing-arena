/* ============================================================
   判分结果页：四维分、逐条批改、点评、建议、范文对比
   ============================================================ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const i = new URLSearchParams(location.search).get("i");

  let ENTRY = null, QUESTION = null;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem("wa_history") || "[]"); }
    catch { return []; }
  }

  async function loadQuestions() {
    try {
      const r = await fetch("data/questions.json");
      if (r.ok) return await r.json();
    } catch (e) { /* 回退 */ }
    return Array.isArray(window.QUESTIONS) ? window.QUESTIONS : [];
  }

  function fmtTime(s) {
    s = s || 0;
    const m = Math.floor(s / 60), sec = s % 60;
    return m + " 分 " + String(sec).padStart(2, "0") + " 秒";
  }

  function modeBadge(mode) {
    if (mode === "ai") {
      const bits = [];
      if (ENTRY.model) bits.push(ENTRY.model);
      if (ENTRY.elapsedMs) bits.push((ENTRY.elapsedMs / 1000).toFixed(1) + "s");
      if (ENTRY.usage && ENTRY.usage.total_tokens) bits.push("消耗 " + ENTRY.usage.total_tokens + " tokens");
      return '<span class="mode-badge">🤖 AI 评分' + (bits.length ? "（" + esc(bits.join(" · ")) + "）" : "") + "</span>";
    }
    if (mode === "mock-fallback") return '<span class="mode-badge">⚠ 模拟评分（AI 调用失败已回退）</span>';
    return '<span class="mode-badge">🧪 模拟评分（演示版）</span>';
  }

  const DIM_LABELS = {
    content: ["内容与切题", 35], grammar: ["语法与词汇", 30],
    organization: ["组织与连贯", 25], format: ["格式与字数", 10]
  };

  function render() {
    const root = $("resultRoot");
    if (!ENTRY) {
      root.innerHTML = '<div class="empty-tip">没有找到判分结果。请先在 <a href="./index.html">题库</a> 中完成一次作答。</div>';
      return;
    }
    const w = QUESTION && QUESTION.scoringWeights ? QUESTION.scoringWeights : { content: 35, grammar: 30, organization: 25, format: 10 };
    const d = ENTRY.dimensions || {};
    const dimsHtml = Object.keys(DIM_LABELS).map(k => {
      const v = d[k] || { score: 0, comment: "" };
      const label = DIM_LABELS[k][0];
      return `<div class="dim">
        <div class="dim-head"><span class="dim-name">${label}（${w[k] || DIM_LABELS[k][1]}%）</span><span class="dim-score">${v.score}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, Math.min(100, v.score))}%"></div></div>
        <div class="dim-comment">${esc(v.comment || "")}</div>
      </div>`;
    }).join("");

    const errs = (ENTRY.errors || []).filter(e => e.quote || e.explain || e.fix);
    const errsHtml = errs.length
      ? errs.map(e => `
        <div class="err-item sev-${esc(e.severity || "warning")}">
          <div class="err-head">
            <span class="err-tag sev-${esc(e.severity || "warning")}">${e.severity === "error" ? "错误" : e.severity === "warning" ? "提醒" : "小建议"}</span>
            ${e.title ? `<span class="err-title">${esc(e.title)}</span>` : ""}
          </div>
          ${e.quote ? `<div class="err-quote">${esc(e.quote)}</div>` : ""}
          ${e.explain ? `<div class="err-explain">❓ 为什么错：${esc(e.explain)}</div>` : ""}
          ${e.fix ? `<div class="err-fix">✅ 怎么改：<b>${esc(e.fix)}</b></div>` : ""}
        </div>`).join("")
      : '<p class="timer-lbl">未检测到明显的语法/用词硬伤。但这不代表满分——请对照范文检查表达的地道性与句型的多样性。</p>';

    const suggHtml = (ENTRY.suggestions || []).length
      ? `<ol class="suggest-list">${ENTRY.suggestions.map(s => `<li>${esc(s)}</li>`).join("")}</ol>`
      : '<p class="timer-lbl">无</p>';

    const modelAnswer = QUESTION && QUESTION.modelAnswer ? QUESTION.modelAnswer : "";
    const modelHtml = modelAnswer
      ? `<div class="reveal-zone" id="modelZone"><button class="btn primary" id="btnModel">📖 显示参考范文（判分后供对比学习）</button></div>`
      : '<p class="timer-lbl">本题暂无参考范文。</p>';

    root.innerHTML = `
      <section class="card">
        <div class="score-head">
          <div class="score-total">
            <div class="big">${ENTRY.total}</div>
            <span class="grade g-${ENTRY.grade}">${ENTRY.grade}</span>
          </div>
          <div class="score-meta">
            <div><b>${esc(ENTRY.title)}</b></div>
            <div>${esc(ENTRY.stage || "")} · ${esc(ENTRY.qtype || "")} · ${new Date(ENTRY.date).toLocaleString("zh-CN")}</div>
            <div>字数 ${ENTRY.wordCount}（要求 ≥${ENTRY.minWords}） · 用时 ${fmtTime(ENTRY.timeUsedSec)} / 限时 ${fmtTime(ENTRY.timeLimitSec)}</div>
            <div style="margin-top:4px">${modeBadge(ENTRY.mode)}</div>
          </div>
        </div>
        ${ENTRY.fallbackReason ? `<p class="timer-lbl" style="margin-top:10px">${esc(ENTRY.fallbackReason)}</p>` : ""}
        <p class="timer-lbl" style="margin-top:10px">总分 = 内容与切题×${w.content}% + 语法与词汇×${w.grammar}% + 组织与连贯×${w.organization}% + 格式与字数×${w.format}%（官方四维标准）。</p>
      </section>

      <section class="card">
        <h2 class="sec-title">四维分项得分</h2>
        <div class="dims">${dimsHtml}</div>
      </section>

      <section class="card">
        <h2 class="sec-title">逐条批改（${errs.length} 条）</h2>
        ${errsHtml}
      </section>

      <section class="card">
        <h2 class="sec-title">整体提升建议</h2>
        ${suggHtml}
      </section>

      <section class="card">
        <h2 class="sec-title">我的作文</h2>
        <details><summary style="cursor:pointer;font-size:13.5px;color:var(--muted)">展开查看我的作答</summary>
        <div class="my-essay" style="margin-top:8px">${esc(ENTRY.essay || "（未保存正文）")}</div></details>
      </section>

      <section class="card">
        <h2 class="sec-title">参考范文</h2>
        ${modelHtml}
      </section>

      <div class="actions" style="margin-top:4px">
        <a class="btn" href="./index.html">← 返回题库</a>
        <a class="btn" href="./history.html">📈 学习记录</a>
        <button class="btn" id="btnAgain">🎲 再来一道同类题</button>
      </div>
    `;

    if (modelAnswer) {
      $("btnModel").addEventListener("click", () => {
        $("modelZone").innerHTML = '<div class="model-answer">' + esc(modelAnswer) + "</div>";
      });
    }
    $("btnAgain").addEventListener("click", async () => {
      const list = await loadQuestions();
      const pool = list.filter(q => q.qtype === ENTRY.qtype && q.id !== ENTRY.qid);
      const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : list[0];
      if (pick) location.href = "practice.html?id=" + encodeURIComponent(pick.id);
    });
  }

  (async function main() {
    const hist = getHistory();
    const idx = Number(i);
    ENTRY = (Number.isInteger(idx) && hist[idx]) ? hist[idx] : null;
    if (ENTRY) {
      const list = await loadQuestions();
      QUESTION = list.find(q => q.id === ENTRY.qid) || null;
    }
    render();
  })();
})();
