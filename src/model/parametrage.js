/* exported PARAMETRAGE, MF, VERSION_PAQUET, PREFIXE_JOURNAL */
/* =====================================================================
   PARAMÉTRAGE — seul fichier dépendant du coffre (ES5)

   Chargé par le module et intégré dans chaque page à la construction.
   Les constantes MF* ne sont pas garanties dans un dashboard : leurs
   valeurs numériques sont fixées ici.
   ===================================================================== */

var VERSION_PAQUET = "1.0.0 (UIX v1)";
var PREFIXE_JOURNAL = "[mon-app]";

var MF = {
    DT_TEXT: 1, DT_INTEGER: 2, DT_REAL: 3, DT_DATE: 5, DT_TIMESTAMP: 7,
    DT_BOOLEAN: 8, DT_LOOKUP: 9, DT_MULTI_LOOKUP: 10, DT_MULTI_LINE_TEXT: 13,
    EGAL: 1, DIFFERENT: 2, SUPERIEUR_OU_EGAL: 5, INFERIEUR_OU_EGAL: 6,
    STATUS_DELETED: 5, STATUS_OBJECT_TYPE_ID: 6,
    PARENT_CHILD_NONE: 0, SEARCH_FLAG_NONE: 0,
    PROPRIETE_CLASSE: 100
};

var PARAMETRAGE = {
    alias: {
        typeObjet: "tebifiles.ot.monType",
        proprietes: { statut: "tebifiles.prop.own.statut" }
    },
    dashboard: "mon-dashboard",
    limiteRecherche: 500,
    tailleLot: 50
};
