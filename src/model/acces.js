/* exported acces */
/* =====================================================================
   ACCÈS — réservation de l'application à un groupe d'utilisateurs (ES5)

   Couche model. Chargé par le module (commande et onglet ne sont posés
   qu'aux membres) et intégré dans la page (qui refuse d'afficher quoi que
   ce soit aux autres) : défense en profondeur.

   Le groupe est désigné par son ALIAS (PARAMETRAGE.groupeAutorise), réglé
   dans M-Files Admin : on change qui a accès sans reconstruire le paquet.

   Sources, référence de l'API COM M-Files :
   - Vault.UserGroupOperations.GetUserGroupIDByAlias(Alias As String) As
     Long : « Returns -1 if a match is not found or if more than one user
     group uses the specified alias » ;
   - Vault.SessionInfo.UserAndGroupMemberships (UserOrUserGroupIDs : « the
     user ID of this session's account, as well as the groups to which the
     user belongs either directly or indirectly ») →
     GetUserOrUserGroupIDIndex(ID, MFUserOrUserGroupTypeUserGroup = 2),
     -1 si absent. Le serveur résout les groupes imbriqués.

   ÉCHEC FERMÉ : alias inconnu, ambigu ou illisible, appartenance
   illisible, paramétrage invalide : refus.
   ===================================================================== */

var acces = (function () {
    "use strict";

    // Alias d'un groupe : segments séparés par des points (ex. tebifiles.group.trombinoscope)
    var MOTIF_ALIAS = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_-]+)+$/;

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
     * ID du groupe désigné par l'alias. 0 ou moins : introuvable (le skill
     * v1 traite 0 comme -1).
     *
     * @param {object} vault coffre COM
     * @param {string} alias alias du groupe
     * @returns {object} { id } ou { raison } si introuvable
     */
    function resoudre(vault, alias) {
        var introuvable = "groupe d'accès introuvable : alias " + alias;
        var id;

        try {
            id = vault.UserGroupOperations.GetUserGroupIDByAlias(alias);
        } catch (e) {
            return { raison: introuvable + " (résolution impossible : " + messageDe(e) + ")" };
        }
        return typeof id === "number" && id > 0 ? { id: id } : { raison: introuvable };
    }

    /**
     * Vérifie que l'utilisateur de la session est membre du groupe
     * désigné par PARAMETRAGE.groupeAutorise, directement ou non.
     *
     * @param {object|null} vault coffre COM de la session
     * @returns {object} { autorise: booléen, raison: texte pour le journal }
     */
    function verifier(vault) {
        var alias = PARAMETRAGE.groupeAutorise;
        var groupe;
        var index;

        if (typeof alias !== "string" || !MOTIF_ALIAS.test(alias)) {
            return { autorise: false, raison: "groupe d'accès non paramétré" };
        }
        if (!vault) {
            return { autorise: false, raison: "coffre illisible" };
        }
        groupe = resoudre(vault, alias);
        if (!groupe.id) {
            return { autorise: false, raison: groupe.raison };
        }
        try {
            index = vault.SessionInfo.UserAndGroupMemberships.GetUserOrUserGroupIDIndex(groupe.id, MF.TYPE_GROUPE);
        } catch (e) {
            return { autorise: false, raison: "appartenance illisible : " + messageDe(e) };
        }
        if (typeof index === "number" && index !== -1) {
            return { autorise: true, raison: "membre du groupe " + alias + " (ID " + groupe.id + ")" };
        }
        return { autorise: false, raison: "l'utilisateur n'est pas membre du groupe " + alias + " (ID " + groupe.id + ")" };
    }

    return { verifier: verifier, MOTIF_ALIAS: MOTIF_ALIAS };
}());
