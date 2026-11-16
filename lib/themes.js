// Pages « thématiques » du site : une page par commune (/commune/castres) et par rubrique (/rubrique/culture).
// Les communes et rubriques sont celles que substack-feed reconnaît sur les articles : aucune liste à tenir à jour.
// Indépendant de Netlify.

const SITE = 'https://ipsummedia.fr';
const MIN_INDEX = 2;   // en dessous, la page existe mais n'est pas proposée à Google (trop mince) : noindex, hors plan du site

// Liste complète des publications étiquetées (la même que celle de l'accueil et de « Nos actus »)
async function chargerItems(delaiMs, base) {
  try {
    const res = await fetch((base || SITE) + '/.netlify/functions/substack-feed?tous=1', { signal: AbortSignal.timeout(delaiMs || 8000) });
    const data = res.ok ? await res.json() : null;
    return (data && data.items) || [];
  } catch (e) {
    return [];
  }
}

// { communes: { castres: { slug, nom, items:[…] } }, rubriques: { culture: {…} } } : seulement les articles (pas les newsletters)
function regrouper(items) {
  const res = { communes: {}, rubriques: {} };
  (items || []).forEach((it) => {
    if (it.kind === 'newsletter') return;
    ['communes', 'rubriques'].forEach((type) => {
      (it[type] || []).forEach((t) => {
        if (!t || !/^[a-z0-9-]{1,80}$/.test(t.slug || '')) return;
        if (!res[type][t.slug]) res[type][t.slug] = { slug: t.slug, nom: t.nom, items: [] };
        res[type][t.slug].items.push(it);
      });
    });
  });
  return res;
}

// « de Castres », « d'Albi », « du Tarn »… (pour les titres)
function de(nom) {
  const n = String(nom || '').trim();
  if (/^le\s/i.test(n)) return 'du ' + n.slice(3);
  if (/^les\s/i.test(n)) return 'des ' + n.slice(4);
  if (/^la\s/i.test(n)) return 'de la ' + n.slice(3);
  return /^[aeiouyàâéèêëîïôöûüh]/i.test(n) ? "d'" + n : 'de ' + n;
}

module.exports = { SITE, MIN_INDEX, chargerItems, regrouper, de };
