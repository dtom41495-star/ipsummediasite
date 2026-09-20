// Génère une page article complète à partir des flux RSS Substack (Tarn +
// Haute-Garonne). Appelée via la redirection /articles/:slug -> /.netlify/functions/article/:slug

const FLUX = [
  'https://ipsummedia.substack.com/feed',
  'https://ipsummediahautegaronne.substack.com/feed',
];

exports.handler = async function (event) {
  const parts = event.path.split('/').filter(Boolean);
  const slug = parts[parts.length - 1];

  if (!slug) {
    return { statusCode: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: 'Article manquant' };
  }

  try {
    let match = null;
    for (const url of FLUX) {
      const res = await fetch(url);
      if (!res.ok) continue;
      const xml = await res.text();
      const blocks = xml.split('<item>').slice(1);
      for (const block of blocks) {
        const itemXml = block.split('</item>')[0];
        const link = extractTag(itemXml, 'link');
        if (link && link.indexOf('/p/' + slug) !== -1) {
          match = itemXml;
          break;
        }
      }
      if (match) break;
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
    let content = cleanSubstackHtml(extractTag(match, 'content:encoded') || stripHtml(extractTag(match, 'description')));
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

// Supprime, avec tout leur contenu, les <div> dont l'attribut class contient
// `classe` (en suivant l'imbrication des <div>). Si l'HTML est mal formé, on
// laisse le reste tel quel plutôt que de risquer de couper l'article.
function removeDivBlocks(html, classe) {
  const ATTRS = '(?:[^>"\']|"[^"]*"|\'[^\']*\')*';
  const openRe = new RegExp('<div\\b[^>]*?\\bclass="[^"]*' + classe + '[^"]*"', 'gi');
  const tagEndRe = new RegExp(ATTRS + '>', 'y');
  const divRe = new RegExp('<(/?)div\\b' + ATTRS + '>', 'gi');
  let out = '';
  let pos = 0;
  let m;
  while ((m = openRe.exec(html)) !== null) {
    tagEndRe.lastIndex = m.index + m[0].length;
    if (!tagEndRe.test(html)) break;
    divRe.lastIndex = tagEndRe.lastIndex;
    let depth = 1;
    let end = -1;
    let t;
    while ((t = divRe.exec(html)) !== null) {
      depth += t[1] ? -1 : 1;
      if (depth === 0) { end = t.index + t[0].length; break; }
    }
    if (end === -1) break;
    out += html.slice(pos, m.index);
    pos = end;
    openRe.lastIndex = end;
  }
  return out + html.slice(pos);
}

// Retire du HTML Substack les éléments interactifs qui ne servent à rien
// (ou s'affichent mal) hors de Substack : le formulaire d'abonnement, qui
// n'est pas fonctionnel ici (la page propose son propre bloc newsletter), et
// les boutons "plein écran" / "restack" ajoutés sous chaque image. Repère aussi
// les photos portrait (hauteur > largeur) pour que le CSS puisse les plafonner.
function cleanSubstackHtml(html) {
  let out = removeDivBlocks(html, 'subscription-widget');
  out = removeDivBlocks(out, 'image-link-expand');
  return out
    .replace(/<form\b[\s\S]*?<\/form>/gi, '')
    .replace(/<button\b[\s\S]*?<\/button>/gi, '')
    .replace(/<img\b[^>]*>/gi, function (tag) {
      const w = /\swidth="(\d+)"/i.exec(tag);
      const h = /\sheight="(\d+)"/i.exec(tag);
      return w && h && Number(h[1]) > Number(w[1]) ? tag.replace(/^<img\b/i, '<img data-portrait') : tag;
    });
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

// Insère un bloc pub après le 2e paragraphe de l'article (ou en fin de
// contenu s'il y a moins de 2 paragraphes).
function insertInlineAd(html) {
  const adBlock = `
  <div class="ad-slot ad-slot-inline">
    <span class="ad-slot-label">Avec cette pub, Ipsum Média reste gratuit</span>
    <ins class="adsbygoogle"
         style="display:block"
         data-ad-client="ca-pub-7695287329907050"
         data-ad-slot="4713288084"
         data-ad-format="auto"
         data-full-width-responsive="true"></ins>
  </div>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>`;

  const re = /<\/p>/gi;
  let count = 0;
  let insertIndex = -1;
  let m;
  while ((m = re.exec(html)) !== null) {
    count++;
    if (count === 2) {
      insertIndex = m.index + m[0].length;
      break;
    }
  }
  if (insertIndex === -1) return html + adBlock;
  return html.slice(0, insertIndex) + adBlock + html.slice(insertIndex);
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

function pageShell(bodyHtml, headExtra, subscribeUrl) {
  const subUrl = subscribeUrl || 'https://ipsummedia.substack.com/subscribe';
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
  .article-meta-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
  .article-meta-row .article-meta { min-width: 0; margin: 0; }
  /* Bouton "Sources préférées" de Google (lien simple : aucun script Google n'est chargé) */
  .article-google { margin-bottom: 28px; }
  .google-source-btn { display: inline-flex; align-items: center; gap: 10px; padding: 9px 18px 9px 13px; background: var(--white); border: 1px solid var(--border); border-radius: 100px; color: var(--ink); font-size: 0.9rem; font-weight: 600; line-height: 1.3; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
  .google-source-btn:hover { border-color: var(--orange); box-shadow: var(--shadow); }
  .google-source-btn:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
  .google-source-btn svg { width: 20px; height: 20px; flex: none; }
  /* Images : Substack fixe width et height d'origine sur chaque <img>. Sans
     height:auto, réduire la largeur étirait les photos (surtout les portraits).
     Les photos portrait (data-portrait, posé par cleanSubstackHtml) sont en
     plus plafonnées en largeur pour ne pas occuper tout l'écran en hauteur. */
  .article-cover { display: block; width: auto; height: auto; max-width: 100%; max-height: 75vh; margin: 0 auto 32px; border-radius: var(--radius); }
  .article-body { font-size: 1.05rem; line-height: 1.75; color: var(--ink); }
  .article-body p { margin-bottom: 1.2em; }
  .article-body h2, .article-body h3 { margin: 1.6em 0 0.6em; font-family: 'Bitter', serif; }
  .article-body picture { display: block; }
  .article-body img { display: block; max-width: 100%; height: auto; margin: 1.2em auto; border-radius: 10px; }
  .article-body img[data-portrait] { max-width: min(100%, 420px); }
  .article-body figcaption { margin-top: -0.4em; margin-bottom: 1.4em; color: var(--ink-soft); font-size: 0.85rem; line-height: 1.5; text-align: center; }
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
  /* Bouton "Partager" : <details> pour que le menu s'ouvre même sans JS */
  .article-share { position: relative; display: inline-block; flex: none; }
  .article-share summary { display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px; list-style: none; background: var(--white); border: 1px solid var(--border); border-radius: 100px; color: var(--ink); font-size: 0.9rem; font-weight: 600; cursor: pointer; user-select: none; transition: border-color 0.15s ease, color 0.15s ease; }
  .article-share summary::-webkit-details-marker { display: none; }
  .article-share summary:hover, .article-share[open] summary { border-color: var(--orange); color: var(--orange); }
  .article-share summary:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
  .article-share summary svg { width: 18px; height: 18px; flex: none; }
  .share-menu { position: absolute; top: calc(100% + 8px); right: 0; z-index: 20; display: flex; flex-direction: column; min-width: 230px; padding: 8px; background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 14px 34px rgba(32, 26, 23, 0.16); }
  .share-menu a, .share-menu button { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; background: none; border: 0; border-radius: 10px; color: var(--ink); font: inherit; font-size: 0.95rem; text-align: left; cursor: pointer; }
  .share-menu a:hover, .share-menu button:hover, .share-menu a:focus-visible, .share-menu button:focus-visible { background: var(--orange-light); outline: none; }
  .share-menu button[hidden] { display: none; }
  .share-menu svg { width: 18px; height: 18px; flex: none; color: var(--ink-soft); }
  .article-share-end { display: flex; flex-direction: column; align-items: center; gap: 12px; margin-top: 40px; text-align: center; }
  .article-share-end p { margin: 0; color: var(--ink-soft); }
  .article-share-end .share-menu { right: auto; left: 50%; transform: translateX(-50%); }
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
        <li><a href="/nos-valeurs.html">Nos valeurs</a></li>
        <li><a href="/articles.html">Nos actus</a></li>
        <li><a href="/nous-rejoindre.html">Nous rejoindre</a></li>
        <li><a href="/index.html#contact">Contact</a></li>
      </ul>
    </nav>
    <div class="header-cta">
      <a class="btn btn-primary" href="${subUrl}" target="_blank" rel="noopener"><span class="long">Je m'inscris</span></a>
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
  <div class="wrap footer-legal">
    <p>Ipsum Média est une association loi 1901 immatriculée au Registre National des Associations sous le n°W812010251. SIRET 100 238 435 00018, code APE 58.13Y (Édition de revues et périodiques). Nom de domaine : Infomaniak Network SA (infomaniak.com). Hébergement du site : Netlify, Inc. (netlify.com).</p>
  </div>
</footer>
<script>
  document.getElementById('year').textContent = new Date().getFullYear();
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('main-nav');
  toggle.addEventListener('click', () => nav.classList.toggle('open'));
</script>

<script src="/assets/tarteaucitron/tarteaucitron.min.js"></script>
<script>
  tarteaucitron.init({
    privacyUrl: '',
    orientation: 'middle',
    showAlertSmall: false,
    cookieslist: true,
    acceptAllCta: true,
    denyAllCta: true,
    highPrivacy: true,
    handleBrowserDNTRequest: false,
    removeCredit: true,
    moreInfoLink: false,
    useExternalCss: false,
    readmoreLink: ''
  });

  tarteaucitron.user.gtagUa = 'G-033HT830CF';
  (tarteaucitron.job = tarteaucitron.job || []).push('gtag');

  tarteaucitron.user.adsensecapub = 'ca-pub-7695287329907050';
  (tarteaucitron.job = tarteaucitron.job || []).push('adsenseauto');

  // "Sources préférées" de Google : le script officiel (bouton qui passe à
  // "Ajoutée" et confirme sur la page) n'est chargé qu'avec le consentement.
  // Sans lui, le lien simple affiché par défaut reste en place.
  // defaultState:false évite de redemander leur avis aux visiteurs qui ont
  // déjà répondu au bandeau : ils gardent le lien simple.
  tarteaucitron.services.googlesources = {
    key: 'googlesources',
    type: 'api',
    name: 'Google (Sources préférées)',
    needConsent: true,
    defaultState: false,
    cookies: [],
    uri: 'https://developers.google.com/search/docs/appearance/preferred-sources',
    js: function () {
      'use strict';
      var officiel = document.getElementById('google-sources-official');
      var lien = document.getElementById('google-sources-fallback');
      if (!officiel) { return; }
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://news.google.com/swg/js/v1/publisher.js';
      s.onload = function () {
        // Le script de Google transforme la div en bouton ; s'il n'y arrive pas, le lien simple reste
        if (officiel.getAttribute('data-initialized') === 'true') {
          officiel.style.display = '';
          if (lien) { lien.style.display = 'none'; }
        }
      };
      document.head.appendChild(s);
    }
  };
  (tarteaucitron.job = tarteaucitron.job || []).push('googlesources');
</script>

<script>
  (function insertTarteaucitronLogo(attempts) {
    var target = document.getElementById('tarteaucitronDisclaimerAlert');
    if (target && !document.getElementById('tarteaucitron-logo')) {
      var img = document.createElement('img');
      img.src = '/assets/logo.png';
      img.alt = 'Ipsum Média';
      img.id = 'tarteaucitron-logo';
      target.parentNode.insertBefore(img, target);
      return;
    }
    if ((attempts || 0) < 50) setTimeout(function() { insertTarteaucitronLogo((attempts || 0) + 1); }, 200);
  })();
</script>
</body>
</html>`;
}

// Détermine la rédaction (et son Substack) à partir du lien de l'article
// lui-même — évite de proposer la newsletter du Tarn sous un article
// Haute-Garonne, et inversement.
function redacDepuisLien(lien) {
  if (lien && lien.indexOf('hautegaronne') !== -1) {
    return { nom: 'Haute-Garonne', subscribeUrl: 'https://ipsummediahautegaronne.substack.com/subscribe', archiveUrl: 'https://ipsummediahautegaronne.substack.com/archive' };
  }
  return { nom: 'Tarn', subscribeUrl: 'https://ipsummedia.substack.com/subscribe', archiveUrl: 'https://ipsummedia.substack.com/archive' };
}

const ICONS = {
  google: '<svg viewBox="0 0 256 262" aria-hidden="true"><path d="M255.878,133.451 C255.878,122.717 255.007,114.884 253.122,106.761 L130.55,106.761 L130.55,155.209 L202.497,155.209 C201.047,167.249 193.214,185.381 175.807,197.565 L175.563,199.187 L214.318,229.21 L217.003,229.478 C241.662,206.704 255.878,173.196 255.878,133.451" fill="#4285F4"/><path d="M130.55,261.1 C165.798,261.1 195.389,249.495 217.003,229.478 L175.807,197.565 C164.783,205.253 149.987,210.62 130.55,210.62 C96.027,210.62 66.726,187.847 56.281,156.37 L54.75,156.5 L14.452,187.687 L13.925,189.152 C35.393,231.798 79.49,261.1 130.55,261.1" fill="#34A853"/><path d="M56.281,156.37 C53.525,148.247 51.93,139.543 51.93,130.55 C51.93,121.556 53.525,112.853 56.136,104.73 L56.063,103 L15.26,71.312 L13.925,71.947 C5.077,89.644 0,109.517 0,130.55 C0,151.583 5.077,171.455 13.925,189.152 L56.281,156.37" fill="#FBBC05"/><path d="M130.55,50.479 C155.064,50.479 171.6,61.068 181.029,69.917 L217.873,33.943 C195.245,12.91 165.798,0 130.55,0 C79.49,0 35.393,29.301 13.925,71.947 L56.136,104.73 C66.726,73.253 96.027,50.479 130.55,50.479" fill="#EB4335"/></svg>',
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-4M8.6 13.5l6.8 4"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
};

// Bouton "Partager". On partage le lien Substack de l'article (permanent) et
// non l'adresse du site, qui ne garde que les 20 derniers articles du flux.
// Sur téléphone, le menu natif du système est utilisé ; ailleurs, un menu
// avec les réseaux courants et "Copier le lien" (voir le script plus bas).
function renderShare(a) {
  const enc = encodeURIComponent;
  const options = [
    ['WhatsApp', ICONS.whatsapp, 'https://wa.me/?text=' + enc(a.title + ' ' + a.link)],
    ['Facebook', ICONS.facebook, 'https://www.facebook.com/sharer/sharer.php?u=' + enc(a.link)],
    ['X', ICONS.x, 'https://x.com/intent/post?text=' + enc(a.title) + '&url=' + enc(a.link)],
    ['LinkedIn', ICONS.linkedin, 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(a.link)],
    ['E-mail', ICONS.mail, 'mailto:?subject=' + enc(a.title) + '&body=' + enc(a.title + '\n' + a.link)],
  ];
  const links = options.map(function (o) {
    const target = o[2].indexOf('mailto:') === 0 ? '' : ' target="_blank" rel="noopener"';
    return '<a href="' + escapeHtml(o[2]) + '"' + target + '>' + o[1] + '<span>' + o[0] + '</span></a>';
  }).join('');
  return `<details class="article-share" data-url="${escapeHtml(a.link)}" data-title="${escapeHtml(a.title)}">
        <summary>${ICONS.share}<span>Partager</span></summary>
        <div class="share-menu">${links}<button type="button" class="share-copy" hidden>${ICONS.link}<span>Copier le lien</span></button></div>
      </details>`;
}

function renderArticle(a) {
  const titleSafe = escapeHtml(a.title);
  const ownUrl = 'https://ipsummedia.fr/articles/' + encodeURIComponent(a.slug);
  const redac = redacDepuisLien(a.link);
  const share = renderShare(a);
  const body = `
  <div class="article-page">
    <a class="btn btn-outline article-back" href="/articles.html">&larr; Retour aux actus</a>
    <span class="eyebrow">Article</span>
    <h1>${titleSafe}</h1>
    <div class="article-meta-row">
      <p class="article-meta">Par ${escapeHtml(a.author)} · ${escapeHtml(a.dateFr)}</p>
      ${share}
    </div>
    <div class="article-google">
      <a class="google-source-btn" id="google-sources-fallback" href="https://www.google.com/preferences/source?q=ipsummedia.fr&amp;hl=fr" target="_blank" rel="noopener" title="Ajouter Ipsum Média aux Sources préférées de Google, pour voir plus souvent nos articles dans « À la une »">
        ${ICONS.google}<span>Ajouter aux Sources préférées</span>
      </a>
      <div id="google-sources-official" google-add-preferred-source-btn data-lang="fr" data-theme="light" style="display:none"></div>
    </div>
    ${a.image ? `<img class="article-cover" src="${escapeHtml(a.image)}" alt="">` : ''}
    <div class="article-body">${insertInlineAd(a.content)}</div>
    <div class="article-share-end">
      <p>Cet article vous a plu ? Partagez-le.</p>
      ${share}
    </div>
    <div class="article-subscribe">
      <h3>Envie de ne rater aucun article ?</h3>
      <p>Recevez l'actu ${redac.nom === 'Tarn' ? 'du Tarn' : "d'Haute-Garonne"} chaque jeudi directement par email.</p>
      <a class="btn btn-primary" href="${redac.subscribeUrl}" target="_blank" rel="noopener">Je m'inscris à la newsletter</a>
    </div>
    <p style="text-align:center; margin-top:20px;"><a href="${redac.archiveUrl}" target="_blank" rel="noopener" style="color:var(--ink-soft); font-size:0.85rem;">Voir tous nos articles (archives complètes sur Substack) →</a></p>
  </div>
  <script>
  (function () {
    var boxes = document.querySelectorAll('.article-share');
    if (!boxes.length) return;
    // Menu natif du système seulement sur écran tactile (téléphone, tablette)
    var natif = !!navigator.share && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    boxes.forEach(function (box) {
      var summary = box.querySelector('summary');
      var url = box.getAttribute('data-url');
      var title = box.getAttribute('data-title');

      summary.addEventListener('click', function (e) {
        if (!natif) return;
        e.preventDefault();
        navigator.share({ title: title, text: title, url: url }).catch(function (err) {
          if (err && err.name !== 'AbortError') box.open = true;
        });
      });

      // Le menu se referme quand on choisit un réseau
      box.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { setTimeout(function () { box.open = false; }, 0); });
      });

      var copy = box.querySelector('.share-copy');
      if (!copy) return;
      copy.hidden = false;
      var label = copy.querySelector('span');
      function copierAncien() {
        var t = document.createElement('textarea');
        t.value = url;
        t.style.position = 'fixed';
        t.style.opacity = '0';
        document.body.appendChild(t);
        t.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (err) {}
        document.body.removeChild(t);
        return ok;
      }
      function retour(ok) {
        label.textContent = ok ? 'Lien copié !' : 'Copie impossible';
        setTimeout(function () {
          label.textContent = 'Copier le lien';
          if (ok) box.open = false;
        }, 1400);
      }
      copy.addEventListener('click', function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () { retour(true); }, function () { retour(copierAncien()); });
        } else {
          retour(copierAncien());
        }
      });
    });

    document.addEventListener('click', function (e) {
      boxes.forEach(function (b) { if (b.open && !b.contains(e.target)) b.open = false; });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      boxes.forEach(function (b) { if (b.open) { b.open = false; b.querySelector('summary').focus(); } });
    });
  })();
  </script>`;
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
  return pageShell(body, head, redac.subscribeUrl);
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
