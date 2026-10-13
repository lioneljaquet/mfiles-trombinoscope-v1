/**
 * Accès COM au coffre (src/model/vault-com.js) contre le coffre simulé :
 * recherches par étape et par type, liste blanche des propriétés, lectures
 * par lots, sélection virtuelle, lien m-files://. Données fictives ; les
 * valeurs « POISON » imitent les champs RH que la fiche porte aussi.
 */
const test = require("node:test");
const assert = require("node:assert");
const { charger, simple } = require("./charger");
const { creerCoffreCom, valeur } = require("./coffre-com-simule");

const LISTE_BLANCHE = [39, 1387, 1386, 1079, 2376, 4259, 3638, 3641, 2414, 2929, 2928, 1217, 2821];

/**
 * Collaborateur fictif, avec des propriétés confidentielles à ne pas lire.
 *
 * @param {number} id identifiant
 * @param {number} etape ID d'étape
 * @param {object} [plus] propriétés supplémentaires
 * @returns {object} objet simulé
 */
function collaborateur(id, etape, plus) {
    return {
        type: 104, id, titre: "Collaborateur " + id,
        props: Object.assign({
            39: valeur.lookup(etape, etape === 319 ? "En fonction" : "Autre"),
            1387: valeur.texte("Prénom" + id), 1386: valeur.texte("Nom" + id),
            2823: valeur.texte("POISON-MOBILE"), 2824: valeur.lookup(70, "POISON-SUCCURSALE"),
            4050: valeur.multi([[71, "POISON-CERCLES"]]), 9001: valeur.texte("POISON-SALAIRE")
        }, plus || {})
    };
}

/**
 * Coffre fictif et contexte chargé avec ses constructeurs MFiles.
 *
 * @param {Array} objets objets du coffre
 * @param {object} [options] options du simulateur
 * @returns {object} { c, coffre }
 */
function preparer(objets, options) {
    const c = creerCoffreCom(Object.assign({ objets }, options || {}));
    const ctx = charger(["model/parametrage.js", "model/vault-com.js"], { MFiles: c.MFiles });
    return { c, coffre: ctx.coffre };
}

test("recherche : collaborateurs d'une étape, non supprimés, du type Collaborateur", () => {
    const { c, coffre } = preparer([
        collaborateur(1, 319), collaborateur(2, 1475), Object.assign(collaborateur(3, 319), { supprime: true }),
        { type: 0, id: 4, titre: "doc", props: { 39: valeur.lookup(319, "En fonction") } }
    ]);
    const trouves = coffre.chercherCollaborateurs(c.vault, 319);

    assert.deepStrictEqual(simple(trouves.map((ov) => ov.ID)), [1]);
    assert.deepStrictEqual(c.journal.conditions[0].map((x) => [x.Expression.genre, x.Expression.cible, x.TypedValue.Value]),
        [["statut", 6, 104], ["propriete", 39, 319], ["statut", 5, false]]);
});

test("recherche : un résultat plafonné par le serveur est une erreur franche", () => {
    const { c, coffre } = preparer([collaborateur(1, 319), collaborateur(2, 319)], { limiteServeur: 1 });

    assert.throws(() => coffre.chercherCollaborateurs(c.vault, 319), /annuaire incomplet/);
});

test("lecture : seules les propriétés de la liste blanche sont lues et rendues", () => {
    const { c, coffre } = preparer([collaborateur(1, 319, {
        1079: valeur.texte("AEX"), 2376: valeur.texte("Ingénieure"), 4259: valeur.texte(""),
        3638: valeur.lookup(5, "Chef de projet Senior"), 3641: valeur.multi([[6, "Formatrice"], [7, "Consultante"]]),
        2414: valeur.lookup(8, "Gland"), 2929: valeur.lookup(2, "INFRA"),
        2928: valeur.multi([[2, "INFRA"], [4, "Piquet"]]), 1217: valeur.lookup(9, "Responsable fictif"),
        2821: valeur.texte("alice.exemple@exemple.ch")
    })]);
    const fiches = coffre.lireFiches(c.vault, coffre.chercherCollaborateurs(c.vault, 319));

    assert.deepStrictEqual(simple(fiches), [{
        id: 1, prenom: "Prénom1", nom: "Nom1", initiales: "AEX", titre: "Ingénieure", titreManuel: null,
        etape: { id: 319, nom: "En fonction" }, fonctionPrincipale: "Chef de projet Senior",
        fonctions: ["Formatrice", "Consultante"], succursale: "Gland", cercle: { id: 2, nom: "INFRA" },
        cerclesAuto: [{ id: 2, nom: "INFRA" }, { id: 4, nom: "Piquet" }], responsableId: 9,
        email: "alice.exemple@exemple.ch"
    }]);
    assert.ok(!/POISON/.test(JSON.stringify(fiches)));
    assert.ok(c.journal.proprietesLues.every((id) => LISTE_BLANCHE.indexOf(id) >= 0),
        "propriété hors liste blanche lue : " + c.journal.proprietesLues);
});

test("lecture : un lot de fiches en un seul aller-retour", () => {
    const { c, coffre } = preparer([collaborateur(1, 319), collaborateur(2, 319), collaborateur(3, 319)]);
    const fiches = coffre.lireFiches(c.vault, coffre.chercherCollaborateurs(c.vault, 319));

    assert.strictEqual(fiches.length, 3);
    assert.deepStrictEqual(c.journal.appels, ["Search", "GetPropertiesOfMultipleObjects:3"]);
});

test("cercles : titre du résultat de recherche, contenu par >Membres (cercles) seulement", () => {
    const { c, coffre } = preparer([
        { type: 362, id: 1, titre: "tebicom SA", props: { 2926: valeur.multi([[2, "INFRA"]]), 4043: valeur.multi([[9, "POISON"]]) } },
        { type: 362, id: 2, titre: "INFRA", props: {} },
        { type: 362, id: 3, titre: "Ancien", supprime: true, props: {} }
    ]);
    const trouves = coffre.chercherCercles(c.vault);
    const cercles = coffre.lireCercles(c.vault, trouves);

    assert.deepStrictEqual(simple(cercles), [{ id: 1, nom: "tebicom SA", enfants: [2] }, { id: 2, nom: "INFRA", enfants: [] }]);
    assert.ok(c.journal.proprietesLues.every((id) => id === 2926));
});

test("sélection virtuelle : collection ObjOrFileVers sur le listing actif", () => {
    const { c, coffre } = preparer([]);

    assert.strictEqual(coffre.selectionVirtuelle(c.cadre, { Type: 104, ID: 1, Version: 7 }), true);
    assert.strictEqual(c.journal.selection.Count, 1);
});

test("lien : m-files://show/ avec le GUID du coffre sans accolades, refusé si le GUID est douteux", () => {
    const bon = preparer([]);
    const douteux = preparer([], { guid: "{x}/../autre" });

    assert.strictEqual(bon.coffre.lienObjet(bon.c.vault, 104, 12),
        "m-files://show/1A2B3C4D-0000-1111-2222-333344445555/104-12");
    assert.strictEqual(douteux.coffre.lienObjet(douteux.c.vault, 104, 12), null);
});
