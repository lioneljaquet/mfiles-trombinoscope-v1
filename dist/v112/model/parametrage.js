/* exported PARAMETRAGE, MF, VERSION_PAQUET, PREFIXE_JOURNAL */
/* =====================================================================
   PARAM\u00c9TRAGE \u2014 seul fichier d\u00e9pendant du coffre tebifiles (ES5)

   Charg\u00e9 par le module et int\u00e9gr\u00e9 dans la page \u00e0 la construction.
   Les identifiants sont ceux des adaptateurs du Cockpit PRO, en service
   sur le coffre r\u00e9el (cockpit_pro/model/adapters/mfiles_staff.py et
   mfiles_org.py). Les constantes MF* ne sont pas garanties dans un
   dashboard : leurs valeurs num\u00e9riques sont fix\u00e9es ici.

   CONFIDENTIALIT\u00c9 (docs/adr/0001) : la fiche Collaborateur porte des
   donn\u00e9es RH (mobile, adresse, naissance, salaire, dossiers). Seules les
   propri\u00e9t\u00e9s list\u00e9es dans `proprietes` sont lues ; ajouter un champ
   commence par une d\u00e9cision, puis par une ligne ici. Le mobile
   professionnel (2823) n'est volontairement pas repris.
   ===================================================================== */

var VERSION_PAQUET = "1.1.2 (UIX v1)";
var PREFIXE_JOURNAL = "[trombinoscope]";

var MF = {
    DT_TEXT: 1, DT_INTEGER: 2, DT_REAL: 3, DT_DATE: 5, DT_TIMESTAMP: 7,
    DT_BOOLEAN: 8, DT_LOOKUP: 9, DT_MULTI_LOOKUP: 10, DT_MULTI_LINE_TEXT: 13,
    EGAL: 1, DIFFERENT: 2,
    STATUS_DELETED: 5, STATUS_OBJECT_TYPE_ID: 6,
    PARENT_CHILD_NONE: 0, SEARCH_FLAG_NONE: 0,
    TYPE_GROUPE: 2                 // MFUserOrUserGroupTypeUserGroup
};

var PARAMETRAGE = {
    dashboard: "trombinoscope",
    commande: "Trombinoscope",

    // Groupe d'utilisateurs M-Files auquel l'application est r\u00e9serv\u00e9e,
    // d\u00e9sign\u00e9 par son ALIAS (pos\u00e9 dans M-Files Admin) et r\u00e9solu \u00e0
    // l'ex\u00e9cution : qui a acc\u00e8s se r\u00e8gle dans le coffre, sans reconstruire.
    // Groupes imbriqu\u00e9s compris. Alias bien form\u00e9 exig\u00e9 par build.js.
    groupeAutorise: "tebifiles.group.trombinoscope",

    // Types d'objets (alias tebifiles.ot.collaborateur pour 104)
    typeCollaborateur: 104,
    typeCercle: 362,

    // \u00c9tapes du workflow Collaborateur montr\u00e9es par l'annuaire. Les
    // collaborateurs des autres \u00e9tapes ne sont ni cherch\u00e9s ni lus, et ne
    // sont mentionn\u00e9s nulle part (pas m\u00eame comme responsable).
    etapes: [
        { id: 319, nom: "En fonction", partant: false },
        { id: 1475, nom: "Offboarding d\u00e9mission", partant: true },
        { id: 1478, nom: "Offboarding licenciement", partant: true }
    ],

    // Liste blanche de la fiche Collaborateur : rien d'autre n'est lu.
    proprietes: {
        etape: 39,                 // Etape (\u00e9tat du workflow), filtre de la recherche
        prenom: 1387,              // Pr\u00e9nom
        nom: 1386,                 // Nom de famille
        initiales: 1079,           // Initiales (le trigramme)
        titre: 2376,               // Titre
        titreManuel: 4259,         // Titre (manuel)
        fonctionPrincipale: 3638,  // /Titre (fonction principale)
        fonctions: 3641,           // >Fonctions (plusieurs)
        succursale: 2414,          // >Succursale (pas sa variante confidentielle 2824)
        cercle: 2929,              // >Cercle/r\u00f4le principal
        cerclesAuto: 2928,         // ~Cercles/r\u00f4les auto (plusieurs)
        responsable: 1217,         // >Responsable hi\u00e9rarchique
        email: 2821                // Email prof.
    },

    // Portraits : documents (type 0) de la classe \u00ab !! Photo collaborateur \u00bb
    // (88), li\u00e9s au collaborateur par >Collaborateur (1077). Seuls ces deux
    // crit\u00e8res sont lus, plus les fichiers du document (GetFiles).
    typeDocument: 0,
    classePhoto: 88,
    proprietesPhoto: {
        classe: 100,               // Classe (propri\u00e9t\u00e9 int\u00e9gr\u00e9e)
        collaborateur: 1077        // >Collaborateur
    },
    portrait: {
        // Pas de plafond de taille (demande de Lionel, 1.1.1).
        // Formats que le contr\u00f4le web IE11 affiche ; PDF, JPEG 2000, WebP,
        // HEIC\u2026 restent \u00e0 l'avatar.
        formats: { jpg: "JPEG", jpeg: "JPEG", png: "PNG", gif: "GIF", bmp: "BMP" },
        // Entr\u00e9es gard\u00e9es en m\u00e9moire par cadre avant de vider le cache
        cacheMax: 40
    },

    // Liste blanche de l'objet Cercle/r\u00f4le : le titre vient du r\u00e9sultat
    // de recherche, seule la relation de contenu est lue.
    proprietesCercle: {
        membresCercles: 2926       // >Membres (cercles) : ce que l'objet contient
    },

    // Organisation : l'arbre sous le cercle \u00ab tebicom SA \u00bb ; \u00ab CA \u00bb
    // n'est rattach\u00e9 qu'\u00e0 un groupe d'autorisations et se place sous
    // l'ancre (ADR 0003 et 0010 du Cockpit PRO).
    ancre: "tebicom SA",
    cerclesRacines: ["CA"],

    limiteRecherche: 500,
    delaiRecherche: 30,
    tailleLot: 20
};
