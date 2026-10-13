/**
 * ESLint v1 : les sources livrées sont contrôlées en ES5 (contrôle web
 * IE11) ; build.js et les tests tournent sous Node. Placé à la racine :
 * ESLint 9 ignore les fichiers hors de son dossier de base.
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
const client = { MFiles: "readonly", console: "readonly", document: "readonly", window: "readonly",
    JSON: "readonly", PARAMETRAGE: "readonly", MF: "readonly", VERSION_PAQUET: "readonly", PREFIXE_JOURNAL: "readonly" };
const v1 = { ecmaVersion: 5, sourceType: "script" };

module.exports = [
    { files: ["src/model/parametrage.js"], languageOptions: { ...v1, globals: { console: "readonly" } }, plugins: { security }, rules: regles },
    { files: ["src/model/vault-com.js", "src/view/**/*.js"], languageOptions: { ...v1, globals: client }, plugins: { security }, rules: regles },
    { files: ["src/presenter/*.js"],
      languageOptions: { ...v1, globals: { ...client, Event_NewShellFrame: "readonly", Event_Started: "readonly",
        Event_CustomCommand: "readonly", Event_SelectionChanged: "readonly", TaskPaneGroup_Main: "readonly",
        MenuLocation_ContextMenu_Top: "readonly" } },
      plugins: { security }, rules: regles },
    { files: ["build.js", "tests/**/*.js"],
      languageOptions: { ecmaVersion: 2022, sourceType: "commonjs",
        globals: { require: "readonly", module: "writable", process: "readonly", __dirname: "readonly", console: "readonly" } },
      plugins: { security }, rules: regles }
];
