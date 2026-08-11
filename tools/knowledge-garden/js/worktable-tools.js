"use strict";
/* =========================================================================
   ワークテーブル — 道具とポインタ操作
     ・手書きペン（カーソルのドラッグ）／消しゴム
     ・テキストボックス（クリックで作成・ダブルクリックで再編集）
     ・図形（四角 / 円 / 直線 / 矢印）
     ・選択・移動・リサイズ・範囲選択、パン＆ズーム、ショートカット
   ========================================================================= */

WT.pointers = new Map();  // pointerId -> {px,py}
WT.space = false;         // スペースキー押下中（パン）
WT.pinch = null;
WT.newText = null;        // 作成中（未確定）のテキスト要素

/* ---------- ツール切替 ---------- */
function wtSetTool(name) {
  if (WT.editingId) wtCommitText();
  WT.tool = name;
  if (name !== "select") WT.sel.clear();
  wtDraw(); wtSyncUI();
}

/* ---------- ツールバーの表示を状態に合わせる ---------- */
function wtSyncUI() {
  const q = (s) => document.querySelector(s);
  document.querySelectorAll("#wt-bar .wt-tool[data-tool]").forEach((b) => b.classList.toggle("active", b.dataset.tool === WT.tool));
  document.querySelectorAll("#wt-colors .wt-sw").forEach((b) => b.classList.toggle("active", b.dataset.color === WT.color));
  const wrap = q("#wt-wrap"); if (wrap) wrap.dataset.tool = WT.tool;
  const zv = q("#wt-zoom-val"); if (zv) zv.textContent = Math.round(WT.view.s * 100) + "%";
  const cnt = q("#wt-count"); if (cnt) cnt.textContent = WT.els.length + " 個の要素";
  const dv = q("#wt-dirty"); if (dv) dv.hidden = !WT.dirty;
  const ub = q("#wt-undo"); if (ub) ub.disabled = !WT.undoS.length;
  const rb = q("#wt-redo"); if (rb) rb.disabled = !WT.redoS.length;
  const sw = q("#wt-sw"), swv = q("#wt-sw-val");
  if (sw && +sw.value !== WT.sw) sw.value = WT.sw;
  if (swv) swv.textContent = WT.sw;
  const fs = q("#wt-fs"), fsv = q("#wt-fs-val");
  if (fs && +fs.value !== WT.fs) fs.value = WT.fs;
  if (fsv) fsv.textContent = WT.fs;
}

/* ---------- 選択中の要素にスタイルを反映 ---------- */
function wtApplyStyle(prop, value) {
  const sel = wtSelected();
  if (!sel.length) return false;
  wtPushUndo();
  sel.forEach((el) => {
    if (prop === "color") el.color = value;
    if (prop === "sw" && (el.t === "pen" || el.t === "line" || el.t === "rect" || el.t === "ellipse")) el.sw = value;
    if (prop === "fs" && (el.t === "text" || el.t === "card")) el.fs = value;
  });
  wtDraw(); wtSyncUI();
  return true;
}

/* ---------- テキスト編集（キャンバス上のオーバーレイ） ---------- */
function wtEditText(el, isNew) {
  const ta = document.getElementById("wt-text-edit");
  if (!ta) return;
  WT.editingId = isNew ? null : el.id;
  WT.newText = isNew ? el : null;
  WT._editTarget = el;
  ta.value = el.text || "";
  wtPlaceTextEditor(el);
  ta.hidden = false;
  wtDraw();
  setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 0);
}
function wtPlaceTextEditor(el) {
  const ta = document.getElementById("wt-text-edit");
  const s = WT.view.s;
  const p = wtToScreen(el.x, el.y);
  ta.style.left = (p.x - 5) + "px";
  ta.style.top = (p.y - 4) + "px";
  ta.style.width = (el.w * s + 10) + "px";
  ta.style.fontSize = (el.fs * s) + "px";
  ta.style.color = wtInk(el.color);
  wtAutoGrow(ta);
}
function wtAutoGrow(ta) {
  ta.style.height = "auto";
  ta.style.height = Math.max(ta.scrollHeight, 24) + "px";
}
function wtCommitText() {
  const ta = document.getElementById("wt-text-edit");
  if (!ta || ta.hidden) return;
  const el = WT._editTarget;
  const val = ta.value;
  ta.hidden = true;
  WT._editTarget = null;
  const editingId = WT.editingId;
  const isNew = !!WT.newText;
  WT.editingId = null; WT.newText = null;
  if (!el) { wtDraw(); return; }
  if (isNew) {
    if (val.trim()) { el.text = val; wtAdd(el, { select: true }); }
    else { wtDraw(); }
    return;
  }
  const target = wtById(editingId);
  if (target && target.text !== val) {
    wtPushUndo();
    if (val.trim()) target.text = val;
    else WT.els = WT.els.filter((e) => e.id !== editingId);
  }
  wtDraw(); wtSyncUI();
}

/* ---------- リサイズ計算 ---------- */
function wtApplyResize(el, key, wp, start) {
  const b = start.b;
  const ax = (key === "nw" || key === "sw") ? b.x + b.w : b.x;
  const ay = (key === "nw" || key === "ne") ? b.y + b.h : b.y;
  let nw = Math.max(24, Math.abs(wp.x - ax));
  let nh = Math.max(24, Math.abs(wp.y - ay));
  if (el.t === "text" || el.t === "card") {
    el.w = Math.max(60, nw);
    if (key === "nw" || key === "sw") el.x = ax - el.w;
    return;
  }
  if (el.t === "image") {
    const ar = (start.el.w || 1) / (start.el.h || 1);
    if (nw / nh > ar) nw = nh * ar; else nh = nw / ar;
  }
  el.x = (key === "nw" || key === "sw") ? ax - nw : ax;
  el.y = (key === "nw" || key === "ne") ? ay - nh : ay;
  el.w = nw; el.h = nh;
}

/* ---------- ポインタ操作 ---------- */
function wtOnPointerDown(ev) {
  const cv = WT.canvas, wrap = document.getElementById("wt-wrap");
  if (!cv) return;
  if (ev.pointerType === "mouse" && ev.button === 2) return;   // 右クリックは無視
  if (WT.editingId || WT.newText) wtCommitText();
  const p = wtPointerPos(ev);
  WT.pointers.set(ev.pointerId, p);

  // 指2本 → ピンチズーム
  if (WT.pointers.size === 2) {
    const [a, b] = Array.from(WT.pointers.values());
    WT.pinch = { d: Math.hypot(a.px - b.px, a.py - b.py), cx: (a.px + b.px) / 2, cy: (a.py + b.py) / 2 };
    WT.act = null; WT.draft = null; WT.marquee = null;
    wtDraw();
    return;
  }
  try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
  const w = wtToWorld(p.px, p.py);

  // パン（中ボタン / スペース / 手のひらツール / Alt）
  if (ev.button === 1 || WT.space || WT.tool === "hand" || ev.altKey) {
    WT.act = { mode: "pan", px: p.px, py: p.py, vx: WT.view.x, vy: WT.view.y };
    if (wrap) wrap.classList.add("panning");
    return;
  }

  switch (WT.tool) {
    case "pen": {
      WT.draft = { id: wtUid(), t: "pen", pts: [[w.x, w.y]], color: WT.color, sw: WT.sw };
      WT.act = { mode: "pen" };
      break;
    }
    case "eraser": {
      WT.act = { mode: "erase", pushed: false };
      wtEraseAt(w.x, w.y);
      break;
    }
    case "text": {
      const el = { id: wtUid(), t: "text", x: w.x, y: w.y, w: 320, text: "", color: WT.color, fs: WT.fs };
      wtEditText(el, true);
      WT.act = null;
      break;
    }
    case "rect":
    case "ellipse": {
      WT.draft = { id: wtUid(), t: WT.tool, x: w.x, y: w.y, w: 0, h: 0, color: WT.color, sw: WT.sw, bg: "" };
      WT.act = { mode: "shape", ox: w.x, oy: w.y };
      break;
    }
    case "line":
    case "arrow": {
      WT.draft = { id: wtUid(), t: "line", x1: w.x, y1: w.y, x2: w.x, y2: w.y, color: WT.color, sw: WT.sw, arrow: WT.tool === "arrow" };
      WT.act = { mode: "line" };
      break;
    }
    default: {   // select
      const h = wtHitHandle(p.px, p.py);
      if (h) {
        WT.act = { mode: "resize", key: h.key, el: h.el, start: { b: wtBBox(h.el), el: JSON.parse(JSON.stringify(h.el)) }, pushed: false };
        break;
      }
      const hit = wtHitTop(w.x, w.y);
      if (hit) {
        if (ev.shiftKey) {
          if (WT.sel.has(hit.id)) WT.sel.delete(hit.id); else WT.sel.add(hit.id);
        } else if (!WT.sel.has(hit.id)) {
          WT.sel.clear(); WT.sel.add(hit.id);
        }
        WT.act = { mode: "move", lx: w.x, ly: w.y, pushed: false };
      } else {
        if (!ev.shiftKey) WT.sel.clear();
        WT.marquee = { x0: w.x, y0: w.y, x1: w.x, y1: w.y, add: ev.shiftKey, base: new Set(WT.sel) };
        WT.act = { mode: "marquee" };
      }
      wtDraw(); wtSyncUI();
    }
  }
}

function wtOnPointerMove(ev) {
  if (!WT.canvas) return;
  const p = wtPointerPos(ev);
  if (WT.pointers.has(ev.pointerId)) WT.pointers.set(ev.pointerId, p);

  // ピンチズーム
  if (WT.pointers.size === 2 && WT.pinch) {
    const [a, b] = Array.from(WT.pointers.values());
    const d = Math.hypot(a.px - b.px, a.py - b.py);
    const cx = (a.px + b.px) / 2, cy = (a.py + b.py) / 2;
    if (WT.pinch.d > 0) {
      WT.view.x += cx - WT.pinch.cx;
      WT.view.y += cy - WT.pinch.cy;
      wtZoomAt(cx, cy, d / WT.pinch.d);
    }
    WT.pinch = { d: d, cx: cx, cy: cy };
    return;
  }
  const act = WT.act;
  if (!act) return;
  const w = wtToWorld(p.px, p.py);

  switch (act.mode) {
    case "pan":
      WT.view.x = act.vx + (p.px - act.px);
      WT.view.y = act.vy + (p.py - act.py);
      wtDraw();
      break;
    case "pen": {
      const pts = WT.draft.pts;
      const last = pts[pts.length - 1];
      const min = 1.5 / WT.view.s;
      if (Math.hypot(w.x - last[0], w.y - last[1]) >= min) { pts.push([w.x, w.y]); wtDraw(); }
      break;
    }
    case "erase":
      wtEraseAt(w.x, w.y);
      break;
    case "shape": {
      const d = WT.draft;
      d.x = Math.min(act.ox, w.x); d.y = Math.min(act.oy, w.y);
      d.w = Math.abs(w.x - act.ox); d.h = Math.abs(w.y - act.oy);
      if (ev.shiftKey) { const s = Math.max(d.w, d.h); d.w = s; d.h = s; }
      wtDraw();
      break;
    }
    case "line": {
      const d = WT.draft;
      d.x2 = w.x; d.y2 = w.y;
      if (ev.shiftKey) {
        const dx = d.x2 - d.x1, dy = d.y2 - d.y1;
        if (Math.abs(dx) > Math.abs(dy)) d.y2 = d.y1; else d.x2 = d.x1;
      }
      wtDraw();
      break;
    }
    case "move": {
      const dx = w.x - act.lx, dy = w.y - act.ly;
      if (!dx && !dy) break;
      if (!act.pushed) { wtPushUndo(); act.pushed = true; }
      wtSelected().forEach((el) => wtMoveEl(el, dx, dy));
      act.lx = w.x; act.ly = w.y;
      WT.dirty = true;
      wtDraw();
      break;
    }
    case "resize": {
      if (!act.pushed) { wtPushUndo(); act.pushed = true; }
      wtApplyResize(act.el, act.key, w, act.start);
      WT.dirty = true;
      wtDraw();
      break;
    }
    case "marquee": {
      WT.marquee.x1 = w.x; WT.marquee.y1 = w.y;
      const m = WT.marquee;
      const r = { x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1), w: Math.abs(m.x1 - m.x0), h: Math.abs(m.y1 - m.y0) };
      WT.sel = new Set(m.add ? Array.from(m.base) : []);
      WT.els.forEach((el) => {
        const b = wtBBox(el);
        if (b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y) WT.sel.add(el.id);
      });
      wtDraw();
      break;
    }
  }
}

function wtOnPointerUp(ev) {
  WT.pointers.delete(ev.pointerId);
  if (WT.pointers.size < 2) WT.pinch = null;
  const wrap = document.getElementById("wt-wrap");
  if (wrap) wrap.classList.remove("panning");
  const act = WT.act;
  WT.act = null;
  if (!act) { WT.marquee = null; wtDraw(); return; }

  if (act.mode === "pen" && WT.draft) {
    const d = WT.draft; WT.draft = null;
    wtAdd(d);
  } else if (act.mode === "shape" && WT.draft) {
    const d = WT.draft; WT.draft = null;
    if (d.w > 4 && d.h > 4) wtAdd(d); else wtDraw();
  } else if (act.mode === "line" && WT.draft) {
    const d = WT.draft; WT.draft = null;
    if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 4) wtAdd(d); else wtDraw();
  } else if (act.mode === "marquee") {
    WT.marquee = null; wtDraw(); wtSyncUI();
  } else {
    wtDraw(); wtSyncUI();
  }
}

function wtEraseAt(x, y) {
  const hit = wtHitTop(x, y);
  if (!hit) return;
  if (WT.act && !WT.act.pushed) { wtPushUndo(); WT.act.pushed = true; }
  WT.els = WT.els.filter((e) => e.id !== hit.id);
  WT.sel.delete(hit.id);
  WT.dirty = true;
  wtDraw(); wtSyncUI();
}

function wtOnDblClick(ev) {
  if (WT.tool !== "select" && WT.tool !== "text") return;   // 作図中の誤爆を防ぐ
  const p = wtPointerPos(ev);
  const w = wtToWorld(p.px, p.py);
  const hit = wtHitTop(w.x, w.y);
  if (hit && hit.t === "text") { WT.sel.clear(); WT.sel.add(hit.id); wtEditText(hit, false); return; }
  if (hit && hit.t === "card") { wtEditCardText(hit); return; }
  if (!hit) {
    const el = { id: wtUid(), t: "text", x: w.x, y: w.y, w: 320, text: "", color: WT.color, fs: WT.fs };
    wtEditText(el, true);
  }
}
/* 引用カードの本文をその場で編集（一時編集なので元カードには影響しません） */
function wtEditCardText(card) {
  const cur = (card.title ? card.title + "\n" : "") + (card.body || "");
  const val = prompt("引用カードの文言を編集します（1行目＝タイトル）\n※元の知識カードには影響しません", cur);
  if (val == null) return;
  wtPushUndo();
  const lines = val.split("\n");
  card.title = lines.shift() || "";
  card.body = lines.join("\n").replace(/^\n+/, "");
  wtDraw(); wtSyncUI();
}

function wtOnWheel(ev) {
  ev.preventDefault();
  if (WT.editingId || WT.newText) wtCommitText();   // 編集枠がずれないよう先に確定
  const p = wtPointerPos(ev);
  const k = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1;  // 行/ページ単位への対応
  if (ev.ctrlKey || ev.metaKey) {
    wtZoomAt(p.px, p.py, ev.deltaY < 0 ? 1.12 : 1 / 1.12);
  } else {
    WT.view.x -= ev.deltaX * k;
    WT.view.y -= ev.deltaY * k;
    wtDraw();
  }
}

/* ---------- キーボード ---------- */
function wtIsActiveView() {
  const v = document.getElementById("view-worktable");
  return !!(v && v.classList.contains("active"));
}
function wtTypingInField(t) {
  if (!t) return false;
  const tag = (t.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable;
}
function wtOnKeyDown(ev) {
  if (!wtIsActiveView()) return;
  const ta = document.getElementById("wt-text-edit");
  if (ta && !ta.hidden && ev.target === ta) {
    if (ev.key === "Escape" || (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey))) { ev.preventDefault(); wtCommitText(); }
    return;
  }
  if (wtTypingInField(ev.target)) return;
  const mod = ev.ctrlKey || ev.metaKey;
  if (mod && ev.key.toLowerCase() === "z") { ev.preventDefault(); if (ev.shiftKey) wtRedo(); else wtUndo(); return; }
  if (mod && ev.key.toLowerCase() === "y") { ev.preventDefault(); wtRedo(); return; }
  if (mod && ev.key.toLowerCase() === "a") { ev.preventDefault(); WT.sel = new Set(WT.els.map((e) => e.id)); wtSetToolSilent("select"); wtDraw(); wtSyncUI(); return; }
  if (mod && ev.key.toLowerCase() === "d") { ev.preventDefault(); wtDuplicateSelected(); return; }
  if (mod && ev.key.toLowerCase() === "s") { ev.preventDefault(); wtExportBoard(); return; }
  if (mod) return;
  if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); wtDeleteSelected(); return; }
  if (ev.key === "Escape") { WT.sel.clear(); WT.marquee = null; wtDraw(); wtSyncUI(); return; }
  if (ev.key === " ") { WT.space = true; ev.preventDefault(); return; }
  const map = { v: "select", "1": "select", p: "pen", "2": "pen", e: "eraser", "3": "eraser", t: "text", "4": "text", r: "rect", "5": "rect", o: "ellipse", "6": "ellipse", a: "arrow", "7": "arrow", l: "line", h: "hand" };
  const k = map[ev.key.toLowerCase()];
  if (k) { wtSetTool(k); ev.preventDefault(); }
}
function wtSetToolSilent(name) { WT.tool = name; const wrap = document.getElementById("wt-wrap"); if (wrap) wrap.dataset.tool = name; }
function wtOnKeyUp(ev) { if (ev.key === " ") WT.space = false; }

/* ---------- ツールバーの組み立て ---------- */
function wtBuildPalette() {
  const box = document.getElementById("wt-colors");
  if (!box) return;
  box.innerHTML = "";
  WT_PALETTE.forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "wt-sw" + (c === WT.color ? " active" : "");
    b.dataset.color = c;
    b.title = c === "auto" ? "自動（テーマの文字色）" : c;
    if (c !== "auto") b.style.background = c;
    b.onclick = () => { WT.color = c; wtApplyStyle("color", c); wtSyncUI(); };
    box.appendChild(b);
  });
}

/* ---------- 初期化 ---------- */
function wtInit() {
  const cv = document.getElementById("wt-canvas");
  if (!cv) return;
  WT.canvas = cv;
  WT.ctx = cv.getContext("2d");

  cv.addEventListener("pointerdown", wtOnPointerDown);
  cv.addEventListener("pointermove", wtOnPointerMove);
  cv.addEventListener("pointerup", wtOnPointerUp);
  cv.addEventListener("pointercancel", wtOnPointerUp);
  cv.addEventListener("dblclick", wtOnDblClick);
  cv.addEventListener("wheel", wtOnWheel, { passive: false });
  cv.addEventListener("contextmenu", (e) => e.preventDefault());

  document.addEventListener("keydown", wtOnKeyDown);
  document.addEventListener("keyup", wtOnKeyUp);

  const ta = document.getElementById("wt-text-edit");
  if (ta) {
    ta.addEventListener("input", () => wtAutoGrow(ta));
    ta.addEventListener("blur", () => wtCommitText());
  }

  // 道具ボタン
  document.querySelectorAll("#wt-bar .wt-tool[data-tool]").forEach((b) => { b.onclick = () => wtSetTool(b.dataset.tool); });
  wtBuildPalette();

  // スライダーは「動かしている間は表示だけ更新」「離した時に選択へ反映（Undo は1回）」
  const sw = document.getElementById("wt-sw");
  if (sw) {
    sw.oninput = () => { WT.sw = +sw.value; const o = document.getElementById("wt-sw-val"); if (o) o.textContent = WT.sw; };
    sw.onchange = () => { WT.sw = +sw.value; wtApplyStyle("sw", WT.sw); wtSyncUI(); };
  }
  const fs = document.getElementById("wt-fs");
  if (fs) {
    fs.oninput = () => { WT.fs = +fs.value; const o = document.getElementById("wt-fs-val"); if (o) o.textContent = WT.fs; };
    fs.onchange = () => { WT.fs = +fs.value; wtApplyStyle("fs", WT.fs); wtSyncUI(); };
  }

  const ub = document.getElementById("wt-undo"); if (ub) ub.onclick = wtUndo;
  const rb = document.getElementById("wt-redo"); if (rb) rb.onclick = wtRedo;
  const db = document.getElementById("wt-del"); if (db) db.onclick = wtDeleteSelected;
  const cb = document.getElementById("wt-clear"); if (cb) cb.onclick = wtClearBoard;
  const zi = document.getElementById("wt-zoom-in"); if (zi) zi.onclick = () => wtZoomCenter(1.2);
  const zo = document.getElementById("wt-zoom-out"); if (zo) zo.onclick = () => wtZoomCenter(1 / 1.2);
  const zr = document.getElementById("wt-zoom-reset"); if (zr) zr.onclick = wtResetView;
  const zf = document.getElementById("wt-fit"); if (zf) zf.onclick = wtFitView;

  // 入出力（画像・カード引用・エクスポート）
  if (typeof wtBindIO === "function") wtBindIO();

  // サイズ追従
  const wrap = document.getElementById("wt-wrap");
  if (window.ResizeObserver && wrap) {
    new ResizeObserver(() => wtResizeCanvas()).observe(wrap);
  }
  window.addEventListener("resize", () => { if (wtIsActiveView()) wtResizeCanvas(); });

  // 未エクスポートのまま閉じようとしたら警告（保存はローカルへの書き出しのみ）
  window.addEventListener("beforeunload", (e) => {
    if (WT.dirty && WT.els.length) { e.preventDefault(); e.returnValue = ""; }
  });

  WT.booted = true;
  wtResizeCanvas();
  wtSyncUI();
}
/* ビューが表示された時（サイズが確定してから測り直す） */
function wtOnShow() {
  if (!WT.booted) { wtInit(); return; }
  requestAnimationFrame(() => { wtResizeCanvas(); wtSyncUI(); });
}
