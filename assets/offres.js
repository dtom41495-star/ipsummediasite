// Carrousel des offres (section "On peut aussi travailler avec vous") : onglets, flèches, pause et
// défilement automatique. La barre de progression de l'onglet actif donne le rythme : quand elle est
// pleine (CSS, 8 secondes), on passe à l'offre suivante. Elle s'arrête au survol, au clavier, sur
// demande, hors de l'écran, et n'existe pas pour les visiteurs qui ont demandé moins d'animations.
(function () {
  var racine = document.getElementById('offres');
  if (!racine) return;

  var onglets = Array.prototype.slice.call(racine.querySelectorAll('.offres-onglet'));
  var diapos = Array.prototype.slice.call(racine.querySelectorAll('.offre'));
  var cadre = racine.querySelector('.offres-cadre');
  var bPrec = document.getElementById('offres-prec');
  var bSuiv = document.getElementById('offres-suiv');
  var bPause = document.getElementById('offres-pause');
  var courant = 0;

  var ICONE_PAUSE = '<path d="M8 5v14M16 5v14"/>';
  var ICONE_LECTURE = '<path d="M8 5l11 7-11 7z"/>';

  function aller(i, avecFocus) {
    i = (i + diapos.length) % diapos.length;
    courant = i;
    diapos.forEach(function (d, k) {
      var actif = k === i;
      d.classList.toggle('is-actif', actif);
      d.setAttribute('aria-hidden', actif ? 'false' : 'true');
      // Une offre masquée ne doit pas être atteignable au clavier
      if (actif) d.removeAttribute('inert'); else d.setAttribute('inert', '');
    });
    onglets.forEach(function (o, k) {
      var actif = k === i;
      o.setAttribute('aria-selected', actif ? 'true' : 'false');
      o.tabIndex = actif ? 0 : -1;
    });
    if (avecFocus) onglets[i].focus();
  }

  // Fin de la barre de progression : offre suivante
  racine.addEventListener('animationend', function (e) {
    if (e.animationName === 'offres-progres') aller(courant + 1);
  });

  onglets.forEach(function (o, k) {
    o.addEventListener('click', function () { aller(k); });
  });
  bPrec.addEventListener('click', function () { aller(courant - 1); });
  bSuiv.addEventListener('click', function () { aller(courant + 1); });

  // Flèches, début et fin sur la rangée d'onglets
  racine.querySelector('.offres-onglets').addEventListener('keydown', function (e) {
    var touche = e.key;
    if (touche === 'ArrowRight') aller(courant + 1, true);
    else if (touche === 'ArrowLeft') aller(courant - 1, true);
    else if (touche === 'Home') aller(0, true);
    else if (touche === 'End') aller(diapos.length - 1, true);
    else return;
    e.preventDefault();
  });

  bPause.addEventListener('click', function () {
    var enPause = racine.classList.toggle('is-pause');
    var libelle = enPause ? 'Reprendre le défilement automatique' : 'Mettre en pause le défilement automatique';
    bPause.setAttribute('aria-label', libelle);
    bPause.setAttribute('title', libelle);
    bPause.firstElementChild.innerHTML = enPause ? ICONE_LECTURE : ICONE_PAUSE;
  });

  // Pause quand on navigue au clavier dans le carrousel (pas après un simple clic à la souris)
  racine.addEventListener('focusin', function (e) {
    var auClavier = false;
    try { auClavier = e.target.matches(':focus-visible'); } catch (err) {}
    racine.classList.toggle('is-focus', auClavier);
  });
  racine.addEventListener('focusout', function () { racine.classList.remove('is-focus'); });

  // Pas de défilement automatique tant que le carrousel n'est pas à l'écran
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entrees) {
      racine.classList.toggle('is-hors-ecran', !entrees[0].isIntersecting);
    }, { threshold: 0.25 }).observe(racine);
  }

  // Balayage du doigt sur téléphone
  var departX = null;
  cadre.addEventListener('touchstart', function (e) { departX = e.touches[0].clientX; }, { passive: true });
  cadre.addEventListener('touchend', function (e) {
    if (departX === null) return;
    var ecart = e.changedTouches[0].clientX - departX;
    departX = null;
    if (Math.abs(ecart) > 45) aller(courant + (ecart < 0 ? 1 : -1));
  }, { passive: true });
})();
