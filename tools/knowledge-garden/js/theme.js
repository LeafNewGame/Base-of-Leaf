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
    if (tb) tb.title = base === "light" ? "ダークテーマに切替" : "ライトテーマに切替";
    if (window.ThemeFX && typeof window.ThemeFX.apply === "function") window.ThemeFX.apply(base);
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
    if (theme === "mono") {
      /* Smash Hit 風の無機質な四角いブロック（緑なし） */
      var x = 17, y = 18, w = 26, h = 34;
      ctx.fillStyle = "rgba(214,220,226,.96)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(120,128,136,.95)";            // 側面（奥行き）
      ctx.beginPath();
      ctx.moveTo(x + w, y + 2); ctx.lineTo(x + w + 8, y + 8);
      ctx.lineTo(x + w + 8, y + 8 + h); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.8)";             // 縁のハイライト
      ctx.fillRect(x + 4, y + 3, 3, h - 6);
      return;
    }
    /* その他: 揺れる緑の芽生え */
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
