/* exported OnNewShellUI */
/* =====================================================================
   MODULE SHELLUI — UIX v1, client classique (ES5, synchrone)

   Pose la commande « Trombinoscope » dans le volet des tâches de chaque
   cadre ; un clic affiche le tableau de bord dans la zone de listage
   (ShowDashboard). La page lit elle-même le coffre (dashboard.Vault) :
   le module ne transmet que son cadre et la version.

   Un état PAR cadre : le client ouvre plusieurs cadres (fenêtres, boîtes
   de dialogue) et un état global faisait réagir chacun au clic d'un
   autre. Dépend de model/parametrage.js, chargé avant lui.
   ===================================================================== */

/**
 * Point d'entrée appelé par le framework.
 *
 * Event_NewShellFrame plutôt que Event_NewNormalShellFrame : les boîtes
 * de dialogue (« Enregistrer sous ») sont aussi des cadres, sans volet
 * des tâches.
 *
 * @param {object} shellUI interface ShellUI
 * @returns {void}
 */
function OnNewShellUI(shellUI) {
    shellUI.Events.Register(Event_NewShellFrame, function (shellFrame) {
        var etat = { commande: null };

        shellFrame.Events.Register(Event_Started, function () {
            journal("version " + VERSION_PAQUET + " — nouveau cadre" + genreDuCadre(shellFrame));
            creerCommande(shellFrame, etat);
        });
    });
}

/**
 * Crée la commande, son gestionnaire, puis la place dans le volet des
 * tâches. Le gestionnaire est enregistré avant le placement : un
 * placement qui lève ne doit pas l'emporter.
 *
 * @param {object} shellFrame cadre du client
 * @param {object} etat état de ce cadre
 * @returns {void}
 */
function creerCommande(shellFrame, etat) {
    try {
        etat.commande = shellFrame.Commands.CreateCustomCommand(PARAMETRAGE.commande);

        shellFrame.Commands.Events.Register(Event_CustomCommand, function (id) {
            // Seule la commande DE CE CADRE déclenche l'affichage.
            if (id === etat.commande) {
                afficher(shellFrame);
            }
        });
    } catch (e) {
        journal("commande non créée : " + messageDe(e));
        return;
    }

    // Un cadre de dialogue n'a pas de volet des tâches : rien à placer.
    try {
        if (shellFrame.TaskPane) {
            shellFrame.TaskPane.AddCustomCommandToGroup(etat.commande, TaskPaneGroup_Main, 1);
        }
    } catch (e) {
        journal("commande non placée : " + messageDe(e));
    }

    try {
        shellFrame.Commands.SetIconFromPath(etat.commande, "v101/icones/app.ico");
    } catch (e) {
        journal("icône non posée : " + messageDe(e));
    }
}

/**
 * Affiche le tableau de bord dans la zone de listage. Le cadre voyage
 * dans les données : c'est la voie la plus sûre pour que la page
 * l'atteigne (retour au listage, sélection virtuelle).
 *
 * @param {object} shellFrame cadre du client
 * @returns {void}
 */
function afficher(shellFrame) {
    try {
        shellFrame.ShowDashboard(PARAMETRAGE.dashboard, { cadre: shellFrame, version: VERSION_PAQUET });
    } catch (e) {
        journal("affichage impossible : " + messageDe(e));
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
