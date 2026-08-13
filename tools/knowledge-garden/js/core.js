"use strict";
/* =========================================================================
   知識の箱庭 — Knowledge Garden (Stage 2: localStorage 単一ファイル版)
   - ストレージ: localStorage（IndexedDB 不使用）
   - AI: 無料の OpenAI 互換 API（既定 Groq）をブラウザから直接呼び出し。 */
  /* ---------- クラウド同期（Supabase / 無料ティア）
     認証は公式 JS SDK（ESM で読み込み）を使用。PKCE の state/verifier を
     localStorage で管理するため、手書き OAuth で起きていた「state 欠落」
     (bad_oauth_callback) を回避できる。データ同期は REST を直接 fetch。
     テーブル: kb_cards(user_id uuid PK, cards jsonb, updated_at timestamptz) ---------- */
  const Cloud = (() => {
    const LS_SESSION = "kg_cloud_session";
    let url = "", key = "";
    let sb = null; // Supabase クライアント
    let session = null;
    let listeners = [];
    let syncTimer = null;
    let lastError = "";

    function loadSession() { try { session = JSON.parse(localStorage.getItem(LS_SESSION) || "null"); } catch { session = null; } }
    function saveSession() { if (session) localStorage.setItem(LS_SESSION, JSON.stringify(session)); else localStorage.removeItem(LS_SESSION); }
    function configured() { return !!(url && key); }
    function authed() { return !!(session && session.access_token); }
    function email() { return (session && session.user && session.user.email) || ""; }

    /* Project URL を必ず「オリジンだけ」に正規化する。
       ユーザーが https://xxx.supabase.co/rest/v1 や 末尾スラッシュ付きを貼ると
       /rest/v1/rest/v1/kb_cards となり PostgREST が PGRST125(Invalid path) を返すため。 */
    function normBase(u) {
      u = (u || "").trim().replace(/\s+/g, "");
      if (!u) return "";
      if (!/^https?:\/\//i.test(u)) u = "https://" + u;
      try { return new URL(u).origin; } catch { return u.replace(/\/+$/, ""); }
    }
    async function init(u, k) {
      url = normBase(u); key = (k || "").trim(); loadSession();
      if (configured()) {
        try {
          await ensureClient();
          const { data } = await sb.auth.getSession();
          if (data.session) { session = toOur(data.session); saveSession(); }
          else { session = null; saveSession(); } // 古いミラー(session)が「オンライン」と誤表示するのを防ぐ
        } catch (e) { console.warn("cloud init client err", e); session = null; saveSession(); }
      }
      emit();
    }
    function setConfig(u, k) { url = normBase(u); key = (k || "").trim(); }
    function baseUrl() { return url; }
    function isConfigured() { return configured(); }

    /* 公式 SDK (window.__sbCreateClient) が読み込まれるのを待つ（ESM は遅延読み込み） */
    function whenReady(timeoutMs) {
      return new Promise((resolve, reject) => {
        if (window.__sbCreateClient) return resolve(window.__sbCreateClient);
        const t0 = Date.now();
        const iv = setInterval(() => {
          if (window.__sbCreateClient) { clearInterval(iv); resolve(window.__sbCreateClient); }
          else if (Date.now() - t0 > (timeoutMs || 9000)) { clearInterval(iv); reject(new Error("Supabase SDK の読み込みがタイムアウトしました（ネット接続／CDN を確認）")); }
        }, 50);
        document.addEventListener("sb-ready", () => { clearInterval(iv); resolve(window.__sbCreateClient); }, { once: true });
      });
    }
    async function ensureClient() {
      if (sb) return sb;
      const createClient = await whenReady();
      sb = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
          storage: window.localStorage,
          storageKey: "kg_supabase_auth"
        }
      });
      sb.auth.onAuthStateChange((_e, s) => {
        session = s ? toOur(s) : null;
        saveSession(); emit();
      });
      return sb;
    }
    function toOur(s) { return { access_token: s.access_token, refresh_token: s.refresh_token, user: { id: s.user.id, email: s.user.email } }; }

    async function refresh() {
      if (!sb) { try { await ensureClient(); } catch (e) { return false; } }
      try {
        const { data, error } = await sb.auth.refreshSession();
        if (error || !data.session) return false;
        session = toOur(data.session); saveSession(); emit();
        return true;
      } catch { return false; }
    }

    async function authFetch(path, opts) {
      opts = opts || {};
      opts.headers = Object.assign({ "apikey": key }, opts.headers || {});
      let r = await fetch(url + path, opts);
      if (r.status === 401 && session && session.refresh_token) {
        const ok = await refresh();
        if (ok) { opts.headers["Authorization"] = "Bearer " + session.access_token; r = await fetch(url + path, opts); }
      }
      return r;
    }

    async function signUp(em, pw) {
      await ensureClient();
      const { data, error } = await sb.auth.signUp({ email: em, password: pw });
      if (error) throw new Error(error.message || "登録に失敗しました");
      if (data.session) { session = toOur(data.session); saveSession(); emit(); }
      return data;
    }
    async function signIn(em, pw) {
      await ensureClient();
      const { data, error } = await sb.auth.signInWithPassword({ email: em, password: pw });
      if (error) throw new Error(error.message || "ログインに失敗しました");
      session = toOur(data.session); saveSession(); emit();
      return session;
    }
    async function signOut() {
      if (sb) { try { await sb.auth.signOut(); } catch (e) {} }
      session = null; saveSession(); emit();
    }

    /* Google OAuth：公式 SDK の PKCE フローを使用。
       state / code_verifier は SDK が localStorage で管理するため、
       手書き時に起きていた「OAuth state parameter missing (bad_oauth_callback)」
       や「POST 本文消失」を回避できる。 */
    function cloudMsg(t) { const m = $("#cloud-msg"); if (m) m.textContent = t; }
    async function googleLogin() {
      if (!configured()) { cloudMsg("先に設定画面の「Supabase URL / anon key」を入力してください（入力後はそのまま「Google でログイン」を押すか「保存設定」を押します）"); return; }
      let client;
      try { client = await ensureClient(); }
      catch (e) { cloudMsg(e.message); return; }
      try {
        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: KG_OAUTH_REDIRECT }
        });
        if (error) throw error;
        // 以降は Supabase が Google 認証後に KG_OAUTH_REDIRECT へ戻す（ブラウザ遷移）
      } catch (e) { cloudMsg("Googleログイン準備エラー: " + (e.message || e)); }
    }
    async function handleCallback() {
      if (!sb) { try { await ensureClient(); } catch (e) { cloudMsg(e.message); return false; } }
      try {
        const { data, error } = await sb.auth.getSession();
        if (error) throw error;
        if (data.session) {
          session = toOur(data.session);
          saveSession(); emit();
          // SDK(detectSessionInUrl) が URL の code/state を処理済み。念のためクエリを清掃。
          if (location.hash || /[?&](code|error|state)=/.test(location.search)) {
            const clean = location.pathname + location.search
              .replace(/[?&](code|error|state|error_description|error_code)=[^&]*/g, "")
              .replace(/\?$/, "");
            history.replaceState({}, document.title, clean);
          }
          return true;
        }
        return false;
      } catch (e) { cloudMsg("ログイン失敗: " + (e.message || e)); return false; }
    }

    /* PostgREST のエラー本文を日本語の原因説明に変換する。
       PGRST125 = パス不正（URL の入力ミス）／PGRST205・42P01 = テーブル無し／42501 = 権限(RLS) */
    function explainRestError(t) {
      t = t || "";
      if (/PGRST125|Invalid path/i.test(t)) {
        return "Supabase の URL が正しくありません。設定の「Supabase Project URL」には "
          + "https://xxxx.supabase.co のように<オリジンのみ>を入力してください（/rest/v1 などのパスを付けない）。"
          + "現在の接続先: " + (url || "(未設定)");
      }
      if (/PGRST205|PGRST202|42P01|Could not find the table|does not exist/i.test(t)) {
        return "テーブル kb_cards が見つかりません（ref=" + (status().ref || "?") + "）。"
          + "設定 → クラウド同期 → 「テーブル作成 SQL」をこのプロジェクトの SQL Editor で実行し、最後の "
          + "notify pgrst, 'reload schema'; まで流してください。";
      }
      if (/42501|permission denied|row-level security|RLS/i.test(t)) {
        return "権限エラーです。RLS ポリシー（own row）が作成されているか、ログイン済みかを確認してください。";
      }
      return "";
    }

    async function push(allCards) {
      if (!configured() || !authed()) return false;
      const r = await authFetch("/rest/v1/kb_cards", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.access_token, "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify({ user_id: session.user.id, cards: allCards, updated_at: new Date().toISOString() })
      });
      if (!r.ok) {
        const t = await r.text();
        const diag = explainRestError(t);
        if (diag) {
          lastError = diag;
          cloudMsg(lastError);
          console.warn("cloud push failed", r.status, t);
          emit();
          return false;
        }
        lastError = "";
        console.warn("cloud push failed", r.status);
        return false;
      }
      lastError = "";
      emit();
      return true;
    }
    async function pull() {
      if (!configured() || !authed()) return null;
      const r = await authFetch("/rest/v1/kb_cards?select=cards", {
        headers: { "Authorization": "Bearer " + session.access_token }
      });
      if (!r.ok) {
        const t = await r.text();
        const diag = explainRestError(t);
        if (diag) { lastError = diag; throw new Error(lastError); }
        throw new Error("クラウドから取得できませんでした（" + r.status + "）");
      }
      lastError = "";
      const rows = await r.json();
      if (rows && rows.length && Array.isArray(rows[0].cards)) return rows[0].cards;
      return [];
    }
    function scheduleSync() {
      if (!authed()) return;
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => push(Store.getAll()), 800);
    }
    function onStatus(cb) { listeners.push(cb); }
    function status() {
      const ref = (url.match(/https?:\/\/([a-z0-9]+)\.supabase\.(co|in)/i) || [])[1] || "";
      return { state: !configured() ? "unconfigured" : authed() ? "online" : "signedout", email: email(), error: lastError, ref };
    }
    function emit() { listeners.forEach((cb) => cb(status())); }
    return { init, setConfig, isConfigured, configured, authed, signUp, signIn, signOut, googleLogin, handleCallback, push, pull, scheduleSync, onStatus, status, emit, normBase, baseUrl, refresh };
  })();

  /* ---------- ストレージ（localStorage のみ・同期 / クラウドへも同期） ---------- */
  const LS_CARDS = "kg_cards_v2";
  const LS_SETTINGS = "kg_settings";
  const Store = {
    getAll() { try { return JSON.parse(localStorage.getItem(LS_CARDS) || "[]"); } catch { return []; } },
    put(card) {
      const all = this.getAll();
      const i = all.findIndex((c) => c.id === card.id);
      if (i >= 0) all[i] = card; else all.push(card);
      localStorage.setItem(LS_CARDS, JSON.stringify(all));
      Cloud.scheduleSync();
    },
    del(id) {
      const all = this.getAll().filter((c) => c.id !== id);
      localStorage.setItem(LS_CARDS, JSON.stringify(all));
      Cloud.scheduleSync();
    },
    clear() { localStorage.removeItem(LS_CARDS); Cloud.scheduleSync(); },
  };

  /* ---------- 設定 ---------- */
  const Settings = {
    get() { try { return JSON.parse(localStorage.getItem(LS_SETTINGS) || "{}"); } catch { return {}; } },
    save(s) { localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); },
    aiReady() { const s = this.get(); return !!(s.key && s.baseurl && s.model); },
  };

  /* ---------- ユーティリティ ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  // Google ログインのリダイレクト先を「今開いているこのページ自身」にする（動的）。
  // これにより、GitHub Pages でも CloudStudio でも、認証後は必ず同じページに戻ってログインが完了する。
  // ※この URL は Supabase の Authentication → URL Configuration → Redirect URLs に登録しておく必要がある。
  //   どこで開くかで URL が変わるので、実際に使う URL（GitHub Pages の tools/knowledge_garden.html など）をすべて登録すること。
  const KG_OAUTH_REDIRECT = location.origin + location.pathname;
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = () => "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  window.ICONS = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9"/><path d="m7 13 5-5 5 5"/><path d="M5 3h14"/></svg>',
    decor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 1.5A3.5 3.5 0 0 0 6 19z"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>',
    cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="14" height="16" rx="2"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7 7l4 9"/><path d="M17 7l-4 9"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10"/><path d="M9.5 20V4"/><path d="M15 20v-7"/><path d="M20.5 20V8"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/><path d="M8 2v4"/><path d="M16 2v4"/></svg>',
    palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5.5-1.5 1.5-1.5h2a4 4 0 0 0 4-4c0-3.9-4-6-8.5-6z"/><circle cx="7.5" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="11" r="1"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12z"/></svg>',
    sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-8-5"/><path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 8 5"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.2 1 2.5h6c0-1.3.2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20z"/><path d="M12 9v5"/><path d="M12 17.5h.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6"/><path d="m15 9-6 6"/></svg>',
    thinking: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12z"/><path d="M8.5 11.2h.01"/><path d="M12 11.2h.01"/><path d="M15.5 11.2h.01"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.1 1.2 6L12 17.8 6.6 20.4l1.2-6L3.3 9.3l6.1-.7z"/></svg>',
    starO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.1 1.2 6L12 17.8 6.6 20.4l1.2-6L3.3 9.3l6.1-.7z"/></svg>'
  };

  window.ki = function (name) { return '<span class="ki">' + (window.ICONS[name] || "") + '</span>'; };
  window.stars = function (n) { n = n | 0; if (n < 0) n = 0; if (n > 5) n = 5; var f = "", e = ""; for (var i = 0; i < n; i++) f += window.ICONS.star; for (var i = 0; i < 5 - n; i++) e += window.ICONS.starO; return f + e; };
  window.starsText = function (n) { return "\u2605".repeat(n) + "\u2606".repeat(5 - n); };

  const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nowISO = () => new Date().toISOString();
  const TYPE_LABEL = { knowledge: "知識", idea: "アイデア", thought: "思考ログ", decision: "判断履歴" };

  function normTag(t) {
    t = (t || "").trim();
    if (!t) return "";
    return t.startsWith("#") ? t : "#" + t;
  }
  function parseList(str) {
    return (str || "").split(/[,、\n]/).map((s) => s.trim()).filter(Boolean);
  }
  function parseTags(str) { return parseList(str).map(normTag); }
  function parseCategories(str) { return parseList(str); }

  function tokenize(text) {
    const t = String(text || "").toLowerCase();
    const words = (t.match(/[a-z0-9]+/g) || []);
    const cjk = (t.match(/[぀-ヿ一-鿿]+/g) || []).join("");
    const grams = [];
    for (let i = 0; i < cjk.length; i++) {
      if (i + 2 <= cjk.length) grams.push(cjk.slice(i, i + 2));
      if (i + 3 <= cjk.length) grams.push(cjk.slice(i, i + 3));
    }
    return [...words, ...grams];
  }

  /* ---------- 状態 ---------- */
  let cards = [];
  const filters = { category: null, tag: null, type: "" };
  let searchQuery = "";
  let editingId = null;
  let editingCard = null;
  let sortMode = "updated-desc";
  let favOnly = false;
  let selectMode = false;
  const selectedIds = new Set();
  let lastCardIds = [];
  let mapRotate = true;
  const STAR_SVG = '<svg class="star-ic" viewBox="0 0 24 24" width="15" height="15"><path d="M12 2l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.8 6.1 20.8l1.2-6.6L2.5 9l6.6-.9z"/></svg>';
  const EYE_SVG = '<svg class="mi-ic" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/></svg>';
  const LINK_SVG = '<svg class="mi-ic" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M9 15l6-6"/><path d="M11 6l1-1a3.5 3.5 0 0 1 5 5l-1 1"/><path d="M13 18l-1 1a3.5 3.5 0 0 1-5-5l1-1"/></svg>';
  const SPROUT_SVG = '<svg class="sprout-ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V11"/><path d="M12 13C12 9 9 7 5 7c0 4 3 6 7 6z"/><path d="M12 11c0-4 3-6 7-6 0 4-3 6-7 6z"/></svg>';
  const CHECK_OFF_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="4"/></svg>';
  const CHECK_ON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4" fill="rgba(95,207,142,.22)"/><path d="M8 12.5l3 3 5-6"/></svg>';
  let mapMode = "2d";
  let map3dRaf = null;
  const TYPE_COLOR = { knowledge: "#5fcf8e", thought: "#8fd0ff", decision: "#ffd166", idea: "#ff85a1" };

  /* ---------- 関連タグ（共起から導出） ---------- */
  function relatedTagsOf(tag) {
    tag = normTag(tag).toLowerCase();
    const co = {};
    cards.forEach((c) => {
      const tags = (c.tags || []).map((t) => t.toLowerCase());
      if (tags.includes(tag)) {
        tags.forEach((t) => { if (t !== tag) co[t] = (co[t] || 0) + 1; });
      }
    });
    return Object.entries(co).sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => e[0]);
  }

  /* ---------- ローカル意味スコア ---------- */
  function localScore(card, qTokens) {
    if (!qTokens.length) return 0;
    const hayTitle = (card.title || "").toLowerCase();
    const hayBody = (card.body || "").toLowerCase();
    const hayTags = (card.tags || []).map((t) => t.toLowerCase());
    const hayCats = (card.categories || []).map((t) => t.toLowerCase());
    const hayTraits = (card.traits || "").toLowerCase();
    let score = 0;
    const matchedTags = new Set();
    for (const q of qTokens) {
      if (hayTitle.includes(q)) score += 5;
      if (hayBody.includes(q)) score += 2;
      if (hayTraits.includes(q)) score += 3;
      hayTags.forEach((t) => { if (t.includes(q)) { score += 4; matchedTags.add(t); } });
      hayCats.forEach((c) => { if (c.includes(q)) score += 3; });
    }
    matchedTags.forEach((t) => {
      relatedTagsOf(t).forEach((rt) => {
        if ((card.tags || []).map((x) => x.toLowerCase()).includes(rt)) score += 1.5;
      });
    });
    return score;
  }

  async function scoreCards(query) {
    const q = query.trim();
    if (!q) return cards.map((c) => ({ card: c, score: 0 }));
    const qTokens = tokenize(q);
    return cards.map((c) => ({ card: c, score: localScore(c, qTokens) })).filter((x) => x.score > 0);
  }

  /* ---------- 描画: ナビ ---------- */
  function setView(name) {
    if (name !== "cards" && selectMode) setSelectMode(false);
    $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    if (name === "map") renderMap(); else stopMapLoop();
    if (name === "stats") renderStats();
    if (name === "review") renderReview();
    if (name === "thoughts") renderThoughts();
    if (name === "chat") populateCompareSelects();
    if (name === "calendar") renderCalendar();
    if (name === "home") renderFolders();
    if (name === "folder") renderFolder();
    if (name === "worktable" && typeof wtOnShow === "function") wtOnShow();
  }

  /* ---------- 描画: フィルタチップ ---------- */
  function renderFilters() {
    const cats = {}, tags = {};
    cards.forEach((c) => {
      (c.categories || []).forEach((x) => (cats[x] = (cats[x] || 0) + 1));
      (c.tags || []).forEach((x) => (tags[x] = (tags[x] || 0) + 1));
    });
    const cf = $("#category-filters"); cf.innerHTML = "";
    Object.keys(cats).sort().forEach((c) => {
      const el = document.createElement("span");
      el.className = "chip" + (filters.category === c ? " active" : "");
      el.textContent = c + " " + cats[c];
      el.onclick = () => { filters.category = filters.category === c ? null : c; renderFilters(); renderCards(); };
      cf.appendChild(el);
    });
    const tf = $("#tag-filters"); tf.innerHTML = "";
    Object.keys(tags).sort().forEach((t) => {
      const el = document.createElement("span");
      el.className = "chip" + (filters.tag === t ? " active" : "");
      el.textContent = t + " " + tags[t];
      el.onclick = () => { filters.tag = filters.tag === t ? null : t; renderFilters(); renderCards(); };
      tf.appendChild(el);
    });
  }
