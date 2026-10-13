/**
 * Le module dans le vrai moteur du module : cscript //E:jscript (Windows
 * Script Host, JScript sans forEach ni JSON) exécute tests/wsh/module-wsh.js
 * sur les sources. Sous un autre système que Windows, le test est sauté.
 */
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { execFileSync } = require("child_process");

const WINDOWS = process.platform === "win32";

test("module : les fichiers du module tournent dans JScript de Windows Script Host (membre, non-membre)",
    { skip: !WINDOWS && "cscript n'existe que sous Windows" }, () => {
        const cscript = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "cscript.exe");
        const sortie = execFileSync(cscript, ["//nologo", "//E:jscript", path.join(__dirname, "wsh", "module-wsh.js"),
            path.join(__dirname, "..", "src")], { encoding: "latin1" });

        assert.match(sortie, /^OK moteur JScript/, sortie);
    });
