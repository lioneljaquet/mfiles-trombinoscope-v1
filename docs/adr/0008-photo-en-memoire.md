# 0008 — Photo du collaborateur lue en mémoire, en URI data:

Date : 2026-10-13. Statut : accepté (version 1.1.0) ; amendé en 1.1.1 (plus de plafond, note courte) et en 1.1.2
(bouton « Afficher la photo » dans la fiche du tableau de bord). Remplace 0003 pour l'onglet du volet de droite ; la grille et la
liste du tableau de bord restent sans photo (non demandé).

## Décision

- **Quels documents** : règles du Cockpit (`cockpit_pro/model/portrait_library.py`) : documents (type 0) de la classe
  « !! Photo collaborateur » (88) dont >Collaborateur (1077) désigne la personne, non supprimés, du plus récent au plus
  ancien (ID de document décroissant) ; le premier fichier qui donne une image sert ; une note dit pourquoi un
  document plus récent n'a pas servi.
- **Lecture sans disque** : `VaultObjectFileOperations.DownloadFileAsDataURI(ObjVer, File, FileVersion)`, qui rend une
  URI `data:` base64. La référence de l'API COM le dit « especially useful » pour l'UI Extensibility Framework
  (petites images d'un tableau de bord). La lecture par blocs (`DownloadFileInBlocks_*`) est écartée : la référence la
  réserve au mode « server interface », et elle demanderait de convertir des tableaux d'octets en JScript. Les
  fichiers se listent par `GetFiles(ObjVer)` ; la taille par `LogicalSize_32bit` (l'entier 64 bits de `LogicalSize`
  n'est pas sûr en JScript).
- **Formats** : ceux que le contrôle web IE11 affiche, JPEG, PNG, GIF, BMP. PDF (même s'il enveloppe une photo),
  JPEG 2000, WebP, HEIC, documents Office ou .msg : avatar au trigramme et note. Le Cockpit, lui, convertissait avec
  Pillow ; ici, aucune conversion.
- **Taille** : pas de plafond (demande de Lionel après l'essai de la 1.1.0, où une photo de 8,8 Mo restait à
  l'avatar). Le plafond de 4 Mo de la 1.1.0 et le repli sur un document plus ancien pour cause de taille sont
  retirés. `DownloadFileAsDataURI` ne prend pas en charge plus de 64 Mo (référence) : au-delà, l'appel lève, l'erreur
  est journalisée et l'avatar reste.
- **Note** : seulement quand aucune image ne sert ET qu'un format non pris en charge en est la cause, courte :
  « Portrait non affiché : format PDF non pris en charge. » (plusieurs formats : « formats PDF et MSG … »). Aucune
  note pour une personne sans document, ni pour une panne de lecture (journalisée en console).
- **Contrôle** : seule une URI `data:image/(jpeg|png|gif|bmp);base64,…` est acceptée, au module puis à la page.
- **Cache** : en mémoire, par cadre, clé document–version–fichier–version ; 40 entrées au plus, puis vidé. Rien sur
  disque. Une nouvelle version du document est relue.
- **Affichage** : un fond `background-size: cover` sur le grand avatar (IE11 n'a pas `object-fit`) ; le trigramme
  reste dessous si l'image ne se charge pas.

## À confirmer sur le client

Une image en URI `data:` n'est pas une navigation : elle ne devrait pas déclencher le refus « contenu non approuvé »
du tableau de bord (0004), mais rien ne l'a encore montré sur le client. En cas de boîte d'erreur, repli : avatar seul
et note.

## Volume attendu sur le coffre réel

D'après l'état enregistré par le Cockpit (42 portraits servis, sources : 29 jpg, 1 jpeg, 8 png, 4 pdf), environ 38 photos
s'afficheront et 4 non (les PDF), sauf si un document plus ancien affichable prend le relais.

## Amendement 1.1.2 — « Afficher la photo » dans la fiche du tableau de bord

Demande de Lionel : à côté de « Afficher la fiche M-Files », un bouton « Afficher la photo » si elle existe, qui remplace
le rond au trigramme.

- **Savoir s'il y a une photo sans la télécharger** : à l'ouverture d'une fiche (pas à la lecture de l'annuaire, qui
  ferait une recherche par personne), `portraits.photoDisponible` cherche les documents de portrait de la personne et
  lit l'extension de leurs fichiers (`GetFiles`). Vrai s'il existe un fichier JPEG, PNG, GIF ou BMP. Résultat gardé
  pour la page ; une erreur vaut « non » (pas de bouton) et se journalise.
- **Au clic** : `portraits.portraitDe` (mêmes règles que l'onglet, sans plafond), en mémoire, avec un cache pour la
  page. La photo remplace le trigramme ; le bouton devient « Afficher le trigramme » (décision : bascule offerte, pour
  revenir au rond sans changer de fiche).
- **Fiche suivante ou précédente, autre personne, fermeture** : chaque fiche s'ouvre sur le trigramme ; la photo
  affichée ne suit jamais une autre personne. Revenir à une personne et réafficher sa photo la reprend du cache.
- **Échec de lecture** : trigramme gardé, message discret « La photo n'a pas pu être lue. », ligne de console ; aucune
  exception, aucune boîte d'erreur.
- **Onglet du volet de droite** : inchangé, la photo y est affichée d'office, sans bouton.
- Grille et liste : toujours sans photo.
