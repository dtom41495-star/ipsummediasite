-- Carte d'adhérent : code secret imprimé dans le QR code de la carte, vérifié par la
-- fonction verifier-carte-membre (page publique ipsummedia.fr/membre).
-- Rempli automatiquement par Compo la première fois qu'un membre génère sa carte.
alter table membres add column if not exists carte_token text;
create unique index if not exists membres_carte_token_unique on membres (carte_token) where carte_token is not null;

-- Pour annuler une carte perdue ou volée (le membre en génère simplement une nouvelle
-- depuis Compo, avec un nouveau code) :
--   update membres set carte_token = null where email = 'adresse@exemple.fr';
