/* exported Event_NewShellFrame, Event_CustomCommand, TaskPaneGroup_Main, MFiles */
/* =====================================================================
   ESSAI DU MODULE DANS LE MOTEUR DU MODULE (Windows Script Host, JScript)

   Le module shellui s'exécute dans WSH (guide UIX v1, § 2.7), dont le
   JScript n'a ni forEach ni JSON. Ce script, lancé par cscript //E:jscript
   (voir module-wsh.test.js), charge les fichiers du module dans CE moteur,
   avec un coffre COM simulé écrit lui aussi en ES3, et rejoue deux cas :
   un membre qui sélectionne un collaborateur (onglet et photo), un
   non-membre (ni commande ni onglet). Il écrit « OK » ou « ECHEC : … ».

   Usage : cscript //nologo //E:jscript tests\wsh\module-wsh.js <dossier src>
   ===================================================================== */

var RACINE = WScript.Arguments.Item(0);
var FICHIERS = ["model/compat.js", "model/parametrage.js", "model/acces.js", "model/regles.js",
    "model/vault-com.js", "model/portraits.js", "presenter/onglet.js", "presenter/shellui.js"];

var Event_NewShellFrame = 1;
var Event_Started = 2;
var Event_CustomCommand = 3;
var Event_SelectionChanged = 4;
var TaskPaneGroup_Main = 0;
var console = { lignes: [], log: function (m) { console.lignes.push(String(m)); } };

/**
 * Lit un fichier UTF-8.
 *
 * @param {string} chemin chemin Windows
 * @returns {string} contenu
 */
function lire(chemin) {
    var flux = new ActiveXObject("ADODB.Stream");
    var texte;
    flux.Type = 2;
    flux.Charset = "utf-8";
    flux.Open();
    flux.LoadFromFile(chemin);
    texte = flux.ReadText();
    flux.Close();
    return texte;
}

/**
 * Collection COM simulée (base 1).
 *
 * @param {Array} elements contenu
 * @returns {object} collection
 */
function collection(elements) {
    var c = { contenu: elements || [], Count: (elements || []).length };
    c.Item = function (i) { return c.contenu[i - 1]; };
    c.Add = function (pos, x) { c.contenu.push(x); c.Count = c.contenu.length; };
    return c;
}

// ---- Coffre simulé (ES3) ----------------------------------------------

/**
 * Valeur de propriété simulée.
 *
 * @param {number} type 1 texte, 9 lookup, 10 multi
 * @param {*} v valeur ({ id, nom } ou tableau de { id, nom }, ou texte)
 * @returns {object} valeur
 */
function val(type, v) {
    return { type: type, v: v };
}

var OBJETS = [
    { type: 104, id: 1, props: { 39: val(9, { id: 319, nom: "En fonction" }), 1387: val(1, "Prénom1"), 1386: val(1, "Nom1"),
        2928: val(10, [{ id: 501, nom: "INFRA" }]), 2823: val(1, "POISON") } },
    { type: 104, id: 2, props: { 39: val(9, { id: 319, nom: "En fonction" }), 1387: val(1, "Prénom2"), 1386: val(1, "Nom2"),
        2928: val(10, [{ id: 501, nom: "INFRA" }]), 1217: val(9, { id: 1, nom: "x" }) } },
    { type: 362, id: 500, titre: "tebicom SA", props: { 2926: val(10, [{ id: 501, nom: "INFRA" }]) } },
    { type: 362, id: 501, titre: "INFRA", props: {} },
    { type: 0, id: 900, titre: "Photo", props: { 100: val(9, { id: 88, nom: "!! Photo collaborateur" }),
        1077: val(9, { id: 1, nom: "x" }) }, fichiers: [{ id: 30, version: 1, extension: "jpg", taille: 1000 }] }
];

/**
 * TypedValue en lecture.
 *
 * @param {object} p valeur simulée
 * @returns {object} TypedValue
 */
function typedValue(p) {
    var nul = p.v === null || p.v === undefined || (p.type === 10 && !p.v.length);
    return {
        DataType: p.type,
        IsNULL: function () { return nul; },
        DisplayValue: nul ? "" : (p.type === 9 ? p.v.nom : String(p.v)),
        GetValueAsLookup: function () { return { Item: p.v.id, DisplayValue: p.v.nom, Deleted: false }; },
        GetValueAsLookups: function () {
            var l = [];
            var i;
            for (i = 0; i < p.v.length; i += 1) {
                l.push({ Item: p.v[i].id, DisplayValue: p.v[i].nom, Deleted: false });
            }
            return collection(l);
        }
    };
}

/**
 * PropertyValues d'un objet.
 *
 * @param {object} o objet simulé
 * @returns {object} PropertyValues
 */
function proprietes(o) {
    return {
        IndexOf: function (id) { return o.props.hasOwnProperty(id) ? 1 : -1; },
        SearchForProperty: function (id) { return { PropertyDef: id, TypedValue: typedValue(o.props[id]) }; }
    };
}

/**
 * Objet simulé d'après un ObjVer.
 *
 * @param {object} ov ObjVer
 * @returns {object} objet
 */
function objetDe(ov) {
    var i;
    for (i = 0; i < OBJETS.length; i += 1) {
        if (OBJETS[i].type === ov.Type && OBJETS[i].id === ov.ID) {
            return OBJETS[i];
        }
    }
    return null;
}

/**
 * Vrai si un objet satisfait une condition.
 *
 * @param {object} o objet simulé
 * @param {object} c condition
 * @returns {boolean} satisfaite
 */
function satisfait(o, c) {
    var p;
    var i;
    if (c.Expression.genre === "statut") {
        return c.Expression.cible === 6 ? o.type === c.TypedValue.Value : c.TypedValue.Value === false;
    }
    p = o.props[c.Expression.cible];
    if (!p) {
        return false;
    }
    if (p.type === 10) {
        for (i = 0; i < p.v.length; i += 1) {
            if (p.v[i].id === c.TypedValue.Value) {
                return true;
            }
        }
        return false;
    }
    return p.type === 9 && p.v.id === c.TypedValue.Value;
}

var MFiles = {
    SearchConditions: function () { return collection([]); },
    ObjVers: function () { return collection([]); },
    ObjOrFileVers: function () { return collection([]); },
    ObjOrFileVer: function () { this.ObjVer = null; },
    SearchCondition: function () {
        var c = this;
        c.ConditionType = 0;
        c.Expression = {
            SetStatusValueExpression: function (s) { c.Expression.genre = "statut"; c.Expression.cible = s; },
            SetPropertyValueExpression: function (p) { c.Expression.genre = "propriete"; c.Expression.cible = p; }
        };
        c.TypedValue = { SetValue: function (dt, v) { c.TypedValue.Value = v; } };
    }
};

/**
 * Coffre simulé pour une session.
 *
 * @param {boolean} membre vrai si l'utilisateur est du groupe 3524
 * @returns {object} vault
 */
function coffreSimule(membre) {
    return {
        SessionInfo: { UserAndGroupMemberships: { GetUserOrUserGroupIDIndex: function (id, type) {
            return membre && id === 3524 && type === 2 ? 2 : -1;
        } } },
        ObjectSearchOperations: { SearchForObjectsByConditionsEx: function (conditions) {
            var trouves = [];
            var i;
            var j;
            var ok;
            for (i = 0; i < OBJETS.length; i += 1) {
                ok = true;
                for (j = 1; j <= conditions.Count; j += 1) {
                    ok = ok && satisfait(OBJETS[i], conditions.Item(j));
                }
                if (ok) {
                    trouves.push({ ObjVer: { Type: OBJETS[i].type, ID: OBJETS[i].id, Version: 1 }, Title: OBJETS[i].titre });
                }
            }
            var res = collection(trouves);
            res.MoreResults = false;
            return res;
        } },
        ObjectPropertyOperations: { GetPropertiesOfMultipleObjects: function (ovs) {
            var l = [];
            var i;
            for (i = 1; i <= ovs.Count; i += 1) {
                l.push(proprietes(objetDe(ovs.Item(i))));
            }
            return collection(l);
        } },
        ObjectFileOperations: {
            GetFiles: function (ov) {
                var o = objetDe(ov);
                var l = [];
                var i;
                for (i = 0; i < o.fichiers.length; i += 1) {
                    l.push({ ID: o.fichiers[i].id, Version: o.fichiers[i].version, Extension: o.fichiers[i].extension,
                        LogicalSize_32bit: o.fichiers[i].taille });
                }
                return collection(l);
            },
            DownloadFileAsDataURI: function () { return "data:image/jpeg;base64,QUJD"; }
        }
    };
}

/**
 * Cadre simulé.
 *
 * @returns {object} cadre, avec son journal (j)
 */
function cadreSimule() {
    var j = { onglets: [], commandes: 0, selection: null };
    return {
        j: j,
        Events: { Register: function (e, cb) { if (e === Event_Started) { cb(); } } },
        Commands: { CreateCustomCommand: function () { j.commandes += 1; return 100; },
            SetIconFromPath: function () {}, Events: { Register: function () {} } },
        TaskPane: { AddCustomCommandToGroup: function () {} },
        Listing: { Events: { Register: function (e, cb) { if (e === Event_SelectionChanged) { j.selection = cb; } } } },
        RightPane: { AddTab: function (id, titre, position) {
            var o = { titre: titre, position: position, Visible: false, donnees: null, selections: 0,
                ShowDashboard: function (t, d) { o.donnees = d; }, Select: function () { o.selections += 1; } };
            j.onglets.push(o);
            return o;
        } }
    };
}

/**
 * Lance OnNewShellUI sur un cadre.
 *
 * @param {boolean} membre appartenance au groupe
 * @returns {object} cadre simulé
 */
function demarrer(membre) {
    var f = cadreSimule();
    OnNewShellUI({ Vault: coffreSimule(membre), Events: { Register: function (e, cb) { cb(f); } } });
    return f;
}

// ---- Exécution --------------------------------------------------------

var erreurs = [];
var k;

/**
 * Vérification.
 *
 * @param {boolean} condition à tenir
 * @param {string} message en cas d'échec
 * @returns {void}
 */
function verifier(condition, message) {
    if (!condition) {
        erreurs.push(message);
    }
}

try {
    // eval au niveau global : les déclarations des fichiers deviennent globales, comme dans le module
    for (k = 0; k < FICHIERS.length; k += 1) {
        // eslint-disable-next-line security/detect-eval-with-expression -- sources du dépôt, chemins fixes
        eval(lire(RACINE + "\\" + FICHIERS[k].replace(/\//g, "\\")));
    }
    verifier(typeof [].forEach === "function", "compat.js n'a pas ajouté forEach");

    var membre = demarrer(true);
    verifier(membre.j.commandes === 1, "membre : commande non créée");
    membre.j.selection({ ObjectVersions: collection([{ ObjVer: { Type: 104, ID: 1, Version: 1 } }]) });
    var o = membre.j.onglets[0];
    verifier(Boolean(o), "membre : onglet non créé (" + console.lignes.join(" | ") + ")");
    if (o) {
        // eslint-disable-next-line security/detect-eval-with-expression -- WSH n'a pas JSON ; texte produit par le module
        var d = eval("(" + o.donnees.donnees + ")");
        verifier(o.Visible === true && o.selections === 1 && o.position === "_last", "membre : onglet ni visible ni actif");
        verifier(d.fiche.personne.nomComplet === "Prénom1 Nom1", "membre : fiche inattendue " + o.donnees.donnees.slice(0, 120));
        verifier(d.fiche.equipe.length === 1 && d.fiche.equipe[0].id === 2, "membre : équipe inattendue");
        verifier(d.photo.dataUri === "data:image/jpeg;base64,QUJD", "membre : photo absente");
        verifier(o.donnees.donnees.indexOf("POISON") < 0, "membre : donnée hors liste blanche");
    }

    var autre = demarrer(false);
    verifier(autre.j.commandes === 0, "non-membre : commande créée");
    verifier(autre.j.selection === null && autre.j.onglets.length === 0, "non-membre : sélection suivie");
} catch (e) {
    erreurs.push("exception : " + (e.message || e.description || e));
}

WScript.Echo(erreurs.length ? "ECHEC : " + erreurs.join(" ; ") : "OK moteur " + ScriptEngine() + " " +
    ScriptEngineMajorVersion() + "." + ScriptEngineMinorVersion() + "." + ScriptEngineBuildVersion());
WScript.Quit(erreurs.length ? 1 : 0);
