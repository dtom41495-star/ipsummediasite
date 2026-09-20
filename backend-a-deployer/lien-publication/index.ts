// Fonction Supabase Edge : lien-publication
// But : pour un article qui n'est plus affiché sur le site vitrine (le flux RSS
// Substack ne garde que les 20 derniers), donner au site le lien de l'article tel
// que la rédaction l'a renseigné dans Compo (colonne articles.lien_publication),
// pour envoyer le lecteur au bon endroit sur Substack.
//
// La recherche se fait par "slug" : le dernier morceau de l'adresse Substack
// (.../p/<slug>), identique à celui de l'adresse du site (/articles/<slug>).
//
// Ne renvoie que ce lien : jamais le titre, l'auteur, le contenu ni aucune autre
// donnée d'article ou d'adhérent. Uniquement pour les articles au statut "publie".
//
// Déploiement : supabase functions deploy lien-publication --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function reponse(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const slug = new URL(req.url).searchParams.get("slug") || "";
    // Un slug Substack ne contient que des lettres, chiffres et tirets.
    if (!/^[a-z0-9-]{1,200}$/i.test(slug)) {
      return reponse({ lien: null });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Le slug ne contient ni % ni _ : pas de caractère joker dans la recherche.
    const { data, error } = await supabase
      .from("articles")
      .select("lien_publication")
      .eq("statut", "publie")
      .ilike("lien_publication", "%/p/" + slug + "%")
      .limit(10);

    if (error) throw error;

    // La recherche ci-dessus est large (foo trouve aussi foo-bar) : on garde
    // uniquement le lien dont le slug est exactement celui demandé, en https.
    for (const a of data || []) {
      const lien = String(a.lien_publication || "").trim();
      const m = lien.match(/^https:\/\/[^/\s]+\/p\/([^/?#\s]+)/i);
      if (m && m[1].toLowerCase() === slug.toLowerCase()) {
        return reponse({ lien });
      }
    }

    return reponse({ lien: null });
  } catch (e) {
    return reponse({ error: String(e) }, 500);
  }
});
