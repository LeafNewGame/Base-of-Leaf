const habitInput = document.getElementById("habitInput")
const addHabit = document.getElementById("addHabit")
const habitList = document.getElementById("habitList")

let habits = [];
function displayHabits(){

    habitList.innerHTML = "";

    habits.forEach(function(habit){

    const card =
    document.createElement("div");
    card.classList.add("habit-card")

    const title =
    document.createElement("h2")
    title.textContent = habit.name

    const streak =
    document.createElement("p");

    streak.textContent =
    "継続日数: " + habit.streak + "日";

    const status =
    document.createElement("p");

    status.textContent =
    habit.completed ?
    "達成済み"
    :
    "未達成";
    card.appendChild(title);

    card.appendChild(streak);

    card.appendChild(status);

    habitList.appendChild(card);
    });
}

addHabit.addEventListener(
    "click",
    function(){

        const habitData = {
            name : habitInput.value,
            streak : 0,
            completed : false
        };
        habits.push(habitData);
        displayHabits();
        habitInput.value = ""
    }
);