const habitName = document.getElementById("habitName")
const addHabit = document.getElementById("addHabit")
const habitList = document.getElementById("habitList")
const habitGoal = document.getElementById("habitGoal")
const saveHabit = document.getElementById("saveHabit")
const habitType = document.getElementById("habitType")
const unitArea = document.getElementById("unitArea");
const habitUnit = document.getElementById("habitUnit");
const recordModal = document.getElementById("recordModal")
const recordValue = document.getElementById("recordValue");
const saveRecord = document.getElementById("saveRecord");
const closeRecord = document.getElementById("closeRecord");
const value = Number(recordValue.value);
let selectedHabit = null;

let habits =
JSON.parse(
    localStorage.getItem("habits")
) || [];

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

habitType.addEventListener(
    "change",
    updateUnitArea
);

updateUnitArea();

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
        const f_num = 0
        const type = habitType.value
        const habitData = {
         name: habitName.value,
         goal: habitGoal.value,
         type: type,
         streak:0,
         counter: 0,
         todaycounter:0,
         unit: habitUnit.value,
         completed:false, 
         lastCompletedDate: ""        
        };
       
        habits.push(habitData);
        localStorage.setItem(
            "habits",
            JSON.stringify(habits)
        );

        displayHabits();
        modal.style.display = "none";
    }
)


const modal = document.getElementById("habitModal");

addHabit.addEventListener(
    "click",
    function(){

        modal.style.display = "flex";

    }
);

const closeModal = document.getElementById("closeModal");

closeModal.addEventListener(
    "click",
    function(){

        modal.style.display = "none";

    }
);

function displayHabits(){

    habitList.innerHTML = "";

    habits.forEach(function(habit,index){

    const card = document.createElement("div");
    card.classList.add("habit-card")

    const title = document.createElement("h2")
    title.textContent = habit.name

    const streak = document.createElement("p");
    streak.textContent = "継続日数: " + habit.streak + "日";

    const status = document.createElement("p");

    const counter = document.createElement("p")
    counter.textContent = habit.counter + habit.unit;

    const goal = document.createElement("h3")

    const memo = document.createElement("p")

    const completeButton = document.createElement("button");
    completeButton.textContent = "記録する";

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "削除";

    completeButton.addEventListener(
     "click",
     function(){
        if (!habit.completed){
        habit.streak++;
        habit.completed = true;
        selectedHabit = habit;
        recordModal.style.display = "flex";
        habit.counter += value;
        habit.todaycounter += value;
        const today = new Date().toISOString().slice(0, 10);
        habit.lastCompletedDate = today;
        displayHabits();
        localStorage.setItem(
        "habits",
        JSON.stringify(habits)
        );
      }
        displayHabits();
        modal.style.display = "none";
      }
    );

    deleteButton.addEventListener(
        "click",
        function(){
            habits.splice(index,1);
            localStorage.setItem(
            "habits",
            JSON.stringify(habits)
            );
            displayHabits();
        }
    )
    status.textContent =
    habit.completed ?
    "達成済み"
    :
    "未達成";
    card.appendChild(title);

    card.appendChild(streak);

    card.appendChild(status);

    card.appendChild(counter);

    card.appendChild(completeButton);

    card.appendChild(deleteButton);

    habitList.appendChild(card);
    });

}


function checkDate() {

    const today = new Date().toISOString().slice(0, 10);

    habits.forEach(function(habit){

        if(habit.lastCompletedDate !== today){

            habit.completed = false;
            habit.todaycounter = 0;

        }

    });

    localStorage.setItem(
        "habits",
        JSON.stringify(habits)
    );

}

checkDate();
displayHabits();