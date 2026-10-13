/* exported OnNewShellUI */
/* =====================================================================
   MODULE SHELLUI — UIX v1, client classique (ES5, synchrone)

   Un état PAR cadre : le client ouvre plusieurs cadres (fenêtres,
   boîtes de dialogue) et un état global faisait réagir chacun au clic
   d'un autre. Le module seul règle la visibilité de l'onglet qu'il crée.
   Dépend de model/parametrage.js, chargé avant lui.
   ===================================================================== */

/**
 * Point d'entrée appelé par le framework.
 *
 * Event_NewShellFrame plutôt que Event_NewNormalShellFrame : les boîtes
 * de dialogue (« Enregistrer sous ») sont aussi des cadres.
 *
 * @param {object} shellUI interface ShellUI
 * @returns {void}
 */
function OnNewShellUI(shellUI) {
    shellUI.Events.Register(Event_NewShellFrame, function (shellFrame) {
        var etat = { commande: null, onglet: null, affiche: false };

        shellFrame.Events.Register(Event_Started, function () {
            journal("version " + VERSION_PAQUET + " — nouveau cadre" + genreDuCadre(shellFrame));
            creerCommande(shellFrame, etat);
            suivreSelection(shellFrame, etat);
        });
    });
}

/**
 * Crée la commande, son gestionnaire, puis la place. Le gestionnaire est
 * enregistré avant le placement : un placement qui lève ne doit pas
 * l'emporter. Un cadre de dialogue n'a pas de volet des tâches.
 *
 * @param {object} shellFrame cadre du client
 * @param {object} etat état de ce cadre
 * @returns {void}
 */
function creerCommande(shellFrame, etat) {
    try {
        etat.commande = shellFrame.Commands.CreateCustomCommand("Mon application");

        shellFrame.Commands.Events.Register(Event_CustomCommand, function (id) {
            // Seule la commande DE CE CADRE déclenche l'affichage.
            if (id === etat.commande) {
                afficher(shellFrame, etat);
            }
        });
    } catch (e) {
        journal("commande non créée : " + messageDe(e));
        return;
    }

    try {
        if (shellFrame.TaskPane) {
            shellFrame.TaskPane.AddCustomCommandToGroup(etat.commande, TaskPaneGroup_Main, 1);
        }
        shellFrame.Commands.AddCustomCommandToMenu(etat.commande, MenuLocation_ContextMenu_Top, 1);
    } catch (e) {
        journal("commande non placée : " + messageDe(e));
    }

    try {
        shellFrame.Commands.SetIconFromPath(etat.commande, "{DOSSIER}/icones/app.ico");
    } catch (e) {
        journal("icône non posée : " + messageDe(e));
    }
}

/**
 * Affiche le dashboard dans la zone de listage. Le cadre voyage dans les
 * données : c'est la voie la plus sûre pour que la page l'atteigne.
 *
 * @param {object} shellFrame cadre du client
 * @param {object} etat état de ce cadre
 * @returns {void}
 */
function afficher(shellFrame, etat) {
    try {
        shellFrame.ShowDashboard(PARAMETRAGE.dashboard, { cadre: shellFrame, version: VERSION_PAQUET });
        etat.affiche = true;
    } catch (e) {
        journal("affichage impossible : " + messageDe(e));
    }
}

/**
 * Exemple : onglet du volet droit, visible seulement pour les objets
 * concernés. La page n'y touche jamais (dashboard.Parent = volet entier).
 *
 * @param {object} shellFrame cadre du client
 * @param {object} etat état de ce cadre
 * @returns {void}
 */
function suivreSelection(shellFrame, etat) {
    try {
        shellFrame.Listing.Events.Register(Event_SelectionChanged, function (selection) {
            var concerne = false;

            try {
                concerne = selection.ObjectVersions.Count === 1;
            } catch (e) {
                concerne = false;
            }

            if (concerne && !etat.onglet) {
                etat.onglet = creerOnglet(shellFrame.RightPane);
                etat.onglet.ShowDashboard(PARAMETRAGE.dashboard, { cadre: shellFrame, mode: "onglet" });
            }

            if (etat.onglet) {
                etat.onglet.Visible = concerne;
            }
        });
    } catch (e) {
        journal("sélection non suivie : " + messageDe(e));
    }
}

/**
 * Crée l'onglet, position « _last » puis « _home » (Project Dashboard v1).
 *
 * @param {object} volet RightPane ou BottomPane
 * @returns {object} onglet
 */
function creerOnglet(volet) {
    try {
        return volet.AddTab("mon-onglet", "Mon onglet", "_last");
    } catch (e) {
        return volet.AddTab("mon-onglet", "Mon onglet", "_home");
    }
}

/**
 * Genre du cadre, pour le journal.
 *
 * @param {object} shellFrame cadre du client
 * @returns {string} mention
 */
function genreDuCadre(shellFrame) {
    try {
        return shellFrame.ShellFrameType === undefined ? "" : " (type " + shellFrame.ShellFrameType + ")";
    } catch (e) {
        return "";
    }
}

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
