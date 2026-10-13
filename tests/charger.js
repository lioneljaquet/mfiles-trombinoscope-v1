/**
 * Chargeur des sources livrées dans un contexte vm, pour les tests.
 *
 * Les scripts de la page et du module sont de l'ES5 « global » (aucun
 * module) : on les exécute tels quels, dans l'ordre où la page les
 * intègre, et le test lit les globales qu'ils déclarent.
 */
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");

/**
 * Charge des scripts sources dans un contexte vm neuf.
 *
 * @param {Array<string>} fichiers chemins relatifs à src/
 * @param {object} [globales] globales simulées (MFiles, Event_*…)
 * @returns {object} le contexte, qui porte les globales déclarées
 */
function charger(fichiers, globales) {
    const journal = [];
    const ctx = vm.createContext(Object.assign({
        console: { log(m) { journal.push(String(m)); } },
        JSON, String, Array, Object, Math, Number, RegExp, Error
    }, globales || {}));

    ctx.__journal = journal;
    fichiers.forEach((f) => {
        // Chemins fixes, écrits dans les tests : aucune entrée extérieure.
        const code = fs.readFileSync(path.join(SRC, f), "utf8"); // nosemgrep
        vm.runInContext(code, ctx, { filename: f });
    });
    return ctx;
}

/**
 * Copie « simple » d'une valeur du contexte vm : les tableaux et objets
 * créés dans un autre contexte ne passent pas deepStrictEqual (prototypes
 * distincts).
 *
 * @param {*} valeur valeur issue du contexte
 * @returns {*} la même valeur, aux prototypes de ce contexte
 */
function simple(valeur) {
    return valeur === undefined ? undefined : JSON.parse(JSON.stringify(valeur));
}

module.exports = { charger, simple };
