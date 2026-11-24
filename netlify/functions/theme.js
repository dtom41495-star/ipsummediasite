// Pages d'une commune (/commune/castres) et d'une rubrique (/rubrique/culture) : leur titre, leur description et tous
// leurs articles sont écrits dans le HTML, pour que Google puisse les classer (« actualités de Castres »).
// Appelée par les redirections de netlify.toml : /commune/* et /rubrique/*.

const { SITE, MIN_INDEX, chargerItems, regrouper, de } = require('../../lib/themes');
const { echapper, decoder, enveloppe, reponseIndisponible } = require('../../lib/page');
const { carte, blocUne, tete, surtitre, sansPhoto, attrsLien } = require('../../lib/blocs');

const MAX_CARTES = 100;
const TYPES = { commune: 'communes', rubrique: 'rubriques' };

exports.handler = async function (event) {
  const { type, slug } = lireAdresse(event);
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
  const pastilles = (t) => autres(t).map((x) => `<a href="/${t}/${x.slug}">${x.nom}</a>`).join('');

  // Même construction que l'accueil : le dernier article en grand + 3, les 4 suivants, les plus lus, puis tout le reste
  const sc = type === 'commune';   // sur la page d'une commune, les cartes n'ont pas besoin de répéter son nom
  const dessus = visibles.slice(0, 4);
  const suite = visibles.slice(4, 8);
  const reste = visibles.slice(8);
  const PAS_CARTES = 12;
  const vitrine = visibles.slice(0, 24).map((i) => {
    const m = (i.link || '').match(/\/(?:p|articles)\/([^/?#]+)/);
    return m ? { s: m[1], t: i.title, i: (!sansPhoto(i) ? i.image : ''), k: surtitre(i, sc), h: attrsLien(i) } : null;
  }).filter(Boolean);
  const autresBloc = (t, titreBloc) => {
    const l = pastilles(t);
    return l ? `<section class="journal villes theme-voir-aussi" aria-label="${echapper(titreBloc)}"><div class="wrap">${tete(echapper(titreBloc))}<nav class="villes-pastilles" style="margin-bottom:0">${l}</nav></div></section>` : '';
  };

  const main = `
  <section class="page-bandeau">
    <div class="wrap">
      <nav class="theme-fil" aria-label="Fil d'Ariane"><a href="/index.html#accueil">Accueil</a> › <a href="/articles.html">Nos actus</a> › <span aria-current="page">${echapper(nom)}</span></nav>
      <span class="page-bandeau-eyebrow">${type === 'commune' ? 'Commune' : 'Rubrique'}</span>
      <h1>${echapper(h1)}</h1>
      <p class="page-bandeau-lead">${n} article${n > 1 ? 's' : ''} d'Ipsum Média ${type === 'commune' ? 'sur ' + echapper(nom) : 'dans cette rubrique'}, du plus récent au plus ancien.</p>
      <nav class="villes-pastilles page-bandeau-pastilles" aria-label="${type === 'commune' ? 'Autres communes' : 'Autres rubriques'}">${pastilles(type)}</nav>
    </div>
  </section>

  ${blocUne(dessus, sc)}

  ${suite.length ? `<section class="journal suite"><div class="wrap">${tete('Dernières actus')}<div class="suite-grille">${suite.map((i) => carte(i, sc)).join('')}</div></div></section>` : ''}

  <section class="journal plus-lus" id="plus-lus" hidden>
    <div class="wrap">${tete('Les plus lus', '<span class="plus-lus-aide">cette semaine</span>')}<ol class="plus-lus-liste" id="plus-lus-liste"></ol></div>
  </section>

  ${reste.length ? `<section class="journal theme-tout"><div class="wrap">${tete(type === 'commune' ? `Toutes les actus ${echapper(de(nom))}` : `Toute la rubrique ${echapper(nom)}`)}
    <div class="suite-grille" id="theme-grille" data-pas="${PAS_CARTES}">${reste.map((i) => carte(i, sc)).join('')}</div>
    <p class="feed-more" id="theme-plus" hidden><button type="button" class="btn btn-outline" id="theme-plus-btn"></button></p>
  </div></section>` : ''}

  ${type === 'commune' ? autresBloc('rubrique', 'Rubriques') : autresBloc('commune', 'Communes')}

  <script>
  (function () {
    // « Afficher plus » : tout est déjà dans la page (pour les moteurs de recherche), on n'en montre qu'une partie à la fois
    var grille = document.getElementById('theme-grille'), zone = document.getElementById('theme-plus'), bouton = document.getElementById('theme-plus-btn');
    if (grille && zone && bouton) {
      var pas = Number(grille.getAttribute('data-pas')) || 12, cartes = Array.prototype.slice.call(grille.children), vues = pas;
      function majCartes() {
        cartes.forEach(function (c, i) { c.hidden = i >= vues; });
        var restant = cartes.length - vues;
        zone.hidden = restant <= 0;
        bouton.textContent = 'Afficher plus (' + restant + ' restant' + (restant > 1 ? 's' : '') + ')';
      }
      bouton.addEventListener('click', function () { vues += pas; majCartes(); });
      majCartes();
    }
    // Les plus lus de la page : le classement de la semaine, limité aux articles de cette page
    var CFG = window.IPSUM_CONFIG || {}, bloc = document.getElementById('plus-lus'), liste = document.getElementById('plus-lus-liste');
    var ici = ${JSON.stringify(vitrine).replace(/</g, '\\u003c')};
    if (!bloc || !liste || !CFG.SUPABASE_URL || !ici.length) return;
    fetch(CFG.SUPABASE_URL + '/rest/v1/rpc/site_plus_lus', { method: 'POST', headers: { apikey: CFG.SUPABASE_CLE, Authorization: 'Bearer ' + CFG.SUPABASE_CLE, 'Content-Type': 'application/json' }, body: '{}' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (lignes) {
        var vues = Object.create(null);
        (Array.isArray(lignes) ? lignes : []).forEach(function (l) { if (l && l.slug) vues[l.slug] = Number(l.vues) || 0; });
        var classes = ici.filter(function (a) { return vues[a.s] > 0; }).sort(function (x, y) { return vues[y.s] - vues[x.s]; }).slice(0, 5);
        if (classes.length < 3) return;
        liste.innerHTML = classes.map(function (a, i) {
          var photo = i === 0 && a.i ? '<span class="pl-img"><img src="' + a.i + '" alt="" decoding="async" loading="lazy" onerror="this.parentNode.hidden=true"></span>' : '';
          return '<li class="pl-' + (i + 1) + '"><a' + a.h + '>' + photo + '<span class="pl-corps"><span class="rang">' + (i + 1) + '</span><span class="plus-lus-texte">' +
            (a.k ? '<span class="kicker">' + a.k + '</span>' : '') + '<span class="plus-lus-titre">' + a.t + '</span></span></span></a></li>';
        }).join('');
        bloc.hidden = false;
      }).catch(function () {});
  })();
  </script>`;

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

// « /commune/castres » ou « /.netlify/functions/theme/commune/castres » (les deux formes contiennent « commune/castres »).
// Le nom ne passe pas par un paramètre d'adresse : Netlify ne le remplace pas toujours dans une redirection.
function lireAdresse(event) {
  const q = (event && event.queryStringParameters) || {};
  if (TYPES[q.type] && /^[a-z0-9-]{1,80}$/i.test(String(q.slug || ''))) return { type: q.type, slug: String(q.slug).toLowerCase() };
  const seg = String((event && event.path) || '').split('/').filter(Boolean);
  const i = Math.max(seg.lastIndexOf('commune'), seg.lastIndexOf('rubrique'));
  if (i < 0 || !seg[i + 1]) return { type: '', slug: '' };
  return { type: seg[i], slug: decoderChemin(seg[i + 1]) };
}

// Un « % » mal formé dans l'adresse ne doit pas faire planter la fonction
function decoderChemin(t) {
  try { return decodeURIComponent(t).toLowerCase(); } catch (e) { return ''; }
}

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
