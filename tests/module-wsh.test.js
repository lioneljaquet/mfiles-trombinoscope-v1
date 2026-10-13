/**
 * Le module dans le vrai moteur du module : cscript //E:jscript (Windows
 * Script Host, JScript sans forEach ni JSON) exécute tests/wsh/module-wsh.js
 * sur les fichiers CONSTRUITS du module, lus en ANSI (Windows-1252) comme le
 * client les lit : un texte accentué cassé (« Ã© ») y serait visible. Sous un
 * autre système que Windows, le test est sauté.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const WINDOWS = process.platform === "win32";
const RACINE = path.join(__dirname, "..");

/**
 * Construit le paquet dans une copie du dépôt et rend le dossier versionné.
 *
 * @returns {string} dossier dist/v999 de la copie
 */
function paquetConstruit() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "uixv1-wsh-"));
    fs.cpSync(RACINE, tmp, { recursive: true, filter: (s) => !/node_modules|[\\/]dist|[\\/]\.git/.test(s) });
    fs.symlinkSync(path.join(RACINE, "node_modules"), path.join(tmp, "node_modules"), "junction");
    execFileSync("node", [path.join(tmp, "build.js"), "9.9.9", "--sans-zip"], { stdio: "pipe" });
    return path.join(tmp, "dist", "v999");
}

test("module : le paquet construit tourne dans JScript de Windows Script Host, lu en ANSI (membre, non-membre, alias absent, accents)",
    { skip: !WINDOWS && "cscript n'existe que sous Windows" }, () => {
        const cscript = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "cscript.exe");
        const sortie = execFileSync(cscript, ["//nologo", "//E:jscript", path.join(__dirname, "wsh", "module-wsh.js"),
            paquetConstruit(), "windows-1252"], { encoding: "latin1" });

        assert.match(sortie, /^OK moteur JScript/, sortie);
    });
