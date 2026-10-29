// Tests du simulateur. Les valeurs de reference viennent d'un calcul independant (dichotomie
// sur le solde final), pas de la formule fermee du code. Sources des 7 cas :
// fdi-site/tests/amortissement.test.js (calcules par dichotomie, ecart < 1 centime).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  simuler,
  lireNombre,
  valider,
  alertes,
  calculer,
  preremplirDemande,
  BESOINS,
  TAUX_DEFAUT,
} from '../simulateur.js'

// Reference independante : cherche par dichotomie la mensualite qui ramene le solde a 0.
function mensualiteParDichotomie({ montant, tauxAnnuel, dureeMois, differeMois }) {
  const i = tauxAnnuel / 100 / 12
  const n = dureeMois - differeMois
  const soldeFinal = (p) => {
    let s = montant
    for (let k = 0; k < n; k += 1) s = s * (1 + i) - p
    return s
  }
  let bas = 0
  let haut = montant * (1 + i) + 1
  for (let k = 0; k < 200; k += 1) {
    const milieu = (bas + haut) / 2
    if (soldeFinal(milieu) > 0) bas = milieu
    else haut = milieu
  }
  return (bas + haut) / 2
}

const CAS = [
  { montant: 1_000_000, tauxAnnuel: 12, dureeMois: 60, differeMois: 0, attendu: 22244.45 },
  { montant: 1_000_000, tauxAnnuel: 12, dureeMois: 12, differeMois: 0, attendu: 88848.79 },
  { montant: 10_000, tauxAnnuel: 8, dureeMois: 36, differeMois: 0, attendu: 313.36 }, // USD
  { montant: 500_000, tauxAnnuel: 18, dureeMois: 24, differeMois: 0, attendu: 24962.05 },
  { montant: 1_000_000, tauxAnnuel: 12, dureeMois: 60, differeMois: 6, attendu: 24056.58 },
  { montant: 25_000, tauxAnnuel: 9.5, dureeMois: 48, differeMois: 3, attendu: 662.55 }, // USD
  { montant: 750_000, tauxAnnuel: 0, dureeMois: 30, differeMois: 0, attendu: 25000 },
]

function verifierInvariants(r, c, tolerance = 1e-6) {
  assert.equal(r.lignes.length, c.dureeMois)
  assert.ok(Math.abs(r.lignes.reduce((s, l) => s + l.capital, 0) - c.montant) < tolerance * Math.max(1, c.montant), 'capital total = montant')
  assert.equal(r.lignes.at(-1).solde, 0)
  assert.ok(Math.abs(r.totalRembourse - r.coutTotal - c.montant) < tolerance * Math.max(1, c.montant))
  r.lignes.filter((l) => l.differe).forEach((l) => assert.equal(l.capital, 0))
  assert.equal(r.lignes.filter((l) => l.differe).length, c.differeMois)
}

for (const c of CAS) {
  test(`cas de reference : ${c.montant} a ${c.tauxAnnuel} % sur ${c.dureeMois} mois, differe ${c.differeMois}`, () => {
    const r = simuler(c)
    assert.ok(Math.abs(r.mensualite - c.attendu) < 0.01, `obtenu ${r.mensualite}, attendu ${c.attendu}`)
    verifierInvariants(r, c)
  })
}

test('la dichotomie du test retrouve les 7 valeurs publiees (la reference est saine)', () => {
  for (const c of CAS) assert.ok(Math.abs(mensualiteParDichotomie(c) - c.attendu) < 0.01)
})

test('interets payes pendant le differe : paiement = montant x taux mensuel', () => {
  const r = simuler({ montant: 1_000_000, dureeMois: 60, tauxAnnuel: 12, differeMois: 6 })
  assert.ok(Math.abs(r.mensualiteDiffere - 10_000) < 1e-9)
  r.lignes.slice(0, 6).forEach((l) => {
    assert.ok(Math.abs(l.paiement - 10_000) < 1e-9)
    assert.ok(Math.abs(l.solde - 1_000_000) < 1e-9)
  })
  assert.equal(r.echeancesAmortissement, 54)
})

// Cas limites
test('limite : taux 0 sans differe, mensualite = montant / duree, cout nul', () => {
  const c = { montant: 120_000, tauxAnnuel: 0, dureeMois: 24, differeMois: 0 }
  const r = simuler(c)
  assert.equal(r.mensualite, 5000)
  assert.ok(Math.abs(r.coutTotal) < 1e-6)
  verifierInvariants(r, c)
})

test('limite : taux 0 avec differe, aucun interet pendant le differe', () => {
  const c = { montant: 120_000, tauxAnnuel: 0, dureeMois: 24, differeMois: 6 }
  const r = simuler(c)
  assert.equal(r.mensualiteDiffere, 0)
  assert.equal(r.mensualite, 120_000 / 18)
  verifierInvariants(r, c)
})

test('limite : differe = duree - 1, une seule echeance d\'amortissement', () => {
  const c = { montant: 100_000, tauxAnnuel: 12, dureeMois: 12, differeMois: 11 }
  const r = simuler(c)
  assert.equal(r.echeancesAmortissement, 1)
  assert.ok(Math.abs(r.mensualite - 101_000) < 1e-6) // capital + un mois d'interets
  assert.ok(Math.abs(r.mensualite - mensualiteParDichotomie(c)) < 0.01)
  verifierInvariants(r, c)
})

test('limite : duree de 1 mois', () => {
  const c = { montant: 50_000, tauxAnnuel: 24, dureeMois: 1, differeMois: 0 }
  const r = simuler(c)
  assert.ok(Math.abs(r.mensualite - 51_000) < 1e-6)
  assert.equal(r.lignes.length, 1)
  verifierInvariants(r, c)
})

test('limite : montant tres grand (1e12), precision relative 1e-9 contre la dichotomie', () => {
  const c = { montant: 1e12, tauxAnnuel: 12, dureeMois: 216, differeMois: 36 }
  const r = simuler(c)
  const ref = mensualiteParDichotomie(c)
  assert.ok(Math.abs(r.mensualite - ref) / ref < 1e-9, `obtenu ${r.mensualite}, ref ${ref}`)
  verifierInvariants(r, c, 1e-9)
})

test('limite : montant minuscule (0,01) reste coherent', () => {
  const c = { montant: 0.01, tauxAnnuel: 12, dureeMois: 12, differeMois: 0 }
  const r = simuler(c)
  assert.ok(r.mensualite > 0)
  verifierInvariants(r, c)
})

test('limite : taux eleve (100 %) sur duree longue, solde jamais negatif', () => {
  const c = { montant: 100_000, tauxAnnuel: 100, dureeMois: 216, differeMois: 0 }
  const r = simuler(c)
  assert.ok(r.lignes.every((l) => l.solde >= 0))
  assert.ok(Math.abs(r.mensualite - mensualiteParDichotomie(c)) < 0.01)
})

// Saisie et validation
test('lireNombre accepte les formats francais et refuse le reste', () => {
  assert.equal(lireNombre('1 000 000'), 1_000_000)
  assert.equal(lireNombre('1 000,50'), 1000.5)
  assert.equal(lireNombre('12,5'), 12.5)
  assert.ok(Number.isNaN(lireNombre('abc')))
  assert.ok(Number.isNaN(lireNombre('')))
  assert.ok(Number.isNaN(lireNombre('1,2,3')))
  assert.ok(Number.isNaN(lireNombre('-5')))
})

test('valider : cas accepte et chaque champ refuse', () => {
  const ok = { montant: 1000, dureeMois: 12, tauxAnnuel: 10, differeMois: 0 }
  assert.deepEqual(valider(ok), {})
  assert.ok(valider({ ...ok, montant: 0 }).montant)
  assert.ok(valider({ ...ok, montant: NaN }).montant)
  assert.ok(valider({ ...ok, dureeMois: 1.5 }).duree)
  assert.ok(valider({ ...ok, dureeMois: 0 }).duree)
  assert.ok(valider({ ...ok, tauxAnnuel: -1 }).taux)
  assert.ok(valider({ ...ok, differeMois: -1 }).differe)
  assert.ok(valider({ ...ok, differeMois: 12 }).differe)
  assert.equal(valider({ ...ok, differeMois: 11 }).differe, undefined)
  assert.equal(valider({ ...ok, tauxAnnuel: 0 }).taux, undefined)
})

test('alertes : bornes de la brochure 2005 signalees sans bloquer', () => {
  assert.deepEqual(BESOINS.immobilisations, { libelle: 'Immobilisations', dureeMaxMois: 216, differeMaxMois: 36 })
  assert.deepEqual(BESOINS.fonds_de_roulement, { libelle: 'Fonds de roulement', dureeMaxMois: 30, differeMaxMois: 6 })
  assert.equal(alertes({ dureeMois: 216, differeMois: 36 }, BESOINS.immobilisations).length, 0)
  assert.equal(alertes({ dureeMois: 217, differeMois: 0 }, BESOINS.immobilisations).length, 1)
  assert.equal(alertes({ dureeMois: 30, differeMois: 6 }, BESOINS.fonds_de_roulement).length, 0)
  assert.equal(alertes({ dureeMois: 31, differeMois: 7 }, BESOINS.fonds_de_roulement).length, 2)
  assert.match(alertes({ dureeMois: 31, differeMois: 0 }, BESOINS.fonds_de_roulement)[0], /brochure 2005, à confirmer/)
})

test('le taux par defaut est marque illustratif', () => {
  assert.equal(TAUX_DEFAUT.valeur, 12)
  assert.equal(TAUX_DEFAUT.illustratif, true)
})

// Entree unique pour le prototype
test('calculer : texte saisi, HTG, resultat et alertes', () => {
  const r = calculer({ montant: '1 000 000', devise: 'HTG', dureeMois: '60', tauxAnnuel: '12', differeMois: '6', besoin: 'immobilisations' })
  assert.deepEqual(r.erreurs, {})
  assert.ok(Math.abs(r.resultat.mensualite - 24056.58) < 0.01)
  assert.equal(r.devise, 'HTG')
  assert.deepEqual(r.alertes, [])
})

test('calculer : USD, fonds de roulement hors bornes, calcul maintenu', () => {
  const r = calculer({ montant: '10000', devise: 'USD', dureeMois: '36', tauxAnnuel: '8', differeMois: '0', besoin: 'fonds_de_roulement' })
  assert.deepEqual(r.erreurs, {})
  assert.ok(Math.abs(r.resultat.mensualite - 313.36) < 0.01)
  assert.equal(r.alertes.length, 1)
})

test('calculer : erreurs masquent le resultat', () => {
  const r = calculer({ montant: 'abc', devise: 'HTG', dureeMois: '12', tauxAnnuel: '-3', differeMois: '12', besoin: 'immobilisations' })
  assert.ok(r.erreurs.montant && r.erreurs.taux && r.erreurs.differe)
  assert.equal(r.resultat, null)
})

test('calculer : devise inconnue refusee', () => {
  const r = calculer({ montant: '1000', devise: 'EUR', dureeMois: '12', tauxAnnuel: '10', differeMois: '0', besoin: 'immobilisations' })
  assert.ok(r.erreurs.devise)
  assert.equal(r.resultat, null)
})

test('preremplirDemande : monnaie, montant et conditions (APPFLOW 6)', () => {
  const entree = { montant: '25 000', devise: 'USD', dureeMois: '48', tauxAnnuel: '9,5', differeMois: '3', besoin: 'immobilisations' }
  const p = preremplirDemande(calculer(entree))
  assert.equal(p.monnaie_operation, 'USD')
  assert.equal(p.montant_financement_sollicite, 25_000)
  assert.match(p.conditions, /48 mois/)
  assert.match(p.conditions, /différé de 3 mois/)
  assert.match(p.conditions, /simulation indicative/)
})

test('preremplirDemande : null si le calcul est en erreur', () => {
  assert.equal(preremplirDemande(calculer({ montant: '', devise: 'HTG', dureeMois: '12', tauxAnnuel: '10', differeMois: '0', besoin: 'immobilisations' })), null)
})
