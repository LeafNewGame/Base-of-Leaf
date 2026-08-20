"use strict";
/* ---------- 学習統計 ---------- */
  function renderStats() {
    const wrap = $("#stats-wrap");
    const total = cards.length;
    const thisMonth = cards.filter((c) => c.createdAt && new Date(c.createdAt).getMonth() === new Date().getMonth() && new Date(c.createdAt).getFullYear() === new Date().getFullYear()).length;
    const catCount = {}; cards.forEach((c) => (c.categories || []).forEach((x) => (catCount[x] = (catCount[x] || 0) + 1)));
    const totalViews = cards.reduce((s, c) => s + (c.viewCount || 0), 0);
    const years = {}; cards.forEach((c) => { if (c.createdAt) { const y = new Date(c.createdAt).getFullYear(); years[y] = (years[y] || 0) + 1; } });

    const topCats = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxCat = Math.max(1, ...topCats.map((x) => x[1]));
    const yrEntries = Object.entries(years).sort();
    const maxYr = Math.max(1, ...yrEntries.map((x) => x[1]));

    wrap.innerHTML = `
      <div class="stat-card"><div class="big">${total}</div><div class="label">総カード数</div></div>
      <div class="stat-card"><div class="big">${thisMonth}</div><div class="label">今月追加</div></div>
      <div class="stat-card"><div class="big">${totalViews}</div><div class="label">総閲覧回数</div></div>
      <div class="stat-card" style="grid-column: span 2;">
        <h3>カテゴリ分布</h3>
        ${topCats.map(([n, v]) => `<div class="bar-row"><span class="name">${escapeHtml(n)}</span><span class="bar"><i style="width:${v / maxCat * 100}%"></i></span><span class="val">${v}</span></div>`).join("") || '<div class="empty">なし</div>'}
      </div>
      <div class="stat-card" style="grid-column: span 2;">
        <h3>年度別の成長（カード作成数）</h3>
        ${yrEntries.map(([y, v]) => `<div class="bar-row"><span class="name">${y}年</span><span class="bar"><i style="width:${v / maxYr * 100}%"></i></span><span class="val">${v}</span></div>`).join("") || '<div class="empty">なし</div>'}
      </div>
      ${calendarHTML()}`;
  }

  /* 活動カレンダー（ヒートマップ）: 作成日ごとのカード追加数を可視化 */
  function calendarHTML() {
    const counts = {};
    cards.forEach((c) => {
      if (c.createdAt) {
        const d = new Date(c.createdAt);
        const key = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    let max = 1; Object.values(counts).forEach((v) => { if (v > max) max = v; });
    const color = (n) => {
      if (!n) return "transparent";
      const a = (0.2 + 0.8 * Math.min(1, n / max)).toFixed(2);
      return "rgba(95,207,142," + a + ")";
    };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today); start.setDate(today.getDate() - (18 * 7 - 1)); start.setDate(start.getDate() - start.getDay());
    const weeks = []; const cur = new Date(start);
    while (cur <= today) {
      const col = [];
      for (let i = 0; i < 7; i++) { col.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
      weeks.push(col);
    }
    const months = weeks.map((col, i) => {
      const first = col[0]; const prev = i > 0 ? weeks[i - 1][0] : null;
      const show = !prev || first.getMonth() !== prev.getMonth();
      return `<span class="cal-m">${show ? (first.getMonth() + 1) + "月" : ""}</span>`;
    }).join("");
    const dows = ["", "月", "", "水", "", "金", ""].map((d) => `<span>${d}</span>`).join("");
    const cols = weeks.map((col) => {
      const cells = col.map((d) => {
        if (d > today) return '<span class="cal-cell future"></span>';
        const key = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
        const n = counts[key] || 0;
        const tlabel = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        return `<span class="cal-cell${n ? " has" : ""}" style="background:${color(n)}" title="${tlabel} : ${n} 件"></span>`;
      }).join("");
      return `<div class="cal-col">${cells}</div>`;
    }).join("");
    const sw = [1, Math.max(2, Math.round(max / 3)), Math.max(3, Math.round((max * 2) / 3)), max];
    const legend = sw.map((n) => `<i style="background:${color(n)}"></i>`).join("");
    return `<div class="stat-card" style="grid-column: span 2;">
      <h3>知識を追加した日（ヒートマップ）</h3>
      <div class="cal">
        <div class="cal-legend">少 ${legend} 多</div>
        <div class="cal-body">
          <div class="cal-dows">${dows}</div>
          <div class="cal-main">
            <div class="cal-months">${months}</div>
            <div class="cal-cols">${cols}</div>
          </div>
        </div>
      </div>
    </div>`;
  }
