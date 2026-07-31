/* Navegación móvil y selector de tema.
   El tema se guarda en localStorage y se aplica antes del primer render
   para evitar el destello de tema incorrecto. */
(function () {
  "use strict";

  var KEY = "tema";

  function aplicar(t) {
    document.documentElement.dataset.tema = t;
    try { localStorage.setItem(KEY, t); } catch (e) { /* modo privado */ }
  }

  // restaurar preferencia
  try {
    var guardado = localStorage.getItem(KEY);
    if (guardado) document.documentElement.dataset.tema = guardado;
  } catch (e) { /* sin storage disponible */ }

  document.addEventListener("DOMContentLoaded", function () {
    var btnTema = document.getElementById("tema");
    if (btnTema) {
      btnTema.addEventListener("click", function () {
        var actual = document.documentElement.dataset.tema;
        aplicar(actual === "claro" ? "oscuro" : "claro");
      });
    }

    var btnMenu = document.getElementById("menu");
    var menu = document.getElementById("nav-mobile");
    if (btnMenu && menu) {
      btnMenu.addEventListener("click", function () {
        var abierto = menu.dataset.open === "true";
        menu.dataset.open = abierto ? "false" : "true";
        btnMenu.setAttribute("aria-expanded", abierto ? "false" : "true");
        btnMenu.textContent = abierto ? "≡" : "×";
      });
    }
  });
})();
