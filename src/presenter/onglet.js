/* exported onglet */
/* =====================================================================
   ONGLET « TROMBINOSCOPE » DU VOLET DE DROITE — présentateur du module
   (UIX v1, moteur JScript du module : ES5 grâce à model/compat.js)

   Quand la sélection du listing est UN objet Collaborateur d'une personne
   du trombinoscope (étape listée et cercle de l'organisation, mêmes règles
   que la page), le module affiche dans le volet de droite un onglet qui
   porte sa fiche et sa photo, et le rend actif ; sinon il le masque.

   Règles v1 suivies (skill m-files-ui-ext-v1) :
   - seul le module règle la visibilité de l'onglet qu'il a créé ; la page
     de l'onglet n'y touche jamais (dashboard.Parent = volet entier) ;
   - un état par cadre (onglet, dernière personne, cache des photos) ;
   - un cadre sans volet droit (boîte de dialogue) est toléré ;
   - lectures COM synchrones : le module n'a pas de setTimeout. L'annuaire
     est lu une fois pour la session (ShellUI) et gardé DUREE_ANNUAIRE ;
     chaque sélection ne lit ensuite que les documents de portrait.
   ===================================================================== */

var onglet = (function () {
    "use strict";

    var ID_ONGLET = "trombinoscope-fiche";
    var TITRE_ONGLET = "Trombinoscope";
    // Durée de validité de l'annuaire lu par le module (ms)
    var DUREE_ANNUAIRE = 10 * 60 * 1000;

    /**
     * Journalise avec le préfixe de l'application.
     *
     * @param {string} message texte
     * @returns {void}
     */
    function journal(message) {
        try {
            console.log(PREFIXE_JOURNAL + " " + message);
        } catch (e) {
            // Console absente : rien à faire.
        }
    }

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
     * Annuaire de la session : lu en entier (comme la page) à la première
     * sélection d'un collaborateur, puis gardé DUREE_ANNUAIRE.
     *
     * @param {object} session état partagé du ShellUI { annuaire, luA }
     * @param {object} vault coffre COM
     * @returns {object} annuaire (regles.construireAnnuaire)
     */
    function annuaireDe(session, vault) {
        var maintenant = new Date().getTime();
        var trouves = [];
        var vus = {};
        var fiches = [];
        var cerclesTrouves;
        var cercles = [];
        var i;

        if (session.annuaire && maintenant - session.luA < DUREE_ANNUAIRE) {
            return session.annuaire;
        }

        PARAMETRAGE.etapes.forEach(function (etape) {
            coffre.chercherCollaborateurs(vault, etape.id).forEach(function (ov) {
                if (!vus.hasOwnProperty(ov.ID)) {
                    vus[ov.ID] = true;
                    trouves.push(ov);
                }
            });
        });
        for (i = 0; i < trouves.length; i += PARAMETRAGE.tailleLot) {
            fiches = fiches.concat(coffre.lireFiches(vault, trouves.slice(i, i + PARAMETRAGE.tailleLot)));
        }
        cerclesTrouves = coffre.chercherCercles(vault);
        for (i = 0; i < cerclesTrouves.length; i += PARAMETRAGE.tailleLot * 5) {
            cercles = cercles.concat(coffre.lireCercles(vault, cerclesTrouves.slice(i, i + PARAMETRAGE.tailleLot * 5)));
        }

        session.annuaire = regles.construireAnnuaire(fiches, cercles);
        session.luA = new Date().getTime();
        journal("annuaire de l'onglet lu : " + session.annuaire.personnes.length + " personnes, " +
            (session.luA - maintenant) + " ms");
        return session.annuaire;
    }

    /**
     * ObjVer du collaborateur seul sélectionné, ou null.
     *
     * @param {object} selection éléments sélectionnés (ShellItems)
     * @returns {object|null} ObjVer
     */
    function collaborateurSeul(selection) {
        var versions;
        var ov;

        try {
            versions = selection.ObjectVersions;
            if (versions.Count !== 1) {
                return null;
            }
            ov = versions.Item(1).ObjVer;
            return ov.Type === PARAMETRAGE.typeCollaborateur ? ov : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Crée l'onglet, position « _last » puis « _home » (squelette du skill,
     * d'après le Project Dashboard v1).
     *
     * @param {object} volet RightPane
     * @returns {object} onglet
     */
    function creerOnglet(volet) {
        try {
            return volet.AddTab(ID_ONGLET, TITRE_ONGLET, "_last");
        } catch (e) {
            return volet.AddTab(ID_ONGLET, TITRE_ONGLET, "_home");
        }
    }

    /**
     * Masque l'onglet de ce cadre, s'il existe.
     *
     * @param {object} etat état du cadre
     * @returns {void}
     */
    function masquer(etat) {
        etat.ongletId = null;
        if (etat.onglet) {
            try {
                etat.onglet.Visible = false;
            } catch (e) {
                journal("onglet non masqué : " + messageDe(e));
            }
        }
    }

    /**
     * Réagit à une sélection : affiche (et active) ou masque l'onglet.
     *
     * @param {object} contexte { shellFrame, etat, session, vault }
     * @param {object} selection éléments sélectionnés
     * @returns {void}
     */
    function surSelection(contexte, selection) {
        var etat = contexte.etat;
        var ov = collaborateurSeul(selection);
        var fiche;
        var photo;
        var virtuelle;

        if (!ov) {
            masquer(etat);
            return;
        }
        // Même personne déjà affichée (fiche enregistrée, liste rafraîchie) :
        // rien à relire, et surtout pas de vol du focus
        if (etat.ongletId === ov.ID) {
            return;
        }
        try {
            fiche = regles.ficheDe(annuaireDe(contexte.session, contexte.vault), ov.ID);
        } catch (e) {
            journal("onglet non affiché : " + messageDe(e));
            masquer(etat);
            return;
        }
        if (!fiche || !contexte.shellFrame.RightPane) {
            masquer(etat);
            return;
        }

        photo = portraits.portraitDe(contexte.vault, ov.ID, etat.photos);
        virtuelle = etat.selectionVirtuelle === ov.ID;
        etat.selectionVirtuelle = null;
        try {
            if (!etat.onglet) {
                etat.onglet = creerOnglet(contexte.shellFrame.RightPane);
            }
            etat.onglet.Visible = true;
            etat.onglet.ShowDashboard(PARAMETRAGE.dashboard, {
                cadre: contexte.shellFrame,
                mode: "onglet",
                version: VERSION_PAQUET,
                etatCadre: etat,
                donnees: compat.versJson({ fiche: fiche, photo: photo })
            });
            // Onglet actif, sauf quand l'utilisateur vient de demander la
            // fiche M-Files depuis le trombinoscope (sélection virtuelle)
            if (!virtuelle) {
                etat.onglet.Select();
            }
            etat.ongletId = ov.ID;
        } catch (e) {
            journal("onglet non affiché : " + messageDe(e));
            masquer(etat);
        }
    }

    /**
     * Suit la sélection du listing de ce cadre.
     *
     * @param {object} shellFrame cadre du client
     * @param {object} etat état de ce cadre
     * @param {object} session état partagé du ShellUI
     * @param {object} vault coffre COM
     * @returns {void}
     */
    function suivre(shellFrame, etat, session, vault) {
        var contexte = { shellFrame: shellFrame, etat: etat, session: session, vault: vault };

        etat.onglet = null;
        etat.ongletId = null;
        etat.photos = {};
        etat.selectionVirtuelle = null;
        try {
            shellFrame.Listing.Events.Register(Event_SelectionChanged, function (selection) {
                surSelection(contexte, selection);
            });
        } catch (e) {
            journal("sélection non suivie : " + messageDe(e));
        }
    }

    return { suivre: suivre };
}());
