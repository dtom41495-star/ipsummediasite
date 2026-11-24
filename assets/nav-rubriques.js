// Sous-menu "Rubriques" sous "Nos actus" du menu (toutes les pages) : rempli automatiquement avec
// les rubriques qui ont vraiment des articles en ce moment, aucune liste à tenir à jour, comme les
// communes de l'accueil. Chemins toujours absolus (/articles.html...) : ce script est le même sur
// toutes les pages, quel que soit leur propre niveau.
(function () {
  var conteneurs = Array.prototype.slice.call(document.querySelectorAll('.nav-rubriques'));
  if (!conteneurs.length) return;

  function fermer(conteneur) {
    var toggle = conteneur.querySelector('.nav-rubriques-toggle');
    var menu = conteneur.querySelector('.nav-rubriques-menu');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    if (menu) menu.hidden = true;
  }

  function lien(r) {
    return '<li><a href="/rubrique/' + r.slug + '">' + r.nom +
      ' <span class="nav-rubrique-count">' + r.n + '</span></a></li>';
  }

  function ouvrir(conteneur) {
    var toggle = conteneur.querySelector('.nav-rubriques-toggle');
    var menu = conteneur.querySelector('.nav-rubriques-menu');
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', 'true');
    menu.hidden = false;
  }

  // Un petit bouton ouvre le sous-menu ; sur ordinateur, le survol de la souris l'ouvre aussi
  var survol = window.matchMedia && window.matchMedia('(hover: hover) and (min-width: 901px)').matches;
  function brancher(conteneur) {
    var toggle = conteneur.querySelector('.nav-rubriques-toggle');
    var menu = conteneur.querySelector('.nav-rubriques-menu');
    if (!toggle || !menu || toggle._branche) return;
    toggle._branche = true;
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      var ouvert = toggle.getAttribute('aria-expanded') === 'true';
      conteneurs.forEach(fermer);   // un seul sous-menu ouvert à la fois
      if (!ouvert) ouvrir(conteneur);
    });
    if (survol) {
      var minuterie = null;
      conteneur.addEventListener('mouseenter', function () { clearTimeout(minuterie); conteneurs.forEach(function (c) { if (c !== conteneur) fermer(c); }); ouvrir(conteneur); });
      conteneur.addEventListener('mouseleave', function () { minuterie = setTimeout(function () { fermer(conteneur); }, 250); });
    }
  }

  // Le sous-menu de l'agenda est écrit dans la page : on le branche tout de suite
  conteneurs.filter(function (c) { return c.classList.contains('nav-agenda'); }).forEach(brancher);

  fetch('/.netlify/functions/substack-feed?tous=1')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var items = (data && data.items) || [];
      var compte = {};
      var noms = {};
      items.forEach(function (item) {
        (item.rubriques || []).forEach(function (r) {
          compte[r.slug] = (compte[r.slug] || 0) + 1;
          if (!noms[r.slug]) noms[r.slug] = r.nom;
        });
      });
      var liste = Object.keys(compte).map(function (s) { return { slug: s, nom: noms[s], n: compte[s] }; })
        .sort(function (a, b) { return b.n - a.n || (a.slug < b.slug ? -1 : 1); });
      if (!liste.length) return;   // pas de rubrique en ce moment : le petit bouton reste caché

      conteneurs.forEach(function (conteneur) {
        if (conteneur.classList.contains('nav-agenda')) return;
        var toggle = conteneur.querySelector('.nav-rubriques-toggle');
        var menu = conteneur.querySelector('.nav-rubriques-menu');
        if (!toggle || !menu) return;
        menu.innerHTML = liste.map(lien).join('');
        toggle.hidden = false;
        brancher(conteneur);
      });
    })
    .catch(function () {});   // le bouton reste caché : "Nos actus" fonctionne comme avant

  document.addEventListener('click', function (e) {
    conteneurs.forEach(function (conteneur) {
      if (!conteneur.contains(e.target)) fermer(conteneur);
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    conteneurs.forEach(fermer);
  });
})();
