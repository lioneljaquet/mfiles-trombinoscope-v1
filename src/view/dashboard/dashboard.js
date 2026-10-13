/* exported OnNewDashboard */
/* =====================================================================
   PAGE DU DASHBOARD — UIX v1 (ES5)

   En v1 la page tient son coffre (dashboard.Vault) et agit directement.
   Elle ne règle JAMAIS la visibilité de dashboard.Parent (le volet
   entier). Toute donnée injectée passe par escapeHtml.
   ===================================================================== */

var page = { vault: null, cadre: null, donnees: {} };

/**
 * Point d'entrée appelé par le client. Coffre et cadre d'abord, données
 * ensuite : dans l'autre ordre, la page démarrait sans coffre.
 *
 * @param {object} dashboard dashboard créé par le client
 * @returns {void}
 */
function OnNewDashboard(dashboard) {
    try {
        page.vault = dashboard.Vault;
    } catch (e) {
        statut("Coffre inaccessible : " + (e.message || e));
    }

    try {
        page.donnees = dashboard.CustomData || {};

        if (typeof page.donnees === "string") {
            page.donnees = JSON.parse(page.donnees);
        }
    } catch (e) {
        page.donnees = {};
    }

    page.cadre = cadreDuDashboard(dashboard, page.donnees);
    document.getElementById("version").innerHTML = escapeHtml(VERSION_PAQUET);
    document.getElementById("btnFermer").onclick = function () {
        try {
            page.cadre.ShowDefaultContent();
        } catch (e) {
            statut("Retour impossible : " + (e.message || e));
        }
    };

    rendre();
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

    for (i = 0; i < voies.length; i += 1) {
        try {
            var candidat = voies[i]();

            // Lecture d'une propriété : lève si ce n'est pas un cadre.
            if (candidat && typeof candidat.CurrentPath !== "undefined") {
                return candidat;
            }
        } catch (e) {
            // Candidat suivant.
        }
    }

    statut("Cadre du client introuvable : navigation indisponible.");
    return null;
}

/**
 * Rendu du contenu. À remplacer par la vue de l'application.
 *
 * @returns {void}
 */
function rendre() {
    document.getElementById("contenu").innerHTML = "<p>Prêt" +
        (page.vault ? "" : " (hors M-Files)") + ".</p>";
}

/**
 * Message dans la barre d'état.
 *
 * @param {string} message texte
 * @returns {void}
 */
function statut(message) {
    var zone = document.getElementById("statut");

    if (zone) {
        zone.innerHTML = escapeHtml(message);
    }
}

/**
 * Échappe une valeur avant insertion dans le DOM.
 *
 * @param {*} valeur valeur
 * @returns {string} valeur échappée
 */
function escapeHtml(valeur) {
    if (valeur === null || valeur === undefined) {
        return "";
    }

    return String(valeur).replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
