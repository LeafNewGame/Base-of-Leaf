/* =========================================================
   試験的なツール：単語帳（試験的）
   - 表（問題）と裏（答え）のペアを登録して復習する
   - データは localStorage（wb_vocab_v1）に保存
   ========================================================= */
(function () {
  "use strict";

  var KEY = "wb_vocab_v1";
  var VIEW_KEY = "wb_view_v1";

  /* ---------- DOM 参照 ---------- */
  var $ = function (id) { return document.getElementById(id); };

  var tabList   = $("wb-tab-list");
  var tabStudy  = $("wb-tab-study");
  var tabWip    = $("wb-tab-wip");
  var viewList  = $("wb-view-list");
  var viewStudy = $("wb-view-study");
  var viewWip   = $("wb-view-wip");

  var inFront   = $("wb-in-front");
  var inBack    = $("wb-in-back");
  var inDetail  = $("wb-in-detail");
  var addBtn    = $("wb-add-btn");
  var addMsg    = $("wb-add-msg");
  var listEl    = $("wb-list");
  var countEl   = $("wb-count");

  var quizEmpty  = $("wb-quiz-empty");
  var quizBody   = $("wb-quiz-body");
  var quizWord   = $("wb-quiz-word");
  var feedback   = $("wb-feedback");
  var fbMark     = $("wb-feedback-mark");
  var fbText     = $("wb-feedback-text");
  var meaning    = $("wb-meaning");
  var meaningTx  = $("wb-meaning-text");
  var detailEl   = $("wb-detail");
  var detailTx   = $("wb-detail-text");
  var detailEmpty= $("wb-detail-empty");
  var choicesEl  = $("wb-choices");
  var noteEl     = $("wb-choices-note");
  var progBar    = $("wb-progress-bar");
  var progLabel  = $("wb-progress-label");
  var btnKnow    = $("wb-know");
  var btnNext    = $("wb-next");
  var btnPrev    = $("wb-prev");
  var studyFil   = $("wb-study-filter");
  var btnRestart = $("wb-restart");

  /* ---------- 状態 ---------- */
  var items = [];
  var editingId = null;
  var queue = [];
  var idx = 0;
  var answered = false;
  var options = [];      /* 出題中の選択肢（表紙・本文・正解かどうか） */
  var correctCount = 0;  /* 今回の周回で正解した数 */

  /* ---------- 保存データ ---------- */
  function uid() {
    return "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function validItem(o) {
    return o && typeof o === "object" &&
      typeof o.front === "string" && typeof o.back === "string";
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(validItem).map(function (o) {
        return {
          id: typeof o.id === "string" ? o.id : uid(),
          front: o.front,
          back: o.back,
          detail: typeof o.detail === "string" ? o.detail : "",
          learned: !!o.learned
        };
      });
    } catch (e) {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (e) { /* 保存できない環境では何もしない */ }
  }

  /* ---------- 一覧の描画 ---------- */
  function renderList() {
    listEl.innerHTML = "";
    countEl.textContent = items.length + " 件";

    if (!items.length) {
      var empty = document.createElement("li");
      empty.className = "wb-empty";
      empty.textContent = "まだ単語がありません。上の欄に表と裏を入れて追加してください。";
      listEl.appendChild(empty);
      return;
    }

    items.forEach(function (it) {
      var li = document.createElement("li");
      li.className = "wb-item" + (it.learned ? " learned" : "");
      li.setAttribute("data-id", it.id);

      if (editingId === it.id) {
        var edit = document.createElement("div");
        edit.className = "wb-item-edit";
        edit.innerHTML =
          '<div class="wb-edit-row">' +
            '<input type="text" class="wb-edit-front" placeholder="表（単語）" value="">' +
            '<input type="text" class="wb-edit-back" placeholder="裏（意味）" value="">' +
          '</div>' +
          '<textarea class="wb-edit-detail" rows="3" placeholder="解説（詳しい説明。答えたあとに表示されます）"></textarea>';
        li.appendChild(edit);

        var ops = document.createElement("div");
        ops.className = "wb-item-ops";
        var saveOp = document.createElement("button");
        saveOp.className = "wb-op wb-op-save";
        saveOp.type = "button";
        saveOp.title = "保存";
        saveOp.textContent = "✓";
        var cancelOp = document.createElement("button");
        cancelOp.className = "wb-op";
        cancelOp.type = "button";
        cancelOp.title = "やめる";
        cancelOp.textContent = "×";
        ops.appendChild(saveOp);
        ops.appendChild(cancelOp);
        li.appendChild(ops);

        var fInput = edit.querySelector(".wb-edit-front");
        var bInput = edit.querySelector(".wb-edit-back");
        var dInput = edit.querySelector(".wb-edit-detail");
        fInput.value = it.front;
        bInput.value = it.back;
        if (dInput) dInput.value = it.detail || "";

        saveOp.addEventListener("click", function () {
          saveEdit(it.id, fInput.value, bInput.value, dInput ? dInput.value : "");
        });
        cancelOp.addEventListener("click", function () {
          editingId = null;
          renderList();
        });
        return;
      }

      var main = document.createElement("div");
      main.className = "wb-item-main";

      var front = document.createElement("div");
      front.className = "wb-item-front";
      front.textContent = it.front;
      var back = document.createElement("div");
      back.className = "wb-item-back";
      back.textContent = "→ " + it.back;
      main.appendChild(front);
      main.appendChild(back);

      if (it.detail) {
        var det = document.createElement("div");
        det.className = "wb-item-detail";
        det.textContent = "解説：" + it.detail;
        main.appendChild(det);
      }
      li.appendChild(main);

      var learn = document.createElement("button");
      learn.className = "wb-learn";
      learn.type = "button";
      learn.title = it.learned ? "覚えていないへ戻す" : "覚えたにする";
      learn.textContent = "✓";
      learn.addEventListener("click", function () {
        it.learned = !it.learned;
        save();
        renderList();
      });
      li.appendChild(learn);

      var ops2 = document.createElement("div");
      ops2.className = "wb-item-ops";
      var pencil = document.createElement("button");
      pencil.className = "wb-op";
      pencil.type = "button";
      pencil.title = "編集";
      pencil.textContent = "✎";
      pencil.addEventListener("click", function () {
        editingId = it.id;
        renderList();
        var first = listEl.querySelector('.wb-item-edit .wb-edit-front');
        if (first) first.focus();
      });
      var del = document.createElement("button");
      del.className = "wb-op wb-op-del";
      del.type = "button";
      del.title = "削除";
      del.textContent = "×";
      del.addEventListener("click", function () {
        items = items.filter(function (x) { return x.id !== it.id; });
        save();
        renderList();
      });
      ops2.appendChild(pencil);
      ops2.appendChild(del);
      li.appendChild(ops2);

      listEl.appendChild(li);
    });
  }

  function saveEdit(id, front, back, detail) {
    front = (front || "").trim();
    back = (back || "").trim();
    if (!front || !back) {
      showMsg("表と裏、両方書いてください。");
      return;
    }
    var target = items.filter(function (x) { return x.id === id; })[0];
    if (target) {
      target.front = front;
      target.back = back;
      target.detail = (detail || "").trim();
    }
    editingId = null;
    save();
    renderList();
  }

  function showMsg(text) {
    addMsg.textContent = text;
    addMsg.hidden = false;
  }

  function hideMsg() {
    addMsg.hidden = true;
    addMsg.textContent = "";
  }

  function addItem(front, back, detail) {
    front = (front || "").trim();
    back = (back || "").trim();
    if (!front || !back) {
      showMsg("表と裏、両方書いてください。");
      return false;
    }
    hideMsg();
    items.push({
      id: uid(),
      front: front,
      back: back,
      detail: (detail || "").trim(),
      learned: false
    });
    save();
    renderList();
    return true;
  }

  /* ---------- 復習モード（4択クイズ） ---------- */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function filtered() {
    var mode = studyFil ? studyFil.value : "all";
    if (mode === "未") return items.filter(function (x) { return !x.learned; });
    if (mode === "済") return items.filter(function (x) { return x.learned; });
    return items.slice();
  }

  function startStudy() {
    queue = shuffle(filtered());
    idx = 0;
    answered = false;
    correctCount = 0;
    renderQuiz();
  }

  /* 選択肢を作る：正解1つ＋他の単語の意味から3つ（足りなければその分だけ） */
  function buildOptions(correctItem) {
    var pool = items
      .filter(function (x) { return x.id !== correctItem.id && x.back !== correctItem.back; })
      .map(function (x) { return x.back; });
    shuffle(pool);
    var texts = [correctItem.back].concat(pool.slice(0, 3));
    shuffle(texts);
    return texts.map(function (text) {
      return { text: text, correct: text === correctItem.back };
    });
  }

  function renderQuiz() {
    if (!queue.length) {
      showQuizEmpty("対象の単語がありません。一覧から単語を追加してください。");
      return;
    }

    var it = queue[idx];
    quizEmpty.hidden = true;
    quizBody.hidden = false;

    quizWord.textContent = it.front;
    feedback.className = "wb-feedback";
    feedback.hidden = true;
    meaning.hidden = true;
    meaningTx.textContent = it.front + " ＝ " + it.back;
    detailEl.hidden = true;
    detailTx.textContent = "";
    detailEmpty.hidden = true;

    options = buildOptions(it);
    renderChoices();

    progBar.style.width = Math.round(idx / queue.length * 100) + "%";
    progLabel.textContent = idx + " / " + queue.length;
    /* 答えるまでは「覚えた」「次へ」は押せない */
    btnKnow.disabled = true;
    btnNext.disabled = true;
    btnPrev.disabled = idx <= 0;
  }

  function renderChoices() {
    choicesEl.innerHTML = "";
    var marks = ["A", "B", "C", "D"];

    options.forEach(function (opt, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "wb-choice";
      b.setAttribute("data-i", String(i));
      b.innerHTML =
        '<span class="wb-choice-mark"></span>' +
        '<span class="wb-choice-text"></span>';
      var mark = b.querySelector(".wb-choice-mark");
      var text = b.querySelector(".wb-choice-text");
      if (mark) mark.textContent = marks[i] || String(i + 1);
      if (text) text.textContent = opt.text;
      b.addEventListener("click", function () { answer(i); });
      choicesEl.appendChild(b);
    });

    var enough = options.length >= 4;
    noteEl.hidden = !!enough;
    if (!enough && options.length) {
      noteEl.textContent =
        "あと " + (4 - options.length) + " 件、単語を増やすと4つの選択肢で出題されます。";
    }
  }

  /* 選択肢を押したあと：正解・不正解と、登録してある意味を表示 */
  function answer(i) {
    if (answered || !options.length) return;
    var opt = options[i];
    var it = queue[idx];
    answered = true;

    var btns = choicesEl.querySelectorAll(".wb-choice");
    for (var k = 0; k < btns.length; k++) {
      btns[k].disabled = true;
      if (options[k].correct) btns[k].classList.add("correct");
      else if (k === i) btns[k].classList.add("wrong");
    }

    if (opt.correct) {
      correctCount++;
      feedback.className = "wb-feedback wb-ok";
      fbMark.textContent = "✓";
      fbText.textContent = "正解！";
    } else {
      feedback.className = "wb-feedback wb-ng";
      fbMark.textContent = "×";
      var right = options.filter(function (o) { return o.correct; })[0];
      fbText.textContent = "残念… 正解は「" + (right ? right.text : it.back) + "」";
    }
    feedback.hidden = false;

    /* あらかじめ追加しておいた「答え」と「詳しい解説」を見せる */
    meaningTx.textContent = it.front + " ＝ " + it.back;
    meaning.hidden = false;
    showDetail(it);

    lockButtons(true);
  }

  /* 答えたあとの解説表示。解説が空なら、どこで書けるか案内する */
  function showDetail(it) {
    var body = (it.detail || "").trim();
    if (body) {
      detailTx.textContent = body;
      detailTx.hidden = false;
      detailEmpty.hidden = true;
    } else {
      detailTx.textContent = "";
      detailTx.hidden = true;
      detailEmpty.textContent = "この単語には解説がまだありません。一覧の ✎ から書き加えてください。";
      detailEmpty.hidden = false;
    }
    detailEl.hidden = false;
  }

  /* 答えたあとは「覚えた」「次へ」が押せるようになる */
  function lockButtons(isAnswered) {
    btnKnow.disabled = !isAnswered;
    btnNext.disabled = !isAnswered;
    btnPrev.disabled = !isAnswered || idx <= 0;
  }

  function showQuizEmpty(msg) {
    quizEmpty.textContent = msg;
    quizEmpty.hidden = false;
    quizBody.hidden = true;
    choicesEl.innerHTML = "";
    noteEl.hidden = true;
    progBar.style.width = "0%";
    progLabel.textContent = "0 / 0";
    lockButtons(false);
  }

  function nextItem() {
    if (!queue.length) return;
    idx++;
    if (idx >= queue.length) {
      finishStudy();
      return;
    }
    answered = false;
    renderQuiz();
  }

  function prevItem() {
    if (!queue.length || idx <= 0) return;
    idx--;
    answered = false;
    renderQuiz();
  }

  function markLearned() {
    if (!queue.length) return;
    var it = queue[idx];
    var target = items.filter(function (x) { return x.id === it.id; })[0];
    if (target) {
      target.learned = true;
      save();
      renderList();
    }
    nextItem();
  }

  function finishStudy() {
    var seen = queue.length;
    var learned = queue.filter(function (it) {
      var t = items.filter(function (x) { return x.id === it.id; })[0];
      return t && t.learned;
    }).length;
    showQuizEmpty(
      "おしまい。" + seen + " 件出題しました（正解 " + correctCount + " 件 / 覚えた " + learned + " 件）。"
    );
    progBar.style.width = "100%";
    progLabel.textContent = seen + " / " + seen;
    btnKnow.disabled = true;
    btnNext.disabled = true;
    btnPrev.disabled = true;
  }


  /* ---------- ビュー切り替え ---------- */
  function setView(name) {
    try { localStorage.setItem(VIEW_KEY, name); } catch (e) { /* noop */ }

    tabList.classList.toggle("exp-on", name === "list");
    tabStudy.classList.toggle("exp-on", name === "study");
    tabWip.classList.toggle("exp-on", name === "wip");

    viewList.hidden = name !== "list";
    viewStudy.hidden = name !== "study";
    viewWip.hidden = name !== "wip";

    /* 復習を開くたびに、今の単語でシャッフルし直す */
    if (name === "study") startStudy();
  }

  /* ---------- イベント ---------- */
  function clearAddForm() {
    inFront.value = "";
    inBack.value = "";
    if (inDetail) inDetail.value = "";
    inFront.focus();
  }

  addBtn.addEventListener("click", function () {
    if (addItem(inFront.value, inBack.value, inDetail ? inDetail.value : "")) {
      clearAddForm();
    }
  });
  inBack.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      if (addItem(inFront.value, inBack.value, inDetail ? inDetail.value : "")) {
        clearAddForm();
      }
    }
  });
  if (inDetail) {
    inDetail.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        if (addItem(inFront.value, inBack.value, inDetail.value)) clearAddForm();
      }
    });
  }
  inFront.addEventListener("keydown", function (e) {
    if (e.key === "Enter") inBack.focus();
  });

  tabList.addEventListener("click", function () { setView("list"); });
  tabStudy.addEventListener("click", function () { setView("study"); });
  tabWip.addEventListener("click", function () { setView("wip"); });

  var toList = $("wb-to-list");
  if (toList) toList.addEventListener("click", function () { setView("list"); });

  btnNext.addEventListener("click", function () { nextItem(); });
  btnPrev.addEventListener("click", function () { prevItem(); });
  btnKnow.addEventListener("click", function () { markLearned(); });
  btnRestart.addEventListener("click", function () { startStudy(); });
  if (studyFil) studyFil.addEventListener("change", function () { startStudy(); });

  var exportBtn = $("wb-export");
  if (exportBtn) {
    exportBtn.addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "wordbook.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  var importBtn = $("wb-import");
  var fileInput = $("wb-file");
  if (importBtn && fileInput) {
    importBtn.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(String(reader.result));
          if (!Array.isArray(data)) data = [data];
          var add = data.filter(validItem).map(function (o) {
            return {
              id: uid(),
              front: o.front,
              back: o.back,
              detail: typeof o.detail === "string" ? o.detail : "",
              learned: !!o.learned
            };
          });
          items = items.concat(add);
          save();
          renderList();
        } catch (err) {
          showMsg("読めませんでした。JSONファイルを確認してください。");
        }
      };
      reader.readAsText(f);
      fileInput.value = "";
    });
  }

  var clearBtn = $("wb-clear-all");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (!items.length) return;
      if (!window.confirm("単語をすべて削除します。よろしいですか？")) return;
      items = [];
      save();
      renderList();
    });
  }

  /* ---------- 起動 ---------- */
  items = load();
  editingId = null;
  renderList();

  var savedView = "list";
  try { savedView = localStorage.getItem(VIEW_KEY) || "list"; } catch (e) { /* noop */ }
  if (["list", "study", "wip"].indexOf(savedView) < 0) savedView = "list";
  setView(savedView);

  /* テスト用フック（開発中はここから叩ける） */
  if (typeof globalThis !== "undefined") {
    globalThis.__wb = {
      items: function () { return items; },
      add: addItem,
      render: renderList,
      setView: setView,
      start: startStudy,
      answer: answer,
      options: function () { return options; },
      next: nextItem,
      prev: prevItem,
      queue: function () { return queue; },
      idx: function () { return idx; },
      correctCount: function () { return correctCount; }
    };
  }
})();
