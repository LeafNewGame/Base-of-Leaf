"use strict";
/* ---------- フォルダ（ホーム） ---------- */
  const FOLDER_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  let currentFolderCat = null;
  function recentTs(c) { return c.createdAt || c.updatedAt || ""; }
  function renderFolders() {
    const list = $("#folder-list"); if (!list) return;
    const byCat = {};
    cards.forEach((c) => {
      const cats = c.categories || [];
      if (!cats.length) (byCat["未分類"] = byCat["未分類"] || []).push(c);
      else cats.forEach((x) => (byCat[x] = byCat[x] || []).push(c));
    });
    const defs = Settings.get().folders || [];
    const cats = Object.keys(byCat);
    defs.forEach((f) => { if (!cats.includes(f.name)) cats.push(f.name); });
    cats.sort();
    if (!cats.length) { list.innerHTML = '<div class="empty">フォルダがありません。「＋ 新規フォルダ」から作りましょう。</div>'; return; }
    list.innerHTML = "";
    cats.forEach((cat) => {
      const arr = byCat[cat] || [];
      const def = defs.find((f) => f.name === cat);
      const sorted = arr.slice().sort((a, b) => recentTs(b).localeCompare(recentTs(a)));
      const recent = sorted[0];
      const el = document.createElement("div");
      el.className = "folder-card" + (def ? " has-config" : "");
      const cap = def && def.tags && def.tags.length
        ? "自動タグ: " + escapeHtml(def.tags.slice(0, 4).join(", "))
        : "直近に追加したカード";
      el.innerHTML = `
        <div class="folder-top">
          <span class="folder-ico">${FOLDER_SVG}</span>
          <span class="folder-name">${escapeHtml(cat)}</span>
          <span class="folder-count">${arr.length} 枚</span>
        </div>
        <div class="folder-recent">${recent ? escapeHtml(recent.title) : (def ? "（設定済み・空）" : "（空）")}</div>
        <div class="folder-recent-cap">${cap}</div>`;
      el.onclick = () => openFolder(cat);
      list.appendChild(el);
    });
  }
  function openFolder(cat) { currentFolderCat = cat; setView("folder"); }
  function renderFolder() {
    const cat = currentFolderCat;
    if (!cat) return;
    $("#folder-title").textContent = cat === "未分類" ? "未分類" : ("カテゴリ: " + cat);
    const data = cards.filter((c) => cat === "未分類" ? !(c.categories || []).length : (c.categories || []).includes(cat));
    const list = $("#folder-cards");
    if (!data.length) { list.innerHTML = '<div class="empty">このフォルダにはまだカードがありません。「＋ このフォルダに追加」から作りましょう。</div>'; return; }
    const arr = data.slice().sort((a, b) => recentTs(b).localeCompare(recentTs(a)));
    list.innerHTML = "";
    arr.forEach((c) => list.appendChild(cardEl(c)));
  }
  let editorFolderCat = null;
  function openFolderEditor(cat) {
    editorFolderCat = cat || null;
    openEditor(null);
    if (cat && cat !== "未分類") {
      $("#f-categories").value = cat;
      const def = (Settings.get().folders || []).find((f) => f.name === cat);
      if (def && def.tags && def.tags.length) $("#f-tags").value = def.tags.join(", ");
      const fmt = getFolderFormat(cat);
      if (fmt.body) $("#f-body").value = fmt.body;
    }
  }

  /* ---------- フォーマット入力（フィールドビルダ） ---------- */
  // 各枠のサイズは「一行（タイトルサイズ）」か「テンプレート枠（大きい）」の2種類のみ
  function fieldTypeMeta(t) {
    if (t === "box") return { type: "box", label: "テンプレート枠（大きい）" };
    return { type: "line", label: "一行（タイトルサイズ）" };
  }
  function getFolderFormat(cat) {
    const s = Settings.get();
    const tpl = (s.folderTemplates || {})[cat];
    const def = (s.folders || []).find((f) => f.name === cat);
    let body = "", fields = [];
    if (typeof tpl === "string") { body = tpl; }
    else if (tpl && typeof tpl === "object") { body = tpl.body || ""; fields = tpl.fields || []; }
    if (!body && def && def.template) body = def.template;
    if (!fields.length && def && def.fields) fields = def.fields;
    fields = fields.map((f) => {
      const type = f.type === "box" ? "box" : "line";
      return { name: f.name || "", type, def: (f.def != null ? f.def : "") };
    });
    return { body, fields };
  }
  function openFolderFormat() {
    const cat = currentFolderCat; if (!cat) return;
    const fmt = getFolderFormat(cat);
    $("#folder-fmt-body").value = fmt.body || "";
    const box = $("#folder-fields"); box.innerHTML = "";
    (fmt.fields || []).forEach((f) => box.appendChild(makeFieldRow(f)));
    $("#folder-fmt-box").hidden = false;
  }
  function makeFieldRow(f) {
    const meta = fieldTypeMeta(f.type);
    const row = document.createElement("div");
    row.className = "ff-row";
    row.dataset.type = meta.type;
    row.innerHTML =
      '<input class="ff-name" type="text" placeholder="名前（例：タイトル・日付・本文）" value="' + escapeHtml(f.name || "") + '" />' +
      '<input class="ff-def" type="text" placeholder="あらかじめ入る内容（例：日記・11/3）" value="' + escapeHtml(f.def || "") + '" />' +
      '<button type="button" class="ff-type" title="クリックでサイズを切替（一行 ↔ テンプレート枠）">' +
        '<span class="ff-type-label">' + meta.label + '</span></button>' +
      '<button type="button" class="ff-del" title="削除" aria-label="削除"><span class="ki ki-sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg></span></button>';
    row.querySelector(".ff-type").onclick = () => {
      const next = row.dataset.type === "line" ? "box" : "line";
      row.dataset.type = next;
      row.querySelector(".ff-type-label").textContent = fieldTypeMeta(next).label;
    };
    row.querySelector(".ff-del").onclick = () => row.remove();
    return row;
  }
  function saveFolderTemplate() {
    const cat = currentFolderCat; if (!cat) return;
    const fields = [];
    $$("#folder-fields .ff-row").forEach((row) => {
      const name = row.querySelector(".ff-name").value.trim();
      if (!name) return;
      fields.push({ name, type: row.dataset.type || "line", def: row.querySelector(".ff-def").value });
    });
    const s = Settings.get(); s.folderTemplates = s.folderTemplates || {};
    s.folderTemplates[cat] = { body: $("#folder-fmt-body").value, fields };
    Settings.save(s);
    const btn = $("#folder-fmt-save");
    const old = btn.textContent; btn.innerHTML = ki("check") + " 保存済み";
    setTimeout(() => (btn.textContent = old), 1200);
  }
  function clearFolderFormat() {
    const cat = currentFolderCat; if (!cat) return;
    const s = Settings.get(); s.folderTemplates = s.folderTemplates || {};
    delete s.folderTemplates[cat];
    Settings.save(s);
    $("#folder-fmt-body").value = "";
    $("#folder-fields").innerHTML = "";
  }

  /* ---------- フォルダ定義（新規フォルダ・自動タグ） ---------- */
  let folderModalCat = null;
  function openFolderModal(cat) {
    folderModalCat = cat || null;
    $("#folder-create-title").textContent = cat ? ("フォルダ設定: " + cat) : "新規フォルダ";
    const def = cat ? (Settings.get().folders || []).find((f) => f.name === cat) : null;
    $("#fldr-name").value = def ? def.name : (cat || "");
    $("#fldr-tags").value = def && def.tags ? def.tags.join(", ") : "";
    $("#folder-create-delete").hidden = !def;
    $("#folder-create-backdrop").hidden = false;
    $("#fldr-name").focus();
  }
  function saveFolderModal() {
    const name = $("#fldr-name").value.trim();
    if (!name) { alert("フォルダ名は必須です"); return; }
    const s = Settings.get(); s.folders = s.folders || [];
    if (folderModalCat && folderModalCat !== name) {
      s.folders = s.folders.filter((f) => f.name !== folderModalCat);
    }
    const tags = parseTags($("#fldr-tags").value);
    const idx = s.folders.findIndex((f) => f.name === name);
    const entry = { name, tags };
    if (idx >= 0) s.folders[idx] = entry; else s.folders.push(entry);
    Settings.save(s);
    $("#folder-create-backdrop").hidden = true;
    renderFolders();
  }
  function deleteFolderModal() {
    const name = $("#fldr-name").value.trim();
    if (!name) return;
    const s = Settings.get(); s.folders = (s.folders || []).filter((f) => f.name !== name);
    Settings.save(s);
    $("#folder-create-backdrop").hidden = true;
    renderFolders();
  }
