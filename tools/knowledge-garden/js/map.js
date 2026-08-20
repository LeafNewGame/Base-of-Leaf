"use strict";
/* ---------- 知識マップ（自前力導向レイアウト：2D/3D） ---------- */
  let currentMap3D = null;
  function buildGraphData(W, H) {
    const nodes = cards.map((c) => ({
      id: c.id, title: c.title, importance: c.importance || 3,
      cats: c.categories || [], tags: c.tags || [], gl: c.groupLabel || "",
      x: (Math.random() - 0.5) * W, y: (Math.random() - 0.5) * H, z: (Math.random() - 0.5) * Math.min(W, H),
      vx: 0, vy: 0, vz: 0
    }));
    const idMap = {}; nodes.forEach((n) => (idMap[n.id] = n));
    const links = [];
    const seen = new Set();
    cards.forEach((c) => (c.relatedCardIds || []).forEach((rid) => {
      if (idMap[rid]) { const k = [c.id, rid].sort().join("|"); if (!seen.has(k)) { seen.add(k); links.push({ a: idMap[c.id], b: idMap[rid] }); } }
    }));
    return { W, H, nodes, links };
  }
  function runLayout2D(data) {
    const { nodes, links } = data;
    const SC = 3;                       // 点同士の距離を約3倍に広げる（仮想キャンバスを3倍に）
    const W = data.W * SC, H = data.H * SC;
    nodes.forEach((n) => { n.x = n.x * SC + W / 2; n.y = n.y * SC + H / 2; });
    const ITER = 140, k = 90 * SC, rep = 9000 * SC * SC, center = 0.01;
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const f = rep / (d * d);
          a.vx += (dx / d) * f; a.vy += (dy / d) * f;
          b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
        }
      }
      links.forEach((l) => {
        let dx = l.b.x - l.a.x, dy = l.b.y - l.a.y;
        let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - k) * 0.02;
        l.a.vx += (dx / d) * f; l.a.vy += (dy / d) * f;
        l.b.vx -= (dx / d) * f; l.b.vy -= (dy / d) * f;
      });
      nodes.forEach((n) => {
        n.vx += (W / 2 - n.x) * center; n.vy += (H / 2 - n.y) * center;
        n.vx *= 0.85; n.vy *= 0.85;
        if (Math.abs(n.vx) < 0.05) n.vx = 0;
        if (Math.abs(n.vy) < 0.05) n.vy = 0;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(30, Math.min(W - 30, n.x));
        n.y = Math.max(30, Math.min(H - 30, n.y));
      });
    }
  }
  function runLayout3D(data) {
    const { nodes, links } = data;
    nodes.forEach((n) => { n.x *= 1.2; n.y *= 1.2; n.z *= 1.2; });
    const ITER = 120, k = 110, rep = 12000, center = 0.008;
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
          let d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
          const f = rep / (d * d);
          a.vx += (dx / d) * f; a.vy += (dy / d) * f; a.vz += (dz / d) * f;
          b.vx -= (dx / d) * f; b.vy -= (dy / d) * f; b.vz -= (dz / d) * f;
        }
      }
      links.forEach((l) => {
        let dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, dz = l.b.z - l.a.z;
        let d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
        const f = (d - k) * 0.015;
        l.a.vx += (dx / d) * f; l.a.vy += (dy / d) * f; l.a.vz += (dz / d) * f;
        l.b.vx -= (dx / d) * f; l.b.vy -= (dy / d) * f; l.b.vz -= (dz / d) * f;
      });
      nodes.forEach((n) => {
        n.vx -= n.x * center; n.vy -= n.y * center; n.vz -= n.z * center;
        n.vx *= 0.88; n.vy *= 0.88; n.vz *= 0.88;
        if (Math.abs(n.vx) < 0.05) n.vx = 0;
        if (Math.abs(n.vy) < 0.05) n.vy = 0;
        if (Math.abs(n.vz) < 0.05) n.vz = 0;
        n.x += n.vx; n.y += n.vy; n.z += n.vz;
      });
    }
  }
  function bindGraphNodeEvents(g, n) {
    const tip = $("#graph-tip");
    const wrap = $("#graph-wrap");
    g.onmouseenter = () => { tip.hidden = false; tip.innerHTML = `<b>${escapeHtml(n.title)}</b>`; };
    g.onmousemove = (e) => { const rect = wrap.getBoundingClientRect(); tip.style.left = (e.clientX - rect.left + 12) + "px"; tip.style.top = (e.clientY - rect.top + 12) + "px"; };
    g.onmouseleave = () => { tip.hidden = true; };
    g.onclick = () => { if (mapDragged) return; openEditor(n.id); };
  }
  function updateMapLegend() {
    const el = $("#graph-legend");
    if (el) el.hidden = true; // 種類分類を廃止したため凡例は非表示
  }
  /* ---------- 2D 表示の拡大縮小・移動（ワークテーブル同様） ---------- */
  let mapView = { x: 0, y: 0, k: 0.5 };
  let mapDrag = null;
  let mapDragged = false;
  function applyMapView() {
    const c = $("#graph-content");
    if (c) c.setAttribute("transform", `translate(${mapView.x},${mapView.y}) scale(${mapView.k})`);
  }
  function mapResetView() {
    const wrap = $("#graph-wrap");
    const W = wrap.clientWidth || 900, H = wrap.clientHeight || 600;
    mapView = { x: -W * 0.25, y: -H * 0.25, k: 0.5 };
    applyMapView();
  }
  function mapZoomAt(cx, cy, factor) {
    const nk = Math.max(0.15, Math.min(8, mapView.k * factor));
    const cxp = (cx - mapView.x) / mapView.k;
    const cyp = (cy - mapView.y) / mapView.k;
    mapView.k = nk;
    mapView.x = cx - cxp * nk;
    mapView.y = cy - cyp * nk;
    applyMapView();
  }
  function initMapPanZoom() {
    const wrap = $("#graph-wrap");
    if (!wrap || wrap.dataset.pz) return;
    wrap.dataset.pz = "1";
    wrap.addEventListener("wheel", (e) => {
      if (mapMode !== "2d") return;
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      mapZoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
    wrap.addEventListener("pointerdown", (e) => {
      if (mapMode !== "2d") return;
      mapDrag = { sx: e.clientX, sy: e.clientY, ox: mapView.x, oy: mapView.y, moved: 0 };
      wrap.classList.add("is-panning");
    });
    window.addEventListener("pointermove", (e) => {
      if (!mapDrag || mapMode !== "2d") return;
      const dx = e.clientX - mapDrag.sx, dy = e.clientY - mapDrag.sy;
      if (Math.hypot(dx, dy) > 4) {
        mapDrag.moved = 1;
        mapView.x = mapDrag.ox + dx; mapView.y = mapDrag.oy + dy;
        applyMapView();
      }
    });
    window.addEventListener("pointerup", () => {
      if (!mapDrag) return;
      mapDragged = !!mapDrag.moved;
      mapDrag = null;
      wrap.classList.remove("is-panning");
      setTimeout(() => (mapDragged = false), 60);
    });
  }
  /* ---------- 連結グループの見出し ---------- */
  let mapShowLabels = true;
  function modeOf(arr) {
    const m = {};
    arr.forEach((v) => { if (v) m[v] = (m[v] || 0) + 1; });
    let best = null, bestN = 0;
    Object.keys(m).forEach((k) => { if (m[k] > bestN) { best = k; bestN = m[k]; } });
    return best;
  }
  function clusterLabelText(comp) {
    // AI 判定で記入されたグループ見出し（GROUP:）を最優先
    const gl = modeOf(comp.map((n) => n.gl || "").filter(Boolean));
    if (gl) return gl;
    const cat = modeOf([].concat(...comp.map((n) => n.cats || [])));
    if (cat) return cat;
    const tag = modeOf([].concat(...comp.map((n) => n.tags || [])));
    if (tag) return tag.replace(/^#/, "");
    // タイトルから共通の語を探す（2文字以上・複数カードに出現）
    const toks = {};
    comp.forEach((n) => {
      tokenize(n.title || "").forEach((tk) => { if (tk.length >= 2) toks[tk] = (toks[tk] || 0) + 1; });
    });
    let best = null, bestN = 1;
    Object.keys(toks).forEach((k) => { if (toks[k] > bestN) { best = k; bestN = toks[k]; } });
    if (best) return best;
    return comp.length + "枚のグループ";
  }
  function buildClusterLabels(nodes, links) {
    const adj = new Map();
    nodes.forEach((n) => adj.set(n.id, []));
    links.forEach((l) => { adj.get(l.a.id).push(l.b); adj.get(l.b.id).push(l.a); });
    const visited = new Set();
    const out = [];
    nodes.forEach((n) => {
      if (visited.has(n.id)) return;
      const comp = [];
      const stack = [n];
      visited.add(n.id);
      while (stack.length) {
        const cur = stack.pop(); comp.push(cur);
        (adj.get(cur.id) || []).forEach((nb) => { if (!visited.has(nb.id)) { visited.add(nb.id); stack.push(nb); } });
      }
      if (comp.length < 2) return; // 連結していない点には見出しを付けない
      const xs = comp.map((x) => x.x), ys = comp.map((x) => x.y);
      out.push({
        x: (Math.min(...xs) + Math.max(...xs)) / 2,
        y: Math.min(...ys) - 16,
        text: clusterLabelText(comp),
      });
    });
    return out;
  }
  function drawMap2D(data) {
    const { W, H, nodes, links } = data;
    const NS = "http://www.w3.org/2000/svg";
    const svg = $("#graph-content") || $("#graph-svg");
    links.forEach((l) => {
      const ln = document.createElementNS(NS, "line");
      ln.setAttribute("x1", l.a.x); ln.setAttribute("y1", l.a.y);
      ln.setAttribute("x2", l.b.x); ln.setAttribute("y2", l.b.y);
      ln.setAttribute("class", "graph-link");
      svg.appendChild(ln);
    });
    nodes.forEach((n) => {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "graph-node");
      g.setAttribute("transform", `translate(${n.x},${n.y})`);
      const r = 4 + n.importance;
      const circ = document.createElementNS(NS, "circle");
      circ.setAttribute("r", r);
      circ.setAttribute("fill", TYPE_COLOR.knowledge);
      const txt = document.createElementNS(NS, "text");
      txt.setAttribute("x", r + 4); txt.setAttribute("y", 4);
      txt.setAttribute("fill", "var(--text)");
      txt.textContent = n.title;
      g.appendChild(circ); g.appendChild(txt);
      bindGraphNodeEvents(g, n);
      svg.appendChild(g);
    });
    // 連結グループの見出し（カテゴリ/タグ/共通語を代表ラベルに）
    if (mapShowLabels) {
      buildClusterLabels(nodes, links).forEach((cl) => {
        const t = document.createElementNS(NS, "text");
        t.setAttribute("class", "graph-cluster-label");
        t.setAttribute("x", cl.x);
        t.setAttribute("y", cl.y);
        t.textContent = cl.text;
        svg.appendChild(t);
      });
    }
  }
  function startMap3D(data) {
    const wrap = $("#graph-wrap");
    const svg = $("#graph-svg");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const state = { data, rotX: -0.32, rotY: 0, auto: !reduce && mapRotate, dragging: false, lastX: 0, lastY: 0 };
    currentMap3D = state;
    const hint = $("#graph-hint");
    const NS = "http://www.w3.org/2000/svg";
    try {
      const ground = document.createElementNS(NS, "polygon");
      ground.setAttribute("class", "map3d-ground");
      ground.setAttribute("fill", "none");
      ground.setAttribute("stroke", "rgba(255,255,255,.14)");
      ground.setAttribute("stroke-width", "1");
      svg.appendChild(ground);
      const linkLayer = document.createElementNS(NS, "g"); linkLayer.setAttribute("class", "map3d-links"); svg.appendChild(linkLayer);
      const nodeLayer = document.createElementNS(NS, "g"); nodeLayer.setAttribute("class", "map3d-nodes"); svg.appendChild(nodeLayer);

      const focal = Math.max(data.W, data.H) * 0.62;
      const ZOOM3D = 1.3; // 3D も間隔を少し広げて表示（中心から1.3倍）
      function project(n) {
        const { W, H } = data;
        const cy = Math.cos(state.rotY), sy = Math.sin(state.rotY);
        const cx = Math.cos(state.rotX), sx = Math.sin(state.rotX);
        const x1 = n.x * cy - n.z * sy;
        const z1 = n.x * sy + n.z * cy;
        const y1 = n.y * cx - z1 * sx;
        const z2 = n.y * sx + z1 * cx;
        const scale = focal / (focal + z2);
        return { x: x1 * scale * ZOOM3D + W / 2, y: y1 * scale * ZOOM3D + H / 2, z: z2, scale };
      }
      const ringR = Math.min(data.W, data.H) * 0.5;
      const floorY = Math.min(data.W, data.H) * 0.34;
      function ringPoints() {
        const pts = [];
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 18) {
          const p = project({ x: Math.cos(a) * ringR, y: floorY, z: Math.sin(a) * ringR });
          pts.push(p.x.toFixed(1) + "," + p.y.toFixed(1));
        }
        return pts.join(" ");
      }
      const linkEls = data.links.map((l) => {
        const ln = document.createElementNS(NS, "line");
        ln.setAttribute("class", "graph-link");
        linkLayer.appendChild(ln);
        return { el: ln, a: l.a, b: l.b };
      });
      const nodeEls = data.nodes.map((n) => {
        const g = document.createElementNS(NS, "g");
        g.setAttribute("class", "graph-node");
        const r = 3 + n.importance * 0.7;
        const circ = document.createElementNS(NS, "circle");
        circ.setAttribute("r", r);
        circ.setAttribute("fill", TYPE_COLOR.knowledge);
        circ.setAttribute("stroke", "rgba(255,255,255,.5)");
        circ.setAttribute("stroke-width", "0.6");
        const txt = document.createElementNS(NS, "text");
        txt.setAttribute("x", r + 3); txt.setAttribute("y", 3);
        txt.setAttribute("font-size", "11");
        txt.setAttribute("fill", "var(--text)");
        txt.setAttribute("class", "gn-label");
        txt.textContent = n.title;
        g.appendChild(circ); g.appendChild(txt);
        bindGraphNodeEvents(g, n);
        nodeLayer.appendChild(g);
        return { el: g, n, baseR: r };
      });
      function draw() {
        ground.setAttribute("points", ringPoints());
        const projected = nodeEls.map((o) => ({ p: project(o.n), o }));
        projected.sort((a, b) => b.p.z - a.p.z);
        projected.forEach(({ p, o }) => {
          const s = Math.max(0.45, Math.min(2.2, p.scale));
          o.el.setAttribute("transform", `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) scale(${s.toFixed(3)})`);
          o.el.style.opacity = (0.55 + 0.45 * Math.min(1, Math.max(0, (p.scale - 0.45) / 1.2))).toFixed(3);
        });
        linkEls.forEach((l) => {
          const pa = project(l.a), pb = project(l.b);
          l.el.setAttribute("x1", pa.x.toFixed(1)); l.el.setAttribute("y1", pa.y.toFixed(1));
          l.el.setAttribute("x2", pb.x.toFixed(1)); l.el.setAttribute("y2", pb.y.toFixed(1));
          const midZ = (pa.z + pb.z) / 2;
          l.el.style.opacity = Math.max(0.06, 0.3 - midZ / (Math.max(data.W, data.H) * 1.4)).toFixed(3);
        });
      }
      function setHint() { if (hint) hint.textContent = state.auto ? "自動回転中・ドラッグで一時停止" : "ドラッグで回転"; }
      function loop() {
        if (state.auto && !state.dragging) state.rotY += 0.003;
        draw();
        map3dRaf = requestAnimationFrame(loop);
      }
      function onDown(e) { state.dragging = true; state.auto = false; wrap.classList.add("is-dragging"); state.lastX = e.clientX; state.lastY = e.clientY; setHint(); }
      function onMove(e) {
        if (!state.dragging) return;
        const dx = e.clientX - state.lastX, dy = e.clientY - state.lastY;
        state.rotY += dx * 0.006; state.rotX += dy * 0.006;
        state.rotX = Math.max(-1.2, Math.min(1.2, state.rotX));
        state.lastX = e.clientX; state.lastY = e.clientY;
      }
      function onUp() {
        if (!state.dragging) return;
        state.dragging = false; wrap.classList.remove("is-dragging");
        setTimeout(() => { if (!state.dragging && mapRotate) { state.auto = true; setHint(); } }, 1400);
      }
      function onLeave() { state.dragging = false; state.auto = !reduce && mapRotate; wrap.classList.remove("is-dragging"); setHint(); }
      function touchStart(e) { if (e.touches[0]) onDown(e.touches[0]); }
      function touchMove(e) { if (e.touches[0]) onMove(e.touches[0]); }
      wrap.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      wrap.addEventListener("touchstart", touchStart, { passive: true });
      window.addEventListener("touchmove", touchMove, { passive: true });
      window.addEventListener("touchend", onUp, { passive: true });
      wrap.addEventListener("mouseleave", onLeave);
      state.cleanup = () => {
        wrap.removeEventListener("mousedown", onDown);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        wrap.removeEventListener("touchstart", touchStart);
        window.removeEventListener("touchmove", touchMove);
        window.removeEventListener("touchend", onUp);
        wrap.removeEventListener("mouseleave", onLeave);
      };
      setHint();
      draw();     // 即座に1フレーム描画（rAFが止まっても表示される）
      loop();
    } catch (err) {
      if (svg) svg.innerHTML = "";
      if (wrap) {
        let d = wrap.querySelector("#map-error");
        if (!d) { d = document.createElement("div"); d.id = "map-error"; d.className = "map-error"; wrap.appendChild(d); }
        d.hidden = false;
        d.textContent = "3D表示エラー: " + (err && err.message ? err.message : String(err));
      }
      if (window.console) console.error("startMap3D error", err);
    }
  }
  function stopMapLoop() {
    if (map3dRaf) { cancelAnimationFrame(map3dRaf); map3dRaf = null; }
    if (currentMap3D) { currentMap3D.cleanup(); currentMap3D = null; }
  }
  function renderMap() {
    stopMapLoop();
    const wrap = $("#graph-wrap");
    let tries = 0;
    const draw = () => {
      const W = wrap.clientWidth || wrap.offsetWidth;
      const H = wrap.clientHeight || wrap.offsetHeight;
      if ((!W || !H) && tries++ < 12) { requestAnimationFrame(draw); return; }   // 寸法が確定するまで最大12フレーム待機
      const w = W || 900, h = H || 600;
      const svg = $("#graph-svg");
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.innerHTML = "";
      const NS = "http://www.w3.org/2000/svg";
      const content = document.createElementNS(NS, "g");
      content.setAttribute("id", "graph-content");
      svg.appendChild(content);
      if (!cards.length) { svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="var(--text-dim)" font-size="14">カードがありません</text>'; return; }
      const data = buildGraphData(w, h);
      updateMapLegend();
      const hint = $("#graph-hint");
      if (mapMode === "2d") {
        mapView = { x: -w * 0.25, y: -h * 0.25, k: 0.5 };
        runLayout2D(data);
        drawMap2D(data);
        applyMapView();
        if (hint) hint.textContent = "ホイールで拡大縮小・ドラッグで移動";
      } else {
        if (hint) hint.textContent = "ドラッグで回転";
        runLayout3D(data);
        startMap3D(data);
      }
    };
    draw();
  }
