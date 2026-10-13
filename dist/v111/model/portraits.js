/* exported portraits */
/* =====================================================================
   PORTRAITS \u2014 choix et lecture de la photo d'un collaborateur (ES5 ;
   s'ex\u00e9cute aussi dans le moteur JScript du module, avec compat.js)

   Couche model. R\u00e8gles reprises du Cockpit PRO
   (cockpit_pro/model/portrait_library.py) : un collaborateur peut avoir
   plusieurs documents \u00ab !! Photo collaborateur \u00bb ; on les essaie du plus
   r\u00e9cent au plus ancien et on sert le premier qui donne une image.

   Diff\u00e9rences avec le Cockpit : aucun fichier sur disque (le fichier est
   lu en URI data: par DownloadFileAsDataURI et gard\u00e9 en m\u00e9moire), pas de
   conversion d'image : seuls les formats que le contr\u00f4le web IE11 affiche
   (JPEG, PNG, GIF, BMP) sont propos\u00e9s, sans plafond de taille (demande de
   Lionel, 1.1.1). Une note courte n'est donn\u00e9e que si aucune image ne sert
   et qu'un format non pris en charge en est la cause. Lecture seule.
   ===================================================================== */

var portraits = (function () {
    "use strict";

    // Seule forme accept\u00e9e : une image base64 d'un type que la page affiche
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
     * Vide le cache s'il a trop d'entr\u00e9es (les portraits sont lourds).
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
     * Note d'un portrait non affich\u00e9 \u00e0 cause de formats non pris en charge.
     *
     * @param {Array} formats extensions \u00e9cart\u00e9es, en majuscules, sans doublon
     * @returns {string|null} \u00ab Portrait non affich\u00e9 : format PDF non pris en charge. \u00bb, ou null
     */
    function noteFormats(formats) {
        if (!formats.length) {
            return null;
        }
        return "Portrait non affich\u00e9 : " + (formats.length > 1 ? "formats " : "format ") +
            (formats.length > 1 ? formats.slice(0, -1).join(", ") + " et " + formats[formats.length - 1] : formats[0]) +
            " non pris en charge.";
    }

    /**
     * Portrait d'un collaborateur : la premi\u00e8re image affichable de ses
     * documents, du plus r\u00e9cent au plus ancien. Toute erreur est rattrap\u00e9e
     * et journalis\u00e9e ; elle ne donne pas de note.
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
                // M\u00eame document, m\u00eame version, m\u00eame fichier : d\u00e9j\u00e0 en m\u00e9moire
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
                    console.log(PREFIXE_JOURNAL + " portrait \u00e9cart\u00e9 (document " + doc.id + ") : pas une image JPEG, PNG, GIF ou BMP");
                    continue;
                }
                contenir(cache);
                cache[cle] = uri;
                return { dataUri: uri, note: null };
            }
        }
        return { dataUri: null, note: noteFormats(formats) };
    }

    return { portraitDe: portraitDe, MOTIF_DATA_URI: MOTIF_DATA_URI };
}());
