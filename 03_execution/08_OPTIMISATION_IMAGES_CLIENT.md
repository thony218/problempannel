# Optimisation des images avant upload

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Frontend**  
> Statut : **FROZEN**

## Objectif

Réduire le temps d'upload mobile sans rendre la déclaration dépendante d'une conversion complexe.

## Règle V1

Pour JPEG/PNG/WebP lorsque le navigateur peut décoder l'image :

1. lire dimensions;
2. si le plus grand côté > 2048 px, redimensionner à 2048 px max;
3. exporter en JPEG qualité 0,82, sauf transparence réellement nécessaire;
4. si le résultat est plus lourd que l'original, garder l'original;
5. afficher la taille finale avant upload.

## HEIC / HEIF

Deux cas :

### Navigateur capable de décoder
Appliquer le même redimensionnement et exporter en JPEG.

### Navigateur incapable de décoder
- conserver l'original HEIC/HEIF;
- aperçu générique;
- upload autorisé si ≤10 MiB.

Aucune bibliothèque lourde HEIC/WASM n'est obligatoire en V1.

## Plafond

Le serveur reste l'autorité :
- 10 MiB maximum par fichier.

Si une image non décodable dépasse 10 MiB :
`Cette photo est trop volumineuse. Choisissez une photo plus petite ou réduisez sa taille.`

## Confidentialité

Ne jamais envoyer l'image à un service tiers pour compression.
