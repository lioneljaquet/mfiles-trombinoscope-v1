/* exported OnNewShellUI */
/* =====================================================================
   MODULE SHELLUI — UIX v1, client classique (ES5, synchrone)

   Pose la commande « Trombinoscope » dans le volet des tâches de chaque
   cadre, aux SEULS membres du groupe autorisé (model/acces.js, échec
   fermé) ; un clic affiche le tableau de bord dans la zone de listage
   (ShowDashboard). La page lit elle-même le coffre (dashboard.Vault) :
   le module ne transmet que son cadre, son état et la version. Pour les
   mêmes membres, il pose aussi l'onglet « Trombinoscope » du volet de
   droite (presenter/onglet.js).

   Un état PAR cadre : le client ouvre plusieurs cadres (fenêtres, boîtes
   de dialogue) et un état global faisait réagir chacun au clic d'un
   autre. Dépend de model/compat.js, parametrage.js, acces.js, regles.js,
   vault-com.js, portraits.js et presenter/onglet.js, chargés avant lui
   (appdef.xml).
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
    // Partagé par les cadres de ce ShellUI : l'annuaire lu pour l'onglet
    var session = { annuaire: null, luA: 0 };

    shellUI.Events.Register(Event_NewShellFrame, function (shellFrame) {
        var etat = { commande: null };

        shellFrame.Events.Register(Event_Started, function () {
            var verdict = acces.verifier(coffreDe(shellUI));

            journal("version " + VERSION_PAQUET + " — nouveau cadre" + genreDuCadre(shellFrame));
            // Échec fermé : sans appartenance établie au groupe, pas de commande
            if (!verdict.autorise) {
                journal("commande non ajoutée : " + verdict.raison);
                return;
            }
            journal("accès accordé : " + verdict.raison);
            creerCommande(shellFrame, etat);
            onglet.suivre(shellFrame, etat, session, coffreDe(shellUI));
        });
    });
}

/**
 * Coffre de la session, ou null s'il est illisible.
 *
 * @param {object} shellUI interface ShellUI
 * @returns {object|null} coffre COM
 */
function coffreDe(shellUI) {
    try {
        return shellUI.Vault || null;
    } catch (e) {
        return null;
    }
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
                afficher(shellFrame, etat);
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
        shellFrame.Commands.SetIconFromPath(etat.commande, "{DOSSIER}/icones/app.ico");
    } catch (e) {
        journal("icône non posée : " + messageDe(e));
    }
}

/**
 * Affiche le tableau de bord dans la zone de listage. Le cadre voyage
 * dans les données : c'est la voie la plus sûre pour que la page
 * l'atteigne (retour au listage, sélection virtuelle). L'état du cadre
 * aussi : la page y signale une sélection virtuelle, pour que l'onglet ne
 * prenne pas la place de la fiche M-Files demandée.
 *
 * @param {object} shellFrame cadre du client
 * @param {object} etat état de ce cadre
 * @returns {void}
 */
function afficher(shellFrame, etat) {
    try {
        shellFrame.ShowDashboard(PARAMETRAGE.dashboard, { cadre: shellFrame, version: VERSION_PAQUET, etatCadre: etat });
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
