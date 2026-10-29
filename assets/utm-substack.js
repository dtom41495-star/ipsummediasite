// Étiquette d'origine (UTM) sur les liens du site qui mènent à Substack : dans les statistiques
// de Substack, ces visites apparaissent comme venant d'ipsummedia.fr. Les liens qui portent déjà
// un utm_source (celui de l'application Substack, par exemple) ne sont pas touchés.
(function () {
  function etiqueter(a) {
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    var u;
    try { u = new URL(href, location.href); } catch (e) { return; }
    var hote = u.hostname;
    if (hote !== 'substack.com' && !/\.substack\.com$/.test(hote)) return;
    if (u.searchParams.has('utm_source')) return;
    u.searchParams.set('utm_source', 'ipsummedia.fr');
    u.searchParams.set('utm_medium', 'site');
    u.searchParams.set('utm_campaign', 'ipsummedia-fr');
    a.setAttribute('href', u.toString());
  }
  function parcourir(racine) {
    if (!racine || !racine.querySelectorAll) return;
    if (racine.tagName === 'A') etiqueter(racine);
    var liens = racine.querySelectorAll('a[href]');
    for (var i = 0; i < liens.length; i++) etiqueter(liens[i]);
  }
  function demarrer() {
    parcourir(document);
    // Les liens ajoutés ensuite (cartes d'articles, menu des rubriques…) sont étiquetés à leur arrivée
    if (!window.MutationObserver) return;
    new MutationObserver(function (lots) {
      lots.forEach(function (l) {
        if (l.type === 'attributes') etiqueter(l.target);
        else l.addedNodes.forEach(function (n) { if (n.nodeType === 1) parcourir(n); });
      });
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
