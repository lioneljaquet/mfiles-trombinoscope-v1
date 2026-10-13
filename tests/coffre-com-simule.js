/**
 * Coffre COM simulé, fidèle sur les points qui ont piégé : collections
 * base 1, refus de tout autre type que ObjOrFileVers pour la sélection
 * virtuelle, échecs injectables pour vérifier UndoCheckout.
 */

/**
 * Collection COM : Count, Item(i) en base 1, Add(-1, x).
 *
 * @param {Array} elements contenu initial
 * @param {string} genre nom du type de collection
 * @returns {object} collection
 */
function collection(elements, genre) {
    const contenu = elements.slice();
    return {
        genre,
        get Count() { return contenu.length; },
        Item(i) { if (i < 1 || i > contenu.length) { throw new Error("index hors limites"); } return contenu[i - 1]; },
        Add(pos, x) { contenu.push(x); }
    };
}

/**
 * Construit MFiles + vault simulés.
 *
 * @param {object} options { echecSur }
 * @returns {object} { MFiles, vault, journal }
 */
function creerCoffreCom(options) {
    const opts = options || {};
    const journal = { appels: [], selection: null };

    const TypedValue = function () {
        this.DataType = 0; this.Value = null;
        this.SetValue = function (dt, v) { this.DataType = dt; this.Value = v; };
        this.SetValueToNULL = function (dt) { this.DataType = dt; this.Value = null; };
    };

    const MFiles = {
        ObjVer: function () { this.SetIDs = function (t, id, v) { this.Type = t; this.ID = id; this.Version = v; }; },
        PropertyValue: function () { this.PropertyDef = 0; this.TypedValue = new TypedValue(); },
        ObjOrFileVers: function () { return collection([], "ObjOrFileVers"); },
        ObjOrFileVer: function () { this.ObjVer = null; },
        ObjectVersions: function () { return collection([], "ObjectVersions"); }
    };

    /**
     * Enregistre un appel et lève s'il est désigné comme échec.
     *
     * @param {string} nom méthode appelée
     * @returns {void}
     */
    function appel(nom) {
        journal.appels.push(nom);
        if (opts.echecSur === nom) { throw new Error(nom + " refusé"); }
    }

    const vault = {
        ObjectOperations: {
            CheckOut() { appel("CheckOut"); return { ObjVer: { ID: 1, Version: 2 } }; },
            CheckIn() { appel("CheckIn"); },
            UndoCheckout() { appel("UndoCheckout"); }
        },
        ObjectPropertyOperations: { SetProperty() { appel("SetProperty"); } }
    };

    const listing = {
        SetVirtualSelection(c) {
            if (!c || c.genre !== "ObjOrFileVers") { throw new Error("collection ObjOrFileVers attendue"); }
            journal.selection = c;
        }
    };

    return { MFiles, vault, journal, cadre: { ActiveListing: listing } };
}

module.exports = { creerCoffreCom, collection };
