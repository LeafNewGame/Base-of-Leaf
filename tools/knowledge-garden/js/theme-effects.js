/* ============================================================
   テーマ別エフェクト生成（split file）
   window.ThemeFX.apply(name) を theme.js の applyTheme() から呼ぶ。
   name は data-theme の値（dark/light/custom はオーロラ任せで何も描かない）。
   プリセット8種はそれぞれ専用の背景エフェクトを #fx-layer に生成する。
   ============================================================ */
(function () {
  "use strict";
  var FX = document.getElementById("fx-layer");
  var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function el(cls, css) { var d = document.createElement("div"); d.className = cls; if (css) d.style.cssText = css; return d; }
  function add(node) { if (FX) FX.appendChild(node); }
  function clear() { if (FX) FX.innerHTML = ""; }

  /* ランダム配置の粒子。RM(動作軽減)時は画面内に静止分散させる */
  function dot(cls, n, opt) {
    opt = opt || {};
    for (var i = 0; i < n; i++) {
      var s = rnd(opt.min, opt.max);
      var style = "left:" + rnd(0, 100).toFixed(2) + "%;width:" + s.toFixed(1) + "px;height:" + s.toFixed(1) + "px;";
      if (RM) {
        style += "top:" + rnd(3, 94).toFixed(2) + "%;";
      } else {
        style += "animation-duration:" + rnd(opt.d0, opt.d1).toFixed(2) + "s;";
        style += "animation-delay:-" + rnd(0, opt.d1).toFixed(2) + "s;";
        if (opt.dx) style += "--dx:" + rnd(-opt.dx, opt.dx).toFixed(0) + "px;";
      }
      add(el(cls, style));
    }
  }

  /* 右上角を基点に放射状に広がる光（太さ・長さの異なる複数本・柔らかい光の帯） */
  /* 注意: 要素は右上角ピボットの左下にあるため、正の角度で画面内（左下へ）に広がる */
  function radialRays(cls, count, opt) {
    opt = opt || {};
    var lenMin = opt.lenMin != null ? opt.lenMin : 150;
    var lenMax = opt.lenMax != null ? opt.lenMax : 205;
    var minW = opt.minW != null ? opt.minW : 4;
    var maxW = opt.maxW != null ? opt.maxW : 34;
    var minA = opt.minA != null ? opt.minA : 3;
    var maxA = opt.maxA != null ? opt.maxA : 88;
    var anim = opt.anim || "fx-ray-pulse";
    for (var i = 0; i < count; i++) {
      var ang = rnd(minA, maxA);
      var w = rnd(minW, maxW);
      var len = rnd(lenMin, lenMax);
      var css = "width:" + w.toFixed(1) + "px;height:" + len.toFixed(1) + "vh;transform:rotate(" + ang.toFixed(1) + "deg);";
      if (!RM) css += "animation:" + anim + " " + (3.5 + rnd(0, 3.5)).toFixed(1) + "s ease-in-out infinite;animation-delay:-" + rnd(0, 5).toFixed(1) + "s;";
      add(el(cls, css));
    }
  }

  /* 夕焼け: 右上角から差し込む淡い斜陽（控えめ・上昇する光の点はなし） */
  function sunset() {
    radialRays("fx-ray", 15, { minW: 8, maxW: 60, minA: 3, maxA: 88, lenMin: 150, lenMax: 205, anim: "fx-ray-fade" });
  }

  /* オーシャン: 重ねた波（SVG）+ 気泡 */
  function ocean() {
    var W = 1600, H = 260, periods = 4, mid = 120, steps = periods * 40;
    function path(amp) {
      var d = "M0," + mid;
      for (var i = 1; i <= steps; i++) {
        var x = W * i / steps;
        var y = mid + amp * Math.sin(i / steps * Math.PI * 2 * periods);
        d += " L" + x.toFixed(1) + "," + y.toFixed(1);
      }
      d += " L" + W + "," + H + " L0," + H + " Z";
      return d;
    }
    var waves = [
      { amp: 26, color: "rgba(22,120,134,.62)", dur: 11, h: H },
      { amp: 18, color: "rgba(38,130,184,.55)", dur: 8, h: H + 18 },
      { amp: 12, color: "rgba(86,170,214,.48)", dur: 6, h: H + 36 }
    ];
    for (var w = 0; w < waves.length; w++) {
      var cfg = waves[w];
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "fx-wave");
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.setAttribute("preserveAspectRatio", "none");
      svg.style.cssText = "height:" + cfg.h + "px;";
      if (!RM) svg.style.animation = "fx-wave " + cfg.dur + "s linear infinite";
      var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", path(cfg.amp));
      p.setAttribute("fill", cfg.color);
      svg.appendChild(p);
      add(svg);
    }
    dot("fx-bubble", 16, { min: 4, max: 9, d0: 7, d1: 13, dx: 24 });
  }

  /* 森: 落ち葉（右上→左下へ風に乗って） */
  function forest() {
    for (var i = 0; i < 20; i++) {
      var sz = rnd(10, 18);
      var left = rnd(42, 100);          // 右上あたりから開始
      var lx = rnd(45, 90);             // 左方向への吹送距離(vw)
      var dur = rnd(9, 16);
      var delay = -rnd(0, 16);
      var rot = rnd(-30, 30);
      var style = "left:" + left.toFixed(1) + "%;top:-12%;width:" + sz.toFixed(1) + "px;height:" + sz.toFixed(1) + "px;--lx:" + lx.toFixed(1) + "vw;transform:rotate(" + rot.toFixed(0) + "deg);";
      if (RM) { style += "top:" + rnd(3, 92).toFixed(1) + "%;"; }
      else { style += "animation:fx-leaf-fall " + dur.toFixed(1) + "s linear infinite;animation-delay:" + delay.toFixed(1) + "s;"; }
      add(el("fx-leaf", style));
    }
  }

  /* モノクロ（黒）: 暗い空間に画面の下端に接する無機質なモノリス（光の点なし・浮いたものなし） */
  /* 浮いている右端ブロックは不要なため廃止。すべて下端に接地させ、短く・本数多く配置 */
  function mono() {
    for (var b = 0; b < 13; b++) {              // 下端に沿って横に分散（左端のサイドバー直下は避ける）
      var bh = rnd(15, 36);                      // 短く
      add(el("fx-monolith",
        "left:" + rnd(10, 94).toFixed(1) + "%;bottom:0;width:" + rnd(30, 68).toFixed(1) + "px;height:" + bh.toFixed(1) + "vh;"));
    }
  }

  /* モノクロ（白）: 明るくエアリーな空間に接地する明るいモノリス（Smash Hit 風・床なし） */
  function monoLight() {
    add(el("fx-sh-atmos", ""));                  // 明るい空気感（ブルーム）
    for (var b = 0; b < 13; b++) {              // 下端に沿って横に分散（左端のサイドバー直下は避ける）
      var bh = rnd(15, 36);                      // 短く
      add(el("fx-monolith light",
        "left:" + rnd(10, 94).toFixed(1) + "%;bottom:0;width:" + rnd(30, 68).toFixed(1) + "px;height:" + bh.toFixed(1) + "vh;"));
    }
  }

  /* 宇宙: 星 + 銀河 + 中央の円環 + 周囲を回る光の点（数を絞りつつ広く拡散） */
  function space() {
    dot("fx-star", 80, { min: 1, max: 3, d0: 2.5, d1: 6 });
    add(el("fx-galaxy", ""));
    add(el("fx-ring", ""));
    var orbits = [
      { r: 85,  dur: 22, n: 5 },
      { r: 150, dur: 30, n: 5 },
      { r: 215, dur: 40, n: 4 },
      { r: 285, dur: 52, n: 4 },
      { r: 350, dur: 64, n: 4 }
    ];
    for (var o = 0; o < orbits.length; o++) {
      var cfg = orbits[o];
      var cont = el("fx-orbit", "");
      if (!RM) cont.style.animation = "fx-spin " + cfg.dur + "s linear infinite";
      for (var i = 0; i < cfg.n; i++) {
        var ang = rnd(0, 360);                       // 等間隔ではなくランダムに散らす
        var rr = cfg.r + rnd(-30, 30);               // 軌道半径を広く揺らしてさらに拡散
        var sz = rnd(4, 9);                          // 点の大きさもばらつかせる
        var d = el("fx-orbit-dot",
          "--or:" + rr.toFixed(0) + "px;--oa:" + ang.toFixed(0) + "deg;" +
          "width:" + sz.toFixed(1) + "px;height:" + sz.toFixed(1) + "px;margin:" + (-sz / 2).toFixed(1) + "px;");
        cont.appendChild(d);
      }
      add(cont);
    }
  }

  /* ノートブック: らせん製本 + 罫線（フラット） */
  function notebook() { add(el("fx-nb-binding", "")); add(el("fx-nb-lines", "")); }

  /* 朝: 空（水色）+ 淡い雲（光の帯・花びらはなし） */
  function morning() {
    add(el("fx-sky", ""));
    var clouds = 8;
    for (var i = 0; i < clouds; i++) {
      var w = rnd(150, 330);
      var h = w * rnd(0.40, 0.58);
      var top = rnd(6, 56);
      var left = rnd(-8, 92);
      var dur = rnd(46, 88);
      var delay = -rnd(0, dur);
      var style = "left:" + left.toFixed(1) + "%;top:" + top.toFixed(1) + "%;width:" + w.toFixed(1) + "px;height:" + h.toFixed(1) + "px;";
      if (!RM) style += "animation:fx-cloud-drift " + dur.toFixed(1) + "s ease-in-out infinite;animation-delay:" + delay.toFixed(1) + "s;";
      add(el("fx-cloud", style));
    }
  }

  /* サイバー: ネオングリッド + スキャンライン + 粒子 */
  function cyber() {
    add(el("fx-grid", ""));
    add(el("fx-scan", ""));
    dot("fx-neon", 20, { min: 3, max: 7, d0: 5, d1: 10, dx: 30 });
  }

  var builders = {
    sunset: sunset, ocean: ocean, forest: forest, mono: mono, "mono-light": monoLight,
    space: space, notebook: notebook, morning: morning, cyber: cyber
  };

  function apply(name) {
    name = name || (document.documentElement.getAttribute("data-theme")) || "dark";
    clear();
    var b = builders[name];
    if (b) b();
  }

  window.ThemeFX = { apply: apply };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { apply(); });
  } else {
    apply();
  }
})();
