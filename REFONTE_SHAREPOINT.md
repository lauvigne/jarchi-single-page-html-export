# Refonte SharePoint Sans JavaScript

## 1) Objectif

Conserver un export **single page HTML** compatible SharePoint/OneDrive preview, avec:

- aucun JavaScript requis pour la navigation
- conservation du mecanisme CSS actuel (inputs hidden + labels)
- forte reduction du poids HTML sur gros modeles

## 2) Contraintes Validees En Test

- SPFx / App Catalog non utilisable dans le tenant cible
- iframe HTML -> HTML non exploitable dans le contexte cible
- CSS externe bloque en preview (erreur MIME), donc CSS inline obligatoire
- images externes chargees correctement

Conclusion: la solution cible est **single HTML + CSS inline + images externes**.

## 3) Cible Technique

## 3.1 Sortie d'export

L'export produit:

- un **repertoire d'export** choisi par l'utilisateur
- `index.html` (single page)
- `images/<viewId>.png` (une image par vue)

Exemple:

- `export-mon-modele/index.html`
- `export-mon-modele/images/1234.png`
- `export-mon-modele/images/5678.png`

## 3.2 Resolution des images

Le HTML contient:

- une balise `<base href="...">` dans le `<head>`
- des images referencees en `src="images/<viewId>.png"`

Le `base href` est renseigne lors de l'execution du plugin.

Exemples:

- `./`
- `https://tenant.sharepoint.com/sites/site/Shared%20Documents/exports/mon-modele/`

## 3.3 Navigation sans JS

Navigation conservee a l'identique:

- inputs radio/checkbox hidden
- labels `for=` pour selectionner vue/mode
- regles CSS `:checked ~ ...` pour afficher/masquer

## 4) Evolutions Du Script jArchi

Le script `Generate Single-page HTML Export.ajs` doit:

1. Demander un repertoire d'export.
2. Ecrire le HTML final dans `index.html`.
3. Demander un `baseHref`.
4. Exporter chaque vue en PNG dans `images/`.
5. Remplacer les `data:image/png;base64,...` par `images/<viewId>.png`.
6. Garder le reste du rendu fonctionnel identique.

## 5) Etapes suivantes: proprietes d'element au clic

Possible sans JavaScript, avec overlay HTML/CSS:

1. Exporter les coordonnees des objets visuels de la vue (x, y, width, height).
2. Generer un layer de zones cliquables au-dessus de l'image.
3. Relier chaque zone a un input/label pour afficher un bloc hidden de proprietes.
4. Gerer z-index, fermeture panneau, et lisibilite responsive.

## 6) Criteres D'Acceptation

- un seul HTML genere: `index.html`
- CSS reste inline (compatible preview SharePoint)
- images de vues externes (non inline)
- fonctionnement sans JavaScript
- rendu equivalent a l'export historique sur les fonctions actuelles
