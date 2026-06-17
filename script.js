const menu = document.getElementById("menu");
const btn = document.querySelector(".menu-btn");
const closeBtn = document.getElementById("close-btn");

btn.addEventListener("click", () => {
    menu.classList.add("active");
    btn.classList.add("active");
});

closeBtn.addEventListener("click", () => {
    menu.classList.remove("active");
    btn.classList.remove("active");
});