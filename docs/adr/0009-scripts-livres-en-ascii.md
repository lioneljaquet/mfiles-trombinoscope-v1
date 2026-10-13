# 0009 — Scripts et page livrés en ASCII seul

Date : 2026-10-13. Statut : accepté (version 1.1.1), à la suite de l'essai de la 1.1.0 par Lionel.

## Constat

Dans l'onglet, Lionel lit « Portrait non affichÃ© : … (formats affichÃ©s : …) ». La note est construite par
`model/portraits.js`, qui tourne dans le **module** (Windows Script Host). Le client lit ce fichier, sans BOM, comme de
l'ANSI (Windows-1252) : les deux octets UTF-8 de « é » deviennent « Ã© », dans le texte que le module passe ensuite à
la page. Reproduit ici : l'essai `cscript` qui lit les fichiers du module en Windows-1252 donne le même défaut sur le
paquet 1.1.0 ; il ne le voyait pas avant, parce qu'il lisait les sources en UTF-8. La page, elle, déclare
`<meta charset="utf-8">` et n'était pas touchée, mais rien ne garantit comment le client la décode.

Tous les textes accentués du module sont concernés : notes de portrait, lignes de console (« accès accordé »,
« commande non ajoutée »), libellés de facettes et tables de repli des accents de `regles.js` (tri et recherche dans le
module), noms d'étapes du paramétrage. Le nom de la commande, « Trombinoscope », est en ASCII.

## Décision

- `build.js` écrit **chaque script livré en ASCII seul** : tout caractère non ASCII devient un échappement `\uXXXX`
  (valable dans les chaînes, les expressions régulières, les commentaires). Module et page, sans exception.
- La **page** livrée est aussi en ASCII : après intégration des scripts (déjà en ASCII), le texte accentué de la page
  devient une entité numérique (`&#xe9;`). `meta charset="utf-8"` reste.
- **Garde-fous** : un test de construction refuse tout octet non ASCII dans un script ou dans la page livrés ; l'essai
  sous `cscript` charge le **paquet construit**, lu en Windows-1252 comme le client, et vérifie qu'une note accentuée
  produite par le module arrive intacte (« Portrait non affiché : format PDF non pris en charge. »).
- Les sources restent en UTF-8, lisibles ; seul le paquet est transformé.

## Options écartées

- Ajouter un BOM UTF-8 aux scripts : dépend de la façon dont le client et WSH le traitent, non vérifiable ici.
- Écrire les sources elles-mêmes en échappements : illisible, et l'outil d'édition utilisé convertit parfois les
  échappements en caractères.
