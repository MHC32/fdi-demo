# Logique des outils FDI (prototype)

Trois modules purs, sans dépendance, testés avec `node --test`. Valeurs de démo, à confirmer par le FDI.

- `simulateur.js` : `calculer({montant, devise, dureeMois, tauxAnnuel, differeMois, besoin})` renvoie `{erreurs, resultat, alertes}`. `preremplirDemande(calcul)` donne monnaie, montant et conditions du formulaire.
- `eligibilite.js` : machine à états `demarrer()`, `repondre(etat, valeur)`, `retour(etat)`. `etat.resultat` liste les produits. `preremplirDemande(etat.reponses, slug)` donne les champs du formulaire.
- `checklist.js` : `creer({stockage})` renvoie `cocher`, `basculer`, `progression`, `exporterTexte({date})`, `reinitialiser`. Passer `localStorage` en navigateur, `stockageMemoire()` en test.
- `bundle.js` : les trois modules en script classique (`window.FDIOutils.simulateur|eligibilite|checklist`), car les modules ES ne se chargent pas en `file://`.

Commandes, depuis ce dossier (Node 22) :

    node --test              # 91 tests, tests/*.test.js
    node build-bundle.mjs    # régénère bundle.js après toute modification d'un module

Un test échoue si `bundle.js` n'est pas à jour. Rien n'est envoyé nulle part.
