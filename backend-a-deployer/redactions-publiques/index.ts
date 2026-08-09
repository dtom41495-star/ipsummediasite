// Fonction Supabase Edge : redactions-publiques
// But : donner au site vitrine la liste des rédactions (id + nom uniquement)
// sans jamais exposer les emails ni la liste des adhérents.
//
// Déploiement : supabase functions deploy redactions-publiques --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // select() volontairement limité à id, nom et lien_substack : jamais d'email, jamais d'adhérents.
    // lien_substack sert à rediriger vers la newsletter du bon département depuis le site vitrine.
    const { data, error } = await supabase
      .from("redactions")
      .select("id, nom, lien_substack")
      .order("nom", { ascending: true });

    if (error) throw error;

    return new Response(JSON.stringify({ redactions: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
