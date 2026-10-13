/* exported onglet */
/* =====================================================================
   ONGLET \u00ab TROMBINOSCOPE \u00bb DU VOLET DE DROITE \u2014 pr\u00e9sentateur du module
   (UIX v1, moteur JScript du module : ES5 gr\u00e2ce \u00e0 model/compat.js)

   Quand la s\u00e9lection du listing est UN objet Collaborateur d'une personne
   du trombinoscope (\u00e9tape list\u00e9e et cercle de l'organisation, m\u00eames r\u00e8gles
   que la page), le module affiche dans le volet de droite un onglet qui
   porte sa fiche et sa photo, et le rend actif ; sinon il le masque.

   R\u00e8gles v1 suivies (skill m-files-ui-ext-v1) :
   - seul le module r\u00e8gle la visibilit\u00e9 de l'onglet qu'il a cr\u00e9\u00e9 ; la page
     de l'onglet n'y touche jamais (dashboard.Parent = volet entier) ;
   - un \u00e9tat par cadre (onglet, derni\u00e8re personne, cache des photos) ;
   - un cadre sans volet droit (bo\u00eete de dialogue) est tol\u00e9r\u00e9 ;
   - lectures COM synchrones : le module n'a pas de setTimeout. L'annuaire
     est lu une fois pour la session (ShellUI) et gard\u00e9 DUREE_ANNUAIRE ;
     chaque s\u00e9lection ne lit ensuite que les documents de portrait.
   ===================================================================== */

var onglet = (function () {
    "use strict";

    var ID_ONGLET = "trombinoscope-fiche";
    var TITRE_ONGLET = "Trombinoscope";
    // Dur\u00e9e de validit\u00e9 de l'annuaire lu par le module (ms)
    var DUREE_ANNUAIRE = 10 * 60 * 1000;

    /**
     * Journalise avec le pr\u00e9fixe de l'application.
     *
     * @param {string} message texte
     * @returns {void}
     */
    function journal(message) {
        try {
            console.log(PREFIXE_JOURNAL + " " + message);
        } catch (e) {
            // Console absente : rien \u00e0 faire.
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
     * Annuaire de la session : lu en entier (comme la page) \u00e0 la premi\u00e8re
     * s\u00e9lection d'un collaborateur, puis gard\u00e9 DUREE_ANNUAIRE.
     *
     * @param {object} session \u00e9tat partag\u00e9 du ShellUI { annuaire, luA }
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
     * ObjVer du collaborateur seul s\u00e9lectionn\u00e9, ou null.
     *
     * @param {object} selection \u00e9l\u00e9ments s\u00e9lectionn\u00e9s (ShellItems)
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
     * Cr\u00e9e l'onglet, position \u00ab _last \u00bb puis \u00ab _home \u00bb (squelette du skill,
     * d'apr\u00e8s le Project Dashboard v1).
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
     * @param {object} etat \u00e9tat du cadre
     * @returns {void}
     */
    function masquer(etat) {
        etat.ongletId = null;
        if (etat.onglet) {
            try {
                etat.onglet.Visible = false;
            } catch (e) {
                journal("onglet non masqu\u00e9 : " + messageDe(e));
            }
        }
    }

    /**
     * R\u00e9agit \u00e0 une s\u00e9lection : affiche (et active) ou masque l'onglet.
     *
     * @param {object} contexte { shellFrame, etat, session, vault }
     * @param {object} selection \u00e9l\u00e9ments s\u00e9lectionn\u00e9s
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
        // M\u00eame personne d\u00e9j\u00e0 affich\u00e9e (fiche enregistr\u00e9e, liste rafra\u00eechie) :
        // rien \u00e0 relire, et surtout pas de vol du focus
        if (etat.ongletId === ov.ID) {
            return;
        }
        try {
            fiche = regles.ficheDe(annuaireDe(contexte.session, contexte.vault), ov.ID);
        } catch (e) {
            journal("onglet non affich\u00e9 : " + messageDe(e));
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
            // fiche M-Files depuis le trombinoscope (s\u00e9lection virtuelle)
            if (!virtuelle) {
                etat.onglet.Select();
            }
            etat.ongletId = ov.ID;
        } catch (e) {
            journal("onglet non affich\u00e9 : " + messageDe(e));
            masquer(etat);
        }
    }

    /**
     * Suit la s\u00e9lection du listing de ce cadre.
     *
     * @param {object} shellFrame cadre du client
     * @param {object} etat \u00e9tat de ce cadre
     * @param {object} session \u00e9tat partag\u00e9 du ShellUI
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
            journal("s\u00e9lection non suivie : " + messageDe(e));
        }
    }

    return { suivre: suivre };
}());
