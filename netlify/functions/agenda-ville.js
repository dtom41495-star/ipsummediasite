// Page d'agenda d'une ville : /agenda/tarn/albi, /agenda/haute-garonne/toulouse…
// Écrite pour être trouvée sur internet (« que faire à Albi », « événements Albi ce week-end ») : titre et description propres à la ville,
// texte d'introduction avec les prochaines dates, liste complète des événements, données structurées, liens vers les autres villes et l'actualité de la ville.
// Une ville sans événement à venir reste en ligne mais n'est pas référencée (noindex) tant qu'aucun événement n'y est annoncé.
const compo = require('../../lib/compo');
const { SITE, echapper, enveloppe, reponseIndisponible } = require('../../lib/page');
const { de } = require('../../lib/themes');
const A = require('../../lib/agenda');
const { PUB, EDITIONS, CATEGORIES, jourCle, jourLong, carte, slugVille, cheminVille, villes, villesConnues, weekend, contexte } = A;

const courte = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });

exports.handler = async function (event) {
  const m = String((event && event.path) || '').match(/agenda\/(tarn|haute-garonne)\/([a-z0-9-]{2,80})\/?$/);
  if (!m) return introuvable();
  const [, edition, slug] = m;
  const tous = await compo.agenda();
  if (!tous) return reponseIndisponible();
  const ed = EDITIONS[edition];
  const lesVilles = villes(tous, edition);
  const v = lesVilles.get(slug);
  const nom = v ? v.nom : (villesConnues()[edition] || {})[slug];
  if (!nom) return introuvable();
  const evenements = v ? v.items : [];
  const n = evenements.length;
  const url = SITE + cheminVille(edition, slug);
  const dans = de(nom);

  const [sam, dim] = weekend();
  const groupes = [];
  evenements.forEach((e) => {
    const k = jourCle(e.date_debut);
    let g = groupes[groupes.length - 1];
    if (!g || g.k !== k) { g = { k, titre: (k >= sam && k <= dim ? 'Ce week-end · ' : '') + jourLong(e.date_debut), items: [] }; groupes.push(g); }
    g.items.push(e);
  });
  const categories = Object.keys(CATEGORIES).filter((c) => evenements.some((e) => e.categorie === c)).map((c) => CATEGORIES[c].toLowerCase());
  const prochains = evenements.slice(0, 3);

  // Texte d'introduction : du vrai contenu, propre à la ville, lisible par les moteurs de recherche et par les lecteurs
  const intro = n
    ? `${n} événement${n > 1 ? 's' : ''} à venir à ${echapper(nom)}${categories.length ? ` (${echapper(categories.slice(0, 4).join(', '))})` : ''}, du ${echapper(courte(evenements[0].date_debut))}${n > 1 ? ` au ${echapper(courte(evenements[n - 1].date_debut))}` : ''}.`
      + ` Les prochains rendez-vous : ${prochains.map((e) => `<a href="${A.lienEvenement(e)}">${echapper(e.titre)}</a> (${echapper(courte(e.date_debut))})`).join(', ')}.`
    : `Aucun événement n'est annoncé à ${echapper(nom)} pour le moment. Vous organisez quelque chose ? Proposez-le gratuitement : il apparaîtra ici après relecture par notre équipe.`;

  const liste = n
    ? groupes.map((g) => `<section class="ag-jour" data-jour="${g.k}"><h2 class="ag-jour-titre">${echapper(g.titre)}</h2><div class="suite-grille">${g.items.map(carte).join('')}</div></section>`).join('')
    : `<div class="ag-vide"><p>Aucun événement à venir à ${echapper(nom)}.</p><p><a class="btn btn-primary" href="/agenda/proposer?edition=${edition}">Proposer un événement</a></p></div>`;

  const autres = [...lesVilles.values()].filter((x) => x.slug !== slug).sort((a, b) => b.items.length - a.items.length || a.nom.localeCompare(b.nom, 'fr')).slice(0, 12);
  const pastilles = autres.length
    ? `<section class="journal ag-villes"><div class="wrap"><div class="journal-tete"><h2>Les autres villes de l'agenda ${echapper(ed.de)}</h2><a href="/agenda/${edition}">Tout l'agenda</a></div>
      <nav class="villes-pastilles" aria-label="Agenda par ville">${autres.map((x) => `<a href="${cheminVille(edition, x.slug)}">${echapper(x.nom)} <small>${x.items.length}</small></a>`).join('')}</nav></div></section>` : '';
  const actus = contexte.communesActus.has(slug) ? `<p class="ag-lien-actus"><a href="/commune/${slug}">Lire l'actualité ${echapper(dans)} sur Ipsum Média</a></p>` : '';

  const main = `
  <section class="page-bandeau">
    <div class="wrap">
      <nav class="theme-fil" aria-label="Fil d'Ariane"><a href="/index.html#accueil">Accueil</a> › <a href="/agenda/${edition}">${echapper(ed.titre)}</a> › <span aria-current="page">${echapper(nom)}</span></nav>
      <span class="page-bandeau-eyebrow">Agenda · ${echapper(ed.nom)}</span>
      <h1>Agenda ${echapper(dans)}</h1>
      <p class="page-bandeau-lead">${intro}</p>
      <div class="ag-actions"><a class="btn btn-primary" href="/agenda/proposer?edition=${edition}">Proposer un événement</a>
      <nav class="villes-pastilles page-bandeau-pastilles" aria-label="Choisir l'agenda"><a href="${cheminVille(edition, slug)}" aria-current="page" class="ma-commune">${echapper(nom)}</a><a href="/agenda/${edition}">Tout ${echapper(ed.nom)}</a></nav></div>
    </div>
  </section>
  <section class="journal ag-liste"><div class="wrap">${liste}${actus}</div></section>
  ${pastilles}
  ${PUB}
  <div class="ap2"><section class="ap2-band ap2-orange ag-cta"><div class="wrap">
    <h2 class="ap2-titre">Un événement à ${echapper(nom)} ?</h2>
    <p class="ap2-intro">Concert, match, marché, réunion publique, fête de village : proposez-le, c'est gratuit. Notre équipe le relit, puis il apparaît ici.</p>
    <p><a class="btn btn-light" href="/agenda/proposer?edition=${edition}">Proposer un événement</a></p>
  </div></section></div>`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': url + '#page', url, name: `Agenda ${dans}`, inLanguage: 'fr-FR', isPartOf: { '@id': SITE + '/#site' },
        about: { '@type': 'City', name: nom, containedInPlace: { '@type': 'AdministrativeArea', name: ed.nom } },
        mainEntity: { '@type': 'ItemList', numberOfItems: n, itemListElement: evenements.slice(0, 50).map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + A.lienEvenement(e) })) } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: ed.titre, item: SITE + '/agenda/' + edition },
        { '@type': 'ListItem', position: 3, name: `Agenda ${dans}`, item: url } ] },
    ],
  };
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    body: enveloppe({
      titre: `Agenda ${dans} : sorties, concerts et événements | Ipsum Média`,
      description: n ? `${n} événement${n > 1 ? 's' : ''} à venir à ${nom} : ${prochains.map((e) => e.titre).join(', ')}. L'agenda local d'Ipsum Média, à compléter gratuitement.` : `L'agenda des événements à ${nom}. Proposez le vôtre gratuitement.`,
      canonical: url, jsonld, main, ...(n ? {} : { robots: 'noindex,follow' }),
    }),
  };
};

function introuvable() {
  const main = `<section class="page-bandeau"><div class="wrap"><span class="page-bandeau-eyebrow">Agenda</span><h1>Ville introuvable</h1>
  <p class="page-bandeau-lead">Cette ville n'a pas (encore) d'événement dans notre agenda.</p>
  <p><a class="btn btn-primary" href="/agenda/tarn">Agenda du Tarn</a> <a class="btn btn-light" href="/agenda/haute-garonne">Agenda de la Haute-Garonne</a></p></div></section>`;
  return { statusCode: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' }, body: enveloppe({ titre: 'Ville introuvable | Ipsum Média', robots: 'noindex', main }) };
}
