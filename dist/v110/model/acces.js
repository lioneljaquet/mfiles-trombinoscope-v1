/* exported acces */
/* =====================================================================
   ACCÈS — réservation de l'application à un groupe d'utilisateurs (ES5)

   Couche model. Chargé par le module (la commande n'est posée qu'aux
   membres) et intégré dans la page (qui refuse d'afficher l'annuaire aux
   autres) : défense en profondeur.

   Source : référence de l'API COM M-Files, Vault.SessionInfo →
   SessionInfo.UserAndGroupMemberships (UserOrUserGroupIDs : « the user ID
   of this session's account, as well as the groups to which the user
   belongs either directly or indirectly ») →
   GetUserOrUserGroupIDIndex(ID, MFUserOrUserGroupTypeUserGroup = 2),
   -1 si absent. Le serveur résout les groupes imbriqués.

   ÉCHEC FERMÉ : toute lecture impossible, tout groupe mal paramétré vaut
   un refus.
   ===================================================================== */

var acces = (function () {
    "use strict";

    /**
     * Vérifie que l'utilisateur de la session est membre du groupe
     * autorisé (PARAMETRAGE.groupeAutorise), directement ou non.
     *
     * @param {object|null} vault coffre COM de la session
     * @returns {object} { autorise: booléen, raison: texte pour le journal }
     */
    function verifier(vault) {
        var groupe = PARAMETRAGE.groupeAutorise;
        var index;

        if (typeof groupe !== "number" || groupe <= 0 || groupe % 1 !== 0) {
            return { autorise: false, raison: "groupe autorisé non paramétré" };
        }
        try {
            index = vault.SessionInfo.UserAndGroupMemberships.GetUserOrUserGroupIDIndex(groupe, MF.TYPE_GROUPE);
        } catch (e) {
            return { autorise: false, raison: "appartenance illisible : " + ((e && (e.message || e.description)) || e) };
        }
        if (typeof index === "number" && index !== -1) {
            return { autorise: true, raison: "membre du groupe " + groupe };
        }
        return { autorise: false, raison: "l'utilisateur n'est pas membre du groupe " + groupe };
    }

    return { verifier: verifier };
}());
