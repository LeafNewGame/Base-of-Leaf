

const menu = document.getElementById("menu");
const btn = document.querySelector(".menu-btn");

btn.addEventListener("click", () => {

    menu.classList.toggle("active");
    btn.classList.toggle("active");

});

const track = document.querySelector(".slide-track");

track.innerHTML += track.innerHTML;


const overlay =
document.querySelector(".hero-overlay");

window.addEventListener(
    "scroll",
    function(){

        let scrollY =
        window.scrollY;

        let opacity =
        scrollY / 800;

        if(opacity > 0.7){
            opacity = 0.7;
        }

        overlay.style.opacity =
        opacity;

    }
);