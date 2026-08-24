# Contrat sécurité et authentification

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable sécurité**  
> Statut : **FROZEN**

## Production et staging

Cloudflare Access protège l'application.

Le Worker valide l'identité transmise par Access et charge ensuite l'utilisateur interne par courriel.

Le serveur vérifie :
1. identité valide;
2. utilisateur existant;
3. `active = true`;
4. rôle;
5. permission demandée.

## Local

Un mode de développement peut simuler l'identité uniquement lorsque :

`APP_ENV=local`

Header local :
`X-Dev-User-Email`

Cette voie doit être impossible en staging/prod.

## R2

Bucket privé. Lecture/téléchargement uniquement via Worker.

## Limitation de débit

- écritures : 120/minute/utilisateur;
- uploads : 20/minute/utilisateur.

Clé de rate limit = ID utilisateur interne.

## Logs

À logger :
- requestId;
- route;
- statut HTTP;
- durée;
- code d'erreur.

À ne pas logger :
- JWT;
- cookies;
- secrets;
- fichiers;
- corps complet des descriptions/commentaires.
