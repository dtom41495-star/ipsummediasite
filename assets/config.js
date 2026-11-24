// Configuration du site : l'adresse de la base Compo (Supabase) et sa clé PUBLIQUE (anon), écrites ICI et nulle part ailleurs.
// Les pages la lisent par window.IPSUM_CONFIG, les fonctions Node (lib/compo.js) par require. Au déménagement de la base
// (étape 5 du plan « Indépendance »), c'est le seul fichier à changer ; le générateur (scripts/generer.js) peut aussi la
// remplacer au moment de la génération avec les variables COMPO_URL et COMPO_CLE_PUBLIQUE.
(function (racine) {
  var config = {
    SUPABASE_URL: 'https://ctmekufqaxdelgfyjwly.supabase.co',
    SUPABASE_CLE: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0bWVrdWZxYXhkZWxnZnlqd2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDI1OTksImV4cCI6MjA5MDg3ODU5OX0.32wkp9NsqNTktvuC2Pb3S5EnAPPipt06DYLxfeyf5xE'
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
  else racine.IPSUM_CONFIG = config;
})(typeof window !== 'undefined' ? window : this);
