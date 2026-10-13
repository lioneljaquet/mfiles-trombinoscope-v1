/**
 * Réservation de l'application au groupe d'accès (src/model/acces.js) :
 * groupe désigné par son alias (tebifiles.group.trombinoscope), résolu à
 * l'exécution par UserGroupOperations.GetUserGroupIDByAlias, appartenance
 * lue dans SessionInfo (groupes imbriqués compris), échec fermé.
 */
const test = require("node:test");
const assert = require("node:assert");
const { charger } = require("./charger");
const { creerCoffreCom } = require("./coffre-com-simule");

const ALIAS = "tebifiles.group.trombinoscope";
// Groupe « Trombinoscope » fictif, et « SI - membres primaires » qui en est membre
const TROMBI = 7001;
const SI = 3524;

/**
 * Verdict d'accès pour une session et des alias simulés.
 *
 * @param {object} session session simulée (voir coffre-com-simule.js)
 * @param {object} [options] options du simulateur (aliasGroupes, echecAlias)
 * @returns {object} verdict { autorise, raison }
 */
function verdict(session, options) {
    const c = creerCoffreCom(Object.assign({ session }, options || {}));
    const ctx = charger(["model/parametrage.js", "model/acces.js"], { MFiles: c.MFiles });
    return ctx.acces.verifier(c.vault);
}

test("accès : le groupe est désigné par son alias, aucun ID en dur", () => {
    const ctx = charger(["model/parametrage.js"]);

    assert.strictEqual(ctx.PARAMETRAGE.groupeAutorise, ALIAS);
});

test("accès : membre direct du groupe désigné par l'alias", () => {
    assert.strictEqual(verdict({ groupes: [TROMBI], parents: {} }).autorise, true);
});

test("accès : membre par « SI - membres primaires », membre du groupe", () => {
    assert.strictEqual(verdict({ groupes: [SI], parents: { [SI]: [TROMBI] } }).autorise, true);
});

test("accès : non-membre refusé ; être dans SI sans le lien vers le groupe ne suffit pas", () => {
    const r = verdict({ groupes: [SI], parents: {} });

    assert.strictEqual(r.autorise, false);
    assert.match(r.raison, /pas membre du groupe tebifiles\.group\.trombinoscope/);
});

test("accès : alias absent du coffre, échec fermé avec la ligne attendue", () => {
    const r = verdict({ groupes: [SI] }, { aliasGroupes: {} });

    assert.strictEqual(r.autorise, false);
    assert.strictEqual(r.raison, "groupe d'accès introuvable : alias tebifiles.group.trombinoscope");
});

test("accès : résolution de l'alias en échec, échec fermé", () => {
    const r = verdict({ groupes: [SI] }, { echecAlias: true });

    assert.strictEqual(r.autorise, false);
    assert.match(r.raison, /^groupe d'accès introuvable : alias tebifiles\.group\.trombinoscope \(résolution impossible : /);
});

test("accès : un utilisateur dont l'ID vaut celui du groupe n'est pas pris pour un membre", () => {
    assert.strictEqual(verdict({ utilisateur: TROMBI, groupes: [1], parents: {} }).autorise, false);
});

test("accès : appartenance illisible, échec fermé", () => {
    const r = verdict({ echec: true });

    assert.strictEqual(r.autorise, false);
    assert.match(r.raison, /illisible/);
});

test("accès : sans coffre, échec fermé", () => {
    const ctx = charger(["model/parametrage.js", "model/acces.js"]);

    assert.strictEqual(ctx.acces.verifier(null).autorise, false);
});
