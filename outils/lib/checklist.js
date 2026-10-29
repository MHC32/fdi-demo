// Checklist du dossier de demande (APPFLOW §5.3, PRD FR-9).
// 6 catégories et 42 éléments de procedures.php (crawl du 2026-10-10), plus 1 élément de la
// brochure FDI de 2005 (APPFLOW §9, E6) marqué « à confirmer ». Stockage injecté : localStorage
// dans le navigateur, stockageMemoire() dans les tests. On ne stocke que des identifiants.

const VERSION = 1
const CLE_DEFAUT = 'fdi.checklist'
const MARQUE = 'à confirmer par le FDI'

function categorie(rang, id, libelle, libelles) {
  const source = `fdihaiti.ht/procedures.php, catégorie ${rang} « ${libelle} » (crawl du 2026-10-10)`
  return {
    id,
    libelle,
    elements: libelles.map((l, k) => ({ id: `${id}-${String(k + 1).padStart(2, '0')}`, libelle: l, source })),
  }
}

export const CATEGORIES = [
  categorie(1, 'legaux', 'Documents légaux', [
    'Accord de partenariat',
    'Acte constitutif et statuts',
    'Résolution du conseil d’admission autorisant le projet et son mode de financement',
    'Patente, licence de fonctionnement',
    'Tous documents légaux relatifs aux opérations de l’entreprise',
  ]),
  categorie(2, 'financiers', 'Documents financiers', [
    'États financiers historiques',
    'États de compte',
    'Références bancaires',
    'Projections financières',
    'Copie d’accord de financement',
    'Budgets',
    'Actionnariat',
  ]),
  categorie(3, 'commerciaux', 'Documents commerciaux', [
    'Études de marché',
    'Liste des clients actuels et/ou potentiels, évolution durant les 5 dernières années',
    'Part de marché : évolution durant les 3 dernières années',
    'Part de marché des principaux concurrents : évolution au cours des 3 dernières années',
    'Documents décrivant les avantages compétitifs du/des produit(s)',
    'Copie de contrat de vente',
    'Liste des prix comparée à celle de la compétition',
    'Listes des distributeurs actuels et potentiels',
    'Copie de lettres d’intention',
    'Références bancaires du/des distributeur(s) sélectif(s) et exclusif(s) actuel(s)',
    'Documents décrivant les produits, leur marché spécifique et le profil de leurs consommateurs, ventilés par région, sexe, style de vie, saison, etc.',
  ]),
  categorie(4, 'techniques', 'Documents techniques', [
    'Documents décrivant les infrastructures existantes',
    'Plans et devis estimatifs (en cas de construction)',
    'Factures pro-forma des fournisseurs d’équipement et de matières premières',
    'Copie des titres de propriété et des plans d’arpentage',
    'Liste des fournisseurs d’intrants',
    'Dossier d’appel d’offre',
    'Copie d’études de faisabilité technique du projet',
    'Copie de contrat d’approvisionnement en intrant',
    'Copie de contrat d’assistance technique',
    'Copie de contrat, de licence, de franchise et de sous-traitance',
    'Liste des prix des intrants',
    'Liste des différents intrants et leur rendement en termes de produits finis',
    'Document décrivant la productivité de la main d’œuvre à chaque étape du processus de production',
  ]),
  categorie(5, 'administratifs', 'Documents administratifs', [
    'Organigramme',
    'Copie de contrat de travail avec les cadres supérieurs et les consultants nationaux et internationaux',
    'Copie de l’énoncé de mission, de vision, manuel de politique',
    'Copie du code d’éthique',
    'Composition et profil de l’équipe dirigeante',
  ]),
  categorie(6, 'synthese', 'Documents de synthèse', ['Plan d’affaires']),
]

// 14e document technique, cité par la brochure seulement (APPFLOW §9, E6). Intitulé repris de
// l'APPFLOW, non revérifié dans la brochure PDF : à confirmer.
CATEGORIES[3].elements.push({
  id: 'techniques-14',
  libelle: 'La structure des coûts de production',
  source: 'Brochure FDI 2005, 14e document technique (APPFLOW §9, E6)',
  aConfirmer: true,
})

export const TOTAL = CATEGORIES.reduce((n, c) => n + c.elements.length, 0)
const IDS = new Set(CATEGORIES.flatMap((c) => c.elements.map((e) => e.id)))

export function stockageMemoire() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  }
}

function lire(stockage, cle) {
  try {
    const o = JSON.parse(stockage.getItem(cle))
    if (!o || o.version !== VERSION || !Array.isArray(o.coches)) return new Set()
    return new Set(o.coches.filter((id) => typeof id === 'string' && IDS.has(id)))
  } catch {
    return new Set() // contenu corrompu : départ à vide
  }
}

export function creer({ stockage = null, cle = CLE_DEFAUT } = {}) {
  let disponible = Boolean(stockage)
  let coches = new Set()
  if (stockage) {
    try {
      stockage.getItem(cle)
    } catch {
      disponible = false
    }
    if (disponible) coches = lire(stockage, cle)
  }

  function sauver() {
    if (!disponible) return
    try {
      stockage.setItem(cle, JSON.stringify({ version: VERSION, coches: [...coches] }))
    } catch {
      disponible = false
    }
  }

  function progression() {
    const parCategorie = CATEGORIES.map((c) => ({
      id: c.id,
      coche: c.elements.filter((e) => coches.has(e.id)).length,
      total: c.elements.length,
    }))
    return { coche: coches.size, total: TOTAL, parCategorie }
  }

  return {
    get sauvegardeDisponible() {
      return disponible
    },
    estCoche: (id) => coches.has(id),
    cocher(id, valeur) {
      if (!IDS.has(id)) return false
      if (valeur) coches.add(id)
      else coches.delete(id)
      sauver()
      return true
    },
    basculer(id) {
      return this.cocher(id, !coches.has(id))
    },
    progression,
    reinitialiser() {
      coches = new Set()
      if (!disponible) return
      try {
        stockage.removeItem(cle)
      } catch {
        disponible = false
      }
    },
    // Texte à imprimer ou à copier. La date est passée par l'appelant (AAAA-MM-JJ).
    exporterTexte({ date } = {}) {
      const jour = date ?? new Date().toISOString().slice(0, 10)
      const p = progression()
      const lignes = [
        'Checklist du dossier de demande de financement (FDI)',
        'Document de préparation, non officiel.',
        `Date : ${jour}`,
        `Progression : ${p.coche} sur ${p.total}`,
        '',
      ]
      CATEGORIES.forEach((c, k) => {
        const pc = p.parCategorie[k]
        lignes.push(`${k + 1}. ${c.libelle} (${pc.coche} sur ${pc.total})`)
        for (const e of c.elements)
          lignes.push(`  [${coches.has(e.id) ? 'x' : ' '}] ${e.libelle}${e.aConfirmer ? ` (${MARQUE})` : ''}`)
        lignes.push('')
      })
      lignes.push(`Les éléments marqués « ${MARQUE} » ne figurent que dans la brochure de 2005.`)
      return lignes.join('\n')
    },
  }
}
