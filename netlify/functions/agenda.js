// Pages de l'agenda public : /agenda/tarn et /agenda/haute-garonne.
// Les événements (proposés par le public, acceptés dans Compo) sont écrits dans le HTML : indexables, aucun appel à la base à chaque visite.
const compo = require('../../lib/compo');
const { SITE, echapper, enveloppe, reponseIndisponible } = require('../../lib/page');
const { EDITIONS, CATEGORIES, jourCle, jourLong, carte, urlPhoto, dateLongue, horaire } = require('../../lib/agenda');

const PUB = `  <!-- Publicité : le cadre garde sa place (logo en gris) tant qu'il n'y a pas d'annonce ; assets/pub.js l'anime -->
  <aside class="pub-zone pub-haut pub-milieu" data-encart="partenaire" aria-label="Publicité">
    <div class="wrap">
      <span class="ad-slot-label">Avec cette pub, Ipsum Média reste gratuit</span>
      <div class="pub-boite">
        <img class="pub-logo" src="/assets/logo.png" alt="">
        <ins class="adsbygoogle"
             style="display:block"
             data-ad-client="ca-pub-7695287329907050"
             data-ad-slot="4713288084"
             data-ad-format="horizontal"
             data-full-width-responsive="true"></ins>
      </div>
    </div>
  </aside>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  <script src="/assets/pub.js"></script>
`;

exports.handler = async function (event) {
  const m = String((event && event.path) || '').match(/agenda\/(tarn|haute-garonne)\/?$/);
  const q = (event && event.queryStringParameters) || {};
  const edition = m ? m[1] : (EDITIONS[q.edition] ? q.edition : '');
  if (!edition) return introuvable();
  const tous = await compo.agenda();
  if (!tous) return reponseIndisponible();
  const ed = EDITIONS[edition];
  const evenements = tous.filter((e) => e.edition === edition);
  const n = evenements.length;
  const url = `${SITE}/agenda/${edition}`;

  const categories = Object.keys(CATEGORIES).filter((c) => evenements.some((e) => e.categorie === c));
  const communes = [...new Set(evenements.map((e) => e.commune))].sort((a, b) => a.localeCompare(b, 'fr'));
  const groupes = [];
  evenements.forEach((e) => {
    const k = jourCle(e.date_debut);
    let g = groupes[groupes.length - 1];
    if (!g || g.k !== k) { g = { k, titre: jourLong(e.date_debut), items: [] }; groupes.push(g); }
    g.items.push(e);
  });

  const autre = edition === 'tarn' ? 'haute-garonne' : 'tarn';
  const onglet = (cle, libelle, actif) => `<button type="button" class="na-onglet" data-cat="${cle}" aria-pressed="${actif}">${echapper(libelle)}</button>`;
  const outils = n > 3 ? `
  <div class="na-outils"><div class="wrap">
    <div class="na-onglets" id="ag-onglets" role="group" aria-label="Catégories">${onglet('', 'Tout', true)}${categories.map((c) => onglet(c, CATEGORIES[c], false)).join('')}</div>
    <div class="na-selects"><label class="na-select"><span>Commune</span><select id="ag-commune"><option value="">Toutes les communes</option>${communes.map((c) => `<option value="${echapper(c)}">${echapper(c)}</option>`).join('')}</select></label></div>
  </div></div>` : '';

  const liste = n ? groupes.map((g) => `<section class="ag-jour" data-jour="${g.k}"><h2 class="ag-jour-titre">${echapper(g.titre)}</h2><div class="suite-grille">${g.items.map(carte).join('')}</div></section>`).join('')
    : `<div class="ag-vide"><p>Aucun événement à venir pour le moment.</p><p><a class="btn btn-primary" href="/agenda/proposer?edition=${edition}">Proposer le premier événement</a></p></div>`;

  const main = `
  <section class="page-bandeau">
    <div class="wrap">
      <nav class="theme-fil" aria-label="Fil d'Ariane"><a href="/index.html#accueil">Accueil</a> › <span aria-current="page">Agenda</span></nav>
      <span class="page-bandeau-eyebrow">Agenda</span>
      <h1>${echapper(ed.titre)}</h1>
      <p class="page-bandeau-lead">${n ? `${n} événement${n > 1 ? 's' : ''} à venir ${echapper(ed.de)} : concerts, sport, culture, marchés, réunions publiques…` : `Les événements à venir ${echapper(ed.de)}.`}</p>
      <div class="ag-actions"><a class="btn btn-primary" href="/agenda/proposer?edition=${edition}">Proposer un événement</a>
      <nav class="villes-pastilles page-bandeau-pastilles" aria-label="Choisir l'agenda"><a href="/agenda/${edition}" aria-current="page" class="ma-commune">${echapper(ed.nom)}</a><a href="/agenda/${autre}">${echapper(EDITIONS[autre].nom)}</a></nav></div>
    </div>
  </section>
  ${outils}
  <section class="journal ag-liste"><div class="wrap">${liste}<p class="ag-aucun" id="ag-aucun" hidden>Aucun événement pour ce choix.</p></div></section>

  ${PUB}
  <div class="ap2"><section class="ap2-band ap2-orange ag-cta"><div class="wrap">
    <h2 class="ap2-titre">Vous organisez un événement ?</h2>
    <p class="ap2-intro">Concert, match, marché, réunion publique, fête de village : proposez-le, c'est gratuit. Notre équipe le relit, puis il apparaît ici.</p>
    <p><a class="btn btn-light" href="/agenda/proposer?edition=${edition}">Proposer un événement</a></p>
  </div></section></div>

  <script>
  (function () {
    var onglets = document.getElementById('ag-onglets'), commune = document.getElementById('ag-commune'), aucun = document.getElementById('ag-aucun');
    if (!onglets) return;
    var cat = '';
    function filtrer() {
      var vus = 0;
      document.querySelectorAll('.ag-jour').forEach(function (j) {
        var n = 0;
        j.querySelectorAll('.ag-carte').forEach(function (c) {
          var ok = (!cat || c.getAttribute('data-cat') === cat) && (!commune.value || c.getAttribute('data-commune') === commune.value);
          c.hidden = !ok; if (ok) n++;
        });
        j.hidden = !n; vus += n;
      });
      aucun.hidden = vus > 0;
    }
    onglets.addEventListener('click', function (e) {
      var b = e.target.closest('.na-onglet'); if (!b) return;
      cat = b.getAttribute('data-cat');
      onglets.querySelectorAll('.na-onglet').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      filtrer();
    });
    commune.addEventListener('change', filtrer);
  })();
  </script>`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': url + '#page', url, name: ed.titre, inLanguage: 'fr-FR', isPartOf: { '@id': SITE + '/#site' },
        mainEntity: { '@type': 'ItemList', numberOfItems: n, itemListElement: evenements.slice(0, 50).map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + '/evenement/' + e.slug })) } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: ed.titre, item: url } ] },
    ],
  };
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    body: enveloppe({
      titre: `${ed.titre} : concerts, sorties et événements | Ipsum Média`,
      description: n ? `${n} événement${n > 1 ? 's' : ''} à venir ${ed.de} : ${evenements.slice(0, 3).map((e) => e.titre).join(', ')}. Proposez le vôtre gratuitement.` : `L'agenda des événements ${ed.de}. Proposez le vôtre gratuitement.`,
      canonical: url, jsonld, main,
    }),
  };
};

function introuvable() {
  const main = `<section class="page-bandeau"><div class="wrap"><span class="page-bandeau-eyebrow">Agenda</span><h1>Agenda introuvable</h1>
  <p class="page-bandeau-lead">Choisissez l'agenda du Tarn ou celui de la Haute-Garonne.</p>
  <p><a class="btn btn-primary" href="/agenda/tarn">Agenda du Tarn</a> <a class="btn btn-light" href="/agenda/haute-garonne">Agenda de la Haute-Garonne</a></p></div></section>`;
  return { statusCode: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' }, body: enveloppe({ titre: 'Agenda introuvable | Ipsum Média', robots: 'noindex', main }) };
}
