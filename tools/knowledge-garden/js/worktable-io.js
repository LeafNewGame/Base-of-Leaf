"use strict";
/* =========================================================================
   ワークテーブル — 入出力
     ・画像の貼り付け（クリップボード / ドラッグ＆ドロップ / ファイル選択）
     ・アイデアカードなどから「内容の文字」を引っ張り出して貼り付け
     ・保存＝エクスポート：PNG 画像 / ボードファイル(.kgboard.json) を
       ローカル端末へ「名前を付けて保存」（クラウドには一切保存しない）
   ========================================================================= */

/* ---------- 共通：ローカル端末へ「名前を付けて保存」 ---------- */
async function wtSaveBlob(makeBlob, name, desc, mime, ext) {
  let handle = null;
  // Chrome / Edge：OS の「名前を付けて保存」ダイアログを出す
  if (window.showSaveFilePicker) {
    try {
      const acc = {}; acc[mime] = [ext];
      handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: desc, accept: acc }] });
    } catch (e) {
      if (e && e.name === "AbortError") return false;   // ユーザーがキャンセル
      handle = null;                                     // 非対応 → 通常ダウンロードへ
    }
  }
  const blob = await makeBlob();
  if (handle) {
    const w = await handle.createWritable();
    await w.write(blob); await w.close();
    return true;
  }
  // Safari / Firefox 等：ダウンロード（ブラウザ設定により保存先を尋ねられます）
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 6000);
  return true;
}
function wtStamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
}
function wtToast(msg) {
  const el = document.getElementById("wt-msg");
  if (!el) return;
  el.textContent = msg;
  clearTimeout(WT._toastT);
  WT._toastT = setTimeout(() => (el.textContent = ""), 3200);
}

/* ---------- 画像 ---------- */
function wtInsertImage(src, at) {
  const id = "img_" + Math.random().toString(36).slice(2, 9);
  const img = new Image();
  WT.images[id] = { src: src, el: img };
  img.onload = () => {
    const maxW = 520, maxH = 420;
    let w = img.naturalWidth || 320, h = img.naturalHeight || 240;
    const k = Math.min(1, maxW / w, maxH / h);
    w = Math.round(w * k); h = Math.round(h * k);
    const c = at || wtViewCenter();
    wtAdd({ t: "image", x: c.x - w / 2, y: c.y - h / 2, w: w, h: h, img: id }, { select: true });
    wtSetTool("select");
    wtToast("画像を貼り付けました");
  };
  img.onerror = () => wtToast("画像を読み込めませんでした");
  img.src = src;
}
function wtAddImageFile(file, at) {
  if (!file || !/^image\//.test(file.type)) return;
  if (file.size > 12 * 1024 * 1024) { wtToast("画像が大きすぎます（12MB まで）"); return; }
  const fr = new FileReader();
  fr.onload = () => wtInsertImage(String(fr.result), at);
  fr.readAsDataURL(file);
}
function wtOnPaste(ev) {
  if (!wtIsActiveView()) return;
  const ta = document.getElementById("wt-text-edit");
  if (ta && !ta.hidden) return;                 // テキスト編集中は通常の貼り付け
  if (wtTypingInField(ev.target)) return;
  const items = (ev.clipboardData && ev.clipboardData.items) || [];
  let used = false;
  for (const it of items) {
    if (it.kind === "file" && /^image\//.test(it.type)) { wtAddImageFile(it.getAsFile()); used = true; }
  }
  if (used) { ev.preventDefault(); return; }
  const text = ev.clipboardData && ev.clipboardData.getData("text/plain");
  if (text && text.trim()) {
    ev.preventDefault();
    const c = wtViewCenter();
    wtAdd({ t: "text", x: c.x - 160, y: c.y - 20, w: 320, text: text.trim().slice(0, 4000), color: WT.color, fs: WT.fs }, { select: true });
    wtSetTool("select");
    wtToast("テキストを貼り付けました");
  }
}

/* ---------- カードから文字を引っ張り出す ---------- */
function wtCardHeight(el) {
  const ctx = WT.ctx;
  if (!ctx) return 160;
  const pad = 14, innerW = el.w - pad * 2;
  ctx.font = wtFont(el.fs + 2, "700");
  const t = wtWrapLines(ctx, el.title || "(無題)", innerW).length * ((el.fs + 2) * 1.4);
  ctx.font = wtFont(el.fs);
  const bl = el.body ? wtWrapLines(ctx, el.body, innerW) : [];
  const b = bl.length ? 10 + bl.length * (el.fs * 1.5) : 0;
  const m = el.meta ? 6 + el.fs * 1.4 : 0;
  return pad * 2 + t + b + m;
}
function wtPickCards() { return Store.getAll(); }

function wtOpenPick() {
  const bd = document.getElementById("wt-pick-backdrop");
  if (!bd) return;
  // フォルダ（カテゴリ）の選択肢を作る
  const sel = document.getElementById("wt-pick-folder");
  const cats = new Set();
  wtPickCards().forEach((c) => (c.categories || []).forEach((x) => cats.add(x)));
  (Settings.get().folders || []).forEach((f) => cats.add(f.name));
  const cur = sel.value;
  sel.innerHTML = '<option value="">すべてのフォルダ</option><option value="__none__">未分類</option>' +
    Array.from(cats).sort().map((c) => '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>").join("");
  if (cur) sel.value = cur;
  WT._picked = new Set();
  document.getElementById("wt-pick-search").value = "";
  wtRenderPick();
  bd.hidden = false;
}
function wtRenderPick() {
  const list = document.getElementById("wt-pick-list");
  if (!list) return;
  const q = (document.getElementById("wt-pick-search").value || "").trim().toLowerCase();
  const folder = document.getElementById("wt-pick-folder").value;
  let arr = wtPickCards();
  if (folder === "__none__") arr = arr.filter((c) => !(c.categories || []).length);
  else if (folder) arr = arr.filter((c) => (c.categories || []).includes(folder));
  if (q) arr = arr.filter((c) => ((c.title || "") + " " + (c.body || "") + " " + (c.tags || []).join(" ")).toLowerCase().includes(q));
  arr = arr.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  if (!arr.length) { list.innerHTML = '<div class="wt-pick-empty">該当するカードがありません</div>'; wtPickCount(); return; }
  list.innerHTML = "";
  arr.forEach((c) => {
    const row = document.createElement("label");
    row.className = "wt-pick-item";
    const checked = WT._picked.has(c.id) ? " checked" : "";
    row.innerHTML =
      '<input type="checkbox" value="' + escapeHtml(c.id) + '"' + checked + ">" +
      '<span class="wt-pick-main">' +
      '<span class="wt-pick-title">' + escapeHtml(c.title || "(無題)") + "</span>" +
      '<span class="wt-pick-sub">' + escapeHtml((c.body || "").replace(/\s+/g, " ").slice(0, 70)) + "</span>" +
      "</span>" +
      '<span class="wt-pick-badge">' + escapeHtml("カード") + "</span>";
    const cb = row.querySelector("input");
    cb.onchange = () => { if (cb.checked) WT._picked.add(c.id); else WT._picked.delete(c.id); wtPickCount(); };
    list.appendChild(row);
  });
  wtPickCount();
}
function wtPickCount() {
  const el = document.getElementById("wt-pick-count");
  if (el) el.textContent = WT._picked.size ? WT._picked.size + " 件選択中" : "";
}
function wtInsertPicked() {
  const mode = (document.querySelector('input[name="wt-pick-mode"]:checked') || {}).value || "note";
  const all = wtPickCards();
  const list = all.filter((c) => WT._picked.has(c.id));
  if (!list.length) { alert("カードを選択してください"); return; }
  const center = wtViewCenter();
  const W = 300, GAP = 22;
  const cols = Math.min(3, list.length);
  const startX = center.x - (cols * W + (cols - 1) * GAP) / 2;
  const colY = new Array(cols).fill(center.y - 180);
  wtPushUndo();
  const ids = [];
  list.forEach((c, i) => {
    const col = i % cols;
    const x = startX + col * (W + GAP);
    const y = colY[col];
    let el;
    if (mode === "note") {
      el = {
        id: wtUid(), t: "card", x: x, y: y, w: W,
        title: c.title || "(無題)",
        body: (c.body || "").slice(0, 1200),
        meta: (c.tags || []).slice(0, 4).join("  "),
        tone: "#5fcf8e",
        fs: 14, cardId: c.id,
      };
      colY[col] = y + wtCardHeight(el) + GAP;
    } else {
      const text = mode === "title" ? (c.title || "(無題)")
        : mode === "body" ? (c.body || "")
          : ((c.title || "") + "\n" + (c.body || ""));
      el = { id: wtUid(), t: "text", x: x, y: y, w: W, text: text.slice(0, 2000), color: WT.color, fs: WT.fs };
      const ctx = WT.ctx;
      let h = 60;
      if (ctx) { ctx.font = wtFont(el.fs); h = wtWrapLines(ctx, el.text, el.w).length * el.fs * 1.45; }
      colY[col] = y + h + GAP;
    }
    WT.els.push(el); ids.push(el.id);
  });
  WT.sel = new Set(ids);
  WT.dirty = true;
  wtSetToolSilent("select");
  wtDraw(); wtSyncUI();
  document.getElementById("wt-pick-backdrop").hidden = true;
  wtToast(list.length + " 枚のカードを貼り付けました");
}

/* ---------- 書き出し：PNG ---------- */
async function wtExportPNG() {
  if (!WT.els.length) { alert("ワークテーブルが空です"); return; }
  const b = wtElsBBox(WT.els);
  const pad = 44;
  let scale = 2;
  const wpx = (b.w + pad * 2), hpx = (b.h + pad * 2);
  const maxSide = 8000;
  scale = Math.min(scale, maxSide / Math.max(wpx, hpx));
  scale = Math.max(0.5, scale);
  const bg = wtBoardBg();
  const ok = await wtSaveBlob(() => new Promise((resolve) => {
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(wpx * scale));
    cv.height = Math.max(1, Math.round(hpx * scale));
    const ctx = cv.getContext("2d");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, wpx, hpx);
    ctx.translate(-b.x + pad, -b.y + pad);
    WT.els.forEach((el) => wtDrawEl(ctx, el));
    cv.toBlob((blob) => resolve(blob), "image/png");
  }), "worktable-" + wtStamp() + ".png", "PNG 画像", "image/png", ".png");
  if (ok) { WT.dirty = false; wtSyncUI(); wtToast("PNG を保存しました"); }
}

/* ---------- 書き出し：ボードファイル（再編集できる形式） ---------- */
async function wtExportBoard() {
  if (!WT.els.length) { alert("ワークテーブルが空です"); return; }
  const imgs = {};
  WT.els.forEach((el) => { if (el.t === "image" && WT.images[el.img]) imgs[el.img] = WT.images[el.img].src; });
  const data = {
    app: "knowledge-garden-worktable",
    version: 1,
    savedAt: new Date().toISOString(),
    view: WT.view,
    els: WT.els,
    images: imgs,
  };
  const ok = await wtSaveBlob(
    () => Promise.resolve(new Blob([JSON.stringify(data)], { type: "application/json" })),
    "worktable-" + wtStamp() + ".kgboard.json", "ワークテーブル ボードファイル", "application/json", ".json"
  );
  if (ok) { WT.dirty = false; wtSyncUI(); wtToast("ボードファイルを保存しました（再編集できます）"); }
}

/* ---------- 読み込み：ボードファイル ---------- */
function wtImportBoard(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    let data;
    try { data = JSON.parse(String(fr.result)); }
    catch (e) { alert("このファイルは読み込めませんでした（JSON として解析できません）"); return; }
    if (!data || !Array.isArray(data.els)) { alert("ワークテーブルのボードファイルではないようです"); return; }
    if (WT.els.length && !confirm("現在のワークテーブルの内容を置き換えます。よろしいですか？")) return;
    WT.els = data.els;
    WT.images = {};
    const srcs = data.images || {};
    Object.keys(srcs).forEach((k) => {
      const img = new Image();
      WT.images[k] = { src: srcs[k], el: img };
      img.onload = () => wtDraw();
      img.src = srcs[k];
    });
    WT.view = data.view && typeof data.view.s === "number" ? data.view : { x: 0, y: 0, s: 1 };
    WT.sel.clear(); WT.undoS.length = 0; WT.redoS.length = 0;
    WT.dirty = false;
    wtDraw(); wtSyncUI();
    wtToast("ボードファイルを読み込みました");
  };
  fr.readAsText(file);
}

/* ---------- バインド ---------- */
function wtBindIO() {
  const q = (id) => document.getElementById(id);

  const fileImg = q("wt-file-image");
  const btnImg = q("wt-image");
  if (btnImg && fileImg) {
    btnImg.onclick = () => fileImg.click();
    fileImg.onchange = (e) => { if (e.target.files && e.target.files[0]) wtAddImageFile(e.target.files[0]); e.target.value = ""; };
  }
  const fileBoard = q("wt-file-board");
  const btnOpen = q("wt-open");
  if (btnOpen && fileBoard) {
    btnOpen.onclick = () => fileBoard.click();
    fileBoard.onchange = (e) => { if (e.target.files && e.target.files[0]) wtImportBoard(e.target.files[0]); e.target.value = ""; };
  }
  const bPng = q("wt-save-png"); if (bPng) bPng.onclick = wtExportPNG;
  const bBoard = q("wt-save-board"); if (bBoard) bBoard.onclick = wtExportBoard;
  const bPick = q("wt-cards"); if (bPick) bPick.onclick = wtOpenPick;

  // カード引用モーダル
  const bd = q("wt-pick-backdrop");
  const close = () => (bd.hidden = true);
  if (bd) {
    q("wt-pick-close").onclick = close;
    q("wt-pick-cancel").onclick = close;
    q("wt-pick-run").onclick = wtInsertPicked;
    q("wt-pick-search").oninput = wtRenderPick;
    q("wt-pick-folder").onchange = wtRenderPick;
    bd.addEventListener("click", (e) => { if (e.target === bd) close(); });
  }

  // クリップボード貼り付け
  document.addEventListener("paste", wtOnPaste);

  // ドラッグ＆ドロップ
  const wrap = q("wt-wrap");
  if (wrap) {
    wrap.addEventListener("dragover", (e) => { e.preventDefault(); wrap.classList.add("dragover"); });
    wrap.addEventListener("dragleave", () => wrap.classList.remove("dragover"));
    wrap.addEventListener("drop", (e) => {
      e.preventDefault(); wrap.classList.remove("dragover");
      const r = WT.canvas.getBoundingClientRect();
      const at = wtToWorld(e.clientX - r.left, e.clientY - r.top);
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
      const imgFile = files.find((f) => /^image\//.test(f.type));
      if (imgFile) { wtAddImageFile(imgFile, at); return; }
      const jsonFile = files.find((f) => /\.json$/i.test(f.name));
      if (jsonFile) { wtImportBoard(jsonFile); return; }
      const txt = e.dataTransfer && e.dataTransfer.getData("text/plain");
      if (txt && txt.trim()) wtAdd({ t: "text", x: at.x, y: at.y, w: 320, text: txt.trim().slice(0, 4000), color: WT.color, fs: WT.fs }, { select: true });
    });
  }
}

/* ---------- 起動（全ファイル読み込み後にここで初期化） ---------- */
document.addEventListener("DOMContentLoaded", function () { if (!WT.booted) wtInit(); });
if (document.readyState !== "loading" && !WT.booted) wtInit();
