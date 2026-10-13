/* exported PARAMETRAGE, MF, VERSION_PAQUET, PREFIXE_JOURNAL */
/* =====================================================================
   PARAMÉTRAGE — seul fichier dépendant du coffre tebifiles (ES5)

   Chargé par le module et intégré dans la page à la construction.
   Les identifiants sont ceux des adaptateurs du Cockpit PRO, en service
   sur le coffre réel (cockpit_pro/model/adapters/mfiles_staff.py et
   mfiles_org.py). Les constantes MF* ne sont pas garanties dans un
   dashboard : leurs valeurs numériques sont fixées ici.

   CONFIDENTIALITÉ (docs/adr/0001) : la fiche Collaborateur porte des
   données RH (mobile, adresse, naissance, salaire, dossiers). Seules les
   propriétés listées dans `proprietes` sont lues ; ajouter un champ
   commence par une décision, puis par une ligne ici. Le mobile
   professionnel (2823) n'est volontairement pas repris.
   ===================================================================== */

var VERSION_PAQUET = "1.1.0 (UIX v1)";
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

    // Groupe d'utilisateurs M-Files auquel l'application est réservée :
    // « SI - membres primaires » (liste de valeurs 16), groupes imbriqués
    // compris. Entier positif exigé à la construction (build.js).
    groupeAutorise: 3524,

    // Types d'objets (alias tebifiles.ot.collaborateur pour 104)
    typeCollaborateur: 104,
    typeCercle: 362,

    // Étapes du workflow Collaborateur montrées par l'annuaire. Les
    // collaborateurs des autres étapes ne sont ni cherchés ni lus, et ne
    // sont mentionnés nulle part (pas même comme responsable).
    etapes: [
        { id: 319, nom: "En fonction", partant: false },
        { id: 1475, nom: "Offboarding démission", partant: true },
        { id: 1478, nom: "Offboarding licenciement", partant: true }
    ],

    // Liste blanche de la fiche Collaborateur : rien d'autre n'est lu.
    proprietes: {
        etape: 39,                 // Etape (état du workflow), filtre de la recherche
        prenom: 1387,              // Prénom
        nom: 1386,                 // Nom de famille
        initiales: 1079,           // Initiales (le trigramme)
        titre: 2376,               // Titre
        titreManuel: 4259,         // Titre (manuel)
        fonctionPrincipale: 3638,  // /Titre (fonction principale)
        fonctions: 3641,           // >Fonctions (plusieurs)
        succursale: 2414,          // >Succursale (pas sa variante confidentielle 2824)
        cercle: 2929,              // >Cercle/rôle principal
        cerclesAuto: 2928,         // ~Cercles/rôles auto (plusieurs)
        responsable: 1217,         // >Responsable hiérarchique
        email: 2821                // Email prof.
    },

    // Portraits : documents (type 0) de la classe « !! Photo collaborateur »
    // (88), liés au collaborateur par >Collaborateur (1077). Seuls ces deux
    // critères sont lus, plus les fichiers du document (GetFiles).
    typeDocument: 0,
    classePhoto: 88,
    proprietesPhoto: {
        classe: 100,               // Classe (propriété intégrée)
        collaborateur: 1077        // >Collaborateur
    },
    portrait: {
        // Plafond par fichier : 4 Mo (une photo de portrait, pas un scan) ;
        // au-delà, rien n'est téléchargé et l'avatar reste.
        tailleMax: 4 * 1024 * 1024,
        // Formats que le contrôle web IE11 affiche ; PDF, JPEG 2000, WebP,
        // HEIC… restent à l'avatar.
        formats: { jpg: "JPEG", jpeg: "JPEG", png: "PNG", gif: "GIF", bmp: "BMP" },
        // Entrées gardées en mémoire par cadre avant de vider le cache
        cacheMax: 40
    },

    // Liste blanche de l'objet Cercle/rôle : le titre vient du résultat
    // de recherche, seule la relation de contenu est lue.
    proprietesCercle: {
        membresCercles: 2926       // >Membres (cercles) : ce que l'objet contient
    },

    // Organisation : l'arbre sous le cercle « tebicom SA » ; « CA »
    // n'est rattaché qu'à un groupe d'autorisations et se place sous
    // l'ancre (ADR 0003 et 0010 du Cockpit PRO).
    ancre: "tebicom SA",
    cerclesRacines: ["CA"],

    limiteRecherche: 500,
    delaiRecherche: 30,
    tailleLot: 20
};
