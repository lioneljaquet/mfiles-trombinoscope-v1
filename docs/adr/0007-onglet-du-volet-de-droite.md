# 0007 — Onglet « Trombinoscope » du volet de droite, posé par le module

Date : 2026-10-13. Statut : accepté (version 1.1.0), demande de Lionel : « Lorsque je sélectionne un objet
Collaborateur, dans n'importe quelle vue M-Files, j'aimerais que l'onglet de droite utilisé dans le trombinoscope
s'affiche dans les onglets, comme onglet par défaut, avec la photo ; les liens pointeraient vers le trombinoscope. »

## Décision

- **Qui décide** : le module seul (`presenter/onglet.js`). Il suit `shellFrame.Listing.Events` (`Event_SelectionChanged`),
  crée l'onglet (`RightPane.AddTab`) à la première personne à montrer, règle `Visible` et appelle `Select()`. La page
  de l'onglet ne touche jamais à la visibilité (piège v1 du skill : `dashboard.Parent` est le volet entier).
- **Quand** : la sélection compte un seul objet, de type Collaborateur (104), d'une personne de l'annuaire (étape listée
  et cercle de l'organisation, mêmes règles que le tableau de bord, `regles.ficheDe`). Sinon l'onglet est masqué et
  M-Files garde ou choisit l'onglet précédent. Toute vue, recherche ou dossier : c'est le listage du cadre qui est
  suivi. Un état par cadre ; un cadre sans volet droit (dialogue) est toléré.
- **Position** : `AddTab(id, titre, "_last")`, repli `"_home"`, comme le squelette du skill (d'après le Project
  Dashboard v1). La référence UIX v1 documente `_first` et `_last` (« Pinned » reste en dernier dans les versions
  récentes) ; `_home` n'y figure pas, c'est seulement le repli éprouvé. L'onglet se range donc après Métadonnées et
  Aperçu.
- **Focus** : `Select()` seulement quand la personne affichée change. Une sélection identique (enregistrement des
  métadonnées, listage rafraîchi) ne relit rien et ne prend pas la main ; une sélection multiple masque l'onglet sans
  rien activer. Après « Afficher la fiche M-Files » dans le tableau de bord, la page l'écrit dans l'état du cadre
  (`etatCadre.selectionVirtuelle`), et le module affiche l'onglet sans le rendre actif. La référence UIX v1 rappelle
  que M-Files peut lui-même changer d'onglet quand la sélection change : à confirmer sur le client.
- **Données** : le module lit l'annuaire d'un bloc (mêmes recherches et lots que la page) à la première sélection
  d'un collaborateur, le garde 10 minutes pour le ShellUI, puis ne lit à chaque personne que ses documents de portrait
  (0008). Il passe à la page la fiche et la photo en **texte JSON** (`compat.versJson`), pas en objets d'un autre
  moteur de script. La page de l'onglet revérifie l'accès (groupe d'accès, 0006) et ne lit rien d'autre du coffre.
- **Liens** : titre, fonctions, succursale, cercles de l'organisation, responsable et équipe ouvrent le trombinoscope
  dans la zone de listage, avec le filtre déjà posé ou la fiche ouverte (`CustomData.action`, appliquée une fois après
  la lecture). Aucun `href` (0004).

## Écarts au cadrage, imposés par la v1

- **Moteur du module** : le module s'exécute dans Windows Script Host (guide du développeur UIX v1, § 2.7), dont le
  JScript n'a ni `forEach` ni `JSON` (vérifié sur ce poste). `model/compat.js` ajoute ce qui manque ; un test rejoue
  le module dans `cscript //E:jscript`.
- **Pas de minuterie dans le module** : la lecture de l'annuaire y est synchrone. La première sélection d'un
  collaborateur dans la session peut figer le client une à quelques secondes (la page, elle, lit par lots).
- **Ouverture du trombinoscope depuis un lien** : c'est la page de l'onglet qui appelle `ShowDashboard` sur le **cadre
  transmis par le module** (`CustomData.cadre`) ; la v1 n'a pas de canal documenté de la page vers le code du module.
  L'effet est le même : le client affiche le tableau de bord dans la zone de listage de ce cadre.
