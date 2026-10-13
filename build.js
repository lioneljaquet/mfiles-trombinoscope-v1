/* =====================================================================
   CONSTRUCTION DU PAQUET — UIX v1 (client classique)

   1. copie src/ vers dist/{DOSSIER}/ (DOSSIER = "v" + version sans points :
      le client met en cache indépendamment de <version>) ;
   2. remplit {VERSION} et {DOSSIER} dans appdef.xml (racine de dist/) et
      dans les scripts du module ;
   3. intègre CSS et scripts dans chaque page (marqueurs build:css /
      build:js) : un fichier externe se charge mal dans le contrôle web ;
   4. REFUSE de livrer si un script n'est pas de l'ES5 valide, ou si deux
      scripts d'une même page déclarent le même nom global.

   Usage : node build.js 1.0.0
   ===================================================================== */
const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

const VERSION = process.argv[2] || "1.0.0";
const DOSSIER = "v" + VERSION.replace(/\./g, "");
const SRC = path.join(__dirname, "src");
const DIST = path.join(__dirname, "dist");
const CIBLE = path.join(DIST, DOSSIER);

/**
 * Copie récursive d'un dossier.
 *
 * @param {string} de dossier source
 * @param {string} vers dossier cible
 * @returns {void}
 */
function copier(de, vers) {
    fs.mkdirSync(vers, { recursive: true });
    fs.readdirSync(de, { withFileTypes: true }).forEach((e) => {
        const a = path.join(de, e.name);
        const b = path.join(vers, e.name);
        if (e.isDirectory()) { copier(a, b); } else { fs.copyFileSync(a, b); }
    });
}

/**
 * Remplace les jetons de construction. Remplacement par fonction : une
 * chaîne de remplacement interpréterait « $& » présent dans le contenu.
 *
 * @param {string} texte contenu
 * @returns {string} contenu complété
 */
function jetons(texte) {
    return texte.replace(/\{VERSION\}/g, () => VERSION).replace(/\{DOSSIER\}/g, () => DOSSIER);
}

/**
 * Noms globaux déclarés au premier niveau d'un script.
 *
 * @param {object} ast arbre acorn
 * @returns {Array} noms
 */
function globaux(ast) {
    const noms = [];
    ast.body.forEach((n) => {
        if (n.type === "FunctionDeclaration") { noms.push(n.id.name); }
        if (n.type === "VariableDeclaration") { n.declarations.forEach((d) => noms.push(d.id.name)); }
    });
    return noms;
}

/**
 * Vérifie qu'un script est de l'ES5 et rend son arbre.
 *
 * @param {string} code source
 * @param {string} nom nom pour le message
 * @returns {object} arbre acorn
 */
function verifierEs5(code, nom) {
    try {
        return acorn.parse(code, { ecmaVersion: 5 });
    } catch (e) {
        throw new Error("Script non ES5 : " + nom + " — " + e.message);
    }
}

fs.rmSync(DIST, { recursive: true, force: true });
copier(SRC, CIBLE);

// Manifeste à la racine du paquet.
fs.writeFileSync(path.join(DIST, "appdef.xml"), jetons(fs.readFileSync(path.join(CIBLE, "appdef.xml"), "utf8")));
fs.rmSync(path.join(CIBLE, "appdef.xml"));

// Scripts : jetons + contrôle ES5.
(function parcourir(dossier) {
    fs.readdirSync(dossier, { withFileTypes: true }).forEach((e) => {
        const f = path.join(dossier, e.name);
        if (e.isDirectory()) { parcourir(f); return; }
        if (f.endsWith(".js")) {
            const code = jetons(fs.readFileSync(f, "utf8"));
            verifierEs5(code, path.relative(DIST, f));
            fs.writeFileSync(f, code);
        }
    });
})(CIBLE);

// Pages : intégration et contrôle des collisions.
(function pages(dossier) {
    fs.readdirSync(dossier, { withFileTypes: true }).forEach((e) => {
        const f = path.join(dossier, e.name);
        if (e.isDirectory()) { pages(f); return; }
        if (!f.endsWith(".html")) { return; }

        const vus = {};
        let html = fs.readFileSync(f, "utf8");

        html = html.replace(/<!-- build:css (\S+) -->/g, (m, rel) => {
            const css = fs.readFileSync(path.join(path.dirname(f), rel), "utf8"); // nosemgrep : chemins issus des sources du paquet
            return "<style>\n" + css + "\n</style>";
        });
        html = html.replace(/<!-- build:js (\S+) -->/g, (m, rel) => {
            const code = fs.readFileSync(path.join(path.dirname(f), rel), "utf8"); // nosemgrep : chemins issus des sources du paquet
            globaux(verifierEs5(code, rel)).forEach((nom) => {
                if (vus[nom]) { throw new Error("Collision de « " + nom + " » dans " + e.name + " : " + vus[nom] + " / " + rel); }
                vus[nom] = rel;
            });
            return "<script>\n" + code + "\n</script>";
        });
        fs.writeFileSync(f, html);
    });
})(CIBLE);

console.log("paquet construit : dist/ (dossier " + DOSSIER + ")");
