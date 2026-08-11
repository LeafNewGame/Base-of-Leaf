"use strict";
/* ---------- インポート / エクスポート ---------- */
  function downloadJSON(list) {
    const data = { version: 2, exportedAt: nowISO(), cards: list };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "knowledge-garden-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const typeLabel = (t) => ({ knowledge: "知識", thought: "思考", decision: "判断", idea: "アイデア" }[t] || t || "知識");
  function openExport() {
    if (!cards.length) { alert("カードがありません"); return; }
    renderExportList("");
    $("#export-backdrop").hidden = false;
    setTimeout(() => { try { $("#export-search").focus(); } catch (e) {} }, 50);
  }
  function closeExport() { $("#export-backdrop").hidden = true; }
  function renderExportList(q) {
    q = (q || "").toLowerCase();
    const list = $("#export-list");
    list.innerHTML = "";
    const matched = cards.filter((c) =>
      !q || (c.title || "").toLowerCase().includes(q) || (c.body || "").toLowerCase().includes(q)
    );
    matched.forEach((c) => {
      const label = document.createElement("label");
      label.className = "export-item";
      label.innerHTML =
        `<input type="checkbox" value="${escapeHtml(c.id)}" checked />` +
        `<span class="ei-title">${escapeHtml(c.title || "(無題)")}</span>` +
        `<span class="ei-meta">${escapeHtml(typeLabel(c.type))} · ${(c.categories || []).join(", ")}</span>`;
      list.appendChild(label);
    });
    if (!matched.length) list.innerHTML = '<div class="empty">該当するカードがありません</div>';
    updateExportCount();
  }
  function updateExportCount() {
    const n = document.querySelectorAll("#export-list input:checked").length;
    $("#export-count").textContent = n + " 件選択中";
  }
  function exportSelected() {
    const ids = [...document.querySelectorAll("#export-list input:checked")].map((c) => c.value);
    const sel = cards.filter((c) => ids.includes(c.id));
    if (!sel.length) { alert("カードを選択してください"); return; }
    downloadJSON(sel);
    closeExport();
  }
  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const incoming = data.cards || [];
        const local = Store.getAll();
        const localById = {}; local.forEach((c) => (localById[c.id] = c));
        let added = 0, updated = 0, skipped = 0;
        for (const c of incoming) {
          const ex = localById[c.id];
          // より新しいローカル版を残す（端末間同期での事故防止）
          if (ex && (ex.updatedAt || "") > (c.updatedAt || "")) { skipped++; continue; }
          Store.put(c);
          ex ? updated++ : added++;
        }
        refresh();
        alert(`${added} 件追加・${updated} 件更新・${skipped} 件はローカルの新しい版を保持しました`);
      } catch (e) { alert("読み込み失敗: " + e.message); }
    };
    reader.readAsText(file);
  }

  /* ---------- サンプルデータ ---------- */
  async function seed() {
    const raw = [
      { title: "フーリエ変換", type: "knowledge", importance: 5, understanding: 4, favorite: true, body: "任意の波形を複数の正弦波へ分解する数学的手法。", categories: ["数学", "大学"], tags: ["#信号処理", "#電気電子"], rel: [] },
      { title: "線形代数", type: "knowledge", importance: 5, understanding: 3, body: "ベクトルと行列を用いた計算手法。", categories: ["数学", "大学"], tags: ["#信号処理"], rel: ["固有値"] },
      { title: "固有値", type: "knowledge", importance: 4, understanding: 2, body: "行列が固有ベクトルをスカラー倍する際の倍率。", categories: ["数学"], tags: ["#信号処理"], rel: ["量子力学"] },
      { title: "量子力学", type: "knowledge", importance: 4, understanding: 2, body: "ミクロな系を記述する物理学。", categories: ["物理", "大学院"], tags: ["#信号処理"], rel: ["半導体"] },
      { title: "半導体", type: "knowledge", importance: 5, understanding: 3, body: "電気伝導性が制御可能な材料。", categories: ["物理", "電気電子", "研究"], tags: ["#電気電子"], rel: ["MOSFET"] },
      { title: "MOSFET", type: "knowledge", importance: 5, understanding: 3, favorite: true, body: "電圧で制御する電界効果トランジスタ。", categories: ["電気電子", "研究"], tags: ["#電気電子"], rel: [] },
      { title: "Python", type: "knowledge", importance: 5, understanding: 4, favorite: true, body: "汎用プログラミング言語。", categories: ["プログラミング", "AI", "大学"], tags: ["#Python", "#AI"], rel: ["FastAPI"] },
      { title: "FastAPI", type: "knowledge", importance: 4, understanding: 3, body: "Pythonの非同期Webフレームワーク。", categories: ["プログラミング", "AI"], tags: ["#Python", "#AI"], rel: ["SQLite"] },
      { title: "SQLite", type: "knowledge", importance: 3, understanding: 4, body: "組み込み可能な軽量データベース。", categories: ["プログラミング"], tags: ["#Python"], rel: [] },
      { title: "なぜFastAPIを採用した？", type: "thought", importance: 3, understanding: 5, favorite: true, body: "・学習しやすい\n・Pythonが使える\n・AIと相性が良い\n・将来Djangoも学べる", categories: ["プログラミング"], tags: ["#Python", "#AI"], rel: [] },
      { title: "PostgreSQLを採用しなかった理由", type: "decision", importance: 3, understanding: 5, body: "・まだ学習段階\n・SQLiteで十分\n・導入が簡単", categories: ["プログラミング"], tags: ["#Python"], rel: [] },
      { title: "知識カードに音声入力を追加したい", type: "idea", importance: 2, understanding: 5, body: "スマホで思いついたことをすぐ保存。", categories: ["UI"], tags: ["#AI"], rel: [] },
    ];
    const created = [];
    for (const r of raw) {
      const { rel, ...rest } = r;
      const id = uid();
      const c = { id, createdAt: nowISO(), updatedAt: nowISO(), viewCount: Math.floor(Math.random() * 20), lastViewed: nowISO(), versions: [], references: [], memo: "", relatedCardIds: [], _rel: rel, ...rest };
      created.push(c);
      Store.put(c);
    }
    const byTitle = {}; created.forEach((c) => (byTitle[c.title] = c.id));
    for (const c of created) {
      if (c._rel && c._rel.length) {
        c.relatedCardIds = c._rel.map((t) => byTitle[t]).filter(Boolean);
        delete c._rel;
        Store.put(c);
      }
    }
    await refresh();
  }
