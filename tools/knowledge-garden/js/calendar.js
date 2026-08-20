"use strict";
/* ---------- カレンダー（タスク管理） ---------- */
  let calState = { y: new Date().getFullYear(), m: new Date().getMonth() };
  let calSelected = null;
  let calMode = "month";
  let calAgendaBase = null;
  const shiftDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
  function renderCalendar() {
    const isA = calMode === "agenda";
    $("#cal-grid").hidden = isA;
    $("#cal-day").hidden = isA || !calSelected;
    $("#cal-agenda").hidden = !isA;
    const tog = $("#cal-toggle"); if (tog) tog.textContent = isA ? "月カレンダー" : "予定リスト";
    if (isA) renderAgenda(); else renderMonth();
  }
  function renderMonth() {
    const grid = $("#cal-grid"); if (!grid) return;
    const y = calState.y, m = calState.m;
    $("#cal-month-label").textContent = y + "年 " + (m + 1) + "月";
    const startDow = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const byDate = {};
    cards.forEach((c) => { if (c.dueDate) (byDate[c.dueDate] = byDate[c.dueDate] || []).push(c); });
    const dows = ["日", "月", "火", "水", "木", "金", "土"];
    let html = '<div class="cg-dow">' + dows.map((d) => `<span>${d}</span>`).join("") + '</div><div class="cg-cells">';
    const todayStr = new Date().toISOString().slice(0, 10);
    const pad = (n) => String(n).padStart(2, "0");
    for (let i = 0; i < startDow; i++) html += '<span class="cg-cell blank"></span>';
    for (let d = 1; d <= days; d++) {
      const ds = y + "-" + pad(m + 1) + "-" + pad(d);
      const list = byDate[ds] || [];
      const total = list.length;
      const doneN = list.filter((c) => c.done).length;
      const has = total > 0;
      const cls = "cg-cell" + (has ? " has" : "") + (ds === todayStr ? " today" : "") + (ds === calSelected ? " sel" : "");
      const badge = has ? `<span class="cg-badge">${doneN}/${total}</span>` : "";
      html += `<button class="${cls}" data-date="${ds}">${d}${badge}</button>`;
    }
    html += "</div>";
    grid.innerHTML = html;
    grid.querySelectorAll(".cg-cell:not(.blank)").forEach((b) => { b.onclick = () => selectDay(b.dataset.date); });
    if (calSelected) renderDayPanel();
  }
  function renderAgenda() {
    const wrap = $("#cal-agenda"); if (!wrap) return;
    const base = calAgendaBase || new Date();
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (dt) => dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
    const todayStr = new Date().toISOString().slice(0, 10);
    const byDate = {};
    cards.forEach((c) => { if (c.dueDate) (byDate[c.dueDate] = byDate[c.dueDate] || []).push(c); });
    const dows = ["日", "月", "火", "水", "木", "金", "土"];
    const end = shiftDays(start, 9);
    $("#cal-month-label").textContent = (start.getMonth() + 1) + "/" + start.getDate() + " – " + (end.getMonth() + 1) + "/" + end.getDate();
    let html = "";
    for (let i = 0; i < 10; i++) {
      const dt = shiftDays(start, i);
      const ds = fmt(dt);
      const list = (byDate[ds] || []).slice().sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (b.importance || 3) - (a.importance || 3));
      const doneN = list.filter((c) => c.done).length;
      const isToday = ds === todayStr;
      html += `<div class="cg-ada-day${isToday ? " today" : ""}">`;
      html += `<div class="cg-ada-head"><span class="cg-ada-date">${dt.getMonth() + 1}/${dt.getDate()}</span><span class="cg-ada-dow">（${dows[dt.getDay()]}）</span><span class="cg-ada-count">${doneN}/${list.length}</span></div>`;
      html += `<div class="cg-ada-row">`;
      if (!list.length) html += `<div class="cg-ada-empty">予定なし</div>`;
      else       list.forEach((c) => {
        html += `<div class="cg-ata${c.done ? " done" : ""}" data-id="${c.id}">
          <label class="cg-ata-check"><input type="checkbox" ${c.done ? "checked" : ""} data-id="${c.id}" /><span class="cg-task-box">${c.done ? CHECK_ON_SVG : CHECK_OFF_SVG}</span></label>
          <div class="cg-ata-body">
            <div class="cg-ata-title">${escapeHtml(c.title)}</div>
            <div class="cg-ata-meta"><span class="stars">${stars(c.importance)}</span></div>
          </div>
        </div>`;
      });
      html += `</div></div>`;
    }
    wrap.innerHTML = html;
    wrap.querySelectorAll(".cg-ata").forEach((el) => {
      const id = el.dataset.id;
      const cb = el.querySelector('input[type="checkbox"]');
      if (cb) cb.onchange = () => toggleTaskDone(id, el);
      const t = el.querySelector(".cg-ata-title");
      if (t) t.onclick = () => openEditor(id);
    });
  }
  function selectDay(date) {
    calSelected = date;
    renderCalendar();
  }
  function renderDayPanel() {
    const panel = $("#cal-day"), head = $("#cal-day-head"), tasks = $("#cal-tasks");
    if (!panel || !calSelected) { if (panel) panel.hidden = true; return; }
    panel.hidden = false;
    const p = calSelected.split("-");
    head.innerHTML = `<span class="cg-day-title">${p[0]}年 ${+p[1]}月 ${+p[2]}日 のタスク</span>`;
    const list = cards.filter((c) => c.dueDate === calSelected)
      .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || (b.importance || 3) - (a.importance || 3) || (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    if (!list.length) { tasks.innerHTML = '<div class="empty">この日の予定はありません。</div>'; return; }
    tasks.innerHTML = "";
    list.forEach((c) => {
      const item = document.createElement("div");
      item.className = "cg-task" + (c.done ? " done" : "");
      item.innerHTML = `
        <label class="cg-task-check">
          <input type="checkbox" ${c.done ? "checked" : ""} data-id="${c.id}" />
          <span class="cg-task-box">${c.done ? CHECK_ON_SVG : CHECK_OFF_SVG}</span>
        </label>
        <div class="cg-task-main">
          <div class="cg-task-title">${escapeHtml(c.title)}</div>
          <div class="cg-task-meta">
            <span class="stars">${stars(c.importance)}</span>
            ${c.done ? '<span class="done-tag">完了済み</span>' : ""}
          </div>
        </div>`;
      const cb = item.querySelector('input[type="checkbox"]');
      cb.onchange = () => toggleTaskDone(c.id, item);
      tasks.appendChild(item);
    });
  }
  async function toggleTaskDone(id, itemEl) {
    const c = cards.find((x) => x.id === id); if (!c) return;
    const willDone = !c.done;
    if (itemEl) { itemEl.classList.add("leaving"); await new Promise((r) => setTimeout(r, 300)); }
    c.done = willDone;
    c.updatedAt = nowISO();
    Store.put(c);
    renderDayPanel();
    if ($("#view-calendar").classList.contains("active")) renderCalendar();
  }
