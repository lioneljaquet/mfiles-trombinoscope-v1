/**
 * Coffre COM simulé, fidèle sur les points qui ont piégé en UIX v1 :
 * collections base 1 (Count, Item(i), Add(-1, x)), recherches par
 * conditions avec MoreResults, PropertyValues (IndexOf, SearchForProperty),
 * TypedValue qui refuse une lecture du mauvais type, sélection virtuelle
 * qui n'accepte qu'une ObjOrFileVers. Tient le journal des appels et des
 * propriétés lues, pour vérifier la liste blanche et les lectures par lots.
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
 * TypedValue en lecture, à partir d'une valeur simulée.
 *
 * @param {object|null} valeur { type, valeur } (type : 1 texte, 9 lookup, 10 multi)
 * @returns {object} TypedValue
 */
function typedValueLue(valeur) {
    const v = valeur || { type: 1, valeur: null };
    const nul = v.valeur === null || v.valeur === undefined || (Array.isArray(v.valeur) && !v.valeur.length);
    const lookup = (l) => ({ Item: l.id, DisplayValue: l.nom, Deleted: Boolean(l.supprime) });
    return {
        DataType: v.type,
        IsNULL() { return nul; },
        get DisplayValue() {
            if (nul) { return ""; }
            if (v.type === 9) { return v.valeur.nom; }
            if (v.type === 10) { return v.valeur.map((l) => l.nom).join("; "); }
            return String(v.valeur);
        },
        GetValueAsLookup() {
            if (v.type !== 9) { throw new Error("GetValueAsLookup sur un type " + v.type); }
            return lookup(v.valeur);
        },
        GetValueAsLookups() {
            if (v.type !== 10) { throw new Error("GetValueAsLookups sur un type " + v.type); }
            return collection((v.valeur || []).map(lookup), "Lookups");
        }
    };
}

/**
 * Construit MFiles + vault simulés.
 *
 * @param {object} [options] { objets: [{ type, id, titre, supprime, props: { id: { type, valeur } } }],
 *     limiteServeur: plafond de résultats, guid }
 * @returns {object} { MFiles, vault, journal, cadre }
 */
function creerCoffreCom(options) {
    const opts = options || {};
    const objets = opts.objets || [];
    const journal = { appels: [], proprietesLues: [], selection: null, conditions: [] };

    const TypedValue = function () {
        this.DataType = 0; this.Value = null;
        this.SetValue = function (dt, v) {
            if (typeof dt !== "number") { throw new Error("datatype numérique attendu"); }
            this.DataType = dt; this.Value = v;
        };
        this.SetValueToNULL = function (dt) { this.DataType = dt; this.Value = null; };
    };
    const Expression = function () {
        this.SetPropertyValueExpression = function (prop, pc) { this.genre = "propriete"; this.cible = prop; this.pc = pc; };
        this.SetStatusValueExpression = function (statut) { this.genre = "statut"; this.cible = statut; };
    };

    const MFiles = {
        ObjVer: function () { this.SetIDs = function (t, id, v) { this.Type = t; this.ID = id; this.Version = v; }; },
        ObjVers: function () { return collection([], "ObjVers"); },
        ObjID: function () { this.SetIDs = function (t, id) { this.Type = t; this.ID = id; }; },
        TypedValue,
        SearchCondition: function () { this.ConditionType = 0; this.Expression = new Expression(); this.TypedValue = new TypedValue(); },
        SearchConditions: function () { return collection([], "SearchConditions"); },
        ObjOrFileVers: function () { return collection([], "ObjOrFileVers"); },
        ObjOrFileVer: function () { this.ObjVer = null; },
        ObjectVersions: function () { return collection([], "ObjectVersions"); }
    };

    /**
     * Vrai si un objet satisfait une condition simulée.
     *
     * @param {object} o objet simulé
     * @param {object} c SearchCondition
     * @returns {boolean} satisfaite
     */
    function satisfait(o, c) {
        const attendu = c.TypedValue.Value;
        if (c.ConditionType !== 1) { throw new Error("condition non simulée : " + c.ConditionType); }
        if (c.Expression.genre === "statut" && c.Expression.cible === 6) { return o.type === attendu; }
        if (c.Expression.genre === "statut" && c.Expression.cible === 5) { return Boolean(o.supprime) === attendu; }
        if (c.Expression.genre === "propriete") {
            const p = (o.props || {})[c.Expression.cible];
            return Boolean(p && p.type === 9 && p.valeur && p.valeur.id === attendu);
        }
        throw new Error("expression non simulée");
    }

    /**
     * PropertyValues simulé : seul accès aux valeurs, journalisé.
     *
     * @param {object} o objet simulé
     * @returns {object} PropertyValues
     */
    function proprietes(o) {
        const ids = Object.keys(o.props || {}).map(Number);
        const pv = (id) => {
            journal.proprietesLues.push(id);
            return { PropertyDef: id, TypedValue: typedValueLue(o.props[id]) };
        };
        return {
            genre: "PropertyValues",
            get Count() { return ids.length; },
            Item(i) { if (i < 1 || i > ids.length) { throw new Error("index hors limites"); } return pv(ids[i - 1]); },
            IndexOf(id) { const i = ids.indexOf(id); return i < 0 ? -1 : i + 1; },
            SearchForProperty(id) {
                if (ids.indexOf(id) < 0) { throw new Error("propriété absente : " + id); }
                return pv(id);
            }
        };
    }

    const objetDe = (ov) => objets.filter((o) => o.type === ov.Type && o.id === ov.ID)[0];

    const vault = {
        GetGUID() { return opts.guid || "{1A2B3C4D-0000-1111-2222-333344445555}"; },
        ObjectSearchOperations: {
            SearchForObjectsByConditionsEx(conditions, drapeaux, trier, limite) {
                if (!conditions || conditions.genre !== "SearchConditions") { throw new Error("SearchConditions attendu"); }
                journal.appels.push("Search");
                const liste = [];
                for (let i = 1; i <= conditions.Count; i += 1) { liste.push(conditions.Item(i)); }
                journal.conditions.push(liste);
                const trouves = objets.filter((o) => liste.every((c) => satisfait(o, c)));
                const plafond = Math.min(limite, opts.limiteServeur || limite);
                const res = collection(trouves.slice(0, plafond).map((o) => ({
                    ObjVer: { Type: o.type, ID: o.id, Version: 7 }, Title: o.titre
                })), "ObjectSearchResults");
                res.MoreResults = trouves.length > plafond;
                return res;
            }
        },
        ObjectPropertyOperations: {
            GetProperties(ov) {
                journal.appels.push("GetProperties");
                return proprietes(objetDe(ov));
            },
            GetPropertiesOfMultipleObjects(ovs) {
                if (!ovs || ovs.genre !== "ObjVers") { throw new Error("collection ObjVers attendue"); }
                journal.appels.push("GetPropertiesOfMultipleObjects:" + ovs.Count);
                const sortie = [];
                for (let i = 1; i <= ovs.Count; i += 1) { sortie.push(proprietes(objetDe(ovs.Item(i)))); }
                return collection(sortie, "PropertyValuesOfMultipleObjects");
            }
        }
    };

    const listing = {
        SetVirtualSelection(c) {
            if (!c || c.genre !== "ObjOrFileVers") { throw new Error("collection ObjOrFileVers attendue"); }
            journal.selection = c;
        }
    };

    return { MFiles, vault, journal, cadre: { ActiveListing: listing, CurrentPath: "" } };
}

/**
 * Valeurs simulées d'une propriété.
 */
const valeur = {
    texte: (v) => ({ type: 1, valeur: v }),
    lookup: (id, nom) => ({ type: 9, valeur: { id, nom } }),
    multi: (liste) => ({ type: 10, valeur: liste.map(([id, nom]) => ({ id, nom })) })
};

module.exports = { creerCoffreCom, collection, valeur };
