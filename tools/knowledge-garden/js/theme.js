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

  /* ---------- タブアイコン（favicon）: 揺れる芽生え ---------- */
  function setupFavicon() {
    const link = document.createElement("link");
    link.rel = "icon";
    link.id = "favicon";
    document.head.appendChild(link);
    const size = 64;
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const ctx = cv.getContext("2d");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function draw(t) {
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2, baseY = size * 0.86, topY = size * 0.32;
      const sway = reduce ? 0 : Math.sin(t) * 0.22;
      const tipX = cx + Math.sin(sway) * 6;
      // 茎
      ctx.strokeStyle = "#5fcf8e";
      ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, baseY);
      ctx.quadraticCurveTo(cx + Math.sin(sway) * 12, (baseY + topY) / 2, tipX, topY);
      ctx.stroke();
      // 葉（左右）
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
      // つぼみの光
      const glow = reduce ? 0.55 : 0.45 + 0.45 * Math.abs(Math.sin(t * 0.9));
      ctx.fillStyle = "rgba(143,208,255," + glow.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(tipX, topY - 1, 3.4, 0, Math.PI * 2);
      ctx.fill();
      link.href = cv.toDataURL("image/png");
    }
    if (reduce) { draw(0); return; }
    const start = performance.now();
    const loop = (now) => {
      draw((now - start) / 700);
      setTimeout(() => requestAnimationFrame(loop), 110);
    };
    requestAnimationFrame(loop);
  }
