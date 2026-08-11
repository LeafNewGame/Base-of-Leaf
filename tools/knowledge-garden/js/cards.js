"use strict";
/* ---------- 描画: カード一覧 ---------- */
  function sortCards(data) {
    const arr = data.slice();
    switch (sortMode) {
      case "updated-asc": arr.sort((a, b) => (a.updatedAt || "").localeCompare(b.updatedAt || "")); break;
      case "understanding-desc": arr.sort((a, b) => (b.understanding || 3) - (a.understanding || 3)); break;
      case "understanding-asc": arr.sort((a, b) => (a.understanding || 3) - (b.understanding || 3)); break;
      case "importance-desc": arr.sort((a, b) => (b.importance || 3) - (a.importance || 3)); break;
      case "importance-asc": arr.sort((a, b) => (a.importance || 3) - (b.importance || 3)); break;
      case "views-desc": arr.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)); break;
      case "fav-first": arr.sort((a, b) => ((b.favorite ? 1 : 0) - (a.favorite ? 1 : 0)) || (b.updatedAt || "").localeCompare(a.updatedAt || "")); break;
      default: arr.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    }
    return arr;
  }
  async function renderCards() {
    const list = $("#card-list");
    let data = cards.slice();
    if (searchQuery.trim()) {
      const scored = (await scoreCards(searchQuery)).sort((a, b) => b.score - a.score);
      data = scored.map((x) => x.card);
    }
    if (filters.category) data = data.filter((c) => (c.categories || []).includes(filters.category));
    if (filters.tag) data = data.filter((c) => (c.tags || []).includes(filters.tag));
    if (filters.type) data = data.filter((c) => c.type === filters.type);
    if (favOnly) data = data.filter((c) => c.favorite);
    data = sortCards(data);

    if (!data.length) { list.innerHTML = '<div class="empty">カードがありません。＋ 新規カード から作りましょう。</div>'; return; }
    list.innerHTML = "";
    lastCardIds = data.map((c) => c.id);
    data.forEach((c) => list.appendChild(cardEl(c)));
  }
  function toggleFavorite(id) {
    const c = cards.find((x) => x.id === id);
    if (!c) return;
    c.favorite = !c.favorite;
    Store.put(c);
    renderCards();
    if ($("#view-map").classList.contains("active")) renderMap();
  }

  function cardEl(c) {
    const el = document.createElement("div");
    const selected = selectMode && selectedIds.has(c.id);
    el.className = "kcard" + (selectMode ? " selectable" : "") + (selected ? " selected" : "");
    const badge = c.type && c.type !== "knowledge" ? `<span class="type-badge type-${c.type}">${TYPE_LABEL[c.type]}</span>` : "";
    const relCount = (c.relatedCardIds || []).length;
    const check = selectMode ? `<span class="kc-check" aria-hidden="true">${selected ? CHECK_ON_SVG : CHECK_OFF_SVG}</span>` : "";
    el.innerHTML = `
      <div class="kc-head">
        ${check}${badge}
        <button class="fav-btn${c.favorite ? " on" : ""}" data-fav="${c.id}" title="お気に入り切替" aria-label="お気に入り">${STAR_SVG}</button>
      </div>
      <h3>${escapeHtml(c.title)}</h3>
      <div class="body">${escapeHtml(c.body || "")}</div>
      <div class="meta">
        <span class="stars" title="重要度${c.importance}/理解度${c.understanding}">${stars(c.importance)}</span>
        <span class="stars">${stars(c.understanding)}</span>
        ${(c.categories || []).map((x) => `<span>${escapeHtml(x)}</span>`).join("")}
        ${(c.tags || []).slice(0, 4).map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join("")}
        ${c.traits ? `<span class="tag trait-tag" title="特性: ${escapeHtml(c.traits)}">特</span>` : ""}
        ${relCount ? `<span class="mi">${LINK_SVG}${relCount}</span>` : ""}
        <span class="mi">${EYE_SVG}${c.viewCount || 0}</span>
      </div>`;
    if (selectMode) {
      el.onclick = () => toggleSelect(c.id);
    } else {
      el.onclick = () => openEditor(c.id);
    }
    const fb = el.querySelector(".fav-btn");
    if (fb) fb.onclick = (e) => { e.stopPropagation(); toggleFavorite(c.id); };
    return el;
  }

  /* ---------- エディタ ---------- */
  function openEditor(id) {
    editingId = id || null;
    const c = id ? cards.find((x) => x.id === id) : null;
    editingCard = c;
    $("#editor-title").textContent = id ? "カードを編集" : "新規カード";
    $("#f-title").value = c?.title || "";
    $("#f-type").value = c?.type || "knowledge";
    $("#f-importance").value = c?.importance || 3;
    $("#f-understanding").value = c?.understanding || 3;
    $("#f-importance-val").textContent = stars(c?.importance || 3);
    $("#f-understanding-val").textContent = stars(c?.understanding || 3);
    $("#f-body").value = c?.body || "";
    $("#f-categories").value = (c?.categories || []).join(", ");
    $("#f-tags").value = (c?.tags || []).join(", ");
    $("#f-refs").value = (c?.references || []).join("\n");
    $("#f-memo").value = c?.memo || "";
    const hasTraits = !!(c && c.traits);
    $("#f-traits").value = c?.traits || "";
    $("#traits-wrap").hidden = !hasTraits;
    $("#btn-add-traits").hidden = hasTraits;
    $("#f-favorite").checked = !!c?.favorite;
    const due = c?.dueDate || "";
    $("#f-duedate").value = due;
    $("#f-duedate").hidden = !due;
    $("#btn-add-calendar").hidden = !!due;
    $("#btn-clear-due").hidden = !due;
    $("#due-hint").textContent = due ? ("予定日: " + due + (c?.done ? "（完了済み）" : "")) : "";
    populateLinkFolderSelect();
    renderLinkPicker(c);
    renderSuggest(c);
    $("#editor-delete").hidden = !id;
    $("#editor-history").hidden = !id;
    if (id) { c.viewCount = (c.viewCount || 0) + 1; c.lastViewed = nowISO(); Store.put(c); }
    $("#editor-backdrop").hidden = false;
  }

  function populateLinkFolderSelect() {
    const sel = $("#f-links-folder"); if (!sel) return;
    const folders = new Set();
    cards.forEach((c) => (c.categories || []).forEach((x) => folders.add(x)));
    (Settings.get().folders || []).forEach((f) => { if (f && f.name) folders.add(f.name); });
    const prev = sel.value;
    sel.innerHTML = '<option value="">すべてのフォルダ</option>' +
      [...folders].sort().map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join("");
    if (prev && folders.has(prev)) sel.value = prev;
  }

  function renderLinkPicker(current) {
    const box = $("#f-links"); box.innerHTML = "";
    // 未保存のチェック状態も DOM から取り込んで維持する
    const liveChecked = new Set($$("#f-links input:checked").map((cb) => cb.dataset.id));
    const saved = new Set((current && current.relatedCardIds) || []);
    const checkedSet = new Set([...liveChecked, ...saved]);
    const fld = $("#f-links-folder") ? $("#f-links-folder").value : "";
    let others = cards.filter((c) => c.id !== editingId);
    if (fld) others = others.filter((c) => (c.categories || []).includes(fld));
    // 選択済みカードは絞り込みに関わらず常に表示（リンク切れ防止）
    const extra = cards.filter((c) => c.id !== editingId && checkedSet.has(c.id) && !others.includes(c));
    const list = others.concat(extra);
    if (!list.length) { box.innerHTML = '<span class="hint">このフォルダには他にカードがありません</span>'; return; }
    list.forEach((c) => {
      const lab = document.createElement("label");
      lab.className = "lp-item";
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = checkedSet.has(c.id);
      cb.dataset.id = c.id;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(" " + c.title));
      box.appendChild(lab);
    });
  }

  function renderSuggest(c) {
    const box = $("#f-suggest");
    if (!c || !c.id) { box.innerHTML = ""; return; }
    const q = (c.title + " " + (c.tags || []).join(" "));
    const qTokens = tokenize(q);
    const scored = cards
      .filter((x) => x.id !== c.id)
      .map((x) => ({ c: x, s: localScore(x, qTokens) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6);
    if (!scored.length) { box.innerHTML = ""; return; }
    box.innerHTML = '<div class="s-cap">関連候補（タップでリンク）</div>' +
      scored.map((x) => `<span class="s-item" data-id="${x.c.id}">${escapeHtml(x.c.title)}</span>`).join("");
    box.querySelectorAll(".s-item").forEach((el) => {
      el.onclick = () => {
        const id = el.dataset.id;
        const cb = $(`#f-links input[data-id="${id}"]`);
        if (cb) cb.checked = true;
      };
    });
  }

  async function saveEditor() {
    const title = $("#f-title").value.trim();
    if (!title) { alert("タイトルは必須です"); return; }
    let c = editingId ? cards.find((x) => x.id === editingId) : null;
    const prevBody = c?.body || "";
    const isNew = !c;
    if (!c) {
      c = { id: uid(), createdAt: nowISO(), viewCount: 0, versions: [], done: false };
      cards.push(c);
    }
    const newBody = $("#f-body").value;
    if (isNew || newBody !== prevBody) {
      c.versions = c.versions || [];
      c.versions.push({ version: c.versions.length + 1, body: prevBody || "(空)", at: nowISO() });
      if (c.versions.length > 30) c.versions.shift();
    }
    c.title = title;
    c.type = $("#f-type").value;
    c.importance = +$("#f-importance").value;
    c.understanding = +$("#f-understanding").value;
    c.favorite = $("#f-favorite").checked;
    c.body = newBody;
    c.categories = parseCategories($("#f-categories").value);
    c.tags = parseTags($("#f-tags").value);
    c.references = parseList($("#f-refs").value);
    c.memo = $("#f-memo").value;
    c.traits = $("#f-traits").value.trim();
    c.dueDate = $("#f-duedate").value || null;
    c.relatedCardIds = $$("#f-links input:checked").map((cb) => cb.dataset.id);
    c.updatedAt = nowISO();
    c.relatedCardIds.forEach((rid) => {
      const other = cards.find((x) => x.id === rid);
      if (other && !(other.relatedCardIds || []).includes(c.id)) {
        other.relatedCardIds = other.relatedCardIds || [];
        other.relatedCardIds.push(c.id);
        Store.put(other);
      }
    });
    Store.put(c);
    $("#editor-backdrop").hidden = true;
    await refresh();
  }

  async function deleteCard() {
    if (!editingId) return;
    if (!confirm("このカードを削除しますか？")) return;
    Store.del(editingId);
    cards = cards.filter((c) => c.id !== editingId);
    cards.forEach((c) => { if (c.relatedCardIds) c.relatedCardIds = c.relatedCardIds.filter((id) => id !== editingId); });
    $("#editor-backdrop").hidden = true;
    await refresh();
  }

  function openHistory(id) {
    const c = cards.find((x) => x.id === id);
    if (!c || !c.versions?.length) { alert("履歴はまだありません"); return; }
    const box = $("#history-list"); box.innerHTML = "";
    c.versions.slice().reverse().forEach((v) => {
      const el = document.createElement("div");
      el.className = "history-item";
      el.innerHTML = `<div class="h-head"><span>Version ${v.version}</span><span>${new Date(v.at).toLocaleString()}</span></div><pre>${escapeHtml(v.body)}</pre>`;
      box.appendChild(el);
    });
    $("#history-backdrop").hidden = false;
  }

  /* ---------- 選択モード / 一括操作 ---------- */
  function setSelectMode(on) {
    selectMode = on;
    if (!on) selectedIds.clear();
    $("#btn-select").classList.toggle("active", on);
    $("#bulk-bar").hidden = !on;
    $("#sort-row").style.display = on ? "none" : "";
    renderCards();
    updateBulkCount();
  }
  function toggleSelect(id) {
    if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
    renderCards();
    updateBulkCount();
  }
  function updateBulkCount() {
    const n = selectedIds.size;
    const box = $("#bulk-count"); if (box) box.textContent = n + " 件選択";
    const link = $("#bulk-link"); if (link) link.disabled = n < 2;
  }
  function bulkSelectAll() { lastCardIds.forEach((id) => selectedIds.add(id)); renderCards(); updateBulkCount(); }
  function bulkClear() { selectedIds.clear(); renderCards(); updateBulkCount(); }

  async function bulkLink() {
    const ids = [...selectedIds];
    if (ids.length < 2) { alert("連結には2枚以上選んでください"); return; }
    let n = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = cards.find((x) => x.id === ids[i]);
        const b = cards.find((x) => x.id === ids[j]);
        if (!a || !b) continue;
        a.relatedCardIds = a.relatedCardIds || [];
        b.relatedCardIds = b.relatedCardIds || [];
        if (!a.relatedCardIds.includes(b.id)) { a.relatedCardIds.push(b.id); n++; }
        if (!b.relatedCardIds.includes(a.id)) { b.relatedCardIds.push(a.id); n++; }
        Store.put(a); Store.put(b);
      }
    }
    await refresh();
    alert(n + " 件のリンクを追加しました（選択は維持しています）");
  }
  async function bulkDelete() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!confirm(ids.length + " 枚のカードを削除しますか？")) return;
    ids.forEach((id) => Store.del(id));
    cards = cards.filter((c) => !selectedIds.has(c.id));
    cards.forEach((c) => { if (c.relatedCardIds) c.relatedCardIds = c.relatedCardIds.filter((id) => !selectedIds.has(id)); });
    selectedIds.clear();
    await refresh();
  }
  async function bulkFavorite() {
    let n = 0;
    selectedIds.forEach((id) => {
      const c = cards.find((x) => x.id === id);
      if (c && !c.favorite) { c.favorite = true; Store.put(c); n++; }
    });
    await refresh();
    alert(n + " 枚をお気に入りに登録しました");
  }
  async function bulkTag() {
    const raw = prompt("追加するタグを入力（#付き、カンマで複数可）\n例： #AI, #基礎");
    if (raw == null) return;
    const newTags = parseTags(raw);
    if (!newTags.length) { alert("タグが空です"); return; }
    let n = 0;
    selectedIds.forEach((id) => {
      const c = cards.find((x) => x.id === id);
      if (c) {
        c.tags = c.tags || [];
        newTags.forEach((t) => { if (!c.tags.includes(t)) c.tags.push(t); });
        Store.put(c); n++;
      }
    });
    await refresh();
    alert(n + " 枚にタグを付与しました");
  }

  /* ---------- 思考・判断・アイデア ---------- */
  async function renderThoughts() {
    const list = $("#thought-list");
    const type = $("#thought-type").value;
    let data = cards.filter((c) => c.type && c.type !== "knowledge");
    if (type) data = data.filter((c) => c.type === type);
    if (!data.length) { list.innerHTML = '<div class="empty">まだありません。</div>'; return; }
    list.innerHTML = "";
    data.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    data.forEach((c) => list.appendChild(cardEl(c)));
  }

  /* ---------- 復習提案（ローカル） ---------- */
  async function renderReview() {
    const list = $("#review-list");
    const cand = reviewCandidates();
    cand.sort((a, b) => (b.importance - a.understanding) - (a.importance - a.understanding));
    if (!cand.length) { list.innerHTML = '<div class="empty">今のところ復習が必要なものはありません</div>'; return; }
    list.innerHTML = "";
    cand.forEach((c) => list.appendChild(cardEl(c)));
  }

  function aiReview() {
    alert("AI 呼び出しは Stage 2 で有効化します。Stage 1 では上記のローカル復習候補をご利用ください。");
  }
