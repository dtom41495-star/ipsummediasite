// Plan du site (sitemap.xml) fabriqué à chaque demande : les pages fixes, plus TOUS les articles du site
// (publiés depuis Compo, et anciens articles de Substack importés), les plus récents d'abord.
// Les copies d'anciens articles Substack gardent une balise canonical vers Substack : Google les rangera comme
// « page alternative » dans la Search Console, c'est normal. Pour ne lister que les articles dont le site est
// l'original, filtrer sur `!p.canonical_url` ci-dessous.
// Si la base ne répond pas, le plan contient au moins les pages fixes (comme l'ancien sitemap.xml).

const compo = require('../../lib/compo');
const { chargerItems, regrouper, MIN_INDEX } = require('../../lib/themes');

const SITE = 'https://ipsummedia.fr';
const PAGES_FIXES = [
  ['/', 'weekly', '1.0'],
  ['/a-propos.html', 'monthly', '0.9'],
  ['/nos-valeurs.html', 'monthly', '0.8'],
  ['/charte-ia.html', 'monthly', '0.6'],
  ['/articles.html', 'daily', '0.9'],
  ['/nous-rejoindre.html', 'monthly', '0.8'],
];

function isoJour(d) {
  const t = new Date(d);
  return isNaN(t.getTime()) ? '' : t.toISOString().slice(0, 10);
}

function fabriquerSitemap(publications, themes) {
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
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n';
}

async function sitemap() {
  const [publications, items] = await Promise.all([compo.listePublications(5000), chargerItems(6000)]);
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': publications ? 'public, max-age=3600' : 'public, max-age=300',
    },
    body: fabriquerSitemap(publications, regrouper(items)),
  };
}

exports.handler = sitemap;
exports.fabriquerSitemap = fabriquerSitemap;
