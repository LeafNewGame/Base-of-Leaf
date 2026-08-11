"use strict";
/* =========================================================================
   ワークテーブル（Work Table）— Excalidraw 風の「知識を分析する作業台」
   --------------------------------------------------------------------------
   ■ 保存ポリシー（重要）
     ・ここで描いた線／文字／画像／引用カードは **クラウドにも localStorage にも
       一切保存しません**（すべて一時編集＝メモリ上のみ）。
     ・「保存」＝ エクスポート。PNG またはボードファイル(.kgboard.json)として
       ローカル端末に「名前を付けて保存」します。
   ■ ファイル分割（この機能だけで 3 ファイル + CSS）
     worktable-core.js  … 状態・座標系・当たり判定・描画（このファイル）
     worktable-tools.js … 道具（ペン/消しゴム/テキスト/図形/選択）とポインタ操作
     worktable-io.js    … 画像貼り付け・カード引用・書き出し/読み込み
   ========================================================================= */

/* ---------- 状態 ---------- */
const WT = {
  els: [],            // 要素の配列（描画順＝奥から手前）
  images: {},         // imgId -> { src(dataURL), el(Image) } ※Undo履歴には含めない（軽量化）
  view: { x: 0, y: 0, s: 1 },   // 画面 = world * s + (x, y)
  tool: "pen",
  color: "auto",      // "auto" はテーマの文字色に追従
  sw: 3,              // 線の太さ
  fs: 18,             // 文字サイズ
  sel: new Set(),     // 選択中の要素 id
  draft: null,        // 作図中の一時要素
  marquee: null,      // 範囲選択の矩形（world座標）
  act: null,          // 進行中の操作
  undoS: [], redoS: [],
  dirty: false,
  canvas: null, ctx: null, dpr: 1,
  editingId: null,    // テキスト編集中の要素 id
  booted: false,
};

const WT_PALETTE = ["auto", "#ff6b6b", "#ff9f43", "#ffd166", "#5fcf8e", "#4dabf7", "#9775fa", "#9aa5a0"];
const WT_TYPE_TONE = { knowledge: "#5fcf8e", idea: "#ff85a1", thought: "#8fd0ff", decision: "#ffd166" };

/* ---------- 小道具 ---------- */
function wtCss(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (v || "").trim() || fallback;
}
function wtInk(c) { return (!c || c === "auto") ? wtCss("--text", "#e6efe9") : c; }
function wtBoardBg() { return wtCss("--bg-soft", "#16201b"); }
function wtUid() { return "w_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function wtFont(size, weight) {
  return (weight ? weight + " " : "") + size +
    'px "Hiragino Sans","Yu Gothic",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
}
function wtHexA(hex, a) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || "").trim());
  if (!m) return "rgba(120,160,140," + a + ")";
  return "rgba(" + parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16) + "," + a + ")";
}
function wtById(id) { return WT.els.find((e) => e.id === id) || null; }
function wtSelected() { return WT.els.filter((e) => WT.sel.has(e.id)); }

/* ---------- Undo / Redo（要素配列のスナップショット方式） ---------- */
function wtSnap() { return JSON.stringify(WT.els); }
function wtPushUndo() {
  WT.undoS.push(wtSnap());
  if (WT.undoS.length > 80) WT.undoS.shift();
  WT.redoS.length = 0;
  WT.dirty = true;
}
function wtUndo() {
  if (!WT.undoS.length) return;
  WT.redoS.push(wtSnap());
  WT.els = JSON.parse(WT.undoS.pop());
  WT.sel.clear(); WT.dirty = true;
  wtDraw(); wtSyncUI();
}
function wtRedo() {
  if (!WT.redoS.length) return;
  WT.undoS.push(wtSnap());
  WT.els = JSON.parse(WT.redoS.pop());
  WT.sel.clear(); WT.dirty = true;
  wtDraw(); wtSyncUI();
}

/* ---------- 座標変換 ---------- */
function wtToWorld(px, py) {
  return { x: (px - WT.view.x) / WT.view.s, y: (py - WT.view.y) / WT.view.s };
}
function wtToScreen(wx, wy) {
  return { x: wx * WT.view.s + WT.view.x, y: wy * WT.view.s + WT.view.y };
}
function wtPointerPos(ev) {
  const r = WT.canvas.getBoundingClientRect();
  return { px: ev.clientX - r.left, py: ev.clientY - r.top };
}
function wtEventWorld(ev) {
  const p = wtPointerPos(ev);
  return wtToWorld(p.px, p.py);
}

/* ---------- 幾何 ---------- */
function wtNorm(el) {
  if (el.w < 0) { el.x += el.w; el.w = -el.w; }
  if (el.h < 0) { el.y += el.h; el.h = -el.h; }
  return el;
}
function wtDistSeg(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((x - ax) * dx + (y - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(x - cx, y - cy);
}
function wtBBox(el) {
  switch (el.t) {
    case "pen": {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of el.pts) { if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[0] > x1) x1 = p[0]; if (p[1] > y1) y1 = p[1]; }
      if (!isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
      const m = (el.sw || 2) / 2 + 3;
      return { x: x0 - m, y: y0 - m, w: (x1 - x0) + m * 2, h: (y1 - y0) + m * 2 };
    }
    case "line": {
      const m = (el.sw || 2) / 2 + 3;
      return { x: Math.min(el.x1, el.x2) - m, y: Math.min(el.y1, el.y2) - m, w: Math.abs(el.x2 - el.x1) + m * 2, h: Math.abs(el.y2 - el.y1) + m * 2 };
    }
    case "text": return { x: el.x, y: el.y, w: el.w, h: el._h || el.fs * 1.45 };
    case "card": return { x: el.x, y: el.y, w: el.w, h: el._h || 120 };
    default: return { x: el.x, y: el.y, w: el.w, h: el.h };
  }
}
function wtElsBBox(list) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  list.forEach((el) => {
    const b = wtBBox(el);
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  });
  if (!isFinite(x0)) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function wtHitEl(el, x, y) {
  if (el.t === "pen") {
    const b = wtBBox(el);
    if (x < b.x || y < b.y || x > b.x + b.w || y > b.y + b.h) return false;
    const tol = Math.max(7, (el.sw || 2) + 5);
    if (el.pts.length === 1) return Math.hypot(x - el.pts[0][0], y - el.pts[0][1]) <= tol;
    for (let i = 1; i < el.pts.length; i++) {
      if (wtDistSeg(x, y, el.pts[i - 1][0], el.pts[i - 1][1], el.pts[i][0], el.pts[i][1]) <= tol) return true;
    }
    return false;
  }
  if (el.t === "line") {
    return wtDistSeg(x, y, el.x1, el.y1, el.x2, el.y2) <= Math.max(7, (el.sw || 2) + 5);
  }
  const b = wtBBox(el);
  return x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h;
}
function wtHitTop(x, y) {
  for (let i = WT.els.length - 1; i >= 0; i--) if (wtHitEl(WT.els[i], x, y)) return WT.els[i];
  return null;
}
function wtMoveEl(el, dx, dy) {
  if (el.t === "pen") { el.pts = el.pts.map((p) => [p[0] + dx, p[1] + dy]); return; }
  if (el.t === "line") { el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy; return; }
  el.x += dx; el.y += dy;
}
/* リサイズ可能な種類か */
function wtResizable(el) { return el && (el.t === "rect" || el.t === "ellipse" || el.t === "image" || el.t === "text" || el.t === "card"); }

/* ---------- テキスト折り返し（日本語対応・1文字ずつ計測） ---------- */
function wtWrapLines(ctx, text, maxw) {
  const out = [];
  String(text == null ? "" : text).split("\n").forEach((par) => {
    if (!par) { out.push(""); return; }
    let line = "";
    for (const ch of par) {
      const test = line + ch;
      if (line && ctx.measureText(test).width > maxw) { out.push(line); line = ch; }
      else line = test;
    }
    out.push(line);
  });
  return out;
}
function wtRoundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- 要素の描画 ---------- */
function wtDrawEl(ctx, el) {
  ctx.save();
  switch (el.t) {
    case "pen": {
      ctx.strokeStyle = wtInk(el.color);
      ctx.lineWidth = el.sw; ctx.lineCap = "round"; ctx.lineJoin = "round";
      const p = el.pts;
      ctx.beginPath();
      if (p.length === 1) { ctx.arc(p[0][0], p[0][1], el.sw / 2, 0, Math.PI * 2); ctx.fillStyle = wtInk(el.color); ctx.fill(); break; }
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length - 1; i++) {
        const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
        ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my);
      }
      ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      ctx.stroke();
      break;
    }
    case "line": {
      ctx.strokeStyle = wtInk(el.color); ctx.lineWidth = el.sw; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(el.x1, el.y1); ctx.lineTo(el.x2, el.y2); ctx.stroke();
      if (el.arrow) {
        const a = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
        const L = Math.max(11, el.sw * 4.2);
        ctx.beginPath();
        ctx.moveTo(el.x2, el.y2);
        ctx.lineTo(el.x2 - L * Math.cos(a - 0.42), el.y2 - L * Math.sin(a - 0.42));
        ctx.moveTo(el.x2, el.y2);
        ctx.lineTo(el.x2 - L * Math.cos(a + 0.42), el.y2 - L * Math.sin(a + 0.42));
        ctx.stroke();
      }
      break;
    }
    case "rect": {
      ctx.strokeStyle = wtInk(el.color); ctx.lineWidth = el.sw; ctx.lineJoin = "round";
      wtRoundRect(ctx, el.x, el.y, el.w, el.h, Math.min(10, Math.abs(el.w) / 6, Math.abs(el.h) / 6));
      if (el.bg) { ctx.fillStyle = el.bg; ctx.fill(); }
      ctx.stroke();
      break;
    }
    case "ellipse": {
      ctx.strokeStyle = wtInk(el.color); ctx.lineWidth = el.sw;
      ctx.beginPath();
      ctx.ellipse(el.x + el.w / 2, el.y + el.h / 2, Math.abs(el.w) / 2, Math.abs(el.h) / 2, 0, 0, Math.PI * 2);
      if (el.bg) { ctx.fillStyle = el.bg; ctx.fill(); }
      ctx.stroke();
      break;
    }
    case "image": {
      const rec = WT.images[el.img];
      if (rec && rec.el && rec.el.complete && rec.el.naturalWidth) {
        ctx.drawImage(rec.el, el.x, el.y, el.w, el.h);
      } else {
        ctx.strokeStyle = wtCss("--border", "#2e3d34"); ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5;
        ctx.strokeRect(el.x, el.y, el.w, el.h);
        ctx.setLineDash([]);
        ctx.fillStyle = wtCss("--text-dim", "#9fb3a6"); ctx.font = wtFont(13);
        ctx.textBaseline = "middle"; ctx.textAlign = "center";
        ctx.fillText("画像を読み込み中…", el.x + el.w / 2, el.y + el.h / 2);
      }
      break;
    }
    case "text": {
      ctx.font = wtFont(el.fs);
      ctx.textBaseline = "top"; ctx.textAlign = "left";
      ctx.fillStyle = wtInk(el.color);
      const lh = el.fs * 1.45;
      const lines = wtWrapLines(ctx, el.text, el.w);
      lines.forEach((ln, i) => ctx.fillText(ln, el.x, el.y + i * lh));
      el._h = Math.max(lh, lines.length * lh);
      break;
    }
    case "card": {
      const pad = 14, tone = el.tone || wtCss("--accent", "#5fcf8e");
      const innerW = el.w - pad * 2;
      ctx.textBaseline = "top"; ctx.textAlign = "left";
      ctx.font = wtFont(el.fs + 2, "700");
      const tLines = wtWrapLines(ctx, el.title || "(無題)", innerW);
      const tlh = (el.fs + 2) * 1.4;
      ctx.font = wtFont(el.fs);
      const bLines = el.body ? wtWrapLines(ctx, el.body, innerW) : [];
      const blh = el.fs * 1.5;
      const metaH = el.meta ? el.fs * 1.4 : 0;
      const h = pad * 2 + tLines.length * tlh + (bLines.length ? 10 + bLines.length * blh : 0) + (metaH ? 6 + metaH : 0);
      el._h = h;
      // 用紙
      wtRoundRect(ctx, el.x, el.y, el.w, h, 12);
      ctx.fillStyle = wtHexA(tone, 0.13); ctx.fill();
      ctx.strokeStyle = wtHexA(tone, 0.65); ctx.lineWidth = 1.4; ctx.stroke();
      // 左のアクセントバー
      ctx.save();
      wtRoundRect(ctx, el.x, el.y, el.w, h, 12); ctx.clip();
      ctx.fillStyle = tone; ctx.fillRect(el.x, el.y, 4, h);
      ctx.restore();
      // タイトル
      ctx.fillStyle = wtInk("auto"); ctx.font = wtFont(el.fs + 2, "700");
      tLines.forEach((ln, i) => ctx.fillText(ln, el.x + pad, el.y + pad + i * tlh));
      // 本文
      let cy = el.y + pad + tLines.length * tlh;
      if (bLines.length) {
        cy += 10;
        ctx.font = wtFont(el.fs);
        ctx.fillStyle = wtCss("--text", "#e6efe9");
        bLines.forEach((ln, i) => ctx.fillText(ln, el.x + pad, cy + i * blh));
        cy += bLines.length * blh;
      }
      // メタ（タグなど）
      if (el.meta) {
        cy += 6;
        ctx.font = wtFont(Math.max(10, el.fs - 5));
        ctx.fillStyle = wtCss("--text-dim", "#9fb3a6");
        ctx.fillText(el.meta.slice(0, 80), el.x + pad, cy);
      }
      break;
    }
  }
  ctx.restore();
}

/* ---------- 背景グリッド ---------- */
function wtDrawGrid(ctx, w, h) {
  const step = 24 * WT.view.s;
  if (step < 8) return;
  const ox = ((WT.view.x % step) + step) % step;
  const oy = ((WT.view.y % step) + step) % step;
  ctx.save();
  ctx.fillStyle = wtCss("--map-line", "rgba(255,255,255,.16)");
  ctx.globalAlpha = 0.55;
  const r = WT.view.s >= 1 ? 1.1 : 0.9;
  for (let x = ox; x < w; x += step) {
    for (let y = oy; y < h; y += step) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

/* ---------- 選択枠・ハンドル（画面座標） ---------- */
const WT_HANDLES = ["nw", "ne", "sw", "se"];
function wtHandleRects(el) {
  const b = wtBBox(el);
  const a = wtToScreen(b.x, b.y), c = wtToScreen(b.x + b.w, b.y + b.h);
  const s = 9;
  const pt = { nw: [a.x, a.y], ne: [c.x, a.y], sw: [a.x, c.y], se: [c.x, c.y] };
  const out = {};
  WT_HANDLES.forEach((k) => { out[k] = { x: pt[k][0] - s / 2, y: pt[k][1] - s / 2, w: s, h: s }; });
  return out;
}
function wtHitHandle(px, py) {
  const sel = wtSelected();
  if (sel.length !== 1 || !wtResizable(sel[0])) return null;
  const hs = wtHandleRects(sel[0]);
  for (const k of WT_HANDLES) {
    const r = hs[k];
    if (px >= r.x - 3 && px <= r.x + r.w + 3 && py >= r.y - 3 && py <= r.y + r.h + 3) return { key: k, el: sel[0] };
  }
  return null;
}
function wtDrawSelection(ctx) {
  const sel = wtSelected();
  if (!sel.length) return;
  const accent = wtCss("--accent", "#5fcf8e");
  ctx.save();
  ctx.strokeStyle = accent; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
  sel.forEach((el) => {
    const b = wtBBox(el);
    const a = wtToScreen(b.x, b.y);
    ctx.strokeRect(a.x - 3, a.y - 3, b.w * WT.view.s + 6, b.h * WT.view.s + 6);
  });
  ctx.setLineDash([]);
  if (sel.length === 1 && wtResizable(sel[0])) {
    const hs = wtHandleRects(sel[0]);
    ctx.fillStyle = wtCss("--bg-soft", "#16201b");
    WT_HANDLES.forEach((k) => {
      const r = hs[k];
      ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.fill(); ctx.stroke();
    });
  }
  ctx.restore();
}
function wtDrawMarquee(ctx) {
  if (!WT.marquee) return;
  const m = WT.marquee;
  const a = wtToScreen(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1));
  const b = wtToScreen(Math.max(m.x0, m.x1), Math.max(m.y0, m.y1));
  const accent = wtCss("--accent", "#5fcf8e");
  ctx.save();
  ctx.fillStyle = wtHexA(accent.startsWith("#") ? accent : "#5fcf8e", 0.12);
  ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
  ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.restore();
}

/* ---------- 本描画 ---------- */
function wtDraw() {
  const cv = WT.canvas, ctx = WT.ctx;
  if (!cv || !ctx) return;
  const w = cv.width / WT.dpr, h = cv.height / WT.dpr;
  ctx.setTransform(WT.dpr, 0, 0, WT.dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  wtDrawGrid(ctx, w, h);
  ctx.save();
  ctx.translate(WT.view.x, WT.view.y);
  ctx.scale(WT.view.s, WT.view.s);
  WT.els.forEach((el) => { if (el.id !== WT.editingId) wtDrawEl(ctx, el); });
  if (WT.draft) wtDrawEl(ctx, WT.draft);
  ctx.restore();
  wtDrawSelection(ctx);
  wtDrawMarquee(ctx);
  const hint = document.getElementById("wt-hint");
  if (hint) hint.hidden = WT.els.length > 0;
}

/* ---------- キャンバスのサイズ調整 ---------- */
function wtResizeCanvas() {
  const cv = WT.canvas;
  if (!cv) return;
  const r = cv.getBoundingClientRect();
  if (!r.width || !r.height) return;
  WT.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = Math.round(r.width * WT.dpr), h = Math.round(r.height * WT.dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  wtDraw();
}

/* ---------- ビュー操作 ---------- */
function wtZoomAt(px, py, factor) {
  const before = wtToWorld(px, py);
  WT.view.s = Math.max(0.15, Math.min(5, WT.view.s * factor));
  const after = wtToWorld(px, py);
  WT.view.x += (after.x - before.x) * WT.view.s;
  WT.view.y += (after.y - before.y) * WT.view.s;
  wtDraw(); wtSyncUI();
}
function wtZoomCenter(factor) {
  const cv = WT.canvas; if (!cv) return;
  const r = cv.getBoundingClientRect();
  wtZoomAt(r.width / 2, r.height / 2, factor);
}
function wtResetView() { WT.view = { x: 0, y: 0, s: 1 }; wtDraw(); wtSyncUI(); }
function wtFitView() {
  const cv = WT.canvas; if (!cv) return;
  const b = wtElsBBox(WT.els);
  if (!b || !b.w || !b.h) { wtResetView(); return; }
  const r = cv.getBoundingClientRect();
  const pad = 60;
  const s = Math.max(0.15, Math.min(3, Math.min((r.width - pad * 2) / b.w, (r.height - pad * 2) / b.h)));
  WT.view.s = s;
  WT.view.x = r.width / 2 - (b.x + b.w / 2) * s;
  WT.view.y = r.height / 2 - (b.y + b.h / 2) * s;
  wtDraw(); wtSyncUI();
}
/* 画面中央の world 座標（新規要素の配置に使う） */
function wtViewCenter() {
  const cv = WT.canvas;
  if (!cv) return { x: 0, y: 0 };
  const r = cv.getBoundingClientRect();
  return wtToWorld(r.width / 2, r.height / 2);
}

/* ---------- 要素の追加・削除 ---------- */
function wtAdd(el, opts) {
  opts = opts || {};
  if (!opts.noUndo) wtPushUndo();
  el.id = el.id || wtUid();
  WT.els.push(el);
  WT.dirty = true;
  if (opts.select) { WT.sel.clear(); WT.sel.add(el.id); }
  wtDraw(); wtSyncUI();
  return el;
}
function wtDeleteSelected() {
  if (!WT.sel.size) return;
  wtPushUndo();
  WT.els = WT.els.filter((e) => !WT.sel.has(e.id));
  WT.sel.clear();
  wtDraw(); wtSyncUI();
}
function wtDuplicateSelected() {
  const sel = wtSelected();
  if (!sel.length) return;
  wtPushUndo();
  const ids = [];
  sel.forEach((el) => {
    const c = JSON.parse(JSON.stringify(el));
    c.id = wtUid();
    wtMoveEl(c, 18, 18);
    WT.els.push(c); ids.push(c.id);
  });
  WT.sel = new Set(ids);
  wtDraw(); wtSyncUI();
}
function wtClearBoard() {
  if (!WT.els.length) return;
  if (!confirm("ワークテーブルの内容をすべて消去します。\n（エクスポートしていない内容は元に戻せません）よろしいですか？")) return;
  wtPushUndo();
  WT.els = []; WT.sel.clear(); WT.images = {};
  WT.dirty = false;
  wtDraw(); wtSyncUI();
}
