// Pages d'une commune (/commune/castres) et d'une rubrique (/rubrique/culture) : leur titre, leur description et tous
// leurs articles sont écrits dans le HTML, pour que Google puisse les classer (« actualités de Castres »).
// Appelée par les redirections de netlify.toml : /commune/* et /rubrique/*.

const { SITE, MIN_INDEX, chargerItems, regrouper, de } = require('../../lib/themes');
const { echapper, decoder, enveloppe, reponseIndisponible } = require('../../lib/page');
const { carte } = require('./articles-liste');

const MAX_CARTES = 100;
const TYPES = { commune: 'communes', rubrique: 'rubriques' };

exports.handler = async function (event) {
  const q = (event && event.queryStringParameters) || {};
  const type = TYPES[q.type] ? q.type : '';
  const slug = String(q.slug || '').replace(/\/+$/, '').toLowerCase();
  if (!type || !/^[a-z0-9-]{1,80}$/.test(slug)) return introuvable();

  const items = await chargerItems();
  if (!items.length) return reponseIndisponible();   // la liste des articles ne répond pas : pas un 404
  const groupes = regrouper(items);
  const g = groupes[TYPES[type]][slug];
  if (!g) return introuvable();

  const nom = decoder(g.nom);
  const n = g.items.length;
  const url = `${SITE}/${type}/${slug}`;
  const titre = type === 'commune' ? `Actualités ${de(nom)} : articles et reportages | Ipsum Média` : `${nom} : nos articles | Ipsum Média`;
  const h1 = type === 'commune' ? `L'actu ${de(nom)}` : nom;
  const titresRecents = g.items.slice(0, 3).map((i) => decoder(i.title)).join(' · ');
  const description = coupe((type === 'commune'
    ? `${n} article${n > 1 ? 's' : ''} d'Ipsum Média sur ${nom} : ${titresRecents}.`
    : `Rubrique ${nom} d'Ipsum Média : ${n} article${n > 1 ? 's' : ''}, dont ${titresRecents}.`), 158);
  const indexable = n >= MIN_INDEX;
  const visibles = g.items.slice(0, MAX_CARTES);

  const autres = (t) => Object.values(groupes[TYPES[t]]).filter((x) => x.slug !== slug || t !== type)
    .sort((a, b) => b.items.length - a.items.length || (a.slug < b.slug ? -1 : 1));
  const puces = (t, titreBloc) => {
    const liste = autres(t);
    if (!liste.length) return '';
    return `<section class="theme-voir-aussi" aria-label="${echapper(titreBloc)}"><h2>${echapper(titreBloc)}</h2><p class="theme-puces">` +
      liste.map((x) => `<a class="feed-tag${t === 'rubrique' ? ' feed-tag-rubrique' : ''}" href="/${t}/${x.slug}">${x.nom}</a>`).join(' ') + '</p></section>';
  };

  const main = `
  <section class="hero" style="min-height:auto; padding: 70px 0 40px; background: var(--cream);">
    <div class="wrap" style="text-align:center; margin:0 auto;">
      <span class="eyebrow" style="color:var(--orange);">${type === 'commune' ? 'Commune' : 'Rubrique'}</span>
      <h1 style="color:var(--ink);">${echapper(h1)}</h1>
      <p class="lead" style="color:var(--ink-soft); margin:0 auto;">${n} article${n > 1 ? 's' : ''} d'Ipsum Média ${type === 'commune' ? 'sur ' + echapper(nom) : 'dans cette rubrique'}, du plus récent au plus ancien.</p>
    </div>
  </section>

  <section class="articles-list">
    <div class="wrap">
      <nav class="theme-fil" aria-label="Fil d'Ariane" style="font-size:.9rem; margin-bottom:18px;"><a href="/index.html#accueil">Accueil</a> › <a href="/articles.html">Nos actus</a> › <span aria-current="page">${echapper(nom)}</span></nav>
      <div class="feed-grid">${visibles.map(carte).join('')}</div>
      <div style="margin-top:36px;">${puces('commune', 'Autres communes')}${puces('rubrique', 'Rubriques')}</div>
      <p style="margin-top:28px;"><a class="btn btn-outline" href="/articles.html">Tous nos articles</a></p>
    </div>
  </section>`;

  // Mêmes adresses que les cartes : l'article du site, qu'il vienne de Compo ou de Substack (tant qu'il a sa page sur le site)
  const liens = visibles.filter((i) => i.surLeSite !== false).map((i) => (i.link || '').match(/\/(?:p|articles)\/([^/?#]+)/)).filter(Boolean).map((m) => `${SITE}/articles/${m[1]}`);
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', '@id': url + '#page', url, name: decoder(titre).replace(/ \| Ipsum Média$/, ''), description, inLanguage: 'fr-FR',
        isPartOf: { '@id': SITE + '/#site' },
        ...(type === 'commune' ? { about: { '@type': 'Place', name: nom } } : {}),
        mainEntity: { '@type': 'ItemList', numberOfItems: n, itemListElement: liens.map((u, i) => ({ '@type': 'ListItem', position: i + 1, url: u })) },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Nos actus', item: SITE + '/articles.html' },
          { '@type': 'ListItem', position: 3, name: nom, item: url },
        ],
      },
    ],
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'Netlify-CDN-Cache-Control': 'public, max-age=300, stale-while-revalidate=600, durable' },
    body: enveloppe({ titre, description, canonical: url, robots: indexable ? 'index, follow' : 'noindex, follow', jsonld, main }),
  };
};

function coupe(t, max) {
  if (t.length <= max) return t;
  const c = t.slice(0, max);
  const i = c.lastIndexOf(' ');
  return (i > max * 0.6 ? c.slice(0, i) : c).replace(/[\s,;:.·-]+$/, '') + '…';
}

function introuvable() {
  const main = `
  <section class="hero" style="min-height:auto; padding: 70px 0 40px; background: var(--cream);">
    <div class="wrap" style="text-align:center; margin:0 auto;">
      <span class="eyebrow" style="color:var(--orange);">Actus</span>
      <h1 style="color:var(--ink);">Page introuvable</h1>
      <p class="lead" style="color:var(--ink-soft); margin:0 auto;">Aucun article pour cette commune ou cette rubrique pour le moment.</p>
      <p style="margin-top:24px;"><a class="btn btn-primary" href="/articles.html">Voir tous nos articles</a></p>
    </div>
  </section>`;
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
    body: enveloppe({ titre: 'Page introuvable | Ipsum Média', description: '', robots: 'noindex', main }),
  };
}
