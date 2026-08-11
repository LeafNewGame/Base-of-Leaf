"use strict";
/* ---------- 知識マップ（自前力導向レイアウト：2D/3D） ---------- */
  let currentMap3D = null;
  function buildGraphData(W, H) {
    const nodes = cards.map((c) => ({
      id: c.id, title: c.title, type: c.type || "knowledge", importance: c.importance || 3,
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
    const { W, H, nodes, links } = data;
    nodes.forEach((n) => { n.x += W / 2; n.y += H / 2; });
    const ITER = 140, k = 90, rep = 9000, center = 0.01;
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
    g.onclick = () => openEditor(n.id);
  }
  function updateMapLegend() {
    const el = $("#graph-legend");
    const types = [...new Set(cards.map((c) => c.type || "knowledge"))].filter((t) => TYPE_COLOR[t]);
    if (types.length < 2) { el.hidden = true; return; }
    el.innerHTML = types.map((t) => `<span><i style="background:${TYPE_COLOR[t]}"></i>${escapeHtml(TYPE_LABEL[t] || t)}</span>`).join("");
    el.hidden = false;
  }
  function drawMap2D(data) {
    const { W, H, nodes, links } = data;
    const NS = "http://www.w3.org/2000/svg";
    const svg = $("#graph-svg");
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
      circ.setAttribute("fill", TYPE_COLOR[n.type] || TYPE_COLOR.knowledge);
      const txt = document.createElementNS(NS, "text");
      txt.setAttribute("x", r + 4); txt.setAttribute("y", 4);
      txt.setAttribute("fill", "var(--text)");
      txt.textContent = n.title;
      g.appendChild(circ); g.appendChild(txt);
      bindGraphNodeEvents(g, n);
      svg.appendChild(g);
    });
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
      function project(n) {
        const { W, H } = data;
        const cy = Math.cos(state.rotY), sy = Math.sin(state.rotY);
        const cx = Math.cos(state.rotX), sx = Math.sin(state.rotX);
        const x1 = n.x * cy - n.z * sy;
        const z1 = n.x * sy + n.z * cy;
        const y1 = n.y * cx - z1 * sx;
        const z2 = n.y * sx + z1 * cx;
        const scale = focal / (focal + z2);
        return { x: x1 * scale + W / 2, y: y1 * scale + H / 2, z: z2, scale };
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
        circ.setAttribute("fill", TYPE_COLOR[n.type] || TYPE_COLOR.knowledge);
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
      if (!cards.length) { svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="var(--text-dim)" font-size="14">カードがありません</text>'; return; }
      const data = buildGraphData(w, h);
      updateMapLegend();
      if (mapMode === "2d") { runLayout2D(data); drawMap2D(data); }
      else { runLayout3D(data); startMap3D(data); }
    };
    draw();
  }
