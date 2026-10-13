/**
 * Non-régression des pièges v1 côté module (src/presenter/shellui.js) et
 * construction du paquet (build.js).
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { charger } = require("./charger");
const { creerCoffreCom } = require("./coffre-com-simule");

const RACINE = path.join(__dirname, "..");
const EVENEMENTS = {
    Event_NewShellFrame: "NewShellFrame", Event_Started: "Started", Event_CustomCommand: "CustomCommand",
    TaskPaneGroup_Main: 1
};

/**
 * Cadre simulé du client.
 *
 * @param {string} nom nom du cadre
 * @param {object} options { dialogue: pas de volet des tâches, affichages: journal, prochain: compteur d'ID }
 * @returns {object} cadre
 */
function cadre(nom, options) {
    const h = { volet: [] };
    return {
        _h: h,
        nom,
        Events: { Register(e, cb) { if (e === "Started") { cb(); } } },
        Commands: {
            CreateCustomCommand: (libelle) => { h.libelle = libelle; return ++options.prochain.n; },
            AddCustomCommandToMenu() { h.menu = true; },
            SetIconFromPath(id, chemin) { h.icone = chemin; },
            Events: { Register(e, cb) { if (e === "CustomCommand") { h.cmd = cb; } } }
        },
        TaskPane: options.dialogue ? null : { AddCustomCommandToGroup(id, groupe) { h.volet.push([id, groupe]); } },
        ShowDashboard: (id, donnees) => options.affichages.push({ cadre: nom, id, donnees })
    };
}

/**
 * Charge le module avec deux cadres : A normal, B dialogue.
 *
 * @param {object} [session] session simulée (par défaut : membre direct du groupe 3524)
 * @returns {object} { a, b, affichages, journal }
 */
function deuxCadres(session) {
    const options = { prochain: { n: 100 }, affichages: [] };
    const c = creerCoffreCom({ session: session || { groupes: [3524] } });
    const ctx = charger(["model/parametrage.js", "model/acces.js", "presenter/shellui.js"], EVENEMENTS);
    const a = cadre("A", options);
    const b = cadre("B", Object.assign({}, options, { dialogue: true }));

    ctx.OnNewShellUI({ Vault: c.vault,
        Events: { Register(e, cb) { assert.strictEqual(e, "NewShellFrame"); cb(a); cb(b); } } });
    return { a, b, affichages: options.affichages, journal: ctx.__journal };
}

test("module : commande « Trombinoscope » dans le volet des tâches, icône du dossier versionné", () => {
    const { a } = deuxCadres();

    assert.strictEqual(a._h.libelle, "Trombinoscope");
    assert.deepStrictEqual(a._h.volet, [[101, 1]]);
    assert.strictEqual(a._h.icone, "{DOSSIER}/icones/app.ico");
});

test("module : un clic sur la commande d'un cadre n'affiche que dans ce cadre", () => {
    const { a, b, affichages } = deuxCadres();

    a._h.cmd(102);                 // commande du cadre B : A l'ignore
    a._h.cmd(101);
    b._h.cmd(102);

    assert.deepStrictEqual(affichages.map((x) => x.cadre), ["A", "B"]);
});

test("module : le tableau de bord reçoit son cadre et la version dans CustomData", () => {
    const { a, affichages } = deuxCadres();

    a._h.cmd(101);
    assert.strictEqual(affichages[0].id, "trombinoscope");
    assert.strictEqual(affichages[0].donnees.cadre, a);
    assert.strictEqual(affichages[0].donnees.version, "{VERSION} (UIX v1)");
});

test("module : une boîte de dialogue (sans volet des tâches) ne fait pas échouer le module", () => {
    const { b } = deuxCadres();

    assert.strictEqual(b._h.volet.length, 0);
    assert.strictEqual(typeof b._h.cmd, "function");
});

test("accès : membre par un groupe imbriqué, la commande est posée", () => {
    const { a } = deuxCadres({ groupes: [10], parents: { 10: [3524] } });

    assert.strictEqual(a._h.libelle, "Trombinoscope");
});

test("accès : un non-membre ne reçoit pas la commande, et le journal dit pourquoi", () => {
    const { a, b, journal } = deuxCadres({ groupes: [1, 10] });

    assert.strictEqual(a._h.libelle, undefined);
    assert.strictEqual(b._h.libelle, undefined);
    assert.ok(journal.some((l) => /\[trombinoscope\] commande non ajoutée : l'utilisateur n'est pas membre du groupe 3524/.test(l)));
});

test("accès : appartenance illisible, pas de commande (échec fermé)", () => {
    const { a, journal } = deuxCadres({ echec: true });

    assert.strictEqual(a._h.libelle, undefined);
    assert.ok(journal.some((l) => /commande non ajoutée : appartenance illisible : session illisible/.test(l)));
});

/**
 * Copie le dépôt (sans node_modules ni dist) dans un dossier temporaire,
 * node_modules relié par une jonction.
 *
 * @returns {string} dossier de la copie
 */
function copieDuDepot() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "uixv1-"));
    fs.cpSync(RACINE, tmp, { recursive: true, filter: (s) => !/node_modules|[\\/]dist|[\\/]\.git/.test(s) });
    fs.symlinkSync(path.join(RACINE, "node_modules"), path.join(tmp, "node_modules"), "junction");
    return tmp;
}

test("construction : refuse un script non ES5", () => {
    const tmp = copieDuDepot();
    fs.appendFileSync(path.join(tmp, "src", "model", "regles.js"), "\nconst x = () => 1;\n");

    assert.throws(() => execFileSync("node", [path.join(tmp, "build.js"), "9.9.9", "--sans-zip"], { stdio: "pipe" }),
        /non ES5/);
});

test("construction : refuse un groupe autorisé non renseigné", () => {
    const tmp = copieDuDepot();
    const p = path.join(tmp, "src", "model", "parametrage.js");
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/groupeAutorise: \d+/, "groupeAutorise: 0"));

    assert.throws(() => execFileSync("node", [path.join(tmp, "build.js"), "9.9.9", "--sans-zip"], { stdio: "pipe" }),
        /groupe autorisé/);
});

test("construction : page autonome, jetons remplis, manifeste à la racine", () => {
    const tmp = copieDuDepot();
    execFileSync("node", [path.join(tmp, "build.js"), "9.9.9", "--sans-zip"], { stdio: "pipe" });
    const page = fs.readFileSync(path.join(tmp, "dist", "v999", "view", "dashboard", "index.html"), "utf8");
    const appdef = fs.readFileSync(path.join(tmp, "dist", "appdef.xml"), "utf8");

    assert.ok(!/build:(js|css)/.test(page), "marqueur build: resté dans la page");
    assert.ok(!/<script[^>]+src=/i.test(page), "script externe dans la page");
    assert.ok(!/\{VERSION\}|\{DOSSIER\}/.test(page + appdef), "jeton non rempli");
    assert.ok(/var VERSION_PAQUET = "9\.9\.9 \(UIX v1\)"/.test(page));
    // La page ne navigue jamais : le tableau de bord refuse tout lien sortant
    // (m-files://, mailto:) par une boîte d'erreur du client (docs/adr/0004)
    assert.ok(!/href/i.test(page), "lien href dans la page");
    assert.ok(/<file>v999\/icones\/app\.ico<\/file>/.test(appdef));
    assert.ok(/<file>v999\/model\/acces\.js<\/file>/.test(appdef), "contrôle d'accès absent du module");
    assert.ok(/var acces = /.test(page), "contrôle d'accès absent de la page");
    assert.ok(/<optional>true<\/optional>/.test(appdef), "optional explicite");
    assert.ok(/<content>v999\/view\/dashboard\/index\.html<\/content>/.test(appdef));
    const balises = appdef.replace(/<!--[\s\S]*?-->/g, "");
    assert.ok(balises.indexOf("<files>") > balises.indexOf("<required-mfiles-version>") &&
        balises.indexOf("<files>") < balises.indexOf("<platforms>"), "ordre du manifeste v4");
});
