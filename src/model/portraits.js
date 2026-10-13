/* exported portraits */
/* =====================================================================
   PORTRAITS — choix et lecture de la photo d'un collaborateur (ES5 ;
   s'exécute aussi dans le moteur JScript du module, avec compat.js)

   Couche model. Règles reprises du Cockpit PRO
   (cockpit_pro/model/portrait_library.py) : un collaborateur peut avoir
   plusieurs documents « !! Photo collaborateur » ; on les essaie du plus
   récent au plus ancien et on sert le premier qui donne une image.

   Différences avec le Cockpit : aucun fichier sur disque (le fichier est
   lu en URI data: par DownloadFileAsDataURI et gardé en mémoire), pas de
   conversion d'image : seuls les formats que le contrôle web IE11 affiche
   (JPEG, PNG, GIF, BMP) sont proposés, sans plafond de taille (demande de
   Lionel, 1.1.1). Une note courte n'est donnée que si aucune image ne sert
   et qu'un format non pris en charge en est la cause. Lecture seule.
   ===================================================================== */

var portraits = (function () {
    "use strict";

    // Seule forme acceptée : une image base64 d'un type que la page affiche
    var MOTIF_DATA_URI = /^data:image\/(jpeg|png|gif|bmp);base64,[A-Za-z0-9+\/=\r\n]+$/;

    /**
     * Message lisible d'une erreur COM.
     *
     * @param {*} e erreur
     * @returns {string} message
     */
    function messageDe(e) {
        return (e && (e.message || e.description)) || String(e);
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
     * Note d'un portrait non affiché à cause de formats non pris en charge.
     *
     * @param {Array} formats extensions écartées, en majuscules, sans doublon
     * @returns {string|null} « Portrait non affiché : format PDF non pris en charge. », ou null
     */
    function noteFormats(formats) {
        if (!formats.length) {
            return null;
        }
        return "Portrait non affiché : " + (formats.length > 1 ? "formats " : "format ") +
            (formats.length > 1 ? formats.slice(0, -1).join(", ") + " et " + formats[formats.length - 1] : formats[0]) +
            " non pris en charge.";
    }

    /**
     * Portrait d'un collaborateur : la première image affichable de ses
     * documents, du plus récent au plus ancien. Toute erreur est rattrapée
     * et journalisée ; elle ne donne pas de note.
     *
     * @param {object} vault coffre COM
     * @param {number} personneId ID du collaborateur
     * @param {object} cache cache du cadre : URI par document, version et fichier
     * @returns {object} { dataUri: texte ou null, note: texte ou null }
     */
    function portraitDe(vault, personneId, cache) {
        var docs;
        var formats = [];
        var i;
        var j;
        var doc;
        var f;
        var format;
        var cle;
        var uri;

        try {
            docs = coffre.chercherPortraits(vault, personneId);
        } catch (e) {
            console.log(PREFIXE_JOURNAL + " portraits non lus : " + messageDe(e));
            return { dataUri: null, note: null };
        }

        for (i = 0; i < docs.length; i += 1) {
            doc = docs[i];
            for (j = 0; j < doc.fichiers.length; j += 1) {
                f = doc.fichiers[j];
                if (!PARAMETRAGE.portrait.formats.hasOwnProperty(f.extension)) {
                    format = (f.extension || "sans extension").toUpperCase();
                    if (formats.indexOf(format) < 0) {
                        formats.push(format);
                    }
                    continue;
                }
                // Même document, même version, même fichier : déjà en mémoire
                cle = doc.id + "-" + doc.objVer.Version + "-" + f.id + "-" + f.version;
                if (cache.hasOwnProperty(cle)) {
                    return { dataUri: cache[cle], note: null };
                }
                try {
                    uri = coffre.lireDataUri(vault, doc.objVer, f.id, f.version);
                } catch (e) {
                    console.log(PREFIXE_JOURNAL + " portrait illisible (document " + doc.id + ") : " + messageDe(e));
                    continue;
                }
                if (!MOTIF_DATA_URI.test(uri)) {
                    console.log(PREFIXE_JOURNAL + " portrait écarté (document " + doc.id + ") : pas une image JPEG, PNG, GIF ou BMP");
                    continue;
                }
                contenir(cache);
                cache[cle] = uri;
                return { dataUri: uri, note: null };
            }
        }
        return { dataUri: null, note: noteFormats(formats) };
    }

    /**
     * Vrai si le collaborateur a au moins un fichier de portrait dans un
     * format affichable, sans rien télécharger : une recherche et la liste
     * des fichiers de ses documents (GetFiles). Toute erreur vaut « non ».
     *
     * @param {object} vault coffre COM
     * @param {number} personneId ID du collaborateur
     * @returns {boolean} une photo peut être proposée
     */
    function photoDisponible(vault, personneId) {
        try {
            return coffre.chercherPortraits(vault, personneId).some(function (doc) {
                return doc.fichiers.some(function (f) {
                    return PARAMETRAGE.portrait.formats.hasOwnProperty(f.extension);
                });
            });
        } catch (e) {
            console.log(PREFIXE_JOURNAL + " portraits non lus : " + messageDe(e));
            return false;
        }
    }

    return { portraitDe: portraitDe, photoDisponible: photoDisponible, MOTIF_DATA_URI: MOTIF_DATA_URI };
}());
