/* ============================================================
   题库首页：加载题目、筛选、渲染卡片、统计
   ============================================================ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = { stage: "全部", type: "全部", diff: "全部", theme: "全部", search: "" };

  let QUESTIONS = [];

  function getHistory() {
    try { return JSON.parse(localStorage.getItem("wa_history") || "[]"); }
    catch { return []; }
  }

  async function loadQuestions() {
    // 优先尝试读取 data/questions.json（本地服务器或 GitHub Pages 场景）；
    // file:// 双击打开时 fetch 受限，回退到内嵌的 window.QUESTIONS。
    try {
      const r = await fetch("data/questions.json");
      if (r.ok) { QUESTIONS = await r.json(); return; }
    } catch (e) { /* 回退 */ }
    QUESTIONS = Array.isArray(window.QUESTIONS) ? window.QUESTIONS : [];
  }

  function doneIds() {
    return new Set(getHistory().map(h => h.qid));
  }

  function renderStats() {
    const h = getHistory();
    const done = doneIds();
    $("statTotal").textContent = QUESTIONS.length;
    $("statDone").textContent = done.size;
    $("statTimes").textContent = h.length;
    $("statAvg").textContent = h.length
      ? Math.round(h.reduce((a, b) => a + (b.total || 0), 0) / h.length)
      : "–";
  }

  function renderThemeOptions() {
    const themes = [...new Set(QUESTIONS.map(q => q.theme).filter(Boolean))].sort();
    const sel = $("fTheme");
    sel.innerHTML = '<option value="全部">全部</option>' +
      themes.map(t => `<option value="${t.replace(/"/g, "&quot;")}">${t}</option>`).join("");
    sel.value = state.theme;
  }

  function matches(q) {
    if (state.stage !== "全部" && q.stage !== state.stage) return false;
    if (state.type !== "全部" && q.qtype !== state.type) return false;
    if (state.diff !== "全部" && q.difficulty !== state.diff) return false;
    if (state.theme !== "全部" && q.theme !== state.theme) return false;
    if (state.search) {
      const s = state.search.toLowerCase();
      const hay = (q.title + " " + (q.theme || "") + " " + (q.genre || "")).toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  }

  function renderGrid() {
    const done = doneIds();
    const list = QUESTIONS.filter(matches);
    $("qEmpty").classList.toggle("hidden", list.length > 0);
    $("qGrid").innerHTML = list.map(q => {
      const d = done.has(q.id) ? '<span class="badge done">已练过</span>' : "";
      return `<div class="qcard" data-id="${q.id}">
        <div class="qtitle">${esc(q.title)}</div>
        <div class="qmeta">${esc(q.stage)} · ${esc(q.qtype)} · ≥${q.minWords} 词 · 限时 ${q.timeLimitMin} 分钟</div>
        <div class="badges">
          <span class="badge">${esc(q.theme || "综合")}</span>
          <span class="badge diff-${esc(q.difficulty)}">${esc(q.difficulty)}</span>
          ${d}
        </div>
      </div>`;
    }).join("");
    $("qGrid").querySelectorAll(".qcard").forEach(el => {
      el.addEventListener("click", () => { location.href = "practice.html?id=" + encodeURIComponent(el.dataset.id); });
    });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function bindChips(groupId, key) {
    $(groupId).addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      $(groupId).querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      state[key] = btn.dataset.v;
      renderGrid();
    });
  }

  function init() {
    bindChips("fStage", "stage");
    bindChips("fType", "type");
    bindChips("fDiff", "diff");
    $("fTheme").addEventListener("change", (e) => { state.theme = e.target.value; renderGrid(); });
    $("fSearch").addEventListener("input", (e) => { state.search = e.target.value.trim(); renderGrid(); });
  }

  (async function main() {
    init();
    await loadQuestions();
    renderThemeOptions();
    renderStats();
    renderGrid();
  })();
})();
