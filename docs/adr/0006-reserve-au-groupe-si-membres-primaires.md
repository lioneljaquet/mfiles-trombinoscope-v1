# 0006 — Application réservée au groupe « SI - membres primaires »

Date : 2026-10-13. Statut : accepté (version 1.0.2), demande de Lionel.

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
