/* exported OnNewShellUI */
/* =====================================================================
   MODULE SHELLUI \u2014 UIX v1, client classique (ES5, synchrone)

   Pose la commande \u00ab Trombinoscope \u00bb dans le volet des t\u00e2ches de chaque
   cadre, aux SEULS membres du groupe autoris\u00e9 (model/acces.js, \u00e9chec
   ferm\u00e9) ; un clic affiche le tableau de bord dans la zone de listage
   (ShowDashboard). La page lit elle-m\u00eame le coffre (dashboard.Vault) :
   le module ne transmet que son cadre, son \u00e9tat et la version. Pour les
   m\u00eames membres, il pose aussi l'onglet \u00ab Trombinoscope \u00bb du volet de
   droite (presenter/onglet.js).

   Un \u00e9tat PAR cadre : le client ouvre plusieurs cadres (fen\u00eatres, bo\u00eetes
   de dialogue) et un \u00e9tat global faisait r\u00e9agir chacun au clic d'un
   autre. D\u00e9pend de model/compat.js, parametrage.js, acces.js, regles.js,
   vault-com.js, portraits.js et presenter/onglet.js, charg\u00e9s avant lui
   (appdef.xml).
   ===================================================================== */

/**
 * Point d'entr\u00e9e appel\u00e9 par le framework.
 *
 * Event_NewShellFrame plut\u00f4t que Event_NewNormalShellFrame : les bo\u00eetes
 * de dialogue (\u00ab Enregistrer sous \u00bb) sont aussi des cadres, sans volet
 * des t\u00e2ches.
 *
 * @param {object} shellUI interface ShellUI
 * @returns {void}
 */
function OnNewShellUI(shellUI) {
    // Partag\u00e9 par les cadres de ce ShellUI : l'annuaire lu pour l'onglet
    var session = { annuaire: null, luA: 0 };

    shellUI.Events.Register(Event_NewShellFrame, function (shellFrame) {
        var etat = { commande: null };

        shellFrame.Events.Register(Event_Started, function () {
            var verdict = acces.verifier(coffreDe(shellUI));

            journal("version " + VERSION_PAQUET + " \u2014 nouveau cadre" + genreDuCadre(shellFrame));
            // \u00c9chec ferm\u00e9 : sans appartenance \u00e9tablie au groupe, pas de commande
            if (!verdict.autorise) {
                journal("commande non ajout\u00e9e : " + verdict.raison);
                return;
            }
            journal("acc\u00e8s accord\u00e9 : " + verdict.raison);
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
 * Cr\u00e9e la commande, son gestionnaire, puis la place dans le volet des
 * t\u00e2ches. Le gestionnaire est enregistr\u00e9 avant le placement : un
 * placement qui l\u00e8ve ne doit pas l'emporter.
 *
 * @param {object} shellFrame cadre du client
 * @param {object} etat \u00e9tat de ce cadre
 * @returns {void}
 */
function creerCommande(shellFrame, etat) {
    try {
        etat.commande = shellFrame.Commands.CreateCustomCommand(PARAMETRAGE.commande);

        shellFrame.Commands.Events.Register(Event_CustomCommand, function (id) {
            // Seule la commande DE CE CADRE d\u00e9clenche l'affichage.
            if (id === etat.commande) {
                afficher(shellFrame, etat);
            }
        });
    } catch (e) {
        journal("commande non cr\u00e9\u00e9e : " + messageDe(e));
        return;
    }

    // Un cadre de dialogue n'a pas de volet des t\u00e2ches : rien \u00e0 placer.
    try {
        if (shellFrame.TaskPane) {
            shellFrame.TaskPane.AddCustomCommandToGroup(etat.commande, TaskPaneGroup_Main, 1);
        }
    } catch (e) {
        journal("commande non plac\u00e9e : " + messageDe(e));
    }

    try {
        shellFrame.Commands.SetIconFromPath(etat.commande, "v112/icones/app.ico");
    } catch (e) {
        journal("ic\u00f4ne non pos\u00e9e : " + messageDe(e));
    }
}

/**
 * Affiche le tableau de bord dans la zone de listage. Le cadre voyage
 * dans les donn\u00e9es : c'est la voie la plus s\u00fbre pour que la page
 * l'atteigne (retour au listage, s\u00e9lection virtuelle). L'\u00e9tat du cadre
 * aussi : la page y signale une s\u00e9lection virtuelle, pour que l'onglet ne
 * prenne pas la place de la fiche M-Files demand\u00e9e.
 *
 * @param {object} shellFrame cadre du client
 * @param {object} etat \u00e9tat de ce cadre
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
