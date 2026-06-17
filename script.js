
let menuBtn =
document.getElementById("menuBtn");

let menu =
document.getElementById("menu");

menuBtn.addEventListener(
    "click",
    function(){

        if(menu.style.display === "block"){

            menu.style.display = "none";

        }else{

            menu.style.display = "block";

        }

    }
); 
