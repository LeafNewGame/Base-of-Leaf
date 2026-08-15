"use strict";
/* ---------- クラウド UI 連携 ---------- */
  function cloudMsg2(t, kind) { const m = $("#cloud-msg"); if (!m) return; const ic = kind === "ok" ? ICONS.check : kind === "err" ? ICONS.error : kind === "warn" ? ICONS.alert : ""; m.innerHTML = (ic ? '<span class="ki ki-sm">' + ic + "</span> " : "") + escapeHtml(t); }

  /* 同一内容カードの重複排除: タイトル+本文が完全に一致するカードを 1 つにまとめる
     （別端末で同じカードを作った場合など、id が異なっても内容が同じなら重複とみなす）。
     ただし「内容が部分的に違う」カードは残すため、完全一致のみを対象とする。 */
  function normText(s) { return (s || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function dedupeByContent(list) {
    const seen = new Map(); const out = [];
    for (const c of list) {
      if (!c || typeof c !== "object") continue;
      const key = normText(c.title) + "|" + normText(c.body);
      const ex = seen.get(key);
      if (!ex) { seen.set(key, c); out.push(c); }
      else if ((c.updatedAt || "") > (ex.updatedAt || "")) { const i = out.indexOf(ex); if (i >= 0) out[i] = c; seen.set(key, c); }
    }
    return out;
  }
  function updateCloudUI() {
    const st = Cloud.status();
    const cs = $("#cloud-status"), sc = $("#sidebar-cloud");
    const signin = $("#btn-cloud-signin"), signup = $("#btn-cloud-signup"), out = $("#btn-cloud-out");
    const refTxt = st.ref ? "（プロジェクト " + st.ref + "）" : "";
    if (st.state === "online") {
      const label = st.email || "アカウント";
      if (cs) { cs.innerHTML = ki("cloud") + " 接続中: " + label + refTxt; cs.classList.add("online"); }
      if (sc) { sc.innerHTML = ki("cloud") + " オンライン: " + label; sc.classList.add("online"); }
      if (signin) signin.hidden = true; if (signup) signup.hidden = true; if (out) out.hidden = false;
    } else if (st.state === "signedout") {
      if (cs) { cs.textContent = "状態: ログインしてください" + refTxt; cs.classList.remove("online"); }
      if (sc) { sc.innerHTML = ki("cloud") + " 未ログイン" + refTxt; sc.classList.remove("online"); }
      if (signin) signin.hidden = false; if (signup) signup.hidden = false; if (out) out.hidden = true;
    } else {
      if (cs) { cs.textContent = "状態: 未設定（URL / key を入力）" + refTxt; cs.classList.remove("online"); }
      if (sc) { sc.innerHTML = ki("cloud") + " 未連携" + refTxt; sc.classList.remove("online"); }
      if (signin) signin.hidden = false; if (signup) signup.hidden = false; if (out) out.hidden = true;
    }
    const errEl = $("#cloud-err");
    if (errEl) errEl.textContent = st.error || "";
  }
  async function syncFromCloud() {
    try {
      const remote = await Cloud.pull();
      if (!remote) { cloudMsg2("クラウドから取得できませんでした（ログイン状態を確認）"); return; }
      // リモート内の重複を id でまとめる（同じ id は updatedAt が新しい方を優先）
      const rmap = new Map();
      remote.forEach((c) => {
        if (!c || typeof c !== "object") return;
        if (!c.id) c.id = uid();
        const ex = rmap.get(c.id);
        if (!ex || (c.updatedAt || "") > (ex.updatedAt || "")) rmap.set(c.id, c);
      });
      const local = Store.getAll();
      const map = new Map();
      local.forEach((c) => {
        if (!c || typeof c !== "object") return;
        if (!c.id) c.id = uid();
        map.set(c.id, c);
      });
      let added = 0, overwritten = 0, kept = 0;
      rmap.forEach((c, id) => {
        const ex = map.get(id);
        if (!ex) { map.set(id, c); added++; }
        // 同じ id は updatedAt が新しい方を優先（クラウド優先・新しいほう勝ち）
        else if ((c.updatedAt || "") > (ex.updatedAt || "")) { map.set(id, c); overwritten++; }
        else { kept++; }
      });
      // 内容が完全に一致するカード（別端末で作られた同内容カード等）を 1 つにまとめる
      const merged = dedupeByContent(Array.from(map.values()));
      localStorage.setItem(LS_CARDS, JSON.stringify(merged));
      cards = merged;
      refresh();
      cloudMsg2(`クラウドから読み込みました（新規 ${added} 件・クラウド上書き ${overwritten} 件・保持 ${kept} 件・重複排除 ${map.size - merged.length} 件）`, "ok");
    } catch (e) { cloudMsg2("同期エラー: " + e.message); }
  }
  async function diagnoseCloud() {
    applyCloudConfigFromInputs();
    const u = $("#set-supabase-url").value.trim();
    const k = $("#set-supabase-key").value.trim();
    if (!u || !k) { cloudMsg2("まず URL と anon key を入力してください"); return; }
    const ref = (u.match(/https?:\/\/([a-z0-9]+)\.supabase\.(co|in)/i) || [])[1] || "";
    if (!ref) { cloudMsg2("URL の形式が正しくありません（例: https://xxxx.supabase.co）"); return; }
    cloudMsg2("診断中… プロジェクト ref = " + ref);
    const base = u.replace(/\/+$/, "");
    try {
      const r = await fetch(base + "/rest/v1/kb_cards?limit=1&select=count", { headers: { "apikey": k } });
      const txt = await r.text();
      if (r.status === 401) cloudMsg2("401: URL と anon key が一致しません（別のプロジェクトのキー？ ref=" + ref + "）。Supabase の同じプロジェクトから URL と key を再コピーしてください。", "err");
      else if (r.status === 200) cloudMsg2("テーブル kb_cards は存在します（ref=" + ref + "）。ログイン後、クラウドから読み込み／保存が使えます。", "ok");
      else if (/PGRST125|Invalid path/i.test(txt)) cloudMsg2("テーブル kb_cards が見つかりません（ref=" + ref + "）。この ref のプロジェクトで「テーブル作成 SQL」を実行してください。", "err");
      else cloudMsg2("状態 " + r.status + " / " + txt.slice(0, 140));
    } catch (e) { cloudMsg2("接続エラー: " + e.message); }
  }
  function setupCloud() {
    const s = Settings.get();
    Cloud.init(s.supabaseUrl || "", s.supabaseKey || "");
    Cloud.onStatus(updateCloudUI);
    // Google ログイン後は ?code=（PKCE）か #access_token=（暗黙的フロー）が付く。
    // どちらの場合も handleCallback がトークンを処理する。
    const hasCode = /[?&]code=/.test(location.search);
    const hasToken = !!(location.hash && /access_token/.test(location.hash));
    if (hasCode || hasToken) {
      Cloud.handleCallback().then((ok) => {
        if (ok) { cloudMsg2("Googleでログインしました", "ok"); syncFromCloud(); }
        else updateCloudUI();
      });
    } else {
      Cloud.refresh().then((ok) => { if (ok && Cloud.authed()) syncFromCloud(); else updateCloudUI(); });
    }
  }
