"use strict";
/* =========================================================================
   知識の箱庭 — 追加機能まとめ（features.js）
   ■ 本形式ビュー（両開きの白い罫線ノートブック・ページめくり）
   ■ ワークテーブル 全画面表示 ＋ 全画面用ツールドック
   このファイルは app.js より先に読み込まれ、app.js の init() から
   initFeatures() を呼ぶことで起動する。
   ========================================================================= */

/* ============================================================
   1) 本形式ビュー（カテゴリごとの本棚 ＋ 両開きの本）
   ============================================================ */
let bookList = [];
let bookIndex = 0;
let bookAnim = false;
let bookSourceVal = "__all__";   // 現在開いている本のソース
let bookReadMode = false;         // false=本棚, true=読書
const SHELF_COLORS = ["#8a5a44", "#5b7b6e", "#4f6d8a", "#9a6b3f", "#7a5b8a", "#a8554e", "#5e7d4f", "#b08a3e", "#4a6b7a", "#864f5e", "#6b6f4a", "#7a4f6b"];

/* ページの並び順（記録日時） asc=古い順（1ページ目が最も古い） / desc=新しい順 */
function bookOrderDir() {
  const v = (Settings.get() || {}).bookOrder;
  return v === "desc" ? "desc" : "asc";
}
function bookOrderLabel() { return bookOrderDir() === "asc" ? "古い順" : "新しい順"; }

function bookSourceCards() {
  const src = bookSourceVal;
  let data = cards.slice();
  if (src === "__uncat__") data = data.filter((c) => !(c.categories || []).length);
  else if (src && src !== "__all__") data = data.filter((c) => (c.categories || []).includes(src));
  // ページ順は「記録日時」で決まる（記録日時を編集するとページの並びが変わる）
  const sign = bookOrderDir() === "desc" ? -1 : 1;
  data.sort((a, b) => sign * cardRecordedAt(a).localeCompare(cardRecordedAt(b)));
  return data;
}

/* 本棚に並べる本（背表紙）の HTML */
function shelfBookHTML(b, colorIdx) {
  const color = SHELF_COLORS[colorIdx % SHELF_COLORS.length];
  const h = 156 + (b.count % 8) * 8; // 本の高さを少しばらつかせる
  return '<button type="button" class="shelf-book" data-src="' + escapeHtml(b.src) + '" style="--bh:' + h + "px;--sc:" + color + '">'
    + '<span class="sb-top"></span>'
    + '<span class="sb-title">' + escapeHtml(b.title) + "</span>"
    + '<span class="sb-count">' + b.count + "</span>"
    + "</button>";
}

/* 本棚を構築（カテゴリ/フォルダごとに 1 冊） */
function renderShelf() {
  const special = $("#shelf-special"), cats = $("#shelf-cats");
  if (!special || !cats) return;
  const allCount = cards.length;
  const uncat = cards.filter((c) => !(c.categories || []).length).length;
  const books = [{ src: "__all__", title: "すべてのカード", count: allCount }];
  if (uncat > 0) books.push({ src: "__uncat__", title: "未分類", count: uncat });
  special.innerHTML = books.map((b) => shelfBookHTML(b, 0)).join("");

  const set = new Set();
  cards.forEach((c) => (c.categories || []).forEach((x) => set.add(x)));
  (Settings.get().folders || []).forEach((f) => { if (f && f.name) set.add(f.name); });
  const names = [...set].sort();
  cats.innerHTML = names.map((n, idx) => {
    const cnt = cards.filter((c) => (c.categories || []).includes(n)).length;
    return shelfBookHTML({ src: n, title: n, count: cnt }, 1 + (idx % (SHELF_COLORS.length - 1)));
  }).join("");

  [special, cats].forEach((box) => box.querySelectorAll(".shelf-book").forEach((el) => {
    el.onclick = () => onShelfBookClick(el.dataset.src, el);
  }));
}

/* 本をクリック → 少し持ち上げてから開く */
function onShelfBookClick(src, spineEl) {
  if (spineEl && !bookAnim) {
    spineEl.classList.add("lifting");
    setTimeout(() => { spineEl.classList.remove("lifting"); openBook(src); }, 340);
  } else {
    openBook(src);
  }
}

/* 本を開いて読書モードへ */
function openBook(src) {
  bookSourceVal = src || "__all__";
  bookReadMode = true;
  const shelf = $("#book-shelf"), reader = $("#book-reader");
  if (shelf) shelf.hidden = true;
  if (reader) {
    reader.hidden = false;
    reader.classList.remove("book-open");
    void reader.offsetWidth; // アニメを再スタートさせるための reflow
    reader.classList.add("book-open");
  }
  const ind = $("#book-ind"), back = $("#book-back"), fsb = $("#book-fullscreen"), ord = $("#book-order");
  if (ind) ind.hidden = false;
  if (back) back.hidden = false;
  if (fsb) fsb.hidden = false;
  if (ord) { ord.hidden = false; ord.textContent = "並び順: " + bookOrderLabel(); }
  bookShow(0, 0);
}

/* 読書モードを終了して本棚へ戻る */
function closeBook() {
  bookReadMode = false;
  const shelf = $("#book-shelf"), reader = $("#book-reader");
  if (reader) {
    reader.classList.remove("book-fs", "book-fs-fb");
    reader.hidden = true;
  }
  if (shelf) shelf.hidden = false;
  const ind = $("#book-ind"), back = $("#book-back"), fsb = $("#book-fullscreen"), fsx = $("#book-fs-exit"), ord = $("#book-order");
  if (ind) ind.hidden = true;
  if (back) back.hidden = true;
  if (fsb) fsb.hidden = true;
  if (fsx) fsx.hidden = true;
  if (ord) ord.hidden = true;
}

/* 1ページ＝1カードでページに書き込む */
function fillBookPage(pageEl, c, pageNo, total) {
  if (!pageEl) return;
  pageEl.dataset.id = c ? c.id : "";
  const inner = pageEl.querySelector(".bp-inner");
  const pn = pageEl.querySelector(".book-pageno");
  const end = inner.querySelector(".bp-end");
  if (end) end.hidden = !!c;
  if (!c) {
    inner.querySelector(".bp-type").innerHTML = "";
    inner.querySelector(".bp-title").textContent = "";
    inner.querySelector(".bp-stars").innerHTML = "";
    inner.querySelector(".bp-meta-line").innerHTML = "";
    inner.querySelector(".bp-body").textContent = "";
    inner.querySelector(".bp-fields").innerHTML = "";
    inner.querySelector(".bp-meta").innerHTML = "";
    if (pn) pn.textContent = pageNo + " / " + total;
    return;
  }
  inner.querySelector(".bp-type").innerHTML = "";
  inner.querySelector(".bp-title").textContent = c.title || "";
  inner.querySelector(".bp-stars").innerHTML =
    '<span class="stars" title="重要度">' + stars(c.importance || 3) + "</span>" +
    '<span class="stars" title="理解度">' + stars(c.understanding || 3) + "</span>";
  const cats = (c.categories || []).map(escapeHtml).join("、 ");
  const tags = (c.tags || []).map((t) => escapeHtml(t)).join(" ");
  inner.querySelector(".bp-meta-line").innerHTML =
    (cats ? '<div class="bp-line"><span class="bp-k">カテゴリ</span>' + cats + "</div>" : "") +
    '<div class="bp-line"><span class="bp-k">タグ</span><span class="bp-tags-edit" contenteditable="true" spellcheck="false" data-ph="(スペース区切りで編集)">' + tags + "</span></div>";
  inner.querySelector(".bp-body").textContent = c.body || "";
  const fields = (c.fields || []).filter((f) => (f.value || "").toString().trim() !== "");
  inner.querySelector(".bp-fields").innerHTML = fields.map((f) =>
    '<div class="bp-field"><span class="bp-fname">' + escapeHtml(f.name) + '</span><span class="bp-fval" contenteditable="true" spellcheck="false" data-fname="' + escapeHtml(f.name) + '">' + escapeHtml(String(f.value)) + "</span></div>"
  ).join("");
  const upd = c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : "";
  const recVal = isoToLocalInput(cardRecordedAt(c));
  inner.querySelector(".bp-meta").innerHTML =
    '<span class="bp-rec"><span class="bp-k">記録</span>'
    + '<input type="datetime-local" step="60" class="bp-created" value="' + recVal + '" title="記録日時（変更するとページの並び順が変わります）">'
    + "</span>"
    + (upd ? '<span class="bp-upd">更新: ' + upd + "</span>" : "");
  if (pn) pn.textContent = pageNo + " / " + total;
}

function bookShow(i, dir) {
  bookList = bookSourceCards();
  const len = bookList.length;
  const empty = $("#book-empty"), ind = $("#book-ind");
  const al = $("#book-arrow-l"), ar = $("#book-arrow-r");
  const left = $("#book-left"), right = $("#book-right");
  if (!len) {
    if (empty) empty.hidden = false;
    if (ind) ind.hidden = true;
    if (al) { al.disabled = true; al.classList.add("is-edge"); }
    if (ar) { ar.disabled = true; ar.classList.add("is-edge"); }
    return;
  }
  if (empty) empty.hidden = true;
  if (ind) ind.hidden = false;
  // 見開きの先頭（左ページ）は偶数ページ番号（0,2,4,…）にスナップ
  const maxLeft = len % 2 === 0 ? len - 2 : len - 1;
  if (i < 0) i = 0;
  if (i > maxLeft) i = maxLeft;
  i = Math.floor(i / 2) * 2;
  bookIndex = i;
  const cL = bookList[i], cR = bookList[i + 1];
  const doFill = () => {
    fillBookPage(left, cL, i + 1, len);
    fillBookPage(right, cR, Math.min(i + 2, len), len);
  };
  // ページめくりアニメ（方向に応じて右/左のページがそれぞれ逆方向にめくれる）
  if ((right || left) && dir !== 0 && !bookAnim) {
    bookAnim = true;
    if (dir > 0) {
      // 次へ：右ページを前へめくる（左ページはわずかにスライド）
      right.classList.add("flip-next");
      if (left) left.classList.add("shift-fwd");
      setTimeout(() => {
        doFill();
        if (left) left.classList.remove("shift-fwd");
      }, 200);
      setTimeout(() => { right.classList.remove("flip-next"); bookAnim = false; }, 430);
    } else {
      // 前へ：左ページを逆方向（右）へめくる（右ページはわずかにスライド）
      left.classList.add("flip-back");
      if (right) right.classList.add("shift-back");
      setTimeout(() => {
        doFill();
        if (right) right.classList.remove("shift-back");
      }, 200);
      setTimeout(() => { left.classList.remove("flip-back"); bookAnim = false; }, 430);
    }
  } else {
    doFill();
  }
  const rp = Math.min(i + 2, len);
  if (ind) ind.textContent = (i + 1 === rp) ? (i + 1) + " / " + len : (i + 1) + "–" + rp + " / " + len;
  if (al) { al.disabled = (i <= 0); al.classList.toggle("is-edge", i <= 0); }
  if (ar) { ar.disabled = (i >= maxLeft); ar.classList.toggle("is-edge", i >= maxLeft); }
}

function bookGo(dir) {
  const len = bookList.length;
  const maxLeft = len % 2 === 0 ? len - 2 : len - 1;
  if (dir < 0 && bookIndex <= 0) return;
  if (dir > 0 && bookIndex >= maxLeft) return;
  bookShow(bookIndex + dir * 2, dir);
}

function renderBook() {
  if (!$("#view-book") || !$("#view-book").classList.contains("active")) return;
  renderShelf();
  closeBook(); // 本棚を表示
}

function initBook() {
  const al = $("#book-arrow-l"), ar = $("#book-arrow-r"), back = $("#book-back");
  if (al) al.onclick = () => bookGo(-1);
  if (ar) ar.onclick = () => bookGo(1);
  if (back) back.onclick = () => closeBook();
  document.addEventListener("keydown", (e) => {
    const vb = $("#view-book");
    if (!vb || !vb.classList.contains("active")) return;
    if (!bookReadMode) return;
    if (e.key === "ArrowRight") { bookGo(1); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { bookGo(-1); e.preventDefault(); }
    else if (e.key === "Escape") { closeBook(); }
  });

  /* ---- 本への直接書き込み（自動保存） ---- */
  let bookEditTimer = null;
  const savePageEdit = (pageEl) => {
    if (!pageEl) return;
    const id = pageEl.dataset.id;
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const inner = pageEl.querySelector(".bp-inner");
    const t = inner.querySelector(".bp-title");
    const b = inner.querySelector(".bp-body");
    if (t) card.title = t.textContent.trim() || "(無題)";
    if (b) card.body = b.textContent;
    const tagsEl = inner.querySelector(".bp-tags-edit");
    if (tagsEl) card.tags = tagsEl.textContent.split(/[\s、,，]+/).filter(Boolean);
    inner.querySelectorAll(".bp-fval").forEach((fv) => {
      const f = (card.fields || []).find((x) => x.name === fv.dataset.fname);
      if (f) f.value = fv.textContent;
    });
    card.updatedAt = nowISO();
    Store.put(card);
    const updEl = inner.querySelector(".bp-upd");
    if (updEl) updEl.textContent = "更新: " + new Date().toLocaleDateString();
  };
  /* ---- 記録日時をページ上で直接編集（ページの並び順が変わる） ---- */
  const saveRecordedAt = (inp) => {
    const pageEl = inp.closest(".book-page");
    if (!pageEl) return;
    const id = pageEl.dataset.id;
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const iso = localInputToISO(inp.value);
    if (!iso || iso === card.createdAt) return;
    card.createdAt = iso;
    Store.put(card);
    // 並べ替え後も同じカードを開いたままにする
    const list = bookSourceCards();
    const idx = list.findIndex((c) => c.id === id);
    bookShow(idx < 0 ? bookIndex : idx, 0);
  };

  const bb = $("#book-book");
  if (bb) {
    bb.addEventListener("input", (e) => {
      if (e.target.classList && e.target.classList.contains("bp-created")) return;
      const pageEl = e.target.closest ? e.target.closest(".book-page") : null;
      if (!pageEl) return;
      clearTimeout(bookEditTimer);
      bookEditTimer = setTimeout(() => savePageEdit(pageEl), 600);
    });
    bb.addEventListener("blur", (e) => {
      if (e.target.classList && e.target.classList.contains("bp-created")) return;
      const pageEl = e.target.closest ? e.target.closest(".book-page") : null;
      if (!pageEl) return;
      clearTimeout(bookEditTimer);
      savePageEdit(pageEl);
    }, true);
    bb.addEventListener("change", (e) => {
      if (!e.target.classList || !e.target.classList.contains("bp-created")) return;
      saveRecordedAt(e.target);
    });
  }

  /* ---- ページの並び順（記録日時 古い順 / 新しい順） ---- */
  const ordBtn = $("#book-order");
  if (ordBtn) {
    ordBtn.textContent = "並び順: " + bookOrderLabel();
    ordBtn.onclick = () => {
      const s = Settings.get() || {};
      s.bookOrder = bookOrderDir() === "asc" ? "desc" : "asc";
      Settings.save(s);
      ordBtn.textContent = "並び順: " + bookOrderLabel();
      bookShow(0, 0);
    };
  }

  /* ---- 本の全画面表示 ---- */
  const rdr = $("#book-reader");
  const fsBtn = $("#book-fullscreen"), fsExit = $("#book-fs-exit");
  const syncBookFs = () => {
    const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement) ||
      rdr.classList.contains("book-fs-fb");
    rdr.classList.toggle("book-fs", inFs);
    if (fsExit) fsExit.hidden = !inFs;
  };
  if (fsBtn && rdr) {
    fsBtn.onclick = () => {
      if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
        rdr.classList.add("book-fs-fb"); // CSS フォールバック
        syncBookFs();
        return;
      }
      const req = rdr.requestFullscreen || rdr.webkitRequestFullscreen;
      if (req) { const r = req.call(rdr); if (r && r.catch) r.catch(() => {}); }
    };
    if (fsExit) fsExit.onclick = () => {
      if (rdr.classList.contains("book-fs-fb")) {
        rdr.classList.remove("book-fs-fb");
        syncBookFs();
        return;
      }
      const ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (ex) ex.call(document);
    };
    document.addEventListener("fullscreenchange", syncBookFs);
    document.addEventListener("webkitfullscreenchange", syncBookFs);
  }
}

/* ============================================================
   3) ワークテーブル 全画面表示 ＋ 全画面用ツールドック
   ============================================================ */
function initWtFullscreen() {
  const btn = $("#wt-fullscreen");
  const wrap = $("#wt-wrap");
  const dock = $("#wt-dock");
  if (!btn || !wrap) return;

  const syncClass = () => {
    if (document.fullscreenElement) {
      wrap.classList.add("wt-fs");
      if (dock) dock.classList.add("wt-dock-on");
    } else {
      wrap.classList.remove("wt-fs");
      if (dock) dock.classList.remove("wt-dock-on");
    }
    setTimeout(() => { if (typeof wtResizeCanvas === "function") wtResizeCanvas(); }, 60);
  };
  document.addEventListener("fullscreenchange", syncClass);
  document.addEventListener("webkitfullscreenchange", syncClass);

  btn.onclick = () => {
    if (document.fullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
      return;
    }
    const req = wrap.requestFullscreen || wrap.webkitRequestFullscreen || wrap.msRequestFullscreen;
    if (req) {
      try { req.call(wrap); return; } catch (e) { /* フォールバックへ */ }
    }
    // Fullscreen API が使えない環境（iframe 等）向け CSS フォールバック
    wrap.classList.toggle("wt-fs");
    if (dock) dock.classList.toggle("wt-dock-on");
    syncClass();
  };
}

/* 全画面中用ドックの構築・バインド */
function initWtDock() {
  const dock = $("#wt-dock");
  if (!dock) return;
  // ツールボタン
  dock.querySelectorAll(".wt-tool[data-tool]").forEach((b) => {
    b.onclick = () => { if (typeof wtSetTool === "function") wtSetTool(b.dataset.tool); };
  });
  // カラーパレット（WT_PALETTE から生成）
  const cbox = $("#wt-dock-colors");
  if (cbox && typeof WT_PALETTE !== "undefined") {
    cbox.innerHTML = "";
    WT_PALETTE.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wt-sw" + (c === WT.color ? " active" : "");
      b.dataset.color = c;
      b.title = c === "auto" ? "自動（テーマの文字色）" : c;
      if (c !== "auto") b.style.background = c;
      b.onclick = () => { WT.color = c; if (typeof wtApplyStyle === "function") wtApplyStyle("color", c); if (typeof wtSyncUI === "function") wtSyncUI(); };
      cbox.appendChild(b);
    });
  }
  const bind = (id, fn) => { const b = $("#" + id); if (b && typeof fn === "function") b.onclick = fn; };
  bind("wt-dock-undo", wtUndo);
  bind("wt-dock-redo", wtRedo);
  bind("wt-dock-del", wtDeleteSelected);
  bind("wt-dock-clear", wtClearBoard);
  bind("wt-dock-pick", wtOpenPick);
  bind("wt-dock-png", wtExportPNG);
  bind("wt-dock-board", wtExportBoard);
  bind("wt-dock-exit", () => {
    if (document.fullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
    else { const w = $("#wt-wrap"); if (w) w.classList.remove("wt-fs"); dock.classList.remove("wt-dock-on"); if (typeof wtResizeCanvas === "function") setTimeout(wtResizeCanvas, 60); }
  });
  // 状態を同期（アクティブツール等）
  if (typeof wtSyncUI === "function") wtSyncUI();
}

/* ============================================================
   起動
   ============================================================ */
function initFeatures() {
  initBook();
  initWtFullscreen();
  initWtDock();
}
