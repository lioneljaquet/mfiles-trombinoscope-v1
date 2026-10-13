/**
 * Règles pures du trombinoscope (src/model/regles.js) : qui figure dans
 * l'annuaire, ce qu'on retient de chaque fiche, l'organisation, la
 * hiérarchie, la recherche, les filtres et le tri. Collaborateurs fictifs.
 */
const test = require("node:test");
const assert = require("node:assert");
const { charger, simple } = require("./charger");

const ctx = charger(["model/parametrage.js", "model/regles.js"]);
const regles = ctx.regles;

const EN_FONCTION = { id: 319, nom: "En fonction" };
const DEMISSION = { id: 1475, nom: "Offboarding démission" };
const LICENCIEMENT = { id: 1478, nom: "Offboarding licenciement" };
const FIN = { id: 999, nom: "Fin des rapports de travail" };

/**
 * Fiche fictive telle que la rend l'adaptateur COM.
 *
 * @param {number} id identifiant
 * @param {object} champs champs à poser
 * @returns {object} fiche
 */
function fiche(id, champs) {
    return Object.assign({
        id, prenom: "Prénom" + id, nom: "Nom" + id, initiales: null, titre: null, titreManuel: null,
        etape: EN_FONCTION, fonctionPrincipale: null, fonctions: [], succursale: null,
        cercle: null, cerclesAuto: [], responsableId: null, email: null
    }, champs);
}

/**
 * Organisation fictive : « tebicom SA » (1) contient INFRA (2) et GDI (3) ;
 * INFRA contient le rôle « Piquet » (4) ; « CA » (5) n'est contenu que par
 * le groupe « BI » (6), hors organisation.
 *
 * @returns {Array} objets Cercle/rôle
 */
function organisation() {
    return [
        { id: 1, nom: "tebicom SA", enfants: [2, 3] },
        { id: 2, nom: "INFRA", enfants: [4] },
        { id: 3, nom: "GDI", enfants: [] },
        { id: 4, nom: "Piquet", enfants: [] },
        { id: 5, nom: "CA", enfants: [] },
        { id: 6, nom: "BI", enfants: [5] }
    ];
}

/**
 * Personne de l'annuaire par son ID.
 *
 * @param {object} annuaire annuaire construit
 * @param {number} id identifiant
 * @returns {object} personne
 */
function personne(annuaire, id) {
    return annuaire.personnes.filter((p) => p.id === id)[0];
}

test("annuaire : seules les trois étapes listées y figurent", () => {
    const a = regles.construireAnnuaire([
        fiche(1, { etape: EN_FONCTION }), fiche(2, { etape: DEMISSION }),
        fiche(3, { etape: LICENCIEMENT }), fiche(4, { etape: FIN }), fiche(5, { etape: null })
    ], []);

    assert.deepStrictEqual(simple(a.personnes.map((p) => p.id)).sort(), [1, 2, 3]);
    assert.strictEqual(personne(a, 1).partant, false);
    assert.strictEqual(personne(a, 2).partant, true);
    assert.strictEqual(personne(a, 3).etape, "Offboarding licenciement");
});

test("annuaire : la fiche modèle et les fiches sans nom sont écartées", () => {
    const a = regles.construireAnnuaire([
        fiche(1, { initiales: "ZZZ" }), fiche(2, { prenom: "_Modèle" }),
        fiche(3, { prenom: " ", nom: "" }), fiche(4, {})
    ], []);

    assert.deepStrictEqual(simple(a.personnes.map((p) => p.id)), [4]);
});

test("annuaire : nom en capitales ramené à la casse normale, tri par nom puis prénom sans accent", () => {
    const a = regles.construireAnnuaire([
        fiche(1, { prenom: "JEAN-LUC", nom: "ÉCHO" }),
        fiche(2, { prenom: "Anne", nom: "van Delta" }),
        fiche(3, { prenom: "Zoé", nom: "Echo" })
    ], []);

    assert.deepStrictEqual(simple(a.personnes.map((p) => p.nomComplet)),
        ["Jean-Luc Écho", "Zoé Echo", "Anne van Delta"]);
});

test("annuaire : titre manuel, à défaut titre, à défaut /Titre", () => {
    const a = regles.construireAnnuaire([
        fiche(1, { titreManuel: " Directrice ", titre: "Ingénieure", fonctionPrincipale: "Chef de projet Senior" }),
        fiche(2, { titreManuel: "  ", titre: "Ingénieure", fonctionPrincipale: "Chef de projet Senior" }),
        fiche(3, { fonctionPrincipale: "Chef de projet Senior" }),
        fiche(4, {})
    ], []);

    assert.strictEqual(personne(a, 1).titre, "Directrice");
    assert.strictEqual(personne(a, 2).titre, "Ingénieure");
    assert.strictEqual(personne(a, 3).titre, "Chef de projet Senior");
    assert.strictEqual(personne(a, 4).titre, null);
});

test("annuaire : une adresse e-mail de forme non sûre n'atteint pas la page", () => {
    const a = regles.construireAnnuaire([
        fiche(1, { email: " alice.exemple@exemple.ch " }),
        fiche(2, { email: "a@exemple.ch?cc=b@exemple.ch" }),
        fiche(3, { email: "a@exemple.ch; b@exemple.ch" }),
        fiche(4, { email: "javascript:alert(1)" })
    ], []);

    assert.strictEqual(personne(a, 1).email, "alice.exemple@exemple.ch");
    assert.strictEqual(personne(a, 2).email, null);
    assert.strictEqual(personne(a, 3).email, null);
    assert.strictEqual(personne(a, 4).email, null);
});

test("avatar : trigramme de trois lettres, sinon monogramme sans particule", () => {
    const a = regles.construireAnnuaire([
        fiche(1, { prenom: "Alice", nom: "Exemple", initiales: "AEX" }),
        fiche(2, { prenom: "Anne", nom: "van Delta", initiales: "ANNETTE" }),
        fiche(3, { prenom: "Éric", nom: "Oméga", initiales: null })
    ], []);

    assert.strictEqual(regles.trigrammeDe(personne(a, 1)), "AEX");
    assert.strictEqual(regles.trigrammeDe(personne(a, 2)), "AD");
    assert.strictEqual(regles.trigrammeDe(personne(a, 3)), "ÉO");
});

test("annuaire : fonctions sans doublon ni vide, dans l'ordre de M-Files", () => {
    const a = regles.construireAnnuaire([
        fiche(1, { fonctions: ["Consultant", " ", "Formateur", "Consultant"] })
    ], []);

    assert.deepStrictEqual(simple(personne(a, 1).fonctions), ["Consultant", "Formateur"]);
});

test("organisation : seuls les cercles sous « tebicom SA » sont proposés, rôles et groupes exclus", () => {
    const a = regles.construireAnnuaire([
        fiche(1, { cercle: { id: 3, nom: "GDI" },
            cerclesAuto: [{ id: 2, nom: "INFRA" }, { id: 4, nom: "Piquet" }, { id: 6, nom: "BI" }] }),
        fiche(2, { cerclesAuto: [{ id: 5, nom: "CA" }] }),
        fiche(3, { cerclesAuto: [{ id: 1, nom: "tebicom SA" }] })
    ], organisation());

    assert.deepStrictEqual(simple(personne(a, 1).cercles), [{ id: 3, nom: "GDI" }, { id: 2, nom: "INFRA" }]);
    assert.deepStrictEqual(simple(personne(a, 2).cercles), [{ id: 5, nom: "CA" }]);
    assert.deepStrictEqual(simple(personne(a, 3).cercles), []);
});

test("fiche : cercles et rôles de la personne, principal compris, hors organisation signalés", () => {
    const a = regles.construireAnnuaire([
        fiche(1, { cercle: { id: 3, nom: "GDI" },
            cerclesAuto: [{ id: 4, nom: "Piquet" }, { id: 6, nom: "BI" }, { id: 4, nom: "Piquet" }] })
    ], organisation());

    assert.deepStrictEqual(simple(personne(a, 1).cerclesEtRoles), [
        { id: 6, nom: "BI", estCercle: false, horsOrganisation: true },
        { id: 3, nom: "GDI", estCercle: true, horsOrganisation: false },
        { id: 4, nom: "Piquet", estCercle: false, horsOrganisation: false }
    ]);
});

test("organisation : sans cercle « tebicom SA », aucun cercle n'est proposé", () => {
    const sansAncre = organisation().filter((c) => c.id !== 1);
    const a = regles.construireAnnuaire([fiche(1, { cerclesAuto: [{ id: 2, nom: "INFRA" }] })], sansAncre);

    assert.deepStrictEqual(simple(personne(a, 1).cercles), []);
});

test("hiérarchie : responsable hors annuaire ignoré, équipe triée par nom, taille de toute l'équipe", () => {
    const a = regles.construireAnnuaire([
        fiche(1, { nom: "Alpha" }),
        fiche(2, { nom: "Delta", responsableId: 1 }),
        fiche(3, { nom: "Bravo", responsableId: 1 }),
        fiche(4, { nom: "Charlie", responsableId: 2 }),
        fiche(5, { nom: "Echo", responsableId: 9 }),
        fiche(9, { nom: "Parti", etape: FIN })
    ], []);

    assert.deepStrictEqual(simple(personne(a, 1).equipe), [3, 2]);
    assert.strictEqual(personne(a, 1).tailleEquipe, 3);
    assert.strictEqual(personne(a, 4).responsableId, 2);
    assert.strictEqual(personne(a, 5).responsableId, null);
    assert.strictEqual(a.parId[9], undefined);
});

test("hiérarchie : une boucle est cassée au dernier lien dans l'ordre des ID", () => {
    const a = regles.construireAnnuaire([
        fiche(1, { responsableId: 2 }), fiche(2, { responsableId: 1 }), fiche(3, { responsableId: 3 })
    ], []);

    assert.strictEqual(personne(a, 1).responsableId, 2);
    assert.strictEqual(personne(a, 2).responsableId, null);
    assert.strictEqual(personne(a, 3).responsableId, null);
});

/**
 * Petit annuaire fictif pour la recherche, les filtres et le tri.
 *
 * @returns {object} annuaire
 */
function equipeFictive() {
    return regles.construireAnnuaire([
        fiche(1, { prenom: "Alice", nom: "Exemple", initiales: "AEX", titre: "Ingénieure systèmes",
            succursale: "Gland", fonctions: ["Formatrice", "Consultante"], email: "alice.exemple@exemple.ch",
            cercle: { id: 2, nom: "INFRA" }, cerclesAuto: [{ id: 2, nom: "INFRA" }] }),
        fiche(2, { prenom: "Éric", nom: "Oméga", initiales: "EOM", titre: "Chef de projet",
            succursale: "Gland", responsableId: 1, cerclesAuto: [{ id: 3, nom: "GDI" }, { id: 2, nom: "INFRA" }] }),
        fiche(3, { prenom: "Zoé", nom: "Bêta", initiales: "ZBE", titre: null, succursale: "Sion",
            etape: DEMISSION, cerclesAuto: [{ id: 3, nom: "GDI" }] }),
        fiche(4, { prenom: "Marc", nom: "Delta", initiales: "MDE", titre: "Comptable", succursale: null })
    ], organisation());
}

/**
 * ID des personnes retenues pour un état de recherche et de filtres.
 *
 * @param {object} etat état partiel
 * @returns {Array} ID, dans l'ordre de l'annuaire
 */
function retenus(etat) {
    const a = equipeFictive();
    return simple(regles.filtrer(a.personnes, Object.assign(regles.etatInitial(), etat)).map((p) => p.id));
}

test("recherche : sans accent ni capitale, tous les mots requis", () => {
    assert.deepStrictEqual(retenus({ q: "eric OMEGA" }), [2]);
    assert.deepStrictEqual(retenus({ q: "beta" }), [3]);
    assert.deepStrictEqual(retenus({ q: "alice omega" }), []);
});

test("recherche : trigramme, titre, /Titre et fonctions", () => {
    assert.deepStrictEqual(retenus({ q: "aex" }), [1]);
    assert.deepStrictEqual(retenus({ q: "ingenieure" }), [1]);
    assert.deepStrictEqual(retenus({ q: "formatrice" }), [1]);
    assert.deepStrictEqual(retenus({ q: "comptable" }), [4]);
});

test("recherche : une adresse collée ne garde que sa partie locale ; le responsable n'est pas indexé", () => {
    assert.deepStrictEqual(retenus({ q: "alice.exemple@exemple.ch" }), [1]);
    assert.deepStrictEqual(retenus({ q: "exemple" }), [1]);
});

test("filtres : cercle par ID, étape, succursale, titre, fonction, et « sans valeur »", () => {
    assert.deepStrictEqual(retenus({ cercle: "3" }), [3, 2]);
    assert.deepStrictEqual(retenus({ etape: "Offboarding démission" }), [3]);
    assert.deepStrictEqual(retenus({ succursale: "Gland" }), [1, 2]);
    assert.deepStrictEqual(retenus({ succursale: regles.AUCUN }), [4]);
    assert.deepStrictEqual(retenus({ titre: regles.AUCUN }), [3]);
    assert.deepStrictEqual(retenus({ fonction: "Consultante", succursale: "Gland" }), [1]);
    assert.deepStrictEqual(retenus({ cercle: regles.AUCUN }), [4]);
});

test("effectifs : contextuels, sans le filtre de la facette elle-même ; ordre stable par effectif total", () => {
    const a = equipeFictive();
    const etat = Object.assign(regles.etatInitial(), { succursale: "Gland", cercle: "2" });
    const cercles = simple(regles.optionsFacette(a.personnes, etat, "cercle"));
    const succursales = simple(regles.optionsFacette(a.personnes, etat, "succursale"));

    assert.deepStrictEqual(cercles.options, [
        { valeur: "3", libelle: "GDI", effectif: 1 }, { valeur: "2", libelle: "INFRA", effectif: 2 }]);
    assert.deepStrictEqual(cercles.aucun, { libelle: "Sans cercle", effectif: 0 });
    assert.strictEqual(cercles.total, 2);
    assert.deepStrictEqual(succursales.options, [
        { valeur: "Gland", libelle: "Gland", effectif: 2 }, { valeur: "Sion", libelle: "Sion", effectif: 0 }]);
    assert.deepStrictEqual(succursales.aucun, { libelle: "Sans succursale", effectif: 0 });
});

test("tri : nom, prénom, titre (vides à la fin), succursale, cercle, étape", () => {
    const a = equipeFictive();
    const ordre = (cle) => simple(regles.trier(a.personnes, cle).map((p) => p.id));

    assert.deepStrictEqual(ordre("nom"), [3, 4, 1, 2]);
    assert.deepStrictEqual(ordre("prenom"), [1, 2, 4, 3]);
    assert.deepStrictEqual(ordre("titre"), [2, 4, 1, 3]);
    assert.deepStrictEqual(ordre("succursale"), [1, 2, 3, 4]);
    assert.deepStrictEqual(ordre("etape"), [4, 1, 2, 3]);
    assert.deepStrictEqual(simple(a.personnes.map((p) => p.id)), [3, 4, 1, 2]);
});

test("état : un filtre ou une recherche rend la liste filtrée", () => {
    assert.strictEqual(regles.filtreActif(regles.etatInitial()), false);
    assert.strictEqual(regles.filtreActif(Object.assign(regles.etatInitial(), { q: "  " })), false);
    assert.strictEqual(regles.filtreActif(Object.assign(regles.etatInitial(), { titre: "Comptable" })), true);
});
