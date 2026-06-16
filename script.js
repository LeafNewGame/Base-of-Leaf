let count = 0;

let countText =
document.getElementById("countText");

let plusBtn =
document.getElementById("plusBtn");

let minusBtn =
document.getElementById("minusBtn");

let reset = document.getElementById("reset");

plusBtn.addEventListener(
    "click",
    function(){
        count += 1
        countText.textContent = count;
    }
);

minusBtn.addEventListener(
    "click",
    function(){

    count--;

    countText.textContent = count;
    }
);


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
        result.textContent = 
        "こんにちは"
        +nameBox.value
        +"さん";
    }
);
let greet = document.getElementById("greet")
let list =
document.getElementById("list");

greet.addEventListener(
   "click",
   function(){
        let p =
        document.createElement("p");

        p.textContent =
        "こんにちは";

        let deleteb = document.createElement("button");
  
        deleteb.textContent =
        "削除";

        deleteb.addEventListener(
            "click",
            function(){

                p.remove();
            }

        );
        p.appendChild(deleteb);
        list.appendChild(p);
    }
);