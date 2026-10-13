/**
 * Portraits (src/model/portraits.js et vault-com.js) : documents de la
 * classe « !! Photo collaborateur » liés au collaborateur, du plus récent
 * au plus ancien, formats affichables dans IE11, taille plafonnée, lecture
 * en mémoire par DownloadFileAsDataURI, cache par version. Données fictives.
 */
const test = require("node:test");
const assert = require("node:assert");
const { charger, simple } = require("./charger");
const { creerCoffreCom, valeur } = require("./coffre-com-simule");

const MO = 1024 * 1024;

/**
 * Document de portrait fictif lié au collaborateur 12.
 *
 * @param {number} id ID du document (plus grand = plus récent)
 * @param {Array} fichiers [{ id, version, extension, taille }]
 * @param {object} [plus] champs du document simulé
 * @returns {object} objet simulé
 */
function photo(id, fichiers, plus) {
    return Object.assign({
        type: 0, id, titre: "Photo " + id, version: 3,
        props: { 100: valeur.lookup(88, "!! Photo collaborateur"), 1077: valeur.lookup(12, "Collaborateur 12") },
        fichiers
    }, plus || {});
}

/**
 * Contexte chargé sur un coffre de documents fictifs.
 *
 * @param {Array} objets documents
 * @returns {object} { c, ctx }
 */
function preparer(objets) {
    const c = creerCoffreCom({ objets });
    const ctx = charger(["model/parametrage.js", "model/vault-com.js", "model/portraits.js"], { MFiles: c.MFiles });
    return { c, ctx };
}

/**
 * Portrait d'un collaborateur, cache fourni ou neuf.
 *
 * @param {object} ctx contexte chargé
 * @param {object} c coffre simulé
 * @param {object} [cache] cache du cadre
 * @returns {object} { dataUri, note }
 */
function portrait(ctx, c, cache) {
    return ctx.portraits.portraitDe(c.vault, 12, cache || {});
}

test("recherche : documents de la classe 88 liés au collaborateur, non supprimés, le plus récent d'abord", () => {
    const { c, ctx } = preparer([
        photo(5, [{ id: 1, version: 1, extension: "jpg", taille: 1000 }]),
        photo(9, [{ id: 2, version: 1, extension: "png", taille: 1000 }]),
        photo(7, [], { props: { 100: valeur.lookup(88, "x"), 1077: valeur.lookup(13, "Autre") } }),
        photo(8, [], { props: { 100: valeur.lookup(1, "Autre classe"), 1077: valeur.lookup(12, "x") } }),
        photo(6, [], { supprime: true })
    ]);
    const docs = ctx.coffre.chercherPortraits(c.vault, 12);

    assert.deepStrictEqual(simple(docs.map((d) => d.id)), [9, 5]);
    assert.deepStrictEqual(c.journal.conditions[0].map((x) => [x.Expression.genre, x.Expression.cible, x.TypedValue.Value]),
        [["statut", 6, 0], ["propriete", 100, 88], ["propriete", 1077, 12], ["statut", 5, false]]);
    assert.strictEqual(docs[0].fichiers[0].extension, "png");
});

test("photo : le document le plus récent en JPEG donne une image data:, sans fichier sur disque", () => {
    const { c, ctx } = preparer([photo(9, [{ id: 2, version: 4, extension: "JPG", taille: 200000 }])]);
    const r = portrait(ctx, c);

    assert.strictEqual(r.dataUri, "data:image/jpeg;base64,QUJD");
    assert.strictEqual(r.note, null);
    assert.deepStrictEqual(c.journal.appels.filter((a) => /^Download/.test(a)), ["DownloadFileAsDataURI:9-2-4"]);
});

test("photo : un PDF (ou JPEG 2000, WebP…) n'est pas affichable : avatar, avec une note courte", () => {
    const { c, ctx } = preparer([photo(9, [{ id: 2, version: 1, extension: "pdf", taille: 300000 }])]);
    const r = portrait(ctx, c);

    assert.strictEqual(r.dataUri, null);
    assert.strictEqual(r.note, "Portrait non affiché : format PDF non pris en charge.");
    assert.strictEqual(c.journal.appels.filter((a) => /^Download/.test(a)).length, 0, "rien n'est téléchargé");
});

test("photo : aucun plafond de taille, une photo de 9 Mo s'affiche", () => {
    const { c, ctx } = preparer([photo(9, [{ id: 2, version: 1, extension: "jpg", taille: 9 * MO }])]);
    const r = portrait(ctx, c);

    assert.strictEqual(r.dataUri, "data:image/jpeg;base64,QUJD");
    assert.strictEqual(r.note, null);
});

test("photo : le document le plus récent en PDF, un plus ancien en PNG : le PNG s'affiche, sans note", () => {
    const { c, ctx } = preparer([
        photo(9, [{ id: 2, version: 1, extension: "pdf", taille: 300000 }]),
        photo(5, [{ id: 1, version: 1, extension: "png", taille: 80000 }])
    ]);
    const r = portrait(ctx, c);

    assert.strictEqual(r.dataUri, "data:image/png;base64,QUJD");
    assert.strictEqual(r.note, null);
    assert.deepStrictEqual(c.journal.appels.filter((a) => /^Download/.test(a)), ["DownloadFileAsDataURI:5-1-1"]);
});

test("photo : plusieurs formats non pris en charge sont nommés une fois chacun", () => {
    const { c, ctx } = preparer([
        photo(9, [{ id: 2, version: 1, extension: "pdf", taille: 1 }]),
        photo(8, [{ id: 3, version: 1, extension: "msg", taille: 1 }]),
        photo(7, [{ id: 4, version: 1, extension: "pdf", taille: 1 }])
    ]);

    assert.strictEqual(portrait(ctx, c).note, "Portrait non affiché : formats PDF et MSG non pris en charge.");
});

test("photo : aucun document, avatar sans note", () => {
    const { c, ctx } = preparer([]);
    const r = portrait(ctx, c);

    assert.strictEqual(r.dataUri, null);
    assert.strictEqual(r.note, null);
});

test("photo : un téléchargement refusé ou un type inattendu est écarté, jamais propagé", () => {
    const refus = preparer([photo(9, [{ id: 2, version: 1, extension: "jpg", taille: 1000 }], { echecTelechargement: true })]);
    const html = preparer([photo(9, [{ id: 2, version: 1, extension: "jpg", taille: 1000 }], { mimeForce: "text/html" })]);

    assert.strictEqual(portrait(refus.ctx, refus.c).dataUri, null);
    assert.strictEqual(portrait(refus.ctx, refus.c).note, null, "une panne n'est pas un format : pas de note");
    assert.strictEqual(portrait(html.ctx, html.c).dataUri, null);
});

test("cache : même document, même version, pas de second téléchargement ; nouvelle version relue", () => {
    const objets = [photo(9, [{ id: 2, version: 1, extension: "jpg", taille: 1000 }])];
    const { c, ctx } = preparer(objets);
    const cache = {};

    portrait(ctx, c, cache);
    portrait(ctx, c, cache);
    assert.strictEqual(c.journal.appels.filter((a) => /^Download/.test(a)).length, 1);
    objets[0].version = 4;
    objets[0].fichiers[0].version = 2;
    portrait(ctx, c, cache);
    assert.deepStrictEqual(c.journal.appels.filter((a) => /^Download/.test(a)),
        ["DownloadFileAsDataURI:9-2-1", "DownloadFileAsDataURI:9-2-2"]);
});

test("photo : la recherche elle-même en échec donne l'avatar, jamais une exception", () => {
    const { c, ctx } = preparer([]);
    c.vault.ObjectSearchOperations.SearchForObjectsByConditionsEx = () => { throw new Error("coffre indisponible"); };

    assert.strictEqual(portrait(ctx, c).dataUri, null);
});

test("disponibilité : vrai s'il existe un fichier JPEG, PNG, GIF ou BMP, sans rien télécharger", () => {
    const avec = preparer([photo(9, [{ id: 2, version: 1, extension: "pdf", taille: 1 }]),
        photo(5, [{ id: 1, version: 1, extension: "PNG", taille: 1 }])]);
    const sans = preparer([photo(9, [{ id: 2, version: 1, extension: "pdf", taille: 1 }])]);

    assert.strictEqual(avec.ctx.portraits.photoDisponible(avec.c.vault, 12), true);
    assert.strictEqual(sans.ctx.portraits.photoDisponible(sans.c.vault, 12), false);
    assert.strictEqual(avec.c.journal.appels.filter((a) => /^Download/.test(a)).length, 0);
});
