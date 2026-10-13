/* exported presentateur, OnNewDashboard */
/* =====================================================================
   PRÉSENTATEUR DE LA PAGE — UIX v1 (ES5)

   En v1 la page tient son coffre (dashboard.Vault) : ce présentateur tourne
   DANS la page. Il lit le coffre par lots (vault-com.js), en rendant la
   main au navigateur entre chaque lot (sinon l'écran se fige), construit
   l'annuaire (regles.js), garde l'état de la page (recherche, filtres,
   vue, tri, fiche ouverte) et donne à la vue un modèle prêt à afficher.

   La vue ne connaît ni le coffre ni les règles : elle reçoit un modèle et
   appelle les actions. La page ne règle jamais la visibilité de
   dashboard.Parent (le volet entier).
   ===================================================================== */

var presentateur = (function () {
    "use strict";

    var VUES = ["grille", "liste"];
    var TRIS = ["nom", "prenom", "titre", "succursale", "cercle", "etape"];
    // Fonctions montrées sur une carte ; les autres se résument en « +n »
    var FONCTIONS_MONTREES = 2;

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
     * Libellé accordé en nombre.
     *
     * @param {number} n effectif
     * @returns {string} « 1 personne », « 12 personnes »
     */
    function personnes(n) {
        return n + (n > 1 ? " personnes" : " personne");
    }

    /**
     * Crée le présentateur d'une page.
     *
     * @param {object} services { vault, cadre, planifier(fn) } ; planifier
     *     rend la main au navigateur avant d'appeler fn (setTimeout)
     * @param {Function} fabriqueVue reçoit les actions, rend la vue
     *     { progression(texte, fait, total), erreur(m), refuser(m), rendre(modele), message(m) }
     * @returns {object} { demarrer }
     */
    function creer(services, fabriqueVue) {
        var etat = regles.etatInitial();
        var affichage = { vue: "grille", tri: "nom" };
        var ouverte = null;
        var annuaire = null;
        var objVers = {};
        // Numéro de la lecture en cours : une lecture relancée arrête la précédente
        var lectureEnCours = 0;
        var vue = null;
        var actions;

        /**
         * Personne prête pour l'affichage : trigramme, fonctions courtes,
         * responsable nommé (s'il est dans l'annuaire).
         *
         * @param {object} p personne de l'annuaire
         * @returns {object} personne pour la vue
         */
        function pourVue(p) {
            var responsable = p.responsableId !== null ? annuaire.parId[p.responsableId] : null;

            return {
                id: p.id,
                prenom: p.prenom,
                nom: p.nom,
                nomComplet: p.nomComplet,
                trigramme: regles.trigrammeDe(p),
                teinte: p.teinte,
                titre: p.titre,
                succursale: p.succursale,
                cercle: p.cercle,
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
         * Personnes affichées : filtrées puis triées.
         *
         * @returns {Array} personnes de l'annuaire
         */
        function affichees() {
            return regles.trier(regles.filtrer(annuaire.personnes, etat), affichage.tri);
        }

        /**
         * Modèle complet de la page.
         *
         * @returns {object} modèle pour vue.rendre
         */
        function modele() {
            var liste = affichees();
            var total = annuaire.personnes.length;
            var facettes = {};
            var fiche = null;
            var p;

            regles.CLES_FACETTES.forEach(function (cle) {
                facettes[cle] = regles.optionsFacette(annuaire.personnes, etat, cle);
                facettes[cle].libelle = regles.FACETTES[cle].libelle;
            });

            if (ouverte !== null && annuaire.parId.hasOwnProperty(ouverte)) {
                p = annuaire.parId[ouverte];
                fiche = {
                    personne: pourVue(p),
                    responsable: p.responsableId !== null ? pourVue(annuaire.parId[p.responsableId]) : null,
                    equipe: p.equipe.map(function (id) { return pourVue(annuaire.parId[id]); }),
                    dansMFiles: Boolean(services.cadre && objVers.hasOwnProperty(p.id))
                };
            }

            return {
                total: total,
                compteur: regles.filtreActif(etat) ? personnes(liste.length) + " sur " + total : personnes(total),
                personnes: liste.map(pourVue),
                facettes: facettes,
                etat: { q: etat.q, cercle: etat.cercle, etape: etat.etape, succursale: etat.succursale,
                    titre: etat.titre, fonction: etat.fonction },
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
         * Arrête la lecture sur une erreur et l'explique.
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
         * Enchaîne des étapes en rendant la main au navigateur entre
         * chacune ; la première erreur arrête tout, et une lecture
         * relancée entre-temps (« Relire ») arrête celle-ci.
         *
         * @param {number} lecture numéro de la lecture qui enchaîne
         * @param {Array} etapes fonctions sans argument
         * @param {Function} fin appelée après la dernière étape
         * @returns {void}
         */
        function enchainer(lecture, etapes, fin) {
            var i = 0;

            /**
             * Exécute l'étape courante puis planifie la suivante.
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
         * Découpe un tableau en lots.
         *
         * @param {Array} tableau éléments
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
         * Lit le coffre : collaborateurs des étapes listées, leurs fiches
         * par lots, puis les cercles et rôles par lots ; construit
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
            // Défense en profondeur : la commande n'est posée qu'aux membres,
            // mais une page ouverte autrement ne lit ni n'affiche rien.
            if (!verdict.autorise) {
                console.log(PREFIXE_JOURNAL + " annuaire non affiché : " + verdict.raison);
                annuaire = null;
                vue.refuser("Cette application n'est pas disponible pour votre compte.");
                return;
            }
            annuaire = null;
            objVers = {};
            vue.progression("Recherche des collaborateurs…", 0, 0);

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
                // Un annuaire vide dit plutôt que les identifiants d'étape ont changé dans le coffre
                if (!trouves.length) {
                    throw new Error("M-Files ne rend aucun collaborateur aux étapes " + PARAMETRAGE.etapes.map(function (e) {
                        return "« " + e.nom + " »";
                    }).join(", ") + " : leurs identifiants ont peut-être changé (src/model/parametrage.js).");
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
                    vue.progression("Lecture des cercles et rôles", 0, cerclesTrouves.length);
                }]), function () {
                    enchainer(lecture, lots(cerclesTrouves, PARAMETRAGE.tailleLot * 5).map(function (lot) {
                        return function () {
                            cercles = cercles.concat(coffre.lireCercles(services.vault, lot));
                            vue.progression("Lecture des cercles et rôles", cercles.length, cerclesTrouves.length);
                        };
                    }), function () {
                        annuaire = regles.construireAnnuaire(fiches, cercles);
                        console.log(PREFIXE_JOURNAL + " annuaire lu : " + annuaire.personnes.length + " personnes, " +
                            cercles.length + " cercles et rôles, " + (new Date().getTime() - debut) + " ms");
                        rendre();
                    });
                });
            });
        }

        // Actions appelées par la vue ; chacune met l'état à jour puis rend la page.
        actions = {
            /** Relit tout le coffre (une lecture en cours s'arrête). @returns {void} */
            relire: function () {
                demarrer();
            },
            /**
             * Recherche instantanée.
             * @param {string} q saisie
             * @returns {void}
             */
            rechercher: function (q) {
                etat.q = String(q || "");
                rendre();
            },
            /**
             * Pose ou retire le filtre d'une facette ; une clé inconnue est ignorée.
             * @param {string} cle facette (cercle, etape, succursale, titre, fonction)
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
             * @param {string} v « grille » ou « liste »
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
                ouverte = annuaire && annuaire.parId.hasOwnProperty(id) ? Number(id) : null;
                rendre();
            },
            /** Ferme la fiche. @returns {void} */
            fermer: function () {
                ouverte = null;
                rendre();
            },
            /**
             * Passe à la personne précédente ou suivante, dans l'ordre affiché.
             * @param {number} sens -1 ou 1
             * @returns {void}
             */
            voisine: function (sens) {
                var liste = affichees();
                var i;

                for (i = 0; i < liste.length; i += 1) {
                    if (liste[i].id === ouverte && liste[i + sens]) {
                        ouverte = liste[i + sens].id;
                        rendre();
                        return;
                    }
                }
            },
            /** Rend la zone de listage au client (ShowDefaultContent). @returns {void} */
            revenir: function () {
                try {
                    services.cadre.ShowDefaultContent();
                } catch (e) {
                    vue.message("Retour au listage impossible : " + messageDe(e));
                }
            },
            /**
             * Montre la fiche native du collaborateur dans le volet de droite
             * (sélection virtuelle sur l'ObjVer de la recherche).
             * @param {number} id ID du collaborateur
             * @returns {void}
             */
            afficherDansMFiles: function (id) {
                var ok = Boolean(services.cadre) && objVers.hasOwnProperty(id) &&
                    coffre.selectionVirtuelle(services.cadre, objVers[id]);

                if (!ok) {
                    vue.message("La fiche ne peut pas être affichée dans M-Files depuis cette fenêtre.");
                }
            }
        };

        vue = fabriqueVue(actions);
        return { demarrer: demarrer, actions: actions };
    }

    return { creer: creer };
}());

/**
 * Point d'entrée appelé par le client à chaque affichage du tableau de
 * bord. Coffre et cadre d'abord, données ensuite : dans l'autre ordre,
 * la page démarrait sans coffre.
 *
 * @param {object} dashboard dashboard créé par le client
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

    console.log(PREFIXE_JOURNAL + " version " + VERSION_PAQUET + " — page ouverte");
    p = presentateur.creer({
        vault: vault,
        cadre: cadreDuDashboard(dashboard, donnees),
        planifier: function (fn) {
            setTimeout(fn, 0);
        }
    }, function (actions) {
        return rendu.creer(document, actions);
    });

    // Sans coffre, le contrôle d'accès refuse (échec fermé) : la page le dit
    p.demarrer();
}

/**
 * Retrouve le cadre du client. Un objet ActiveX n'expose pas ses membres
 * à l'inspection : chaque candidat est éprouvé en LISANT une propriété.
 *
 * @param {object} dashboard dashboard
 * @param {object} donnees données du module
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
            // Lecture d'une propriété : lève si ce n'est pas un cadre.
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
