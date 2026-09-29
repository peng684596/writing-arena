/* ============================================================
   学习记录页：统计、进步曲线（SVG）、作答明细、导出/清空
   ============================================================ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem("wa_history") || "[]"); }
    catch { return []; }
  }

  function fmtTime(s) {
    s = s || 0;
    const m = Math.floor(s / 60), sec = s % 60;
    return m + "′" + String(sec).padStart(2, "0") + "″";
  }

  function renderStats(h) {
    $("stTimes").textContent = h.length;
    $("stAvg").textContent = h.length ? Math.round(h.reduce((a, b) => a + (b.total || 0), 0) / h.length) : "–";
    $("stBest").textContent = h.length ? Math.max(...h.map(x => x.total || 0)) : "–";
    $("stRecent").textContent = h.length ? h[h.length - 1].total : "–";
  }

  function renderTrend(h) {
    const box = $("trendChart"), note = $("trendNote");
    if (h.length < 2) {
      box.innerHTML = "";
      note.textContent = "至少完成 2 次作答后才能看到进步曲线。";
      return;
    }
    note.textContent = "横轴为作答次序，纵轴为总分（虚线为等级线：A≥85 / B≥70 / C≥55）。";
    const W = 720, H = 300, L = 46, R = 20, T = 16, B = 40;
    const pw = W - L - R, ph = H - T - B;
    const ys = h.map(x => x.total || 0);
    const pts = ys.map((v, idx) => {
      const x = L + (h.length === 1 ? pw / 2 : (pw * idx) / (h.length - 1));
      const y = T + ph - (Math.min(100, Math.max(0, v)) / 100) * ph;
      return [x.toFixed(1), y.toFixed(1)];
    });
    let grid = "";
    for (const g of [55, 70, 85]) {
      const y = T + ph - (g / 100) * ph;
      grid += `<line x1="${L}" y1="${y}" x2="${W - R}" y2="${y}" stroke="#e6ebf1" stroke-dasharray="5,4"/>
        <text x="${L - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#5c6b7c">${g}</text>`;
    }
    const line = `<polyline points="${pts.join(" ")}" fill="none" stroke="#1f4e8c" stroke-width="2.5" stroke-linejoin="round"/>`;
    const dots = pts.map(([x, y], idx) =>
      `<circle cx="${x}" cy="${y}" r="4" fill="#fff" stroke="#1f4e8c" stroke-width="2"><title>第 ${idx + 1} 次：${ys[idx]} 分</title></circle>`).join("");
    const labels = `<text x="${L}" y="${H - 12}" font-size="11" fill="#5c6b7c">第 1 次</text>
      <text x="${W - R}" y="${H - 12}" text-anchor="end" font-size="11" fill="#5c6b7c">第 ${h.length} 次</text>`;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="总分趋势图">${grid}${line}${dots}${labels}</svg>`;
  }

  function renderTable(h) {
    const tbody = $("historyBody");
    $("historyEmpty").classList.toggle("hidden", h.length > 0);
    if (!h.length) { tbody.innerHTML = ""; return; }
    const rows = [];
    for (let idx = h.length - 1; idx >= 0; idx--) {
      const x = h[idx];
      const d = x.dimensions || {};
      const dims = ["content", "grammar", "organization", "format"]
        .map(k => (d[k] ? d[k].score : "–")).join(" / ");
      rows.push(`<tr>
        <td style="white-space:nowrap">${new Date(x.date).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
        <td>${esc(x.title)}</td>
        <td style="white-space:nowrap">${esc(x.qtype || "")}</td>
        <td>${x.wordCount}/${x.minWords}</td>
        <td style="white-space:nowrap">${fmtTime(x.timeUsedSec)}</td>
        <td><b>${x.total}</b> ${x.grade}</td>
        <td class="dims-cell">${dims}</td>
        <td><button class="btn sm" data-i="${idx}">查看</button></td>
      </tr>`);
    }
    tbody.innerHTML = rows.join("");
    tbody.querySelectorAll("button[data-i]").forEach(b => {
      b.addEventListener("click", () => { location.href = "result.html?i=" + b.dataset.i; });
    });
  }

  function init() {
    const h = getHistory();
    renderStats(h);
    renderTrend(h);
    renderTable(h);

    $("btnExport").addEventListener("click", () => {
      if (!h.length) { alert("暂无记录可导出。"); return; }
      const blob = new Blob([JSON.stringify(h, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "wa_history_" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    $("btnClear").addEventListener("click", () => {
      if (!h.length) return;
      if (confirm("确定清空全部学习记录？此操作不可恢复（建议先导出备份）。")) {
        localStorage.removeItem("wa_history");
        location.reload();
      }
    });
  }

  init();
})();
