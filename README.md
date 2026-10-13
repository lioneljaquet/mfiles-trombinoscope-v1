# Trombinoscope tebicom pour M-Files Desktop (UIX v1)

Application M-Files UI Extensibility Framework **v1**, pour le client classique M-Files Desktop. Elle reprend le
Trombinoscope du Cockpit PRO directement dans M-Files, en deux surfaces :

- une commande **Trombinoscope** du volet des tâches ouvre, dans la zone de listage, l'annuaire des collaborateurs,
  lu en direct dans le coffre tebifiles ;
- un onglet **Trombinoscope** du volet de droite (depuis la 1.1.0) montre la fiche, **avec la photo**, d'un objet
  Collaborateur sélectionné dans n'importe quelle vue, recherche ou dossier, et en devient l'onglet actif ; ses liens
  ouvrent le trombinoscope déjà filtré.

Lecture seule : l'application n'écrit rien dans le coffre.

- **Réservée aux membres d'un groupe d'utilisateurs M-Files désigné par son alias, `tebifiles.group.trombinoscope`**
  (groupe « trombinoscope », qui contient « SI - membres primaires »), groupes imbriqués compris : la commande et
  l'onglet n'apparaissent qu'à ses membres, et la page refuse d'afficher quoi que ce soit aux autres. Qui a accès se
  règle dans M-Files Admin, sans reconstruire (voir « Régler l'accès » et `docs/adr/0006`).
- **Population limitée comme l'export du Cockpit** : collaborateurs En fonction ou en offboarding **rattachés à un
  cercle** de l'organisation ; l'étape n'apparaît nulle part (ni filtre, ni tri, ni mention) ; un responsable sans
  cercle est remplacé par le premier responsable retenu au-dessus. Bandeau « Données internes : collaborateurs
  rattachés à un cercle (N personnes). » (voir `docs/adr/0005`). L'onglet suit les mêmes règles.
- Grille de cartes (avatar au trigramme) ou liste triable.
- Recherche instantanée sans accent : nom, trigramme, titre, /Titre, fonctions, succursale, cercle, partie locale de
  l'e-mail.
- Quatre filtres à effectifs contextuels : cercle (pastilles), succursale, titre, fonction. Compteur « 12 personnes sur
  94 ».
- Fiche (volet latéral du tableau de bord et onglet) : titre, trigramme, fonctions, succursale, cercle principal,
  e-mail (texte à sélectionner), cercles et rôles, responsable et équipe directe ; titre, fonctions, succursale,
  cercles et personnes sont des liens. Dans le tableau de bord, **Afficher la fiche M-Files** montre la fiche native
  dans le volet de droite sans quitter le trombinoscope.
- **Vue M-Files** (barre du tableau de bord) rend la zone de listage au client. À ne pas confondre avec la bascule
  « Grille / Liste » du trombinoscope, inchangée.
- Version affichée dans la barre de titre et journalisée en console.

## Régler l'accès

L'application cherche, à chaque ouverture de fenêtre du client, le groupe d'utilisateurs qui porte l'alias
**`tebifiles.group.trombinoscope`**, puis vérifie que l'utilisateur connecté en est membre, directement ou par un
groupe membre. Sans ce groupe, **personne n'a accès** (échec fermé).

Mise en place (une fois, dans M-Files Admin › coffre tebifiles › Utilisateurs et groupes, ou « User Groups ») :

1. Créer le groupe d'utilisateurs (nom libre, ici « trombinoscope »).
2. Y ajouter le groupe « SI - membres primaires » comme membre.
3. Dans les propriétés du groupe, onglet « Advanced » (ou « Avancé »), poser l'alias exactement
   `tebifiles.group.trombinoscope`. Un alias porté par deux groupes vaut « introuvable ».

Ensuite, ajouter ou retirer des personnes ou des groupes dans ce groupe suffit : rien à reconstruire ni à
réinstaller. La prise en compte se fait à la **prochaine ouverture du client** (ou d'une nouvelle fenêtre) pour la
commande et l'onglet ; la page la revérifie à chaque ouverture.

## Essai par Lionel (version 1.1.1)

Ordre à respecter : **le groupe doit exister avec son alias AVANT d'installer la 1.1.1**, sinon personne n'a accès
(la commande disparaît pour tous, console `groupe d'accès introuvable : alias tebifiles.group.trombinoscope`).

0. **Vérifier le groupe** : « trombinoscope » existe, contient « SI - membres primaires », et porte l'alias
   `tebifiles.group.trombinoscope` (voir « Régler l'accès »).
1. **Installer** : M-Files Admin › coffre tebifiles › Applications › Installer… ›
   `dist/trombinoscope-uixv1-1.1.1.zip` (remplace la 1.1.0). Accepter, puis vérifier que l'application
   « Trombinoscope tebicom (UIX v1) » est activée.
2. **Redémarrer le client** M-Files Desktop (le client ne recharge pas une application en cours de session). En
   console, attendu : `accès accordé : membre du groupe tebifiles.group.trombinoscope (ID …)`. Si l'essai se fait avec
   un compte **non administrateur** membre du groupe, c'est la preuve que la résolution d'alias fonctionne sans droits
   d'administration (point non garanti par la documentation).
3. **Tableau de bord, inchangé sauf le bouton** : commande Trombinoscope, 94 personnes environ, bandeau bleu ; le
   bouton de la barre s'appelle désormais **Vue M-Files** et rend le listage.
4. **Onglet, membre du groupe** : dans une vue quelconque (ou une recherche), sélectionner **un seul** objet
   Collaborateur d'une personne du trombinoscope. Attendu : un onglet **Trombinoscope** apparaît dans la rangée des
   onglets du volet de droite (après Métadonnées, Aperçu…) et devient actif, avec la fiche et la **photo** si la
   personne en a une affichable. La toute première sélection d'un collaborateur dans la session prend une à quelques
   secondes (le module lit l'annuaire une fois, puis le garde 10 minutes).
5. Dans l'onglet, cliquer une **fonction**, la **succursale**, le **titre**, un **cercle** : le trombinoscope s'ouvre
   dans la zone de listage, filtré sur cette valeur. Cliquer le **responsable** ou un membre de l'**équipe** : le
   trombinoscope s'ouvre sur sa fiche.
6. **Ce qui ne doit pas changer d'onglet** : sélectionner deux objets, un document, un collaborateur hors du
   trombinoscope (sans cercle, ou parti) : l'onglet disparaît, l'onglet précédent reste. Modifier puis enregistrer
   les métadonnées du collaborateur affiché : l'onglet Métadonnées doit rester actif. Dans le tableau de bord,
   **Afficher la fiche M-Files** : l'onglet Métadonnées doit rester actif (l'onglet Trombinoscope apparaît sans prendre
   la main).
7. **Photos** : une personne dont le portrait est un PDF (4 sur le coffre, d'après le Cockpit) ou un fichier de plus de
   4 Mo (1) garde l'avatar au trigramme, avec une note. Vérifier qu'**aucune boîte d'erreur** M-Files n'apparaît à
   l'affichage d'une photo (image en URI data:, jamais essayée sur le client) ; si une boîte « contenu non approuvé »
   apparaissait, la noter telle quelle.
8. **Non-membre** : avec un compte hors du groupe, ni commande ni onglet, et en console
   `commande non ajoutée : l'utilisateur n'est pas membre du groupe tebifiles.group.trombinoscope (ID …)`.
9. **Réglage sans reconstruire** : ajouter un compte d'essai au groupe « trombinoscope » dans M-Files Admin, puis
   rouvrir le client avec ce compte : la commande apparaît. Le retirer : elle disparaît à la réouverture suivante.

Lignes de console attendues (outils F12 attachés au client, par exemple `C:\Windows\System32\F12\IEChooser.exe`) :

```text
[trombinoscope] version 1.1.1 (UIX v1) — nouveau cadre (type 1)        module, à chaque fenêtre
[trombinoscope] accès accordé : membre du groupe tebifiles.group.trombinoscope (ID …)        module, membre
[trombinoscope] commande non ajoutée : l'utilisateur n'est pas membre du groupe tebifiles.group.trombinoscope (ID …)
[trombinoscope] commande non ajoutée : groupe d'accès introuvable : alias tebifiles.group.trombinoscope
[trombinoscope] commande non ajoutée : appartenance illisible : …     module, lecture impossible (échec fermé)
[trombinoscope] annuaire de l'onglet lu : 94 personnes, … ms           module, première sélection d'un collaborateur
[trombinoscope] version 1.1.1 (UIX v1) — onglet ouvert                 onglet, à chaque collaborateur affiché
[trombinoscope] version 1.1.1 (UIX v1) — page ouverte                  tableau de bord, à chaque ouverture
[trombinoscope] annuaire lu : 94 personnes, 348 cercles et rôles, … ms
```

En cas de problème : `lecture interrompue : …` (la page affiche le même message et un bouton Relire), `annuaire non
affiché : …` (page ouverte sans appartenance au groupe : message neutre « Cette application n'est pas disponible pour
votre compte. »), `onglet non affiché : …`, `portraits non lus : …`, `trombinoscope non ouvert depuis l'onglet : …`,
`cadre du client introuvable …`, `sélection virtuelle refusée : …`. La version affichée en haut à droite
(« v1.1.1 (UIX v1) ») dit quel paquet le client sert réellement.

**Mettre à jour** : incrémenter la version de `package.json`, reconstruire avec `node build.js` (le dossier versionné
change, `v112`…, et le .zip est refait), réinstaller le .zip et redémarrer le client (cache).

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
| Groupe d'accès, par son alias (résolu à l'exécution, aucun ID dans le paquet) | `tebifiles.group.trombinoscope` |
| Portraits : documents (type 0) de la classe « !! Photo collaborateur », liés par >Collaborateur ; leurs fichiers (GetFiles) | 88 (classe, propriété 100), 1077 |

Rien d'autre n'est lu : chaque propriété est demandée par son ID (`SearchForProperty`), la fiche n'est jamais
parcourue. Le mobile professionnel (2823), la succursale confidentielle (2824), le salaire, l'adresse, la naissance et
les dossiers RH ne sont pas lus. Les collaborateurs des autres étapes ne sont ni cherchés ni lus ; ceux sans cercle sont
lus mais écartés avant l'affichage ; ni les uns ni les autres n'apparaissent nulle part, pas même comme responsable.

## Limites connues

- **Photos dans l'onglet seulement** : la grille et la liste du tableau de bord gardent l'avatar au trigramme. Formats
  affichés : JPEG, PNG, GIF, BMP, 4 Mo au plus ; PDF (même s'il enveloppe une photo), JPEG 2000, WebP, HEIC, .msg… :
  avatar et note. D'après l'état du Cockpit (42 portraits servis : 29 jpg, 1 jpeg, 8 png, 4 pdf), environ **37 photos
  s'afficheront et 5 non** (4 PDF, 1 JPEG de 9 Mo), sauf document plus ancien affichable. Lecture en mémoire par
  `DownloadFileAsDataURI`, rien sur disque (voir `docs/adr/0008`).
- **Onglet : première sélection plus lente** : le module (sans minuterie) lit l'annuaire d'un bloc à la première
  sélection d'un collaborateur, puis le garde 10 minutes ; une modification faite entre-temps n'apparaît qu'après.
- **Pas de vue Hiérarchie** ni de copie des e-mails (présentes dans le Cockpit, hors de la demande).
- **Pas d'ouverture de l'objet hors de la page** : seule « Afficher la fiche M-Files » est proposée (décision de
  Lionel, `docs/adr/0004`). **Pas de lien `mailto:`** : l'adresse se sélectionne et se copie à la main.
- Vérifié sur coffre COM simulé, dans un navigateur Chromium et, pour le module, dans le JScript de Windows Script
  Host (cscript), avec des collaborateurs fictifs ; **à confirmer dans le client classique** : position et activation
  de l'onglet, photo en URI data:, liens de l'onglet.

## Piège : « contenu non approuvé » (constaté le 13.10.2026, M-Files 26.9)

Une page de tableau de bord ne doit **jamais naviguer** vers une adresse hors du paquet : le lien
`m-files://show/…` de la 1.0.0 a produit une boîte d'erreur du client, « Le tableau de bord peut ne pas accepter
d'utiliser de contenu non approuvé » (ActiveXWrapper_Explorer.cpp, 314), qu'aucun `try` de la page n'attrape. Même
prudence pour `mailto:`. Un test de construction refuse tout `href` dans la page. Détail : `docs/adr/0004`.

## Développement

Prérequis : Node.js (24 LTS). Dépendances de développement seulement (acorn, ESLint, eslint-plugin-security).

```text
npm install
npm test                 tests node:test (règles, accès, accès COM simulé, portraits, présentateurs, module,
                         onglet, construction) et, sous Windows, le module rejoué dans cscript //E:jscript
npm run lint             ESLint, ES5 pour src/
node build.js            dist/appdef.xml, dist/v111/ et dist/trombinoscope-uixv1-1.1.1.zip
node build.js --sans-zip (attention : supprime le .zip de dist/, ne pas commiter dans cet état)
node tests/navigateur/preparer-essai.js   pages d'essai hors M-Files (tableau de bord et onglet, coffre simulé)
node scripts/generer-icone.js             régénère src/icones/app.ico
```

`build.js` refuse de livrer un script qui n'est pas de l'ES5 (acorn), deux scripts d'une même page qui déclarent le
même nom global, ou un alias de groupe d'accès vide ou mal formé ; il intègre scripts et styles dans la page (un fichier externe se
charge mal dans le contrôle web).

Architecture (Model / View / Presenter) :

```text
src/
├── appdef.xml                    manifeste v4 ({VERSION}, {DOSSIER} remplis à la construction), <optional>true</optional>
├── icones/app.ico                déclarée dans <files>
├── model/compat.js               méthodes ES5 et JSON pour le JScript du module (Windows Script Host)
├── model/parametrage.js          identifiants du coffre, liste blanche, groupe autorisé, portraits, version
├── model/acces.js                appartenance au groupe autorisé (échec fermé), chargé par le module et la page
├── model/portraits.js            choix et lecture en mémoire de la photo d'un collaborateur
├── model/regles.js               règles pures : annuaire limité, organisation, hiérarchie, recherche, filtres, tri
├── model/vault-com.js            accès COM en lecture seule
├── presenter/onglet.js           module : onglet du volet de droite selon la sélection
├── presenter/shellui.js          module : commande du volet des tâches et onglet (membres seulement)
├── presenter/trombinoscope.js    présentateurs de la page (tableau de bord, onglet), OnNewDashboard
└── view/dashboard/               index.html, rendu.js, trombinoscope.css
tests/                            projet de tests séparé, non livré
```

## Journal des versions

- **1.1.1** (13.10.2026) — groupe d'accès désigné par l'alias `tebifiles.group.trombinoscope`, résolu à l'exécution
  (`GetUserGroupIDByAlias`) : l'accès se règle dans M-Files Admin sans reconstruire ; plus aucun ID de groupe dans le
  paquet ; alias introuvable = personne n'a accès.
- **1.1.0** (13.10.2026) — onglet « Trombinoscope » du volet de droite pour un collaborateur sélectionné, avec photo
  (URI data: en mémoire, JPEG/PNG/GIF/BMP jusqu'à 4 Mo), liens vers le trombinoscope filtré ; « Revenir au listage »
  devient « Vue M-Files » ; titre et cercle principal de la fiche filtrables ; module compatible avec le JScript de
  Windows Script Host.
- **1.0.2** (13.10.2026) — application réservée au groupe « SI - membres primaires » (3524) : commande posée aux seuls
  membres, page qui refuse aux autres, échec fermé ; population limitée comme l'export du Cockpit (rattachés à un
  cercle, plus d'étape nulle part, responsable de repli, bandeau) ; « Ouvrir dans M-Files » retiré ; e-mail en texte ;
  `<optional>true</optional>` dans le manifeste.
- **1.0.1** (13.10.2026, jamais installée) — « Ouvrir dans M-Files » par `IShellFrame.NavigateToObject`, remplacé
  en 1.0.2 par le retrait du bouton.
- **1.0.0** (13.10.2026) — première version : grille, liste, recherche, cinq filtres, fiche latérale, lecture par
  lots, liste blanche, sans portraits.
