/**
 * ESLint v1 : les sources livrées sont contrôlées en ES5 (contrôle web
 * IE11) avec, pour chaque fichier, les seules globales qu'il a le droit
 * de lire ; build.js, scripts/ et les tests tournent sous Node. Placé à la
 * racine : ESLint 9 ignore les fichiers hors de son dossier de base.
 */
const security = require("eslint-plugin-security");

const regles = {
    ...security.configs.recommended.rules,
    "no-undef": "error",
    "no-unused-vars": ["warn", { caughtErrors: "none" }],
    eqeqeq: ["warn", "smart"],
    curly: ["warn", "multi-line"],
    "brace-style": ["warn", "1tbs", { allowSingleLine: true }]
};
const v1 = { ecmaVersion: 5, sourceType: "script" };
const ro = (noms) => Object.fromEntries(noms.map((n) => [n, "readonly"]));
const navigateur = ["console", "document", "window", "JSON", "setTimeout", "clearTimeout"];

module.exports = [
    { ignores: ["dist/**", "node_modules/**", "tests/navigateur/sortie/**"] },
    { files: ["src/model/parametrage.js"], languageOptions: { ...v1, globals: {} }, plugins: { security }, rules: regles },
    { files: ["src/model/regles.js"], languageOptions: { ...v1, globals: ro(["PARAMETRAGE"]) },
      plugins: { security }, rules: regles },
    { files: ["src/model/vault-com.js"],
      languageOptions: { ...v1, globals: ro(["MFiles", "MF", "PARAMETRAGE", "PREFIXE_JOURNAL", "console"]) },
      plugins: { security }, rules: regles },
    { files: ["src/view/**/*.js"], languageOptions: { ...v1, globals: ro(navigateur.concat(["VERSION_PAQUET"])) },
      plugins: { security }, rules: regles },
    { files: ["src/presenter/trombinoscope.js"],
      languageOptions: { ...v1, globals: ro(navigateur.concat(["regles", "coffre", "rendu", "PARAMETRAGE",
          "PREFIXE_JOURNAL", "VERSION_PAQUET"])) },
      plugins: { security }, rules: regles },
    { files: ["src/presenter/shellui.js"],
      languageOptions: { ...v1, globals: ro(["console", "PARAMETRAGE", "PREFIXE_JOURNAL", "VERSION_PAQUET",
          "Event_NewShellFrame", "Event_Started", "Event_CustomCommand", "TaskPaneGroup_Main"]) },
      plugins: { security }, rules: regles },
    { files: ["build.js", "eslint.config.js", "scripts/**/*.js", "tests/**/*.js"],
      languageOptions: { ecmaVersion: 2022, sourceType: "commonjs",
        globals: ro(["require", "process", "__dirname", "console", "Buffer"]) },
      plugins: { security }, rules: regles },
    { files: ["tests/coffre-com-simule.js", "tests/charger.js", "tests/navigateur/*.js"],
      languageOptions: { globals: { module: "writable" } } }
];
