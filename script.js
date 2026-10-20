

const menu = document.getElementById("menu");
const btn = document.querySelector(".menu-btn");

btn.addEventListener("click", () => {

    menu.classList.toggle("active");
    btn.classList.toggle("active");

});

const track =
document.querySelector(".slide-track");

if (track) {
    track.innerHTML += track.innerHTML;
}


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

        const header = document.querySelector("header");
        if (header) header.classList.toggle("scrolled", scrollY > 40);

    }
);

/* スクロールでふわっと表示（reveal） */
const revealTargets =
  document.querySelectorAll(
    ".hero-intro, main h2, .tool-cards, .planter-form, footer"
  );

revealTargets.forEach((el) => el.classList.add("reveal"));

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in-view");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealTargets.forEach((el) => io.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add("in-view"));
}