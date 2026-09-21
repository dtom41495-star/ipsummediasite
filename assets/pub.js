// Zones de publicité (.pub-zone) : le cadre garde sa place et montre le logo d'Ipsum Média en gris
// tant qu'aucune annonce n'est affichée (pas de consentement aux cookies, pas d'annonce disponible).
// Dès que Google a rempli l'emplacement, le logo s'efface pour laisser place à l'annonce.
(function () {
  var zones = document.querySelectorAll('.pub-zone');
  for (var i = 0; i < zones.length; i++) surveiller(zones[i]);

  function surveiller(zone) {
    var ins = zone.querySelector('ins.adsbygoogle');
    if (!ins) return;

    function maj() {
      if (ins.getAttribute('data-ad-status') === 'filled') zone.classList.add('is-filled');
      else zone.classList.remove('is-filled');
    }

    maj();
    if (window.MutationObserver) {
      new MutationObserver(maj).observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    }
  }
})();
