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

## 4. Fonction lien-publication (articles anciens)

Quand un article n'est plus dans les 20 derniers du flux RSS, le site retrouve son lien
Substack dans Compo (colonne `articles.lien_publication`, le lien renseigné sur
l'article) et y envoie le lecteur. Sans cette fonction, le site vérifie
directement sur Substack : elle rend le lien exact de Compo prioritaire.

```
supabase functions deploy lien-publication --no-verify-jwt
```

Vérifier avec le slug d'un article publié dont le lien est renseigné :

```
curl "https://ctmekufqaxdelgfyjwly.supabase.co/functions/v1/lien-publication?slug=mon-article"
```

doit renvoyer `{"lien":"https://...substack.com/p/mon-article"}` (ou `{"lien":null}`).

## Sécurité

- `redactions-publiques` ne renvoie jamais l'email ni aucune donnée sur les
  adhérents, uniquement `id` et `nom`.
- `contact-form` ne renvoie jamais l'email du rédac chef au client : la
  recherche se fait côté serveur avec la clé service role.
- `lien-publication` ne renvoie que le lien de publication d'un article publié
  (jamais titre, auteur ni contenu), et seulement si le slug correspond exactement.
- Le formulaire du site vitrine n'aura donc jamais connaissance d'aucun
  email interne.
