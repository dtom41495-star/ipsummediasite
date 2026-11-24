// Morceaux de page partagés par « Nos actus », les pages de commune et de rubrique (ceux de l'accueil, écrits en HTML côté serveur).
// Les champs des articles (titre, description, auteur…) viennent déjà échappés de substack-feed.

function formatDate(iso) {
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }); } catch (e) { return ''; }
}

// Les articles récents ont leur page sur le site ; les plus anciens renvoient vers Substack
function lienItem(item) {
  const m = item.link && item.link.match(/\/(?:p|articles)\/([^/?#]+)/);
  if (!m || item.surLeSite === false) return { href: item.link || '#', externe: true };
  return { href: '/articles/' + m[1], externe: false };
}
function attrsLien(item) {
  const l = lienItem(item);
  return ` href="${String(l.href).replace(/"/g, '&quot;')}"` + (l.externe ? ' target="_blank" rel="noopener"' : '');
}

// « Castres · Culture », ou la rédaction quand l'article n'a ni commune ni rubrique ; sansCommune : on est déjà sur la page de la commune
function surtitre(item, sansCommune) {
  const parts = [];
  if (item.kind === 'newsletter') return 'Newsletter';
  if (!sansCommune && item.edition === 'national') parts.push('National');
  if (!sansCommune && item.communes && item.communes.length) parts.push(item.communes[0].nom);
  if (item.rubriques && item.rubriques.length) parts.push(item.rubriques[0].nom);
  if (!parts.length && !sansCommune) parts.push(item.redaction || '');
  return parts.filter(Boolean).join(' · ');
}

function genre(item) { return item.kind === 'newsletter' ? 'newsletter' : 'article'; }

function sansPhoto(a) { return !a.image || a.coverGenerique || a.kind === 'newsletter'; }


// La carte du site : grande photo, étiquette, titre, date (un aplat de couleur à la place d'une photo manquante)
function carte(item, sansCommune) {
  const s = surtitre(item, sansCommune);
  const photo = !sansPhoto(item);
  return `<a class="une-card"${attrsLien(item)}>` +
    (photo ? `<span class="une-img"><img src="${item.image}" alt="" decoding="async" loading="lazy"></span>` : '') +
    (s ? `<span class="kicker">${s}</span>` : '') +
    `<h3>${item.title}</h3>` +
    `<span class="une-meta">${formatDate(item.pubDate)}${item.author ? ' · ' + item.author : ''}</span></a>`;
}

// Le haut de page : le dernier article en grand, les trois suivants à côté (comme l'accueil, sans défilement)
function blocUne(items, sansCommune) {
  if (!items.length) return '';
  const a = items[0];
  const photo = !sansPhoto(a);
  const s = surtitre(a, sansCommune);
  const grande = `<article class="diapo actif${photo ? '' : ' sans-photo'}">` +
    (photo ? `<img class="fond" alt="" decoding="async" src="${a.imageLarge || a.image}" fetchpriority="high">` : '') +
    '<div class="teinte"></div>' + (photo ? '' : '<div class="marque" aria-hidden="true"></div>') +
    `<div class="diapo-contenu">${s ? `<span class="etiquette">${s}</span>` : ''}` +
    `<h2 class="diapo-titre"><a${attrsLien(a)}><span>${a.title}</span></a></h2>` +
    `<div class="signature">${a.author ? 'Par ' + a.author + ' · ' : ''}${formatDate(a.pubDate)}</div>` +
    (a.description ? `<p class="diapo-chapeau">${a.description}</p>` : '') +
    `<a class="lire"${attrsLien(a)} tabindex="-1" aria-hidden="true">Lire l'article</a></div></article>`;
  const minis = items.slice(1, 4);
  const cote = minis.map((m) => {
    const sm = surtitre(m, sansCommune);
    const pm = !sansPhoto(m);
    return `<a class="mini${pm ? '' : ' sans-photo'}"${attrsLien(m)}>` +
      (pm ? `<img class="fond" alt="" loading="lazy" decoding="async" src="${m.image}">` : '') + '<span class="teinte"></span>' +
      (sm ? `<span class="etiquette">${sm}</span>` : '') + `<h3><span>${m.title}</span></h3></a>`;
  }).join('');
  return `<section class="une-zone" aria-label="À la une"><div class="une-haut${minis.length ? '' : ' sans-cote'}">` +
    `<div class="bandeau un-seul">${grande}</div>` +
    (minis.length ? `<aside class="une-cote" style="--n:${minis.length}" aria-label="À lire aussi">${cote}</aside>` : '') +
    '</div></section>';
}

// Titre de section (même filet et mêmes capitales condensées que l'accueil)
function tete(titre, droite) {
  return `<div class="journal-tete"><h2>${titre}</h2>${droite || ''}</div>`;
}

module.exports = { genre, formatDate, lienItem, attrsLien, surtitre, sansPhoto, carte, blocUne, tete };
