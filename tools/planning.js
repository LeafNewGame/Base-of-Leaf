/* =========================================================
   計画整理ツール：簡易リスト（モード2）
   チャート本体は planning_chart.js が担当する
   ========================================================= */

(function () {
  "use strict";

  var KEY = "planner_list_v1";

  var input    = document.getElementById("pt-task-input");
  var addBtn   = document.getElementById("pt-task-add");
  var listEl   = document.getElementById("pt-task-list");
  var countEl  = document.getElementById("pt-task-count");
  var clearBtn = document.getElementById("pt-task-clear-done");

  // リスト用の DOM が無いページ（例：旧 planning_chart.html）では何もしない
  if (!input || !addBtn || !listEl) return;

  var tasks = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return arr.filter(function (t) {
            return t && typeof t.text === "string";
          }).map(function (t) {
            return { id: t.id || uid(), text: t.text, done: !!t.done };
          });
        }
      }
    } catch (e) {
      console.warn("リスト読込失敗", e);
    }
    return [];
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(tasks));
    } catch (e) {
      console.warn("リスト保存失敗", e);
    }
  }

  function uid() {
    return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function addTask(text) {
    text = (text || "").trim();
    if (!text) return;
    tasks.push({ id: uid(), text: text, done: false });
    save();
    render();
    input.value = "";
    input.focus();
  }

  function toggleTask(id) {
    tasks.forEach(function (t) {
      if (t.id === id) t.done = !t.done;
    });
    save();
    render();
  }

  function removeTask(id) {
    tasks = tasks.filter(function (t) { return t.id !== id; });
    save();
    render();
  }

  function clearDone() {
    var before = tasks.length;
    tasks = tasks.filter(function (t) { return !t.done; });
    if (tasks.length === before) return;
    save();
    render();
  }

  function render() {
    listEl.innerHTML = "";

    if (!tasks.length) {
      var empty = document.createElement("li");
      empty.className = "pt-task-empty";
      empty.textContent = "まだ計画がありません。上から追加してください。";
      listEl.appendChild(empty);
    } else {
      tasks.forEach(function (t) {
        var li = document.createElement("li");
        li.className = "pt-task" + (t.done ? " done" : "");

        var chk = document.createElement("button");
        chk.type = "button";
        chk.className = "pt-task-check";
        chk.textContent = "✓";
        chk.title = t.done ? "未完了に戻す" : "完了にする";
        chk.addEventListener("click", function () { toggleTask(t.id); });

        var txt = document.createElement("div");
        txt.className = "pt-task-text";
        txt.contentEditable = "true";
        txt.textContent = t.text;
        txt.addEventListener("blur", function () {
          var v = txt.textContent.trim();
          if (!v) { render(); return; }   // 空になったら元に戻す
          t.text = v;
          save();
        });
        txt.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") { ev.preventDefault(); txt.blur(); }
        });

        var del = document.createElement("button");
        del.type = "button";
        del.className = "pt-task-del";
        del.textContent = "×";
        del.title = "削除";
        del.addEventListener("click", function () { removeTask(t.id); });

        li.appendChild(chk);
        li.appendChild(txt);
        li.appendChild(del);
        listEl.appendChild(li);
      });
    }

    if (countEl) {
      var remain = tasks.filter(function (t) { return !t.done; }).length;
      countEl.textContent = "残り " + remain + " 件 / 全 " + tasks.length + " 件";
    }
  }

  addBtn.addEventListener("click", function () { addTask(input.value); });
  input.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") { ev.preventDefault(); addTask(input.value); }
  });
  if (clearBtn) clearBtn.addEventListener("click", clearDone);

  render();
})();
