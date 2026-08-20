"use strict";
/* ---------- AI 層（Stage 2: LLM 呼び出し・RAG 対話・比較・再構築・復習最適化） ---------- */
  async function callLLM(systemPrompt, userPrompt, opts = {}) {
    const s = Settings.get();
    if (!Settings.aiReady()) throw new Error("AI が未設定です。設定で無料の API（Groq 等）を入力してください。");
    const base = (s.baseurl || "").replace(/\/+$/, "");
    const url = base + "/chat/completions";
    const body = {
      model: opts.model || s.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: opts.temperature != null ? opts.temperature : 0.3,
      max_tokens: opts.max_tokens || 800,
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.key },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if (e.name === "AbortError") throw new Error("タイムアウト（60秒）。ネットワーク/プロバイダのCORS設定を確認してください。");
      throw new Error("通信失敗: " + e.message + "（CORS/ネットワークの可能性）");
    }
    clearTimeout(timer);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error("API エラー " + res.status + ": " + t.slice(0, 200));
    }
    const data = await res.json();
    return data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
  }

  function buildContext(cardsArr) {
    return cardsArr.map((c, i) => {
      return `【カード${i + 1}】${c.title}\nカテゴリ: ${(c.categories || []).join(", ")}\nタグ: ${(c.tags || []).join(", ")}\n特性: ${c.traits || ""}\n本文:\n${c.body || ""}`;
    }).join("\n\n");
  }

  function divMsg(role, html) {
    const d = document.createElement("div");
    d.className = "msg " + role;
    d.innerHTML = html;
    return d;
  }
  function srcLinks(cardsArr) {
    const box = document.createElement("div");
    box.className = "src";
    box.innerHTML = "参考カード: " + cardsArr.map((c) => `<a data-id="${c.id}">${escapeHtml(c.title)}</a>`).join("、");
    box.querySelectorAll("a[data-id]").forEach((a) => (a.onclick = () => openEditor(a.dataset.id)));
    return box;
  }

  const KG_SYSTEM = "あなたはユーザーの個人ナレッジ「知識の箱庭」のAIアシスタントです。" +
    "必ず「提供されたカード（ユーザーの過去の知識）」だけを根拠に答えてください。" +
    "知識が不足している場合は正直に「カードに記録がありません」と伝え、推測で答えないでください。" +
    "回答は日本語で、簡潔に。必要に応じて参照したカード名を挙げてください。";

  async function sendChat() {
    const input = $("#chat-input");
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    const log = $("#chat-log");
    log.appendChild(divMsg("user", escapeHtml(q)));
    log.scrollTop = log.scrollHeight;

    const top = (await scoreCards(q)).sort((a, b) => b.score - a.score).slice(0, 8).map((x) => x.card);

    if (!Settings.aiReady()) {
      const ctx = top.length
        ? "AI は未設定です。関連カードを代わりに表示します：<br>" + top.map((c) => `• ${escapeHtml(c.title)}`).join("<br>")
        : "関連カードが見つかりませんでした。設定で無料の API（Groq 等）を入力すると対話が使えます。";
      const m = divMsg("ai", ctx);
      if (top.length) m.appendChild(srcLinks(top));
      log.appendChild(m); log.scrollTop = log.scrollHeight;
      return;
    }

    const ctxText = buildContext(top);
    const userMsg = `質問: ${q}\n\n--- 関連カード ---\n${ctxText || "(なし)"}\n\n上記のカードをもとに回答してください。`;
    const thinking = divMsg("ai", '<span class="ai-think"></span> 考え中…');
    log.appendChild(thinking); log.scrollTop = log.scrollHeight;
    try {
      const answer = await callLLM(KG_SYSTEM, userMsg);
      thinking.innerHTML = escapeHtml(answer).replace(/\n/g, "<br>");
      if (top.length) thinking.appendChild(srcLinks(top));
    } catch (e) {
      thinking.innerHTML = ki("alert") + " AI エラー: " + escapeHtml(e.message) + "<br>以下は関連カードの表示です：<br>" + top.map((c) => "• " + escapeHtml(c.title)).join("<br>");
      if (top.length) thinking.appendChild(srcLinks(top));
    }
    log.scrollTop = log.scrollHeight;
  }

  function reviewCandidates() {
    const now = Date.now();
    return cards.filter((c) => {
      const low = (c.understanding || 3) <= 2;
      const important = (c.importance || 3) >= 4;
      const stale = !c.lastViewed || (now - new Date(c.lastViewed).getTime()) > 30 * 864e5;
      return (low && important) || (low && stale) || (important && stale);
    });
  }

  async function aiReview() {
    if (!Settings.aiReady()) { alert("AI を有効化するには設定で無料の API（Groq 等）を入力してください。"); return; }
    const cand = reviewCandidates();
    if (!cand.length) { alert("今のところ復習候補はありません"); return; }
    const list = $("#review-list");
    const ctx = cand.map((c) => `・${c.title}（重要度${starsText(c.importance)}/理解度${starsText(c.understanding)}/閲覧${c.viewCount || 0}回/カテゴリ:${(c.categories || []).join(",")}）`).join("\n");
    list.innerHTML = '<div class="ai-review-box" style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px"><span class="ai-think"></span> AI が最適化中…</div>';
    const sys = "あなたは学習コーチです。ユーザーの知識カードをもとに、今週優先して復習すべき順番トップ5とその理由を日本語で提案してください。";
    const user = `以下の復習候補から優先順位を提案してください：\n${ctx}`;
    try {
      const ans = await callLLM(sys, user, { max_tokens: 900 });
      list.innerHTML = '<div class="ai-review-box" style="background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:14px"><b><span class="ai-think"></span> AI による今週の復習優先順位</b><br>' + escapeHtml(ans).replace(/\n/g, "<br>") + '</div>';
    } catch (e) {
      list.innerHTML = '<div class="ai-review-box" style="background:var(--panel);border:1px solid var(--danger);border-radius:10px;padding:14px;margin-bottom:14px">ki("alert") + " AI エラー: ' + escapeHtml(e.message) + '</div>';
    }
    cand.forEach((c) => list.appendChild(cardEl(c)));
  }

  function populateCompareSelects() {
    const a = $("#cmp-a"), b = $("#cmp-b");
    if (!a || !b) return;
    const opts = cards.map((c) => `<option value="${escapeHtml(c.title)}">${escapeHtml(c.title)}</option>`).join("");
    a.innerHTML = opts; b.innerHTML = opts;
    if (cards.length > 1) b.selectedIndex = 1;
  }

  async function runCompare() {
    if (!Settings.aiReady()) { alert("設定で無料の API（Groq 等）を入力してください。"); return; }
    const a = cards.find((c) => c.title === $("#cmp-a").value);
    const b = cards.find((c) => c.title === $("#cmp-b").value);
    if (!a || !b || a.id === b.id) { alert("異なるカードを2枚選択してください"); return; }
    const log = $("#chat-log");
    const sys = "あなたはユーザーのナレッジAIです。提供された2つのカードを比較し、共通点・相違点・関係性を日本語で簡潔に説明してください。";
    const user = `カード1:\nタイトル: ${a.title}\nカテゴリ: ${(a.categories || []).join(", ")}\nタグ: ${(a.tags || []).join(", ")}\n本文:\n${a.body || ""}\n\nカード2:\nタイトル: ${b.title}\nカテゴリ: ${(b.categories || []).join(", ")}\nタグ: ${(b.tags || []).join(", ")}\n本文:\n${b.body || ""}\n\nこの2つを比較してください。`;
    const thinking = divMsg("ai", ki("thinking") + " 比較中…");
    log.appendChild(thinking); log.scrollTop = log.scrollHeight;
    try {
      const ans = await callLLM(sys, user, { max_tokens: 900 });
      thinking.innerHTML = escapeHtml(ans).replace(/\n/g, "<br>");
      thinking.appendChild(srcLinks([a, b]));
    } catch (e) {
      thinking.innerHTML = ki("alert") + " AI エラー: " + escapeHtml(e.message);
    }
    log.scrollTop = log.scrollHeight;
  }

  async function runReconstruct() {
    if (!Settings.aiReady()) { alert("設定で無料の API（Groq 等）を入力してください。"); return; }
    if (!cards.length) { alert("カードがありません"); return; }
    const sample = cards.slice().sort((x, y) => (y.importance - x.importance)).slice(0, 40);
    const ctx = sample.map((c) => `・${c.title}（カテゴリ:${(c.categories || []).join(",")}/タグ:${(c.tags || []).join(",")}/理解度${starsText(c.understanding)}）`).join("\n");
    const sys = "あなたはユーザーの学習アドバイザーです。ユーザーのナレッジカード一覧を分析し、不足している知識領域や、次に学ぶべきテーマを日本語で提案してください。";
    const user = `カード一覧（重要度順・上位${sample.length}件）:\n${ctx}\n\n分析と提案をお願いします。`;
    const log = $("#chat-log");
    const thinking = divMsg("ai", ki("thinking") + " 分析中…");
    log.appendChild(thinking); log.scrollTop = log.scrollHeight;
    try {
      const ans = await callLLM(sys, user, { max_tokens: 1000, temperature: 0.5 });
      thinking.innerHTML = escapeHtml(ans).replace(/\n/g, "<br>");
    } catch (e) {
      thinking.innerHTML = ki("alert") + " AI エラー: " + escapeHtml(e.message);
    }
    log.scrollTop = log.scrollHeight;
  }

  async function testAI() {
    if (!Settings.aiReady()) { alert("API Base URL / Key / Model を入力してください"); return; }
    const btn = $("#btn-test-ai"); const old = btn.textContent; btn.textContent = "テスト中…"; btn.disabled = true;
    try {
      const ans = await callLLM("短く返答してください。", "こんにちは、動作確認です。", { max_tokens: 30 });
      $("#settings-status").innerHTML = ki("check") + " 接続OK: " + escapeHtml(ans.slice(0, 40));
    } catch (e) {
      $("#settings-status").textContent = "失敗: " + e.message.slice(0, 80);
    } finally {
      btn.textContent = old; btn.disabled = false;
      setTimeout(() => ($("#settings-status").textContent = ""), 5000);
    }
  }

  /* ---------- 特性類似検索（AI 対話） ---------- */
  function populateTraitSelect() {
    const sel = $("#trait-ref"); if (!sel) return;
    const arr = cards.filter((c) => c.traits);
    if (!arr.length) { sel.innerHTML = '<option value="">（特性登録カードなし）</option>'; return; }
    sel.innerHTML = arr.map((c) => `<option value="${escapeHtml(c.title)}">${escapeHtml(c.title)}</option>`).join("");
  }
  async function runTraitSearch() {
    if (!Settings.aiReady()) { alert("設定で無料の API（Groq 等）を入力してください。"); return; }
    const refTitle = $("#trait-ref").value;
    const ref = cards.find((c) => c.title === refTitle && c.traits);
    if (!ref) { alert("参考カード（特性あり）を選択してください"); return; }
    const pool = cards.filter((c) => c.traits && c.id !== ref.id);
    if (!pool.length) { alert("特性が入力された他のカードがありません"); return; }
    const log = $("#chat-log");
    const ctx = pool.map((c, i) => `【候補${i + 1}】${c.title}\n特性:\n${c.traits}`).join("\n\n");
    const sys = "あなたはナレッジAIです。参考カードの「特性」と、各候補カードの「特性」を比較し、参考カードと最も類似する特性を持つ上位3件を選び、それぞれの類似理由を日本語で簡潔に説明してください。該当がない場合は正直にそう伝えてください。";
    const user = `【参考カード】${ref.title}\n特性:\n${ref.traits}\n\n--- 候補カード ---\n${ctx}`;
    const thinking = divMsg("ai", '<span class="ai-think"></span> 特性を比較中…');
    log.appendChild(thinking); log.scrollTop = log.scrollHeight;
    try {
      const ans = await callLLM(sys, user, { max_tokens: 900 });
      thinking.innerHTML = escapeHtml(ans).replace(/\n/g, "<br>");
      thinking.appendChild(srcLinks([ref, ...pool.slice(0, 3)]));
    } catch (e) {
      thinking.innerHTML = ki("alert") + " AI エラー: " + escapeHtml(e.message);
    }
    log.scrollTop = log.scrollHeight;
  }
