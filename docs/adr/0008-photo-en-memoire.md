# 0008 — Photo du collaborateur lue en mémoire, en URI data:

Date : 2026-10-13. Statut : accepté (version 1.1.0). Remplace 0003 pour l'onglet du volet de droite ; la grille et la
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
- **Plafond** : 4 Mo par fichier, vérifié AVANT tout téléchargement (`PARAMETRAGE.portrait.tailleMax`). Une photo de
  portrait tient largement en dessous ; d'après l'état du Cockpit, une seule source dépasse (9 Mo).
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

D'après l'état enregistré par le Cockpit (42 portraits servis, sources : 29 jpg, 1 jpeg, 8 png, 4 pdf), environ 37 photos
s'afficheront et 5 non (4 PDF, 1 fichier de 9 Mo), sauf si un document plus ancien affichable prend le relais.
