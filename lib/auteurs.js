// Pages d'auteur (/auteurs/lola-schwal). Une page n'existe que pour les journalistes de l'équipe publique (fonction SQL
// site_equipe de Compo) : quelqu'un qui a décoché « Apparaître sur la page À propos du site » n'a pas de page, et sa signature
// reste un simple texte. Les signatures qui ne correspondent à personne de l'équipe (« Ipsum Média », anciens contributeurs) aussi.
// Indépendant de Netlify.

// Clé de comparaison d'un nom : sans accents, sans majuscules, sans « _ » ni « - », mots rangés par ordre alphabétique
// (« Rodier Simon » et « Simon Rodier » sont la même personne).
function cle(nom) {
  return String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .split(/[^a-z0-9]+/).filter(Boolean).sort().join(' ');
}

// « Lola Schwal » -> « lola-schwal »
function slugDe(nom) {
  return String(nom || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Lignes de site_equipe -> { parCle, parSlug } : seulement des journalistes présentés sur le site
function indexEquipe(lignes) {
  const parCle = new Map();
  const parSlug = new Map();
  (lignes || []).forEach((m) => {
    const nom = `${String(m.prenom || '').trim()} ${String(m.nom || '').trim()}`.trim();
    const membre = { nom, prenom: m.prenom, nomFamille: m.nom, slug: slugDe(nom), cle: cle(nom), redactions: m.redactions || [], fonction: m.fonction_publique || null };
    if (!membre.slug || parSlug.has(membre.slug)) return;
    parSlug.set(membre.slug, membre);
    if (!parCle.has(membre.cle)) parCle.set(membre.cle, membre);
  });
  return { parCle, parSlug };
}

// « Ipsum Média, Lola Schwal » -> [{ nom:'Ipsum Média', membre:null }, { nom:'Lola Schwal', membre:{…} }]
function auteursLies(texte, index) {
  return String(texte || '').split(',').map((n) => n.trim()).filter(Boolean)
    .map((nom) => ({ nom, membre: (index && index.parCle.get(cle(nom))) || null }));
}

// Articles d'un membre dans la liste publiée (la liste de substack-feed arrive avec les noms déjà échappés en HTML)
function articlesDe(membre, items, decoder) {
  return (items || []).filter((it) => it.kind !== 'newsletter' && it.author &&
    String(decoder ? decoder(it.author) : it.author).split(',').some((n) => cle(n) === membre.cle));
}

module.exports = { cle, slugDe, indexEquipe, auteursLies, articlesDe };
