# 0004 — La page ne navigue jamais : l'objet s'ouvre par le cadre du client

Date : 2026-10-13. Statut : accepté (version 1.0.1), remplace le lien `m-files://` de la 1.0.0.

## Constat (essai de Lionel, M-Files 26.9.16459.6, paquet 1.0.0)

Un clic sur « Ouvrir dans M-Files », un lien `<a href="m-files://show/{GUID du coffre}/104-{id}">` de la page, affiche
une boîte d'erreur du client :

> Le tableau de bord peut ne pas accepter d'utiliser de contenu non approuvé : m-files://show/…/104-121
> (ActiveXWrapper_Explorer.cpp, 314)

Le contrôle web d'un tableau de bord refuse de naviguer vers un contenu qui n'est pas celui du paquet. Le refus vient
du client, avant tout script : un `try` dans la page ne l'attrape pas. Le skill disait « lien validé, ouvert par le
client » ; c'est bien le client qui doit l'ouvrir, pas la page.

## Décision

- **« Ouvrir dans M-Files »** appelle `IShellFrame.NavigateToObject(IObjID)` sur le cadre que le module transmet
  dans `CustomData` (référence UIX v1 : developer.m-files.com › Legacy › UI Extensibility Framework › Version1 ›
  `MFClientScript~IShellFrame~NavigateToObject`, « Navigates the shell frame to the location of an object »).
  L'ObjID est construit par `new MFiles.ObjID()` puis `SetIDs(104, id)`. C'est une navigation du client, en lecture
  seule : le tableau de bord laisse la place à l'objet et à sa fiche. L'appel est enveloppé dans un `try` ; un refus
  est journalisé (`[trombinoscope] ouverture dans M-Files refusée : …`) et la page affiche un message discret. Sans
  cadre, le bouton n'est pas proposé.
- **Aucun lien sortant dans la page** : les adresses e-mail sont du texte à sélectionner, plus des liens `mailto:`
  (même refus probable, non essayé). Un test de construction exige qu'aucun `href` ne figure dans la page construite.
- « Afficher la fiche M-Files » (sélection virtuelle `ObjOrFileVers`, sans quitter le trombinoscope) ne change pas.

## Options écartées

- `VaultObjectOperations.ShowEditObjectWindow` / `ShowBasicEditObjectWindow` (API COM, mode interface client) : ils
  ouvrent la fiche **en modification** (aucun mode lecture parmi `MFObjectWindowMode`) et demandent un handle de
  fenêtre parent ; une fiche modifiable n'a pas sa place dans une application en lecture seule.
- Garder le lien `m-files://` et l'ouvrir autrement (`window.open`, `location`) : même contrôle web, même refus
  attendu.
