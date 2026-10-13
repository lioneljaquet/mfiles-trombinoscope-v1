/**
 * Prépare une page d'essai hors M-Files : la page construite
 * (dist/vXYZ/view/dashboard/index.html), le coffre COM simulé et un coffre
 * de collaborateurs FICTIFS, puis l'appel OnNewDashboard que ferait le
 * client. À ouvrir dans un navigateur (file://) pour voir la grille, la
 * liste, les filtres et la fiche. N'est pas livré.
 *
 * Usage : node build.js --sans-zip && node tests/navigateur/preparer-essai.js
 */
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..", "..");
const VERSION = require(path.join(RACINE, "package.json")).version;
const PAGE = path.join(RACINE, "dist", "v" + VERSION.replace(/\./g, ""), "view", "dashboard", "index.html");
const SORTIE = path.join(__dirname, "sortie", "essai.html");

const PRENOMS = ["Alice", "Bruno", "Chloé", "David", "Émilie", "François", "Gaëlle", "Hugo", "Inès", "Julien",
    "Karine", "Luc", "Maëlle", "Nicolas", "Océane", "Pierre", "Quentin", "Rachel", "Sébastien", "Tania",
    "Ugo", "Valérie", "William", "Xavier", "Yasmine", "Zoé", "André", "Béatrice", "Cédric", "Delphine"];
const NOMS = ["Exemple", "Fictif", "Modèle", "Essai", "Témoin", "Prototype", "Maquette", "Brouillon", "Ébauche",
    "Esquisse", "Gabarit", "Patron", "Spécimen", "Échantillon", "Démo", "Pilote", "Test", "Factice", "Imaginaire",
    "Inventé", "Supposé", "Virtuel", "Théorique", "Hypothèse", "Simulé", "Feint", "Postiche", "Copie", "Double", "Reflet"];
const SUCCURSALES = ["Gland", "Sion", "Bulle", null];
const TITRES = ["Ingénieur systèmes", "Cheffe de projet", "Consultant", "Développeuse", "Comptable", "Directeur"];
const FONCTIONS = ["Consultant Senior", "Formateur", "Chef de projet Confirmé", "Ingénieur Expert", "Architecte"];

/**
 * Coffre fictif : cercles, rôles, collaborateurs à diverses étapes.
 *
 * @returns {Array} objets simulés (format de coffre-com-simule.js)
 */
function objetsFictifs() {
    const lk = (id, nom) => ({ type: 9, valeur: { id, nom } });
    const multi = (liste) => ({ type: 10, valeur: liste.map(([id, nom]) => ({ id, nom })) });
    const txt = (v) => ({ type: 1, valeur: v });
    const cercles = [[901, "INFRA"], [902, "GDI"], [903, "Commercial"], [904, "Capital Humain"], [905, "CA"]];
    const objets = [
        { type: 362, id: 900, titre: "tebicom SA", props: { 2926: multi(cercles.slice(0, 4).concat([[910, "Direction"]])) } },
        { type: 362, id: 901, titre: "INFRA", props: { 2926: multi([[911, "Service de piquet"]]) } },
        { type: 362, id: 902, titre: "GDI", props: { 2926: multi([[912, "Référent qualité"]]) } },
        { type: 362, id: 903, titre: "Commercial", props: {} },
        { type: 362, id: 904, titre: "Capital Humain", props: {} },
        { type: 362, id: 905, titre: "CA", props: {} },
        { type: 362, id: 906, titre: "Groupe d'accès", props: { 2926: multi([[905, "CA"]]) } },
        { type: 362, id: 910, titre: "Direction", props: {} },
        { type: 362, id: 911, titre: "Service de piquet", props: {} },
        { type: 362, id: 912, titre: "Référent qualité", props: {} }
    ];
    PRENOMS.forEach((prenom, i) => {
        const id = i + 1;
        const cercle = cercles[i % 4];
        const etape = i === 7 ? [1475, "Offboarding démission"] : i === 12 ? [999, "Fin des rapports de travail"] : [319, "En fonction"];
        const auto = [cercle].concat(i % 3 === 0 ? [[911, "Service de piquet"]] : [])
            .concat(i % 5 === 0 ? [cercles[(i + 1) % 4]] : []).concat(i < 2 ? [[905, "CA"], [906, "Groupe d'accès"]] : []);
        objets.push({
            type: 104, id, titre: prenom,
            props: {
                39: lk(etape[0], etape[1]), 1387: txt(prenom), 1386: txt(i === 3 ? NOMS[i].toUpperCase() : NOMS[i]),
                1079: txt((prenom.slice(0, 1) + NOMS[i].slice(0, 2)).toUpperCase()),
                2376: txt(TITRES[i % TITRES.length]), 3638: lk(50 + (i % 5), FONCTIONS[i % 5]),
                3641: multi(FONCTIONS.slice(0, 1 + (i % 4)).map((f, k) => [60 + k, f])),
                2414: SUCCURSALES[i % 4] ? lk(70 + (i % 4), SUCCURSALES[i % 4]) : txt(null),
                2929: lk(cercle[0], cercle[1]), 2928: multi(auto),
                1217: i === 0 ? txt(null) : lk(i < 6 ? 1 : 1 + (i % 6), "responsable"),
                2821: txt(prenom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + "." +
                    NOMS[i].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + "@exemple.ch"),
                2823: txt("POISON-MOBILE")
            }
        });
    });
    return objets;
}

const simulateur = fs.readFileSync(path.join(RACINE, "tests", "coffre-com-simule.js"), "utf8");
const injection = "<script>\n(function () {\nvar module = {};\n" + simulateur +
    "\nvar c = module.exports.creerCoffreCom({ objets: " + JSON.stringify(objetsFictifs()) + ", session: { groupes: [3524] } });\n" +
    "window.MFiles = c.MFiles;\nc.cadre.ShowDefaultContent = function () { console.log('ShowDefaultContent appelé'); };\n" +
    "window.__essai = c;\nwindow.addEventListener('load', function () {\n" +
    "  OnNewDashboard({ Vault: c.vault, CustomData: { cadre: c.cadre, version: 'essai' } });\n});\n}());\n</script>\n";

const page = fs.readFileSync(PAGE, "utf8").replace("</body>", () => injection + "</body>");
fs.mkdirSync(path.dirname(SORTIE), { recursive: true });
fs.writeFileSync(SORTIE, page);
console.log("page d'essai : " + SORTIE);
