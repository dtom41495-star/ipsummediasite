// Fonction Supabase Edge : contact-form
// But : recevoir un message du formulaire de contact du site vitrine,
// retrouver l'email du rédac chef de la rédaction choisie (jamais exposé
// au client), lui envoyer le message via Resend (fonction envoyer-email
// déjà existante dans Compo), et envoyer une confirmation à l'expéditeur.
//
// Déploiement : supabase functions deploy contact-form --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { redaction_id, nom, email, message } = await req.json();

    if (!redaction_id || !nom || !email || !message) {
      return new Response(JSON.stringify({ error: "Champs manquants" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Email invalide" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: redaction, error } = await supabase
      .from("redactions")
      .select("nom, email_redac_chef")
      .eq("id", redaction_id)
      .single();

    if (error || !redaction) {
      return new Response(JSON.stringify({ error: "Rédaction introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!redaction.email_redac_chef) {
      return new Response(
        JSON.stringify({ error: "Aucun email configuré pour cette rédaction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nomSafe = escapeHtml(nom);
    const messageSafe = escapeHtml(message).replace(/\n/g, "<br>");

    async function envoyerEmail(to: string, subject: string, html: string) {
      return fetch(`${SUPABASE_URL}/functions/v1/envoyer-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ to, subject, html }),
      });
    }

    // Message au rédac chef concerné
    await envoyerEmail(
      redaction.email_redac_chef,
      `[Site] Nouveau message de ${nomSafe} (${redaction.nom})`,
      `<p><strong>De :</strong> ${nomSafe} (${escapeHtml(email)})</p>
       <p><strong>Rédaction :</strong> ${escapeHtml(redaction.nom)}</p>
       <p><strong>Message :</strong></p>
       <p>${messageSafe}</p>`
    );

    // Confirmation à l'expéditeur
    await envoyerEmail(
      email,
      "Votre message a bien été envoyé à Ipsum Média",
      `<p>Bonjour ${nomSafe},</p>
       <p>Votre message a bien été transmis à la rédaction ${escapeHtml(redaction.nom)}. On revient vers vous rapidement !</p>
       <p>— L'équipe Ipsum Média</p>`
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
