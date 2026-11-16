// Page d'un·e journaliste (/auteurs/lola-schwal) : ses articles, sa rédaction, des données structurées « profil ».
// Seulement pour les membres de l'équipe publique (voir lib/auteurs.js). Appelée par la redirection /auteurs/* de netlify.toml.

const compo = require('../../lib/compo');
const { SITE, chargerItems } = require('../../lib/themes');
const { echapper, decoder, enveloppe, reponseIndisponible } = require('../../lib/page');
const { indexEquipe, articlesDe } = require('../../lib/auteurs');
const { carte } = require('./articles-liste');

const MAX_CARTES = 100;

exports.handler = async function (event) {
  const slug = lireNom(event);
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return introuvable();

  const [lignes, items] = await Promise.all([compo.equipe(4000), chargerItems()]);
  if (!lignes) return reponseIndisponible();   // la base ne répond pas : pas un 404
  const membre = indexEquipe(lignes).parSlug.get(slug);
  if (!membre) return introuvable();

  const articles = articlesDe(membre, items, decoder);
  const n = articles.length;
  const url = `${SITE}/auteurs/${slug}`;
  const titre = `${membre.nom} : articles et reportages | Ipsum Média`;
  const titresRecents = articles.slice(0, 3).map((i) => decoder(i.title)).join(' · ');
  const description = coupe(n
    ? `${n} article${n > 1 ? 's' : ''} de ${membre.nom} sur Ipsum Média : ${titresRecents}.`
    : `${membre.nom}, ${membre.fonction ? membre.fonction.toLowerCase() + ' et ' : ''}journaliste à Ipsum Média.`, 158);
  const redactions = membre.redactions.map(compo.libelleRedaction);

  const main = `
  <section class="hero" style="min-height:auto; padding: 70px 0 40px; background: var(--cream);">
    <div class="wrap" style="text-align:center; margin:0 auto;">
      <span class="eyebrow" style="color:var(--orange);">${echapper(membre.fonction ? membre.fonction + ' · journaliste' : 'Journaliste')}</span>
      <h1 style="color:var(--ink);">${echapper(membre.nom)}</h1>
      ${redactions.length ? `<p class="equipe-redactions" style="justify-content:center; margin:10px 0;">${redactions.map((r) => `<span class="feed-tag">${echapper(r)}</span>`).join('')}</p>` : ''}
      <p class="lead" style="color:var(--ink-soft); margin:0 auto;">${n ? `${n} article${n > 1 ? 's' : ''} sur Ipsum Média, du plus récent au plus ancien.` : 'Pas encore d\'article publié sur le site.'}</p>
    </div>
  </section>

  <section class="articles-list">
    <div class="wrap">
      <nav class="theme-fil" aria-label="Fil d'Ariane" style="font-size:.9rem; margin-bottom:18px;"><a href="/index.html#accueil">Accueil</a> › <a href="/a-propos.html#journalistes">Nos journalistes</a> › <span aria-current="page">${echapper(membre.nom)}</span></nav>
      ${n ? `<div class="feed-grid">${articles.slice(0, MAX_CARTES).map(carte).join('')}</div>` : ''}
      <p style="margin-top:28px;"><a class="btn btn-outline" href="/a-propos.html#journalistes">Toute l'équipe</a> <a class="btn btn-outline" href="/articles.html">Tous nos articles</a></p>
    </div>
  </section>`;

  const liens = articles.filter((i) => i.surLeSite !== false).slice(0, MAX_CARTES)
    .map((i) => (i.link || '').match(/\/(?:p|articles)\/([^/?#]+)/)).filter(Boolean).map((m) => `${SITE}/articles/${m[1]}`);
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage', '@id': url + '#page', url, name: membre.nom, inLanguage: 'fr-FR', isPartOf: { '@id': SITE + '/#site' },
        mainEntity: {
          '@type': 'Person', '@id': url + '#personne', name: membre.nom, url, jobTitle: membre.fonction || 'Journaliste',
          worksFor: { '@type': 'NewsMediaOrganization', name: 'Ipsum Média', url: SITE + '/' },
        },
      },
      ...(liens.length ? [{ '@type': 'ItemList', numberOfItems: n, itemListElement: liens.map((u, i) => ({ '@type': 'ListItem', position: i + 1, url: u })) }] : []),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Nos journalistes', item: SITE + '/a-propos.html#journalistes' },
          { '@type': 'ListItem', position: 3, name: membre.nom, item: url },
        ],
      },
    ],
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'Netlify-CDN-Cache-Control': 'public, max-age=300, stale-while-revalidate=600, durable' },
    body: enveloppe({ titre, description, canonical: url, robots: n ? 'index, follow' : 'noindex, follow', jsonld, main }),
  };
};

// « /auteurs/lola-schwal » ou « /.netlify/functions/auteur/lola-schwal » : dernier morceau de l'adresse (pas de paramètre d'adresse,
// que Netlify ne remplace pas toujours dans une redirection ; le paramètre ?slug= reste accepté)
function lireNom(event) {
  const q = (event && event.queryStringParameters) || {};
  if (/^[a-z0-9-]{1,100}$/i.test(String(q.slug || ''))) return String(q.slug).toLowerCase();
  const seg = String((event && event.path) || '').split('/').filter(Boolean);
  const dernier = seg[seg.length - 1];
  return dernier && dernier !== 'auteur' && dernier !== 'auteurs' ? decoderChemin(dernier) : '';
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
      <span class="eyebrow" style="color:var(--orange);">La rédaction</span>
      <h1 style="color:var(--ink);">Page introuvable</h1>
      <p class="lead" style="color:var(--ink-soft); margin:0 auto;">Cette page n'existe pas, ou la personne ne figure plus sur le site.</p>
      <p style="margin-top:24px;"><a class="btn btn-primary" href="/a-propos.html#journalistes">Voir toute l'équipe</a></p>
    </div>
  </section>`;
  return {
    statusCode: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
    body: enveloppe({ titre: 'Page introuvable | Ipsum Média', description: '', robots: 'noindex', main }),
  };
}
