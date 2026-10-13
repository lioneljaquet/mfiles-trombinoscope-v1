/**
 * Règles pures du trombinoscope (src/model/regles.js) : qui figure dans
 * l'annuaire (étapes listées, rattachement à un cercle, comme l'export du
 * Cockpit), ce qu'on retient de chaque fiche, l'organisation, la
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
const INFRA = { id: 2, nom: "INFRA" };

/**
 * Fiche fictive telle que la rend l'adaptateur COM ; par défaut en
 * fonction et membre du cercle INFRA (donc retenue).
 *
 * @param {number} id identifiant
 * @param {object} champs champs à poser
 * @returns {object} fiche
 */
function fiche(id, champs) {
    return Object.assign({
        id, prenom: "Prénom" + id, nom: "Nom" + id, initiales: null, titre: null, titreManuel: null,
        etape: EN_FONCTION, fonctionPrincipale: null, fonctions: [], succursale: null,
        cercle: null, cerclesAuto: [INFRA], responsableId: null, email: null
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
 * Annuaire construit sur l'organisation fictive.
 *
 * @param {Array} fiches fiches fictives
 * @returns {object} annuaire
 */
function construire(fiches) {
    return regles.construireAnnuaire(fiches, organisation());
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

/**
 * ID des personnes de l'annuaire, dans son ordre.
 *
 * @param {object} annuaire annuaire construit
 * @returns {Array} ID
 */
function ids(annuaire) {
    return simple(annuaire.personnes.map((p) => p.id));
}

test("annuaire : seules les trois étapes listées y figurent", () => {
    const a = construire([
        fiche(1, { etape: EN_FONCTION }), fiche(2, { etape: DEMISSION }),
        fiche(3, { etape: LICENCIEMENT }), fiche(4, { etape: FIN }), fiche(5, { etape: null })
    ]);

    assert.deepStrictEqual(ids(a).sort(), [1, 2, 3]);
});

test("annuaire : aucune trace de l'étape, les offboardés ne se distinguent pas", () => {
    const a = construire([fiche(1, { etape: EN_FONCTION }), fiche(2, { etape: LICENCIEMENT })]);
    const texte = JSON.stringify(simple(a.personnes));

    assert.ok(!/etape|partant|Offboarding|En fonction/i.test(texte), texte);
    assert.deepStrictEqual(Object.keys(personne(a, 1)).sort(), Object.keys(personne(a, 2)).sort());
    assert.strictEqual(regles.CLES_FACETTES.indexOf("etape"), -1);
    assert.strictEqual("etape" in regles.etatInitial(), false);
});

test("annuaire : une personne sans cercle de l'organisation est exclue", () => {
    const a = construire([
        fiche(1, {}),
        fiche(2, { cerclesAuto: [] }),
        fiche(3, { cerclesAuto: [{ id: 4, nom: "Piquet" }, { id: 6, nom: "BI" }, { id: 1, nom: "tebicom SA" }] }),
        fiche(4, { cerclesAuto: [], cercle: { id: 3, nom: "GDI" } })
    ]);

    assert.deepStrictEqual(ids(a).sort(), [1, 4]);
    assert.strictEqual(a.parId[2], undefined);
    assert.strictEqual(a.parId[3], undefined);
});

test("annuaire : sans cercle « tebicom SA », personne n'est rattaché à un cercle, l'annuaire est vide", () => {
    const sansAncre = organisation().filter((c) => c.id !== 1);
    const a = regles.construireAnnuaire([fiche(1, {})], sansAncre);

    assert.deepStrictEqual(ids(a), []);
});

test("annuaire : la fiche modèle et les fiches sans nom sont écartées", () => {
    const a = construire([
        fiche(1, { initiales: "ZZZ" }), fiche(2, { prenom: "_Modèle" }),
        fiche(3, { prenom: " ", nom: "" }), fiche(4, {})
    ]);

    assert.deepStrictEqual(ids(a), [4]);
});

test("annuaire : nom en capitales ramené à la casse normale, tri par nom puis prénom sans accent", () => {
    const a = construire([
        fiche(1, { prenom: "JEAN-LUC", nom: "ÉCHO" }),
        fiche(2, { prenom: "Anne", nom: "van Delta" }),
        fiche(3, { prenom: "Zoé", nom: "Echo" })
    ]);

    assert.deepStrictEqual(simple(a.personnes.map((p) => p.nomComplet)),
        ["Jean-Luc Écho", "Zoé Echo", "Anne van Delta"]);
});

test("annuaire : titre manuel, à défaut titre, à défaut /Titre", () => {
    const a = construire([
        fiche(1, { titreManuel: " Directrice ", titre: "Ingénieure", fonctionPrincipale: "Chef de projet Senior" }),
        fiche(2, { titreManuel: "  ", titre: "Ingénieure", fonctionPrincipale: "Chef de projet Senior" }),
        fiche(3, { fonctionPrincipale: "Chef de projet Senior" }),
        fiche(4, {})
    ]);

    assert.strictEqual(personne(a, 1).titre, "Directrice");
    assert.strictEqual(personne(a, 2).titre, "Ingénieure");
    assert.strictEqual(personne(a, 3).titre, "Chef de projet Senior");
    assert.strictEqual(personne(a, 4).titre, null);
});

test("annuaire : une adresse e-mail de forme non sûre n'atteint pas la page", () => {
    const a = construire([
        fiche(1, { email: " alice.exemple@exemple.ch " }),
        fiche(2, { email: "a@exemple.ch?cc=b@exemple.ch" }),
        fiche(3, { email: "a@exemple.ch; b@exemple.ch" }),
        fiche(4, { email: "javascript:alert(1)" })
    ]);

    assert.strictEqual(personne(a, 1).email, "alice.exemple@exemple.ch");
    assert.strictEqual(personne(a, 2).email, null);
    assert.strictEqual(personne(a, 3).email, null);
    assert.strictEqual(personne(a, 4).email, null);
});

test("annuaire : une adresse e-mail démesurée est refusée sans être analysée", () => {
    const a = construire([fiche(1, { email: "a".repeat(300) + "@exemple.ch" })]);

    assert.strictEqual(personne(a, 1).email, null);
});

test("avatar : trigramme de trois lettres, sinon monogramme sans particule", () => {
    const a = construire([
        fiche(1, { prenom: "Alice", nom: "Exemple", initiales: "AEX" }),
        fiche(2, { prenom: "Anne", nom: "van Delta", initiales: "ANNETTE" }),
        fiche(3, { prenom: "Éric", nom: "Oméga", initiales: null })
    ]);

    assert.strictEqual(regles.trigrammeDe(personne(a, 1)), "AEX");
    assert.strictEqual(regles.trigrammeDe(personne(a, 2)), "AD");
    assert.strictEqual(regles.trigrammeDe(personne(a, 3)), "ÉO");
});

test("annuaire : fonctions sans doublon ni vide, dans l'ordre de M-Files", () => {
    const a = construire([fiche(1, { fonctions: ["Consultant", " ", "Formateur", "Consultant"] })]);

    assert.deepStrictEqual(simple(personne(a, 1).fonctions), ["Consultant", "Formateur"]);
});

test("organisation : seuls les cercles sous « tebicom SA » sont proposés, rôles et groupes exclus", () => {
    const a = construire([
        fiche(1, { cercle: { id: 3, nom: "GDI" },
            cerclesAuto: [INFRA, { id: 4, nom: "Piquet" }, { id: 6, nom: "BI" }] }),
        fiche(2, { cerclesAuto: [{ id: 5, nom: "CA" }] })
    ]);

    assert.deepStrictEqual(simple(personne(a, 1).cercles), [{ id: 3, nom: "GDI" }, { id: 2, nom: "INFRA" }]);
    assert.deepStrictEqual(simple(personne(a, 2).cercles), [{ id: 5, nom: "CA" }]);
});

test("fiche : cercles et rôles de la personne, principal compris, hors organisation signalés", () => {
    const a = construire([
        fiche(1, { cercle: { id: 3, nom: "GDI" },
            cerclesAuto: [{ id: 4, nom: "Piquet" }, { id: 6, nom: "BI" }, { id: 4, nom: "Piquet" }] })
    ]);

    assert.deepStrictEqual(simple(personne(a, 1).cerclesEtRoles), [
        { id: 6, nom: "BI", estCercle: false, horsOrganisation: true },
        { id: 3, nom: "GDI", estCercle: true, horsOrganisation: false },
        { id: 4, nom: "Piquet", estCercle: false, horsOrganisation: false }
    ]);
});

test("hiérarchie : responsable hors annuaire ignoré, équipe triée par nom, taille de toute l'équipe", () => {
    const a = construire([
        fiche(1, { nom: "Alpha" }),
        fiche(2, { nom: "Delta", responsableId: 1 }),
        fiche(3, { nom: "Bravo", responsableId: 1 }),
        fiche(4, { nom: "Charlie", responsableId: 2 }),
        fiche(5, { nom: "Echo", responsableId: 9 }),
        fiche(9, { nom: "Parti", etape: FIN })
    ]);

    assert.deepStrictEqual(simple(personne(a, 1).equipe), [3, 2]);
    assert.strictEqual(personne(a, 1).tailleEquipe, 3);
    assert.strictEqual(personne(a, 4).responsableId, 2);
    assert.strictEqual(personne(a, 5).responsableId, null);
    assert.strictEqual(a.parId[9], undefined);
});

test("hiérarchie : un responsable sans cercle est remplacé par le premier responsable retenu au-dessus", () => {
    const a = construire([
        fiche(1, { nom: "Alpha" }),
        fiche(2, { nom: "Bravo", cerclesAuto: [], responsableId: 1 }),
        fiche(3, { nom: "Charlie", cerclesAuto: [], responsableId: 2 }),
        fiche(4, { nom: "Delta", responsableId: 3 }),
        fiche(5, { nom: "Echo", responsableId: 2 }),
        fiche(6, { nom: "Fox", cerclesAuto: [] }),
        fiche(7, { nom: "Golf", responsableId: 6 })
    ]);

    assert.deepStrictEqual(ids(a), [1, 4, 5, 7]);
    assert.strictEqual(personne(a, 4).responsableId, 1);
    assert.strictEqual(personne(a, 5).responsableId, 1);
    assert.strictEqual(personne(a, 7).responsableId, null);
    assert.deepStrictEqual(simple(personne(a, 1).equipe), [4, 5]);
    assert.strictEqual(personne(a, 1).tailleEquipe, 2);
});

test("hiérarchie : une boucle est cassée au dernier lien dans l'ordre des ID", () => {
    const a = construire([
        fiche(1, { responsableId: 2 }), fiche(2, { responsableId: 1 }), fiche(3, { responsableId: 3 })
    ]);

    assert.strictEqual(personne(a, 1).responsableId, 2);
    assert.strictEqual(personne(a, 2).responsableId, null);
    assert.strictEqual(personne(a, 3).responsableId, null);
});

/**
 * Petit annuaire fictif pour la recherche, les filtres et le tri ; Marc
 * Delta (4) et Yves Sans (5) n'ont pas de cercle : Yves est exclu, Marc a
 * un cercle principal.
 *
 * @returns {object} annuaire
 */
function equipeFictive() {
    return construire([
        fiche(1, { prenom: "Alice", nom: "Exemple", initiales: "AEX", titre: "Ingénieure systèmes",
            succursale: "Gland", fonctions: ["Formatrice", "Consultante"], email: "alice.exemple@exemple.ch",
            cercle: INFRA, cerclesAuto: [INFRA] }),
        fiche(2, { prenom: "Éric", nom: "Oméga", initiales: "EOM", titre: "Chef de projet",
            succursale: "Gland", responsableId: 1, cerclesAuto: [{ id: 3, nom: "GDI" }, INFRA] }),
        fiche(3, { prenom: "Zoé", nom: "Bêta", initiales: "ZBE", titre: null, succursale: "Sion",
            etape: DEMISSION, cerclesAuto: [{ id: 3, nom: "GDI" }] }),
        fiche(4, { prenom: "Marc", nom: "Delta", initiales: "MDE", titre: "Comptable", succursale: null,
            cerclesAuto: [], cercle: { id: 3, nom: "GDI" } }),
        fiche(5, { prenom: "Yves", nom: "Sans", initiales: "YSA", titre: "Comptable", succursale: "Gland",
            cerclesAuto: [] })
    ]);
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

test("recherche : sans accent ni capitale, tous les mots requis ; un exclu ne ressort jamais", () => {
    assert.deepStrictEqual(retenus({ q: "eric OMEGA" }), [2]);
    assert.deepStrictEqual(retenus({ q: "beta" }), [3]);
    assert.deepStrictEqual(retenus({ q: "alice omega" }), []);
    assert.deepStrictEqual(retenus({ q: "yves" }), []);
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

test("filtres : cercle par ID, succursale, titre, fonction, et « sans valeur »", () => {
    assert.deepStrictEqual(retenus({ cercle: "3" }), [3, 4, 2]);
    assert.deepStrictEqual(retenus({ succursale: "Gland" }), [1, 2]);
    assert.deepStrictEqual(retenus({ succursale: regles.AUCUN }), [4]);
    assert.deepStrictEqual(retenus({ titre: regles.AUCUN }), [3]);
    assert.deepStrictEqual(retenus({ fonction: "Consultante", succursale: "Gland" }), [1]);
});

test("effectifs : contextuels sur la population limitée, sans « Sans cercle »", () => {
    const a = equipeFictive();
    const etat = Object.assign(regles.etatInitial(), { succursale: "Gland", cercle: "2" });
    const cercles = simple(regles.optionsFacette(a.personnes, etat, "cercle"));
    const succursales = simple(regles.optionsFacette(a.personnes, etat, "succursale"));

    assert.deepStrictEqual(cercles.options, [
        { valeur: "3", libelle: "GDI", effectif: 1 }, { valeur: "2", libelle: "INFRA", effectif: 2 }]);
    assert.strictEqual(cercles.aucun, null);
    assert.strictEqual(cercles.total, 2);
    assert.deepStrictEqual(succursales.options, [
        { valeur: "Gland", libelle: "Gland", effectif: 2 }, { valeur: "Sion", libelle: "Sion", effectif: 0 }]);
    assert.deepStrictEqual(succursales.aucun, { libelle: "Sans succursale", effectif: 0 });
});

test("tri : nom, prénom, titre (vides à la fin), succursale, cercle ; pas de tri par étape", () => {
    const a = equipeFictive();
    const ordre = (cle) => simple(regles.trier(a.personnes, cle).map((p) => p.id));

    assert.deepStrictEqual(ordre("nom"), [3, 4, 1, 2]);
    assert.deepStrictEqual(ordre("prenom"), [1, 2, 4, 3]);
    assert.deepStrictEqual(ordre("titre"), [2, 4, 1, 3]);
    assert.deepStrictEqual(ordre("succursale"), [1, 2, 3, 4]);
    assert.deepStrictEqual(ordre("etape"), [3, 4, 1, 2], "clé inconnue : ordre par nom");
    assert.deepStrictEqual(ids(a), [3, 4, 1, 2]);
});

test("état : un filtre ou une recherche rend la liste filtrée", () => {
    assert.strictEqual(regles.filtreActif(regles.etatInitial()), false);
    assert.strictEqual(regles.filtreActif(Object.assign(regles.etatInitial(), { q: "  " })), false);
    assert.strictEqual(regles.filtreActif(Object.assign(regles.etatInitial(), { titre: "Comptable" })), true);
});
