# 0003 — Pas de portraits dans la version 1.0

Date : 2026-10-13. Statut : accepté, à rouvrir si une voie est éprouvée.

Le Cockpit PRO montre les portraits des documents « !! Photo collaborateur » (classe 88) ; il les télécharge par son
serveur. Dans le contrôle web IE11 du client classique, aucune voie fiable n'est connue pour afficher le fichier d'un
document : ni le skill m-files-ui-ext-v1 ni un projet livré ne l'ont éprouvée. Les pistes (télécharger le fichier dans
un dossier temporaire par `ObjectFileOperations.DownloadFile` puis l'afficher en `file://`, lire le fichier par blocs et
le passer en `data:` ; chemin du lecteur M-Files) demandent chacune un essai dans le client, et la première laisse la
photo d'un collaborateur sur le disque du poste.

Décision : avatar au trigramme, teinté par personne, comme le repli du Cockpit. À rouvrir par un prototype dans le
client si Lionel tient aux photos.
