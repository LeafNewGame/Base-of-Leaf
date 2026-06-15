let count = 0;

let countText =
document.getElementById("countText");

let plusBtn =
document.getElementById("plusBtn");

let minusBtn =
document.getElementById("minusBtn");

let reset = document.getElementById("reset");

plusBtn.addEventListener(
    "mouseover",
    function(){
        count += 1
        countText.textContent = count;
    }
);

minusBtn.onclick = function(){

    count--;

    countText.textContent = count;

};

reset.onclick = function(){
    count = 0
    countText.textContent = count;
};



let nameBox =
document.getElementById("nameBox");

let btn =
document.getElementById("btn");

let result =
document.getElementById("result");

btn.addEventListener(
    "click",
    function(){
        console.log(nameBox.value);

        result.textContent = nameBox.value;

    }
);