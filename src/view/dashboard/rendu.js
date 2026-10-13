/* exported rendu */
/* =====================================================================
   RENDU DE LA PAGE — couche view (ES5, contrôle web IE11)

   Vue pure : elle reçoit du présentateur un modèle prêt (personnes déjà
   filtrées et triées, effectifs, fiche) et construit le DOM avec
   createElement et textContent seulement : un nom ou un titre venu de
   M-Files ne peut pas injecter de HTML. Les éléments portent des
   attributs data-* que des écouteurs délégués traduisent en actions.
   Aucune règle métier ici, aucun accès au coffre.
   ===================================================================== */

var rendu = (function () {
    "use strict";

    // Délai de saisie avant de relancer la recherche (ms)
    var DELAI_RECHERCHE = 120;
    // Durée d'affichage d'un message (ms)
    var DUREE_MESSAGE = 5000;
    // Seule image acceptée pour un portrait : une URI data: d'un type affichable
    var MOTIF_PHOTO = /^data:image\/(jpeg|png|gif|bmp);base64,[A-Za-z0-9+\/=\r\n]+$/;

    /**
     * Crée la vue d'une page.
     *
     * @param {object} doc document de la page
     * @param {object} actions actions du présentateur
     * @param {string} [mode] « onglet » pour l'onglet du volet de droite
     * @returns {object} { progression, erreur, refuser, rendre, rendreOnglet, message }
     */
    function creer(doc, actions, mode) {
        var $ = function (id) { return doc.getElementById(id); };
        var minuterieRecherche = null;
        var minuterieMessage = null;
        var derniereSaisie = "";
        var ficheAffichee = null;
        var ficheOuverte = false;

        /**
         * Crée un élément.
         *
         * @param {string} balise nom de la balise
         * @param {object} [options] { classe, texte, attrs }
         * @param {Array} [enfants] nœuds ou textes (null ignorés)
         * @returns {object} élément
         */
        function el(balise, options, enfants) {
            var e = doc.createElement(balise);
            var o = options || {};
            var nom;

            if (o.classe) {
                e.className = o.classe;
            }
            if (o.texte !== undefined && o.texte !== null) {
                e.appendChild(doc.createTextNode(String(o.texte)));
            }
            if (o.attrs) {
                for (nom in o.attrs) {
                    if (o.attrs.hasOwnProperty(nom) && o.attrs[nom] !== null && o.attrs[nom] !== undefined) {
                        e.setAttribute(nom, String(o.attrs[nom]));
                    }
                }
            }
            (enfants || []).forEach(function (enfant) {
                if (enfant === null || enfant === undefined) {
                    return;
                }
                e.appendChild(typeof enfant === "string" ? doc.createTextNode(enfant) : enfant);
            });
            return e;
        }

        /**
         * Vide un élément.
         *
         * @param {object} e élément
         * @returns {void}
         */
        function vider(e) {
            while (e.firstChild) {
                e.removeChild(e.firstChild);
            }
        }

        /**
         * Ajoute ou retire une classe (IE11 : classList partiel, on passe
         * par className).
         *
         * @param {object} e élément
         * @param {string} classe classe
         * @param {boolean} presente vrai pour l'ajouter
         * @returns {void}
         */
        function basculer(e, classe, presente) {
            var classes = (" " + e.className + " ").replace(" " + classe + " ", " ");
            e.className = (classes + (presente ? classe : "")).replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
        }

        /**
         * Avatar à trigramme, teinté par la personne.
         *
         * @param {object} p personne (trigramme, teinte)
         * @param {string} [taille] « petit » ou « grand »
         * @returns {object} élément
         */
        function avatar(p, taille) {
            var a = el("span", { classe: "avatar" + (taille ? " " + taille : ""), texte: p.trigramme,
                attrs: { "aria-hidden": "true" } });

            a.style.backgroundColor = "hsl(" + Number(p.teinte) + ", 55%, 90%)";
            a.style.color = "hsl(" + Number(p.teinte) + ", 45%, 28%)";
            return a;
        }

        /**
         * Nom en deux temps : prénom léger, nom de famille en gras.
         *
         * @param {object} p personne
         * @returns {object} élément
         */
        function nom(p) {
            return el("span", { classe: "nom" }, [
                el("span", { classe: "prenom", texte: p.prenom }), " ",
                el("span", { classe: "famille", texte: p.nom })
            ]);
        }

        /**
         * Fonctions courtes d'une personne, puis « +n ».
         *
         * @param {object} p personne
         * @returns {object|null} élément, ou null sans fonction
         */
        function fonctions(p) {
            if (!p.fonctions.length) {
                return null;
            }
            return el("span", { classe: "fonctions", attrs: { title: p.fonctions.join(", ") } },
                p.fonctionsCourtes.map(function (f) {
                    return el("span", { classe: "fonction", texte: f });
                }).concat(p.fonctionsEnPlus ? [el("span", { classe: "fonction", texte: "+" + p.fonctionsEnPlus })] : []));
        }

        /**
         * Grille de cartes.
         *
         * @param {Array} personnes personnes affichées
         * @param {number|null} ouverte ID de la fiche ouverte
         * @returns {object} élément
         */
        function grille(personnes, ouverte) {
            return el("div", { classe: "grille" }, personnes.map(function (p) {
                return el("div", {
                    classe: "carte" + (p.id === ouverte ? " est-ouverte" : ""),
                    attrs: { "data-personne": p.id, tabindex: "0", role: "button",
                        "aria-label": [p.nomComplet, p.titre, p.cercle, "trigramme " + p.trigramme]
                            .filter(function (x) { return x; }).join(", ") }
                }, [
                    el("span", { classe: "carte-haut" }, [avatar(p), nom(p)]),
                    p.titre ? el("span", { classe: "titre", texte: p.titre }) : null,
                    p.cercle ? el("span", { classe: "badge-cercle", texte: p.cercle }) : null,
                    el("span", { classe: "meta", texte: [p.succursale, p.trigramme].filter(function (x) { return x; }).join(" · ") }),
                    fonctions(p)
                ]);
            }));
        }

        /**
         * Liste en tableau, colonnes triables.
         *
         * @param {Array} personnes personnes affichées
         * @param {object} modele modèle (tri, fiche)
         * @returns {object} élément
         */
        function liste(personnes, modele) {
            var ouverte = modele.fiche ? modele.fiche.personne.id : null;
            var entete = function (libelle, tri) {
                return el("th", { attrs: { scope: "col" } }, [tri ? el("button", {
                    classe: modele.affichage.tri === tri ? "est-actif" : "", texte: libelle,
                    attrs: { type: "button", "data-tri": tri } }) : libelle]);
            };
            var tiret = "–";

            return el("table", { classe: "tableau" }, [
                el("thead", {}, [el("tr", {}, [
                    entete("Nom", "nom"), entete("Titre", "titre"), entete("Fonctions"),
                    entete("Succursale", "succursale"), entete("Cercle/rôle", "cercle"), entete("Trigramme"),
                    entete("Responsable"), entete("E-mail")
                ])]),
                el("tbody", {}, personnes.map(function (p) {
                    return el("tr", { classe: "ligne-personne" + (p.id === ouverte ? " est-ouverte" : "") }, [
                        el("td", {}, [el("span", { classe: "cellule-nom", attrs: { "data-personne": p.id } },
                            [avatar(p, "petit"), nom(p)])]),
                        el("td", { texte: p.titre || tiret }),
                        el("td", {}, [fonctions(p) || tiret]),
                        el("td", { texte: p.succursale || tiret }),
                        el("td", { texte: p.cercle || tiret }),
                        el("td", { texte: p.trigramme }),
                        el("td", {}, [p.responsable ? el("button", { classe: "lien-personne", texte: p.responsable.nomComplet,
                            attrs: { type: "button", "data-personne": p.responsable.id } }) : tiret]),
                        el("td", {}, [p.email ? el("span", { classe: "email", texte: p.email }) : tiret])
                    ]);
                }))
            ]);
        }

        /**
         * Puce cliquable d'une personne.
         *
         * @param {object} p personne
         * @returns {object} élément
         */
        function pucePersonne(p) {
            return el("button", { classe: "puce-personne", attrs: { type: "button", "data-personne": p.id } },
                [avatar(p, "petit"), p.nomComplet]);
        }

        /**
         * Bouton qui filtre la liste sur une valeur de la fiche.
         *
         * @param {string} cle facette
         * @param {string} valeur valeur du filtre
         * @param {string} libelle texte
         * @returns {object} élément
         */
        function boutonFiltre(cle, valeur, libelle) {
            return el("button", { classe: "bouton-filtre", texte: libelle,
                attrs: { type: "button", "data-filtre": cle, "data-valeur": valeur,
                    title: "Afficher seulement les personnes de cette valeur" } });
        }

        /**
         * Grand avatar, avec la photo par-dessus quand il y en a une. La
         * photo est un fond (background-size: cover) : IE11 ne connaît pas
         * object-fit ; si elle ne se charge pas, le trigramme reste visible.
         *
         * @param {object} p personne
         * @param {object|null} photo { dataUri, note } passée par le module
         * @returns {object} élément
         */
        function avatarAvecPhoto(p, photo) {
            var a = avatar(p, "grand");
            var image;

            if (photo && typeof photo.dataUri === "string" && MOTIF_PHOTO.test(photo.dataUri)) {
                image = el("span", { classe: "photo", attrs: { role: "img", "aria-label": "Portrait de " + p.nomComplet } });
                image.style.backgroundImage = "url(\"" + photo.dataUri + "\")";
                a.appendChild(image);
            }
            return a;
        }

        /**
         * Contenu de la fiche (volet latéral du tableau de bord, ou onglet).
         *
         * @param {object} f fiche du modèle
         * @param {object} [photo] { dataUri, note }, onglet seulement
         * @returns {Array} éléments
         */
        function contenuFiche(f, photo) {
            var p = f.personne;
            var faits = [];
            var plus = p.tailleEquipe > f.equipe.length ? " · " + p.tailleEquipe + " au total" : "";

            if (p.fonctions.length) {
                faits.push(["Fonctions", p.fonctions.map(function (x) { return boutonFiltre("fonction", x, x); })]);
            }
            if (p.succursale) {
                faits.push(["Succursale", [boutonFiltre("succursale", p.succursale, p.succursale)]]);
            }
            if (p.cercle) {
                // Filtrable seulement s'il est un cercle de l'organisation (un rôle n'a pas de filtre)
                faits.push(["Cercle/rôle principal", [p.cercleFiltrable ?
                    boutonFiltre("cercle", String(p.cercleId), p.cercle) :
                    el("span", { classe: "badge-cercle", texte: p.cercle })]]);
            }
            if (p.email) {
                // Texte à sélectionner, sans lien mailto: : le tableau de bord refuse de naviguer
                // vers un autre schéma que le sien (boîte d'erreur du client, docs/adr/0004)
                faits.push(["E-mail", [el("span", { classe: "email", texte: p.email })]]);
            }
            if (p.cerclesEtRoles.length) {
                faits.push(["Cercles et rôles (" + p.cerclesEtRoles.length + ")", p.cerclesEtRoles.map(function (c) {
                    return c.estCercle ? boutonFiltre("cercle", String(c.id), c.nom) :
                        el("span", { classe: "role" + (c.horsOrganisation ? " hors-organisation" : ""), texte: c.nom,
                            attrs: { title: c.horsOrganisation ? "Hors organisation" : "Rôle" } });
                })]);
            }
            if (f.responsable) {
                faits.push(["Responsable", [pucePersonne(f.responsable)]]);
            }
            if (f.equipe.length) {
                faits.push(["Équipe directe (" + f.equipe.length + plus + ")", f.equipe.map(pucePersonne)]);
            }

            return [
                el("div", { classe: "fiche-haut" }, [
                    avatarAvecPhoto(p, photo),
                    photo && photo.note ? el("p", { classe: "note", texte: photo.note }) : null,
                    el("h2", {}, [el("span", { classe: "prenom", texte: p.prenom }), " ",
                        el("span", { classe: "famille", texte: p.nom })]),
                    p.titre ? el("p", { classe: "fiche-titre" }, [el("button", { classe: "bouton-titre", texte: p.titre,
                        attrs: { type: "button", "data-filtre": "titre", "data-valeur": p.titre,
                            title: "Afficher seulement les personnes de ce titre" } })]) : null,
                    el("span", { classe: "trigramme", texte: p.trigramme, attrs: { title: "Trigramme" } })
                ]),
                el("dl", { classe: "faits" }, faits.map(function (fait) {
                    return el("div", { classe: "fait" }, [el("dt", { texte: fait[0] }), el("dd", {}, fait[1])]);
                })),
                el("div", { classe: "fiche-actions" }, [
                    f.dansMFiles ? el("button", { classe: "bouton bouton-primaire", texte: "Afficher la fiche M-Files",
                        attrs: { type: "button", "data-action": "mfiles", "data-id": p.id,
                            title: "Affiche les propriétés du collaborateur dans le volet de droite du client" } }) : null,
                    // Tableau de bord seulement (l'onglet montre la photo d'office) : proposé s'il existe une photo affichable
                    f.photo && f.photo.disponible ? el("button", { classe: "bouton bouton-secondaire",
                        texte: f.photo.affichee ? "Afficher le trigramme" : "Afficher la photo",
                        attrs: { type: "button", "data-action": f.photo.affichee ? "trigramme" : "photo", "data-id": p.id,
                            title: f.photo.affichee ? "Revient au rond avec le trigramme" :
                                "Remplace le rond avec le trigramme par la photo de M-Files" } }) : null
                ])
            ];
        }

        /**
         * Pastilles de filtre par cercle.
         *
         * @param {object} f facette cercle du modèle
         * @param {string|null} courant filtre courant
         * @param {string} aucun valeur « sans cercle »
         * @returns {Array} boutons
         */
        function pastilles(f, courant, aucun) {
            var pastille = function (valeur, libelle, effectif) {
                var appuye = (courant || "") === valeur;
                return el("button", {
                    classe: "pastille" + (effectif === 0 && !appuye ? " est-vide" : ""),
                    attrs: { type: "button", "data-cercle": valeur, "aria-pressed": appuye ? "true" : "false" }
                }, [libelle, el("span", { classe: "effectif", texte: effectif })]);
            };

            return [pastille("", "Tous", f.total)]
                .concat(f.options.map(function (o) { return pastille(o.valeur, o.libelle, o.effectif); }))
                .concat(f.aucun ? [pastille(aucun, f.aucun.libelle, f.aucun.effectif)] : []);
        }

        /**
         * Remplit une liste déroulante de facette sans la recréer (le
         * focus reste) ; IE11 gère mal innerHTML sur un select.
         *
         * @param {object} select élément select
         * @param {object} f facette du modèle
         * @param {string|null} courant valeur retenue
         * @param {string} aucun valeur « sans valeur »
         * @returns {void}
         */
        function remplirSelect(select, f, courant, aucun) {
            var options = [["", "Toutes (" + f.total + ")"]]
                .concat(f.options.map(function (o) { return [o.valeur, o.libelle + " (" + o.effectif + ")"]; }))
                .concat(f.aucun ? [[aucun, f.aucun.libelle + " (" + f.aucun.effectif + ")"]] : []);

            select.options.length = 0;
            options.forEach(function (o) {
                var option = doc.createElement("option");
                option.value = o[0];
                option.appendChild(doc.createTextNode(o[1]));
                select.appendChild(option);
            });
            select.value = courant || "";
            basculer(select, "est-actif", Boolean(courant));
        }

        /**
         * Rend toute la page à partir du modèle.
         *
         * @param {object} m modèle du présentateur
         * @returns {void}
         */
        function rendre(m) {
            var resultats = $("resultats");
            var selects = doc.querySelectorAll("select[data-facette]");
            var boutonsVue = doc.querySelectorAll("[data-vue]");
            var i;

            basculer($("progression"), "est-visible", false);
            basculer($("erreur"), "est-visible", false);
            $("compteur").textContent = m.compteur;
            $("bandeau").textContent = m.bandeau;
            basculer($("effacer"), "est-visible", Boolean(m.etat.q));
            $("tri").value = m.affichage.tri;
            for (i = 0; i < boutonsVue.length; i += 1) {
                boutonsVue[i].setAttribute("aria-pressed",
                    boutonsVue[i].getAttribute("data-vue") === m.affichage.vue ? "true" : "false");
            }

            vider($("cercles"));
            pastilles(m.facettes.cercle, m.etat.cercle, m.AUCUN).forEach(function (b) {
                $("cercles").appendChild(b);
            });
            for (i = 0; i < selects.length; i += 1) {
                remplirSelect(selects[i], m.facettes[selects[i].getAttribute("data-facette")],
                    m.etat[selects[i].getAttribute("data-facette")], m.AUCUN);
            }

            vider(resultats);
            if (!m.personnes.length) {
                resultats.appendChild(el("div", { classe: "vide" }, [
                    el("h2", { texte: m.etat.q ? "Aucun résultat pour « " + m.etat.q + " »" : "Aucun résultat" }),
                    el("p", { texte: "Essayez un autre nom, une fonction ou un trigramme." }),
                    el("button", { classe: "bouton bouton-secondaire", texte: "Effacer la recherche et les filtres",
                        attrs: { type: "button", "data-action": "reinitialiser" } })
                ]));
            } else if (m.affichage.vue === "liste") {
                resultats.appendChild(liste(m.personnes, m));
            } else {
                resultats.appendChild(grille(m.personnes, m.fiche ? m.fiche.personne.id : null));
            }

            ficheOuverte = Boolean(m.fiche);
            basculer($("fiche"), "est-ouverte", ficheOuverte);
            vider($("ficheCorps"));
            if (m.fiche) {
                contenuFiche(m.fiche, m.fiche.photo && m.fiche.photo.affichee ?
                    { dataUri: m.fiche.photo.dataUri, note: null } : null).forEach(function (e) {
                    if (e) {
                        $("ficheCorps").appendChild(e);
                    }
                });
                // Nouvelle personne : la fiche repart en haut
                if (ficheAffichee !== m.fiche.personne.id) {
                    $("fiche").scrollTop = 0;
                }
                ficheAffichee = m.fiche.personne.id;
            } else {
                ficheAffichee = null;
            }
        }

        /**
         * Onglet du volet de droite : la fiche seule, avec la photo ; ni
         * recherche, ni filtres, ni grille.
         *
         * @param {object} m { fiche, photo }
         * @returns {void}
         */
        function rendreOnglet(m) {
            basculer(doc.body, "mode-onglet", true);
            basculer($("progression"), "est-visible", false);
            vider($("ficheCorps"));
            contenuFiche(m.fiche, m.photo).forEach(function (e) {
                if (e) {
                    $("ficheCorps").appendChild(e);
                }
            });
            basculer($("fiche"), "est-ouverte", true);
        }

        /**
         * Progression de la lecture du coffre.
         *
         * @param {string} texte étape en cours
         * @param {number} fait éléments lus
         * @param {number} total éléments à lire (0 : inconnu)
         * @returns {void}
         */
        function progression(texte, fait, total) {
            basculer($("erreur"), "est-visible", false);
            basculer($("progression"), "est-visible", true);
            $("progressionTexte").textContent = total ? texte + " : " + fait + " sur " + total + "…" : texte;
            $("progressionBarre").style.width = (total ? Math.round(100 * fait / total) : 0) + "%";
        }

        /**
         * Erreur de lecture, avec de quoi relire.
         *
         * @param {string} texte message
         * @returns {void}
         */
        function erreur(texte) {
            basculer($("progression"), "est-visible", false);
            basculer($("erreur"), "est-visible", true);
            $("erreurTexte").textContent = "Lecture impossible : " + texte;
        }

        /**
         * Refus d'accès : message neutre, sans recherche, filtres ni
         * annuaire.
         *
         * @param {string} texte message
         * @returns {void}
         */
        function refuser(texte) {
            basculer($("progression"), "est-visible", false);
            basculer($("erreur"), "est-visible", false);
            basculer(doc.body.firstElementChild || $("controles").parentNode, "est-refusee", true);
            vider($("resultats"));
            basculer($("fiche"), "est-ouverte", false);
            // Rien de l'annuaire ne reste à l'écran : ni compteur, ni bandeau
            $("compteur").textContent = "";
            $("bandeau").textContent = "";
            $("refusTexte").textContent = texte;
            basculer($("refus"), "est-visible", true);
        }

        /**
         * Message passager en bas de page.
         *
         * @param {string} texte message
         * @returns {void}
         */
        function message(texte) {
            $("message").textContent = texte;
            basculer($("message"), "est-visible", true);
            clearTimeout(minuterieMessage);
            minuterieMessage = setTimeout(function () {
                basculer($("message"), "est-visible", false);
            }, DUREE_MESSAGE);
        }

        /**
         * Premier ancêtre (ou l'élément) qui porte un attribut.
         *
         * @param {object} e élément de départ
         * @param {string} attribut nom de l'attribut
         * @returns {object|null} élément trouvé
         */
        function porteur(e, attribut) {
            while (e && e.getAttribute) {
                if (e.getAttribute(attribut) !== null) {
                    return e;
                }
                e = e.parentNode;
            }
            return null;
        }

        /**
         * Lance la recherche si la saisie a changé, après un court délai.
         *
         * @returns {void}
         */
        function saisie() {
            clearTimeout(minuterieRecherche);
            minuterieRecherche = setTimeout(function () {
                var q = $("recherche").value;
                if (q !== derniereSaisie) {
                    derniereSaisie = q;
                    actions.rechercher(q);
                }
            }, DELAI_RECHERCHE);
        }

        // ---- Écouteurs (posés une fois, délégués) ----------------------

        $("version").textContent = "v" + VERSION_PAQUET;
        if (mode === "onglet") {
            basculer(doc.body, "mode-onglet", true);
        }
        $("recherche").addEventListener("input", saisie);
        $("recherche").addEventListener("keyup", saisie);
        $("effacer").addEventListener("click", function () {
            $("recherche").value = "";
            derniereSaisie = "";
            actions.rechercher("");
            $("recherche").focus();
        });
        $("tri").addEventListener("change", function () {
            actions.trier($("tri").value);
        });
        $("btnRelire").addEventListener("click", function () { actions.relire(); });
        $("btnReessayer").addEventListener("click", function () { actions.relire(); });
        $("btnRevenir").addEventListener("click", function () { actions.revenir(); });
        $("btnToutEffacer").addEventListener("click", function () {
            $("recherche").value = "";
            derniereSaisie = "";
            actions.reinitialiser();
        });
        $("controles").addEventListener("change", function (ev) {
            var s = porteur(ev.target, "data-facette");
            if (s) {
                actions.filtrer(s.getAttribute("data-facette"), s.value);
            }
        });

        doc.addEventListener("click", function (ev) {
            var cible = ev.target;
            var e;

            if ((e = porteur(cible, "data-action"))) {
                switch (e.getAttribute("data-action")) {
                case "fermer": actions.fermer(); break;
                case "precedente": actions.voisine(-1); break;
                case "suivante": actions.voisine(1); break;
                case "reinitialiser":
                    $("recherche").value = "";
                    derniereSaisie = "";
                    actions.reinitialiser();
                    break;
                case "mfiles": actions.afficherDansMFiles(Number(e.getAttribute("data-id"))); break;
                case "photo": actions.afficherPhoto(Number(e.getAttribute("data-id"))); break;
                case "trigramme": actions.masquerPhoto(); break;
                default: break;
                }
            } else if ((e = porteur(cible, "data-filtre"))) {
                actions.filtrer(e.getAttribute("data-filtre"), e.getAttribute("data-valeur"));
            } else if ((e = porteur(cible, "data-cercle"))) {
                actions.filtrer("cercle", e.getAttribute("data-cercle"));
            } else if ((e = porteur(cible, "data-vue"))) {
                actions.changerVue(e.getAttribute("data-vue"));
            } else if ((e = porteur(cible, "data-tri"))) {
                actions.trier(e.getAttribute("data-tri"));
            } else if ((e = porteur(cible, "data-personne"))) {
                actions.ouvrir(Number(e.getAttribute("data-personne")));
            }
        });

        doc.addEventListener("keydown", function (ev) {
            var code = ev.keyCode;
            var dansChamp = /^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName || "");
            var e;

            if (code === 27 && ficheOuverte) {
                actions.fermer();
            } else if (code === 13 && (e = porteur(ev.target, "data-personne")) && e.getAttribute("tabindex") !== null) {
                actions.ouvrir(Number(e.getAttribute("data-personne")));
            } else if (ficheOuverte && !dansChamp && (code === 37 || code === 39)) {
                actions.voisine(code === 37 ? -1 : 1);
            }
        });

        return { progression: progression, erreur: erreur, refuser: refuser, rendre: rendre, rendreOnglet: rendreOnglet,
            message: message };
    }

    return { creer: creer };
}());
