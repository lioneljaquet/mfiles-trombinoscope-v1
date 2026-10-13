/* exported enTableau, objVerDe, resoudreAliasPropriete, chercherParPropriete,
   lireProprietes, ecrireProprietes, selectionVirtuelle */
/* =====================================================================
   VAULT-COM — accès au coffre en UIX v1 (API COM synchrone, ES5)

   Couche « model ». Expose le même contrat que l'adaptateur v2 (formes
   { property_def, value: { is_null_value, type, data } }) pour que règles
   et vues restent communes aux deux versions. Isole ici toutes les
   particularités COM : collections base 1, appels synchrones,
   CheckOut/SetProperty/CheckIn.
   ===================================================================== */

/**
 * Convertit une collection COM (base 1, .Count/.Item) en tableau.
 *
 * @param {object} collection collection COM
 * @returns {Array} éléments, dans l'ordre
 */
function enTableau(collection) {
    var sortie = [];
    var i;

    if (!collection) {
        return sortie;
    }

    for (i = 1; i <= collection.Count; i += 1) {
        sortie.push(collection.Item(i));
    }

    return sortie;
}

/**
 * ObjVer COM désignant la dernière version d'un objet.
 *
 * @param {number} typeId type d'objet
 * @param {number} id identifiant interne
 * @returns {object} MFiles.ObjVer
 */
function objVerDe(typeId, id) {
    var ov = new MFiles.ObjVer();

    ov.SetIDs(typeId, id, -1);
    return ov;
}

/**
 * Résout un alias de propriété. 0 ou -1 = introuvable.
 *
 * @param {object} vault coffre COM
 * @param {string} alias alias recherché
 * @returns {number} identifiant, ou -1
 */
function resoudreAliasPropriete(vault, alias) {
    try {
        var id = vault.PropertyDefOperations.GetPropertyDefIDByAlias(alias);
        return id > 0 ? id : -1;
    } catch (e) {
        return -1;
    }
}

/**
 * Condition « objet non supprimé ».
 *
 * @returns {object} MFiles.SearchCondition
 */
function conditionNonSupprime() {
    var c = new MFiles.SearchCondition();

    c.ConditionType = MF.EGAL;
    c.Expression.SetStatusValueExpression(MF.STATUS_DELETED, null);
    c.TypedValue.SetValue(MF.DT_BOOLEAN, false);
    return c;
}

/**
 * Cherche les objets dont une propriété lookup désigne un élément.
 *
 * @param {object} vault coffre COM
 * @param {number} propriete identifiant de la propriété
 * @param {number} valeur identifiant de l'élément désigné
 * @param {Array} avertissements complété si le serveur tronque
 * @returns {Array} ObjVer trouvés
 */
function chercherParPropriete(vault, propriete, valeur, avertissements) {
    var conditions = new MFiles.SearchConditions();
    var c = new MFiles.SearchCondition();

    c.ConditionType = MF.EGAL;
    c.Expression.SetPropertyValueExpression(propriete, MF.PARENT_CHILD_NONE, null);
    c.TypedValue.SetValue(MF.DT_LOOKUP, valeur);
    conditions.Add(-1, c);
    conditions.Add(-1, conditionNonSupprime());

    var res = vault.ObjectSearchOperations.SearchForObjectsByConditionsEx(
        conditions, MF.SEARCH_FLAG_NONE, false, PARAMETRAGE.limiteRecherche, 30);

    if (res.MoreResults && avertissements) {
        avertissements.push("Recherche tronquée à " + res.Count + " résultats.");
    }

    return enTableau(res).map(function (version) {
        return version.ObjVer;
    });
}

/**
 * Lit les propriétés d'un objet, converties au format commun v2.
 *
 * @param {object} vault coffre COM
 * @param {object} objVer MFiles.ObjVer
 * @returns {Array} [{ property_def, value: { is_null_value, type, data } }]
 */
function lireProprietes(vault, objVer) {
    var pvs = vault.ObjectPropertyOperations.GetProperties(objVer, true);

    return enTableau(pvs).map(function (pv) {
        var tv = pv.TypedValue || pv.Value;
        var nul = tv.IsNULL();
        var data = {};

        if (!nul && (tv.DataType === MF.DT_LOOKUP || tv.DataType === MF.DT_MULTI_LOOKUP)) {
            data.lookup = { display_value: tv.DisplayValue, item: tv.DataType === MF.DT_LOOKUP ? tv.GetValueAsLookup().Item : null };
        } else if (!nul) {
            data.text = tv.DisplayValue;
        }

        return { property_def: pv.PropertyDef, value: { is_null_value: nul, type: tv.DataType, data: data } };
    });
}

/**
 * Écrit des propriétés : CheckOut, SetProperty par propriété, CheckIn.
 * UndoCheckout sur tout échec, sinon l'objet reste extrait.
 *
 * @param {object} vault coffre COM
 * @param {object} objId MFiles.ObjID
 * @param {Array} changements [{ propertyId, datatype, valeur }]
 * @returns {object} { ok, message }
 */
function ecrireProprietes(vault, objId, changements) {
    if (!changements || !changements.length) {
        return { ok: false, message: "Aucune modification à enregistrer." };
    }

    var extrait = null;

    try {
        extrait = vault.ObjectOperations.CheckOut(objId);

        changements.forEach(function (c) {
            var pv = new MFiles.PropertyValue();

            pv.PropertyDef = c.propertyId;

            if (c.valeur === null || c.valeur === "" || c.valeur === undefined) {
                pv.TypedValue.SetValueToNULL(c.datatype);
            } else {
                pv.TypedValue.SetValue(c.datatype, c.valeur);
            }

            vault.ObjectPropertyOperations.SetProperty(extrait.ObjVer, pv);
        });

        vault.ObjectOperations.CheckIn(extrait.ObjVer);
        return { ok: true, message: "Enregistré." };

    } catch (e) {
        if (extrait) {
            try {
                vault.ObjectOperations.UndoCheckout(extrait.ObjVer);
            } catch (e2) {
                console.log(PREFIXE_JOURNAL + " annulation de l'extraction impossible : " + (e2.message || e2));
            }
        }

        return { ok: false, message: "Enregistrement impossible : " + (e.message || e.description || e) };
    }
}

/**
 * Affiche la fiche native d'un objet absent du listing. Collection
 * ObjOrFileVers (référence v1) : ObjectVersions échoue toujours.
 *
 * @param {object} cadre ShellFrame
 * @param {object} objVer MFiles.ObjVer
 * @returns {boolean} vrai si acceptée
 */
function selectionVirtuelle(cadre, objVer) {
    try {
        var selection = new MFiles.ObjOrFileVers();
        var element = new MFiles.ObjOrFileVer();
        var listing = null;

        try { listing = cadre.ActiveListing; } catch (e) { listing = null; }

        element.ObjVer = objVer;
        selection.Add(-1, element);
        (listing || cadre.Listing).SetVirtualSelection(selection);
        return true;
    } catch (e) {
        console.log(PREFIXE_JOURNAL + " sélection virtuelle refusée : " + (e.message || e));
        return false;
    }
}
