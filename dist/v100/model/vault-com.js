/* exported coffre */
/* =====================================================================
   VAULT-COM — accès au coffre en UIX v1 (API COM synchrone, ES5)

   Couche model. Isole toutes les particularités COM (collections base 1,
   constructeurs MFiles.*, recherches par conditions) et rend des objets
   JavaScript simples aux règles (regles.js).

   Lecture seule : ce module n'écrit rien dans le coffre.

   CONFIDENTIALITÉ : une fiche n'est lue que propriété par propriété, par
   SearchForProperty sur les identifiants de la liste blanche
   (PARAMETRAGE.proprietes). Les PropertyValues ne sont jamais parcourues :
   une propriété qui n'est pas nommée ici n'est jamais lue, donc ne peut
   pas fuiter vers la page.
   ===================================================================== */

var coffre = (function () {
    "use strict";

    // GUID de coffre accepté pour un lien m-files:// (rien d'autre ne passe)
    var MOTIF_GUID = /^\{?([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})\}?$/;

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
     * Condition sur une valeur de statut (type d'objet, supprimé).
     *
     * @param {number} statut MF.STATUS_*
     * @param {number} datatype MF.DT_*
     * @param {*} valeur valeur attendue
     * @returns {object} MFiles.SearchCondition
     */
    function conditionStatut(statut, datatype, valeur) {
        var c = new MFiles.SearchCondition();

        c.ConditionType = MF.EGAL;
        c.Expression.SetStatusValueExpression(statut, null);
        c.TypedValue.SetValue(datatype, valeur);
        return c;
    }

    /**
     * Condition « propriété lookup égale à un élément ».
     *
     * @param {number} propriete identifiant de la propriété
     * @param {number} valeur identifiant de l'élément
     * @returns {object} MFiles.SearchCondition
     */
    function conditionLookup(propriete, valeur) {
        var c = new MFiles.SearchCondition();

        c.ConditionType = MF.EGAL;
        c.Expression.SetPropertyValueExpression(propriete, MF.PARENT_CHILD_NONE, null);
        c.TypedValue.SetValue(MF.DT_LOOKUP, valeur);
        return c;
    }

    /**
     * Lance une recherche ; un résultat plafonné est une erreur franche :
     * un annuaire amputé sans le dire serait pire qu'un échec.
     *
     * @param {object} vault coffre COM
     * @param {Array} liste conditions
     * @param {string} quoi ce qui est cherché, pour le message
     * @returns {Array} ObjectVersion trouvées
     */
    function chercher(vault, liste, quoi) {
        var conditions = new MFiles.SearchConditions();
        var res;

        liste.forEach(function (c) {
            conditions.Add(-1, c);
        });
        // Délai 0 : pas de délai de recherche imposé par l'application
        res = vault.ObjectSearchOperations.SearchForObjectsByConditionsEx(
            conditions, MF.SEARCH_FLAG_NONE, false, PARAMETRAGE.limiteRecherche, 0);

        if (res.MoreResults) {
            throw new Error("M-Files compte plus de " + PARAMETRAGE.limiteRecherche + " " + quoi +
                " : annuaire incomplet, lecture interrompue.");
        }
        return enTableau(res);
    }

    /**
     * Collaborateurs d'une étape de workflow (non supprimés).
     *
     * @param {object} vault coffre COM
     * @param {number} idEtape identifiant de l'étape
     * @returns {Array} ObjVer trouvés
     */
    function chercherCollaborateurs(vault, idEtape) {
        return chercher(vault, [
            conditionStatut(MF.STATUS_OBJECT_TYPE_ID, MF.DT_LOOKUP, PARAMETRAGE.typeCollaborateur),
            conditionLookup(PARAMETRAGE.proprietes.etape, idEtape),
            conditionStatut(MF.STATUS_DELETED, MF.DT_BOOLEAN, false)
        ], "collaborateurs à cette étape").map(function (v) {
            return v.ObjVer;
        });
    }

    /**
     * Tous les objets Cercle/rôle (non supprimés), avec leur titre.
     *
     * @param {object} vault coffre COM
     * @returns {Array} [{ objVer, id, nom }]
     */
    function chercherCercles(vault) {
        return chercher(vault, [
            conditionStatut(MF.STATUS_OBJECT_TYPE_ID, MF.DT_LOOKUP, PARAMETRAGE.typeCercle),
            conditionStatut(MF.STATUS_DELETED, MF.DT_BOOLEAN, false)
        ], "cercles et rôles").map(function (v) {
            return { objVer: v.ObjVer, id: v.ObjVer.ID, nom: v.Title };
        });
    }

    /**
     * TypedValue d'une propriété nommée, ou null si absente ou vide.
     *
     * @param {object} pvs PropertyValues de l'objet
     * @param {number} id identifiant de la propriété (liste blanche)
     * @returns {object|null} TypedValue
     */
    function valeurDe(pvs, id) {
        var pv;
        var tv;

        if (pvs.IndexOf(id) === -1) {
            return null;
        }
        pv = pvs.SearchForProperty(id);
        tv = pv.TypedValue || pv.Value;
        return tv && !tv.IsNULL() ? tv : null;
    }

    /**
     * Texte d'une propriété.
     *
     * @param {object} pvs PropertyValues
     * @param {number} id propriété
     * @returns {string|null} texte affiché, null si vide
     */
    function texte(pvs, id) {
        var tv = valeurDe(pvs, id);
        return tv && tv.DisplayValue ? String(tv.DisplayValue) : null;
    }

    /**
     * Lookup simple d'une propriété.
     *
     * @param {object} pvs PropertyValues
     * @param {number} id propriété
     * @returns {object|null} { id, nom }
     */
    function lookup(pvs, id) {
        var tv = valeurDe(pvs, id);
        var l;

        if (!tv) {
            return null;
        }
        l = tv.GetValueAsLookup();
        return { id: l.Item, nom: l.DisplayValue };
    }

    /**
     * Lookups d'une propriété à sélection multiple, sans les éléments
     * supprimés.
     *
     * @param {object} pvs PropertyValues
     * @param {number} id propriété
     * @returns {Array} [{ id, nom }]
     */
    function lookups(pvs, id) {
        var tv = valeurDe(pvs, id);

        if (!tv) {
            return [];
        }
        return enTableau(tv.GetValueAsLookups()).filter(function (l) {
            return !l.Deleted;
        }).map(function (l) {
            return { id: l.Item, nom: l.DisplayValue };
        });
    }

    /**
     * Collection ObjVers d'un lot.
     *
     * @param {Array} objVers ObjVer
     * @returns {object} MFiles.ObjVers
     */
    function collectionObjVers(objVers) {
        var c = new MFiles.ObjVers();

        objVers.forEach(function (ov) {
            c.Add(-1, ov);
        });
        return c;
    }

    /**
     * Lit un lot de fiches Collaborateur en un aller-retour et n'en garde
     * que la liste blanche.
     *
     * @param {object} vault coffre COM
     * @param {Array} objVers ObjVer du lot
     * @returns {Array} fiches { id, prenom, nom, initiales, titre,
     *     titreManuel, etape, fonctionPrincipale, fonctions, succursale,
     *     cercle, cerclesAuto, responsableId, email }
     */
    function lireFiches(vault, objVers) {
        var p = PARAMETRAGE.proprietes;
        var lots = enTableau(vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(collectionObjVers(objVers)));

        return lots.map(function (pvs, i) {
            var fonction = lookup(pvs, p.fonctionPrincipale);
            var succursale = lookup(pvs, p.succursale);
            var responsable = lookup(pvs, p.responsable);

            return {
                id: objVers[i].ID,
                prenom: texte(pvs, p.prenom),
                nom: texte(pvs, p.nom),
                initiales: texte(pvs, p.initiales),
                titre: texte(pvs, p.titre),
                titreManuel: texte(pvs, p.titreManuel),
                etape: lookup(pvs, p.etape),
                fonctionPrincipale: fonction ? fonction.nom : null,
                fonctions: lookups(pvs, p.fonctions).map(function (l) { return l.nom; }),
                succursale: succursale ? succursale.nom : null,
                cercle: lookup(pvs, p.cercle),
                cerclesAuto: lookups(pvs, p.cerclesAuto),
                responsableId: responsable ? responsable.id : null,
                email: texte(pvs, p.email)
            };
        });
    }

    /**
     * Lit un lot de cercles et rôles : ce que chacun contient.
     *
     * @param {object} vault coffre COM
     * @param {Array} cercles [{ objVer, id, nom }] (voir chercherCercles)
     * @returns {Array} [{ id, nom, enfants }]
     */
    function lireCercles(vault, cercles) {
        var lots = enTableau(vault.ObjectPropertyOperations.GetPropertiesOfMultipleObjects(
            collectionObjVers(cercles.map(function (c) { return c.objVer; }))));

        return lots.map(function (pvs, i) {
            return {
                id: cercles[i].id,
                nom: cercles[i].nom,
                enfants: lookups(pvs, PARAMETRAGE.proprietesCercle.membresCercles).map(function (l) { return l.id; })
            };
        });
    }

    /**
     * Affiche la fiche native d'un objet absent du listing. Collection
     * ObjOrFileVers (référence v1) : ObjectVersions échoue toujours.
     *
     * @param {object} cadre ShellFrame
     * @param {object} objVer ObjVer de l'objet
     * @returns {boolean} vrai si acceptée
     */
    function selectionVirtuelle(cadre, objVer) {
        var selection;
        var element;
        var listing = null;

        try {
            selection = new MFiles.ObjOrFileVers();
            element = new MFiles.ObjOrFileVer();
            try {
                listing = cadre.ActiveListing;
            } catch (e) {
                listing = null;
            }
            element.ObjVer = objVer;
            selection.Add(-1, element);
            (listing || cadre.Listing).SetVirtualSelection(selection);
            return true;
        } catch (e) {
            console.log(PREFIXE_JOURNAL + " sélection virtuelle refusée : " + (e.message || e.description || e));
            return false;
        }
    }

    /**
     * Lien m-files:// vers un objet, ou null si le GUID du coffre n'a pas
     * la forme attendue.
     *
     * @param {object} vault coffre COM
     * @param {number} typeId type d'objet
     * @param {number} id identifiant
     * @returns {string|null} lien
     */
    function lienObjet(vault, typeId, id) {
        var guid;
        var m;

        try {
            guid = String(vault.GetGUID());
        } catch (e) {
            return null;
        }
        m = MOTIF_GUID.exec(guid);
        if (!m || typeof typeId !== "number" || typeof id !== "number") {
            return null;
        }
        return "m-files://show/" + m[1] + "/" + typeId + "-" + id;
    }

    return {
        enTableau: enTableau,
        chercherCollaborateurs: chercherCollaborateurs,
        chercherCercles: chercherCercles,
        lireFiches: lireFiches,
        lireCercles: lireCercles,
        selectionVirtuelle: selectionVirtuelle,
        lienObjet: lienObjet
    };
}());
