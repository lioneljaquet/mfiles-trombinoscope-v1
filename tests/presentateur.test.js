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

const SOURCES = ["model/parametrage.js", "model/acces.js", "model/regles.js", "model/vault-com.js",
    "presenter/trombinoscope.js"];

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
            1387: valeur.texte("Prénom" + id), 1386: valeur.texte("Nom" + String(id).padStart(3, "0")),
            2928: valeur.multi([[501, "INFRA"]])
        }, plus || {})
    };
}

/**
 * Coffre fictif : 45 personnes en fonction et une en offboarding, toutes
 * membres du cercle INFRA ; une partie (étape non listée), responsable de
 * la personne 1 ; une personne en fonction SANS cercle (47), responsable
 * de la personne 2 et elle-même sous la personne 1.
 *
 * @returns {Array} objets
 */
function objetsFictifs() {
    const objets = [];
    for (let id = 1; id <= 45; id += 1) {
        objets.push(collaborateur(id, 319, id === 2 ? { 1217: valeur.lookup(47, "Prénom47 Nom047") } : {}));
    }
    objets[0].props[1217] = valeur.lookup(99, "Prénom99 Nom099");
    objets[0].props[2414] = valeur.lookup(5, "Gland");
    objets.push(collaborateur(46, 1475, { 2414: valeur.lookup(5, "Gland") }));
    objets.push(collaborateur(47, 319, { 2928: valeur.multi([]), 1217: valeur.lookup(1, "Prénom1 Nom001") }));
    objets.push(collaborateur(99, 999));
    objets.push({ type: 362, id: 500, titre: "tebicom SA", props: { 2926: valeur.multi([[501, "INFRA"]]) } });
    objets.push({ type: 362, id: 501, titre: "INFRA", props: {} });
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
    const c = creerCoffreCom({ objets: opts.objets || objetsFictifs(), limiteServeur: opts.limiteServeur,
        session: opts.session || { groupes: [3524] } });
    const ctx = charger(SOURCES, { MFiles: c.MFiles });
    const vue = { appels: [], progressions: [], erreurs: [], modeles: [], refus: [] };
    const file = [];
    const p = ctx.presentateur.creer({
        vault: c.vault,
        cadre: opts.cadre === undefined ? c.cadre : opts.cadre,
        etatCadre: opts.etatCadre,
        actionInitiale: opts.actionInitiale,
        planifier: (fn) => file.push(fn)
    }, (actions) => {
        vue.actions = actions;
        return {
            progression: (texte, fait, total) => vue.progressions.push([texte, fait, total]),
            erreur: (m) => vue.erreurs.push(m),
            refuser: (m) => vue.refus.push(m),
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

    // 47 fiches listées en lots de 20 : trois allers-retours, plus un pour les cercles
    assert.deepStrictEqual(c.journal.appels.filter((a) => a.indexOf("GetPropertiesOfMultipleObjects") === 0),
        ["GetPropertiesOfMultipleObjects:20", "GetPropertiesOfMultipleObjects:20",
            "GetPropertiesOfMultipleObjects:7", "GetPropertiesOfMultipleObjects:2"]);
    assert.ok(taches >= 5, "la main est rendue entre les étapes (" + taches + " tâches)");
    const fiches = vue.progressions.filter((x) => /fiches/.test(x[0])).map((x) => x[1]);
    assert.deepStrictEqual(fiches, [0, 20, 40, 47]);
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
    assert.strictEqual(dernier(vue).facettes.succursale.options.filter((o) => o.valeur === "Gland")[0].effectif, 1);
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
    const c = creerCoffreCom({ objets: objetsFictifs(), session: { groupes: [3524] } });
    const vueFactice = { progression() {}, erreur() {}, refuser() {}, rendre() {}, message() {}, version: null };
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

test("page : « Vue M-Files » rend la zone de listage au client", () => {
    const { p, vue, vider, c } = preparer();
    let rendu = 0;
    c.cadre.ShowDefaultContent = () => { rendu += 1; };

    p.demarrer();
    vider();
    vue.actions.revenir();
    assert.strictEqual(rendu, 1);
});

test("erreur : aucun collaborateur aux étapes listées est une erreur (identifiants d'étape changés ?)", () => {
    const { p, vue, vider } = preparer({ objets: [collaborateur(1, 999)] });

    p.demarrer();
    vider();
    assert.strictEqual(vue.modeles.length, 0);
    assert.match(vue.erreurs[0], /aucun collaborateur/i);
});

test("relire pendant une lecture : la lecture précédente s'arrête, une seule aboutit", () => {
    const { p, vue, file, vider } = preparer();

    p.demarrer();
    file.shift()();                // première lecture engagée
    vue.actions.relire();
    vider();
    assert.strictEqual(vue.modeles.length, 1);
    assert.strictEqual(vue.modeles[0].total, 46);
});

test("accès : un non-membre ouvrant la page ne voit pas l'annuaire, et rien n'est lu", () => {
    const { p, vue, vider, c } = preparer({ session: { groupes: [1] } });

    p.demarrer();
    vider();
    assert.strictEqual(vue.modeles.length, 0);
    assert.strictEqual(c.journal.appels.indexOf("Search"), -1);
    assert.deepStrictEqual(vue.refus, ["Cette application n'est pas disponible pour votre compte."]);
});

test("accès : appartenance illisible, la page refuse aussi (échec fermé)", () => {
    const { p, vue, vider } = preparer({ session: { echec: true } });

    p.demarrer();
    vider();
    assert.strictEqual(vue.modeles.length, 0);
    assert.strictEqual(vue.refus.length, 1);
});

test("population limitée : aucune trace d'étape ni de la personne sans cercle dans le modèle rendu", () => {
    const { p, vue, vider } = preparer();

    p.demarrer();
    vider();
    vue.actions.ouvrir(1);
    const texte = JSON.stringify(simple(dernier(vue)));
    assert.ok(!/etape|partant|Offboarding|En fonction/i.test(texte), "trace d'étape");
    assert.ok(!/Nom047|Prénom47|"id":47/.test(texte), "personne sans cercle mentionnée");
    assert.deepStrictEqual(Object.keys(dernier(vue).facettes).sort(), ["cercle", "fonction", "succursale", "titre"]);
    assert.strictEqual("etape" in dernier(vue).etat, false);
});

test("population limitée : bandeau « collaborateurs rattachés à un cercle », comme l'export du Cockpit", () => {
    const { p, vue, vider } = preparer();

    p.demarrer();
    vider();
    assert.strictEqual(dernier(vue).bandeau, "Données internes : collaborateurs rattachés à un cercle (46 personnes).");
});

test("tri : l'étape n'est plus une clé de tri", () => {
    const { p, vue, vider } = preparer();

    p.demarrer();
    vider();
    vue.actions.trier("etape");
    assert.strictEqual(dernier(vue) && dernier(vue).affichage.tri, "nom");
});

test("page : un lien de l'onglet ouvre le trombinoscope avec son filtre déjà posé", () => {
    const { p, vue, vider } = preparer({ actionInitiale: { filtre: { cle: "succursale", valeur: "Gland" } } });

    p.demarrer();
    vider();
    assert.strictEqual(vue.modeles.length, 1, "un seul rendu, filtre compris");
    assert.strictEqual(dernier(vue).etat.succursale, "Gland");
    assert.strictEqual(dernier(vue).compteur, "2 personnes sur 46");
});

test("page : un lien de personne de l'onglet ouvre le trombinoscope sur sa fiche", () => {
    const { p, vue, vider } = preparer({ actionInitiale: { ouvrir: 2 } });

    p.demarrer();
    vider();
    assert.strictEqual(dernier(vue).fiche.personne.id, 2);
});

test("page : « Afficher la fiche M-Files » signale la sélection virtuelle au module (l'onglet ne prend pas le focus)", () => {
    const etatCadre = { selectionVirtuelle: null };
    const { p, vue, vider } = preparer({ etatCadre });

    p.demarrer();
    vider();
    vue.actions.afficherDansMFiles(3);
    assert.strictEqual(etatCadre.selectionVirtuelle, 3);
});

/**
 * Présentateur de l'onglet, sur des données comme celles du module.
 *
 * @param {object} [options] { session, donnees (texte), echecAffichage }
 * @returns {object} { p, vue, affichages }
 */
function preparerOnglet(options) {
    const o = options || {};
    const c = creerCoffreCom({ objets: [], session: o.session || { groupes: [3524] } });
    const ctx = charger(SOURCES, { MFiles: c.MFiles });
    const affichages = [];
    const cadre = { ShowDashboard(id, donnees) {
        if (o.echecAffichage) { throw new Error("affichage refusé"); }
        affichages.push({ id, donnees });
    } };
    const etatCadre = { selectionVirtuelle: null };
    const vue = { onglets: [], refus: [], messages: [] };
    const fiche = { personne: { id: 1, nomComplet: "Prénom1 Nom1", fonctions: ["Formatrice"] }, responsable: null, equipe: [] };
    const donnees = o.donnees !== undefined ? o.donnees : JSON.stringify({ fiche, photo: { dataUri: null, note: null } });
    const p = ctx.presentateurOnglet.creer({ vault: c.vault, cadre, etatCadre, donnees }, (actions) => {
        vue.actions = actions;
        return {
            rendreOnglet: (m) => vue.onglets.push(m),
            refuser: (m) => vue.refus.push(m),
            message: (m) => vue.messages.push(m)
        };
    });
    return { p, vue, affichages, cadre, etatCadre };
}

test("onglet (page) : rend la fiche passée par le module, sans lire le coffre", () => {
    const { p, vue } = preparerOnglet();

    p.demarrer();
    assert.strictEqual(vue.onglets.length, 1);
    assert.strictEqual(vue.onglets[0].fiche.personne.nomComplet, "Prénom1 Nom1");
});

test("onglet (page) : une fonction ouvre le trombinoscope filtré, une personne sa fiche, par le cadre", () => {
    const { p, vue, affichages, cadre, etatCadre } = preparerOnglet();

    p.demarrer();
    vue.actions.filtrer("fonction", "Formatrice");
    vue.actions.ouvrir(2);
    assert.strictEqual(affichages[0].id, "trombinoscope");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(affichages[0].donnees.action)),
        { filtre: { cle: "fonction", valeur: "Formatrice" } });
    assert.strictEqual(affichages[0].donnees.cadre, cadre);
    assert.strictEqual(affichages[0].donnees.etatCadre, etatCadre);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(affichages[1].donnees.action)), { ouvrir: 2 });
});

test("onglet (page) : un filtre inconnu n'ouvre rien", () => {
    const { p, vue, affichages } = preparerOnglet();

    p.demarrer();
    vue.actions.filtrer("etape", "Offboarding démission");
    assert.strictEqual(affichages.length, 0);
});

test("onglet (page) : un non-membre ne voit rien, des données illisibles non plus", () => {
    const refuse = preparerOnglet({ session: { groupes: [1] } });
    const illisible = preparerOnglet({ donnees: "{pas du json" });

    refuse.p.demarrer();
    illisible.p.demarrer();
    assert.strictEqual(refuse.vue.onglets.length, 0);
    assert.deepStrictEqual(refuse.vue.refus, ["Cette application n'est pas disponible pour votre compte."]);
    assert.strictEqual(illisible.vue.onglets.length, 0);
    assert.strictEqual(illisible.vue.refus.length, 1);
});

test("onglet (page) : un affichage refusé par le client devient un message discret", () => {
    const { p, vue } = preparerOnglet({ echecAffichage: true });

    p.demarrer();
    assert.doesNotThrow(() => vue.actions.filtrer("succursale", "Gland"));
    assert.strictEqual(vue.messages.length, 1);
});
