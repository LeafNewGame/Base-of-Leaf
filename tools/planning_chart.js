/* =========================================================
   計画チャート - planning_chart.js
   カード（計画）＋ 分岐（条件つき矢印）＋ カード同士の連結
   全画面キャンバス（パン / ズーム）
   ========================================================= */

(function () {
  "use strict";

  var KEY = "planner_chart_v1";
  var SVG_NS = "http://www.w3.org/2000/svg";
  var GRID = 28;          // 方眼の基本サイズ
  var ZMIN = 0.3, ZMAX = 2.5;

  var board   = document.getElementById("pc-board");
  var svg     = document.getElementById("pc-svg");
  var viewport= document.getElementById("pc-viewport");
  var statusEl= document.getElementById("pc-status");
  var zoomLabel = document.getElementById("pc-zoom-label");

  // キャンバスやツールバーが無いページでは何もしない（他ツールとの読み込み共用時用）
  if (!board || !svg || !viewport || !statusEl || !zoomLabel) return;
  if (!document.getElementById("pc-add") || !document.getElementById("pc-help")) return;

  /* 状態 */
  var state = { nodes: [], edges: [], view: { x: 0, y: 0, z: 1 } };

  /* 連結モード用 */
  var linkMode = false;
  var linkSrc = null;      // 接続元として選択中のカード id
  var tempPath = null;     // ドラッグ中の仮の線
  var tempFrom = null;     // 仮の線の接続元カード要素

  /* 編集モード用 */
  var editMode = false;    // 鉛筆ボタンでON/OFF。OFFのときは文字入力させない
  var editingId = null;    // いま編集中のカード id（編集モード時に1枚だけ入れる）

  /* ---------- ユーティリティ ---------- */
  function uid() {
    return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* ---------- カードのサイズ（小・中・大） ---------- */
  var SIZES = { s: "小", m: "中", l: "大" };
  var SIZE_TIP = {
    s: "小：1行分のコンパクトなカード",
    m: "中：デフォルトのカード",
    l: "大：標準のカードの約2.5倍"
  };

  // 未設定でも壊れた値でも「中」にフォールバックする
  function nodeSize(n) {
    return (n && (n.size === "s" || n.size === "l")) ? n.size : "m";
  }

  function setNodeSize(n, v) {
    if (v !== "s" && v !== "m" && v !== "l") return;
    n.size = v;
    save();
    render();
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("保存失敗", e);
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && Array.isArray(d.nodes) && Array.isArray(d.edges)) {
          state = d;
          ensureView();
          return true;
        }
      }
    } catch (e) {
      console.warn("読込失敗", e);
    }
    return false;
  }

  function ensureView() {
    if (!state.view || typeof state.view !== "object") state.view = { x: 0, y: 0, z: 1 };
    if (typeof state.view.x !== "number" || isNaN(state.view.x)) state.view.x = 0;
    if (typeof state.view.y !== "number" || isNaN(state.view.y)) state.view.y = 0;
    if (typeof state.view.z !== "number" || isNaN(state.view.z) || state.view.z <= 0) state.view.z = 1;
    state.view.z = clamp(state.view.z, ZMIN, ZMAX);
    return state.view;
  }

  function V() { return ensureView(); }

  function setStatus(msg, on) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("pc-on", !!on);
  }

  /* ---------- 表示（パン / ズーム） ---------- */
  function applyView() {
    var v = V();
    board.style.transform = "translate(" + v.x + "px," + v.y + "px) scale(" + v.z + ")";
    viewport.style.backgroundSize = (GRID * v.z) + "px " + (GRID * v.z) + "px";
    viewport.style.backgroundPosition = v.x + "px " + v.y + "px";
    zoomLabel.textContent = Math.round(v.z * 100) + "%";
  }

  function updateZoomLabel() {
    zoomLabel.textContent = Math.round(V().z * 100) + "%";
  }

  // 画面座標 → ボード座標
  function screenToBoard(cx, cy) {
    var r = viewport.getBoundingClientRect();
    var v = V();
    return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z };
  }

  // カーソル位置を中心に保ったまま拡大・縮小
  function zoomAt(cx, cy, factor) {
    var v = V();
    var r = viewport.getBoundingClientRect();
    var sx = cx - r.left, sy = cy - r.top;
    var b = { x: (sx - v.x) / v.z, y: (sy - v.y) / v.z };
    var nz = clamp(v.z * factor, ZMIN, ZMAX);
    if (Math.abs(nz - v.z) < 0.0001) return;
    v.z = nz;
    v.x = sx - b.x * v.z;
    v.y = sy - b.y * v.z;
    applyView();
    save();
  }

  function zoomBy(factor) {
    var r = viewport.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
  }

  // カード全体が画面に収まるように表示
  function fitView() {
    var v = V();
    if (!state.nodes.length) { v.x = 0; v.y = 0; v.z = 1; applyView(); save(); return; }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.nodes.forEach(function (n) {
      var el = nodeEl(n.id);
      if (!el) return;
      minX = Math.min(minX, el.offsetLeft);
      minY = Math.min(minY, el.offsetTop);
      maxX = Math.max(maxX, el.offsetLeft + el.offsetWidth);
      maxY = Math.max(maxY, el.offsetTop + el.offsetHeight);
    });
    if (!isFinite(minX)) return;
    var pad = 40;
    var contentW = (maxX - minX) + pad * 2;
    var contentH = (maxY - minY) + pad * 2;
    var r = viewport.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    v.z = clamp(Math.min(r.width / contentW, r.height / contentH, 1.2), ZMIN, ZMAX);
    v.x = (r.width - contentW * v.z) / 2 - (minX - pad) * v.z;
    v.y = (r.height - contentH * v.z) / 2 - (minY - pad) * v.z;
    applyView();
    save();
  }

  /* ---------- ノード / エッジ 操作 ---------- */
  function addCard(x, y, title, text) {
    var n = {
      id: uid(),
      title: title || "",
      text: text || "",
      x: Math.round(x),
      y: Math.round(y),
      size: "m"          // 小・中・大（既定は「中」）
    };
    state.nodes.push(n);
    save();
    return n;
  }

  // これまでの動作：分岐を作り、その先に新しい計画カードを生む
  function addBranch(fromId, condition) {
    var from = nodeById(fromId);
    if (!from) return null;
    var nx = from.x + 270;
    var ny = from.y + 40;
    var guard = 0;
    while (guard++ < 60 && state.nodes.some(function (n) {
      return Math.abs(n.x - nx) < 30 && Math.abs(n.y - ny) < 30;
    })) {
      ny += 40;
    }
    var to = addCard(nx, ny, "", "");
    var e = addEdge(fromId, to.id, condition || "", "branch");
    return e;
  }

  // 新しい動作：既存のカード同士を連結する
  function linkCards(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return null;
    if (!nodeById(fromId) || !nodeById(toId)) return null;
    if (hasEdge(fromId, toId)) return null;
    return addEdge(fromId, toId, "", "link");
  }

  function addEdge(fromId, toId, condition, type) {
    var e = {
      id: uid(),
      from: fromId,
      to: toId,
      condition: condition || "",
      type: type || "branch"
    };
    state.edges.push(e);
    save();
    return e;
  }

  function hasEdge(a, b) {
    return state.edges.some(function (e) { return e.from === a && e.to === b; });
  }

  function nodeById(id) {
    var list = state.nodes.filter(function (n) { return n.id === id; });
    return list[0] || null;
  }

  function nodeEl(id) {
    return board.querySelector('.pc-card[data-id="' + id + '"]');
  }

  function deleteNode(id) {
    state.nodes = state.nodes.filter(function (n) { return n.id !== id; });
    state.edges = state.edges.filter(function (e) {
      return e.from !== id && e.to !== id;
    });
    save();
  }

  function deleteEdge(id) {
    state.edges = state.edges.filter(function (e) { return e.id !== id; });
    save();
  }

  /* ---------- 編集モード（鉛筆ボタン） ---------- */
  function setEditMode(on, id) {
    editMode = !!on;
    editingId = editMode ? (id || null) : null;
    board.classList.toggle("pc-editing", editMode);
    if (!editMode) setStatus("カードをドラッグで動かせます", false);
  }

  // 鉛筆ボタン：そのカードの編集モードをトグル
  function toggleEdit(cardId) {
    if (!editMode) {
      setEditMode(true, cardId);
      setStatus("編集モード：文字を直せます。もう一度鉛筆を押すと確定します", true);
    } else if (editingId === cardId) {
      setEditMode(false);
      setStatus("編集を確定しました", false);
    } else {
      // 別のカードの鉛筆を押した：編集中のカードを切り替える
      editingId = cardId;
      setStatus("編集中のカードを切り替えました", true);
    }
    render();
    if (editMode) {
      var el = nodeEl(editingId);
      if (el) {
        var t = el.querySelector(".pc-card-title");
        if (t) t.focus();
      }
    }
  }

  // テキストを編集できる状態かどうか。
  // 鉛筆を押したカードだけ編集可。押していないカードは動かすだけで入力は起きない。
  function canEditText(id) { return editMode && editingId === id; }

  /* ---------- 線の幾何計算 ---------- */
  // 2枚のカードの位置関係から、つなぎやすい辺を選んでベジェ曲線を作る
  function edgeGeom(fromEl, toEl) {
    var fw = fromEl.offsetWidth, fh = fromEl.offsetHeight;
    var tw = toEl.offsetWidth, th = toEl.offsetHeight;
    var fx = fromEl.offsetLeft, fy = fromEl.offsetTop;
    var tx = toEl.offsetLeft, ty = toEl.offsetTop;
    var fcx = fx + fw / 2, fcy = fy + fh / 2;
    var tcx = tx + tw / 2, tcy = ty + th / 2;
    var dx = tcx - fcx, dy = tcy - fcy;
    var horizontal = Math.abs(dx) >= Math.abs(dy);
    var p1, p2, c1, c2;

    if (horizontal) {
      var sign = dx >= 0 ? 1 : -1;
      p1 = { x: dx >= 0 ? fx + fw : fx, y: fcy };
      p2 = { x: dx >= 0 ? tx : tx + tw, y: tcy };
      var bend1 = Math.max(40, Math.abs(p2.x - p1.x) / 2);
      c1 = { x: p1.x + bend1 * sign, y: p1.y };
      c2 = { x: p2.x - bend1 * sign, y: p2.y };
    } else {
      var vsign = dy >= 0 ? 1 : -1;
      p1 = { x: fcx, y: dy >= 0 ? fy + fh : fy };
      p2 = { x: tcx, y: dy >= 0 ? ty : ty + th };
      var bend2 = Math.max(40, Math.abs(p2.y - p1.y) / 2);
      c1 = { x: p1.x, y: p1.y + bend2 * vsign };
      c2 = { x: p2.x, y: p2.y - bend2 * vsign };
    }
    return { p1: p1, p2: p2, c1: c1, c2: c2, horizontal: horizontal };
  }

  function pathD(g) {
    return "M " + g.p1.x + " " + g.p1.y +
           " C " + g.c1.x + " " + g.c1.y + ", " +
                   g.c2.x + " " + g.c2.y + ", " +
                   g.p2.x + " " + g.p2.y;
  }

  // 曲線の中間点（ベジェの t=0.5）
  function midPoint(g) {
    return {
      x: (g.p1.x + 3 * g.c1.x + 3 * g.c2.x + g.p2.x) / 8,
      y: (g.p1.y + 3 * g.c1.y + 3 * g.c2.y + g.p2.y) / 8
    };
  }

  // 終端で線の向きに合わせた矢じり
  function arrowD(g) {
    var p2 = g.p2, c2 = g.c2;
    var vx = p2.x - c2.x, vy = p2.y - c2.y;
    var len = Math.sqrt(vx * vx + vy * vy);
    if (!len) return "";
    var ux = vx / len, uy = vy / len;
    var L = 10, W = 5.5;
    var bx = p2.x - L * ux, by = p2.y - L * uy;
    var nx = -uy, ny = ux;
    return "M " + p2.x + " " + p2.y +
           " L " + (bx + W * nx) + " " + (by + W * ny) +
           " L " + (bx - W * nx) + " " + (by - W * ny) + " Z";
  }

  /* ---------- 線の描画 ---------- */
  function drawEdges() {
    var olds = svg.querySelectorAll(".pc-edge, .pc-edge-arrow");
    olds.forEach(function (n) { n.remove(); });
    var labels = board.querySelectorAll(".pc-branch-label, .pc-branch-x");
    labels.forEach(function (n) { n.remove(); });

    state.edges.forEach(function (e) {
      var fromEl = nodeEl(e.from);
      var toEl = nodeEl(e.to);
      if (!fromEl || !toEl) return;

      var g = edgeGeom(fromEl, toEl);
      var isLink = e.type === "link";

      var path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("class", "pc-edge" + (isLink ? " pc-link" : ""));
      path.setAttribute("d", pathD(g));
      svg.appendChild(path);

      var ad = arrowD(g);
      if (ad) {
        var arrow = document.createElementNS(SVG_NS, "path");
        arrow.setAttribute("class", "pc-edge-arrow" + (isLink ? " pc-link" : ""));
        arrow.setAttribute("d", ad);
        svg.appendChild(arrow);
      }

      var m = midPoint(g);

      // 条件ラベル（直接編集可）
      var label = document.createElement("div");
      label.className = "pc-branch-label" + (isLink ? " pc-link-label" : "");
      label.contentEditable = "true";
      label.textContent = e.condition || "";
      label.style.left = m.x + "px";
      label.style.top = m.y + "px";
      label.setAttribute("data-edge", e.id);
      label.addEventListener("blur", function () {
        e.condition = label.textContent.trim();
        save();
      });
      label.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") { ev.preventDefault(); label.blur(); }
      });
      board.appendChild(label);

      // 線の削除ボタン（ラベルの右横に置く）
      var xb = document.createElement("div");
      xb.className = "pc-branch-x";
      xb.textContent = "×";
      xb.title = isLink ? "この連結を削除" : "この分岐を削除";
      xb.addEventListener("click", function (ev) {
        ev.stopPropagation();
        deleteEdge(e.id);
        render();
      });
      board.appendChild(xb);

      // ラベルの実測幅に合わせて削除ボタンを配置
      var lw = label.offsetWidth || 0;
      xb.style.left = (m.x + Math.min(lw / 2, 95) + 12) + "px";
      xb.style.top = m.y + "px";
    });
  }

  /* ---------- step 番号の計算 ---------- */
  // 番号の決まり方：
  //   ・メインの数字は「開始からそのカードまで線をたどった本数」（深さ）。
  //     3枚一直線なら step1 / step2 / step3。
  //   ・途中で1枚のカードから2本以上に枝分かれしたときは、
  //     選んだ枝の順番を「-1」「-2」…として後ろに足す。
  //     例えば 1枚から2本枝分かれしたなら step2-1 / step2-2。
  //   ・さらに深い場所で枝分かれした分は、経路打野の枝番号を積み上げる。
  function computeSteps() {
    var map = {};
    if (!state.nodes.length) return map;

    var byId = {};
    state.nodes.forEach(function (n) { byId[n.id] = n; });

    // 入ってくる線を持たないカード＝開始点
    var hasIn = {};
    state.edges.forEach(function (e) { if (byId[e.to]) hasIn[e.to] = true; });
    var roots = state.nodes.filter(function (n) { return !hasIn[n.id]; });
    if (!roots.length) roots = [state.nodes[0]];

    // 「開始」と書かれたカードを最優先で根にする
    var startMarked = roots.filter(function (n) {
      var t = ((n.title || "") + " " + (n.text || "")).trim();
      return /^(開始|スタート|start|Start|START)/.test(t);
    });
    var ordered = startMarked.concat(roots.filter(function (n) {
      return startMarked.indexOf(n) === -1;
    }));

    // 画面上の位置順（左→右、↑→下）で枝の順番を決める
    function byPos(a, b) {
      return (a.x - b.x) || (a.y - b.y);
    }

    function label(depth, forks) {
      return "step" + depth + (forks.length ? "-" + forks.join("-") : "");
    }

    // 行き先のカード（枝の順番は画面位置順）
    function childrenOf(id) {
      var seen = {};
      var kids = [];
      state.edges.forEach(function (e) {
        if (e.from !== id || !byId[e.to] || seen[e.to]) return;
        seen[e.to] = true;
        kids.push(e.to);
      });
      return kids.sort(function (a, b) { return byPos(byId[a], byId[b]); });
    }

    // 2本以上の線が集まるカード（＝合流点）。枝を選んでいないので枝番号は付けない。
    function inDegree(id) {
      return state.edges.filter(function (e) { return e.to === id; }).length;
    }

    // 幅優先で深さと枝番号を届ける。循環は訪問済みで止める。
    var visited = {};
    var queue = ordered.map(function (n) {
      return { id: n.id, depth: 1, forks: [] };
    });
    ordered.forEach(function (n) { visited[n.id] = true; });
    ordered.forEach(function (n) { map[n.id] = label(1, []); });

    var maxDepth = 1;
    while (queue.length) {
      var cur = queue.shift();
      var kids = childrenOf(cur.id).filter(function (id) { return !visited[id]; });
      if (!kids.length) continue;
      var nextDepth = cur.depth + 1;
      kids.forEach(function (id, i) {
        visited[id] = true;
        // 2本以上分岐したときだけ枝番号を付ける（1本ならそのまま進む）
        var branched = kids.length >= 2;
        var forks = branched ? cur.forks.concat([i + 1]) : cur.forks;
        // 合流点は枝を選んでいないので、枝番号を引き継がない
        if (inDegree(id) >= 2) forks = [];
        map[id] = label(nextDepth, forks);
        if (nextDepth > maxDepth) maxDepth = nextDepth;
        queue.push({ id: id, depth: nextDepth, forks: forks });
      });
    }

    // どこからも繋がっていないカードは、番号続きで振っておく
    var extra = maxDepth;
    state.nodes.forEach(function (n) {
      if (map[n.id] !== undefined) return;
      extra++;
      map[n.id] = label(extra, []);
    });

    return map;
  }

  /* ---------- カードの描画 ---------- */
  function renderCards() {
    var olds = board.querySelectorAll(".pc-card");
    olds.forEach(function (n) { n.remove(); });

    var steps = computeSteps();

    state.nodes.forEach(function (n) {
      var card = document.createElement("div");
      card.className = "pc-card";
      if (linkSrc === n.id) card.classList.add("pc-pick-src");
      if (editMode && editingId === n.id) card.classList.add("pc-editing-now");
      // 小・中・大（未設定は「中」）
      card.classList.add("pc-size-" + nodeSize(n));
      card.setAttribute("data-id", n.id);
      card.style.left = n.x + "px";
      card.style.top = n.y + "px";

      /* ヘッダー（ドラッグ + タイトル + 削除） */
      var head = document.createElement("div");
      head.className = "pc-card-head";

      var badge = document.createElement("span");
      badge.className = "pc-card-badge";
      badge.textContent = steps[n.id] || "step1";

      var title = document.createElement("div");
      title.className = "pc-card-title";
      // 鉛筆を押したカードだけ入力可能にする
      title.contentEditable = canEditText(n.id) ? "true" : "false";
      title.textContent = n.title || "";
      title.addEventListener("blur", function () {
        n.title = title.textContent.trim();
        save();
      });
      title.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") { ev.preventDefault(); title.blur(); }
      });

      // 鉛筆ボタン（このカードの編集モードをON/OFF）
      var pencil = document.createElement("button");
      pencil.className = "pc-card-pencil" + (editMode && editingId === n.id ? " pc-on" : "");
      pencil.textContent = "✎";
      pencil.title = (editMode && editingId === n.id)
        ? "編集を確定する"
        : "文字を編集する（このカードを編集モードに）";
      pencil.addEventListener("click", function (ev) {
        ev.stopPropagation();
        toggleEdit(n.id);
      });

      var del = document.createElement("button");
      del.className = "pc-card-del";
      del.textContent = "×";
      del.title = "カードを削除";
      del.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (confirm("この計画カードを削除しますか？")) {
          deleteNode(n.id);
          if (editingId === n.id) editingId = null;
          render();
        }
      });

      head.appendChild(badge);
      head.appendChild(title);
      head.appendChild(pencil);
      head.appendChild(del);

      /* 本文（やるべき計画） */
      var editable = canEditText(n.id);
      var body = document.createElement("textarea");
      body.className = "pc-card-body";
      body.placeholder = editable ? "やるべき計画を書く…" : "鉛筆を押すと入力できます";
      body.value = n.text || "";
      // 鉛筆を押していないカードは読み取り専用にして、意図しない文字入力を防ぐ
      body.readOnly = !editable;
      if (!editable) {
        body.addEventListener("focus", function () { body.blur(); });
      }
      body.addEventListener("input", function () {
        n.text = body.value;
        save();
      });

      /* アクション */
      var actions = document.createElement("div");
      actions.className = "pc-card-actions";
      var branchBtn = document.createElement("button");
      branchBtn.className = "pc-card-branch";
      branchBtn.textContent = "＋ 分岐";
      branchBtn.title = "条件つきの矢印と、その先の新しいカードを作ります";
      branchBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        addBranch(n.id, "");
        // できた先にすぐ書けるよう、鉛筆モードを開く
        var made = state.nodes[state.nodes.length - 1];
        setEditMode(true, made ? made.id : null);
        render();
        var last = board.querySelectorAll(".pc-branch-label");
        if (last.length) last[last.length - 1].focus();
      });
      actions.appendChild(branchBtn);

      /* サイズ切替（鉛筆を押したカードだけ表示） */
      var sizeRow = null;
      if (editable) {
        sizeRow = document.createElement("div");
        sizeRow.className = "pc-card-size";

        var sizeLabel = document.createElement("span");
        sizeLabel.className = "pc-size-label";
        sizeLabel.textContent = "サイズ";
        sizeRow.appendChild(sizeLabel);

        Object.keys(SIZES).forEach(function (k) {
          var sb = document.createElement("button");
          sb.className = "pc-size-btn" + (nodeSize(n) === k ? " pc-on" : "");
          sb.textContent = SIZES[k];
          sb.title = SIZE_TIP[k];
          sb.addEventListener("click", function (ev) {
            ev.stopPropagation();
            setNodeSize(n, k);
          });
          sizeRow.appendChild(sb);
        });
      }

      /* 連結ポイント（ここから別のカードへドラッグ） */
      var port = document.createElement("div");
      port.className = "pc-port";
      port.textContent = "●";
      port.title = "ドラッグして別のカードへ連結";
      port.addEventListener("pointerdown", function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        startTempLink(card, ev);
      });

      card.appendChild(head);
      card.appendChild(body);
      if (sizeRow) card.appendChild(sizeRow);
      card.appendChild(actions);
      card.appendChild(port);

      /* 連結モード：カードをクリックして接続元 → 接続先 */
      card.addEventListener("click", function (ev) {
        if (ev.target.closest(".pc-card-del")) return;
        if (ev.target.closest(".pc-card-branch")) return;
        if (ev.target.closest(".pc-card-pencil")) return;
        if (ev.target.closest(".pc-port")) return;
        if (ev.target.tagName === "TEXTAREA") return;
        if (!linkMode) return;
        ev.stopPropagation();
        pickCardForLink(n.id);
      });

      enableDrag(card, n);
      board.appendChild(card);
    });
  }

  function render() {
    renderCards();
    drawEdges();
  }

  /* ---------- 連結モード（クリックでカード同士をつなぐ） ---------- */
  function pickCardForLink(id) {
    if (linkSrc === null) {
      linkSrc = id;
      setStatus("接続先のカードをクリックしてください（Esc で解除）", true);
      render();
      return;
    }
    if (linkSrc === id) {
      linkSrc = null;
      setStatus("同じカードは選べません。接続元を選び直してください", true);
      render();
      return;
    }
    if (hasEdge(linkSrc, id)) {
      linkSrc = null;
      setStatus("その2枚はすでに連結されています", true);
      render();
      return;
    }
    var e = linkCards(linkSrc, id);
    linkSrc = null;
    if (e) {
      setStatus("カードを連結しました。ラベルをクリックすると説明を書けます", true);
    } else {
      setStatus("連結できませんでした", true);
    }
    render();
  }

  function exitLinkMode() {
    linkMode = false;
    linkSrc = null;
    viewport.classList.remove("pc-linking");
    var btn = document.getElementById("pc-link");
    if (btn) btn.classList.remove("pc-on");
    setStatus("カードをドラッグで動かせます（追加したいときはツールバーの＋カード）", false);
    render();
  }

  /* ---------- 連結ポイントからのドラッグ ---------- */
  function tempFromPoint(fromEl) {
    return {
      x: fromEl.offsetLeft + fromEl.offsetWidth,
      y: fromEl.offsetTop + fromEl.offsetHeight / 2
    };
  }

  function startTempLink(fromEl, ev) {
    tempFrom = fromEl;
    tempPath = document.createElementNS(SVG_NS, "path");
    tempPath.setAttribute("class", "pc-link-temp");
    svg.appendChild(tempPath);

    var move = function (e) { updateTempLink(e); };
    var up = function (e) { finishTempLink(e, move, up); };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    updateTempLink(ev);
  }

  function updateTempLink(ev) {
    if (!tempPath || !tempFrom) return;
    var p = tempFromPoint(tempFrom);
    var b = screenToBoard(ev.clientX, ev.clientY);
    var g = {
      p1: p,
      p2: b,
      c1: { x: p.x + Math.max(40, (b.x - p.x) / 2), y: p.y },
      c2: { x: b.x - Math.max(40, (b.x - p.x) / 2), y: b.y }
    };
    tempPath.setAttribute("d", pathD(g));
  }

  function finishTempLink(ev, move, up) {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    if (tempPath) { tempPath.remove(); tempPath = null; }

    var target = document.elementFromPoint(ev.clientX, ev.clientY);
    var cardEl = target && target.closest ? target.closest(".pc-card") : null;
    var fromEl = tempFrom;
    tempFrom = null;
    if (!cardEl || !fromEl) return;

    var fromId = fromEl.getAttribute("data-id");
    var toId = cardEl.getAttribute("data-id");
    if (!fromId || !toId || fromId === toId) return;
    if (hasEdge(fromId, toId)) {
      setStatus("その2枚はすでに連結されています", false);
      return;
    }
    linkCards(fromId, toId);
    setStatus("カードを連結しました", false);
    render();
  }

  /* ---------- ドラッグ（カード移動） ---------- */
  function enableDrag(card, n) {
    var head = card.querySelector(".pc-card-head");
    var dragging = false;
    var sx, sy, ox, oy;

    // どこを押しても動かせるようにする（入力欄とボタンは除く）
    function onDown(ev) {
      if (ev.button !== 0 && ev.pointerType === "mouse") return;
      if (ev.target.closest(".pc-card-del")) return;
      if (ev.target.closest(".pc-card-pencil")) return;
      if (ev.target.closest(".pc-card-branch")) return;
      if (ev.target.closest(".pc-card-size")) return;
      if (ev.target.closest(".pc-port")) return;
      // 編集モードでないときは入力欄の上でもドラッグを優先（文字入力を起こさない）
      if (ev.target.tagName === "TEXTAREA" && canEditText(n.id)) return;
      if (editMode && ev.target.closest(".pc-card-title")) return;
      dragging = true;
      sx = ev.clientX;
      sy = ev.clientY;
      ox = n.x;
      oy = n.y;
      card.style.zIndex = 50;
      try { card.setPointerCapture(ev.pointerId); } catch (e) {}
      ev.preventDefault();
    }

    function onMove(ev) {
      if (!dragging) return;
      var z = V().z;
      n.x = ox + (ev.clientX - sx) / z;
      n.y = oy + (ev.clientY - sy) / z;
      card.style.left = n.x + "px";
      card.style.top = n.y + "px";
      drawEdges();
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      n.x = Math.round(n.x);
      n.y = Math.round(n.y);
      card.style.left = n.x + "px";
      card.style.top = n.y + "px";
      card.style.zIndex = "";
      drawEdges();
      save();
    }

    card.addEventListener("pointerdown", onDown);
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerup", onUp);
    card.addEventListener("pointercancel", onUp);
  }

  /* ---------- キャンバスのパン / ズーム操作 ---------- */
  var panning = false, psx = 0, psy = 0, pox = 0, poy = 0;

  viewport.addEventListener("pointerdown", function (ev) {
    if (ev.button !== 0) return;
    var t = ev.target;
    if (t.closest && (t.closest(".pc-card") || t.closest(".pc-branch-label") ||
                      t.closest(".pc-branch-x") || t.closest(".pc-help"))) return;
    panning = true;
    psx = ev.clientX; psy = ev.clientY;
    var v = V();
    pox = v.x; poy = v.y;
    viewport.classList.add("pc-panning");
    try { viewport.setPointerCapture(ev.pointerId); } catch (e) {}
  });

  viewport.addEventListener("pointermove", function (ev) {
    if (!panning) return;
    var v = V();
    v.x = pox + (ev.clientX - psx);
    v.y = poy + (ev.clientY - psy);
    viewport.style.backgroundPosition = v.x + "px " + v.y + "px";
    board.style.transform = "translate(" + v.x + "px," + v.y + "px) scale(" + v.z + ")";
  });

  function endPan() {
    if (!panning) return;
    panning = false;
    viewport.classList.remove("pc-panning");
    save();
  }
  viewport.addEventListener("pointerup", endPan);
  viewport.addEventListener("pointercancel", endPan);

  viewport.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    var factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAt(ev.clientX, ev.clientY, factor);
  }, { passive: false });

  // 何もない所をダブルクリック → そこに新しいカード
  viewport.addEventListener("dblclick", function (ev) {
    var t = ev.target;
    if (t.closest && (t.closest(".pc-card") || t.closest(".pc-help") ||
                      t.closest(".pc-branch-label") || t.closest(".pc-branch-x"))) return;
    var b = screenToBoard(ev.clientX, ev.clientY);
    addCardAndEdit(b.x - 110, b.y - 60);
  });

  /* ---------- ツールバー ---------- */
  // 新しいカードを作ったら、そのまま鉛筆モードを開いて書けるようにする
  function addCardAndEdit(x, y) {
    var n = addCard(x, y, "", "");
    setEditMode(true, n.id);
    render();
    var el = nodeEl(n.id);
    if (el) {
      var t = el.querySelector(".pc-card-title");
      if (t) t.focus();
    }
  }

  function addCardAtCenter() {
    var r = viewport.getBoundingClientRect();
    var b = screenToBoard(r.left + r.width / 2, r.top + r.height / 2);
    addCardAndEdit(b.x - 110 + (Math.random() * 40 - 20),
                   b.y - 60 + (Math.random() * 40 - 20));
  }

  document.getElementById("pc-add").addEventListener("click", addCardAtCenter);

  document.getElementById("pc-link").addEventListener("click", function () {
    linkMode = !linkMode;
    linkSrc = null;
    // 連結モードと編集モードは同時に使わない
    if (linkMode) setEditMode(false);
    this.classList.toggle("pc-on", linkMode);
    viewport.classList.toggle("pc-linking", linkMode);
    if (linkMode) {
      setStatus("連結モード：接続元のカードをクリック → 接続先のカードをクリック（Esc で解除）", true);
    } else {
      setStatus("カードをドラッグで動かせます（文字を直すには鉛筆を押す）", false);
    }
    render();
  });

  document.getElementById("pc-clear").addEventListener("click", function () {
    if (confirm("すべてのカードと線を削除しますか？")) {
      state = { nodes: [], edges: [], view: { x: 0, y: 0, z: 1 } };
      linkSrc = null;
      setEditMode(false);
      save();
      render();
      applyView();
      setStatus("「＋ カード」で計画を追加してください", false);
    }
  });

  document.getElementById("pc-sample").addEventListener("click", function () {
    if (!confirm("現在のカードと線をすべて消して、サンプルを表示しますか？")) return;
    state = {
      nodes: [
        { id: "s1", title: "目標：副業を始める", text: "毎月3万円の収入を目指す", x: 40, y: 40 },
        { id: "s2", title: "Webライティングを試す", text: "クラウドソーシングで実績を作る", x: 340, y: 20 },
        { id: "s3", title: "ハンドメイドを試す", text: "物販サイトで出品する", x: 340, y: 190 },
        { id: "s4", title: "スキルを伸ばす", text: "週1回は学習時間を確保", x: 660, y: 90 }
      ],
      edges: [
        { id: "e1", from: "s1", to: "s2", condition: "文章が好き", type: "branch" },
        { id: "e2", from: "s1", to: "s3", condition: "物作りが好き", type: "branch" },
        { id: "e3", from: "s2", to: "s4", condition: "反応があったら", type: "branch" },
        { id: "e4", from: "s3", to: "s4", condition: "", type: "link" }
      ],
      view: { x: 0, y: 0, z: 1 }
    };
    linkSrc = null;
    setEditMode(false);
    save();
    render();
    fitView();
    setStatus("サンプルを表示しました（「✎」で文字を編集できます）", false);
  });

  /* ズーム操作 */
  document.getElementById("pc-zoom-in").addEventListener("click", function () { zoomBy(1.2); });
  document.getElementById("pc-zoom-out").addEventListener("click", function () { zoomBy(1 / 1.2); });
  document.getElementById("pc-zoom-reset").addEventListener("click", function () {
    var v = V();
    v.z = 1;
    applyView();
    save();
  });
  document.getElementById("pc-fit").addEventListener("click", fitView);

  /* 使い方パネル */
  var helpEl = document.getElementById("pc-help");
  document.getElementById("pc-help-toggle").addEventListener("click", function () {
    helpEl.hidden = !helpEl.hidden;
  });
  document.getElementById("pc-help-close").addEventListener("click", function () {
    helpEl.hidden = true;
  });

  /* Esc で編集モード / 連結モードを解除 */
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Escape") return;
    if (editMode) { setEditMode(false); render(); }
    else if (linkMode) exitLinkMode();
    else if (!helpEl.hidden) helpEl.hidden = true;
    else if (linkSrc !== null) { linkSrc = null; render(); }
  });

  /* ---------- JSON 出力 / 読込 ---------- */
  document.getElementById("pc-export").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "planning-chart.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  var fileInput = document.getElementById("pc-file");
  document.getElementById("pc-import").addEventListener("click", function () {
    fileInput.click();
  });
  fileInput.addEventListener("change", function () {
    var f = fileInput.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (d && Array.isArray(d.nodes) && Array.isArray(d.edges)) {
          state = d;
          ensureView();
          linkSrc = null;
          setEditMode(false);
          save();
          render();
          fitView();
        }
      } catch (e) {
        alert("JSONの読込に失敗しました");
      }
      fileInput.value = "";
    };
    r.readAsText(f);
  });

  /* ---------- 起動 ---------- */
  // 最初の状態：「開始」と「ゴール」の2枚だけのカード
  function makeStarter() {
    return {
      nodes: [
        { id: "st_start", title: "開始", text: "今いる場所・現状をまとめる", x: 80, y: 140 },
        { id: "st_goal", title: "ゴール", text: "到達したい状態を書き出す", x: 420, y: 140 }
      ],
      edges: [
        { id: "st_e1", from: "st_start", to: "st_goal", condition: "", type: "branch" }
      ],
      view: { x: 0, y: 0, z: 1 }
    };
  }

  function boot() {
    var had = load();      // 保存データがあったか
    ensureView();
    if (!had) {
      // サンプルは自動では出さず、開始とゴールの2枚だけを出す
      state = makeStarter();
      save();
    }
    render();
    applyView();
    fitView();
    setStatus("「✎」を押すと文字を編集できます（押していないときは動かすだけ）", false);
  }

  boot();

})();
