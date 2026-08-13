"use strict";
/* ---------- クラウド UI 連携 ---------- */
  function cloudMsg2(t) { const m = $("#cloud-msg"); if (m) m.textContent = t; }
  function updateCloudUI() {
    const st = Cloud.status();
    const cs = $("#cloud-status"), sc = $("#sidebar-cloud");
    const signin = $("#btn-cloud-signin"), signup = $("#btn-cloud-signup"), out = $("#btn-cloud-out");
    const refTxt = st.ref ? "（プロジェクト " + st.ref + "）" : "";
    if (st.state === "online") {
      const label = st.email || "アカウント";
      if (cs) { cs.textContent = "☁ 接続中: " + label + refTxt; cs.classList.add("online"); }
      if (sc) { sc.textContent = "☁ オンライン: " + label; sc.classList.add("online"); }
      if (signin) signin.hidden = true; if (signup) signup.hidden = true; if (out) out.hidden = false;
    } else if (st.state === "signedout") {
      if (cs) { cs.textContent = "状態: ログインしてください" + refTxt; cs.classList.remove("online"); }
      if (sc) { sc.textContent = "☁ 未ログイン" + refTxt; sc.classList.remove("online"); }
      if (signin) signin.hidden = false; if (signup) signup.hidden = false; if (out) out.hidden = true;
    } else {
      if (cs) { cs.textContent = "状態: 未設定（URL / key を入力）" + refTxt; cs.classList.remove("online"); }
      if (sc) { sc.textContent = "☁ 未連携" + refTxt; sc.classList.remove("online"); }
      if (signin) signin.hidden = false; if (signup) signup.hidden = false; if (out) out.hidden = true;
    }
    const errEl = $("#cloud-err");
    if (errEl) errEl.textContent = st.error || "";
  }
  async function syncFromCloud() {
    try {
      const remote = await Cloud.pull();
      if (!remote) { cloudMsg2("クラウドから取得できませんでした（ログイン状態を確認）"); return; }
      const local = Store.getAll();
      const map = new Map();
      local.forEach((c) => map.set(c.id, c));
      let added = 0, overwritten = 0, kept = 0;
      remote.forEach((c) => {
        const ex = map.get(c.id);
        if (!ex) { map.set(c.id, c); added++; }
        // 重複（同じ id）は updatedAt が新しい方を優先して上書き（クラウド優先・新しいほう勝ち）
        else if ((c.updatedAt || "") > (ex.updatedAt || "")) { map.set(c.id, c); overwritten++; }
        else { kept++; }
      });
      localStorage.setItem(LS_CARDS, JSON.stringify(Array.from(map.values())));
      refresh();
      cloudMsg2(`クラウドから読み込みました ✓（新規 ${added} 件・クラウド上書き ${overwritten} 件・保持 ${kept} 件）`);
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
      if (r.status === 401) cloudMsg2("❌ 401: URL と anon key が一致しません（別のプロジェクトのキー？ ref=" + ref + "）。Supabase の同じプロジェクトから URL と key を再コピーしてください。");
      else if (r.status === 200) cloudMsg2("✓ テーブル kb_cards は存在します（ref=" + ref + "）。ログイン後、クラウドから読み込み／保存が使えます。");
      else if (/PGRST125|Invalid path/i.test(txt)) cloudMsg2("❌ テーブル kb_cards が見つかりません（ref=" + ref + "）。この ref のプロジェクトで「テーブル作成 SQL」を実行してください。");
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
        if (ok) { cloudMsg2("Googleでログインしました ✓"); syncFromCloud(); }
        else updateCloudUI();
      });
    } else {
      Cloud.refresh().then((ok) => { if (ok && Cloud.authed()) syncFromCloud(); else updateCloudUI(); });
    }
  }
