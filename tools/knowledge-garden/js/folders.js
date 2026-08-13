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
  function openFolderEditor(cat) {
    openEditor(null);
    if (cat && cat !== "未分類") {
      $("#f-categories").value = cat;
      const def = (Settings.get().folders || []).find((f) => f.name === cat);
      if (def) {
        if (def.tags && def.tags.length) $("#f-tags").value = def.tags.join(", ");
        if (def.template) $("#f-body").value = def.template;
      } else {
        const tpl = (Settings.get().folderTemplates || {})[cat] || "";
        if (tpl) $("#f-body").value = tpl;
      }
    }
  }
  function saveFolderTemplate() {
    const cat = currentFolderCat; if (!cat) return;
    const s = Settings.get(); s.folderTemplates = s.folderTemplates || {};
    s.folderTemplates[cat] = $("#folder-fmt-input").value;
    Settings.save(s);
    const btn = $("#folder-fmt-save");
    const old = btn.textContent; btn.innerHTML = ki("check") + " 保存済み";
    setTimeout(() => (btn.textContent = old), 1200);
  }

  /* ---------- フォルダ定義（新規フォルダ・自動タグ） ---------- */
  let folderModalCat = null;
  function openFolderModal(cat) {
    folderModalCat = cat || null;
    $("#folder-create-title").textContent = cat ? ("フォルダ設定: " + cat) : "新規フォルダ";
    const def = cat ? (Settings.get().folders || []).find((f) => f.name === cat) : null;
    $("#fldr-name").value = def ? def.name : (cat || "");
    $("#fldr-tags").value = def && def.tags ? def.tags.join(", ") : "";
    $("#fldr-template").value = def ? (def.template || "") : "";
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
    const template = $("#fldr-template").value;
    const idx = s.folders.findIndex((f) => f.name === name);
    const entry = { name, tags, template };
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
