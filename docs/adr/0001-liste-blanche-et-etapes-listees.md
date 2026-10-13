# 0001 — Liste blanche de la fiche Collaborateur et étapes listées

Date : 2026-10-13. Statut : accepté (reprise des ADR 0002, 0010 et 0011 du Cockpit PRO).

La fiche Collaborateur porte, à côté du nom, des données RH (mobile, adresse, naissance, salaire, dossiers). La page
lit le coffre en direct (`dashboard.Vault`) : tout ce qu'elle lit atteint la mémoire de la page. Elle ne lit donc que
les propriétés nommées dans `PARAMETRAGE.proprietes`, une par une, par `SearchForProperty` ; les PropertyValues ne
sont jamais parcourues. Treize propriétés : étape, prénom, nom, initiales, titre, titre manuel, /Titre, fonctions,
succursale, cercle principal, ~Cercles/rôles auto, responsable, e-mail professionnel. Le mobile professionnel (2823) et
la succursale confidentielle (2824) ne sont pas repris.

Les collaborateurs sont cherchés étape par étape (En fonction 319, Offboarding démission 1475, Offboarding
licenciement 1478) : ceux des autres étapes ne sont ni cherchés ni lus. L'étape est relue sur la fiche ; un responsable
absent de l'annuaire est ignoré.

Conséquences : ajouter un champ commence par une décision, puis par une ligne de `PARAMETRAGE.proprietes`. Un test
glisse des valeurs « poison » (mobile, succursale confidentielle, salaire) dans des fiches fictives et exige qu'aucune
ne ressorte ni ne soit lue. L'étape reste affichée seulement comme filtre et comme tri, comme dans le Cockpit en
direct ; c'est une donnée sensible (« Offboarding licenciement » dit le motif d'un départ) à reconsidérer si
l'application est ouverte au-delà de Lionel.
