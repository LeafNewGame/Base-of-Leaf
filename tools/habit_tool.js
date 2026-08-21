// ===== HabitTool（習慣化ツール・統合版） =====
// 元の habit_tool.js の書き方（getElementById / addEventListener / createElement /
// localStorage）を踏襲。
// 追加：詳細ボタン、連続継続日数、合計継続日数、達成時のインライン入力フォーム。
//
// 統合时注意：保存キーは元と同じ "habits" を使用。
// 古い形式（records なし・totalDays なし）のデータも正規化して読み込むので、
// 既存の localStorage データは失われません。

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

// 保存キーは元ファイルと同じ "habits"
let habits =
JSON.parse(
    localStorage.getItem("habits")
) || [];

if(!Array.isArray(habits)){
    habits = [];
}

// 旧形式データを新形式に正規化（records がない等）
function normalizeHabit(h){
    if(!h || typeof h !== "object") return;
    if(!Array.isArray(h.records)) h.records = [];
    h.name = (typeof h.name === "string") ? h.name : "";
    h.goal  = (h.goal != null) ? h.goal : "";
    h.type  = h.type || "check";
    h.unit  = (typeof h.unit === "string") ? h.unit : "";
    h.streak = (typeof h.streak === "number") ? h.streak : 0;
    // 旧データは totalDays がないため、streak をそのまま引き継ぐ
    h.totalDays = (typeof h.totalDays === "number") ? h.totalDays : h.streak;
    h.counter = (typeof h.counter === "number") ? h.counter : 0;
    h.todaycounter = (typeof h.todaycounter === "number") ? h.todaycounter : 0;
    h.completed = !!h.completed;
    h.lastCompletedDate = h.lastCompletedDate || "";
    if(!Array.isArray(h.awardedTitles)) h.awardedTitles = [];
    h.emergencyEdits = (typeof h.emergencyEdits === "number") ? h.emergencyEdits : 0;
    h.emergencyEdited = !!h.emergencyEdited;
    h.freezeCount = (typeof h.freezeCount === "number") ? h.freezeCount : 0;
    h.freezeGranted = (typeof h.freezeGranted === "number") ? h.freezeGranted : 0;
    if(!Array.isArray(h.freezeBridges)) h.freezeBridges = [];
}
habits.forEach(normalizeHabit);

// 旧 v2 テストデータ（habits_v2）の引き継ぎ：
// 本番の habits が空の場合のみ、重複を避けるために一度だけ使う。
if(habits.length === 0){
    const v2 = JSON.parse(localStorage.getItem("habits_v2")) || [];
    if(Array.isArray(v2) && v2.length){
        v2.forEach(normalizeHabit);
        habits = v2;
    }
}


/* ---------- 日付ヘルパ ---------- */
// ローカル日付を YYYY-MM-DD で整形（toISOString はUTCのため日本などで1日ずれるのを防ぐ）
function fmtLocal(d){
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
}
function todayStr(){
    return fmtLocal(new Date());
}
function prevDay(str){
    const d = new Date(str + "T00:00:00");
    d.setDate(d.getDate() - 1);
    return fmtLocal(d);
}
function daysBetween(a, b){
    const da = new Date(a + "T00:00:00");
    const db = new Date(b + "T00:00:00");
    return Math.round((db - da) / 86400000);
}


/* ---------- 連続継続日数（日を空けるとリセット。フリーズで補完した日も数える） ---------- */
function computeStreak(records, bridges){
    if(!records || !records.length) return null;
    const set = new Set(records.map(r => r.date));
    if(bridges && bridges.length){
        bridges.forEach(function(d){ if(d) set.add(d); });
    }
    const dates = [...set].sort();
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
            lastCompletedDate: "",
            awardedTitles: [],
            emergencyEdits: 0,
            emergencyEdited: false,
            freezeCount: 0,
            freezeGranted: 0,
            freezeBridges: []
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
    const oldLast = habit.lastCompletedDate;
    let usedFreeze = 0;
    // ストリークフリーズ：最後に記録した日から今日までに空いた日数を帳消しにする（1日＝1回）
    if(oldLast && oldLast !== today){
        const gap = daysBetween(oldLast, today);
        if(gap > 1){
            const skipped = gap - 1;
            const usable = Math.min(habit.freezeCount || 0, skipped);
            if(usable > 0){
                for(let k = 1; k <= usable; k++){
                    const d = new Date(today + "T00:00:00");
                    d.setDate(d.getDate() - k);
                    habit.freezeBridges.push(fmtLocal(d));
                }
                habit.freezeCount -= usable;
                usedFreeze = usable;
            }
        }
    }
    habit.records.push({ date: today, value: value });
    habit.counter += value;
    if(habit.lastCompletedDate !== today){
        habit.todaycounter = 0;
    }
    habit.todaycounter += value;
    habit.completed = true;
    habit.lastCompletedDate = today;
    habit.emergencyEdited = false; // 新たに実記録が入ったので通常計算に戻す
    habit.streak = computeStreak(habit.records, habit.freezeBridges) || 0;
    habit.totalDays = computeTotalDays(habit.records);
    const gained = awardTitles(habit);
    const gainedFreeze = grantFreezes(habit);
    save();
    displayHabits();
    if(usedFreeze > 0){
        alert("❄️ ストリークフリーズを " + usedFreeze + " 回使用して、空いた日数を帳消しにしました（残り " + (habit.freezeCount || 0) + " 回）。");
    }
    if(gainedFreeze > 0){
        alert("❄️ ストリークフリーズを " + gainedFreeze + " 回獲得しました！（残り " + (habit.freezeCount || 0) + " 回）");
    }
    if(gained.length){
        const t = gained[0];
        alert("🎉 おめでとうございます！\n「" + habit.name + "」が " + habit.streak + " 日連続達成！\n称号「" + t.emoji + " " + t.name + "」を獲得しました！");
    }
}


/* ---------- 詳細モーダル ---------- */
function openDetail(habit){
    const typeLabel = {
        check: "達成・未達成",
        count: "回数",
        time:  "時間"
    }[habit.type];
    const streak = habitStreak(habit);
    const total = habitTotal(habit);

    let html = "<h2>" + esc(habit.name) + "</h2>";
    html += row("目標", habit.goal || "（なし）");
    html += row("記録方法", typeLabel);
    html += row("単位", habit.unit || "—");
    html += row("連続継続日数", streak + " 日");
    html += row("合計継続日数", total + " 日");
    html += row("累計", habit.counter + (habit.unit || ""));
    html += row("今日の記録", habit.todaycounter + (habit.unit || ""));
    html += row("最終達成日", habit.lastCompletedDate || "（まだ）");
    const ttl = getHabitTitle(streak);
    const nxt = getNextTitle(streak);
    html += row("称号", ttl ? (ttl.emoji + " " + ttl.name) : "（まだ）");
    html += row("次の称号", nxt ? (nxt.emoji + " " + nxt.name + " まであと " + (nxt.days - streak) + " 日") : "最高位の称号を獲得！");
    html += row("ストリークフリーズ", (habit.freezeCount || 0) + " 回（使用済み " + ((habit.freezeBridges || []).length) + " 日分）");
    html += row("非常時編集", (habit.emergencyEdits || 0) + " 回");

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
    if(habit.freezeBridges && habit.freezeBridges.length){
        const fb = habit.freezeBridges.slice().sort().reverse().slice(0, 3);
        fb.forEach(function(d){
            html += "<li>" + d + " ・ ❄️ フリーズで補完</li>";
        });
        if(habit.freezeBridges.length > 3){
            html += "<li>ほか " + (habit.freezeBridges.length - 3) + " 日分</li>";
        }
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


/* ===== 称号・バッジ（連続日数でランクアップ） ===== */
const HABIT_TITLES = [
    { days: 3,   name: "芽生え",      emoji: "🌱" },
    { days: 7,   name: "若葉",        emoji: "🌿" },
    { days: 14,  name: "成長期",      emoji: "🪴" },
    { days: 21,  name: "習慣の兆し",  emoji: "🌾" },
    { days: 30,  name: "習慣化達成",  emoji: "🏅" },
    { days: 60,  name: "継続の達人",  emoji: "🥈" },
    { days: 100, name: "レジェンド",  emoji: "🏆" },
    { days: 365, name: "伝説の習慣王", emoji: "👑" }
];

// 現在の称号（連続日数で到達している最上位）を返す
function getHabitTitle(streak){
    let hit = null;
    HABIT_TITLES.forEach(function(t){
        if(streak >= t.days) hit = t;
    });
    return hit;
}
// 次の称号を返す（なければ null）
function getNextTitle(streak){
    for(let i = 0; i < HABIT_TITLES.length; i++){
        if(streak < HABIT_TITLES[i].days) return HABIT_TITLES[i];
    }
    return null;
}
// 新しく獲得した称号を記録して返す（お祝い用）
function awardTitles(habit){
    const gained = [];
    const t = getHabitTitle(habit.streak || 0);
    if(t && habit.awardedTitles && habit.awardedTitles.indexOf(t.name) < 0){
        habit.awardedTitles.push(t.name);
        gained.push(t);
    }
    return gained;
}


/* ===== バックアップ・復元・非常時入力 ===== */
const backupModal = document.getElementById("backupModal");
const closeBackup = document.getElementById("closeBackup");

function backupData(){
    return {
        app: "HabitTool",
        version: 2,
        exportedAt: todayStr(),
        habits: habits
    };
}

function switchBkTab(name){
    document.querySelectorAll(".bk-tab").forEach(function(b){
        b.classList.remove("active");
    });
    document.getElementById("bk-tab-" + name).classList.add("active");
    document.getElementById("bk-export").hidden = (name !== "export");
    document.getElementById("bk-restore").hidden = (name !== "restore");
    document.getElementById("bk-manual").hidden = (name !== "manual");
}
document.getElementById("bk-tab-export").addEventListener("click", function(){ switchBkTab("export"); });
document.getElementById("bk-tab-restore").addEventListener("click", function(){ switchBkTab("restore"); });
document.getElementById("bk-tab-manual").addEventListener("click", function(){ switchBkTab("manual"); });

document.getElementById("btn-open-backup").addEventListener("click", function(){
    // 書き出しテキストを最新化
    document.getElementById("bk-export-text").value = JSON.stringify(backupData(), null, 2);
    // 手動入力の習慣リストと日付を初期化
    const sel = document.getElementById("bk-manual-habit");
    sel.innerHTML = "";
    habits.forEach(function(h, i){
        const o = document.createElement("option");
        o.value = String(i);
        o.textContent = h.name;
        sel.appendChild(o);
    });
    document.getElementById("bk-manual-date").value = todayStr();
    document.getElementById("bk-manual-value").value = "1";
    document.getElementById("bk-manual-msg").textContent = "";
    document.getElementById("emg-total").textContent = emergencyTotal();
    switchBkTab("export");
    backupModal.style.display = "flex";
});

closeBackup.addEventListener("click", function(){
    backupModal.style.display = "none";
});

// 非常時タブから全データ編集を開く（カード上の編集ボタンは廃止し、ここに統合）
document.getElementById("btn-open-edit").addEventListener("click", function(){
    const idx = Number(document.getElementById("bk-manual-habit").value);
    const h = habits[idx];
    if(!h){
        alert("習慣を選んでください。");
        return;
    }
    openEditModal(idx);
});

// 書き出し：ファイル保存
document.getElementById("btn-export-file").addEventListener("click", function(){
    const blob = new Blob([JSON.stringify(backupData(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "habit-backup-" + todayStr() + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){
        URL.revokeObjectURL(a.href);
        a.remove();
    }, 500);
    alert("バックアップファイルを保存しました。");
});

// 書き出し：コピー（スマホでもメモアプリに貼り付けられる）
document.getElementById("btn-export-copy").addEventListener("click", function(){
    const text = document.getElementById("bk-export-text").value;
    function done(){
        alert("コピーしました。メモアプリなどに保存しておいてください。");
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done, function(){
            const ta = document.getElementById("bk-export-text");
            ta.select();
            ta.setSelectionRange(0, ta.value.length);
            document.execCommand("copy");
            done();
        });
    }
    else{
        const ta = document.getElementById("bk-export-text");
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        document.execCommand("copy");
        done();
    }
});

// 復元（共通処理）
function restoreFromText(text){
    let data;
    try{
        data = JSON.parse(text);
    }
    catch(e){
        alert("読み込みに失敗しました。バックアップのテキストをそのまま貼り付けてください。");
        return;
    }
    let arr = Array.isArray(data)
        ? data
        : (data && Array.isArray(data.habits) ? data.habits : null);
    if(!arr){
        alert("バックアップの形式ではありません（習慣データが見つかりません）。");
        return;
    }
    if(!confirm("現在のデータをバックアップの内容に置き換えます。よろしいですか？")) return;
    arr.forEach(normalizeHabit);
    habits = arr.filter(function(h){ return h && h.name; });
    save();
    displayHabits();
    alert("復元しました（" + habits.length + " 件の習慣）。");
}

// 復元：ファイルから読み込み
document.getElementById("btn-import-file").addEventListener("click", function(){
    const f = document.getElementById("bk-file").files[0];
    if(!f){
        alert("ファイルを選択してください。");
        return;
    }
    const reader = new FileReader();
    reader.onload = function(){
        restoreFromText(String(reader.result));
    };
    reader.readAsText(f);
});

// 復元：貼り付けたテキストから
document.getElementById("btn-import-paste").addEventListener("click", function(){
    const t = document.getElementById("bk-restore-text").value.trim();
    if(!t){
        alert("テキストを貼り付けてください。");
        return;
    }
    restoreFromText(t);
});

// 非常時・手動入力：記録を1件追加
document.getElementById("btn-manual-add").addEventListener("click", function(){
    const idx = Number(document.getElementById("bk-manual-habit").value);
    const date = document.getElementById("bk-manual-date").value;
    const raw = document.getElementById("bk-manual-value").value;
    let v = Number(raw);
    const h = habits[idx];
    if(!h){
        alert("習慣を選んでください。");
        return;
    }
    if(!date){
        alert("日付を入力してください。");
        return;
    }
    if(h.type === "check"){
        v = 1;
    }
    else if(isNaN(v) || v < 0){
        alert("値を入力してください。");
        return;
    }
    h.records.push({ date: date, value: v });
    h.counter = (h.counter || 0) + v;
    h.totalDays = computeTotalDays(h.records);
    h.streak = computeStreak(h.records, h.freezeBridges) || 0;
    h.emergencyEdited = false;
    const today = todayStr();
    if(date === today){
        h.todaycounter = (h.todaycounter || 0) + v;
        h.completed = true;
    }
    if(!h.lastCompletedDate || date > h.lastCompletedDate){
        h.lastCompletedDate = date;
    }
    awardTitles(h);
    grantFreezes(h);
    h.emergencyEdits = (h.emergencyEdits || 0) + 1;
    const emgTotal = bumpEmergencyCount();
    save();
    displayHabits();
    document.getElementById("bk-manual-msg").textContent =
        "✓ " + date + " に「" + h.name + "」を " + v + (h.unit || "") + " 追加しました。（非常時編集 累計 " + emgTotal + " 回）";
});


/* ===== 表示ヘルパ（非常時編集で直接指定した値は保存値を優先） ===== */
function habitStreak(h){
    if(h.emergencyEdited) return h.streak || 0;
    return (h.records && h.records.length)
        ? (computeStreak(h.records, h.freezeBridges) || 0)
        : (h.streak || 0);
}
function habitTotal(h){
    if(h.emergencyEdited) return h.totalDays || 0;
    return (h.records && h.records.length)
        ? computeTotalDays(h.records)
        : (h.totalDays || 0);
}

/* ===== ストリークフリーズの付与（連続7日ごとに +1 回: 7・14・21・28…） ===== */
function grantFreezes(h){
    if(!h) return 0;
    h.freezeCount = (typeof h.freezeCount === "number") ? h.freezeCount : 0;
    h.freezeGranted = (typeof h.freezeGranted === "number") ? h.freezeGranted : 0;
    const tier = Math.floor((h.streak || 0) / 7);
    if(tier > h.freezeGranted){
        const gain = tier - h.freezeGranted;
        h.freezeCount += gain;
        h.freezeGranted = tier;
        return gain;
    }
    return 0;
}

/* ===== 非常時編集の累計カウント（全体の記録を保存） ===== */
const META_KEY = "habit_meta";
function getMeta(){
    try{ return JSON.parse(localStorage.getItem(META_KEY)) || {}; }
    catch(e){ return {}; }
}
function saveMeta(m){ localStorage.setItem(META_KEY, JSON.stringify(m)); }
function bumpEmergencyCount(){
    const m = getMeta();
    m.emergencyTotal = (m.emergencyTotal || 0) + 1;
    m.lastEditAt = todayStr();
    saveMeta(m);
    return m.emergencyTotal;
}
function emergencyTotal(){
    const m = getMeta();
    return m.emergencyTotal || 0;
}


/* ===== 非常時編集モーダル（すべてのデータを編集可能） ===== */
const editModal = document.getElementById("editModal");
const editBody  = document.getElementById("editBody");
const closeEdit = document.getElementById("closeEdit");
let editState = null; // { h, recs, bridges }

function openEditModal(index){
    const h = habits[index];
    if(!h) return;
    editState = {
        h: h,
        recs: (h.records || []).map(function(r){ return { date: r.date, value: r.value }; }),
        bridges: (h.freezeBridges || []).slice()
    };
    let html = "";
    html += "<label>習慣名</label><input id='ee-name' value='" + esc(h.name) + "'>";
    html += "<label>目標</label><input id='ee-goal' value='" + esc(h.goal || "") + "'>";
    html += "<label>記録方法</label><select id='ee-type'>" +
        "<option value='check'" + (h.type === "check" ? " selected" : "") + ">達成・未達成</option>" +
        "<option value='count'" + (h.type === "count" ? " selected" : "") + ">回数</option>" +
        "<option value='time'" + (h.type === "time" ? " selected" : "") + ">時間</option>" +
        "</select>";
    html += "<label>単位</label><input id='ee-unit' value='" + esc(h.unit || "") + "' placeholder='例：回、分、ページ'>";
    html += "<div class='ee-grid'>";
    html += "<div><label>連続日数</label><input id='ee-streak' type='number' min='0' value='" + (h.streak || 0) + "'></div>";
    html += "<div><label>合計日数</label><input id='ee-total' type='number' min='0' value='" + (h.totalDays || 0) + "'></div>";
    html += "<div><label>累計</label><input id='ee-counter' type='number' min='0' step='any' value='" + (h.counter || 0) + "'></div>";
    html += "<div><label>今日の記録</label><input id='ee-today' type='number' min='0' step='any' value='" + (h.todaycounter || 0) + "'></div>";
    html += "<div><label>最終達成日</label><input id='ee-last' type='date' value='" + (h.lastCompletedDate || "") + "'></div>";
    html += "<div><label>達成状態</label><input id='ee-completed' type='checkbox'" + (h.completed ? " checked" : "") + "></div>";
    html += "<div><label>フリーズ残数</label><input id='ee-freeze' type='number' min='0' value='" + (h.freezeCount || 0) + "'></div>";
    html += "</div>";
    html += "<p class='detail-sub'>記録一覧（フリーズで補完した日は「❄️」表示）</p>";
    html += "<div id='ee-records'></div>";
    html += "<div class='ee-addrow'>";
    html += "<input type='date' id='ee-rec-date' value='" + todayStr() + "'>";
    html += "<input type='number' id='ee-rec-val' min='0' step='any' value='1' placeholder='値'>";
    html += "<button id='ee-rec-add' class='mini-btn rf-ok'>＋追加</button>";
    html += "</div>";
    html += "<p class='backup-msg' id='ee-msg'></p>";
    editBody.innerHTML = html;

    document.getElementById("ee-rec-add").addEventListener("click", function(){
        const date = document.getElementById("ee-rec-date").value;
        const raw = document.getElementById("ee-rec-val").value;
        let v = Number(raw);
        if(!date){
            alert("日付を入力してください。");
            return;
        }
        if(isNaN(v) || v < 0){
            alert("値を入力してください。");
            return;
        }
        editState.recs.push({ date: date, value: v });
        renderEditRecords();
    });

    renderEditRecords();
    editModal.style.display = "flex";
}

function renderEditRecords(){
    const box = document.getElementById("ee-records");
    if(!box || !editState) return;
    const recs = editState.recs;
    const bridges = editState.bridges;
    let html = "";
    if(!recs.length && !bridges.length){
        html += "<p class='backup-hint'>記録がありません。「＋追加」で記録を1件ずつ追加できます。</p>";
    }
    else{
        // 新しい順に実記録とフリーズ補完をまとめて表示（先頭40件）
        const all = [];
        recs.forEach(function(r, i){
            all.push({ kind: "rec", i: i, date: r.date, label: r.date + " ・ " + r.value + "（実記録）" });
        });
        bridges.forEach(function(d, i){
            all.push({ kind: "bridge", i: i, date: d, label: d + " ・ ❄️ フリーズ補完" });
        });
        all.sort(function(a, b){ return (a.date < b.date) ? 1 : (a.date > b.date ? -1 : 0); });
        all.slice(0, 40).forEach(function(it){
            html += "<div class='ee-rec'><span>" + esc(it.label) + "</span>" +
                    "<button type='button' class='mini-btn rf-cancel ee-del' data-kind='" + it.kind + "' data-i='" + it.i + "'>削除</button></div>";
        });
        if(all.length > 40){
            html += "<p class='backup-hint'>ほか " + (all.length - 40) + " 件（先頭40件のみ表示）</p>";
        }
    }
    box.innerHTML = html;
    box.querySelectorAll(".ee-del").forEach(function(btn){
        btn.addEventListener("click", function(){
            const kind = btn.getAttribute("data-kind");
            const i = Number(btn.getAttribute("data-i"));
            if(kind === "rec") editState.recs.splice(i, 1);
            else editState.bridges.splice(i, 1);
            renderEditRecords();
        });
    });
}

document.getElementById("btn-edit-save").addEventListener("click", function(){
    if(!editState) return;
    const h = editState.h;
    // 変更前に注意書きを表示
    if(!confirm("⚠️ 本当に非常時記録ですか？\nこの操作で記録データが書き換わります（元に戻せません）。\n続行しますか？")) return;
    const name = document.getElementById("ee-name").value.trim();
    if(!name){
        alert("習慣名を入力してください。");
        return;
    }
    const num = function(id){
        const v = Number(document.getElementById(id).value);
        return isNaN(v) ? 0 : v;
    };
    h.name = name;
    h.goal = document.getElementById("ee-goal").value;
    h.type = document.getElementById("ee-type").value;
    h.unit = document.getElementById("ee-unit").value.trim();
    h.streak = Math.max(0, Math.floor(num("ee-streak")));
    h.totalDays = Math.max(0, Math.floor(num("ee-total")));
    h.counter = Math.max(0, num("ee-counter"));
    h.todaycounter = Math.max(0, num("ee-today"));
    h.lastCompletedDate = document.getElementById("ee-last").value;
    h.completed = document.getElementById("ee-completed").checked;
    h.freezeCount = Math.max(0, Math.floor(num("ee-freeze")));
    h.records = editState.recs;
    h.freezeBridges = editState.bridges;
    h.emergencyEdited = true; // 直接指定した値を表示・維持する
    h.emergencyEdits = (h.emergencyEdits || 0) + 1;
    const emgTotal = bumpEmergencyCount();
    awardTitles(h);
    grantFreezes(h);
    save();
    displayHabits();
    editModal.style.display = "none";
    editState = null;
    alert("保存しました。\n（非常時編集 累計 " + emgTotal + " 回）");
});

closeEdit.addEventListener("click", function(){
    editModal.style.display = "none";
    editState = null;
});


/* ===== 着せ替えテーマ（知識の箱庭と共有: kg_settings） ===== */
const KG_SETTINGS_KEY = "kg_settings";
const themeModal = document.getElementById("themeModal");
const HT_THEMES = [
    { id: "dark",       name: "ダーク" },
    { id: "light",      name: "ライト" },
    { id: "sunset",     name: "夕焼け" },
    { id: "ocean",      name: "オーシャン" },
    { id: "forest",     name: "森" },
    { id: "mono",       name: "モノクロ（黒）" },
    { id: "mono-light", name: "モノクロ（白）" },
    { id: "space",      name: "宇宙" },
    { id: "notebook",   name: "ノートブック" },
    { id: "morning",    name: "朝" },
    { id: "cyber",      name: "サイバー" },
    { id: "custom",     name: "カスタム" }
];
function htGetKG(){
    try{ return JSON.parse(localStorage.getItem(KG_SETTINGS_KEY)) || {}; }
    catch(e){ return {}; }
}
function htSaveKG(s){ localStorage.setItem(KG_SETTINGS_KEY, JSON.stringify(s)); }
function htApply(mode, base, accent){
    const root = document.documentElement;
    root.setAttribute("data-theme", (mode === "custom") ? (base || "dark") : mode);
    if(mode === "custom" && accent){
        root.style.setProperty("--ht-accent", accent);
        root.style.setProperty("--ht-accent-2", accent);
        root.style.setProperty("--ht-header", accent);
    }
    else{
        root.style.removeProperty("--ht-accent");
        root.style.removeProperty("--ht-accent-2");
        root.style.removeProperty("--ht-header");
    }
}
function htCurrentMode(){
    const s = htGetKG();
    return s.theme || null;
}
function htDecorOn(){
    const s = htGetKG();
    return s.decor !== false; // 既定は ON（知識の箱庭と同じ）
}
// 装飾（夕焼けの斜陽・波・落ち葉・星・ネオンなどの演出）の適用/解除。kg_settings.decor を共有
function htApplyDecor(){
    const s = htGetKG();
    const decorOn = s.decor !== false;
    const base = (s.theme === "custom") ? (s.customBase || "dark") : (s.theme || "dark");
    document.body.classList.toggle("no-decor", !decorOn);
    const fx = document.getElementById("fx-layer");
    if(decorOn){
        if(window.ThemeFX && typeof window.ThemeFX.apply === "function") window.ThemeFX.apply(base);
    }
    else if(fx){
        fx.innerHTML = "";
        // theme-effects.js は DOMContentLoaded でも自動適用するため、オフ時は後からも消す
        document.addEventListener("DOMContentLoaded", function(){
            const f = document.getElementById("fx-layer");
            if(f) f.innerHTML = "";
        });
    }
}
function updateDecorUI(){
    const on = htDecorOn();
    const b = document.getElementById("btn-decor");
    if(b) b.textContent = on ? "✨ 装飾: 入" : "✨ 装飾: 出";
    const cb = document.getElementById("ht-decor");
    if(cb) cb.checked = on;
}
function htBuildGrid(){
    const grid = document.getElementById("ht-theme-grid");
    if(!grid) return;
    grid.innerHTML = "";
    const cur = htCurrentMode();
    HT_THEMES.forEach(function(t){
        const b = document.createElement("button");
        b.type = "button";
        b.className = "theme-swatch" + (cur === t.id ? " active" : "");
        b.textContent = t.name;
        b.setAttribute("data-id", t.id);
        b.addEventListener("click", function(){
            htPick(t.id);
        });
        grid.appendChild(b);
    });
}
function htPick(id){
    const s = htGetKG();
    if(id === "custom"){
        s.theme = "custom";
        s.customBase = document.getElementById("ht-cbase").value;
        s.customAccent = document.getElementById("ht-ccent").value;
    }
    else{
        s.theme = id;
        if(s.customBase === undefined) s.customBase = "dark";
    }
    htSaveKG(s);
    htApply(s.theme, s.customBase, s.customAccent);
    htApplyDecor();
    document.getElementById("ht-custom").hidden = (id !== "custom");
    document.querySelectorAll("#ht-theme-grid .theme-swatch").forEach(function(b){
        b.classList.toggle("active", b.getAttribute("data-id") === id);
    });
}
document.getElementById("btn-open-theme").addEventListener("click", function(){
    const s = htGetKG();
    const cur = s.theme || null;
    if(cur === "custom"){
        document.getElementById("ht-cbase").value = s.customBase || "dark";
        document.getElementById("ht-ccent").value = s.customAccent || "#5fcf8e";
    }
    document.getElementById("ht-custom").hidden = (cur !== "custom");
    htBuildGrid();
    updateDecorUI();
    themeModal.style.display = "flex";
});
document.getElementById("ht-cbase").addEventListener("change", function(){
    if(htCurrentMode() === "custom") htPick("custom");
});
document.getElementById("ht-ccent").addEventListener("input", function(){
    if(htCurrentMode() === "custom") htPick("custom");
});
document.getElementById("closeTheme").addEventListener("click", function(){
    themeModal.style.display = "none";
});
// 装飾のオン/オフボタン（すぐに反映・kg_settings に保存）
document.getElementById("btn-decor").addEventListener("click", function(){
    const s = htGetKG();
    s.decor = !htDecorOn();
    htSaveKG(s);
    htApplyDecor();
    updateDecorUI();
});
document.getElementById("ht-decor").addEventListener("change", function(){
    const s = htGetKG();
    s.decor = this.checked;
    htSaveKG(s);
    htApplyDecor();
    updateDecorUI();
});
// 起動時に知識の箱庭と同じテーマを適用（連動）
function htLoadTheme(){
    const s = htGetKG();
    if(s.theme) htApply(s.theme, s.customBase, s.customAccent);
}
htLoadTheme();
htApplyDecor();
updateDecorUI();


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

        // 3つの統計：連続 / 合計 / 累計（非常時編集済みの習慣は保存値を表示）
        const streakVal = habitStreak(habit);
        const totalVal = habitTotal(habit);

        const stats = document.createElement("div");
        stats.className = "hk-stats";

        stats.appendChild(makeStat(streakVal, "連続日数"));
        stats.appendChild(makeStat(totalVal, "合計日数"));
        stats.appendChild(makeStat(habit.counter + (habit.unit || ""), "累計"));

        // 称号チップ（連続日数に応じた称号と、次の称号までの残り日数）
        const ttl = getHabitTitle(streakVal);
        const nxt = getNextTitle(streakVal);
        const titleChip = document.createElement("div");
        titleChip.className = "hk-title";
        const tLine = document.createElement("span");
        tLine.className = "hk-title-cur" + (ttl ? " earned" : "");
        tLine.textContent = ttl ? (ttl.emoji + " " + ttl.name) : "称号なし";
        const nLine = document.createElement("span");
        nLine.className = "hk-title-next";
        nLine.textContent = nxt ? ("次は「" + nxt.name + "」まであと " + (nxt.days - streakVal) + " 日") : "最高位の称号を獲得！";
        titleChip.appendChild(tLine);
        titleChip.appendChild(nLine);
        const freezeChip = document.createElement("span");
        freezeChip.className = "hk-freeze";
        freezeChip.title = "ストリークフリーズ：連続7日ごとに1回獲得。記録が空いた日を帳消しにできます（1日＝1回）。";
        freezeChip.textContent = "❄️ ×" + (habit.freezeCount || 0);
        titleChip.appendChild(freezeChip);

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

        // 配置順：ヘッダー → フォーム(上) → 統計 → ボタン        card.appendChild(head);
        card.appendChild(form);
        card.appendChild(stats);
        card.appendChild(titleChip);
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
        // 非常時編集で直接指定した値は上書きしない。通常は records から再計算
        if(!habit.emergencyEdited && habit.records && habit.records.length){
            habit.streak = computeStreak(habit.records, habit.freezeBridges) || 0;
            habit.totalDays = computeTotalDays(habit.records);
        }
        awardTitles(habit); // 称号は静かに付与（お祝いアラートは記録時のみ）
        grantFreezes(habit); // フリーズも静かに付与（お知らせは記録時のみ）
    });
    save();
}

function save(){
    localStorage.setItem(
        "habits",
        JSON.stringify(habits)
    );
}


checkDate();
displayHabits();
