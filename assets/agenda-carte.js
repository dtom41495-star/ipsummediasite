// Carte d'un lieu (agenda public) : Plan IGN (cartes.gouv.fr), Leaflet chargé seulement quand on en a besoin (clic du visiteur
// ou choix d'une adresse dans le formulaire) : aucune requête vers ces services tant que la carte n'est pas demandée.
window.IpsumCarte = (function () {
  var TUILES = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
  var chargement = null;
  function leaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (chargement) return chargement;
    chargement = new Promise(function (ok, ko) {
      var css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      s.onload = function () { ok(window.L); };
      s.onerror = function () { chargement = null; ko(new Error('carte indisponible')); };
      document.head.appendChild(s);
    });
    return chargement;
  }
  var cartes = new WeakMap();
  // Montre (ou déplace) le point sur la carte de l'élément `el`
  function afficher(el, lat, lng) {
    return leaflet().then(function (L) {
      var c = cartes.get(el);
      if (!c) {
        var carte = L.map(el, { scrollWheelZoom: false }).setView([lat, lng], 16);
        L.tileLayer(TUILES, { maxZoom: 19, attribution: '© <a href="https://cartes.gouv.fr" target="_blank" rel="noopener">IGN – cartes.gouv.fr</a>' }).addTo(carte);
        c = { carte: carte, point: L.circleMarker([lat, lng], { radius: 10, color: '#fff', weight: 3, fillColor: '#EA5B1C', fillOpacity: 1 }).addTo(carte) };
        cartes.set(el, c);
      } else {
        c.point.setLatLng([lat, lng]); c.carte.setView([lat, lng], 16);
      }
      setTimeout(function () { c.carte.invalidateSize(); }, 50);
    });
  }
  return { afficher: afficher };
})();
