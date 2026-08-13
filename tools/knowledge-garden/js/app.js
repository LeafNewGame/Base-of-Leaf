"use strict";
/* ---------- リフレッシュ ---------- */
  function refresh() {
    cards = Store.getAll();
    if ($("#view-calendar").classList.contains("active")) renderCalendar();
    if (!cards.length) {
      $("#card-list").innerHTML = '<div class="empty">ようこそ ' + SPROUT_SVG + ' まずは「＋ 新規カード」で知識を育てるか、設定から「サンプルデータを入れる」をお試しください。</div>';
      renderFolders();
    } else {
      renderFilters();
      renderCards();
      renderFolders();
    }
  }

  /* ---------- イベントバインド ---------- */
  function bindEvents() {
    $$(".nav-item").forEach((b) => (b.onclick = () => { setView(b.dataset.view); $("#app").classList.remove("sidebar-open"); }));
    $("#btn-new").onclick = () => openEditor(null);
    $("#btn-new-thought").onclick = () => { openEditor(null); $("#f-type").value = "thought"; };
    $("#search-input").oninput = (e) => { searchQuery = e.target.value; renderCards(); };
    $("#type-filter").onchange = (e) => { filters.type = e.target.value; renderCards(); };
    $("#f-importance").oninput = (e) => ($("#f-importance-val").textContent = stars(+e.target.value));
    $("#f-understanding").oninput = (e) => ($("#f-understanding-val").textContent = stars(+e.target.value));
    $("#editor-save").onclick = saveEditor;
    $("#editor-cancel").onclick = () => ($("#editor-backdrop").hidden = true);
    $("#editor-close").onclick = () => ($("#editor-backdrop").hidden = true);
    // 関連カードのフォルダ絞り込み
    $("#f-links-folder").onchange = () => renderLinkPicker(editingCard);
    // カレンダー（タスク）
    $("#cal-prev").onclick = () => { if (calMode === "agenda") calAgendaBase = shiftDays(calAgendaBase || new Date(), -10); else { calState.m--; if (calState.m < 0) { calState.m = 11; calState.y--; } } renderCalendar(); };
    $("#cal-next").onclick = () => { if (calMode === "agenda") calAgendaBase = shiftDays(calAgendaBase || new Date(), 10); else { calState.m++; if (calState.m > 11) { calState.m = 0; calState.y++; } } renderCalendar(); };
    $("#cal-today").onclick = () => { const t = new Date(); if (calMode === "agenda") calAgendaBase = t; else { calState = { y: t.getFullYear(), m: t.getMonth() }; calSelected = t.toISOString().slice(0, 10); } renderCalendar(); };
    $("#cal-toggle").onclick = () => { calMode = calMode === "agenda" ? "month" : "agenda"; if (calMode === "agenda" && !calAgendaBase) calAgendaBase = new Date(); renderCalendar(); };
    // モバイルメニュー
    $("#btn-menu").onclick = () => { const open = $("#app").classList.toggle("sidebar-open"); $("#btn-menu").setAttribute("aria-expanded", open ? "true" : "false"); };
    $("#menu-overlay").onclick = () => $("#app").classList.remove("sidebar-open");
    // フォルダ（ホーム）
    $("#btn-home-new").onclick = () => openFolderModal(null);
    $("#folder-create-close").onclick = () => ($("#folder-create-backdrop").hidden = true);
    $("#folder-create-cancel").onclick = () => ($("#folder-create-backdrop").hidden = true);
    $("#folder-create-save").onclick = saveFolderModal;
    $("#folder-create-delete").onclick = deleteFolderModal;
    $("#btn-add-traits").onclick = () => { $("#traits-wrap").hidden = false; $("#btn-add-traits").hidden = true; $("#f-traits").focus(); };
    const homeLoadBtn = $("#btn-home-load");
    if (homeLoadBtn) homeLoadBtn.onclick = async () => {
      if (!Cloud.authed()) { cloudMsg2("まだクラウドにログインしていません（設定からログインしてください）"); return; }
      const orig = homeLoadBtn.textContent;
      homeLoadBtn.disabled = true; homeLoadBtn.textContent = "読み込み中…";
      try {
        await syncFromCloud();
        if ($("#view-home").classList.contains("active")) renderFolders();
      } catch (e) { cloudMsg2("読み込みエラー: " + e.message); }
      finally { homeLoadBtn.disabled = false; homeLoadBtn.textContent = orig; }
    };
    $("#folder-back").onclick = () => setView("home");
    $("#folder-add").onclick = () => openFolderEditor(currentFolderCat);
    $("#folder-fmt").onclick = () => openFolderModal(currentFolderCat);
    $("#folder-fmt-save").onclick = saveFolderTemplate;
    $("#folder-fmt-clear").onclick = () => {
      const cat = currentFolderCat; if (!cat) return;
      const s = Settings.get(); s.folderTemplates = s.folderTemplates || {};
      delete s.folderTemplates[cat];
      Settings.save(s);
      $("#folder-fmt-input").value = "";
    };
    $("#btn-add-calendar").onclick = () => { const d = $("#f-duedate"); d.hidden = false; d.value = d.value || new Date().toISOString().slice(0, 10); $("#btn-add-calendar").hidden = true; $("#btn-clear-due").hidden = false; $("#due-hint").textContent = "予定日: " + d.value; };
    $("#btn-clear-due").onclick = () => { const d = $("#f-duedate"); d.value = ""; d.hidden = true; $("#btn-add-calendar").hidden = false; $("#btn-clear-due").hidden = true; $("#due-hint").textContent = ""; };
    $("#f-duedate").onchange = () => { const v = $("#f-duedate").value; $("#due-hint").textContent = v ? ("予定日: " + v) : ""; };
    $("#editor-delete").onclick = deleteCard;
    $("#editor-history").onclick = () => { if (editingId) openHistory(editingId); };
    $("#history-close").onclick = () => ($("#history-backdrop").hidden = true);
    $("#btn-map-relayout").onclick = renderMap;
    $("#btn-map-2d").onclick = () => { mapMode = "2d"; updateMapModeButtons(); renderMap(); };
    $("#btn-map-3d").onclick = () => { mapMode = "3d"; updateMapModeButtons(); renderMap(); };
    $("#btn-map-rotate").onclick = () => {
      mapRotate = !mapRotate;
      updateMapModeButtons();
      if (currentMap3D) currentMap3D.auto = mapRotate && !currentMap3D.dragging;
      const hint = $("#graph-hint");
      if (hint) hint.textContent = mapRotate ? "自動回転中・ドラッグで一時停止" : "ドラッグで回転";
    };
    function updateMapModeButtons() {
      $("#btn-map-2d").classList.toggle("active", mapMode === "2d");
      $("#btn-map-3d").classList.toggle("active", mapMode === "3d");
      const is3d = mapMode === "3d";
      $("#btn-map-rotate").hidden = !is3d;
      $("#btn-map-rotate").classList.toggle("active", is3d && mapRotate);
    }
    $$("#sort-row .sort-btn[data-sort]").forEach((b) => (b.onclick = () => {
      sortMode = b.dataset.sort;
      $$("#sort-row .sort-btn[data-sort]").forEach((x) => x.classList.toggle("active", x === b));
      renderCards();
    }));
    $("#btn-fav-only").onclick = () => { favOnly = !favOnly; $("#btn-fav-only").classList.toggle("active", favOnly); renderCards(); };
    $("#btn-select").onclick = () => setSelectMode(!selectMode);
    $("#bulk-all").onclick = bulkSelectAll;
    $("#bulk-clear").onclick = bulkClear;
    $("#bulk-link").onclick = bulkLink;
    $("#bulk-fav").onclick = bulkFavorite;
    $("#bulk-tag").onclick = bulkTag;
    $("#bulk-del").onclick = bulkDelete;
    $("#bulk-exit").onclick = () => setSelectMode(false);
    $("#btn-chat-send").onclick = sendChat;
    $("#chat-input").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } };
    $("#thought-type").onchange = renderThoughts;
    $("#btn-ai-review").onclick = aiReview;
    $("#btn-compare").onclick = () => { populateCompareSelects(); $("#ai-tools").hidden = false; };
    $("#btn-compare-cancel").onclick = () => { $("#ai-tools").hidden = true; };
    $("#btn-compare-run").onclick = runCompare;
    $("#btn-trait").onclick = () => { populateTraitSelect(); $("#trait-tools").hidden = false; };
    $("#btn-trait-cancel").onclick = () => ($("#trait-tools").hidden = true);
    $("#btn-trait-run").onclick = runTraitSearch;
    $("#btn-reconstruct").onclick = runReconstruct;
    $("#btn-test-ai").onclick = testAI;
    $("#btn-theme").onclick = quickToggleTheme;
    $$('input[name="theme"]').forEach((r) => (r.onchange = () => { $("#custom-theme").hidden = r.value !== "custom"; saveThemeNow(); }));
    $("#set-custom-base").onchange = saveThemeNow;
    $("#set-ccent").oninput = saveThemeNow;
    $("#btn-export").onclick = openExport;
    $("#export-close").onclick = closeExport;
    $("#export-cancel").onclick = closeExport;
    $("#export-run").onclick = exportSelected;
    $("#export-all").onclick = () => { document.querySelectorAll("#export-list input").forEach((c) => (c.checked = true)); updateExportCount(); };
    $("#export-none").onclick = () => { document.querySelectorAll("#export-list input").forEach((c) => (c.checked = false)); updateExportCount(); };
    $("#export-search").oninput = (e) => renderExportList(e.target.value);
    $("#export-list").onchange = updateExportCount;
    $("#btn-import").onclick = () => $("#import-file").click();
    $("#import-file").onchange = (e) => { if (e.target.files[0]) importJSON(e.target.files[0]); };
    $("#btn-save-settings").onclick = saveSettings;
    // クラウド（Supabase）
    $("#btn-cloud-google").onclick = () => { applyCloudConfigFromInputs(); Cloud.googleLogin(); };
    $("#btn-cloud-signin").onclick = async () => {
      applyCloudConfigFromInputs();
      const em = $("#cloud-email").value.trim(), pw = $("#cloud-pass").value;
      if (!em || !pw) { cloudMsg2("メールとパスワードを入力してください"); return; }
      try { Cloud.signIn(em, pw); cloudMsg2("ログインしました ✓"); await syncFromCloud(); updateCloudUI(); }
      catch (e) { cloudMsg2(e.message); }
    };
    $("#btn-cloud-signup").onclick = async () => {
      applyCloudConfigFromInputs();
      const em = $("#cloud-email").value.trim(), pw = $("#cloud-pass").value;
      if (!em || !pw) { cloudMsg2("メールとパスワードを入力してください"); return; }
      try {
        const j = await Cloud.signUp(em, pw);
        if (!j.session) cloudMsg2("確認メールを送信しました。リンクを踏んでからログインしてください");
        else { cloudMsg2("登録しました ✓"); await syncFromCloud(); }
        updateCloudUI();
      } catch (e) { cloudMsg2(e.message); }
    };
    $("#btn-cloud-out").onclick = () => { Cloud.signOut(); cloudMsg2("ログアウトしました"); updateCloudUI(); };
    $("#btn-cloud-up").onclick = async () => { const ok = await Cloud.push(Store.getAll()); cloudMsg2(ok ? "アップロードしました ✓" : "アップロード失敗（ログインまたは設定を確認）"); };
    $("#btn-cloud-down").onclick = async () => { await syncFromCloud(); };
    $("#btn-cloud-diag").onclick = diagnoseCloud;
    $("#btn-seed").onclick = () => { if (confirm("サンプルデータを追加しますか？（既存データは残ります）")) { seed().then(() => alert("サンプルを追加しました")); } };
    $("#btn-clear").onclick = () => { if (confirm("すべてのカードを削除します。よろしいですか？")) { Store.clear(); cards = []; refresh(); alert("削除しました"); } };
    window.addEventListener("resize", () => { if ($("#view-map").classList.contains("active")) renderMap(); });
  }

  /* ---------- 起動 ---------- */
  function init() {
    setupFavicon();
    bindEvents();
    loadSettingsForm();
    applyTheme();
    setupCloud();
    refresh();
  }
  init();
