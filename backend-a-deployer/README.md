# Formulaire de contact → Compo (à déployer)

Ces fichiers ne sont pas déployés automatiquement (je n'ai pas accès à votre
projet Supabase). Voici comment les mettre en place.

## 1. Ajouter la colonne email en base

Dashboard Supabase → SQL Editor → coller et exécuter le contenu de
`supabase-migration/ajout-email-redac-chef.sql`.

Puis, remplissez `email_redac_chef` pour chaque rédaction existante
(au minimum "Tarn"), soit en SQL, soit depuis l'interface de Compo si
elle permet d'éditer une rédaction.

## 2. Déployer les deux fonctions

Avec la Supabase CLI installée et connectée à votre projet :

```
supabase functions deploy redactions-publiques --no-verify-jwt
supabase functions deploy contact-form --no-verify-jwt
```

`--no-verify-jwt` est nécessaire : le site vitrine n'a pas de session
utilisateur Compo, ces fonctions doivent être appelables publiquement
(comme `envoyer-email` l'est déjà).

Les fonctions utilisent `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`,
deux variables déjà disponibles automatiquement dans l'environnement
des Edge Functions Supabase — rien à configurer en plus.

## 3. Vérifier

Une fois déployé :

```
curl https://ctmekufqaxdelgfyjwly.supabase.co/functions/v1/redactions-publiques
```

doit renvoyer `{"redactions":[{"id":"...","nom":"Tarn"}]}`.

## Sécurité

- `redactions-publiques` ne renvoie jamais l'email ni aucune donnée sur les
  adhérents, uniquement `id` et `nom`.
- `contact-form` ne renvoie jamais l'email du rédac chef au client : la
  recherche se fait côté serveur avec la clé service role.
- Le formulaire du site vitrine n'aura donc jamais connaissance d'aucun
  email interne.
