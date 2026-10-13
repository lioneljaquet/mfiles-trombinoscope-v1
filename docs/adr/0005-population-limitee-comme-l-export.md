# 0005 — Population limitée comme l'export du Cockpit : rattachés à un cercle, sans étape

Date : 2026-10-13. Statut : accepté (version 1.0.2), demande de Lionel : « limite le filtre également comme pour
l'export dans le cockpit ». Reprise des règles de `cockpit_pro/model/export_filter.py` (ADR 0013 du Cockpit, avec 0002
et 0005).

## Règles (`regles.construireAnnuaire`, testées)

- **Inclusion** : étape listée (En fonction, Offboarding démission, Offboarding licenciement, critère de la recherche
  dans le coffre) **et** au moins un cercle de l'organisation (~Cercles/rôles auto ou cercle principal, au sens du
  filtre « Cercle »). Les autres ne sont nulle part : ni carte, ni liste, ni recherche, ni effectif, ni responsable, ni
  membre d'une équipe.
- **Étape** : ni clé de la personne, ni indicateur de départ, ni filtre, ni tri, ni état. Les personnes en
  offboarding restent et ne se distinguent plus. L'étape n'est lue que pour l'inclusion.
- **Responsable exclu** : remplacé par le premier responsable retenu au-dessus de lui (à défaut, la personne est une
  racine) ; équipes et tailles recalculées.
- **Filtres** : cercle, succursale, titre, fonction, effectifs contextuels sur la population limitée. « Sans cercle »
  disparaît de lui-même.
- **Bandeau** : « Données internes : collaborateurs rattachés à un cercle (N personnes). », la mention de l'export.

## Conséquences

- Sur le coffre réel, le Cockpit écartait 2 fiches sans cercle le 07.10.2026 (deux fiches dont le trigramme est un
  prénom) : 94 personnes attendues sur 96, à confirmer à l'essai.
- Les fiches sans cercle sont lues (liste blanche) puis écartées en mémoire, comme dans le Cockpit : leur
  rattachement ne se connaît qu'après lecture de la fiche.
