// Plan du site (sitemap.xml) fabriqué à chaque demande : les pages fixes, plus TOUS les articles du site
// (publiés depuis Compo, et anciens articles de Substack importés), les plus récents d'abord.
// Les copies d'anciens articles Substack gardent une balise canonical vers Substack : Google les rangera comme
// « page alternative » dans la Search Console, c'est normal. Pour ne lister que les articles dont le site est
// l'original, filtrer sur `!p.canonical_url` ci-dessous.
// Si la base ne répond pas, le plan contient au moins les pages fixes (comme l'ancien sitemap.xml).

const A = require('../../lib/agenda');
const compo = require('../../lib/compo');
const { chargerItems, regrouper, MIN_INDEX } = require('../../lib/themes');
const { indexEquipe, articlesDe } = require('../../lib/auteurs');
const { decoder } = require('../../lib/page');

const SITE = 'https://ipsummedia.fr';
const PAGES_FIXES = [
  ['/', 'weekly', '1.0'],
  ['/a-propos.html', 'monthly', '0.9'],
  ['/charte-ia.html', 'monthly', '0.6'],
  ['/articles.html', 'daily', '0.9'],
];

function isoJour(d) {
  const t = new Date(d);
  return isNaN(t.getTime()) ? '' : t.toISOString().slice(0, 10);
}

function fabriquerSitemap(publications, themes, auteurs, agenda) {
  const urls = PAGES_FIXES.map(([chemin, freq, prio]) =>
    `  <url>\n    <loc>${SITE}${chemin}</loc>\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`);
  (publications || [])
    .filter((p) => p && /^[a-z0-9-]{1,200}$/.test(p.slug || ''))
    .sort((x, y) => new Date(y.publie_le) - new Date(x.publie_le))
    .forEach((p) => {
      const jour = isoJour(p.maj_le || p.publie_le);
      urls.push(`  <url>\n    <loc>${SITE}/articles/${p.slug}</loc>\n${jour ? `    <lastmod>${jour}</lastmod>\n` : ''}  </url>`);
    });
  // Pages de communes et de rubriques : seulement celles qui ont assez d'articles pour être proposées à Google
  if (themes) {
    ['commune', 'rubrique'].forEach((type) => {
      Object.values(themes[type + 's'] || {})
        .filter((g) => g.items.length >= MIN_INDEX)
        .sort((a, b) => b.items.length - a.items.length || (a.slug < b.slug ? -1 : 1))
        .forEach((g) => {
          const jour = isoJour(g.items[0] && g.items[0].pubDate);
          urls.push(`  <url>\n    <loc>${SITE}/${type}/${g.slug}</loc>\n${jour ? `    <lastmod>${jour}</lastmod>\n` : ''}    <changefreq>weekly</changefreq>\n  </url>`);
        });
    });
  }
  // Pages de journalistes : seulement celles qui ont au moins un article
  (auteurs || []).forEach((a) => {
    const jour = isoJour(a.articles[0] && a.articles[0].pubDate);
    urls.push(`  <url>\n    <loc>${SITE}/auteurs/${a.membre.slug}</loc>\n${jour ? `    <lastmod>${jour}</lastmod>\n` : ''}    <changefreq>weekly</changefreq>\n  </url>`);
  });
  // Agenda public : les deux pages d'agenda, puis chaque événement à venir
  if (agenda) {
    ['tarn', 'haute-garonne'].forEach((e) => urls.push(`  <url>\n    <loc>${SITE}/agenda/${e}</loc>\n    <changefreq>daily</changefreq>\n  </url>`));
    ['tarn', 'haute-garonne'].forEach((ed) => [...A.villes(agenda, ed).values()].forEach((v) => urls.push(`  <url>\n    <loc>${SITE}${A.cheminVille(ed, v.slug)}</loc>\n    <changefreq>daily</changefreq>\n  </url>`)));
    agenda.filter((e) => e && /^[a-z0-9-]{1,120}$/.test(e.slug || '')).forEach((e) => urls.push(`  <url>\n    <loc>${SITE}/evenement/${e.slug}</loc>\n  </url>`));
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n';
}

// Plan du site « actualités » (Google Actualités) : seulement les articles publiés depuis moins de 48 h, avec leur date de publication et
// leur titre. Régénéré à chaque passage horaire ; vide (mais valide) quand rien n'a été publié ces deux derniers jours.
function fabriquerSitemapActus(publications, maintenant) {
  const xml = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const t0 = (maintenant || Date.now()) - 48 * 3600 * 1000;
  const recents = (publications || [])
    .filter((p) => p && /^[a-z0-9-]{1,200}$/.test(p.slug || '') && !p.canonical_url && p.titre && new Date(p.publie_le).getTime() >= t0 && new Date(p.publie_le).getTime() <= (maintenant || Date.now()) + 3600 * 1000)
    .sort((x, y) => new Date(y.publie_le) - new Date(x.publie_le))
    .slice(0, 1000);
  const urls = recents.map((p) => `  <url>\n    <loc>${SITE}/articles/${p.slug}</loc>\n    <news:news>\n      <news:publication>\n        <news:name>Ipsum Média</news:name>\n        <news:language>fr</news:language>\n      </news:publication>\n      <news:publication_date>${new Date(p.publie_le).toISOString()}</news:publication_date>\n      <news:title>${xml(p.titre)}</news:title>\n    </news:news>\n  </url>`);
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' + urls.join('\n') + (urls.length ? '\n' : '') + '</urlset>\n';
}

async function sitemap() {
  const [publications, items, lignesEquipe, agenda] = await Promise.all([compo.listePublications(5000), chargerItems(6000), compo.equipe(4000), compo.agenda(4000)]);
  const auteurs = [...indexEquipe(lignesEquipe).parSlug.values()]
    .map((membre) => ({ membre, articles: articlesDe(membre, items, decoder) })).filter((a) => a.articles.length > 0);
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': publications ? 'public, max-age=3600' : 'public, max-age=300',
    },
    body: fabriquerSitemap(publications, regrouper(items), auteurs, agenda),
  };
}

exports.handler = sitemap;
exports.fabriquerSitemap = fabriquerSitemap;
exports.fabriquerSitemapActus = fabriquerSitemapActus;
