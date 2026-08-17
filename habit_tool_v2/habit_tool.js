// ===== HabitTool v2（詳細フォルダ版） =====
// 元の habit_tool.js の書き方（getElementById / addEventListener / createElement /
// localStorage）を踏襲。追加：詳細ボタン、連続継続日数、合計継続日数、達成時のインライン入力フォーム。

const habitName = document.getElementById("habitName");
const habitGoal = document.getElementById("habitGoal");
const habitType = document.getElementById("habitType");
const unitArea  = document.getElementById("unitArea");
const habitUnit = document.getElementById("habitUnit");
const addHabit  = document.getElementById("addHabit");
const saveHabit = document.getElementById("saveHabit");
const closeModal = document.getElementById("closeModal");
const habitModal = document.getElementById("habitModal");
const habitList  = document.getElementById("habitList");

const detailModal = document.getElementById("detailModal");
const detailBody  = document.getElementById("detailBody");
const closeDetail = document.getElementById("closeDetail");

// 統合時に元データと混ざらないよう別キーで保存
let habits =
JSON.parse(
    localStorage.getItem("habits_v2")
) || [];


/* ---------- 日付ヘルパ ---------- */
function todayStr(){
    return new Date().toISOString().slice(0, 10);
}
function prevDay(str){
    const d = new Date(str + "T00:00:00");
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}
function daysBetween(a, b){
    const da = new Date(a + "T00:00:00");
    const db = new Date(b + "T00:00:00");
    return Math.round((db - da) / 86400000);
}


/* ---------- 連続継続日数（日を空けるとリセット） ---------- */
function computeStreak(records){
    if(!records || !records.length) return null;
    const dates = [...new Set(records.map(r => r.date))].sort();
    const last = dates[dates.length - 1];
    if(daysBetween(last, todayStr()) > 1) return 0; // 昨日より前なら切れている
    let streak = 0;
    let expected = last;
    let i = dates.length - 1;
    while(i >= 0 && dates[i] === expected){
        streak++;
        expected = prevDay(expected);
        i--;
    }
    return streak;
}


/* ---------- 合計継続日数（記録のあった日数の総計・リセットなし） ---------- */
function computeTotalDays(records){
    if(!records || !records.length) return 0;
    return new Set(records.map(r => r.date)).size;
}


/* ---------- 単位エリアの表示切替（元のまま） ---------- */
function updateUnitArea(){
    if(habitType.value === "check"){
        unitArea.style.display = "none";
        habitUnit.value = "";
    }
    else if(habitType.value === "count"){
        unitArea.style.display = "block";
        if(habitUnit.value === ""){
            habitUnit.value = "回";
        }
    }
    else if(habitType.value === "time"){
        unitArea.style.display = "block";
        if(habitUnit.value === ""){
            habitUnit.value = "分";
        }
    }
}
habitType.addEventListener("change", updateUnitArea);
updateUnitArea();


/* ---------- 新規習慣の保存 ---------- */
saveHabit.addEventListener(
    "click",
    function(){
        if(habitName.value.trim() === ""){
            alert("習慣名を入力してください。");
            return;
        }
        if(habitType.value !== "check" && habitUnit.value.trim() === ""){
            alert("単位を入力してください。");
            return;
        }
        const habit = {
            name: habitName.value,
            goal: habitGoal.value,
            type: habitType.value,
            unit: habitUnit.value,
            streak: 0,
            totalDays: 0,
            counter: 0,
            todaycounter: 0,
            records: [],
            completed: false,
            lastCompletedDate: ""
        };
        habits.push(habit);
        save();

        habitName.value = "";
        habitGoal.value = "";
        habitUnit.value = "";
        habitType.value = "check";
        updateUnitArea();

        habitModal.style.display = "none";
        displayHabits();
    }
);


addHabit.addEventListener(
    "click",
    function(){
        habitModal.style.display = "flex";
    }
);

closeModal.addEventListener(
    "click",
    function(){
        habitModal.style.display = "none";
    }
);


/* ---------- 達成の記録 ---------- */
function recordHabit(habit, value){
    const today = todayStr();
    habit.records.push({ date: today, value: value });
    habit.counter += value;
    if(habit.lastCompletedDate !== today){
        habit.todaycounter = 0;
    }
    habit.todaycounter += value;
    habit.completed = true;
    habit.lastCompletedDate = today;
    habit.streak = computeStreak(habit.records) || 0;
    habit.totalDays = computeTotalDays(habit.records);
    save();
    displayHabits();
}


/* ---------- 詳細モーダル ---------- */
function openDetail(habit){
    const typeLabel = {
        check: "達成・未達成",
        count: "回数",
        time:  "時間"
    }[habit.type];
    const streak = (habit.records && habit.records.length)
        ? (computeStreak(habit.records) || 0)
        : (habit.streak || 0);
    const total = (habit.records && habit.records.length)
        ? computeTotalDays(habit.records)
        : (habit.totalDays || 0);

    let html = "<h2>" + esc(habit.name) + "</h2>";
    html += row("目標", habit.goal || "（なし）");
    html += row("記録方法", typeLabel);
    html += row("単位", habit.unit || "—");
    html += row("連続継続日数", streak + " 日");
    html += row("合計継続日数", total + " 日");
    html += row("累計", habit.counter + (habit.unit || ""));
    html += row("今日の記録", habit.todaycounter + (habit.unit || ""));
    html += row("最終達成日", habit.lastCompletedDate || "（まだ）");

    html += "<p class='detail-sub'>最近の記録</p><ul class='detail-list'>";
    if(habit.records && habit.records.length){
        const recent = habit.records.slice(-7).reverse();
        recent.forEach(function(r){
            html += "<li>" + r.date + " ・ " + r.value + (habit.unit || "") + "</li>";
        });
    }
    else{
        html += "<li>まだ記録がありません</li>";
    }
    html += "</ul>";

    detailBody.innerHTML = html;
    detailModal.style.display = "flex";
}
function row(k, v){
    return "<div class='detail-row'><span class='k'>" + k +
           "</span><span>" + esc(String(v)) + "</span></div>";
}
function esc(s){
    return s.replace(/[&<>"']/g, function(c){
        return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
}
closeDetail.addEventListener(
    "click",
    function(){
        detailModal.style.display = "none";
    }
);


/* ---------- カード描画（UI を少しデザイン） ---------- */
function displayHabits(){
    habitList.innerHTML = "";

    habits.forEach(function(habit, index){
        const card = document.createElement("div");
        card.classList.add("habit-card");

        // ヘッダー：タイトル + ステータスバッジ
        const head = document.createElement("div");
        head.className = "hk-head";

        const title = document.createElement("h2");
        title.textContent = habit.name;

        const badge = document.createElement("span");
        badge.className = "hk-badge " + (habit.completed ? "done" : "todo");
        badge.textContent = habit.completed ? "達成済み" : "未達成";

        head.appendChild(title);
        head.appendChild(badge);

        // インラインフォーム（達成ボタン押下で「上に」表示）
        const form = document.createElement("div");
        form.className = "record-form";
        form.hidden = true;

        const formLabel = document.createElement("label");
        formLabel.textContent = (habit.type === "check")
            ? "達成として記録します"
            : ("今回の記録（" + (habit.unit || "") + "）");

        const formInput = document.createElement("input");
        formInput.type = "number";
        formInput.min = "0";
        formInput.placeholder = "数値を入力";
        if(habit.type === "check"){
            formInput.style.display = "none";
            formInput.value = "1";
        }

        const okBtn = document.createElement("button");
        okBtn.textContent = "決定";
        okBtn.className = "mini-btn rf-ok";

        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = "キャンセル";
        cancelBtn.className = "mini-btn rf-cancel";

        const actions = document.createElement("div");
        actions.className = "rf-actions";
        actions.appendChild(okBtn);
        actions.appendChild(cancelBtn);

        form.appendChild(formLabel);
        if(habit.type !== "check") form.appendChild(formInput);
        form.appendChild(actions);

        // 3つの統計：連続 / 合計 / 累計
        const streakVal = (habit.records && habit.records.length)
            ? (computeStreak(habit.records) || 0)
            : (habit.streak || 0);
        const totalVal = (habit.records && habit.records.length)
            ? computeTotalDays(habit.records)
            : (habit.totalDays || 0);

        const stats = document.createElement("div");
        stats.className = "hk-stats";

        stats.appendChild(makeStat(streakVal, "連続日数"));
        stats.appendChild(makeStat(totalVal, "合計日数"));
        stats.appendChild(makeStat(habit.counter + (habit.unit || ""), "累計"));

        // アクションボタン
        const recordBtn = document.createElement("button");
        recordBtn.textContent = "記録する";
        recordBtn.className = "btn-record";

        const detailBtn = document.createElement("button");
        detailBtn.textContent = "詳細";
        detailBtn.className = "btn-detail";

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "削除";
        deleteBtn.className = "btn-delete";

        const act = document.createElement("div");
        act.className = "hk-actions";
        act.appendChild(recordBtn);
        act.appendChild(detailBtn);
        act.appendChild(deleteBtn);

        // 記録ボタン：フォームを上に表示
        recordBtn.addEventListener(
            "click",
            function(){
                form.hidden = !form.hidden;
                if(!form.hidden && habit.type !== "check"){
                    formInput.focus();
                }
            }
        );

        okBtn.addEventListener(
            "click",
            function(){
                let v = (habit.type === "check") ? 1 : Number(formInput.value);
                if(habit.type !== "check" &&
                   (!formInput.value || isNaN(v) || v < 0)){
                    alert("数値を入力してください。");
                    return;
                }
                recordHabit(habit, v);
            }
        );

        cancelBtn.addEventListener(
            "click",
            function(){
                form.hidden = true;
            }
        );

        detailBtn.addEventListener(
            "click",
            function(){
                openDetail(habit);
            }
        );

        deleteBtn.addEventListener(
            "click",
            function(){
                if(confirm("「" + habit.name + "」を削除しますか？")){
                    habits.splice(index, 1);
                    save();
                    displayHabits();
                }
            }
        );

        // 配置順：ヘッダー → フォーム(上) → 統計 → ボタン
        card.appendChild(head);
        card.appendChild(form);
        card.appendChild(stats);
        card.appendChild(act);

        habitList.appendChild(card);
    });
}

function makeStat(num, cap){
    const box = document.createElement("div");
    box.className = "hk-stat";
    const n = document.createElement("div");
    n.className = "hk-num";
    n.textContent = num;
    const c = document.createElement("div");
    c.className = "hk-cap";
    c.textContent = cap;
    box.appendChild(n);
    box.appendChild(c);
    return box;
}


/* ---------- 日跨ぎリセット ---------- */
function checkDate(){
    const today = todayStr();
    habits.forEach(function(habit){
        if(habit.lastCompletedDate !== today){
            habit.completed = false;
            habit.todaycounter = 0;
        }
        if(habit.records && habit.records.length){
            habit.streak = computeStreak(habit.records) || 0;
            habit.totalDays = computeTotalDays(habit.records);
        }
    });
    save();
}

function save(){
    localStorage.setItem(
        "habits_v2",
        JSON.stringify(habits)
    );
}


checkDate();
displayHabits();
