/* ============================================================
   作答页：加载题目、倒计时、字数统计、草稿自动保存、提交判分
   ============================================================ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const qid = new URLSearchParams(location.search).get("id");

  let QUESTION = null;
  let totalSec = 0, remainSec = 0, timerId = null, submitted = false;
  let lastSavedText = "";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  async function loadQuestions() {
    try {
      const r = await fetch("data/questions.json");
      if (r.ok) return await r.json();
    } catch (e) { /* 回退内嵌数据 */ }
    return Array.isArray(window.QUESTIONS) ? window.QUESTIONS : [];
  }

  function fmt(s) {
    const m = Math.floor(s / 60), sec = s % 60;
    return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
  }

  function updateCounters() {
    const text = $("essay").value;
    const t = text.trim();
    const words = t ? t.split(/\s+/).length : 0;
    $("wcNow").textContent = words;
    $("ccNow").textContent = text.length;
    const st = $("wcStatus");
    if (words >= QUESTION.minWords) { st.textContent = "已达标 ✓"; st.className = "ok"; }
    else { st.textContent = "未达标（差 " + (QUESTION.minWords - words) + " 词）"; st.className = "bad"; }
  }

  function renderQuestion(q) {
    $("qLoading").remove();
    const panel = $("qPanel");
    const badges = [
      `<span class="badge">${esc(q.stage)}</span>`,
      `<span class="badge type-b">${esc(q.qtype)}</span>`,
      `<span class="badge diff-${esc(q.difficulty)}">${esc(q.difficulty)}</span>`,
      `<span class="badge">${esc(q.theme || "综合")}</span>`
    ].join("");
    const chartHtml = q.chart
      ? `<div class="block-label">📊 图表信息</div><div class="chart-box"><div id="chartBox"></div></div>`
      : "";
    panel.innerHTML = `
      <h1 class="qtitle">${esc(q.title)}</h1>
      <div class="badges">${badges}</div>
      <div class="meta-line">限时 ${q.timeLimitMin} 分钟 · 目标 ≥${q.minWords} 词 · 评分四维：内容切题 ${q.scoringWeights.content}% / 语法词汇 ${q.scoringWeights.grammar}% / 组织连贯 ${q.scoringWeights.organization}% / 格式字数 ${q.scoringWeights.format}%</div>
      <div class="block-label">📄 题目材料</div>
      <div class="materials">${esc(q.materials)}</div>
      <div class="block-label">✏️ 体裁说明</div>
      <div class="materials" style="max-height:none">${esc(q.genre)}</div>
      ${chartHtml}
      ${q.tips ? `<div class="block-label">💡 写作提示</div><ul class="tips-list">${q.tips.split("\n").filter(Boolean).map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    `;
    if (q.chart) {
      const def = typeof q.chart === "string" ? JSON.parse(q.chart) : q.chart;
      window.Charts.render(document.getElementById("chartBox"), def);
    }
    $("minWordsTxt").textContent = q.minWords;
    $("wcTarget").textContent = q.minWords;
    $("limitTxt").textContent = q.timeLimitMin;
  }

  function startTimer() {
    totalSec = QUESTION.timeLimitMin * 60;
    remainSec = totalSec;
    renderTimer();
    timerId = setInterval(() => {
      if (submitted) return;
      remainSec--;
      if (remainSec <= 0) {
        clearInterval(timerId);
        renderTimer();
        autoSubmit();
        return;
      }
      renderTimer();
    }, 1000);
  }

  function renderTimer() {
    const el = $("timer");
    el.textContent = fmt(Math.max(0, remainSec));
    el.className = "timer" + (remainSec <= 60 ? " warn" : "") + (remainSec <= 0 ? " over" : "");
    if (remainSec <= 60 && remainSec > 0) $("timerLbl").textContent = "⏰ 最后一分钟！";
    else if (remainSec <= 0) $("timerLbl").textContent = "时间到，自动交卷";
    else $("timerLbl").textContent = "剩余时间";
  }

  function saveDraft(showNote) {
    localStorage.setItem("wa_draft_" + qid, $("essay").value);
    lastSavedText = $("essay").value;
    if (showNote) {
      const n = $("draftNote");
      n.textContent = "✓ 草稿已保存到本机（" + new Date().toLocaleTimeString("zh-CN") + "）";
      setTimeout(() => { if (n.textContent.startsWith("✓")) n.textContent = ""; }, 2500);
    }
  }

  function restoreDraft() {
    const d = localStorage.getItem("wa_draft_" + qid);
    if (d) {
      $("essay").value = d;
      lastSavedText = d;
      $("draftNote").textContent = "已恢复上次未交卷的草稿（本机保存）。";
      updateCounters();
    }
  }

  function autoSubmit() {
    if (submitted) return;
    submitted = true;
    doScore("⏰ 时间到，系统已自动交卷");
  }

  function appendHistory(entry) {
    let list;
    try { list = JSON.parse(localStorage.getItem("wa_history") || "[]"); }
    catch { list = []; }
    list.push(entry);
    if (list.length > 200) list = list.slice(list.length - 200);
    localStorage.setItem("wa_history", JSON.stringify(list));
    return list.length - 1;
  }

  async function doScore(notice) {
    const overlay = $("loadingOverlay");
    overlay.classList.remove("hidden");
    $("loadingText").textContent = notice || "AI 阅卷中，请稍候…";
    const text = $("essay").value;
    const timeUsed = totalSec - Math.max(0, remainSec);
    try {
      const result = await window.Scorer.scoreEssay(text, QUESTION);
      const entry = {
        qid: QUESTION.id,
        essay: text,
        title: QUESTION.title,
        stage: QUESTION.stage,
        qtype: QUESTION.qtype,
        date: new Date().toISOString(),
        wordCount: window.Scorer.wordCount(text),
        minWords: QUESTION.minWords,
        timeUsedSec: timeUsed,
        timeLimitSec: totalSec,
        total: result.total,
        grade: result.grade,
        mode: result.mode,
        dimensions: result.dimensions,
        errors: result.errors || [],
        suggestions: result.suggestions || [],
        fallbackReason: result.fallbackReason || ""
      };
      const idx = appendHistory(entry);
      localStorage.removeItem("wa_draft_" + qid);
      location.href = "result.html?i=" + idx;
    } catch (err) {
      overlay.classList.add("hidden");
      alert("判分出现异常：" + (err && err.message ? err.message : err) + "\n请重试或改用模拟评分模式（js/config.js 中 mockMode: true）。");
      submitted = false;
    }
  }

  function init() {
    if (!qid) {
      $("qPanel").innerHTML = '<div class="empty-tip">缺少题目参数，请从 <a href="./index.html">题库</a> 进入。</div>';
      return;
    }
    $("essay").addEventListener("input", updateCounters);
    $("btnSave").addEventListener("click", () => saveDraft(true));
    $("btnClearDraft").addEventListener("click", () => {
      if (confirm("确定清空当前草稿？此操作不可撤销。")) {
        $("essay").value = "";
        localStorage.removeItem("wa_draft_" + qid);
        updateCounters();
      }
    });

    const dialog = $("confirmDialog");
    $("btnSubmit").addEventListener("click", () => {
      const words = window.Scorer.wordCount($("essay").value);
      $("confirmText").textContent = "当前 " + words + " 词（要求 ≥" + QUESTION.minWords + " 词），剩余 " + fmt(Math.max(0, remainSec)) + "。提交后将立即判分，交卷后不可修改。";
      dialog.showModal();
    });
    $("confirmCancel").addEventListener("click", () => dialog.close());
    $("confirmOk").addEventListener("click", () => {
      dialog.close();
      if (submitted) return;
      submitted = true;
      clearInterval(timerId);
      doScore();
    });

    // 每 30 秒自动保存草稿
    setInterval(() => {
      if (submitted) return;
      if ($("essay").value !== lastSavedText) saveDraft(false);
    }, 30000);
    window.addEventListener("beforeunload", (e) => {
      if (!submitted && $("essay").value !== lastSavedText && $("essay").value.trim()) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  (async function main() {
    init();
    const list = await loadQuestions();
    QUESTION = list.find(q => q.id === qid);
    if (!QUESTION) {
      $("qPanel").innerHTML = '<div class="empty-tip">题目不存在（id: ' + esc(qid) + '），可能题库数据未更新。请回到 <a href="./index.html">题库</a>。</div>';
      return;
    }
    renderQuestion(QUESTION);
    restoreDraft();
    updateCounters();
    startTimer();
  })();
})();
