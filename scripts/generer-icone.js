/**
 * Génère src/icones/app.ico : 32 × 32 px, 32 bits, une grille de quatre
 * visages blancs sur un carré arrondi au bleu tebicom (#004f9f). Outil de
 * développement, lancé à la main (node scripts/generer-icone.js) ; l'icône
 * produite est versionnée et déclarée dans appdef.xml (<files>).
 */
const fs = require("fs");
const path = require("path");

const TAILLE = 32;
const BLEU = [0x00, 0x4f, 0x9f];
const CLAIR = [0xc0, 0xe3, 0xf9];
const BLANC = [0xff, 0xff, 0xff];

/**
 * Couleur RGBA d'un pixel (origine en haut à gauche).
 *
 * @param {number} x colonne
 * @param {number} y ligne
 * @returns {Array<number>} [r, g, b, a]
 */
function pixel(x, y) {
    const r = 6;
    // Coins arrondis : hors du quart de cercle, transparent
    const cx = x < r ? r : x > TAILLE - 1 - r ? TAILLE - 1 - r : x;
    const cy = y < r ? r : y > TAILLE - 1 - r ? TAILLE - 1 - r : y;
    if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) {
        return [0, 0, 0, 0];
    }
    // Quatre visages : tête (cercle) et épaules (demi-disque) par quadrant
    const qx = x < 16 ? 9 : 23;
    const qy = y < 16 ? 9 : 23;
    if ((x - qx) ** 2 + (y - (qy - 2)) ** 2 <= 9) {
        return BLANC.concat(255);
    }
    if (y >= qy + 2 && y <= qy + 5 && (x - qx) ** 2 + (y - (qy + 6)) ** 2 <= 25) {
        return CLAIR.concat(255);
    }
    return BLEU.concat(255);
}

/**
 * Fichier ICO à une image BMP 32 bits (de bas en haut, BGRA, masque AND).
 *
 * @returns {Buffer} contenu du fichier
 */
function ico() {
    const pixels = Buffer.alloc(TAILLE * TAILLE * 4);
    for (let y = 0; y < TAILLE; y += 1) {
        for (let x = 0; x < TAILLE; x += 1) {
            const [r, g, b, a] = pixel(x, y);
            const i = ((TAILLE - 1 - y) * TAILLE + x) * 4;
            pixels[i] = b; pixels[i + 1] = g; pixels[i + 2] = r; pixels[i + 3] = a;
        }
    }
    const masque = Buffer.alloc(TAILLE * 4);           // 32 lignes de 4 octets : tout opaque, l'alpha décide
    const entete = Buffer.alloc(40);
    entete.writeUInt32LE(40, 0);
    entete.writeInt32LE(TAILLE, 4);
    entete.writeInt32LE(TAILLE * 2, 8);                 // hauteur doublée (image + masque)
    entete.writeUInt16LE(1, 12);
    entete.writeUInt16LE(32, 14);
    entete.writeUInt32LE(pixels.length + masque.length, 20);
    const image = Buffer.concat([entete, pixels, masque]);

    const repertoire = Buffer.alloc(6 + 16);
    repertoire.writeUInt16LE(1, 2);                     // type icône
    repertoire.writeUInt16LE(1, 4);                     // une image
    repertoire.writeUInt8(TAILLE, 6);
    repertoire.writeUInt8(TAILLE, 7);
    repertoire.writeUInt16LE(1, 10);
    repertoire.writeUInt16LE(32, 12);
    repertoire.writeUInt32LE(image.length, 14);
    repertoire.writeUInt32LE(22, 18);
    return Buffer.concat([repertoire, image]);
}

const cible = path.join(__dirname, "..", "src", "icones", "app.ico");
fs.mkdirSync(path.dirname(cible), { recursive: true });
fs.writeFileSync(cible, ico());
console.log("icône écrite : " + path.relative(path.join(__dirname, ".."), cible));
