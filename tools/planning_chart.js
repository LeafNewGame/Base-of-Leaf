/* =========================================================
   計画チャート（試作） - planning_chart.js
   カード（計画）＋ 分岐（条件付き矢印）のフローチャート
   ========================================================= */

(function () {
  "use strict";

  var KEY = "planner_chart_v1";
  var SVG_NS = "http://www.w3.org/2000/svg";

  var board = document.getElementById("pc-board");
  var svg = document.getElementById("pc-svg");

  /* 状態 */
  var state = {
    nodes: [], // {id, title, text, x, y}
    edges: []  // {id, from, to, condition}
  };

  /* ---------- ユーティリティ ---------- */
  function uid() {
    return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
          return true;
        }
      }
    } catch (e) {
      console.warn("読込失敗", e);
    }
    return false;
  }

  /* ---------- ノード / エッジ 操作 ---------- */
  function addCard(x, y, title, text) {
    var n = {
      id: uid(),
      title: title || "",
      text: text || "",
      x: Math.round(x),
      y: Math.round(y)
    };
    state.nodes.push(n);
    save();
    return n;
  }

  // 分岐を作り、その先に新しい計画カードを生む
  function addBranch(fromId, condition) {
    var from = state.nodes.filter(function (n) { return n.id === fromId; })[0];
    if (!from) return null;
    var nx = from.x + 270;
    var ny = from.y + 40;
    // 重なりを避ける：同じ列に近いカードがあれば少し下へ
    while (state.nodes.some(function (n) {
      return Math.abs(n.x - nx) < 30 && Math.abs(n.y - ny) < 30;
    })) {
      ny += 40;
    }
    var to = addCard(nx, ny, "", "");
    var e = {
      id: uid(),
      from: fromId,
      to: to.id,
      condition: condition || ""
    };
    state.edges.push(e);
    save();
    return e;
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

  /* ---------- 描画 ---------- */
  function nodeEl(id) {
    return board.querySelector('.pc-card[data-id="' + id + '"]');
  }

  function centerOf(el) {
    return {
      x: el.offsetLeft + el.offsetWidth / 2,
      y: el.offsetTop + el.offsetHeight / 2
    };
  }

  // 接続点：from の右側 → to の左側
  function endpoints(fromEl, toEl) {
    return {
      x1: fromEl.offsetLeft + fromEl.offsetWidth,
      y1: fromEl.offsetTop + fromEl.offsetHeight / 2,
      x2: toEl.offsetLeft,
      y2: toEl.offsetTop + toEl.offsetHeight / 2
    };
  }

  function drawEdges() {
    // 既存の描画をクリア（カード要素は残す）
    var old = svg.querySelectorAll(".pc-edge, .pc-edge-arrow, .pc-edge-group");
    old.forEach(function (n) { n.remove(); });
    var labels = board.querySelectorAll(".pc-branch-label, .pc-branch-x");
    labels.forEach(function (n) { n.remove(); });

    state.edges.forEach(function (e) {
      var fromEl = nodeEl(e.from);
      var toEl = nodeEl(e.to);
      if (!fromEl || !toEl) return;

      var p = endpoints(fromEl, toEl);
      // カード間をつなぐ曲線
      var dx = Math.max(40, (p.x2 - p.x1) / 2);
      var d = "M " + p.x1 + " " + p.y1 +
              " C " + (p.x1 + dx) + " " + p.y1 + ", " +
              (p.x2 - dx) + " " + p.y2 + ", " +
              p.x2 + " " + p.y2;

      var path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("class", "pc-edge");
      path.setAttribute("d", d);
      svg.appendChild(path);

      // 矢印
      var arrow = document.createElementNS(SVG_NS, "path");
      arrow.setAttribute("class", "pc-edge-arrow");
      arrow.setAttribute("d", "M " + (p.x2 - 9) + " " + (p.y2 - 5) +
                              " L " + p.x2 + " " + p.y2 +
                              " L " + (p.x2 - 9) + " " + (p.y2 + 5) + " Z");
      svg.appendChild(arrow);

      // 条件ラベル（中点）
      var mx = (p.x1 + p.x2) / 2;
      var my = (p.y1 + p.y2) / 2;
      var label = document.createElement("div");
      label.className = "pc-branch-label";
      label.contentEditable = "true";
      label.textContent = e.condition || "";
      label.style.left = mx + "px";
      label.style.top = my + "px";
      label.addEventListener("blur", function () {
        e.condition = label.textContent.trim();
        save();
      });
      label.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") { ev.preventDefault(); label.blur(); }
      });
      board.appendChild(label);

      // 分岐削除ボタン
      var xb = document.createElement("div");
      xb.className = "pc-branch-x";
      xb.textContent = "×";
      xb.style.left = mx + "px";
      xb.style.top = my + "px";
      xb.title = "この分岐を削除";
      xb.addEventListener("click", function () {
        deleteEdge(e.id);
        render();
      });
      board.appendChild(xb);
    });
  }

  function renderCards() {
    // カード要素を再構築
    var olds = board.querySelectorAll(".pc-card");
    olds.forEach(function (n) { n.remove(); });

    state.nodes.forEach(function (n) {
      var card = document.createElement("div");
      card.className = "pc-card";
      card.setAttribute("data-id", n.id);
      card.style.left = n.x + "px";
      card.style.top = n.y + "px";

      // ヘッド（ドラッグ + タイトル + 削除）
      var head = document.createElement("div");
      head.className = "pc-card-head";

      var badge = document.createElement("span");
      badge.className = "pc-card-badge";
      badge.textContent = "計画";

      var title = document.createElement("div");
      title.className = "pc-card-title";
      title.contentEditable = "true";
      title.textContent = n.title || "";
      title.addEventListener("blur", function () {
        n.title = title.textContent.trim();
        save();
      });
      title.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") { ev.preventDefault(); title.blur(); }
      });

      var del = document.createElement("button");
      del.className = "pc-card-del";
      del.textContent = "×";
      del.title = "カードを削除";
      del.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (confirm("この計画カードを削除しますか？")) {
          deleteNode(n.id);
          render();
        }
      });

      head.appendChild(badge);
      head.appendChild(title);
      head.appendChild(del);

      // 本文（やるべき計画）
      var body = document.createElement("textarea");
      body.className = "pc-card-body";
      body.placeholder = "やるべき計画を書く…";
      body.value = n.text || "";
      body.addEventListener("input", function () {
        n.text = body.value;
        save();
      });
      // ドラッグ中に textarea を操作できるよう止めない

      // アクション
      var actions = document.createElement("div");
      actions.className = "pc-card-actions";
      var branchBtn = document.createElement("button");
      branchBtn.className = "pc-card-branch";
      branchBtn.textContent = "＋ 分岐";
      branchBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        addBranch(n.id, "");
        render();
        // 作ったばかりの条件ラベルを編集モードに
        var last = board.querySelector(".pc-branch-label");
        if (last) { last.focus(); }
      });
      actions.appendChild(branchBtn);

      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(actions);

      // ドラッグ
      enableDrag(card, n);

      board.appendChild(card);
    });
  }

  function render() {
    renderCards();
    drawEdges();
  }

  /* ---------- ドラッグ ---------- */
  function enableDrag(card, n) {
    var head = card.querySelector(".pc-card-head");
    var dragging = false;
    var sx, sy, ox, oy;

    head.addEventListener("pointerdown", function (ev) {
      // テキスト編集中はドラッグしない
      if (ev.target.isContentEditable) return;
      dragging = true;
      sx = ev.clientX;
      sy = ev.clientY;
      ox = n.x;
      oy = n.y;
      head.setPointerCapture(ev.pointerId);
      card.style.zIndex = 50;
    });
    head.addEventListener("pointermove", function (ev) {
      if (!dragging) return;
      n.x = ox + (ev.clientX - sx);
      n.y = oy + (ev.clientY - sy);
      card.style.left = n.x + "px";
      card.style.top = n.y + "px";
      drawEdges();
    });
    head.addEventListener("pointerup", function (ev) {
      if (!dragging) return;
      dragging = false;
      card.style.zIndex = "";
      save();
    });
    head.addEventListener("pointercancel", function () {
      dragging = false;
    });
  }

  /* ---------- ツールバー ---------- */
  document.getElementById("pc-add").addEventListener("click", function () {
    var x = board.scrollLeft + 60 + Math.random() * 40;
    var y = board.scrollTop + 60 + Math.random() * 40;
    var n = addCard(x, y, "", "");
    render();
    var el = nodeEl(n.id);
    if (el) {
      var t = el.querySelector(".pc-card-title");
      if (t) t.focus();
    }
  });

  document.getElementById("pc-clear").addEventListener("click", function () {
    if (confirm("すべてのカードと分岐を削除しますか？")) {
      state = { nodes: [], edges: [] };
      save();
      render();
    }
  });

  document.getElementById("pc-sample").addEventListener("click", function () {
    state = {
      nodes: [
        { id: "s1", title: "目標：副業を始める", text: "毎月3万円の収入を目指す", x: 40, y: 40 },
        { id: "s2", title: "Webライティングを試す", text: "クラウドソーシングで実績を作る", x: 320, y: 20 },
        { id: "s3", title: "ハンドメイドを試す", text: "物販サイトで出品する", x: 320, y: 160 },
        { id: "s4", title: "スキルを伸ばす", text: "週1回は学習時間を確保", x: 620, y: 60 }
      ],
      edges: [
        { id: "e1", from: "s1", to: "s2", condition: "文章が好き" },
        { id: "e2", from: "s1", to: "s3", condition: "物作りが好き" },
        { id: "e3", from: "s2", to: "s4", condition: "反応があったら" }
      ]
    };
    save();
    render();
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
        if (d && Array.isArray(d.nodes)) {
          state = d;
          save();
          render();
        }
      } catch (e) {
        alert("JSONの読込に失敗しました");
      }
      fileInput.value = "";
    };
    r.readAsText(f);
  });

  /* ---------- 起動 ---------- */
  if (!load() || state.nodes.length === 0) {
    // 初回はサンプルをちら見せ
    document.getElementById("pc-sample").click();
  } else {
    render();
  }

})();
