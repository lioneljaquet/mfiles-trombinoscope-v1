/**
 * Onglet « Trombinoscope » du volet de droite (src/presenter/onglet.js,
 * posé par le module) : il n'apparaît, et ne devient l'onglet actif, que
 * pour un objet Collaborateur seul sélectionné, de la population du
 * trombinoscope ; sinon il est masqué. Le module seul règle sa visibilité.
 * Coffre simulé, collaborateurs fictifs.
 */
const test = require("node:test");
const assert = require("node:assert");
const { charger } = require("./charger");
const { creerCoffreCom, collection, valeur } = require("./coffre-com-simule");

const MODULE = ["model/compat.js", "model/parametrage.js", "model/acces.js", "model/regles.js", "model/vault-com.js",
    "model/portraits.js", "presenter/onglet.js", "presenter/shellui.js"];
const EVENEMENTS = {
    Event_NewShellFrame: "NewShellFrame", Event_Started: "Started", Event_CustomCommand: "CustomCommand",
    Event_SelectionChanged: "SelectionChanged", TaskPaneGroup_Main: 1
};

/**
 * Collaborateur fictif, en fonction et membre d'INFRA sauf indication.
 *
 * @param {number} id identifiant
 * @param {object} [plus] propriétés supplémentaires
 * @returns {object} objet simulé
 */
function collaborateur(id, plus) {
    return {
        type: 104, id, titre: "C" + id,
        props: Object.assign({
            39: valeur.lookup(319, "En fonction"), 1387: valeur.texte("Prénom" + id), 1386: valeur.texte("Nom" + id),
            2928: valeur.multi([[501, "INFRA"]]), 3641: valeur.multi([[60, "Formatrice"]]),
            2414: valeur.lookup(5, "Gland"), 2823: valeur.texte("POISON-MOBILE")
        }, plus || {})
    };
}

/**
 * Coffre fictif : 1 (photo JPEG), 2 sous 1, 3 sans cercle, 4 à une étape
 * non listée, un document, l'organisation.
 *
 * @returns {Array} objets
 */
function objets() {
    return [
        collaborateur(1), collaborateur(2, { 1217: valeur.lookup(1, "x") }), collaborateur(3, { 2928: valeur.multi([]) }),
        collaborateur(4, { 39: valeur.lookup(999, "Fin") }),
        { type: 362, id: 500, titre: "tebicom SA", props: { 2926: valeur.multi([[501, "INFRA"]]) } },
        { type: 362, id: 501, titre: "INFRA", props: {} },
        { type: 0, id: 900, titre: "Photo", version: 2,
            props: { 100: valeur.lookup(88, "!! Photo collaborateur"), 1077: valeur.lookup(1, "x") },
            fichiers: [{ id: 30, version: 1, extension: "jpg", taille: 150000 }] },
        { type: 0, id: 901, titre: "Contrat", props: { 100: valeur.lookup(1, "Document") } }
    ];
}

/**
 * Cadre simulé avec volet droit et listing.
 *
 * @param {object} [options] { sansVolet: pas de volet droit (dialogue) }
 * @returns {object} cadre, avec son journal (_j)
 */
function cadre(options) {
    const o = options || {};
    const j = { onglets: [], selection: null, commandes: 0 };
    return {
        _j: j,
        CurrentPath: "",
        Events: { Register(e, cb) { if (e === "Started") { cb(); } } },
        Commands: {
            CreateCustomCommand: () => { j.commandes += 1; return 100 + j.commandes; },
            SetIconFromPath() {}, Events: { Register() {} }
        },
        TaskPane: { AddCustomCommandToGroup() {} },
        Listing: { Events: { Register(e, cb) { if (e === "SelectionChanged") { j.selection = cb; } } } },
        RightPane: o.sansVolet ? null : {
            AddTab(id, titre, position) {
                const onglet = {
                    id, titre, position, Visible: true, affichages: [], selections: 0,
                    ShowDashboard(tableau, donnees) { this.affichages.push({ tableau, donnees }); },
                    Select() { this.selections += 1; }
                };
                j.onglets.push(onglet);
                return onglet;
            }
        },
        ShowDashboard() {}
    };
}

/**
 * Module chargé avec un cadre.
 *
 * @param {object} [options] { session, cadre, objets }
 * @returns {object} { f, c, ctx, choisir(ids, type) }
 */
function preparer(options) {
    const o = options || {};
    const c = creerCoffreCom({ objets: o.objets || objets(), session: o.session || { groupes: [3524] } });
    const ctx = charger(MODULE, Object.assign({ MFiles: c.MFiles }, EVENEMENTS));
    const f = o.cadre || cadre();
    ctx.OnNewShellUI({ Vault: c.vault, Events: { Register(e, cb) { cb(f); } } });
    const choisir = (ids, type) => f._j.selection({
        ObjectVersions: collection(ids.map((id) => ({ ObjVer: { Type: type === undefined ? 104 : type, ID: id, Version: 3 } })),
            "ObjectVersions")
    });
    return { f, c, ctx, choisir };
}

/**
 * Données passées à la page de l'onglet lors de son dernier affichage.
 *
 * @param {object} onglet onglet simulé
 * @returns {object} { cadre, mode, donnees (objet), etatCadre }
 */
function derniereFiche(onglet) {
    const d = onglet.affichages[onglet.affichages.length - 1].donnees;
    return Object.assign({}, d, { donnees: JSON.parse(d.donnees) });
}

test("onglet : un collaborateur de la population, seul sélectionné, ouvre l'onglet et le rend actif", () => {
    const { f, choisir } = preparer();

    choisir([1]);
    const onglet = f._j.onglets[0];
    assert.strictEqual(onglet.titre, "Trombinoscope");
    assert.strictEqual(onglet.position, "_last");
    assert.strictEqual(onglet.Visible, true);
    assert.strictEqual(onglet.selections, 1);
    const d = derniereFiche(onglet);
    assert.strictEqual(onglet.affichages[0].tableau, "trombinoscope");
    assert.strictEqual(d.mode, "onglet");
    assert.strictEqual(d.cadre, f);
    assert.strictEqual(d.donnees.fiche.personne.nomComplet, "Prénom1 Nom1");
    assert.deepStrictEqual(d.donnees.fiche.equipe.map((p) => p.id), [2]);
    assert.strictEqual(d.donnees.photo.dataUri, "data:image/jpeg;base64,QUJD");
    assert.ok(!/POISON|etape|Offboarding|En fonction/i.test(onglet.affichages[0].donnees.donnees));
});

test("onglet : même personne resélectionnée (enregistrement d'une fiche…), ni nouvel affichage ni vol du focus", () => {
    const { f, choisir } = preparer();

    choisir([1]);
    choisir([1]);
    assert.strictEqual(f._j.onglets[0].affichages.length, 1);
    assert.strictEqual(f._j.onglets[0].selections, 1);
});

test("onglet : hors population (sans cercle, autre étape), masqué sans prendre le focus", () => {
    const { f, choisir } = preparer();

    choisir([1]);
    choisir([3]);
    assert.strictEqual(f._j.onglets[0].Visible, false);
    choisir([4]);
    assert.strictEqual(f._j.onglets[0].Visible, false);
    assert.strictEqual(f._j.onglets[0].selections, 1);
});

test("onglet : sélection multiple ou autre type d'objet, masqué ; jamais créé pour rien", () => {
    const { f, choisir } = preparer();

    choisir([1, 2]);
    choisir([901], 0);
    assert.strictEqual(f._j.onglets.length, 0);
    choisir([2]);
    choisir([1, 2]);
    assert.strictEqual(f._j.onglets[0].Visible, false);
    assert.strictEqual(f._j.onglets[0].selections, 1);
});

test("onglet : l'annuaire est lu une fois pour la session, pas à chaque sélection", () => {
    const { c, choisir } = preparer();

    choisir([1]);
    choisir([2]);
    choisir([3]);
    const lectures = c.journal.appels.filter((a) => /^GetPropertiesOfMultipleObjects/.test(a)).length;
    assert.strictEqual(lectures, 2, "fiches (1 lot) et cercles (1 lot), une seule fois");
});

test("onglet : un non-membre n'a jamais d'onglet", () => {
    const { f, choisir } = preparer({ session: { groupes: [1] } });

    if (f._j.selection) {
        choisir([1]);
    }
    assert.strictEqual(f._j.onglets.length, 0);
});

test("onglet : après « Afficher la fiche M-Files » du trombinoscope, l'onglet s'affiche sans voler l'onglet Métadonnées", () => {
    const { f, choisir } = preparer();

    choisir([2]);
    const etatCadre = derniereFiche(f._j.onglets[0]).etatCadre;
    etatCadre.selectionVirtuelle = 1;
    choisir([1]);
    assert.strictEqual(f._j.onglets[0].Visible, true);
    assert.strictEqual(f._j.onglets[0].selections, 1, "pas de Select pour la sélection virtuelle");
    assert.strictEqual(etatCadre.selectionVirtuelle, null);
});

test("onglet : une boîte de dialogue sans volet droit ne fait pas échouer le module", () => {
    const { f, choisir } = preparer({ cadre: cadre({ sansVolet: true }) });

    assert.doesNotThrow(() => choisir([1]));
    assert.strictEqual(f._j.onglets.length, 0);
});

test("onglet : une lecture du coffre en échec masque l'onglet et le journalise", () => {
    const { f, c, ctx, choisir } = preparer();

    c.vault.ObjectSearchOperations.SearchForObjectsByConditionsEx = () => { throw new Error("coffre indisponible"); };
    assert.doesNotThrow(() => choisir([1]));
    assert.strictEqual(f._j.onglets.length, 0);
    assert.ok(ctx.__journal.some((l) => /onglet non affiché : coffre indisponible/.test(l)));
});
