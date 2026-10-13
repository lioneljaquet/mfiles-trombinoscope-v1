/**
 * Réservation de l'application au groupe « SI - membres primaires »
 * (src/model/acces.js) : appartenance lue dans SessionInfo, groupes
 * imbriqués compris, échec fermé.
 */
const test = require("node:test");
const assert = require("node:assert");
const { charger } = require("./charger");
const { creerCoffreCom } = require("./coffre-com-simule");

const GROUPE = 3524;

/**
 * Verdict d'accès pour une session simulée.
 *
 * @param {object} session session simulée (voir coffre-com-simule.js)
 * @returns {object} { verdict, journal }
 */
function verdict(session) {
    const c = creerCoffreCom({ session });
    const ctx = charger(["model/parametrage.js", "model/acces.js"], { MFiles: c.MFiles });
    return { verdict: ctx.acces.verifier(c.vault), journal: ctx.__journal };
}

test("accès : le groupe autorisé est « SI - membres primaires », ID 3524", () => {
    const ctx = charger(["model/parametrage.js"]);
    assert.strictEqual(ctx.PARAMETRAGE.groupeAutorise, GROUPE);
});

test("accès : membre direct du groupe", () => {
    assert.strictEqual(verdict({ groupes: [1, GROUPE] }).verdict.autorise, true);
});

test("accès : membre par un groupe imbriqué", () => {
    assert.strictEqual(verdict({ groupes: [10], parents: { 10: [20], 20: [GROUPE] } }).verdict.autorise, true);
});

test("accès : non-membre refusé", () => {
    const r = verdict({ groupes: [1, 10], parents: { 10: [20] } }).verdict;
    assert.strictEqual(r.autorise, false);
    assert.match(r.raison, /pas membre du groupe 3524/);
});

test("accès : un utilisateur dont l'ID vaut celui du groupe n'est pas pris pour un membre", () => {
    assert.strictEqual(verdict({ utilisateur: GROUPE, groupes: [1] }).verdict.autorise, false);
});

test("accès : appartenance illisible, échec fermé", () => {
    const r = verdict({ echec: true }).verdict;
    assert.strictEqual(r.autorise, false);
    assert.match(r.raison, /appartenance illisible : session illisible/);
});

test("accès : sans coffre, échec fermé", () => {
    const ctx = charger(["model/parametrage.js", "model/acces.js"]);
    assert.strictEqual(ctx.acces.verifier(null).autorise, false);
});
