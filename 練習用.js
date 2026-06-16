let userName = "Leaf";

console.log(userName);

let price = 1000;
let quantity = 3;

let total = price * quantity;

console.log(total);

let inStock = true
if(inStock){
    console.log("購入可能");
}
else{
    console.log("購入不可");
}

let cart = [
    {
        name:"PC",
        price:90000
    },
    {
        name:"table",
        price:60000
    }
];

function calculateTotal(){

    let total = 0;

    total += cart[0].price;
    total += cart[1].price;   
    return total;
};
console.log(calculateTotal());



let score = 89;

if(score>=90){
    console.log("A");
}else if(score>=80){
    console.log("B");
}else if(score>=70){
    console.log("C");
}else if(score>=60){
    console.log("D");
}else{
    console.log("E");
};

let products = [
 {
    na:"stone",
    pric:300
 },
 {
    na:"grape",
    pric:500
 },
 {
    na:"banana",
    pric:100
 }
];
for(let product of products){
    if(product.pric >= 200)
    console.log(product.na,product.pric)
};

let tasks = [
    "HTML",
    "CSS",
    "JavaScript",
    "GitHub",
    "Python"
];

for(let task of tasks){
    console.log(task)
}




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