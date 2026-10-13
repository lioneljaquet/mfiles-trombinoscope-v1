/* exported compat */
/* =====================================================================
   COMPAT \u2014 socle ES5 pour le moteur du module (charg\u00e9 en premier)

   Le module shellui s'ex\u00e9cute dans l'environnement Windows Script Host
   (guide du d\u00e9veloppeur UIX v1, \u00a7 2.7), dont le JScript n'a ni
   Array.prototype.forEach/map/filter/some/every/indexOf ni JSON (constat\u00e9
   sur ce poste avec cscript). Les r\u00e8gles (regles.js, vault-com.js,
   portraits.js) s'en servent : ce fichier les ajoute s'ils manquent, sans
   rien changer l\u00e0 o\u00f9 ils existent (page IE11, Node).

   Il fournit aussi versJson : le module passe la fiche \u00e0 la page de
   l'onglet en texte JSON (des donn\u00e9es simples plut\u00f4t que des objets d'un
   autre moteur de script).
   ===================================================================== */

var compat = (function () {
    "use strict";

    var AP = Array.prototype;

    if (!AP.forEach) {
        AP.forEach = function (fn, ceci) {
            var i;
            for (i = 0; i < this.length; i += 1) {
                if (i in this) {
                    fn.call(ceci, this[i], i, this);
                }
            }
        };
    }
    if (!AP.map) {
        AP.map = function (fn, ceci) {
            var sortie = [];
            var i;
            for (i = 0; i < this.length; i += 1) {
                if (i in this) {
                    sortie[i] = fn.call(ceci, this[i], i, this);
                }
            }
            return sortie;
        };
    }
    if (!AP.filter) {
        AP.filter = function (fn, ceci) {
            var sortie = [];
            var i;
            for (i = 0; i < this.length; i += 1) {
                if (i in this && fn.call(ceci, this[i], i, this)) {
                    sortie.push(this[i]);
                }
            }
            return sortie;
        };
    }
    if (!AP.some) {
        AP.some = function (fn, ceci) {
            var i;
            for (i = 0; i < this.length; i += 1) {
                if (i in this && fn.call(ceci, this[i], i, this)) {
                    return true;
                }
            }
            return false;
        };
    }
    if (!AP.every) {
        AP.every = function (fn, ceci) {
            var i;
            for (i = 0; i < this.length; i += 1) {
                if (i in this && !fn.call(ceci, this[i], i, this)) {
                    return false;
                }
            }
            return true;
        };
    }
    if (!AP.indexOf) {
        AP.indexOf = function (valeur) {
            var i;
            for (i = 0; i < this.length; i += 1) {
                if (this[i] === valeur) {
                    return i;
                }
            }
            return -1;
        };
    }

    // Caract\u00e8res \u00e0 \u00e9chapper dans une cha\u00eene JSON
    var A_ECHAPPER = /[\\"\u0000-\u001f\u2028\u2029]/g;
    var COURTS = { "\"": "\\\"", "\\": "\\\\", "\b": "\\b", "\f": "\\f", "\n": "\\n", "\r": "\\r", "\t": "\\t" };

    /**
     * Cha\u00eene JSON d'un texte.
     *
     * @param {string} texte texte
     * @returns {string} litt\u00e9ral JSON
     */
    function chaine(texte) {
        return "\"" + texte.replace(A_ECHAPPER, function (c) {
            return COURTS.hasOwnProperty(c) ? COURTS[c] : "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4);
        }) + "\"";
    }

    /**
     * Texte JSON de donn\u00e9es simples (textes, nombres, bool\u00e9ens, null,
     * tableaux, objets). Une valeur ind\u00e9finie ou une fonction dans un objet
     * est omise, comme le fait JSON.stringify.
     *
     * @param {*} valeur donn\u00e9es
     * @returns {string} texte JSON
     */
    function versJson(valeur) {
        var parties = [];
        var cle;
        var i;

        if (valeur === null || valeur === undefined) {
            return "null";
        }
        if (typeof valeur === "string") {
            return chaine(valeur);
        }
        if (typeof valeur === "number") {
            return isFinite(valeur) ? String(valeur) : "null";
        }
        if (typeof valeur === "boolean") {
            return valeur ? "true" : "false";
        }
        if (Object.prototype.toString.call(valeur) === "[object Array]") {
            for (i = 0; i < valeur.length; i += 1) {
                parties.push(typeof valeur[i] === "function" ? "null" : versJson(valeur[i]));
            }
            return "[" + parties.join(",") + "]";
        }
        for (cle in valeur) {
            if (valeur.hasOwnProperty(cle) && valeur[cle] !== undefined && typeof valeur[cle] !== "function") {
                parties.push(chaine(cle) + ":" + versJson(valeur[cle]));
            }
        }
        return "{" + parties.join(",") + "}";
    }

    return { versJson: versJson };
}());
