const habitName = document.getElementById("habitName")
const addHabit = document.getElementById("addHabit")
const habitList = document.getElementById("habitList")
const habitGoal = document.getElementById("habitGoal")
const saveHabit = document.getElementById("saveHabit")
const habitType = document.getElementById("habitType")
const type = habitType.value


let habits =
JSON.parse(
    localStorage.getItem("habits")
) || [];


saveHabit.addEventListener(
    "click",
    function(){
        const f_num = 0
        const type = habitType.value
        let num = "";
        if (type === "time"){
         num = f_num+"分"
        }
        else if (type === "count"){
         num = f_num+"回"
        };
        const habitData = {
         name: habitName.value,
         goal: habitGoal.value,
         type: type,
         streak:0,
         counter: num,
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
    counter.textContent = habit.counter

    const goal = document.createElement("h3")

    const memo = document.createElement("p")

    const completeButton = document.createElement("button");
    completeButton.textContent = "達成する";

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "削除";

    completeButton.addEventListener(
     "click",
     function(){
        if (!habit.completed){
        habit.streak++;
        habit.completed = true;
        const today = new Date().toISOString().slice(0, 10);
        habit.lastCompletedDate = today;
        displayHabits();
        localStorage.setItem(
        "habits",
        JSON.stringify(habits)
        );
      }}
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

        }

    });

    localStorage.setItem(
        "habits",
        JSON.stringify(habits)
    );

}

checkDate();
displayHabits();