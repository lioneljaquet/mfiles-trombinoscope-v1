# 0004 — La page ne navigue jamais ; pas de bouton « Ouvrir dans M-Files »

Date : 2026-10-13. Statut : accepté (version 1.0.2). Remplace le lien `m-files://` de la 1.0.0 et le
`NavigateToObject` de la 1.0.1 (jamais installée).

## Constat (essai de Lionel, M-Files 26.9.16459.6, paquet 1.0.0)

Un clic sur « Ouvrir dans M-Files », un lien `<a href="m-files://show/{GUID du coffre}/104-{id}">` de la page, affiche
une boîte d'erreur du client :

> Le tableau de bord peut ne pas accepter d'utiliser de contenu non approuvé : m-files://show/…/104-121
> (ActiveXWrapper_Explorer.cpp, 314)

Le contrôle web d'un tableau de bord refuse de naviguer vers un contenu qui n'est pas celui du paquet. Le refus vient
du client, avant tout script : un `try` dans la page ne l'attrape pas.

## Décision finale (Lionel, 13.10.2026)

- **Pas de bouton d'ouverture** : « Afficher la fiche M-Files » (sélection virtuelle `ObjOrFileVers`, sans quitter le
  trombinoscope) fonctionne sur le vrai client et suffit. Le lien `m-files://`, le contrôle du GUID et l'appel
  `IShellFrame.NavigateToObject` essayé en 1.0.1 sont retirés avec leurs tests.
- **Aucun lien sortant dans la page** : les adresses e-mail sont du texte à sélectionner, sans `mailto:` (même refus
  probable, non essayé). Un test de construction exige qu'aucun `href` ne figure dans la page construite.

## Options écartées

- `IShellFrame.NavigateToObject(IObjID)` (référence UIX v1) : voie documentée et en lecture seule, mais elle fait
  quitter le trombinoscope ; jugée inutile par Lionel.
- `VaultObjectOperations.ShowEditObjectWindow` / `ShowBasicEditObjectWindow` : ouvrent la fiche en modification.
