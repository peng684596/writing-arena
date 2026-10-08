/* ============================================================
   图表渲染器：把题库 chart 字段渲染为内联 SVG（bar/line/pie）
   或表格（table）。图表数据为题库原创模拟数据。
   ============================================================ */
(function () {
  "use strict";

  const W = 720, H = 340;
  const M = { l: 74, r: 24, t: 54, b: 56 };
  const PALETTE = ["#2f6db5", "#0e7a5f", "#b26a00", "#8e44ad", "#c0392b", "#4a6b1a"];
  const GRID = "#e6ebf1", AXIS = "#5c6b7c";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function niceMax(v) {
    if (v <= 0) return 10;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    let m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return m * p;
  }

  function fmtNum(n) {
    if (Number.isInteger(n)) return String(n);
    return String(Math.round(n * 10) / 10);
  }

  function plotW() { return W - M.l - M.r; }
  function plotH() { return H - M.t - M.b; }

  function yAxis(yMax) {
    let parts = [];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const v = (yMax / steps) * i;
      const y = M.t + plotH() - (v / yMax) * plotH();
      parts.push(`<line x1="${M.l}" y1="${y}" x2="${W - M.r}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`);
      parts.push(`<text x="${M.l - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${AXIS}">${fmtNum(v)}</text>`);
    }
    return parts.join("");
  }

  function xLabels(labels, slotW) {
    return labels.map((lb, i) => {
      const x = M.l + slotW * i + slotW / 2;
      return `<text x="${x}" y="${H - M.b + 18}" text-anchor="middle" font-size="11" fill="${AXIS}">${esc(lb)}</text>`;
    }).join("");
  }

  function legend(series) {
    let items = series.map((s, i) =>
      `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:14px;font-size:12.5px;color:#5c6b7c">
        <svg width="14" height="10"><rect x="0" y="0" width="14" height="10" rx="2" fill="${PALETTE[i % PALETTE.length]}"/></svg>
        ${esc(s.name)}</span>`).join("");
    return `<div style="text-align:center;margin-bottom:4px">${items}</div>`;
  }

  function renderBar(def, yMax) {
    const labels = def.labels, series = def.series;
    const slotW = plotW() / labels.length;
    const groupW = Math.min(slotW * 0.72, 84);
    const barW = groupW / series.length;
    let bars = "";
    series.forEach((s, si) => {
      s.data.forEach((v, i) => {
        const h = (v / yMax) * plotH();
        const x = M.l + slotW * i + slotW / 2 - groupW / 2 + si * barW + barW * 0.08;
        const y = M.t + plotH() - h;
        bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW * 0.84).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${PALETTE[si % PALETTE.length]}">
          <title>${esc(labels[i])} · ${esc(s.name)}：${fmtNum(v)}${esc(def.unit || "")}</title></rect>`;
        if (series.length === 1) {
          bars += `<text x="${(x + barW * 0.42).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="${AXIS}">${fmtNum(v)}</text>`;
        }
      });
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(def.title)}">
      <text x="${W / 2}" y="26" text-anchor="middle" font-size="15" font-weight="700" fill="#1c2733">${esc(def.title)}</text>
      <text x="${W / 2}" y="44" text-anchor="middle" font-size="11" fill="${AXIS}">单位：${esc(def.unit || "—")}</text>
      ${yAxis(yMax)}
      <line x1="${M.l}" y1="${M.t + plotH()}" x2="${W - M.r}" y2="${M.t + plotH()}" stroke="${AXIS}" stroke-width="1"/>
      ${xLabels(labels, slotW)}
      ${bars}
    </svg>`;
  }

  function renderLine(def, yMax) {
    const labels = def.labels, series = def.series;
    const slotW = plotW() / labels.length;
    let paths = "";
    series.forEach((s, si) => {
      const pts = s.data.map((v, i) => {
        const x = M.l + slotW * i + slotW / 2;
        const y = M.t + plotH() - (v / yMax) * plotH();
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      const color = PALETTE[si % PALETTE.length];
      paths += `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>`;
      s.data.forEach((v, i) => {
        const [x, y] = pts[i].split(",");
        paths += `<circle cx="${x}" cy="${y}" r="4" fill="#fff" stroke="${color}" stroke-width="2"><title>${esc(labels[i])} · ${esc(s.name)}：${fmtNum(v)}${esc(def.unit || "")}</title></circle>`;
        paths += `<text x="${x}" y="${Number(y) - 9}" text-anchor="middle" font-size="10.5" fill="${AXIS}">${fmtNum(v)}</text>`;
      });
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(def.title)}">
      <text x="${W / 2}" y="26" text-anchor="middle" font-size="15" font-weight="700" fill="#1c2733">${esc(def.title)}</text>
      <text x="${W / 2}" y="44" text-anchor="middle" font-size="11" fill="${AXIS}">单位：${esc(def.unit || "—")}</text>
      ${yAxis(yMax)}
      <line x1="${M.l}" y1="${M.t + plotH()}" x2="${W - M.r}" y2="${M.t + plotH()}" stroke="${AXIS}" stroke-width="1"/>
      ${xLabels(labels, slotW)}
      ${paths}
    </svg>`;
  }

  function renderPie(def) {
    const data = def.series[0].data, labels = def.labels;
    const total = data.reduce((a, b) => a + b, 0) || 1;
    const cx = 240, cy = H / 2 + 6, r = 108;
    let angle = -90, slices = "", legends = "";
    data.forEach((v, i) => {
      const pct = v / total;
      const a0 = angle, a1 = angle + pct * 360;
      const x0 = cx + r * Math.cos((a0 * Math.PI) / 180);
      const y0 = cy + r * Math.sin((a0 * Math.PI) / 180);
      const x1 = cx + r * Math.cos((a1 * Math.PI) / 180);
      const y1 = cy + r * Math.sin((a1 * Math.PI) / 180);
      const large = pct > 0.5 ? 1 : 0;
      const color = PALETTE[i % PALETTE.length];
      slices += `<path d="M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${color}" stroke="#fff" stroke-width="1.5"><title>${esc(labels[i])}：${fmtNum(v)}%</title></path>`;
      const am = (a0 + a1) / 2;
      const lx = cx + (r + 16) * Math.cos((am * Math.PI) / 180);
      const ly = cy + (r + 16) * Math.sin((am * Math.PI) / 180);
      if (pct >= 0.06) {
        slices += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#1c2733">${Math.round(pct * 100)}%</text>`;
      }
      legends += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0;font-size:12.5px;color:#5c6b7c">
        <svg width="12" height="12"><rect width="12" height="12" rx="2" fill="${color}"/></svg>
        ${esc(labels[i])} ${fmtNum(v)}%</div>`;
      angle = a1;
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(def.title)}">
      <text x="${W / 2}" y="26" text-anchor="middle" font-size="15" font-weight="700" fill="#1c2733">${esc(def.title)}</text>
      <text x="${W / 2}" y="44" text-anchor="middle" font-size="11" fill="${AXIS}">单位：${esc(def.unit || "%")}</text>
      <g transform="translate(0,-12)">${slices}</g>
      <g transform="translate(${cx + r + 40},${cy - (data.length * 13) / 2})">${legends}</g>
    </svg>`;
  }

  function renderTable(def) {
    // 表格形态同样要带标题：图表题的材料表若没有标题，学生看不出它对应哪张图
    const title = def.title
      ? `<div style="text-align:center;font-size:15px;font-weight:700;color:#1c2733;margin-bottom:8px">${esc(def.title)}</div>`
      : "";
    const unit = def.unit ? `<div style="text-align:center;font-size:11px;color:${AXIS};margin-bottom:6px">单位：${esc(def.unit)}</div>` : "";
    const head = `<tr><th></th>${def.labels.map(l => `<th>${esc(l)}</th>`).join("")}</tr>`;
    const rows = def.series.map(s =>
      `<tr><td><b>${esc(s.name)}</b></td>${s.data.map(v => `<td>${fmtNum(v)}${esc(def.unit || "")}</td>`).join("")}</tr>`).join("");
    return title + unit + `<table class="history" style="margin:0"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
  }

  function render(container, def) {
    if (!def || !def.labels || !def.series) { container.innerHTML = ""; return; }
    if (def.type === "table") { container.innerHTML = renderTable(def); return; }
    const all = def.series.flatMap(s => s.data);
    const yMax = def.type === "pie" ? 100 : niceMax(Math.max(...all) * 1.12);
    let svg;
    if (def.type === "line") svg = renderLine(def, yMax);
    else if (def.type === "pie") svg = renderPie(def);
    else svg = renderBar(def, yMax);
    container.innerHTML = legend(def.series) + svg;
  }

  window.Charts = { render };
})();
