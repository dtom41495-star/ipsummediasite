-- À exécuter dans Supabase : Dashboard > SQL Editor > New query
-- Ajoute une colonne pour l'email de contact du rédac chef de chaque rédaction.
-- Ne touche à aucune donnée existante, ne change aucun droit d'accès (RLS).

alter table public.redactions
  add column if not exists email_redac_chef text;

-- Ensuite, remplissez cette colonne pour chaque rédaction depuis l'interface
-- d'administration de Compo (ou directement ici en SQL), par exemple :
-- update public.redactions set email_redac_chef = 'tom@ipsummedia.fr' where slug = 'tarn';
