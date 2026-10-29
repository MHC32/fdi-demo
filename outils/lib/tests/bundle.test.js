// Le prototype s'ouvre en file:// : les modules ES ne s'y chargent pas. bundle.js est la même
// logique en script classique. Ces tests vérifient qu'il est à jour et qu'il se comporte comme les modules.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { assembler } from '../build-bundle.mjs'
import * as simulateur from '../simulateur.js'
import * as eligibilite from '../eligibilite.js'
import * as checklist from '../checklist.js'

const sur_disque = readFileSync(new URL('../bundle.js', import.meta.url), 'utf8')

test('bundle.js sur disque = sortie du script de build (pas périmé)', () => {
  assert.equal(sur_disque, assembler())
})

test('le bundle s\'exécute comme script classique et expose les 3 modules', () => {
  const contexte = vm.createContext({})
  vm.runInContext(sur_disque, contexte)
  const o = contexte.FDIOutils
  assert.deepEqual(Object.keys(o).sort(), ['checklist', 'eligibilite', 'simulateur'])
  assert.ok(!/^\s*(import|export)\s/m.test(sur_disque), 'aucun import/export résiduel')
})

test('mêmes exports que les modules ES', () => {
  const contexte = vm.createContext({})
  vm.runInContext(sur_disque, contexte)
  assert.deepEqual(Object.keys(contexte.FDIOutils.simulateur).sort(), Object.keys(simulateur).sort())
  assert.deepEqual(Object.keys(contexte.FDIOutils.eligibilite).sort(), Object.keys(eligibilite).sort())
  assert.deepEqual(Object.keys(contexte.FDIOutils.checklist).sort(), Object.keys(checklist).sort())
})

test('mêmes résultats que les modules ES (3 appels de bout en bout)', () => {
  const contexte = vm.createContext({})
  vm.runInContext(sur_disque, contexte)
  const o = contexte.FDIOutils
  const entree = { montant: '1 000 000', devise: 'HTG', dureeMois: '60', tauxAnnuel: '12', differeMois: '6', besoin: 'immobilisations' }
  assert.equal(o.simulateur.calculer(entree).resultat.mensualite, simulateur.calculer(entree).resultat.mensualite)

  let e = o.eligibilite.demarrer()
  for (const v of ['tourisme', 4, 'expansion', 'equipement', { montant: '50 000', devise: 'USD' }]) e = o.eligibilite.repondre(e, v)
  // Les tableaux du contexte vm n'ont pas le même prototype : comparaison via JSON.
  assert.deepEqual(JSON.parse(JSON.stringify(e.resultat.produits.map((p) => p.slug))), ['pret-participatif', 'capital-risque', 'cofinancement', 'garantie-de-credit'])

  const c = o.checklist.creer({ stockage: o.checklist.stockageMemoire() })
  c.cocher('legaux-01', true)
  assert.equal(c.progression().coche, 1)
})
