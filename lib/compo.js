// Articles du site publiés depuis Compo (chantier « Indépendance », étape 2).
// Ce fichier ne dépend pas de Netlify : il sera repris tel quel quand le site tournera sur la machine de l'asso.
// La base lit la fonction site_publications() : les articles mis en ligne depuis Compo + les anciens articles
// Substack importés (depuis janvier 2026), avec seulement leurs champs publics.

// Adresse de la base et clé publique (anon, la même que dans le JS de l'accueil) : réglables en un seul endroit,
// ici ou par les variables d'environnement COMPO_URL / COMPO_CLE_PUBLIQUE (déménagement de l'étape 5).
const COMPO_URL = process.env.COMPO_URL || 'https://ctmekufqaxdelgfyjwly.supabase.co';
const COMPO_CLE = process.env.COMPO_CLE_PUBLIQUE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0bWVrdWZxYXhkZWxnZnlqd2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDI1OTksImV4cCI6MjA5MDg3ODU5OX0.32wkp9NsqNTktvuC2Pb3S5EnAPPipt06DYLxfeyf5xE';

// Champs utiles aux listes (sans le texte, pour rester léger)
const CHAMPS_LISTE = 'slug,origine,titre,chapeau,auteurs,redaction_nom,rubrique,etiquettes,image_url,publie_le,maj_le,canonical_url';

// Lit site_publications(). Renvoie null si la base ne répond pas (le site garde alors son comportement Substack).
async function lirePublications(params, delaiMs) {
  try {
    const url = COMPO_URL + '/rest/v1/rpc/site_publications?' + params;
    const res = await fetch(url, {
      headers: { apikey: COMPO_CLE, Authorization: 'Bearer ' + COMPO_CLE, Accept: 'application/json' },
      signal: AbortSignal.timeout(delaiMs || 3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch (e) {
    return null;
  }
}

// Toutes les publications (sans le texte), les plus récentes d'abord
function listePublications(delaiMs) {
  return lirePublications('select=' + CHAMPS_LISTE + '&order=publie_le.desc', delaiMs);
}

// Une publication complète (avec le texte), ou null (introuvable ou base injoignable : on ne distingue pas,
// dans les deux cas la page article se rabat sur Substack comme avant)
async function unePublication(slug, delaiMs) {
  if (!/^[a-z0-9-]{1,200}$/.test(String(slug || ''))) return null;
  const rows = await lirePublications('slug=eq.' + encodeURIComponent(slug) + '&limit=1', delaiMs);
  return rows && rows[0] ? rows[0] : null;
}

// Nombre de likes d'un article (table site_likes, lecture publique). 0 s'il n'en a pas encore, null si la base ne répond pas.
async function nbLikes(slug, delaiMs) {
  if (!/^[a-z0-9-]{1,200}$/.test(String(slug || ''))) return null;
  try {
    const res = await fetch(COMPO_URL + '/rest/v1/site_likes?slug=eq.' + encodeURIComponent(slug) + '&select=nb', {
      headers: { apikey: COMPO_CLE, Authorization: 'Bearer ' + COMPO_CLE, Accept: 'application/json' },
      signal: AbortSignal.timeout(delaiMs || 2500),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) ? (rows[0] ? Number(rows[0].nb) || 0 : 0) : null;
  } catch (e) {
    return null;
  }
}

// Journalistes présentés sur la page « À propos » (fonction SQL site_equipe : seulement prénom, nom, rédactions, « Président »
// et adresse de l'association). null si la base ne répond pas.
async function equipe(delaiMs) {
  try {
    const res = await fetch(COMPO_URL + '/rest/v1/rpc/site_equipe', {
      headers: { apikey: COMPO_CLE, Authorization: 'Bearer ' + COMPO_CLE, Accept: 'application/json' },
      signal: AbortSignal.timeout(delaiMs || 4000),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) ? rows : null;
  } catch (e) {
    return null;
  }
}

// Nom d'une rédaction dans Compo -> nom affiché sur le site
const LIBELLES_REDACTIONS = { tarn: "La Rédac' du Tarn", hautegaronne: "La Rédac' d'Haute-Garonne", national: "La Rédac' nationale" };
function libelleRedaction(nom) {
  return LIBELLES_REDACTIONS[cleRedaction(nom)] || "La Rédac' " + String(nom || '').trim();
}

// Les rédactions s'appellent « Tarn », « Haute Garonne », « Nationale » dans Compo, et « Tarn », « Haute-Garonne »,
// « National » sur le site : on les rapproche par leur forme simplifiée.
function cleRedaction(nom) {
  const c = String(nom || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
  return c === 'nationale' ? 'national' : c;
}
function trouverRedaction(redactions, nom) {
  const c = cleRedaction(nom);
  return redactions.find((r) => cleRedaction(r.nom) === c) || null;
}

// ===== Markdown de Compo -> HTML (même rendu que _mdVersHtmlLeger dans Compo), tout le texte échappé =====
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function mdStyles(t) {
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^\w])_([^_\n]+?)_(?![\w])/g, '$1<em>$2</em>');
  t = t.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  return t;
}
// Une photo du Drive : son lien « …/file/d/ID/view » est une page, pas une image
function mdImageUrl(url) {
  const m = String(url).match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=|thumbnail\?(?:[^#]*&)?id=)([A-Za-z0-9_-]{10,})/);
  return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w2000' : url;
}
// Seules les adresses https (et http) deviennent des images ou des liens : pas de javascript:, data:…
function adresseWeb(url) { return /^https?:\/\//i.test(url); }
function mdLegende(alt) {
  const a = String(alt || '').trim();
  return /^l[ée]gende de l['’]image$/i.test(a) ? '' : a;
}
function mdInline(ligne) {
  const reserve = [];
  const garder = (html) => { reserve.push(html); return '\u0000' + (reserve.length - 1) + '\u0000'; };
  let t = String(ligne || '').replace(/\u0000/g, '');
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => adresseWeb(url)
    ? garder('<img src="' + esc(mdImageUrl(url)) + '" alt="' + esc(mdLegende(alt)) + '" loading="lazy">') : '');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, url) => {
    if (!/^(https?:|mailto:)/i.test(url)) return txt;
    return garder('<a href="' + esc(url) + '">' + mdStyles(esc(txt)) + '</a>');
  });
  t = t.replace(/\bhttps?:\/\/[^\s<>()]+[^\s<>().,;:!?»"']/g, (url) => garder('<a href="' + esc(url) + '">' + esc(url) + '</a>'));
  t = mdStyles(esc(t));
  return t.replace(/\u0000(\d+)\u0000/g, (m, i) => reserve[+i]);
}
function mdVersHtml(md) {
  const lignes = String(md || '').split('\n');
  let html = '', dansListe = false, dansCitation = false;
  const fermer = () => {
    if (dansListe) { html += '</ul>'; dansListe = false; }
    if (dansCitation) { html += '</blockquote>'; dansCitation = false; }
  };
  lignes.forEach((ligne) => {
    const t = ligne.trim();
    if (!t) { fermer(); return; }
    if (t === '---') { fermer(); html += '<hr>'; return; }
    // Le titre de l'article est déjà en <h1> : les intertitres du texte commencent au niveau 2
    const mTitre = t.match(/^(#{1,3})\s+(.*)$/);
    if (mTitre) {
      fermer();
      const n = Math.min(mTitre[1].length + 1, 4);
      html += '<h' + n + '>' + mdInline(mTitre[2]) + '</h' + n + '>';
      return;
    }
    const mImg = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (mImg) {
      fermer();
      if (!adresseWeb(mImg[2])) return;
      const leg = mdLegende(mImg[1]);
      html += '<figure><img src="' + esc(mdImageUrl(mImg[2])) + '" alt="' + esc(leg) + '" loading="lazy">' + (leg ? '<figcaption>' + esc(leg) + '</figcaption>' : '') + '</figure>';
      return;
    }
    const mCit = t.match(/^>\s?(.*)$/);
    if (mCit) {
      if (dansListe) { html += '</ul>'; dansListe = false; }
      if (!dansCitation) { html += '<blockquote>'; dansCitation = true; }
      html += '<p>' + mdInline(mCit[1]) + '</p>';
      return;
    }
    const mListe = t.match(/^-\s+(.*)$/);
    if (mListe) {
      if (dansCitation) { html += '</blockquote>'; dansCitation = false; }
      if (!dansListe) { html += '<ul>'; dansListe = true; }
      html += '<li>' + mdInline(mListe[1]) + '</li>';
      return;
    }
    fermer();
    html += '<p>' + mdInline(t) + '</p>';
  });
  fermer();
  return html;
}

module.exports = { COMPO_URL, COMPO_CLE, listePublications, unePublication, nbLikes, equipe, libelleRedaction, trouverRedaction, cleRedaction, mdVersHtml, esc };
