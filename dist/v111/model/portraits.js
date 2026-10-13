/* exported portraits */
/* =====================================================================
   PORTRAITS — choix et lecture de la photo d'un collaborateur (ES5 ;
   s'exécute aussi dans le moteur JScript du module, avec compat.js)

   Couche model. Règles reprises du Cockpit PRO
   (cockpit_pro/model/portrait_library.py) : un collaborateur peut avoir
   plusieurs documents « !! Photo collaborateur » ; on les essaie du plus
   récent au plus ancien et on sert le premier qui donne une image ; une
   note dit pourquoi un document plus récent n'a pas servi.

   Différences avec le Cockpit : aucun fichier sur disque (le fichier est
   lu en URI data: par DownloadFileAsDataURI et gardé en mémoire), pas de
   conversion d'image : seuls les formats que le contrôle web IE11 affiche
   (JPEG, PNG, GIF, BMP) sont proposés, et la taille est plafonnée
   (PARAMETRAGE.portrait). Lecture seule.
   ===================================================================== */

var portraits = (function () {
    "use strict";

    // Seule forme acceptée : une image base64 d'un type que la page affiche
    var MOTIF_DATA_URI = /^data:image\/(jpeg|png|gif|bmp);base64,[A-Za-z0-9+\/=\r\n]+$/;
    var NOTE_AUCUN = "Aucun portrait dans M-Files : il s'ajoute par un document de la classe « !! Photo collaborateur ».";
    var NOTE_ERREUR = "Portrait non lu : M-Files n'a pas répondu.";

    /**
     * Taille lisible.
     *
     * @param {number} octets taille
     * @returns {string} « 9,0 Mo »
     */
    function enMo(octets) {
        var dixiemes = Math.round(octets / 104857.6);
        return Math.floor(dixiemes / 10) + "," + (dixiemes % 10) + " Mo";
    }

    /**
     * Vide le cache s'il a trop d'entrées (les portraits sont lourds).
     *
     * @param {object} cache cache du cadre
     * @returns {void}
     */
    function contenir(cache) {
        var n = 0;
        var cle;

        for (cle in cache) {
            if (cache.hasOwnProperty(cle)) {
                n += 1;
            }
        }
        if (n >= PARAMETRAGE.portrait.cacheMax) {
            for (cle in cache) {
                if (cache.hasOwnProperty(cle)) {
                    delete cache[cle];
                }
            }
        }
    }

    /**
     * Raison pour laquelle un fichier ne peut pas servir, ou null s'il
     * peut être lu.
     *
     * @param {object} f fichier { extension, taille }
     * @returns {string|null} raison
     */
    function raisonDEcart(f) {
        if (!PARAMETRAGE.portrait.formats.hasOwnProperty(f.extension)) {
            return "fichier ." + (f.extension || "sans extension");
        }
        if (!(f.taille > 0) || f.taille > PARAMETRAGE.portrait.tailleMax) {
            return "fichier ." + f.extension + " de " + enMo(Math.max(f.taille, 0)) +
                " (plafond " + enMo(PARAMETRAGE.portrait.tailleMax) + ")";
        }
        return null;
    }

    /**
     * Note d'un portrait pris dans un document plus ancien.
     *
     * @param {Array} ecarts raisons des fichiers plus récents écartés
     * @returns {string|null} note, ou null si le premier essayé a servi
     */
    function noteAncien(ecarts) {
        return ecarts.length ? "Un document de portrait plus récent n'a pas pu servir (" + ecarts.join(", ") +
            ") : l'image vient d'un document plus ancien." : null;
    }

    /**
     * Portrait d'un collaborateur : la première image affichable de ses
     * documents, du plus récent au plus ancien. Toute erreur est rattrapée.
     *
     * @param {object} vault coffre COM
     * @param {number} personneId ID du collaborateur
     * @param {object} cache cache du cadre : URI par document, version et fichier
     * @returns {object} { dataUri: texte ou null, note: texte ou null }
     */
    function portraitDe(vault, personneId, cache) {
        var docs;
        var ecarts = [];
        var i;
        var j;
        var doc;
        var f;
        var raison;
        var cle;
        var uri;

        try {
            docs = coffre.chercherPortraits(vault, personneId);
        } catch (e) {
            console.log(PREFIXE_JOURNAL + " portraits non lus : " + ((e && (e.message || e.description)) || e));
            return { dataUri: null, note: NOTE_ERREUR };
        }
        if (!docs.length) {
            return { dataUri: null, note: NOTE_AUCUN };
        }

        for (i = 0; i < docs.length; i += 1) {
            doc = docs[i];
            if (!doc.fichiers.length) {
                ecarts.push("document sans fichier");
            }
            for (j = 0; j < doc.fichiers.length; j += 1) {
                f = doc.fichiers[j];
                raison = raisonDEcart(f);
                if (raison) {
                    ecarts.push(raison);
                    continue;
                }
                // Même document, même version, même fichier : déjà en mémoire
                cle = doc.id + "-" + doc.objVer.Version + "-" + f.id + "-" + f.version;
                if (cache.hasOwnProperty(cle)) {
                    return { dataUri: cache[cle], note: noteAncien(ecarts) };
                }
                try {
                    uri = coffre.lireDataUri(vault, doc.objVer, f.id, f.version);
                } catch (e) {
                    ecarts.push("fichier ." + f.extension + " illisible");
                    continue;
                }
                if (!MOTIF_DATA_URI.test(uri)) {
                    ecarts.push("fichier ." + f.extension + " qui n'est pas une image");
                    continue;
                }
                contenir(cache);
                cache[cle] = uri;
                return { dataUri: uri, note: noteAncien(ecarts) };
            }
        }
        return { dataUri: null, note: "Portrait non affiché : " + ecarts.join(", ") +
            " (formats affichés : JPEG, PNG, GIF, BMP)." };
    }

    return { portraitDe: portraitDe, MOTIF_DATA_URI: MOTIF_DATA_URI };
}());
