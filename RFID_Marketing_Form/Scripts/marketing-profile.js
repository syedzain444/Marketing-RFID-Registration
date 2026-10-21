(function () {
    "use strict";

    function init() {
        var wrap = document.querySelector(".rp-profile-wrap");
        var trigger = document.getElementById("profileTrigger");
        var menu = document.getElementById("profileMenu");
        if (!wrap || !trigger || !menu) return;

        function close() {
            menu.classList.remove("is-open");
            trigger.setAttribute("aria-expanded", "false");
        }

        function toggle(e) {
            e.preventDefault();
            e.stopPropagation();
            var open = menu.classList.toggle("is-open");
            trigger.setAttribute("aria-expanded", open ? "true" : "false");
        }

        trigger.addEventListener("click", toggle);
        document.addEventListener("click", function (e) {
            if (!wrap.contains(e.target)) close();
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") close();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
