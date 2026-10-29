// Tests de la checklist du dossier. Dénombrements attendus : APPFLOW §9 E6
// (site : 5 + 7 + 11 + 13 + 5 + 1 = 42, plus 1 élément de la brochure = 43) ; états : APPFLOW §5.3.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATEGORIES, creer, stockageMemoire, TOTAL } from '../checklist.js'

const tousLesElements = () => CATEGORIES.flatMap((c) => c.elements)

test('6 catégories dans l\'ordre de procedures.php', () => {
  assert.deepEqual(
    CATEGORIES.map((c) => c.id),
    ['legaux', 'financiers', 'commerciaux', 'techniques', 'administratifs', 'synthese'],
  )
  assert.deepEqual(
    CATEGORIES.map((c) => c.libelle),
    ['Documents légaux', 'Documents financiers', 'Documents commerciaux', 'Documents techniques', 'Documents administratifs', 'Documents de synthèse'],
  )
})

test('43 éléments : 5, 7, 11, 14, 5, 1 (13 techniques du site + 1 de la brochure)', () => {
  assert.deepEqual(CATEGORIES.map((c) => c.elements.length), [5, 7, 11, 14, 5, 1])
  assert.equal(tousLesElements().length, 43)
  assert.equal(TOTAL, 43)
})

test('identifiants uniques, libellés et sources renseignés', () => {
  const els = tousLesElements()
  assert.equal(new Set(els.map((e) => e.id)).size, 43)
  for (const e of els) {
    assert.ok(e.libelle.trim().length > 3, e.id)
    assert.match(e.source, /procedures\.php|brochure/i, e.id)
  }
})

test('seul l\'élément issu de la brochure est à confirmer', () => {
  const incertains = tousLesElements().filter((e) => e.aConfirmer)
  assert.equal(incertains.length, 1)
  assert.match(incertains[0].libelle, /structure des coûts de production/i)
  assert.match(incertains[0].source, /brochure/i)
})

test('éléments clés présents (échantillon relu dans le crawl)', () => {
  const libelles = tousLesElements().map((e) => e.libelle)
  for (const attendu of ['Acte constitutif et statuts', 'États financiers historiques', 'Organigramme', 'Plan d’affaires'])
    assert.ok(libelles.includes(attendu), attendu)
  assert.deepEqual(CATEGORIES.at(-1).elements.map((e) => e.libelle), ['Plan d’affaires'])
})

test('progression initiale : 0 sur 43, 0 par catégorie', () => {
  const p = creer({ stockage: stockageMemoire() }).progression()
  assert.equal(p.coche, 0)
  assert.equal(p.total, 43)
  assert.equal(p.parCategorie.length, 6)
  assert.deepEqual(p.parCategorie.map((c) => [c.coche, c.total]), [[0, 5], [0, 7], [0, 11], [0, 14], [0, 5], [0, 1]])
})

test('cocher, décocher, basculer mettent la progression à jour', () => {
  const c = creer({ stockage: stockageMemoire() })
  c.cocher('legaux-01', true)
  c.cocher('legaux-02', true)
  c.cocher('financiers-01', true)
  assert.equal(c.progression().coche, 3)
  assert.deepEqual(c.progression().parCategorie.slice(0, 2).map((x) => x.coche), [2, 1])
  c.cocher('legaux-01', false)
  assert.equal(c.estCoche('legaux-01'), false)
  c.basculer('legaux-01')
  assert.equal(c.estCoche('legaux-01'), true)
  c.basculer('legaux-01')
  assert.equal(c.progression().coche, 2)
})

test('cocher deux fois le même élément ne compte qu\'une fois', () => {
  const c = creer({ stockage: stockageMemoire() })
  c.cocher('legaux-01', true)
  c.cocher('legaux-01', true)
  assert.equal(c.progression().coche, 1)
})

test('un identifiant inconnu est ignoré, sans erreur', () => {
  const c = creer({ stockage: stockageMemoire() })
  assert.equal(c.cocher('inconnu-99', true), false)
  assert.equal(c.progression().coche, 0)
})

test('tout cocher donne 43 sur 43', () => {
  const c = creer({ stockage: stockageMemoire() })
  tousLesElements().forEach((e) => c.cocher(e.id, true))
  assert.equal(c.progression().coche, 43)
})

// Persistance
test('la progression survit à un rechargement (même stockage)', () => {
  const s = stockageMemoire()
  const a = creer({ stockage: s })
  a.cocher('legaux-01', true)
  a.cocher('techniques-14', true)
  const b = creer({ stockage: s })
  assert.equal(b.estCoche('legaux-01'), true)
  assert.equal(b.estCoche('techniques-14'), true)
  assert.equal(b.progression().coche, 2)
  assert.equal(b.sauvegardeDisponible, true)
})

test('le stockage ne contient que des identifiants, aucune donnée personnelle', () => {
  const s = stockageMemoire()
  creer({ stockage: s }).cocher('legaux-03', true)
  const brut = s.getItem('fdi.checklist')
  const obj = JSON.parse(brut)
  assert.deepEqual(Object.keys(obj).sort(), ['coches', 'version'])
  assert.deepEqual(obj.coches, ['legaux-03'])
})

test('clés de stockage distinctes : deux checklists ne se mélangent pas', () => {
  const s = stockageMemoire()
  creer({ stockage: s, cle: 'a' }).cocher('legaux-01', true)
  assert.equal(creer({ stockage: s, cle: 'b' }).progression().coche, 0)
})

test('élément supprimé de la liste : ignoré à la lecture et purgé à la sauvegarde suivante', () => {
  const s = stockageMemoire()
  s.setItem('fdi.checklist', JSON.stringify({ version: 1, coches: ['legaux-01', 'supprime-99'] }))
  const c = creer({ stockage: s })
  assert.equal(c.progression().coche, 1)
  c.cocher('legaux-02', true)
  assert.deepEqual(JSON.parse(s.getItem('fdi.checklist')).coches.sort(), ['legaux-01', 'legaux-02'])
})

test('nouvel élément ajouté à la liste : apparaît décoché', () => {
  const s = stockageMemoire()
  s.setItem('fdi.checklist', JSON.stringify({ version: 1, coches: ['legaux-01'] }))
  assert.equal(creer({ stockage: s }).estCoche('techniques-14'), false)
})

test('contenu corrompu, version inconnue ou type inattendu : départ à vide, sans exception', () => {
  for (const brut of ['{pas du json', 'null', '[]', '{"version":99,"coches":["legaux-01"]}', '{"version":1,"coches":"legaux-01"}', '{"version":1,"coches":[1,null,{}]}']) {
    const s = stockageMemoire()
    s.setItem('fdi.checklist', brut)
    const c = creer({ stockage: s })
    assert.equal(c.progression().coche, 0, brut)
    c.cocher('legaux-01', true)
    assert.equal(c.progression().coche, 1)
  }
})

test('stockage indisponible à l\'écriture (quota, navigation privée) : l\'outil reste utilisable', () => {
  const casse = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') }, removeItem: () => {} }
  const c = creer({ stockage: casse })
  c.cocher('legaux-01', true)
  assert.equal(c.progression().coche, 1)
  assert.equal(c.sauvegardeDisponible, false)
})

test('stockage indisponible à la lecture : départ à vide, sauvegarde signalée indisponible', () => {
  const casse = { getItem: () => { throw new Error('SecurityError') }, setItem: () => {}, removeItem: () => {} }
  const c = creer({ stockage: casse })
  assert.equal(c.progression().coche, 0)
  assert.equal(c.sauvegardeDisponible, false)
})

test('aucun stockage fourni : fonctionne en mémoire seulement', () => {
  const c = creer({})
  c.cocher('legaux-01', true)
  assert.equal(c.progression().coche, 1)
  assert.equal(c.sauvegardeDisponible, false)
})

// Réinitialisation
test('réinitialiser décoche tout et supprime la donnée stockée', () => {
  const s = stockageMemoire()
  const c = creer({ stockage: s })
  c.cocher('legaux-01', true)
  c.reinitialiser()
  assert.equal(c.progression().coche, 0)
  assert.equal(s.getItem('fdi.checklist'), null)
  assert.equal(creer({ stockage: s }).progression().coche, 0)
})

// Export imprimable
test('export texte : en-tête, date, progression, catégories, cases cochées', () => {
  const c = creer({ stockage: stockageMemoire() })
  c.cocher('legaux-01', true)
  c.cocher('legaux-02', true)
  const t = c.exporterTexte({ date: '2026-10-14' })
  const lignes = t.split('\n')
  assert.match(lignes[0], /Checklist du dossier/)
  assert.ok(t.includes('Document de préparation, non officiel'))
  assert.ok(t.includes('Date : 2026-10-14'))
  assert.ok(t.includes('Progression : 2 sur 43'))
  assert.ok(t.includes('1. Documents légaux (2 sur 5)'))
  assert.ok(t.includes('6. Documents de synthèse (0 sur 1)'))
  assert.equal(lignes.filter((l) => l.startsWith('  [x] ')).length, 2)
  assert.equal(lignes.filter((l) => l.startsWith('  [ ] ')).length, 41)
})

test('export texte : l\'élément à confirmer est signalé, lui seul', () => {
  const t = creer({ stockage: stockageMemoire() }).exporterTexte({ date: '2026-10-14' })
  assert.equal(t.split('\n').filter((l) => l.includes('à confirmer par le FDI')).length, 2) // 1 élément + 1 note de pied
  assert.match(t, /structure des coûts de production.*à confirmer par le FDI/)
})

test('export texte : stable pour une même entrée', () => {
  const c = creer({ stockage: stockageMemoire() })
  c.cocher('financiers-03', true)
  assert.equal(c.exporterTexte({ date: '2026-10-14' }), c.exporterTexte({ date: '2026-10-14' }))
})

test('stockageMemoire se comporte comme localStorage (null si absent)', () => {
  const s = stockageMemoire()
  assert.equal(s.getItem('x'), null)
  s.setItem('x', '1')
  assert.equal(s.getItem('x'), '1')
  s.removeItem('x')
  assert.equal(s.getItem('x'), null)
})
