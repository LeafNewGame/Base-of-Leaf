let taskInput =
document.getElementById("taskInput");

let addTask =
document.getElementById("addTask");

let taskList =
document.getElementById("taskList");

addTask.addEventListener(
    "click",
    function(){

        let task =
        document.createElement("p");

        task.textContent =
        taskInput.value;

        taskList.appendChild(task);

    }
);