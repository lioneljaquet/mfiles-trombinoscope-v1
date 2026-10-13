/* exported regles */
/* =====================================================================
   RÈGLES DU TROMBINOSCOPE — couche model, pure (ES5)

   Des fiches Collaborateur et des objets Cercle/rôle déjà réduits à la
   liste blanche (vault-com.js), ce module construit l'annuaire que la
   page affiche, puis filtre, cherche et trie.

   Population limitée comme l'export autonome du Cockpit (ADR 0013 du
   Cockpit, docs/adr/0005) : seules les personnes rattachées à un cercle
   de l'organisation ; l'étape de workflow ne sert qu'à l'inclusion et
   n'apparaît nulle part (ni clé, ni filtre, ni tri) ; un responsable
   exclu est remplacé par le premier responsable retenu au-dessus. Aucun DOM, aucun accès au
   coffre : tout ce qui se teste sans M-Files est ici. Règles reprises du
   Cockpit PRO (model/directory.py, model/organization.py,
   model/titles.py, trombinoscope/model/directory.js).

   ES5 strict : le contrôle web du client classique est IE11. Pas de
   String.prototype.normalize : le repli des accents passe par une table.
   ===================================================================== */

var regles = (function () {
    "use strict";

    // Fiche modèle de M-Files : un collaborateur « actif » qui n'est pas une personne
    var INITIALES_MODELE = "ZZZ";
    var PREFIXE_MODELE = "_";
    // Particules d'un nom de famille : elles ne donnent pas la lettre du monogramme
    var PARTICULES = ["de", "du", "des", "van", "von", "der", "den", "da", "das", "di", "dos", "del",
        "della", "le", "la", "el", "al", "ten", "ter", "zu"];
    // Écart de teinte entre deux ID : l'angle d'or répartit les couleurs sans cycle visible
    var PAS_TEINTE = 137.508;
    // Adresse simple : rien qui plie un lien mailto: (? & % # /) ni qui en cumule plusieurs (; , espace).
    // Les segments du domaine sont séparés par des points obligatoires : pas de retour arrière
    // exponentiel ; la longueur est de plus bornée avant le test (LONGUEUR_EMAIL).
    var LONGUEUR_EMAIL = 254;
    // eslint-disable-next-line security/detect-unsafe-regex
    var MOTIF_EMAIL = /^[A-Za-z0-9._+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
    // Trois lettres exactement (latin étendu, sans × ni ÷)
    var MOTIF_TRIGRAMME = /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F]{3}$/;
    // Une lettre, pour la casse des noms (mêmes plages)
    var MOTIF_LETTRE = /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F]/;

    // Repli des accents : chaque lettre accentuée vers sa base, en minuscules
    var TABLE_REPLI = construireTableRepli({
        a: "àáâãäåāăą", c: "çćĉċč", d: "ďđ", e: "èéêëēĕėęě", g: "ĝğġģ", h: "ĥħ",
        i: "ìíîïĩīĭįı", j: "ĵ", k: "ķ", l: "ĺļľŀł", n: "ñńņňŉ", o: "òóôõöøōŏő",
        r: "ŕŗř", s: "śŝşš", t: "ţťŧ", u: "ùúûüũūŭůűų", w: "ŵ", y: "ýÿŷ", z: "źżž",
        ae: "æ", oe: "œ", ss: "ß"
    });

    /**
     * Construit la table de repli lettre accentuée → base.
     *
     * @param {object} groupes base → lettres accentuées qui s'y replient
     * @returns {object} lettre accentuée → base
     */
    function construireTableRepli(groupes) {
        var table = {};
        var base;
        var i;

        for (base in groupes) {
            if (groupes.hasOwnProperty(base)) {
                for (i = 0; i < groupes[base].length; i += 1) {
                    table[groupes[base].charAt(i)] = base;
                }
            }
        }
        return table;
    }

    /**
     * Texte sans accents ni capitales, pour trier et chercher.
     *
     * @param {string|null} texte texte quelconque
     * @returns {string} le texte replié ("" pour null)
     */
    function plier(texte) {
        return String(texte === null || texte === undefined ? "" : texte).toLowerCase()
            .replace(/[^\u0000-\u007f]/g, function (lettre) {
                return TABLE_REPLI.hasOwnProperty(lettre) ? TABLE_REPLI[lettre] : lettre;
            });
    }

    /**
     * Texte sans blancs de bord, ou null s'il est vide.
     *
     * @param {*} texte valeur lue
     * @returns {string|null} texte nettoyé
     */
    function nettoyer(texte) {
        var t = String(texte === null || texte === undefined ? "" : texte).replace(/^\s+|\s+$/g, "");
        return t ? t : null;
    }

    /**
     * Vrai si un tableau contient une valeur.
     *
     * @param {Array} tableau tableau
     * @param {*} valeur valeur cherchée
     * @returns {boolean} présence
     */
    function contient(tableau, valeur) {
        return tableau.indexOf(valeur) >= 0;
    }

    /**
     * Nom saisi en capitales ramené à la casse normale ; une casse mixte
     * reste telle quelle (« MARTIN-DUPRÉ » → « Martin-Dupré », « van
     * Delta » inchangé).
     *
     * @param {string|null} texte prénom ou nom
     * @returns {string} texte à afficher
     */
    function casseAffichage(texte) {
        var t = nettoyer(texte) || "";
        var debutMot = true;
        var sortie = "";
        var i;
        var c;

        if (t.length < 2 || t !== t.toUpperCase() || t === t.toLowerCase()) {
            return t;
        }

        // Majuscule en début de mot, minuscule ailleurs (comme str.title)
        for (i = 0; i < t.length; i += 1) {
            c = t.charAt(i);
            sortie += debutMot ? c.toUpperCase() : c.toLowerCase();
            debutMot = !MOTIF_LETTRE.test(c);
        }
        return sortie;
    }

    /**
     * Lettres de l'avatar de repli : initiale du prénom et du nom, sans
     * les particules (« van Delta » : D).
     *
     * @param {string} prenom prénom affiché
     * @param {string} nom nom affiché
     * @returns {string} une ou deux lettres majuscules
     */
    function monogramme(prenom, nom) {
        var mots = nom.split(/\s+/).filter(function (m) { return m; });
        var significatifs = mots.filter(function (m) { return !contient(PARTICULES, m.toLowerCase()); });

        // Un nom réduit à une particule reste utilisable
        if (!significatifs.length) {
            significatifs = mots;
        }
        return (prenom.charAt(0) + (significatifs.length ? significatifs[0].charAt(0) : "")).toUpperCase();
    }

    /**
     * Lettres de l'avatar : le trigramme de M-Files (« Initiales ») s'il
     * a trois lettres exactement, sinon le monogramme calculé.
     *
     * @param {object} personne personne de l'annuaire
     * @returns {string} lettres à afficher
     */
    function trigrammeDe(personne) {
        return MOTIF_TRIGRAMME.test(personne.initiales || "") ? personne.initiales : personne.monogramme;
    }

    /**
     * Titre : « Titre (manuel) », à défaut « Titre », à défaut « /Titre ».
     *
     * @param {string|null} manuel titre manuel
     * @param {string|null} titre titre
     * @param {string|null} fonctionPrincipale /Titre
     * @returns {string|null} premier texte non vide
     */
    function titreAffiche(manuel, titre, fonctionPrincipale) {
        return nettoyer(manuel) || nettoyer(titre) || nettoyer(fonctionPrincipale);
    }

    /**
     * Adresse e-mail de forme sûre, ou null.
     *
     * @param {string|null} texte champ « Email prof. » (texte libre)
     * @returns {string|null} adresse
     */
    function emailValide(texte) {
        var adresse = nettoyer(texte);
        return adresse && adresse.length <= LONGUEUR_EMAIL && MOTIF_EMAIL.test(adresse) ? adresse : null;
    }

    /**
     * Étape listée d'une fiche, d'après son ID.
     *
     * @param {object|null} etape { id, nom } lue sur la fiche
     * @returns {object|null} étape du paramétrage, ou null si non listée
     */
    function etapeListee(etape) {
        var trouvee = null;

        if (!etape) {
            return null;
        }
        PARAMETRAGE.etapes.forEach(function (e) {
            if (e.id === etape.id) {
                trouvee = e;
            }
        });
        return trouvee;
    }

    /**
     * Vrai si la fiche est celle d'une personne à une étape listée : ni
     * la fiche modèle, ni une fiche sans nom.
     *
     * @param {object} fiche fiche brute
     * @returns {boolean} figure dans l'annuaire
     */
    function estListee(fiche) {
        var prenom = nettoyer(fiche.prenom) || "";
        var nom = nettoyer(fiche.nom) || "";

        if (!etapeListee(fiche.etape) || !(prenom || nom)) {
            return false;
        }
        return prenom.charAt(0) !== PREFIXE_MODELE && fiche.initiales !== INITIALES_MODELE;
    }

    /**
     * Valeurs nettoyées, sans vide ni doublon, dans l'ordre reçu.
     *
     * @param {Array} valeurs textes
     * @returns {Array} textes retenus
     */
    function sansDoublon(valeurs) {
        var sortie = [];

        (valeurs || []).forEach(function (v) {
            var t = nettoyer(v);
            if (t && !contient(sortie, t)) {
                sortie.push(t);
            }
        });
        return sortie;
    }

    /**
     * Entrée d'un collaborateur dans l'annuaire.
     *
     * @param {object} fiche fiche brute (liste blanche)
     * @returns {object} personne affichée par la page
     */
    function personneDe(fiche) {
        var prenom = casseAffichage(fiche.prenom);
        var nom = casseAffichage(fiche.nom);
        var fonctionPrincipale = nettoyer(fiche.fonctionPrincipale);
        var cercle = fiche.cercle && nettoyer(fiche.cercle.nom) ? fiche.cercle : null;

        return {
            id: fiche.id,
            prenom: prenom,
            nom: nom,
            nomComplet: nettoyer(prenom + " " + nom) || "",
            initiales: nettoyer(fiche.initiales),
            monogramme: monogramme(prenom, nom),
            teinte: Math.round(fiche.id * PAS_TEINTE) % 360,
            titre: titreAffiche(fiche.titreManuel, fiche.titre, fonctionPrincipale),
            fonctionPrincipale: fonctionPrincipale,
            fonctions: sansDoublon(fiche.fonctions),
            succursale: nettoyer(fiche.succursale),
            cercle: cercle ? nettoyer(cercle.nom) : null,
            cercleId: cercle ? cercle.id : null,
            email: emailValide(fiche.email),
            responsableDemande: fiche.responsableId,
            cerclesAuto: fiche.cerclesAuto || []
        };
    }

    /**
     * Compare deux textes sans égard aux accents ; une valeur absente
     * passe après toute valeur.
     *
     * @param {string|null} a premier texte
     * @param {string|null} b second texte
     * @returns {number} négatif, nul ou positif
     */
    function comparerTextes(a, b) {
        var pa;
        var pb;

        if (!a || !b) {
            return (a ? 0 : 1) - (b ? 0 : 1);
        }
        pa = plier(a);
        pb = plier(b);
        if (pa === pb) {
            return 0;
        }
        return pa < pb ? -1 : 1;
    }

    /**
     * Ordre par nom de famille puis prénom.
     *
     * @param {object} a personne
     * @param {object} b personne
     * @returns {number} négatif, nul ou positif
     */
    function parNom(a, b) {
        return comparerTextes(a.nom, b.nom) || comparerTextes(a.prenom, b.prenom) || a.id - b.id;
    }

    /**
     * ID de `depart` et de tout ce qu'on atteint en descendant depuis lui.
     *
     * @param {number} depart ID de départ
     * @param {object} enfants contenu de chaque objet, par ID
     * @returns {object} ID atteints (clés), chacun visité une fois
     */
    function atteints(depart, enfants) {
        var vus = {};
        var aVoir = [depart];
        var courant;

        while (aVoir.length) {
            courant = aVoir.pop();
            if (!vus.hasOwnProperty(courant)) {
                vus[courant] = true;
                aVoir.push.apply(aVoir, enfants[courant] || []);
            }
        }
        return vus;
    }

    /**
     * Nombre de clés d'un objet.
     *
     * @param {object} objet objet
     * @returns {number} nombre de clés propres
     */
    function taille(objet) {
        var n = 0;
        var cle;

        for (cle in objet) {
            if (objet.hasOwnProperty(cle)) {
                n += 1;
            }
        }
        return n;
    }

    /**
     * Organisation : l'arbre sous le cercle « tebicom SA ». Un objet qu'on
     * atteint en descendant depuis lui est dans l'organisation ; un cercle
     * de l'organisation contient d'autres objets, ou se tient directement
     * sous l'ancre ; les feuilles sont des rôles. Les cercles racines
     * (« CA ») se placent sous l'ancre s'ils n'y sont pas déjà.
     *
     * @param {Array} cercles objets Cercle/rôle { id, nom, enfants }
     * @returns {object} { noms, dansOrganisation, estCercle }, par ID
     */
    function construireOrganisation(cercles) {
        var connus = {};
        var enfants = {};
        var noms = {};
        var ancre = null;
        var meilleur = -1;
        var dedans = {};
        var estCercle = {};
        var premierNiveau;

        cercles.forEach(function (c) {
            connus[c.id] = true;
        });
        cercles.forEach(function (c) {
            noms[c.id] = nettoyer(c.nom) || "";
            enfants[c.id] = [];
            (c.enfants || []).forEach(function (e) {
                if (connus[e] && e !== c.id && !contient(enfants[c.id], e)) {
                    enfants[c.id].push(e);
                }
            });
        });

        // Ancre : le cercle de ce nom qui contient le plus ; à égalité, le plus petit ID
        cercles.forEach(function (c) {
            var n;
            if (noms[c.id] === PARAMETRAGE.ancre) {
                n = taille(atteints(c.id, enfants));
                if (n > meilleur || (n === meilleur && c.id < ancre)) {
                    ancre = c.id;
                    meilleur = n;
                }
            }
        });

        if (ancre !== null) {
            dedans = atteints(ancre, enfants);
            cercles.forEach(function (c) {
                if (contient(PARAMETRAGE.cerclesRacines, noms[c.id]) && !dedans[c.id]) {
                    enfants[ancre].push(c.id);
                    dedans = atteints(ancre, enfants);
                }
            });
        }

        premierNiveau = ancre !== null ? enfants[ancre] : [];
        cercles.forEach(function (c) {
            estCercle[c.id] = Boolean(dedans[c.id]) && c.id !== ancre &&
                (enfants[c.id].length > 0 || contient(premierNiveau, c.id));
        });
        return { noms: noms, dansOrganisation: dedans, estCercle: estCercle };
    }

    /**
     * Pose sur chaque personne ses cercles de l'organisation (ce que
     * propose le filtre) et tous ses cercles et rôles (ce que montre la
     * fiche) : ~Cercles/rôles auto plus le cercle principal.
     *
     * @param {Array} personnes personnes de l'annuaire (modifiées)
     * @param {object} org organisation (voir construireOrganisation)
     * @returns {void}
     */
    function poserCercles(personnes, org) {
        personnes.forEach(function (p) {
            var vus = {};
            var tous = [];
            var objets = p.cerclesAuto.slice();

            if (p.cercleId !== null) {
                objets.push({ id: p.cercleId, nom: p.cercle });
            }
            objets.forEach(function (o) {
                if (o && o.id !== null && o.id !== undefined && !vus[o.id]) {
                    vus[o.id] = true;
                    tous.push({
                        id: o.id,
                        nom: org.noms[o.id] || nettoyer(o.nom) || "",
                        estCercle: Boolean(org.estCercle[o.id]),
                        horsOrganisation: !org.dansOrganisation[o.id]
                    });
                }
            });
            tous.sort(function (a, b) {
                return comparerTextes(a.nom, b.nom) || a.id - b.id;
            });

            p.cerclesEtRoles = tous;
            p.cercles = tous.filter(function (o) { return o.estCercle; })
                .map(function (o) { return { id: o.id, nom: o.nom }; });
            delete p.cerclesAuto;
        });
    }

    /**
     * Vrai si, en remontant les responsables depuis `depart`, on
     * rencontre `cible`.
     *
     * @param {object} responsableDe responsable retenu, par ID
     * @param {number} depart ID de départ
     * @param {number} cible ID cherché
     * @returns {boolean} présence dans la chaîne
     */
    function mene(responsableDe, depart, cible) {
        var vus = {};
        var courant = depart;

        while (courant !== undefined && courant !== null && !vus[courant]) {
            if (courant === cible) {
                return true;
            }
            vus[courant] = true;
            courant = responsableDe[courant];
        }
        return false;
    }

    /**
     * Relie chaque personne à son responsable : responsableId, equipe
     * (directe, par nom) et tailleEquipe (tous niveaux). Un responsable
     * absent de l'annuaire est ignoré ; une boucle est cassée au dernier
     * lien rencontré dans l'ordre des ID.
     *
     * @param {Array} personnes personnes triées par nom (modifiées)
     * @param {object} parId personnes par ID
     * @returns {void}
     */
    function lierHierarchie(personnes, parId) {
        var responsableDe = {};
        var tailles = {};
        var ids = personnes.map(function (p) { return p.id; }).sort(function (a, b) { return a - b; });

        ids.forEach(function (id) {
            var r = parId[id].responsableDemande;
            if (r !== null && r !== undefined && parId.hasOwnProperty(r) && r !== id && !mene(responsableDe, r, id)) {
                responsableDe[id] = r;
            }
        });

        personnes.forEach(function (p) {
            p.responsableId = responsableDe.hasOwnProperty(p.id) ? responsableDe[p.id] : null;
            p.equipe = [];
            delete p.responsableDemande;
        });
        // Les personnes sont triées par nom : les équipes directes aussi
        personnes.forEach(function (p) {
            if (p.responsableId !== null) {
                parId[p.responsableId].equipe.push(p.id);
            }
        });

        /**
         * Taille de toute l'équipe d'une personne, mémorisée.
         *
         * @param {number} id personne
         * @returns {number} effectif sous elle, tous niveaux
         */
        function tailleDe(id) {
            if (!tailles.hasOwnProperty(id)) {
                tailles[id] = 0;
                parId[id].equipe.forEach(function (membre) {
                    tailles[id] += 1 + tailleDe(membre);
                });
            }
            return tailles[id];
        }

        personnes.forEach(function (p) {
            p.tailleEquipe = tailleDe(p.id);
        });
    }

    /**
     * Premier responsable retenu au-dessus d'une personne, par-dessus les
     * exclus (repli de l'export du Cockpit, _kept_manager).
     *
     * @param {object} tous personnes listées, par ID (hiérarchie déjà liée)
     * @param {object} retenues personnes retenues, par ID
     * @param {number} id personne
     * @returns {number|null} ID du responsable retenu, ou null
     */
    function responsableRetenu(tous, retenues, id) {
        var vus = {};
        var courant = tous[id].responsableId;

        vus[id] = true;
        while (courant !== null && courant !== undefined && !vus[courant]) {
            if (retenues.hasOwnProperty(courant)) {
                return courant;
            }
            vus[courant] = true;
            courant = tous.hasOwnProperty(courant) ? tous[courant].responsableId : null;
        }
        return null;
    }

    /**
     * Assemble l'annuaire à partir des fiches et des cercles bruts.
     *
     * @param {Array} fiches fiches Collaborateur (liste blanche)
     * @param {Array} cercles objets Cercle/rôle { id, nom, enfants }
     * @returns {object} { personnes, parId } ; n'y figurent que les
     *     personnes aux étapes listées ET rattachées à un cercle de
     *     l'organisation, triées par nom ; aucune autre n'est mentionnée,
     *     pas même comme responsable ou membre d'une équipe
     */
    function construireAnnuaire(fiches, cercles) {
        var listees = fiches.filter(estListee).map(personneDe).sort(parNom);
        var tous = {};
        var personnes;
        var parId = {};

        listees.forEach(function (p) {
            tous[p.id] = p;
            p.recherche = texteRecherche(p);
        });
        poserCercles(listees, construireOrganisation(cercles || []));
        // Hiérarchie de toutes les personnes listées, pour pouvoir remonter
        // par-dessus un responsable exclu
        lierHierarchie(listees, tous);

        personnes = listees.filter(function (p) { return p.cercles.length > 0; });
        personnes.forEach(function (p) {
            parId[p.id] = p;
        });
        personnes.forEach(function (p) {
            p.responsableDemande = responsableRetenu(tous, parId, p.id);
        });
        lierHierarchie(personnes, parId);
        return { personnes: personnes, parId: parId };
    }

    /**
     * Texte de recherche d'une personne : nom, initiales, titre, /Titre,
     * fonctions, succursale, cercle principal et partie locale de
     * l'e-mail, repliés. Le nom du responsable n'y est pas : chercher un
     * nom ne doit pas ramener son équipe.
     *
     * @param {object} p personne
     * @returns {string} texte replié
     */
    function texteRecherche(p) {
        var parties = [p.nomComplet, p.initiales, p.titre, p.fonctionPrincipale, p.succursale, p.cercle,
            p.email ? p.email.split("@")[0] : null].concat(p.fonctions);

        return parties.filter(function (x) { return x; }).map(plier).join(" ");
    }

    // ---- Recherche, filtres, tri ---------------------------------------

    /** Valeur d'un filtre qui retient les personnes sans valeur. */
    var AUCUN = "__aucun__";

    /**
     * Les quatre informations par lesquelles on filtre (pas l'étape). `valeurs` rend ce
     * qu'une personne porte : [{ valeur, libelle }] (le cercle est retenu
     * par son ID, deux cercles de même nom restant distincts).
     */
    var FACETTES = {
        cercle: { libelle: "Cercle", aucun: "Sans cercle", valeurs: function (p) {
            return p.cercles.map(function (c) { return { valeur: String(c.id), libelle: c.nom }; });
        } },
        succursale: { libelle: "Succursale", aucun: "Sans succursale", valeurs: function (p) {
            return p.succursale ? [{ valeur: p.succursale, libelle: p.succursale }] : [];
        } },
        titre: { libelle: "Titre", aucun: "Sans titre", valeurs: function (p) {
            return p.titre ? [{ valeur: p.titre, libelle: p.titre }] : [];
        } },
        fonction: { libelle: "Fonction", aucun: "Sans fonction", valeurs: function (p) {
            return p.fonctions.map(function (f) { return { valeur: f, libelle: f }; });
        } }
    };
    var CLES_FACETTES = ["cercle", "succursale", "titre", "fonction"];

    /**
     * État vide : aucune recherche, aucun filtre.
     *
     * @returns {object} { q, cercle, succursale, titre, fonction }
     */
    function etatInitial() {
        return { q: "", cercle: null, succursale: null, titre: null, fonction: null };
    }

    /**
     * Mots d'une saisie, repliés ; une adresse e-mail ne garde que sa
     * partie locale (le domaine, commun à tous, n'est pas indexé).
     *
     * @param {string} q saisie
     * @returns {Array} mots non vides
     */
    function motsDe(q) {
        return plier(q).split(/\s+/).map(function (mot) {
            return mot.indexOf("@") >= 0 ? mot.slice(0, mot.indexOf("@")) : mot;
        }).filter(function (mot) { return mot; });
    }

    /**
     * Vrai si une personne porte la valeur retenue pour une facette.
     *
     * @param {object} p personne
     * @param {string} cle clé de FACETTES
     * @param {string} retenue valeur, ou AUCUN
     * @returns {boolean} correspondance
     */
    function correspond(p, cle, retenue) {
        var valeurs = FACETTES[cle].valeurs(p);

        if (retenue === AUCUN) {
            return valeurs.length === 0;
        }
        return valeurs.some(function (v) { return v.valeur === retenue; });
    }

    /**
     * Personnes qui répondent à la recherche et aux filtres.
     *
     * @param {Array} personnes personnes de l'annuaire
     * @param {object} etat recherche et filtres (null : pas de filtre)
     * @param {string} [sauf] facette dont le filtre est ignoré, pour des
     *     effectifs qui montrent ce que les autres valeurs donneraient
     * @returns {Array} personnes retenues, dans l'ordre reçu
     */
    function filtrer(personnes, etat, sauf) {
        var mots = motsDe(etat.q);

        return personnes.filter(function (p) {
            var i;
            var cle;

            for (i = 0; i < CLES_FACETTES.length; i += 1) {
                cle = CLES_FACETTES[i];
                if (cle !== sauf && etat[cle] && !correspond(p, cle, etat[cle])) {
                    return false;
                }
            }
            return mots.every(function (mot) { return p.recherche.indexOf(mot) >= 0; });
        });
    }

    /**
     * Valeurs d'une facette avec leurs effectifs.
     *
     * @param {Array} personnes personnes de l'annuaire
     * @param {object} etat recherche et filtres courants
     * @param {string} cle clé de FACETTES
     * @returns {object} { options: [{ valeur, libelle, effectif }], aucun:
     *     { libelle, effectif } ou null, total } ; options : les valeurs
     *     portées par au moins une personne de l'annuaire, des plus portées
     *     aux moins portées puis par nom (ordre qui ne bouge pas avec les
     *     filtres) ; effectif : personnes retenues par la recherche et les
     *     AUTRES filtres ; aucun n'existe que si quelqu'un n'a pas de valeur
     */
    function optionsFacette(personnes, etat, cle) {
        var facette = FACETTES[cle];
        var connues = {};
        var ordre = [];
        var manquants = 0;
        var effectifs = {};
        var effectifAucun = 0;
        var contexte = filtrer(personnes, etat, cle);

        personnes.forEach(function (p) {
            var valeurs = facette.valeurs(p);
            manquants += valeurs.length ? 0 : 1;
            valeurs.forEach(function (v) {
                if (!connues.hasOwnProperty(v.valeur)) {
                    connues[v.valeur] = { libelle: v.libelle, total: 0 };
                    ordre.push(v.valeur);
                }
                connues[v.valeur].total += 1;
            });
        });
        contexte.forEach(function (p) {
            var valeurs = facette.valeurs(p);
            effectifAucun += valeurs.length ? 0 : 1;
            valeurs.forEach(function (v) {
                effectifs[v.valeur] = (effectifs[v.valeur] || 0) + 1;
            });
        });

        ordre.sort(function (a, b) {
            return connues[b].total - connues[a].total || comparerTextes(connues[a].libelle, connues[b].libelle);
        });
        return {
            options: ordre.map(function (v) {
                return { valeur: v, libelle: connues[v].libelle, effectif: effectifs[v] || 0 };
            }),
            aucun: manquants ? { libelle: facette.aucun, effectif: effectifAucun } : null,
            total: contexte.length
        };
    }

    /**
     * Vrai si une recherche ou un filtre restreint la liste.
     *
     * @param {object} etat état courant
     * @returns {boolean} filtrage actif
     */
    function filtreActif(etat) {
        return motsDe(etat.q).length > 0 || CLES_FACETTES.some(function (cle) { return Boolean(etat[cle]); });
    }

    /**
     * Copie triée des personnes.
     *
     * @param {Array} personnes personnes
     * @param {string} cle nom, prenom, titre, succursale ou cercle (autre : par nom)
     * @returns {Array} nouveau tableau ; l'original n'est pas modifié
     */
    function trier(personnes, cle) {
        var ordres = {
            nom: parNom,
            prenom: function (a, b) { return comparerTextes(a.prenom, b.prenom) || parNom(a, b); },
            titre: function (a, b) { return comparerTextes(a.titre, b.titre) || parNom(a, b); },
            succursale: function (a, b) { return comparerTextes(a.succursale, b.succursale) || parNom(a, b); },
            cercle: function (a, b) { return comparerTextes(a.cercle, b.cercle) || parNom(a, b); }
        };

        return personnes.slice().sort(ordres.hasOwnProperty(cle) ? ordres[cle] : parNom);
    }

    // ---- Vue d'une personne et fiche ---------------------------------------

    /** Fonctions montrées sur une carte ; les autres se résument en « +n ». */
    var FONCTIONS_MONTREES = 2;

    /**
     * Personne prête pour l'affichage (grille, liste, fiche, onglet) :
     * trigramme, fonctions courtes, responsable nommé, cercle principal
     * filtrable s'il est un cercle de l'organisation. Pas d'étape.
     *
     * @param {object} annuaire annuaire construit
     * @param {object} p personne de l'annuaire
     * @returns {object} personne pour la vue (données simples)
     */
    function personneVue(annuaire, p) {
        var responsable = p.responsableId !== null ? annuaire.parId[p.responsableId] : null;

        return {
            id: p.id,
            prenom: p.prenom,
            nom: p.nom,
            nomComplet: p.nomComplet,
            trigramme: trigrammeDe(p),
            teinte: p.teinte,
            titre: p.titre,
            succursale: p.succursale,
            cercle: p.cercle,
            cercleId: p.cercleId,
            cercleFiltrable: p.cercles.some(function (c) { return c.id === p.cercleId; }),
            fonctions: p.fonctions,
            fonctionsCourtes: p.fonctions.slice(0, FONCTIONS_MONTREES),
            fonctionsEnPlus: Math.max(0, p.fonctions.length - FONCTIONS_MONTREES),
            email: p.email,
            responsable: responsable ? { id: responsable.id, nomComplet: responsable.nomComplet } : null,
            cerclesEtRoles: p.cerclesEtRoles,
            tailleEquipe: p.tailleEquipe
        };
    }

    /**
     * Fiche d'une personne : elle, son responsable retenu et son équipe
     * directe, prêts à afficher.
     *
     * @param {object} annuaire annuaire construit
     * @param {number} id ID du collaborateur
     * @returns {object|null} { personne, responsable, equipe }, ou null si
     *     la personne n'est pas dans l'annuaire (exclue ou inconnue)
     */
    function ficheDe(annuaire, id) {
        var p = annuaire.parId.hasOwnProperty(id) ? annuaire.parId[id] : null;

        if (!p) {
            return null;
        }
        return {
            personne: personneVue(annuaire, p),
            responsable: p.responsableId !== null ? personneVue(annuaire, annuaire.parId[p.responsableId]) : null,
            equipe: p.equipe.map(function (membre) { return personneVue(annuaire, annuaire.parId[membre]); })
        };
    }

    return {
        AUCUN: AUCUN,
        personneVue: personneVue,
        ficheDe: ficheDe,
        CLES_FACETTES: CLES_FACETTES,
        FACETTES: FACETTES,
        plier: plier,
        trigrammeDe: trigrammeDe,
        construireAnnuaire: construireAnnuaire,
        etatInitial: etatInitial,
        filtrer: filtrer,
        optionsFacette: optionsFacette,
        filtreActif: filtreActif,
        trier: trier
    };
}());
