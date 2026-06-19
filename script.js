

const menu = document.getElementById("menu");
const btn = document.querySelector(".menu-btn");

btn.addEventListener("click", () => {

    menu.classList.toggle("active");
    btn.classList.toggle("active");

});

const track = document.querySelector(".slide-track");

track.innerHTML += track.innerHTML;
