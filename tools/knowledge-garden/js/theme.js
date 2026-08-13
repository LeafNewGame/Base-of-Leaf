"use strict";
/* ---------- 設定 ---------- */
  /* ---------- テーマ（ライト / ダーク / カスタム） ---------- */
  function applyTheme() {
    const s = Settings.get();
    const mode = s.theme || "dark";
    const base = mode === "custom" ? (s.customBase || "dark") : mode;
    const root = document.documentElement;
    root.setAttribute("data-theme", base);
    if (mode === "custom" && s.customAccent) {
      root.style.setProperty("--accent", s.customAccent);
      root.style.setProperty("--accent-2", s.customAccent);
      root.style.setProperty("--accent2", s.customAccent);
    } else {
      root.style.removeProperty("--accent");
      root.style.removeProperty("--accent-2");
      root.style.removeProperty("--accent2");
    }
    const tb = $("#btn-theme");
    if (tb) tb.title = "テーマを選択";
    /* 装飾のオン/オフ: 色合い（CSS 変数）は残し、葉っぱ・波・モノリス・光・ホタル等の演出だけ切る */
    const decorOn = (s.decor !== false);            // 既定は ON（undefined も ON 扱い）
    document.body.classList.toggle("no-decor", !decorOn);
    const fx = document.getElementById("fx-layer");
    if (decorOn) {
      if (window.ThemeFX && typeof window.ThemeFX.apply === "function") window.ThemeFX.apply(base);
    } else if (fx) {
      fx.innerHTML = "";
    }
    if (typeof window.updateFavicon === "function") window.updateFavicon(base);
  }
  function currentThemeMode() {
    return (document.querySelector('input[name="theme"]:checked') || {}).value || "dark";
  }
  function saveThemeNow() {
    const cur = Settings.get();
    cur.theme = currentThemeMode();
    cur.customBase = $("#set-custom-base").value;
    cur.customAccent = $("#set-ccent").value;
    Settings.save(cur);
    applyTheme();
  }
  function quickToggleTheme() {
    const s = Settings.get();
    const mode = s.theme || "dark";
    const base = mode === "custom" ? (s.customBase || "dark") : mode;
    const next = base === "light" ? "dark" : "light";
    s.theme = next;
    Settings.save(s);
    applyTheme();
    const r = document.querySelector('input[name="theme"][value="' + next + '"]');
    if (r) r.checked = true;
    const ct = $("#custom-theme"); if (ct) ct.hidden = (next !== "custom");
  }

  function loadSettingsForm() {
    const s = Settings.get();
    $("#set-baseurl").value = s.baseurl || "https://api.groq.com/openai/v1";
    $("#set-key").value = s.key || "";
    $("#set-model").value = s.model || "llama-3.3-70b-versatile";
    $("#set-embed").value = s.embed || "";
    $("#set-supabase-url").value = s.supabaseUrl || "";
    $("#set-supabase-key").value = s.supabaseKey || "";
    const mode = s.theme || "dark";
    document.querySelectorAll('input[name="theme"]').forEach((r) => (r.checked = r.value === mode));
    $("#set-custom-base").value = s.customBase || "dark";
    $("#set-ccent").value = s.customAccent || "#5fcf8e";
    $("#custom-theme").hidden = mode !== "custom";
  }
  function saveSettings() {
    const s = Settings.get();
    s.baseurl = $("#set-baseurl").value.trim();
    s.key = $("#set-key").value.trim();
    s.model = $("#set-model").value.trim();
    s.embed = $("#set-embed").value.trim();
    s.supabaseUrl = $("#set-supabase-url").value.trim();
    s.supabaseKey = $("#set-supabase-key").value.trim();
    Cloud.setConfig(s.supabaseUrl, s.supabaseKey);
    Settings.save(s);
    applyTheme();
    $("#settings-status").textContent = "保存しました ✓";
    setTimeout(() => ($("#settings-status").textContent = ""), 2500);
  }
  /* 入力欄の Supabase URL / anon key を即時反映（保存ボタンを押さなくても動くように） */
  function applyCloudConfigFromInputs() {
    const u = ($("#set-supabase-url").value || "").trim();
    const k = ($("#set-supabase-key").value || "").trim();
    if (u && k) {
      Cloud.setConfig(u, k);
      const s = Settings.get(); s.supabaseUrl = u; s.supabaseKey = k; Settings.save(s);
    }
    return !!(u && k);
  }

  /* ---------- タブアイコン（favicon）: テーマに応じて変化 ---------- */
  var favTheme = (document.documentElement.getAttribute("data-theme")) || "dark";
  function drawFavicon(ctx, size, theme, t) {
    ctx.clearRect(0, 0, size, size);
    switch (theme) {
      case "mono": {        /* 無機質な四角いブロック（暗） */
        var x = 17, y = 18, w = 26, h = 34;
        ctx.fillStyle = "rgba(214,220,226,.96)"; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "rgba(120,128,136,.95)";
        ctx.beginPath(); ctx.moveTo(x + w, y + 2); ctx.lineTo(x + w + 8, y + 8);
        ctx.lineTo(x + w + 8, y + 8 + h); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillRect(x + 4, y + 3, 3, h - 6);
        return;
      }
      case "mono-light": {  /* 無機質な四角いブロック（白・Smash Hit 風） */
        var xl = 17, yl = 18, wl = 26, hl = 34;
        ctx.fillStyle = "rgba(255,255,255,.98)"; ctx.fillRect(xl, yl, wl, hl);
        ctx.strokeStyle = "rgba(120,128,136,.9)"; ctx.lineWidth = 1.5; ctx.strokeRect(xl, yl, wl, hl);
        ctx.fillStyle = "rgba(176,184,192,.92)";
        ctx.beginPath(); ctx.moveTo(xl + wl, yl + 2); ctx.lineTo(xl + wl + 7, yl + 7);
        ctx.lineTo(xl + wl + 7, yl + 7 + hl); ctx.lineTo(xl + wl, yl + hl); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.fillRect(xl + 4, yl + 3, 3, hl - 6);
        return;
      }
      case "sunset": {      /* 夕焼けの太陽（円＋光線） */
        var cx0 = size / 2, cy0 = size * 0.6;
        ctx.fillStyle = "rgba(255,150,90,.95)"; ctx.beginPath(); ctx.arc(cx0, cy0, 15, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,200,140,.9)"; ctx.lineWidth = 3;
        for (var k = 0; k < 8; k++) { var a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx0 + Math.cos(a) * 19, cy0 + Math.sin(a) * 19); ctx.lineTo(cx0 + Math.cos(a) * 25, cy0 + Math.sin(a) * 25); ctx.stroke(); }
        return;
      }
      case "ocean": {       /* 波（3本の弧） */
        ctx.strokeStyle = "rgba(56,160,214,.95)"; ctx.lineWidth = 4; ctx.lineCap = "round";
        for (var wv = 0; wv < 3; wv++) {
          var yy = 24 + wv * 9; ctx.beginPath();
          for (var xx = 12; xx <= size - 12; xx += 4) { var yo = yy + Math.sin((xx / 10) + wv) * 4; if (xx === 12) ctx.moveTo(xx, yo); else ctx.lineTo(xx, yo); }
          ctx.stroke();
        }
        return;
      }
      case "forest": {      /* 葉（緑） */
        ctx.save(); ctx.translate(size / 2, size / 2 + 2); ctx.rotate(-0.3);
        ctx.fillStyle = "rgba(95,207,142,.95)";
        ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(16, 0, 0, 22); ctx.quadraticCurveTo(-16, 0, 0, -22); ctx.fill();
        ctx.strokeStyle = "rgba(40,120,70,.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke();
        ctx.restore(); return;
      }
      case "space": {       /* 円環＋星 */
        ctx.strokeStyle = "rgba(157,123,255,.95)"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(size / 2, size / 2, 15, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(95,208,255,.95)";
        ctx.beginPath(); ctx.arc(size * 0.7, size * 0.32, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(size * 0.34, size * 0.66, 2, 0, Math.PI * 2); ctx.fill();
        return;
      }
      case "notebook": {    /* ノート（矩形＋罫線＋赤マージン） */
        ctx.fillStyle = "rgba(247,243,234,.98)"; ctx.fillRect(16, 14, 32, 36);
        ctx.strokeStyle = "rgba(60,45,25,.5)"; ctx.lineWidth = 1.5;
        for (var ln = 0; ln < 4; ln++) { var ly = 22 + ln * 7; ctx.beginPath(); ctx.moveTo(22, ly); ctx.lineTo(44, ly); ctx.stroke(); }
        ctx.strokeStyle = "rgba(190,60,40,.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(26, 14); ctx.lineTo(26, 50); ctx.stroke();
        return;
      }
      case "morning": {     /* 朝の黄色い太陽（円＋光線） */
        var cxm = size / 2, cym = size / 2;
        ctx.fillStyle = "rgba(255,206,70,.97)"; ctx.beginPath(); ctx.arc(cxm, cym, 13, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,232,120,.95)"; ctx.lineWidth = 3;
        for (var rr = 0; rr < 8; rr++) { var aa = rr * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cxm + Math.cos(aa) * 18, cym + Math.sin(aa) * 18); ctx.lineTo(cxm + Math.cos(aa) * 24, cym + Math.sin(aa) * 24); ctx.stroke(); }
        return;
      }
      case "cyber": {       /* ネオングリッド（枠＋斜め） */
        ctx.strokeStyle = "rgba(25,240,255,.95)"; ctx.lineWidth = 3; ctx.strokeRect(16, 16, 32, 32);
        ctx.strokeStyle = "rgba(255,61,240,.9)"; ctx.beginPath(); ctx.moveTo(16, 48); ctx.lineTo(48, 16); ctx.stroke();
        return;
      }
      default: break; /* dark / light / custom: 揺れる緑の芽生え */
    }
    /* デフォルト: 揺れる緑の芽生え */
    const cx = size / 2, baseY = size * 0.86, topY = size * 0.32;
    const sway = Math.sin(t) * 0.22;
    const tipX = cx + Math.sin(sway) * 6;
    ctx.strokeStyle = "#5fcf8e";
    ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, baseY);
    ctx.quadraticCurveTo(cx + Math.sin(sway) * 12, (baseY + topY) / 2, tipX, topY);
    ctx.stroke();
    const swayDeg = sway * 180 / Math.PI;
    const leaf = (side) => {
      ctx.save();
      ctx.translate(tipX, topY + 2);
      ctx.rotate((side * (42 + swayDeg)) * Math.PI / 180);
      ctx.fillStyle = "#5fcf8e";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * 9, -8, side * 11, -18);
      ctx.quadraticCurveTo(side * 2, -10, 0, 0);
      ctx.fill();
      ctx.restore();
    };
    leaf(-1); leaf(1);
    const glow = 0.45 + 0.45 * Math.abs(Math.sin(t * 0.9));
    ctx.fillStyle = "rgba(143,208,255," + glow.toFixed(3) + ")";
    ctx.beginPath();
    ctx.arc(tipX, topY - 1, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  function setupFavicon() {
    var link = document.getElementById("favicon");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; link.id = "favicon"; document.head.appendChild(link); }
    var size = 64;
    var cv = document.createElement("canvas");
    cv.width = cv.height = size;
    var ctx = cv.getContext("2d");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var animT = 0;
    function frame() {
      drawFavicon(ctx, size, favTheme, animT);
      link.href = cv.toDataURL("image/png");
    }
    window.updateFavicon = function (theme) {
      favTheme = theme || "dark";
      if (reduce) frame();
    };
    if (reduce) { frame(); return; }
    var start = performance.now();
    var loop = function (now) {
      animT = (now - start) / 700;
      frame();
      setTimeout(function () { requestAnimationFrame(loop); }, 110);
    };
    requestAnimationFrame(loop);
  }

  /* ---------- テーマ選択スウォッチ（設定画面とサイドバーのポップアップで共有） ---------- */
  var THEME_PRESETS = [
    { value: "dark",       name: "ダーク",         c1: "#5fcf8e", c2: "#8fd0ff" },
    { value: "light",      name: "ライト",         c1: "#2f9e63", c2: "#2b7fc4" },
    { value: "sunset",     name: "夕焼け",         c1: "#ff8c5a", c2: "#ffc15e" },
    { value: "ocean",      name: "オーシャン",     c1: "#2bb7c4", c2: "#56c5f2" },
    { value: "forest",     name: "森",             c1: "#6fcf6f", c2: "#a7d96a" },
    { value: "mono",       name: "モノクロ（黒）", c1: "#15171a", c2: "#cfd4d9" },
    { value: "mono-light", name: "モノクロ（白）", c1: "#e7ebee", c2: "#8b949c" },
    { value: "space",      name: "宇宙",           c1: "#9d7bff", c2: "#5fd0ff" },
    { value: "notebook",   name: "ノートブック",   c1: "#c2703d", c2: "#5b8c6e" },
    { value: "morning",    name: "朝",             c1: "#f6a96b", c2: "#7fb5d6" },
    { value: "cyber",      name: "サイバー",       c1: "#ff3df0", c2: "#19f0ff" },
    { value: "custom",     name: "カスタム",       c1: "#5fcf8e", c2: "#8fd0ff" }
  ];
  function buildThemeSwatches() {
    ["#theme-grid", "#theme-pop-grid"].forEach(function (sel) {
      var box = $(sel);
      if (!box) return;
      box.innerHTML = "";
      THEME_PRESETS.forEach(function (p) {
        var label = document.createElement("label");
        label.className = "theme-opt theme-swatch";
        label.title = p.name;
        label.innerHTML =
          '<input type="radio" name="theme" value="' + p.value + '" />' +
          '<span class="sw-dot"><i style="background:' + p.c1 + '"></i><i style="background:' + p.c2 + '"></i></span>' +
          '<span class="sw-name">' + p.name + '</span>';
        box.appendChild(label);
      });
    });
    $$('input[name="theme"]').forEach(function (r) {
      r.addEventListener("change", function () {
        var ct = $("#custom-theme");
        if (ct) ct.hidden = (r.value !== "custom");
        if (typeof saveThemeNow === "function") saveThemeNow();
        if (r.closest && r.closest("#theme-pop")) {
          var pop = $("#theme-pop"); if (pop) pop.hidden = true;
        }
      });
    });
  }
