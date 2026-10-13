/* exported presentateur, OnNewDashboard */
/* =====================================================================
   PR\u00c9SENTATEUR DE LA PAGE \u2014 UIX v1 (ES5)

   En v1 la page tient son coffre (dashboard.Vault) : ce pr\u00e9sentateur tourne
   DANS la page. Il lit le coffre par lots (vault-com.js), en rendant la
   main au navigateur entre chaque lot (sinon l'\u00e9cran se fige), construit
   l'annuaire (regles.js), garde l'\u00e9tat de la page (recherche, filtres,
   vue, tri, fiche ouverte) et donne \u00e0 la vue un mod\u00e8le pr\u00eat \u00e0 afficher.

   La vue ne conna\u00eet ni le coffre ni les r\u00e8gles : elle re\u00e7oit un mod\u00e8le et
   appelle les actions. La page ne r\u00e8gle jamais la visibilit\u00e9 de
   dashboard.Parent (le volet entier).
   ===================================================================== */

var presentateur = (function () {
    "use strict";

    var VUES = ["grille", "liste"];
    // Pas de tri par \u00e9tape : l'\u00e9tape n'appara\u00eet nulle part (docs/adr/0005)
    var TRIS = ["nom", "prenom", "titre", "succursale", "cercle"];

    /**
     * Message lisible d'une erreur COM.
     *
     * @param {*} e erreur
     * @returns {string} message
     */
    function messageDe(e) {
        return (e && (e.message || e.description)) || String(e);
    }

    /**
     * Libell\u00e9 accord\u00e9 en nombre.
     *
     * @param {number} n effectif
     * @returns {string} \u00ab 1 personne \u00bb, \u00ab 12 personnes \u00bb
     */
    function personnes(n) {
        return n + (n > 1 ? " personnes" : " personne");
    }

    /**
     * Cr\u00e9e le pr\u00e9sentateur d'une page.
     *
     * @param {object} services { vault, cadre, etatCadre, actionInitiale,
     *     planifier(fn) } ; planifier rend la main au navigateur avant
     *     d'appeler fn (setTimeout) ; etatCadre est l'\u00e9tat du cadre tenu par
     *     le module ; actionInitiale ({ filtre: { cle, valeur } } ou
     *     { ouvrir: id }) vient d'un lien de l'onglet du volet de droite
     * @param {Function} fabriqueVue re\u00e7oit les actions, rend la vue
     *     { progression(texte, fait, total), erreur(m), refuser(m), rendre(modele), message(m) }
     * @returns {object} { demarrer }
     */
    function creer(services, fabriqueVue) {
        var etat = regles.etatInitial();
        var affichage = { vue: "grille", tri: "nom" };
        var ouverte = null;
        var annuaire = null;
        var objVers = {};
        // Photos du volet lat\u00e9ral : disponibilit\u00e9 par personne (vue \u00e0 l'ouverture
        // de sa fiche), personne dont la photo est affich\u00e9e, URI lues, cache
        var photoDe = {};
        var photoAffichee = null;
        var photoUri = {};
        var cachePhotos = {};
        // Num\u00e9ro de la lecture en cours : une lecture relanc\u00e9e arr\u00eate la pr\u00e9c\u00e9dente
        var lectureEnCours = 0;
        var vue = null;
        var actions;

        /**
         * Personnes affich\u00e9es : filtr\u00e9es puis tri\u00e9es.
         *
         * @returns {Array} personnes de l'annuaire
         */
        function affichees() {
            return regles.trier(regles.filtrer(annuaire.personnes, etat), affichage.tri);
        }

        /**
         * Mod\u00e8le complet de la page.
         *
         * @returns {object} mod\u00e8le pour vue.rendre
         */
        function modele() {
            var liste = affichees();
            var total = annuaire.personnes.length;
            var facettes = {};
            var fiche = null;

            regles.CLES_FACETTES.forEach(function (cle) {
                facettes[cle] = regles.optionsFacette(annuaire.personnes, etat, cle);
                facettes[cle].libelle = regles.FACETTES[cle].libelle;
            });

            if (ouverte !== null) {
                fiche = regles.ficheDe(annuaire, ouverte);
                if (fiche) {
                    fiche.dansMFiles = Boolean(services.cadre && objVers.hasOwnProperty(ouverte));
                    fiche.photo = {
                        disponible: Boolean(photoDe[ouverte]),
                        affichee: photoAffichee === ouverte,
                        dataUri: photoAffichee === ouverte ? photoUri[ouverte] : null
                    };
                }
            }

            return {
                total: total,
                compteur: regles.filtreActif(etat) ? personnes(liste.length) + " sur " + total : personnes(total),
                personnes: liste.map(function (p) { return regles.personneVue(annuaire, p); }),
                facettes: facettes,
                etat: { q: etat.q, cercle: etat.cercle, succursale: etat.succursale,
                    titre: etat.titre, fonction: etat.fonction },
                // M\u00eame mention que l'export du Cockpit (model/export_page.py)
                bandeau: "Donn\u00e9es internes : collaborateurs rattach\u00e9s \u00e0 un cercle (" + personnes(total) + ").",
                filtreActif: regles.filtreActif(etat),
                affichage: { vue: affichage.vue, tri: affichage.tri },
                fiche: fiche,
                AUCUN: regles.AUCUN
            };
        }

        /**
         * Rend la page si l'annuaire est lu.
         *
         * @returns {void}
         */
        function rendre() {
            if (annuaire) {
                vue.rendre(modele());
            }
        }

        /**
         * Applique, une seule fois, l'action venue d'un lien de l'onglet :
         * un filtre d\u00e9j\u00e0 pos\u00e9, ou la fiche d'une personne ouverte. Une cl\u00e9
         * ou une personne inconnue est ignor\u00e9e.
         *
         * @returns {void}
         */
        function appliquerActionInitiale() {
            var a = services.actionInitiale;

            services.actionInitiale = null;
            if (!a) {
                return;
            }
            try {
                if (a.filtre && regles.FACETTES.hasOwnProperty(a.filtre.cle)) {
                    etat[a.filtre.cle] = String(a.filtre.valeur);
                } else if (a.ouvrir !== undefined && a.ouvrir !== null && annuaire.parId.hasOwnProperty(a.ouvrir)) {
                    changerFiche(Number(a.ouvrir));
                }
            } catch (e) {
                console.log(PREFIXE_JOURNAL + " action du lien ignor\u00e9e : " + messageDe(e));
            }
        }

        /**
         * Change la fiche ouverte. Chaque fiche s'ouvre sur le trigramme : la
         * photo affich\u00e9e pour une personne ne reste jamais sur une autre. On
         * regarde alors (une fois par personne, sans t\u00e9l\u00e9charger) si une
         * photo peut \u00eatre propos\u00e9e.
         *
         * @param {number|null} id personne, ou null pour fermer
         * @returns {void}
         */
        function changerFiche(id) {
            ouverte = id;
            photoAffichee = null;
            if (id !== null && !photoDe.hasOwnProperty(id)) {
                photoDe[id] = portraits.photoDisponible(services.vault, id);
            }
        }

        /**
         * Arr\u00eate la lecture sur une erreur et l'explique.
         *
         * @param {*} e erreur
         * @returns {void}
         */
        function echouer(e) {
            var message = messageDe(e);

            console.log(PREFIXE_JOURNAL + " lecture interrompue : " + message);
            vue.erreur(message);
        }

        /**
         * Encha\u00eene des \u00e9tapes en rendant la main au navigateur entre
         * chacune ; la premi\u00e8re erreur arr\u00eate tout, et une lecture
         * relanc\u00e9e entre-temps (\u00ab Relire \u00bb) arr\u00eate celle-ci.
         *
         * @param {number} lecture num\u00e9ro de la lecture qui encha\u00eene
         * @param {Array} etapes fonctions sans argument
         * @param {Function} fin appel\u00e9e apr\u00e8s la derni\u00e8re \u00e9tape
         * @returns {void}
         */
        function enchainer(lecture, etapes, fin) {
            var i = 0;

            /**
             * Ex\u00e9cute l'\u00e9tape courante puis planifie la suivante.
             *
             * @returns {void}
             */
            function suivante() {
                if (lecture !== lectureEnCours) {
                    return;
                }
                try {
                    if (i < etapes.length) {
                        etapes[i]();
                        i += 1;
                        services.planifier(suivante);
                    } else {
                        fin();
                    }
                } catch (e) {
                    echouer(e);
                }
            }
            services.planifier(suivante);
        }

        /**
         * D\u00e9coupe un tableau en lots.
         *
         * @param {Array} tableau \u00e9l\u00e9ments
         * @param {number} taille taille d'un lot
         * @returns {Array} lots
         */
        function lots(tableau, taille) {
            var sortie = [];
            var i;

            for (i = 0; i < tableau.length; i += taille) {
                sortie.push(tableau.slice(i, i + taille));
            }
            return sortie;
        }

        /**
         * Lit le coffre : collaborateurs des \u00e9tapes list\u00e9es, leurs fiches
         * par lots, puis les cercles et r\u00f4les par lots ; construit
         * l'annuaire et rend la page.
         *
         * @returns {void}
         */
        function demarrer() {
            var trouves = [];
            var fiches = [];
            var cerclesTrouves = [];
            var cercles = [];
            var debut = new Date().getTime();
            var lecture;
            var verdict = acces.verifier(services.vault);

            lectureEnCours += 1;
            lecture = lectureEnCours;
            // D\u00e9fense en profondeur : la commande n'est pos\u00e9e qu'aux membres,
            // mais une page ouverte autrement ne lit ni n'affiche rien.
            if (!verdict.autorise) {
                console.log(PREFIXE_JOURNAL + " annuaire non affich\u00e9 : " + verdict.raison);
                annuaire = null;
                vue.refuser("Cette application n'est pas disponible pour votre compte.");
                return;
            }
            annuaire = null;
            objVers = {};
            vue.progression("Recherche des collaborateurs\u2026", 0, 0);

            enchainer(lecture, PARAMETRAGE.etapes.map(function (etape) {
                return function () {
                    coffre.chercherCollaborateurs(services.vault, etape.id).forEach(function (ov) {
                        if (!objVers.hasOwnProperty(ov.ID)) {
                            objVers[ov.ID] = ov;
                            trouves.push(ov);
                        }
                    });
                };
            }).concat([function () {
                // Un annuaire vide dit plut\u00f4t que les identifiants d'\u00e9tape ont chang\u00e9 dans le coffre
                if (!trouves.length) {
                    throw new Error("M-Files ne rend aucun collaborateur aux \u00e9tapes " + PARAMETRAGE.etapes.map(function (e) {
                        return "\u00ab " + e.nom + " \u00bb";
                    }).join(", ") + " : leurs identifiants ont peut-\u00eatre chang\u00e9 (src/model/parametrage.js).");
                }
            }]), function () {
                var lotsFiches = lots(trouves, PARAMETRAGE.tailleLot);

                vue.progression("Lecture des fiches", 0, trouves.length);
                enchainer(lecture, lotsFiches.map(function (lot) {
                    return function () {
                        fiches = fiches.concat(coffre.lireFiches(services.vault, lot));
                        vue.progression("Lecture des fiches", fiches.length, trouves.length);
                    };
                }).concat([function () {
                    cerclesTrouves = coffre.chercherCercles(services.vault);
                    vue.progression("Lecture des cercles et r\u00f4les", 0, cerclesTrouves.length);
                }]), function () {
                    enchainer(lecture, lots(cerclesTrouves, PARAMETRAGE.tailleLot * 5).map(function (lot) {
                        return function () {
                            cercles = cercles.concat(coffre.lireCercles(services.vault, lot));
                            vue.progression("Lecture des cercles et r\u00f4les", cercles.length, cerclesTrouves.length);
                        };
                    }), function () {
                        annuaire = regles.construireAnnuaire(fiches, cercles);
                        appliquerActionInitiale();
                        console.log(PREFIXE_JOURNAL + " annuaire lu : " + annuaire.personnes.length + " personnes, " +
                            cercles.length + " cercles et r\u00f4les, " + (new Date().getTime() - debut) + " ms");
                        rendre();
                    });
                });
            });
        }

        /**
         * Note dans l'\u00e9tat du cadre (objet du module) la personne d'une
         * s\u00e9lection virtuelle ; sans \u00e9tat du cadre, rien.
         *
         * @param {number|null} id personne, ou null pour effacer
         * @returns {void}
         */
        function signalerSelectionVirtuelle(id) {
            try {
                if (services.etatCadre) {
                    services.etatCadre.selectionVirtuelle = id;
                }
            } catch (e) {
                console.log(PREFIXE_JOURNAL + " \u00e9tat du cadre inaccessible : " + messageDe(e));
            }
        }

        // Actions appel\u00e9es par la vue ; chacune met l'\u00e9tat \u00e0 jour puis rend la page.
        actions = {
            /** Relit tout le coffre (une lecture en cours s'arr\u00eate). @returns {void} */
            relire: function () {
                demarrer();
            },
            /**
             * Recherche instantan\u00e9e.
             * @param {string} q saisie
             * @returns {void}
             */
            rechercher: function (q) {
                etat.q = String(q || "");
                rendre();
            },
            /**
             * Pose ou retire le filtre d'une facette ; une cl\u00e9 inconnue est ignor\u00e9e.
             * @param {string} cle facette (cercle, succursale, titre, fonction)
             * @param {string} valeur valeur retenue, regles.AUCUN, ou "" pour retirer
             * @returns {void}
             */
            filtrer: function (cle, valeur) {
                if (regles.FACETTES.hasOwnProperty(cle)) {
                    etat[cle] = valeur ? String(valeur) : null;
                    rendre();
                }
            },
            /** Efface la recherche et tous les filtres. @returns {void} */
            reinitialiser: function () {
                etat = regles.etatInitial();
                rendre();
            },
            /**
             * Bascule entre grille et liste.
             * @param {string} v \u00ab grille \u00bb ou \u00ab liste \u00bb
             * @returns {void}
             */
            changerVue: function (v) {
                if (VUES.indexOf(v) >= 0) {
                    affichage.vue = v;
                    rendre();
                }
            },
            /**
             * Change l'ordre d'affichage.
             * @param {string} cle une valeur de TRIS
             * @returns {void}
             */
            trier: function (cle) {
                if (TRIS.indexOf(cle) >= 0) {
                    affichage.tri = cle;
                    rendre();
                }
            },
            /**
             * Ouvre la fiche d'une personne de l'annuaire.
             * @param {number} id ID du collaborateur
             * @returns {void}
             */
            ouvrir: function (id) {
                changerFiche(annuaire && annuaire.parId.hasOwnProperty(id) ? Number(id) : null);
                rendre();
            },
            /** Ferme la fiche. @returns {void} */
            fermer: function () {
                changerFiche(null);
                rendre();
            },
            /**
             * \u00ab Afficher la photo \u00bb : lit la photo en m\u00e9moire (cache) et la
             * met \u00e0 la place du trigramme ; un \u00e9chec garde le trigramme.
             * @param {number} id personne de la fiche ouverte
             * @returns {void}
             */
            afficherPhoto: function (id) {
                var r;

                if (Number(id) !== ouverte) {
                    return;
                }
                r = portraits.portraitDe(services.vault, ouverte, cachePhotos);
                if (r.dataUri) {
                    photoUri[ouverte] = r.dataUri;
                    photoAffichee = ouverte;
                } else {
                    console.log(PREFIXE_JOURNAL + " photo non affich\u00e9e (collaborateur " + ouverte + ")" +
                        (r.note ? " : " + r.note : ""));
                    vue.message("La photo n'a pas pu \u00eatre lue.");
                }
                rendre();
            },
            /**
             * \u00ab Afficher le trigramme \u00bb : revient au trigramme (la photo reste en cache).
             * @returns {void}
             */
            masquerPhoto: function () {
                photoAffichee = null;
                rendre();
            },
            /**
             * Passe \u00e0 la personne pr\u00e9c\u00e9dente ou suivante, dans l'ordre affich\u00e9.
             * @param {number} sens -1 ou 1
             * @returns {void}
             */
            voisine: function (sens) {
                var liste = affichees();
                var i;

                for (i = 0; i < liste.length; i += 1) {
                    if (liste[i].id === ouverte && liste[i + sens]) {
                        changerFiche(liste[i + sens].id);
                        rendre();
                        return;
                    }
                }
            },
            /** \u00ab Vue M-Files \u00bb : rend la zone de listage au client (ShowDefaultContent). @returns {void} */
            revenir: function () {
                try {
                    services.cadre.ShowDefaultContent();
                } catch (e) {
                    vue.message("Vue M-Files impossible : " + messageDe(e));
                }
            },
            /**
             * Montre la fiche native du collaborateur dans le volet de droite
             * (s\u00e9lection virtuelle sur l'ObjVer de la recherche).
             * @param {number} id ID du collaborateur
             * @returns {void}
             */
            afficherDansMFiles: function (id) {
                var ok;

                // Le module, voyant ce collaborateur s\u00e9lectionn\u00e9, affichera son
                // onglet sans le rendre actif : l'utilisateur a demand\u00e9 la fiche M-Files
                signalerSelectionVirtuelle(Number(id));
                ok = Boolean(services.cadre) && objVers.hasOwnProperty(id) &&
                    coffre.selectionVirtuelle(services.cadre, objVers[id]);
                if (!ok) {
                    signalerSelectionVirtuelle(null);
                    vue.message("La fiche ne peut pas \u00eatre affich\u00e9e dans M-Files depuis cette fen\u00eatre.");
                }
            }
        };

        vue = fabriqueVue(actions);
        return { demarrer: demarrer, actions: actions };
    }

    return { creer: creer };
}());

/* =====================================================================
   PR\u00c9SENTATEUR DE L'ONGLET \u00ab TROMBINOSCOPE \u00bb (volet de droite)

   Le module a d\u00e9j\u00e0 lu la fiche et la photo du collaborateur s\u00e9lectionn\u00e9 et
   les passe en texte JSON : la page ne lit rien du coffre, elle v\u00e9rifie
   l'acc\u00e8s (d\u00e9fense en profondeur), rend la fiche, et transforme chaque
   lien (fonction, succursale, titre, cercle, personne) en ouverture du
   trombinoscope dans la zone de listage, par le cadre que le module a
   transmis, avec le filtre ou la fiche d\u00e9j\u00e0 pos\u00e9s. Aucune navigation de la
   page (docs/adr/0004).
   ===================================================================== */

var presentateurOnglet = (function () {
    "use strict";

    var REFUS = "Cette application n'est pas disponible pour votre compte.";

    /**
     * Cr\u00e9e le pr\u00e9sentateur de l'onglet.
     *
     * @param {object} services { vault, cadre, etatCadre, donnees (texte JSON du module) }
     * @param {Function} fabriqueVue re\u00e7oit les actions, rend la vue
     *     { rendreOnglet(modele), refuser(m), message(m) }
     * @returns {object} { demarrer, actions }
     */
    function creer(services, fabriqueVue) {
        var vue;
        var actions;

        /**
         * Ouvre le trombinoscope dans la zone de listage avec une action.
         *
         * @param {object} action { filtre: { cle, valeur } } ou { ouvrir: id }
         * @returns {void}
         */
        function ouvrirTrombinoscope(action) {
            try {
                services.cadre.ShowDashboard(PARAMETRAGE.dashboard, {
                    cadre: services.cadre, version: VERSION_PAQUET, etatCadre: services.etatCadre, action: action
                });
            } catch (e) {
                console.log(PREFIXE_JOURNAL + " trombinoscope non ouvert depuis l'onglet : " +
                    ((e && (e.message || e.description)) || e));
                vue.message("Le trombinoscope ne peut pas s'ouvrir depuis cet onglet.");
            }
        }

        /**
         * Rend la fiche, apr\u00e8s contr\u00f4le d'acc\u00e8s et lecture des donn\u00e9es.
         *
         * @returns {void}
         */
        function demarrer() {
            var verdict = acces.verifier(services.vault);
            var modele;

            if (!verdict.autorise) {
                console.log(PREFIXE_JOURNAL + " onglet non affich\u00e9 : " + verdict.raison);
                vue.refuser(REFUS);
                return;
            }
            try {
                modele = JSON.parse(String(services.donnees));
            } catch (e) {
                modele = null;
            }
            if (!modele || !modele.fiche || !modele.fiche.personne) {
                console.log(PREFIXE_JOURNAL + " onglet non affich\u00e9 : donn\u00e9es du module illisibles");
                vue.refuser("Fiche indisponible.");
                return;
            }
            vue.rendreOnglet(modele);
        }

        actions = {
            /**
             * Ouvre le trombinoscope filtr\u00e9 sur une valeur de la fiche.
             * @param {string} cle facette (cercle, succursale, titre, fonction)
             * @param {string} valeur valeur
             * @returns {void}
             */
            filtrer: function (cle, valeur) {
                if (regles.FACETTES.hasOwnProperty(cle) && valeur) {
                    ouvrirTrombinoscope({ filtre: { cle: cle, valeur: String(valeur) } });
                }
            },
            /**
             * Ouvre le trombinoscope sur la fiche d'une personne.
             * @param {number} id ID du collaborateur
             * @returns {void}
             */
            ouvrir: function (id) {
                ouvrirTrombinoscope({ ouvrir: Number(id) });
            }
        };

        vue = fabriqueVue(actions);
        return { demarrer: demarrer, actions: actions };
    }

    return { creer: creer };
}());

/**
 * Point d'entr\u00e9e appel\u00e9 par le client \u00e0 chaque affichage du tableau de
 * bord. Coffre et cadre d'abord, donn\u00e9es ensuite : dans l'autre ordre,
 * la page d\u00e9marrait sans coffre.
 *
 * @param {object} dashboard dashboard cr\u00e9\u00e9 par le client
 * @returns {void}
 */
function OnNewDashboard(dashboard) {
    var vault = null;
    var donnees = {};
    var p;

    try {
        vault = dashboard.Vault;
    } catch (e) {
        vault = null;
    }
    try {
        donnees = dashboard.CustomData || {};
        if (typeof donnees === "string") {
            donnees = JSON.parse(donnees);
        }
    } catch (e) {
        donnees = {};
    }

    // Onglet du volet de droite : la fiche vient du module, la page ne lit rien
    if (donnees.mode === "onglet") {
        console.log(PREFIXE_JOURNAL + " version " + VERSION_PAQUET + " \u2014 onglet ouvert");
        presentateurOnglet.creer({
            vault: vault,
            cadre: cadreDuDashboard(dashboard, donnees),
            etatCadre: donnees.etatCadre || null,
            donnees: donnees.donnees
        }, function (actions) {
            return rendu.creer(document, actions, "onglet");
        }).demarrer();
        return;
    }

    console.log(PREFIXE_JOURNAL + " version " + VERSION_PAQUET + " \u2014 page ouverte");
    p = presentateur.creer({
        vault: vault,
        cadre: cadreDuDashboard(dashboard, donnees),
        etatCadre: donnees.etatCadre || null,
        actionInitiale: donnees.action || null,
        planifier: function (fn) {
            setTimeout(fn, 0);
        }
    }, function (actions) {
        return rendu.creer(document, actions);
    });

    // Sans coffre, le contr\u00f4le d'acc\u00e8s refuse (\u00e9chec ferm\u00e9) : la page le dit
    p.demarrer();
}

/**
 * Retrouve le cadre du client. Un objet ActiveX n'expose pas ses membres
 * \u00e0 l'inspection : chaque candidat est \u00e9prouv\u00e9 en LISANT une propri\u00e9t\u00e9.
 *
 * @param {object} dashboard dashboard
 * @param {object} donnees donn\u00e9es du module
 * @returns {object|null} cadre
 */
function cadreDuDashboard(dashboard, donnees) {
    var voies = [
        function () { return donnees.cadre; },
        function () { return dashboard.Parent; },
        function () { return dashboard.Parent.ShellFrame; },
        function () { return dashboard.ShellFrame; }
    ];
    var i;
    var candidat;

    for (i = 0; i < voies.length; i += 1) {
        try {
            candidat = voies[i]();
            // Lecture d'une propri\u00e9t\u00e9 : l\u00e8ve si ce n'est pas un cadre.
            if (candidat && typeof candidat.CurrentPath !== "undefined") {
                return candidat;
            }
        } catch (e) {
            // Candidat suivant.
        }
    }
    console.log(PREFIXE_JOURNAL + " cadre du client introuvable : retour au listage et fiche M-Files indisponibles");
    return null;
}
