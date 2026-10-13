# Trombinoscope tebicom pour M-Files Desktop (UIX v1)

Application M-Files UI Extensibility Framework **v1**, pour le client classique M-Files Desktop. Elle reprend le
Trombinoscope du Cockpit PRO directement dans M-Files : une commande « Trombinoscope » du volet des tâches ouvre, dans la
zone de listage, l'annuaire des collaborateurs, lu en direct dans le coffre tebifiles. Lecture seule : l'application
n'écrit rien dans le coffre.

- **Réservée au groupe d'utilisateurs M-Files « SI - membres primaires »** (ID 3524), groupes imbriqués compris : la
  commande n'apparaît qu'à ses membres, et la page refuse d'afficher l'annuaire aux autres (voir `docs/adr/0006`).
- **Population limitée comme l'export du Cockpit** : collaborateurs En fonction ou en offboarding **rattachés à un
  cercle** de l'organisation ; l'étape n'apparaît nulle part (ni filtre, ni tri, ni mention) ; un responsable sans
  cercle est remplacé par le premier responsable retenu au-dessus. Bandeau « Données internes : collaborateurs
  rattachés à un cercle (N personnes). » (voir `docs/adr/0005`).
- Grille de cartes (avatar au trigramme) ou liste triable.
- Recherche instantanée sans accent : nom, trigramme, titre, /Titre, fonctions, succursale, cercle, partie locale de
  l'e-mail.
- Quatre filtres à effectifs contextuels : cercle (pastilles), succursale, titre, fonction. Compteur « 12 personnes sur
  94 ».
- Fiche latérale : titre, trigramme, fonctions, succursale, cercle principal, e-mail (texte à sélectionner), cercles et
  rôles, responsable et équipe directe (cliquables), **Afficher la fiche M-Files** (fiche native dans le volet de
  droite, sans quitter le trombinoscope).
- Version affichée dans la barre de titre et journalisée en console.

## Essai par Lionel (version 1.0.2)

1. **Installer** : M-Files Admin › coffre tebifiles › Applications › Installer… ›
   `dist/trombinoscope-uixv1-1.0.2.zip` (remplace la 1.0.0 ; la 1.0.1 n'a jamais été installée). Accepter, puis
   vérifier que l'application « Trombinoscope tebicom (UIX v1) » est activée.
2. **Redémarrer le client** M-Files Desktop (le client ne recharge pas une application en cours de session).
3. **Membre du groupe** (compte de Lionel, s'il est dans « SI - membres primaires ») : la commande **Trombinoscope**
   apparaît dans le volet des tâches (groupe principal, icône aux quatre visages).
4. Cliquer : progression « Recherche des collaborateurs… », « Lecture des fiches : 20 sur 97… », « Lecture des
   cercles et rôles… », puis la grille. Attendu : **94 personnes** (97 fiches lues, moins le modèle
   « _Collaborateur TYPE (ZZZ) », moins les 2 fiches sans cercle que le Cockpit écartait le 07.10.2026 ; à confirmer,
   le coffre a pu changer). Le bandeau bleu le redit.
5. À essayer : rechercher « lja » (trigramme), un nom avec ou sans accent, une fonction ; une pastille de cercle (plus
   de « Sans cercle ») ; les filtres succursale, titre, fonction (plus de filtre « Étape ») ; la liste et le tri par
   titre (plus de tri « Étape ») ; une carte, puis le responsable et un membre de l'équipe dans la fiche ; flèches
   gauche/droite, Échap ; **Afficher la fiche M-Files** ; **Revenir au listage**. Aucune personne en offboarding ne
   doit se distinguer des autres.
6. **Non-membre** : se connecter au coffre avec un compte qui n'est pas dans le groupe (ou retirer temporairement un
   compte d'essai du groupe, puis redémarrer le client). Attendu : **pas de commande Trombinoscope** dans le volet des
   tâches, et en console `commande non ajoutée : l'utilisateur n'est pas membre du groupe 3524`.

Lignes de console attendues (outils F12 attachés au client, par exemple `C:\Windows\System32\F12\IEChooser.exe`) :

```text
[trombinoscope] version 1.0.2 (UIX v1) — nouveau cadre (type 1)        module, à chaque fenêtre
[trombinoscope] accès accordé : membre du groupe 3524                 module, membre
[trombinoscope] commande non ajoutée : l'utilisateur n'est pas membre du groupe 3524      module, non-membre
[trombinoscope] commande non ajoutée : appartenance illisible : …     module, lecture impossible (échec fermé)
[trombinoscope] version 1.0.2 (UIX v1) — page ouverte                  page, à chaque ouverture
[trombinoscope] annuaire lu : 94 personnes, 348 cercles et rôles, … ms
```

En cas de problème : `lecture interrompue : …` (la page affiche le même message et un bouton Relire), `annuaire non
affiché : …` (page ouverte sans appartenance au groupe : message neutre « Cette application n'est pas disponible pour
votre compte. »), `cadre du client introuvable …`, `sélection virtuelle refusée : …`. La version affichée en haut à
droite (« v1.0.2 (UIX v1) ») dit quel paquet le client sert réellement.

**Mettre à jour** : incrémenter la version de `package.json`, reconstruire avec `node build.js` (le dossier versionné
change, `v103`…, et le .zip est refait), réinstaller le .zip et redémarrer le client (cache).

## Données lues (liste blanche)

Les identifiants viennent des adaptateurs du Cockpit PRO, en service sur le coffre réel ; ils sont tous dans
`src/model/parametrage.js`. Voir `docs/adr/0001`.

| Élément | ID |
|---|---|
| Type Collaborateur (`tebifiles.ot.collaborateur`) | 104 |
| Type Cercle/rôle | 362 |
| Étapes listées : En fonction, Offboarding démission, Offboarding licenciement (critère d'inclusion seulement) | 319, 1475, 1478 |
| Fiche : Etape, Prénom, Nom, Initiales (trigramme), Titre, Titre (manuel), /Titre, >Fonctions, >Succursale, >Cercle/rôle, ~Cercles/rôles auto, >Responsable hiérarchique, Email prof. | 39, 1387, 1386, 1079, 2376, 4259, 3638, 3641, 2414, 2929, 2928, 1217, 2821 |
| Cercle/rôle : titre (résultat de recherche), >Membres (cercles) | —, 2926 |
| Groupe d'utilisateurs autorisé « SI - membres primaires » (liste de valeurs 16) | 3524 |

Rien d'autre n'est lu : chaque propriété est demandée par son ID (`SearchForProperty`), la fiche n'est jamais
parcourue. Le mobile professionnel (2823), la succursale confidentielle (2824), le salaire, l'adresse, la naissance et
les dossiers RH ne sont pas lus. Les collaborateurs des autres étapes ne sont ni cherchés ni lus ; ceux sans cercle sont
lus mais écartés avant l'affichage ; ni les uns ni les autres n'apparaissent nulle part, pas même comme responsable.

## Limites connues

- **Pas de portraits.** Les photos (documents de la classe « !! Photo collaborateur ») ne sont pas affichées : aucune
  voie éprouvée pour montrer le fichier d'un document dans le contrôle web IE11, et un téléchargement laisserait la
  photo d'un collaborateur sur le disque. Avatar au trigramme à la place. Voir `docs/adr/0003`.
- **Pas de vue Hiérarchie** ni de copie des e-mails (présentes dans le Cockpit, hors de la demande).
- **Pas d'ouverture de l'objet hors de la page** : seule « Afficher la fiche M-Files » est proposée (décision de
  Lionel, `docs/adr/0004`). **Pas de lien `mailto:`** : l'adresse se sélectionne et se copie à la main.
- Vérifié sur coffre COM simulé et dans un navigateur Chromium avec des collaborateurs fictifs ; **à confirmer dans le
  client classique** (IE11), en particulier le contrôle d'appartenance au groupe.

## Piège : « contenu non approuvé » (constaté le 13.10.2026, M-Files 26.9)

Une page de tableau de bord ne doit **jamais naviguer** vers une adresse hors du paquet : le lien
`m-files://show/…` de la 1.0.0 a produit une boîte d'erreur du client, « Le tableau de bord peut ne pas accepter
d'utiliser de contenu non approuvé » (ActiveXWrapper_Explorer.cpp, 314), qu'aucun `try` de la page n'attrape. Même
prudence pour `mailto:`. Un test de construction refuse tout `href` dans la page. Détail : `docs/adr/0004`.

## Développement

Prérequis : Node.js (24 LTS). Dépendances de développement seulement (acorn, ESLint, eslint-plugin-security).

```text
npm install
npm test                 tests node:test (règles, accès, accès COM simulé, présentateur, module, construction)
npm run lint             ESLint, ES5 pour src/
node build.js            dist/appdef.xml, dist/v102/ et dist/trombinoscope-uixv1-1.0.2.zip
node build.js --sans-zip (attention : supprime le .zip de dist/, ne pas commiter dans cet état)
node tests/navigateur/preparer-essai.js   page d'essai hors M-Files (coffre simulé, collaborateurs fictifs)
node scripts/generer-icone.js             régénère src/icones/app.ico
```

`build.js` refuse de livrer un script qui n'est pas de l'ES5 (acorn), deux scripts d'une même page qui déclarent le
même nom global, ou un groupe autorisé non renseigné ; il intègre scripts et styles dans la page (un fichier externe se
charge mal dans le contrôle web).

Architecture (Model / View / Presenter) :

```text
src/
├── appdef.xml                    manifeste v4 ({VERSION}, {DOSSIER} remplis à la construction), <optional>true</optional>
├── icones/app.ico                déclarée dans <files>
├── model/parametrage.js          identifiants du coffre, liste blanche, groupe autorisé, version
├── model/acces.js                appartenance au groupe autorisé (échec fermé), chargé par le module et la page
├── model/regles.js               règles pures : annuaire limité, organisation, hiérarchie, recherche, filtres, tri
├── model/vault-com.js            accès COM en lecture seule
├── presenter/shellui.js          module : commande du volet des tâches (membres seulement), ShowDashboard
├── presenter/trombinoscope.js    présentateur de la page (tourne dans la page), OnNewDashboard
└── view/dashboard/               index.html, rendu.js, trombinoscope.css
tests/                            projet de tests séparé, non livré
```

## Journal des versions

- **1.0.2** (13.10.2026) — application réservée au groupe « SI - membres primaires » (3524) : commande posée aux seuls
  membres, page qui refuse aux autres, échec fermé ; population limitée comme l'export du Cockpit (rattachés à un
  cercle, plus d'étape nulle part, responsable de repli, bandeau) ; « Ouvrir dans M-Files » retiré ; e-mail en texte ;
  `<optional>true</optional>` dans le manifeste.
- **1.0.1** (13.10.2026, jamais installée) — « Ouvrir dans M-Files » par `IShellFrame.NavigateToObject`, remplacé
  en 1.0.2 par le retrait du bouton.
- **1.0.0** (13.10.2026) — première version : grille, liste, recherche, cinq filtres, fiche latérale, lecture par
  lots, liste blanche, sans portraits.
