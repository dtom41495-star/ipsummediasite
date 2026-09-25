// Fonction Supabase Edge : verifier-carte-membre
// But : la page publique ipsummedia.fr/membre (lien du QR code imprimé sur la carte
// d'adhérent générée par Compo) demande à cette fonction si une carte est valable.
//
// La carte porte un code secret propre à chaque membre (colonne membres.carte_token),
// distinct de son identifiant de compte : on peut le changer pour annuler une carte
// perdue, sans toucher au compte.
//
// Ne renvoie que ce qui est imprimé sur la carte : prénom, nom, fonction, rédaction(s),
// date d'arrivée, saison. En plus, les accréditations presse DU JOUR : les invitations
// presse (communiqués) pour lesquelles le membre a été choisi pour couvrir l'événement
// (invitations_disponibilites.statut = 'selectionne'), et seulement celles qui ont lieu
// aujourd'hui (heure de Paris). Rien sur les jours suivants : la page est publique pour
// qui a la carte en main, elle ne doit pas dire où la personne sera plus tard. Jamais l'email, le téléphone ni aucune autre donnée. Pour une
// carte non valable (code inconnu, compte désactivé ou restreint), ne renvoie AUCUNE
// donnée personnelle, seulement { valide: false }.
//
// Déploiement : supabase functions deploy verifier-carte-membre --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function reponse(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    status,
  });
}

// Mêmes libellés que FONCTIONS_LABELS dans Compo
const FONCTIONS: Record<string, string> = {
  tresorier: "Trésorier·ère",
  communication: "Communication",
  responsable_com: "Responsable communication",
  com_externe: "Communication externe",
  com_interne: "Communication interne",
  vie_asso: "Vie associative",
  secretaire: "Secrétaire",
  president: "Président·e",
  vice_president: "Vice-président·e",
};
const ROLES_REDAC: Record<string, string> = {
  redac_chef: "Rédac chef",
  redacteur: "Rédacteur·rice",
  correcteur: "Correcteur·rice",
};

// membres.fonction peut être un tableau, une chaîne JSON ou une chaîne simple
function fonctions(val: unknown): string[] {
  let liste: unknown = val;
  if (typeof val === "string") {
    try { liste = JSON.parse(val); } catch { liste = val ? [val] : []; }
  }
  if (!Array.isArray(liste)) liste = liste ? [liste] : [];
  return (liste as unknown[]).map((f) => FONCTIONS[String(f)] || "").filter(Boolean);
}

// Date du jour à Paris, au format AAAA-MM-JJ
function jourParis(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Saison associative : de juin à juin (même règle que Compo)
function saison() {
  const d = new Date();
  const debut = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1;
  return { debut, fin: debut + 1 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const code = new URL(req.url).searchParams.get("c") || "";
    // Codes générés par Compo : lettres et chiffres uniquement
    if (!/^[A-Za-z0-9]{16,64}$/.test(code)) {
      return reponse({ valide: false });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: membres, error } = await supabase
      .from("membres")
      .select("id, prenom, nom, fonction, role, actif, created_at")
      .eq("carte_token", code)
      .limit(1);
    if (error) throw error;

    const m = membres && membres[0];
    if (!m || m.actif === false || m.role === "interdit") {
      return reponse({ valide: false });
    }

    const { data: liens } = await supabase
      .from("membres_redactions")
      .select("redaction_id, role_redac")
      .eq("membre_id", m.id);
    const ids = (liens || []).map((l) => l.redaction_id);
    let redactions: { nom: string; couleur: string | null; role: string }[] = [];
    if (ids.length) {
      const { data: reds } = await supabase
        .from("redactions")
        .select("id, nom, couleur")
        .in("id", ids);
      redactions = (liens || []).map((l) => {
        const r = (reds || []).find((x) => x.id === l.redaction_id);
        return r ? { nom: r.nom, couleur: r.couleur || null, role: ROLES_REDAC[l.role_redac] || "" } : null;
      }).filter(Boolean) as { nom: string; couleur: string | null; role: string }[];
    }

    // Accréditations presse du jour. Fenêtre large côté requête (hier à demain), puis
    // filtre exact sur le jour de Paris.
    let accreditations: { titre: string; organisateur: string; date: string; lieu: string; redaction: { nom: string; couleur: string | null } | null }[] = [];
    const { data: choix } = await supabase
      .from("invitations_disponibilites")
      .select("communique_id")
      .eq("membre_id", m.id)
      .eq("statut", "selectionne");
    const cpIds = (choix || []).map((c) => c.communique_id);
    if (cpIds.length) {
      const maintenant = new Date();
      const { data: cps } = await supabase
        .from("communiques")
        .select("titre, source, organisation, date_evenement, lieu_evenement, type, redaction_id")
        .in("id", cpIds)
        .eq("type", "invitation_presse")
        .gte("date_evenement", new Date(maintenant.getTime() - 36 * 3600e3).toISOString())
        .lte("date_evenement", new Date(maintenant.getTime() + 36 * 3600e3).toISOString())
        .order("date_evenement");
      const aujourdhui = jourParis(maintenant);
      const duJour = (cps || []).filter((cp) => cp.date_evenement && jourParis(new Date(cp.date_evenement)) === aujourdhui);
      // Rédaction pour laquelle la personne couvre (celle du communiqué ; aucune pour un
      // communiqué adressé à toutes les rédactions)
      const redacIds = [...new Set(duJour.map((cp) => cp.redaction_id).filter(Boolean))];
      let redacsCp: { id: string; nom: string; couleur: string | null }[] = [];
      if (redacIds.length) {
        const { data } = await supabase.from("redactions").select("id, nom, couleur").in("id", redacIds);
        redacsCp = data || [];
      }
      accreditations = duJour
        .map((cp) => ({
          titre: cp.titre || "Invitation presse",
          organisateur: cp.source || cp.organisation || "",
          date: cp.date_evenement,
          lieu: cp.lieu_evenement || "",
          redaction: (() => {
            const r = redacsCp.find((x) => x.id === cp.redaction_id);
            return r ? { nom: r.nom, couleur: r.couleur || null } : null;
          })(),
        }));
    }

    return reponse({
      valide: true,
      accreditations,
      membre: {
        prenom: m.prenom || "",
        nom: m.nom || "",
        fonctions: fonctions(m.fonction),
        depuis: m.created_at || null,
        redactions,
      },
      saison: saison(),
    });
  } catch (e) {
    return reponse({ error: String(e) }, 500);
  }
});
