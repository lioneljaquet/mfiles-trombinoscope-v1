/**
 * Présentateur de la page (src/presenter/trombinoscope.js) contre le coffre
 * simulé et une vue factice : lecture par lots qui rend la main entre
 * chaque lot, progression, recherche, filtres, fiche, sélection virtuelle,
 * erreurs. Collaborateurs fictifs.
 */
const test = require("node:test");
const assert = require("node:assert");
const { charger, simple } = require("./charger");
const { creerCoffreCom, valeur } = require("./coffre-com-simule");

const SOURCES = ["model/parametrage.js", "model/regles.js", "model/vault-com.js", "presenter/trombinoscope.js"];

/**
 * Collaborateur fictif.
 *
 * @param {number} id identifiant
 * @param {number} etape ID d'étape
 * @param {object} [plus] propriétés supplémentaires
 * @returns {object} objet simulé
 */
function collaborateur(id, etape, plus) {
    return {
        type: 104, id, titre: "C" + id,
        props: Object.assign({
            39: valeur.lookup(etape, { 319: "En fonction", 1475: "Offboarding démission", 999: "Fin" }[etape]),
            1387: valeur.texte("Prénom" + id), 1386: valeur.texte("Nom" + String(id).padStart(3, "0"))
        }, plus || {})
    };
}

/**
 * Coffre fictif : 45 personnes en fonction, une en offboarding, une
 * partie (étape non listée) qui est la responsable de la personne 1.
 *
 * @returns {Array} objets
 */
function objetsFictifs() {
    const objets = [];
    for (let id = 1; id <= 45; id += 1) {
        objets.push(collaborateur(id, 319, id === 2 ? { 1217: valeur.lookup(1, "Prénom1 Nom001") } : {}));
    }
    objets[0].props[1217] = valeur.lookup(99, "Prénom99 Nom099");
    objets[0].props[2414] = valeur.lookup(5, "Gland");
    objets.push(collaborateur(46, 1475, { 2414: valeur.lookup(5, "Gland") }));
    objets.push(collaborateur(99, 999));
    objets.push({ type: 362, id: 500, titre: "tebicom SA", props: {} });
    return objets;
}

/**
 * Présentateur prêt à charger, avec une file de tâches qu'on vide à la main.
 *
 * @param {object} [options] { objets, limiteServeur, cadre }
 * @returns {object} { p, vue, file, vider, c, ctx }
 */
function preparer(options) {
    const opts = options || {};
    const c = creerCoffreCom({ objets: opts.objets || objetsFictifs(), limiteServeur: opts.limiteServeur });
    const ctx = charger(SOURCES, { MFiles: c.MFiles });
    const vue = { appels: [], progressions: [], erreurs: [], modeles: [] };
    const file = [];
    const p = ctx.presentateur.creer({
        vault: c.vault,
        cadre: opts.cadre === undefined ? c.cadre : opts.cadre,
        planifier: (fn) => file.push(fn)
    }, (actions) => {
        vue.actions = actions;
        return {
            progression: (texte, fait, total) => vue.progressions.push([texte, fait, total]),
            erreur: (m) => vue.erreurs.push(m),
            rendre: (m) => vue.modeles.push(m),
            message: (m) => vue.appels.push(["message", m])
        };
    });
    const vider = () => { let n = 0; while (file.length) { file.shift()(); n += 1; } return n; };
    return { p, vue, file, vider, c, ctx };
}

/**
 * Dernier modèle rendu.
 *
 * @param {object} vue vue factice
 * @returns {object} modèle
 */
function dernier(vue) {
    return vue.modeles[vue.modeles.length - 1];
}

test("chargement : par lots, en rendant la main entre chaque lot, avec progression", () => {
    const { p, vue, vider, c } = preparer();

    p.demarrer();
    assert.strictEqual(vue.modeles.length, 0, "rien n'est rendu avant la lecture");
    const taches = vider();

    // 46 fiches listées en lots de 20 : trois allers-retours, plus un pour les cercles
    assert.deepStrictEqual(c.journal.appels.filter((a) => a.indexOf("GetPropertiesOfMultipleObjects") === 0),
        ["GetPropertiesOfMultipleObjects:20", "GetPropertiesOfMultipleObjects:20",
            "GetPropertiesOfMultipleObjects:6", "GetPropertiesOfMultipleObjects:1"]);
    assert.ok(taches >= 5, "la main est rendue entre les étapes (" + taches + " tâches)");
    const fiches = vue.progressions.filter((x) => /fiches/.test(x[0])).map((x) => x[1]);
    assert.deepStrictEqual(fiches, [0, 20, 40, 46]);
    assert.strictEqual(dernier(vue).total, 46);
    assert.strictEqual(dernier(vue).compteur, "46 personnes");
});

test("chargement : une personne d'une étape non listée n'est nulle part, pas même comme responsable", () => {
    const { p, vue, vider } = preparer();

    p.demarrer();
    vider();
    const texte = JSON.stringify(simple(dernier(vue)));
    assert.ok(!/Prénom99|Nom099/.test(texte));
});

test("recherche et filtres : liste, compteur et effectifs suivent", () => {
    const { p, vue, vider } = preparer();

    p.demarrer();
    vider();
    vue.actions.filtrer("succursale", "Gland");
    assert.strictEqual(dernier(vue).compteur, "2 personnes sur 46");
    vue.actions.rechercher("nom046");
    assert.deepStrictEqual(simple(dernier(vue).personnes.map((x) => x.id)), [46]);
    assert.strictEqual(dernier(vue).facettes.etape.options.filter((o) => o.valeur === "Offboarding démission")[0].effectif, 1);
    vue.actions.reinitialiser();
    assert.strictEqual(dernier(vue).compteur, "46 personnes");
});

test("fiche : responsable et équipe cliquables, personne voisine dans l'ordre affiché", () => {
    const { p, vue, vider } = preparer();

    p.demarrer();
    vider();
    vue.actions.ouvrir(1);
    const fiche = dernier(vue).fiche;
    assert.strictEqual(fiche.personne.id, 1);
    assert.strictEqual(fiche.responsable, null);
    assert.deepStrictEqual(simple(fiche.equipe.map((x) => x.id)), [2]);
    vue.actions.voisine(1);
    assert.strictEqual(dernier(vue).fiche.personne.id, 2);
    assert.strictEqual(dernier(vue).fiche.responsable.id, 1);
    vue.actions.fermer();
    assert.strictEqual(dernier(vue).fiche, null);
});

test("fiche : « Afficher dans M-Files » passe l'ObjVer de la personne à la sélection virtuelle", () => {
    const { p, vue, vider, c } = preparer();

    p.demarrer();
    vider();
    vue.actions.afficherDansMFiles(3);
    assert.strictEqual(c.journal.selection.Item(1).ObjVer.ID, 3);
});

test("fiche : sans cadre, la vue reçoit un message plutôt qu'une erreur", () => {
    const { p, vue, vider } = preparer({ cadre: null });

    p.demarrer();
    vider();
    vue.actions.afficherDansMFiles(3);
    assert.strictEqual(vue.appels.length, 1);
    assert.match(vue.appels[0][1], /M-Files/);
});

test("erreur : une recherche plafonnée arrête la lecture et l'explique, sans rien rendre", () => {
    const { p, vue, vider } = preparer({ limiteServeur: 10 });

    p.demarrer();
    vider();
    assert.strictEqual(vue.modeles.length, 0);
    assert.match(vue.erreurs[0], /annuaire incomplet/);
});

test("vue : grille ou liste, tri, et l'état est conservé", () => {
    const { p, vue, vider } = preparer();

    p.demarrer();
    vider();
    vue.actions.changerVue("liste");
    vue.actions.trier("prenom");
    assert.strictEqual(dernier(vue).affichage.vue, "liste");
    assert.strictEqual(dernier(vue).affichage.tri, "prenom");
    assert.strictEqual(dernier(vue).personnes[0].prenom, "Prénom1");
    assert.strictEqual(dernier(vue).personnes[1].prenom, "Prénom10");
});

test("page : OnNewDashboard lit le coffre du tableau de bord et journalise la version", () => {
    const c = creerCoffreCom({ objets: objetsFictifs() });
    const vueFactice = { progression() {}, erreur() {}, rendre() {}, message() {}, version: null };
    const ctx = charger(SOURCES, {
        MFiles: c.MFiles,
        setTimeout: (fn) => fn(),
        document: {},
        rendu: { creer: (doc, actions) => { vueFactice.actions = actions; return vueFactice; } }
    });

    ctx.OnNewDashboard({ Vault: c.vault, CustomData: { cadre: c.cadre, version: "x" } });
    assert.ok(ctx.__journal.some((l) => /\[trombinoscope\] version \{VERSION\} \(UIX v1\)/.test(l)));
    assert.ok(c.journal.appels.indexOf("Search") >= 0);
});

test("page : « Revenir au listage » rend la zone de listage au client", () => {
    const { p, vue, vider, c } = preparer();
    let rendu = 0;
    c.cadre.ShowDefaultContent = () => { rendu += 1; };

    p.demarrer();
    vider();
    vue.actions.revenir();
    assert.strictEqual(rendu, 1);
});
