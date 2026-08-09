// Génère une page article complète à partir du flux RSS Substack.
// Appelée via la redirection /articles/:slug -> /.netlify/functions/article/:slug

exports.handler = async function (event) {
  const parts = event.path.split('/').filter(Boolean);
  const slug = parts[parts.length - 1];

  if (!slug) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: 'Article manquant' };
  }

  try {
    const res = await fetch('https://ipsummedia.substack.com/feed');
    if (!res.ok) throw new Error('Flux Substack inaccessible (' + res.status + ')');
    const xml = await res.text();

    const blocks = xml.split('<item>').slice(1);
    let match = null;
    for (const block of blocks) {
      const itemXml = block.split('</item>')[0];
      const link = extractTag(itemXml, 'link');
      if (link && link.indexOf('/p/' + slug) !== -1) {
        match = itemXml;
        break;
      }
    }

    if (!match) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: renderNotFound(),
      };
    }

    const title = extractTag(match, 'title');
    const link = extractTag(match, 'link');
    const pubDate = extractTag(match, 'pubDate');
    const author = extractTag(match, 'dc:creator') || 'Ipsum Média';
    let content = extractTag(match, 'content:encoded') || stripHtml(extractTag(match, 'description'));
    let image = extractAttr(match, 'enclosure', 'url');

    if (image) {
      content = removeDuplicateImage(content, image);
    }

    const dateFr = formatDateFr(pubDate);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=900' },
      body: renderArticle({ title, link, dateFr, author, content, image, slug }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: 'Erreur : ' + escapeHtml(String(e)),
    };
  }
};

function extractTag(xml, tag) {
  const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i');
  const m = xml.match(re);
  if (!m) return '';
  let val = m[1].trim();
  const cdata = val.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (cdata) val = cdata[1];
  return val.trim();
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp('<' + tag + '[^>]*\\b' + attr + '="([^"]*)"', 'i');
  const m = xml.match(re);
  return m ? m[1] : null;
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Retire du corps de l'article les <img> qui correspondent à l'image de
// couverture déjà affichée en haut de page (Substack la réinsère parfois
// dans le contenu, souvent en fin d'article dans le bloc "s'abonner").
function removeDuplicateImage(html, imageUrl) {
  var idMatch = imageUrl.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  var needle = idMatch ? idMatch[1] : imageUrl;
  return html
    .replace(/<img\b[^>]*>/gi, function (tag) {
      return tag.indexOf(needle) !== -1 ? '' : tag;
    })
    .replace(/<a\b[^>]*>\s*<\/a>/gi, '')
    .replace(/<(figure|div)\b[^>]*>\s*<\/\1>/gi, '');
}

function escapeHtml(s) {
  return (s || '').replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function formatDateFr(pubDate) {
  try {
    return new Date(pubDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return '';
  }
}

function pageShell(bodyHtml, headExtra) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${headExtra}
<link rel="icon" type="image/png" href="/assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bitter:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
<style>
  .article-page { max-width: 720px; margin: 0 auto; padding: 60px 24px 100px; }
  .article-page .eyebrow { display:block; margin-bottom: 14px; }
  .article-page h1 { font-size: clamp(1.8rem, 4vw, 2.6rem); margin-bottom: 14px; }
  .article-meta { color: var(--ink-soft); font-size: 0.9rem; margin-bottom: 28px; }
  .article-cover { width: 100%; border-radius: var(--radius); margin-bottom: 32px; }
  .article-body { font-size: 1.05rem; line-height: 1.75; color: var(--ink); }
  .article-body p { margin-bottom: 1.2em; }
  .article-body h2, .article-body h3 { margin: 1.6em 0 0.6em; font-family: 'Bitter', serif; }
  .article-body img { max-width: 100%; border-radius: 10px; margin: 1.2em 0; }
  .article-body a { color: var(--orange); text-decoration: underline; }
  .article-body blockquote { border-left: 3px solid var(--orange); padding-left: 16px; color: var(--ink-soft); margin: 1.2em 0; }
  .article-back { margin-bottom: 32px; }
  .article-subscribe {
    margin-top: 48px;
    padding: 28px;
    background: var(--orange-light);
    border-radius: var(--radius);
    text-align: center;
  }
  .article-subscribe h3 { margin-bottom: 8px; }
  .article-subscribe p { color: var(--ink-soft); margin-bottom: 18px; }
</style>
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a href="/index.html#accueil" class="brand">
      <img src="/assets/logo.png" alt="Ipsum Média">
    </a>
    <nav class="main-nav" id="main-nav">
      <ul>
        <li><a href="/index.html#accueil">Accueil</a></li>
        <li><a href="/a-propos.html">À propos</a></li>
        <li><a href="/a-propos.html#equipe">Équipe</a></li>
        <li><a href="/articles.html">Nos actus</a></li>
        <li><a href="/nous-rejoindre.html">Nous rejoindre</a></li>
        <li><a href="/index.html#contact">Contact</a></li>
      </ul>
    </nav>
    <div class="header-cta">
      <a class="btn btn-primary" href="https://ipsummedia.substack.com/subscribe" target="_blank" rel="noopener"><span class="long">Je m'inscris</span></a>
      <button class="nav-toggle" id="nav-toggle" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>
<main>
${bodyHtml}
</main>
<footer class="site-footer">
  <div class="wrap">
    <span>© <span id="year"></span> Ipsum Média, association loi 1901</span>
    <span><a href="mailto:contact@ipsummedia.fr">contact@ipsummedia.fr</a></span>
  </div>
</footer>
<script>
  document.getElementById('year').textContent = new Date().getFullYear();
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('main-nav');
  toggle.addEventListener('click', () => nav.classList.toggle('open'));
</script>
</body>
</html>`;
}

function renderArticle(a) {
  const titleSafe = escapeHtml(a.title);
  const ownUrl = 'https://www.ipsummedia.fr/articles/' + encodeURIComponent(a.slug);
  const body = `
  <div class="article-page">
    <a class="btn btn-outline article-back" href="/articles.html">&larr; Retour aux actus</a>
    <span class="eyebrow">Article</span>
    <h1>${titleSafe}</h1>
    <p class="article-meta">Par ${escapeHtml(a.author)} · ${escapeHtml(a.dateFr)}</p>
    ${a.image ? `<img class="article-cover" src="${escapeHtml(a.image)}" alt="">` : ''}
    <div class="article-body">${a.content}</div>
    <div class="article-subscribe">
      <h3>Envie de ne rater aucun article ?</h3>
      <p>Recevez l'actu du Tarn chaque jeudi directement par email.</p>
      <a class="btn btn-primary" href="https://ipsummedia.substack.com/subscribe" target="_blank" rel="noopener">Je m'inscris à la newsletter</a>
    </div>
  </div>`;
  const descSafe = escapeHtml(stripHtml(a.content).slice(0, 160));
  const head = `<title>${titleSafe} — Ipsum Média</title>
<meta name="description" content="${descSafe}">
<link rel="canonical" href="${escapeHtml(ownUrl)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${titleSafe}">
<meta property="og:description" content="${descSafe}">
<meta property="og:url" content="${escapeHtml(ownUrl)}">
<meta property="og:site_name" content="Ipsum Média">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titleSafe}">
<meta name="twitter:description" content="${descSafe}">
${a.image ? `<meta property="og:image" content="${escapeHtml(a.image)}">
<meta name="twitter:image" content="${escapeHtml(a.image)}">` : ''}`;
  return pageShell(body, head);
}

function renderNotFound() {
  const body = `
  <div class="article-page" style="text-align:center;">
    <span class="eyebrow">Article</span>
    <h1>Article introuvable</h1>
    <p class="article-meta">Cet article n'existe plus ou a été déplacé.</p>
    <a class="btn btn-primary" href="/articles.html">Voir nos derniers articles</a>
  </div>`;
  return pageShell(body, '<title>Article introuvable — Ipsum Média</title>');
}
