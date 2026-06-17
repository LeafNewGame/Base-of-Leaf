

const menu = document.getElementById("menu");
const btn = document.querySelector(".menu-btn");

btn.addEventListener("click", () => {

    menu.classList.toggle("active");
    btn.classList.toggle("active");

});