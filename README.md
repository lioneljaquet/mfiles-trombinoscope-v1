# Trombinoscope tebicom pour M-Files Desktop (UIX v1)

Application M-Files UI Extensibility Framework **v1**, pour le client classique M-Files Desktop. Elle reprend le
Trombinoscope du Cockpit PRO directement dans M-Files : une commande « Trombinoscope » du volet des tâches ouvre, dans la
zone de listage, l'annuaire des collaborateurs, lu en direct dans le coffre tebifiles. Lecture seule : l'application
n'écrit rien dans le coffre.

- Grille de cartes (avatar au trigramme) ou liste triable.
- Recherche instantanée sans accent : nom, trigramme, titre, /Titre, fonctions, succursale, cercle, partie locale de
  l'e-mail.
- Cinq filtres à effectifs contextuels : cercle (pastilles), étape, succursale, titre, fonction. Compteur « 12
  personnes sur 97 ».
- Fiche latérale : titre, trigramme, fonctions, succursale, cercle principal, e-mail, cercles et rôles, responsable et
  équipe directe (cliquables), « Afficher la fiche M-Files » (fiche native dans le volet de droite) et « Ouvrir dans
  M-Files » (lien `m-files://`).
- Version affichée dans la barre de titre et journalisée en console.

## Essai par Lionel

1. **Installer** : M-Files Admin › coffre tebifiles › Applications › Installer… ›
   `dist/trombinoscope-uixv1-1.0.0.zip`. Accepter, puis vérifier que l'application « Trombinoscope tebicom (UIX v1) »
   est activée.
2. **Redémarrer le client** M-Files Desktop (le client ne recharge pas une application en cours de session).
3. Ouvrir le coffre : la commande **Trombinoscope** apparaît dans le volet des tâches (groupe principal, avec l'icône
   aux quatre visages).
4. Cliquer : une progression « Recherche des collaborateurs… », « Lecture des fiches : 20 sur 97… », « Lecture des
   cercles et rôles… », puis la grille. Compter de quelques secondes (97 fiches en 5 lots, 348 cercles en 4 lots).
5. À essayer : rechercher « lja » (trigramme), un nom avec ou sans accent, une fonction ; une pastille de cercle ;
   l'étape « Offboarding démission » ; la liste et le tri par titre ; une carte, puis le responsable et un membre de
   l'équipe dans la fiche ; flèches gauche/droite, Échap ; **Afficher la fiche M-Files** (les propriétés doivent
   s'afficher dans le volet de droite) ; **Ouvrir dans M-Files** ; **Revenir au listage**.

Lignes de console attendues (outils F12 attachés au client, par exemple `C:\Windows\System32\F12\IEChooser.exe`) :

```text
[trombinoscope] version 1.0.0 (UIX v1) — nouveau cadre (type 1)        module, à chaque fenêtre
[trombinoscope] version 1.0.0 (UIX v1) — page ouverte                  page, à chaque ouverture
[trombinoscope] annuaire lu : 97 personnes, 348 cercles et rôles, … ms
```

En cas de problème : `[trombinoscope] lecture interrompue : …` (la page affiche le même message et un bouton
Relire), `cadre du client introuvable …` (retour au listage et fiche M-Files indisponibles), `sélection virtuelle
refusée : …`. La version affichée en haut à droite dit quel paquet le client sert réellement.

**Mettre à jour** : incrémenter la version de `package.json`, reconstruire (le dossier versionné change, `v101`…),
réinstaller le .zip et redémarrer le client (cache).

## Données lues (liste blanche)

Les identifiants viennent des adaptateurs du Cockpit PRO, en service sur le coffre réel ; ils sont tous dans
`src/model/parametrage.js`. Voir `docs/adr/0001`.

| Élément | ID |
|---|---|
| Type Collaborateur (`tebifiles.ot.collaborateur`) | 104 |
| Type Cercle/rôle | 362 |
| Étapes listées : En fonction, Offboarding démission, Offboarding licenciement | 319, 1475, 1478 |
| Fiche : Etape, Prénom, Nom, Initiales (trigramme), Titre, Titre (manuel), /Titre, >Fonctions, >Succursale, >Cercle/rôle, ~Cercles/rôles auto, >Responsable hiérarchique, Email prof. | 39, 1387, 1386, 1079, 2376, 4259, 3638, 3641, 2414, 2929, 2928, 1217, 2821 |
| Cercle/rôle : titre (résultat de recherche), >Membres (cercles) | —, 2926 |

Rien d'autre n'est lu : chaque propriété est demandée par son ID (`SearchForProperty`), la fiche n'est jamais
parcourue. Le mobile professionnel (2823), la succursale confidentielle (2824), le salaire, l'adresse, la naissance et
les dossiers RH ne sont pas lus. Les collaborateurs des autres étapes ne sont ni cherchés ni lus, et n'apparaissent
nulle part, pas même comme responsable.

## Limites connues

- **Pas de portraits.** Les photos (documents de la classe « !! Photo collaborateur ») ne sont pas affichées : le skill
  m-files-ui-ext-v1 ne donne aucune voie éprouvée pour montrer le fichier d'un document dans le contrôle web IE11
  (téléchargement dans un dossier temporaire puis `file://`, ou lecture par blocs, jamais validés), et un
  téléchargement laisserait la photo d'un collaborateur sur le disque. Avatar au trigramme à la place. Voir
  `docs/adr/0003`.
- **Pas de vue Hiérarchie** ni de copie des e-mails (présentes dans le Cockpit, hors de la demande).
- **« Ouvrir dans M-Files »** suit le lien `m-files://show/{coffre}/104-{id}` : la façon dont le contrôle web le passe
  au client est à confirmer à l'essai. « Afficher la fiche M-Files » (sélection virtuelle `ObjOrFileVers`) est la voie
  éprouvée.
- Vérifié sur coffre COM simulé et dans un navigateur Chromium avec des collaborateurs fictifs ; **à confirmer dans le
  client classique** (IE11).

## Développement

Prérequis : Node.js (24 LTS). Dépendances de développement seulement (acorn, ESLint, eslint-plugin-security).

```text
npm install
npm test                 tests node:test (règles, accès COM simulé, présentateur, module, construction)
npm run lint             ESLint, ES5 pour src/
node build.js            dist/appdef.xml, dist/v100/ et dist/trombinoscope-uixv1-1.0.0.zip
node build.js --sans-zip
node tests/navigateur/preparer-essai.js   page d'essai hors M-Files (coffre simulé, collaborateurs fictifs)
node scripts/generer-icone.js             régénère src/icones/app.ico
```

`build.js` refuse de livrer un script qui n'est pas de l'ES5 (acorn) ou deux scripts d'une même page qui déclarent le
même nom global, et intègre scripts et styles dans la page (un fichier externe se charge mal dans le contrôle web).

Architecture (Model / View / Presenter) :

```text
src/
├── appdef.xml                    manifeste v4 ({VERSION}, {DOSSIER} remplis à la construction)
├── icones/app.ico                déclarée dans <files>
├── model/parametrage.js          identifiants du coffre, liste blanche, version
├── model/regles.js               règles pures : annuaire, organisation, hiérarchie, recherche, filtres, tri
├── model/vault-com.js            accès COM en lecture seule
├── presenter/shellui.js          module : commande du volet des tâches, ShowDashboard
├── presenter/trombinoscope.js    présentateur de la page (tourne dans la page), OnNewDashboard
└── view/dashboard/               index.html, rendu.js, trombinoscope.css
tests/                            projet de tests séparé, non livré
```

## Journal des versions

- **1.0.0** (13.10.2026) — première version : grille, liste, recherche, cinq filtres, fiche latérale, lecture par
  lots, liste blanche, sans portraits.
