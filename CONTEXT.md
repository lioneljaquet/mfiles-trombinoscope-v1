# Contexte — Trombinoscope M-Files (UIX v1)

Vocabulaire du domaine, partagé par le code, les tests et la documentation.

- **Annuaire** : les personnes que montre le trombinoscope, construites par `regles.construireAnnuaire` à partir des
  fiches et des cercles. Seules les **étapes listées** y entrent.
- **Étape listée** : étape du workflow Collaborateur retenue (En fonction, Offboarding démission, Offboarding
  licenciement). Une personne d'une autre étape n'est mentionnée nulle part.
- **Fiche** : la fiche Collaborateur de M-Files réduite à la **liste blanche** (13 propriétés nommées dans
  `PARAMETRAGE.proprietes`).
- **Trigramme** : la propriété « Initiales » (1079) quand elle compte trois lettres ; sinon le **monogramme**
  (initiales calculées du prénom et du nom, sans particule).
- **Titre** : « Titre (manuel) », à défaut « Titre », à défaut « /Titre » (fonction principale).
- **Organisation** : l'arbre des objets Cercle/rôle sous le cercle **ancre** « tebicom SA » ; « CA » y est rattaché.
  Un **cercle** de l'organisation contient d'autres objets ou se tient sous l'ancre ; les feuilles sont des **rôles** ;
  les objets hors de l'arbre sont **hors organisation**.
- **Cercles d'une personne** : ~Cercles/rôles auto (2928) plus son cercle principal (2929). Le filtre « Cercle » ne
  propose que les cercles de l'organisation ; la fiche montre aussi les rôles.
- **Facette** : une information filtrable (cercle, étape, succursale, titre, fonction). Son **effectif** compte les
  personnes retenues par la recherche et les autres filtres, pas par son propre filtre.
- **Lecture** : une passe complète sur le coffre (recherche par étape, fiches par **lots**, cercles par lots), avec
  progression ; une lecture relancée arrête la précédente.
- **Cadre** : le ShellFrame du client qui a ouvert la page ; il sert au retour au listage et à la **sélection
  virtuelle** (fiche native d'un objet dans le volet de droite).
