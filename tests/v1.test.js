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
    Event_SelectionChanged: "SelectionChanged", TaskPaneGroup_Main: 1
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
 * @param {object} [session] session simulée (par défaut : dans SI - membres primaires, membre du groupe d'accès)
 * @returns {object} { a, b, affichages, journal }
 */
function deuxCadres(session) {
    const options = { prochain: { n: 100 }, affichages: [] };
    const c = creerCoffreCom({ session: session || { groupes: [3524] } });
    const ctx = charger(["model/compat.js", "model/parametrage.js", "model/acces.js", "model/regles.js",
        "model/vault-com.js", "model/portraits.js", "presenter/onglet.js", "presenter/shellui.js"], EVENEMENTS);
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
    const { a } = deuxCadres({ groupes: [10], parents: { 10: [3524], 3524: [7001] } });

    assert.strictEqual(a._h.libelle, "Trombinoscope");
});

test("accès : un non-membre ne reçoit pas la commande, et le journal dit pourquoi", () => {
    const { a, b, journal } = deuxCadres({ groupes: [1, 10] });

    assert.strictEqual(a._h.libelle, undefined);
    assert.strictEqual(b._h.libelle, undefined);
    assert.ok(journal.some((l) => /\[trombinoscope\] commande non ajoutée : l'utilisateur n'est pas membre du groupe tebifiles\.group\.trombinoscope/.test(l)));
});

test("accès : groupe d'accès introuvable (alias absent du coffre), ni commande ni onglet", () => {
    const options = { prochain: { n: 100 }, affichages: [] };
    const c = creerCoffreCom({ session: { groupes: [3524] }, aliasGroupes: {} });
    const ctx = charger(["model/compat.js", "model/parametrage.js", "model/acces.js", "model/regles.js",
        "model/vault-com.js", "model/portraits.js", "presenter/onglet.js", "presenter/shellui.js"], EVENEMENTS);
    const a = cadre("A", options);

    ctx.OnNewShellUI({ Vault: c.vault, Events: { Register(e, cb) { cb(a); } } });
    assert.strictEqual(a._h.libelle, undefined);
    assert.ok(ctx.__journal.some((l) =>
        l === "[trombinoscope] commande non ajoutée : groupe d'accès introuvable : alias tebifiles.group.trombinoscope"));
});

test("construction : refuse un alias de groupe vide ou mal formé", () => {
    ["", "trombinoscope", "tebifiles..group", "tebifiles.group.trombi noscope"].forEach((alias) => {
        const tmp = copieDuDepot();
        const p = path.join(tmp, "src", "model", "parametrage.js");
        fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/groupeAutorise: "[^"]*"/, () => "groupeAutorise: \"" + alias + "\""));

        assert.throws(() => execFileSync("node", [path.join(tmp, "build.js"), "9.9.9", "--sans-zip"], { stdio: "pipe" }),
            /alias du groupe d'accès/, "alias accepté à tort : " + alias);
    });
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

    // Le client lit les scripts du module en ANSI (constaté : « Ã© » pour « é ») : tout script livré,
    // module ou page, ne doit contenir que de l'ASCII, les autres caractères en \\uXXXX
    const scripts = [];
    (function parcourir(dossier) {
        fs.readdirSync(dossier, { withFileTypes: true }).forEach((e) => {
            const f = path.join(dossier, e.name);
            if (e.isDirectory()) { parcourir(f); } else if (f.endsWith(".js")) { scripts.push(f); }
        });
    })(path.join(tmp, "dist", "v999"));
    assert.ok(scripts.length >= 9);
    scripts.forEach((f) => {
        const octets = fs.readFileSync(f);
        assert.ok(octets.every((o) => o < 0x80), "octet non ASCII dans " + path.basename(f));
    });
    (page.match(/<script>[\s\S]*?<\/script>/g) || []).forEach((bloc) => {
        assert.ok(!/[^\x00-\x7f]/.test(bloc), "script de la page non ASCII");
    });
    assert.ok(/<meta charset="utf-8" \/>/.test(page), "page en UTF-8 déclaré");
    assert.ok(fs.readFileSync(path.join(tmp, "dist", "v999", "view", "dashboard", "index.html")).every((o) => o < 0x80),
        "page non ASCII : les textes accentués doivent être des entités");
    assert.ok(/Pr&#xe9;nom/.test(page), "texte accentué de la page en entité");
    assert.ok(/<content>v999\/view\/dashboard\/index\.html<\/content>/.test(appdef));
    const balises = appdef.replace(/<!--[\s\S]*?-->/g, "");
    assert.ok(balises.indexOf("<files>") > balises.indexOf("<required-mfiles-version>") &&
        balises.indexOf("<files>") < balises.indexOf("<platforms>"), "ordre du manifeste v4");
});
