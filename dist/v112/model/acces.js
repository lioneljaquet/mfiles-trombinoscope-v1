/* exported acces */
/* =====================================================================
   ACC\u00c8S \u2014 r\u00e9servation de l'application \u00e0 un groupe d'utilisateurs (ES5)

   Couche model. Charg\u00e9 par le module (commande et onglet ne sont pos\u00e9s
   qu'aux membres) et int\u00e9gr\u00e9 dans la page (qui refuse d'afficher quoi que
   ce soit aux autres) : d\u00e9fense en profondeur.

   Le groupe est d\u00e9sign\u00e9 par son ALIAS (PARAMETRAGE.groupeAutorise), r\u00e9gl\u00e9
   dans M-Files Admin : on change qui a acc\u00e8s sans reconstruire le paquet.

   Sources, r\u00e9f\u00e9rence de l'API COM M-Files :
   - Vault.UserGroupOperations.GetUserGroupIDByAlias(Alias As String) As
     Long : \u00ab Returns -1 if a match is not found or if more than one user
     group uses the specified alias \u00bb ;
   - Vault.SessionInfo.UserAndGroupMemberships (UserOrUserGroupIDs : \u00ab the
     user ID of this session's account, as well as the groups to which the
     user belongs either directly or indirectly \u00bb) \u2192
     GetUserOrUserGroupIDIndex(ID, MFUserOrUserGroupTypeUserGroup = 2),
     -1 si absent. Le serveur r\u00e9sout les groupes imbriqu\u00e9s.

   \u00c9CHEC FERM\u00c9 : alias inconnu, ambigu ou illisible, appartenance
   illisible, param\u00e9trage invalide : refus.
   ===================================================================== */

var acces = (function () {
    "use strict";

    // Alias d'un groupe : segments s\u00e9par\u00e9s par des points (ex. tebifiles.group.trombinoscope)
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
     * ID du groupe d\u00e9sign\u00e9 par l'alias. 0 ou moins : introuvable (le skill
     * v1 traite 0 comme -1).
     *
     * @param {object} vault coffre COM
     * @param {string} alias alias du groupe
     * @returns {object} { id } ou { raison } si introuvable
     */
    function resoudre(vault, alias) {
        var introuvable = "groupe d'acc\u00e8s introuvable : alias " + alias;
        var id;

        try {
            id = vault.UserGroupOperations.GetUserGroupIDByAlias(alias);
        } catch (e) {
            return { raison: introuvable + " (r\u00e9solution impossible : " + messageDe(e) + ")" };
        }
        return typeof id === "number" && id > 0 ? { id: id } : { raison: introuvable };
    }

    /**
     * V\u00e9rifie que l'utilisateur de la session est membre du groupe
     * d\u00e9sign\u00e9 par PARAMETRAGE.groupeAutorise, directement ou non.
     *
     * @param {object|null} vault coffre COM de la session
     * @returns {object} { autorise: bool\u00e9en, raison: texte pour le journal }
     */
    function verifier(vault) {
        var alias = PARAMETRAGE.groupeAutorise;
        var groupe;
        var index;

        if (typeof alias !== "string" || !MOTIF_ALIAS.test(alias)) {
            return { autorise: false, raison: "groupe d'acc\u00e8s non param\u00e9tr\u00e9" };
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
