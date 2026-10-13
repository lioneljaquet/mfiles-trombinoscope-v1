# 0006 — Application réservée au groupe « SI - membres primaires »

Date : 2026-10-13. Statut : accepté (version 1.0.2), demande de Lionel ; **amendé en 1.1.1** : le groupe est
désigné par un alias, voir « Amendement 1.1.1 » en fin de fichier. Les mentions de l'ID 3524 ci-dessous décrivent la
1.0.2.

## Décision

- Groupe d'utilisateurs M-Files « SI - membres primaires », ID **3524** (liste de valeurs 16, vérifié dans le coffre
  par la coordinatrice), dans `PARAMETRAGE.groupeAutorise`. `build.js` refuse un ID qui n'est pas un entier positif.
- **Lecture de l'appartenance** (`src/model/acces.js`), d'après la référence de l'API COM M-Files :
  `Vault.SessionInfo` → `SessionInfo.UserAndGroupMemberships` (`UserOrUserGroupIDs` : « the user ID of this session's
  account, as well as the groups to which the user belongs either directly or indirectly ») →
  `GetUserOrUserGroupIDIndex(3524, MFUserOrUserGroupTypeUserGroup = 2)`, qui rend -1 si le groupe est absent. Le
  serveur résout les groupes imbriqués ; le type « groupe » évite de confondre un utilisateur de même ID.
- **Module** : à chaque cadre, la commande « Trombinoscope » n'est créée que pour un membre ; sinon rien n'est posé
  et la console dit `commande non ajoutée : …`.
- **Page** (défense en profondeur) : si elle est ouverte quand même, elle ne lit rien et affiche un message neutre,
  « Cette application n'est pas disponible pour votre compte. ».
- **Échec fermé** : coffre ou session illisible, appel qui lève, groupe mal paramétré = refus.
- `<optional>true</optional>` explicite dans le manifeste, après `<required-mfiles-version>` (ordre de la référence
  du schéma `appdef-client-v4`, « Client Application Definition File (v4) », élément `application`).

## Options écartées

- `UserGroupOperations` (membres d'un groupe, à parcourir en descendant les groupes imbriqués) : plus d'appels, peut
  demander des droits d'administration, et refait ce que `SessionInfo` donne déjà, résolu par le serveur.
- Restreindre par les seuls réglages de l'application dans M-Files Admin : la page resterait ouvrable si le paquet est
  activé pour tous.

## Limite

La réservation masque la commande et la page ; elle ne protège pas les données du coffre, que les droits M-Files
gouvernent. Un non-membre qui a les droits de lecture sur les fiches Collaborateur les voit toujours dans M-Files.

## Amendement 1.1.1 — groupe désigné par son alias

Demande de Lionel : régler l'accès sans reconstruire. Lionel a créé dans le coffre le groupe d'utilisateurs
« trombinoscope », qui contient « SI - membres primaires », avec l'alias **`tebifiles.group.trombinoscope`**.

- `PARAMETRAGE.groupeAutorise` porte l'alias ; plus aucun ID de groupe dans les sources ni le paquet.
- **Résolution** à l'exécution, dans le module (à chaque cadre) et dans la page (à chaque ouverture), par
  `Vault.UserGroupOperations.GetUserGroupIDByAlias(Alias As String) As Long` (référence de l'API COM :
  « Returns -1 if a match is not found or if more than one user group uses the specified alias »). Un retour de 0 ou
  moins vaut introuvable, comme le skill le fait pour les autres alias. Puis contrôle d'appartenance inchangé
  (`SessionInfo.UserAndGroupMemberships`, membres indirects compris).
- **Droits** : la référence n'indique aucune restriction (ni mode, ni droit) pour cette méthode, qui ne fait pas
  partie des méthodes « …Admin » de `VaultUserGroupOperations`. Qu'un utilisateur non administrateur puisse l'appeler
  n'est pas démontré par la documentation : à confirmer par l'essai d'un compte non administrateur membre du groupe.
  Si elle était refusée, l'échec reste fermé (personne n'a accès) et la console le dit.
- **Échec fermé** : alias absent, ambigu, résolution en échec, appartenance illisible : ni commande, ni onglet, page
  neutre. Console : `groupe d'accès introuvable : alias tebifiles.group.trombinoscope` (suivi de la cause quand la
  résolution lève).
- `build.js` refuse un alias vide ou mal formé (segments séparés par des points, même motif que `acces.js`).
- **Ordre de déploiement** : le groupe et son alias doivent exister avant l'installation de la 1.1.1.
- **Prise en compte d'un changement de membres** : à la prochaine ouverture du client ou d'une fenêtre pour la
  commande et l'onglet ; à chaque ouverture pour la page.
