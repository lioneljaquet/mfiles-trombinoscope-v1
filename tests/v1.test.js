/**
 * Non-régression des pièges v1.
 */
const test = require("node:test");
const assert = require("node:assert");
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { creerCoffreCom } = require("./coffre-com-simule");

const SRC = path.join(__dirname, "..", "src");

/**
 * Charge des scripts sources dans un contexte vm.
 *
 * @param {Array} fichiers chemins relatifs à src/
 * @param {object} globales globales simulées
 * @returns {object} contexte
 */
function charger(fichiers, globales) {
    const ctx = vm.createContext(Object.assign({ console: { log() {} }, JSON, String, Array, Object }, globales));
    fichiers.forEach((f) => vm.runInContext(fs.readFileSync(path.join(SRC, f), "utf8"), ctx)); // nosemgrep : chemins fixes
    return ctx;
}

test("écriture : UndoCheckout sur échec de SetProperty", () => {
    const c = creerCoffreCom({ echecSur: "SetProperty" });
    const ctx = charger(["model/parametrage.js", "model/vault-com.js"], { MFiles: c.MFiles });
    const r = ctx.ecrireProprietes(c.vault, {}, [{ propertyId: 1, datatype: 1, valeur: "a" }]);

    assert.strictEqual(r.ok, false);
    assert.deepStrictEqual(c.journal.appels.slice(), ["CheckOut", "SetProperty", "UndoCheckout"]);
});

test("écriture : un seul CheckOut/CheckIn pour plusieurs propriétés", () => {
    const c = creerCoffreCom({});
    const ctx = charger(["model/parametrage.js", "model/vault-com.js"], { MFiles: c.MFiles });
    const r = ctx.ecrireProprietes(c.vault, {}, [
        { propertyId: 1, datatype: 1, valeur: "a" }, { propertyId: 2, datatype: 9, valeur: 3 }]);

    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(c.journal.appels.slice(), ["CheckOut", "SetProperty", "SetProperty", "CheckIn"]);
});

test("sélection virtuelle : collection ObjOrFileVers", () => {
    const c = creerCoffreCom({});
    const ctx = charger(["model/parametrage.js", "model/vault-com.js"], { MFiles: c.MFiles });

    assert.strictEqual(ctx.selectionVirtuelle(c.cadre, { ID: 1 }), true);
    assert.strictEqual(c.journal.selection.Count, 1);
});

test("un clic sur la commande d'un cadre n'affiche que dans ce cadre", () => {
    let prochain = 100;
    const affichages = [];

    /**
     * Cadre simulé.
     *
     * @param {string} nom nom du cadre
     * @param {boolean} dialogue vrai : pas de volet des tâches
     * @returns {object} cadre
     */
    function cadre(nom, dialogue) {
        const h = {};
        return {
            _h: h,
            Events: { Register(e, cb) { if (e === "Started") { cb(); } } },
            Commands: { CreateCustomCommand: () => ++prochain, AddCustomCommandToMenu() {}, SetIconFromPath() {},
                        Events: { Register(e, cb) { h.cmd = cb; } } },
            TaskPane: dialogue ? null : { AddCustomCommandToGroup() {} },
            Listing: { Events: { Register() {} } },
            ShowDashboard: () => affichages.push(nom)
        };
    }

    const ctx = charger(["model/parametrage.js", "presenter/shellui.js"], {
        Event_NewShellFrame: "NewShellFrame", Event_Started: "Started", Event_CustomCommand: "CustomCommand",
        Event_SelectionChanged: "SelectionChanged", TaskPaneGroup_Main: 1, MenuLocation_ContextMenu_Top: 2
    });
    const a = cadre("A", false);
    const b = cadre("B", true);

    ctx.OnNewShellUI({ Events: { Register(e, cb) { assert.strictEqual(e, "NewShellFrame"); cb(a); cb(b); } } });
    b._h.cmd(102);                 // commande du cadre B
    a._h.cmd(102);                 // le cadre A ne la connaît pas

    assert.deepStrictEqual(affichages, ["B"]);
});

test("la construction refuse un script non ES5", () => {
    const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "uixv1-"));
    fs.cpSync(path.join(__dirname, ".."), tmp, { recursive: true, filter: (s) => !/node_modules|dist/.test(s) });
    fs.symlinkSync(path.join(__dirname, "..", "node_modules"), path.join(tmp, "node_modules"), "junction");
    fs.appendFileSync(path.join(tmp, "src", "view", "dashboard", "dashboard.js"), "\nconst x = () => 1;\n");

    assert.throws(() => execFileSync("node", [path.join(tmp, "build.js"), "9.9.9"], { stdio: "pipe" }), /non ES5/);
});
