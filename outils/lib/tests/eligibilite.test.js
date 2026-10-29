// Tests du test d'éligibilité. Les attentes viennent de APPFLOW §4d (règles R0 à R11),
// §2.2 (produits et types du formulaire) et §6 (pré-remplissages), pas du code.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SECTEURS,
  PRODUITS,
  QUESTIONS,
  demarrer,
  repondre,
  retour,
  recommander,
  preremplirDemande,
} from '../eligibilite.js'

const base = {
  secteur: 'agro_industrie',
  taille: 12,
  projet: 'creation',
  besoin: 'immobilier',
  montant: { montant: 100_000, devise: 'USD' },
}
const slugs = (r) => r.produits.map((p) => p.slug)
const produit = (r, slug) => r.produits.find((p) => p.slug === slug)

// Parcours complet par la machine à états
function parcourir(reponses, options) {
  let e = demarrer(options)
  for (const id of ['secteur', 'taille', 'projet', 'besoin', 'montant']) {
    if (e.etape === 'resultat') break
    assert.equal(e.etape, id)
    e = repondre(e, reponses[id])
  }
  return e
}

test('13 secteurs, 9 produits, 5 questions', () => {
  assert.equal(SECTEURS.length, 13)
  assert.equal(new Set(SECTEURS.map((s) => s.id)).size, 13)
  assert.equal(PRODUITS.length, 9)
  assert.equal(QUESTIONS.length, 5)
  assert.ok(SECTEURS.some((s) => s.libelle === 'Pêche et Aquaculture'))
})

// --- R0 / R1 : secteur
test('R0 : un secteur de la liste continue vers la question 2', () => {
  const e = repondre(demarrer(), 'tourisme')
  assert.equal(e.etape, 'taille')
  assert.equal(e.erreur, null)
})

test('R1 : secteur « autre » arrête le parcours, aucune recommandation, à confirmer', () => {
  const e = repondre(demarrer(), 'autre')
  assert.equal(e.etape, 'resultat')
  assert.equal(e.resultat.statut, 'hors_secteur')
  assert.deepEqual(e.resultat.produits, [])
  assert.equal(e.resultat.aConfirmer, true)
})

test('R1 : une valeur absente de la liste est refusée, la question reste posée', () => {
  const e = repondre(demarrer(), 'boulangerie')
  assert.equal(e.etape, 'secteur')
  assert.ok(e.erreur)
})

// --- R2 : étude de faisabilité
test('R2 : étude de faisabilité donne seulement l\'assistance technique et arrête le parcours', () => {
  const e = parcourir({ ...base, projet: 'etude_faisabilite' })
  assert.equal(e.etape, 'resultat')
  assert.deepEqual(slugs(e.resultat), ['assistance-technique'])
})

test('R2 (sens inverse) : une création ne propose pas l\'assistance technique', () => {
  assert.ok(!slugs(recommander(base)).includes('assistance-technique'))
})

// --- R3 : création, expansion, modernisation
test('R3 : création, expansion et modernisation donnent les 4 mêmes candidats, dans cet ordre', () => {
  for (const projet of ['creation', 'expansion', 'modernisation']) {
    assert.deepEqual(slugs(recommander({ ...base, projet })), ['pret-participatif', 'capital-risque', 'cofinancement', 'garantie-de-credit'])
  }
})

test('R3 (sens inverse) : recherche et développement ou « autre » ne donnent aucun produit déduit', () => {
  for (const projet of ['recherche_developpement', 'autre']) {
    const e = parcourir({ ...base, projet })
    assert.equal(e.etape, 'resultat', 'le parcours s\'arrête après la question 3')
    assert.equal(e.resultat.statut, 'non_deductible')
    assert.deepEqual(e.resultat.produits, [])
    assert.equal(e.resultat.aConfirmer, true)
  }
})

// --- R4 : fonds de roulement
test('R4 : besoin en fonds de roulement retire la garantie et le capital risque', () => {
  const r = recommander({ ...base, besoin: 'fonds_de_roulement' })
  assert.deepEqual(slugs(r), ['pret-participatif', 'cofinancement'])
  assert.match(produit(r, 'cofinancement').conditions.join(' '), /30 mois/)
  assert.equal(produit(r, 'pret-participatif').aConfirmer, true)
})

test('R4 : le type de projet « Financement BFR » produit le même effet, même avec un besoin immobilier', () => {
  const r = recommander({ ...base, projet: 'financement_bfr', besoin: 'immobilier' })
  assert.deepEqual(slugs(r), ['pret-participatif', 'cofinancement'])
})

test('R4 (sens inverse) : besoin immobilier ou équipement garde garantie et capital risque', () => {
  for (const besoin of ['immobilier', 'equipement']) {
    const s = slugs(recommander({ ...base, besoin }))
    assert.ok(s.includes('garantie-de-credit') && s.includes('capital-risque'))
    assert.equal(produit(recommander({ ...base, besoin }), 'pret-participatif').aConfirmer, undefined)
  }
})

// --- R5 : plafond du prêt participatif (USD 500 000, brochure 2005)
test('R5 : au-dessus de USD 500 000 le prêt participatif est signalé, jamais retiré', () => {
  const r = recommander({ ...base, montant: { montant: 500_001, devise: 'USD' } })
  const p = produit(r, 'pret-participatif')
  assert.ok(p, 'toujours listé')
  assert.match(p.avertissements.join(' '), /500 000/)
})

test('R5 (sens inverse) : à USD 500 000 pile, aucun signalement', () => {
  const r = recommander({ ...base, montant: { montant: 500_000, devise: 'USD' } })
  assert.deepEqual(produit(r, 'pret-participatif').avertissements, [])
})

// --- R6 : plafond du capital risque (USD 300 000)
test('R6 : au-dessus de USD 300 000 le capital risque est signalé', () => {
  const r = recommander({ ...base, montant: { montant: 300_001, devise: 'USD' } })
  assert.match(produit(r, 'capital-risque').avertissements.join(' '), /300 000/)
  assert.deepEqual(produit(r, 'pret-participatif').avertissements, [], 'le prêt participatif reste sous son plafond')
})

test('R6 (sens inverse) : à USD 300 000 pile, aucun signalement', () => {
  const r = recommander({ ...base, montant: { montant: 300_000, devise: 'USD' } })
  assert.deepEqual(produit(r, 'capital-risque').avertissements, [])
})

// --- R7 : montants en HTG
test('R7 : en HTG sans taux de change confirmé, avertissement de principe et aucun refus', () => {
  const r = recommander({ ...base, montant: { montant: 900_000_000, devise: 'HTG' } })
  assert.equal(r.produits.length, 4)
  assert.match(r.avertissementsGeneraux.join(' '), /taux de change/)
  produit(r, 'pret-participatif').avertissements.forEach((a) => assert.doesNotMatch(a, /500 000/))
})

test('R7 : avec un taux paramétré, la comparaison aux plafonds USD se fait (taux de test 100)', () => {
  const opt = { tauxChangeUsdHtg: 100 }
  const dessous = recommander({ ...base, montant: { montant: 30_000_000, devise: 'HTG' } }, opt) // 300 000 USD
  assert.deepEqual(produit(dessous, 'capital-risque').avertissements, [])
  const dessus = recommander({ ...base, montant: { montant: 30_000_100, devise: 'HTG' } }, opt) // 300 001 USD
  assert.match(produit(dessus, 'capital-risque').avertissements.join(' '), /300 000/)
  assert.deepEqual(dessus.avertissementsGeneraux, [])
})

// --- R8 : produits réservés aux intermédiaires
test('R8 : réescompte, prêt subordonné, OCC et micro-crédit ne sont jamais recommandés, seulement mentionnés', () => {
  const r = recommander(base)
  const reserves = ['reescompte', 'pret-subordonne', 'option-cession-creance', 'micro-credit-institutionnel']
  assert.deepEqual(r.viaIntermediaire.map((p) => p.slug).sort(), [...reserves].sort())
  reserves.forEach((s) => assert.ok(!slugs(r).includes(s)))
  assert.match(r.viaIntermediaire.find((p) => p.slug === 'micro-credit-institutionnel').note, /micro-finance/)
})

test('R8 : aucune mention des produits réservés quand il n\'y a pas de recommandation', () => {
  assert.deepEqual(recommander({ ...base, secteur: 'autre' }).viaIntermediaire, [])
})

// --- R9 : taille
test('R9 : le nombre d\'employés ne change pas les recommandations', () => {
  assert.deepEqual(slugs(recommander({ ...base, taille: 1 })), slugs(recommander({ ...base, taille: 5000 })))
})

test('Q2 : entier supérieur ou égal à 0, texte français accepté, le reste refusé', () => {
  const q2 = (v) => repondre(repondre(demarrer(), 'tourisme'), v)
  assert.equal(q2('12').etape, 'projet')
  assert.equal(q2(0).etape, 'projet')
  for (const mauvais of ['', 'abc', -1, 2.5, '1,5']) assert.equal(q2(mauvais).etape, 'taille', String(mauvais))
})

// --- R10 / R11
test('R10 : plusieurs produits restent tous affichés, ordre marqué à confirmer', () => {
  const r = recommander(base)
  assert.equal(r.produits.length, 4)
  assert.equal(r.ordreAConfirmer, true)
})

test('R11 : rappel des conditions sur le capital risque (20 %) et la garantie (3:1)', () => {
  const r = recommander(base)
  assert.match(produit(r, 'capital-risque').conditions.join(' '), /20 %/)
  assert.match(produit(r, 'garantie-de-credit').conditions.join(' '), /3:1/)
})

// --- Question 5
test('Q5 : montant et devise valides, texte français accepté', () => {
  const avant = { ...base }
  const e = parcourir({ ...avant, montant: { montant: '1 500 000', devise: 'HTG' } })
  assert.equal(e.etape, 'resultat')
  assert.equal(e.reponses.montant.montant, 1_500_000)
})

test('Q5 : montant nul, illisible ou devise inconnue refusés', () => {
  const jusquaQ5 = () => {
    let e = demarrer()
    for (const [id, v] of [['secteur', 'tourisme'], ['taille', 3], ['projet', 'creation'], ['besoin', 'immobilier']]) e = repondre(e, v)
    return e
  }
  for (const mauvais of [{ montant: 0, devise: 'HTG' }, { montant: 'abc', devise: 'HTG' }, { montant: 10, devise: 'EUR' }, null]) {
    const e = repondre(jusquaQ5(), mauvais)
    assert.equal(e.etape, 'montant')
    assert.ok(e.erreur)
  }
})

// --- Machine à états
test('machine : parcours complet jusqu\'au résultat', () => {
  const e = parcourir(base)
  assert.equal(e.etape, 'resultat')
  assert.equal(e.resultat.produits.length, 4)
  assert.deepEqual(e.historique, ['secteur', 'taille', 'projet', 'besoin', 'montant'])
})

test('machine : immuable, l\'état précédent n\'est pas modifié', () => {
  const e0 = demarrer()
  const copie = JSON.stringify(e0)
  repondre(e0, 'tourisme')
  assert.equal(JSON.stringify(e0), copie)
})

test('machine : retour arrière sans perte des réponses', () => {
  let e = parcourir({ ...base, projet: 'creation' })
  e = retour(e) // du résultat vers Q5
  assert.equal(e.etape, 'montant')
  e = retour(retour(retour(e))) // Q4, Q3, Q2
  assert.equal(e.etape, 'taille')
  assert.deepEqual(e.reponses, { ...base, montant: { montant: 100_000, devise: 'USD' } })
  e = repondre(e, 5) // on corrige Q2 seulement
  assert.equal(e.etape, 'projet')
  assert.equal(e.reponses.projet, 'creation', 'la réponse suivante est conservée pour pré-sélection')
})

test('machine : retour depuis la première question ne fait rien', () => {
  const e = demarrer()
  assert.deepEqual(retour(e), e)
})

test('machine : changer une réponse change le chemin, les anciennes réponses restent mémorisées', () => {
  let e = parcourir(base)
  e = retour(retour(retour(e))) // Q3
  assert.equal(e.etape, 'projet')
  e = repondre(e, 'etude_faisabilite')
  assert.equal(e.etape, 'resultat')
  assert.deepEqual(slugs(e.resultat), ['assistance-technique'])
  assert.deepEqual(e.reponses.besoin, 'immobilier')
  e = retour(e)
  assert.equal(e.etape, 'projet')
})

test('machine : un secteur « autre » corrigé rouvre le parcours', () => {
  let e = repondre(demarrer(), 'autre')
  e = retour(e)
  assert.equal(e.etape, 'secteur')
  e = repondre(e, 'tourisme')
  assert.equal(e.etape, 'taille')
})

test('machine : repondre sur un état terminé ne change rien', () => {
  const e = parcourir(base)
  assert.deepEqual(repondre(e, 'tourisme'), e)
})

// --- Pré-remplissage du formulaire
test('préremplissage : type de projet, montant, monnaie, employés (noms du formulaire APPFLOW §6)', () => {
  const p = preremplirDemande(parcourir(base).reponses, 'pret-participatif')
  assert.deepEqual(p, {
    type_projet: 'Création',
    type_financement_sollicite: 'Prêt participatif',
    montant_financement_sollicite: 100_000,
    monnaie_operation: 'USD',
    nombre_employes_beneficiaire: 12,
  })
})

test('préremplissage : correspondance des 9 produits avec les 11 types du formulaire (APPFLOW §2.2)', () => {
  const attendu = {
    cofinancement: ['Cofinance simple', 'Cofinance & réescompte'],
    'pret-participatif': ['Prêt participatif'],
    'capital-risque': ['Capital risque'],
    'pret-subordonne': ['Prêt subordonné'],
    reescompte: ['Réescompte sans garantie', 'Réescompte avec garantie'],
    'garantie-de-credit': ['Lettre de garantie'],
    'option-cession-creance': ['Option de cession de créance'],
    'micro-credit-institutionnel': ['Micro-crédit institutionnel'],
    'assistance-technique': ['Assistance technique'],
  }
  for (const p of PRODUITS) assert.deepEqual(p.typesFormulaire, attendu[p.slug], p.slug)
  assert.equal(new Set(PRODUITS.flatMap((p) => p.typesFormulaire)).size, 11)
})

test('préremplissage : produit à deux types possibles laisse le choix à l\'utilisateur', () => {
  const p = preremplirDemande(base, 'cofinancement')
  assert.equal(p.type_financement_sollicite, null)
})

test('préremplissage : sans produit choisi, type renseigné seulement s\'il est unique', () => {
  assert.equal(preremplirDemande(base).type_financement_sollicite, null) // 4 produits
  const etude = { ...base, projet: 'etude_faisabilite' }
  assert.equal(preremplirDemande(etude).type_financement_sollicite, 'Assistance technique')
})

test('préremplissage : étude de faisabilité n\'a pas de montant (question 5 non posée)', () => {
  const e = parcourir({ ...base, projet: 'etude_faisabilite' })
  const p = preremplirDemande(e.reponses)
  assert.equal(p.type_projet, 'Étude de faisabilité')
  assert.equal(p.montant_financement_sollicite, null)
  assert.equal(p.monnaie_operation, null)
})
