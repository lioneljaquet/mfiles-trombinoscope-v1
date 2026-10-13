# 0002 — Tableau de bord dans la zone de listage, lecture directe par lots

Date : 2026-10-13. Statut : accepté.

**Surface.** La commande « Trombinoscope » du volet des tâches appelle `shellFrame.ShowDashboard` : la page occupe la
zone de listage, assez large pour une grille de cartes, et revient au listage par `ShowDefaultContent`. C'est la
surface du squelette du skill m-files-ui-ext-v1 et celle où la sélection virtuelle (`SetVirtualSelection` sur une
`ObjOrFileVers`) a été éprouvée : le listage actif pilote la fiche native pendant que le tableau de bord occupe la
zone. Écartés : la popup (`ShowPopupDashboard`), dont le skill demande de vérifier la signature, et un onglet du volet
droit ou bas, trop étroit pour une grille.

**Lecture.** La page lit le coffre elle-même par l'API COM synchrone : une recherche par étape, les fiches par lots de
20 (`GetPropertiesOfMultipleObjects`), puis les cercles et rôles par lots de 100. Un `setTimeout` sépare chaque appel :
l'écran ne se fige pas et la progression s'affiche. Une recherche plafonnée (plus de 500 résultats) ou vide est une
erreur franche plutôt qu'un annuaire amputé. Rien n'est mis en cache : chaque ouverture relit le coffre.

**Fiche d'une personne.** Dans la page (panneau latéral), avec « Afficher la fiche M-Files » (sélection virtuelle,
voie éprouvée) et un lien `m-files://show/…` au GUID du coffre contrôlé (à confirmer à l'essai).
