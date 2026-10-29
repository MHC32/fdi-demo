// Test d'éligibilité en 5 questions (APPFLOW §4d, règles R0 à R11 ; table produits §2.2).
// Fonctions pures : aucune donnée n'est envoyée nulle part.
// Les plafonds viennent de la brochure FDI de 2005 : à confirmer par le FDI.

const BROCHURE = 'brochure 2005, à confirmer'

// Secteurs prioritaires : les 13 de la page secteurs-prioritaires.php (APPFLOW §9, E1).
export const SECTEURS = [
  { id: 'agro_industrie', libelle: 'Agro-industrie' },
  { id: 'peche_aquaculture', libelle: 'Pêche et Aquaculture' },
  { id: 'industrie_alimentaire', libelle: 'Industrie alimentaire' },
  { id: 'industrie_pharmaceutique', libelle: 'Industrie pharmaceutique' },
  { id: 'industrie_chimique_plastiques', libelle: 'Industrie chimique et des matières plastiques' },
  { id: 'materiaux_construction', libelle: 'Industrie des matériaux de construction' },
  { id: 'industrie_metallique', libelle: 'Industrie métallique' },
  { id: 'textile_cuir', libelle: 'Industrie du textile et du cuir' },
  { id: 'tourisme', libelle: 'Tourisme' },
  { id: 'transport_communication', libelle: 'Transport et communication' },
  { id: 'enseignement', libelle: 'Enseignement supérieur et professionnel' },
  { id: 'artisanat', libelle: 'Artisanat et production artistique' },
  { id: 'services_auxiliaires', libelle: 'Services auxiliaires aux industries' },
]

// Les 7 choix de `type_projet` du formulaire (APPFLOW §6, étape 5).
export const TYPES_PROJET = [
  { id: 'creation', libelle: 'Création' },
  { id: 'expansion', libelle: 'Expansion' },
  { id: 'modernisation', libelle: 'Modernisation' },
  { id: 'recherche_developpement', libelle: 'Recherche et développement' },
  { id: 'financement_bfr', libelle: 'Financement BFR' },
  { id: 'etude_faisabilite', libelle: 'Étude de faisabilité' },
  { id: 'autre', libelle: 'Autre' },
]

export const BESOINS = [
  { id: 'immobilier', libelle: 'Prêt immobilier industriel et commercial' },
  { id: 'equipement', libelle: 'Achat de matériel, équipement, technologie' },
  { id: 'fonds_de_roulement', libelle: 'Fonds de roulement' },
]

export const DEVISES = ['HTG', 'USD']

// 9 produits et types du formulaire correspondants (APPFLOW §2.2).
export const PRODUITS = [
  { slug: 'cofinancement', nom: 'Le Co-financement', typesFormulaire: ['Cofinance simple', 'Cofinance & réescompte'] },
  { slug: 'pret-participatif', nom: 'Le prêt participatif', typesFormulaire: ['Prêt participatif'] },
  { slug: 'capital-risque', nom: 'Le capital risque', typesFormulaire: ['Capital risque'] },
  { slug: 'pret-subordonne', nom: 'Le prêt subordonné', typesFormulaire: ['Prêt subordonné'] },
  { slug: 'reescompte', nom: 'Le réescompte à long terme', typesFormulaire: ['Réescompte sans garantie', 'Réescompte avec garantie'] },
  { slug: 'garantie-de-credit', nom: 'La garantie de crédit', typesFormulaire: ['Lettre de garantie'] },
  { slug: 'option-cession-creance', nom: "L'option de cession de créance (OCC)", typesFormulaire: ['Option de cession de créance'] },
  { slug: 'micro-credit-institutionnel', nom: 'Le micro-crédit institutionnel', typesFormulaire: ['Micro-crédit institutionnel'] },
  { slug: 'assistance-technique', nom: "L'assistance technique", typesFormulaire: ['Assistance technique'] },
]

// Produits recommandables à l'entrepreneur (R3) : raison en une phrase, conditions de rappel (R11).
const FICHES = {
  'pret-participatif': {
    raison: "Prêt direct du FDI dont la rémunération suit en partie la performance de l'entreprise.",
    conditions: [],
  },
  'capital-risque': {
    raison: "Participation directe du FDI au capital, temporaire (5 ans au maximum), pour créer, étendre ou moderniser.",
    conditions: [`Aucun groupe ou famille ne contrôle plus de 20 % des actions (${BROCHURE}).`],
  },
  cofinancement: {
    raison: 'Prêt accordé par le FDI en même temps qu\'un intermédiaire financier.',
    conditions: ['Se demande via un intermédiaire financier.'],
  },
  'garantie-de-credit': {
    raison: "Engagement du FDI de rembourser l'intermédiaire financier si l'emprunteur fait défaut.",
    conditions: [
      `Ratio dettes sur fonds propres sous 3:1, sans dettes impayées ni inscription sur liste noire (${BROCHURE}).`,
      'Se demande via un intermédiaire financier.',
    ],
  },
}
const ORDRE_R3 = ['pret-participatif', 'capital-risque', 'cofinancement', 'garantie-de-credit']

// Réservés aux intermédiaires (R8) : mentionnés, jamais recommandés.
const VIA_INTERMEDIAIRE = [
  { slug: 'reescompte', note: 'Disponible via votre banque partenaire.' },
  { slug: 'pret-subordonne', note: 'Disponible via votre banque partenaire.' },
  { slug: 'option-cession-creance', note: 'Disponible via votre banque partenaire.' },
  { slug: 'micro-credit-institutionnel', note: "S'adresse aux institutions de micro-finance partenaires." },
]

const PLAFOND_PRET_PARTICIPATIF_USD = 500_000
const PLAFOND_CAPITAL_RISQUE_USD = 300_000

const nomDe = (slug) => PRODUITS.find((p) => p.slug === slug).nom

function lire(v) {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return NaN
  const propre = v.replace(/[\s  ]/g, '').replace(',', '.')
  return /^\d*\.?\d+$|^\d+\.$/.test(propre) ? Number(propre) : NaN
}

function produitComplet(slug) {
  const f = FICHES[slug]
  return { slug, nom: nomDe(slug), raison: f.raison, conditions: [...f.conditions], avertissements: [] }
}

function resultatVide(statut, message, extra = {}) {
  return { statut, message, produits: [], viaIntermediaire: [], avertissementsGeneraux: [], aConfirmer: false, ordreAConfirmer: false, ...extra }
}

// Calcule la recommandation depuis les réponses. options.tauxChangeUsdHtg : taux illustratif, à confirmer.
export function recommander(reponses, options = {}) {
  if (reponses.secteur === 'autre')
    return resultatVide('hors_secteur', 'Aucune recommandation : le traitement des projets hors secteurs prioritaires est à confirmer par le FDI.', { aConfirmer: true })
  if (reponses.projet === 'etude_faisabilite')
    return resultatVide('recommandation', 'Pour une étude de faisabilité, le FDI propose son assistance technique.', {
      produits: [
        {
          slug: 'assistance-technique',
          nom: nomDe('assistance-technique'),
          raison: 'Appui technique et avance remboursable si le projet est réalisé.',
          conditions: [],
          avertissements: [],
        },
      ],
    })
  if (!['creation', 'expansion', 'modernisation', 'financement_bfr'].includes(reponses.projet))
    return resultatVide('non_deductible', 'Le produit adapté à ce type de projet n\'est pas déductible des documents publiés : à confirmer par le FDI.', { aConfirmer: true })

  let slugs = [...ORDRE_R3]
  const bfr = reponses.besoin === 'fonds_de_roulement' || reponses.projet === 'financement_bfr'
  if (bfr) slugs = slugs.filter((s) => s !== 'garantie-de-credit' && s !== 'capital-risque')

  const produits = slugs.map(produitComplet)
  const get = (s) => produits.find((p) => p.slug === s)
  if (bfr) {
    get('cofinancement').conditions.push(`En fonds de roulement, durée limitée à 30 mois (${BROCHURE}).`)
    const pp = get('pret-participatif')
    pp.aConfirmer = true
    pp.conditions.push('Prêt participatif pour un besoin de fonds de roulement : à confirmer par le FDI.')
  }

  const avertissementsGeneraux = []
  const m = reponses.montant
  if (m) {
    let usd = m.devise === 'USD' ? m.montant : null
    if (m.devise === 'HTG') {
      if (options.tauxChangeUsdHtg > 0) usd = m.montant / options.tauxChangeUsdHtg
      else avertissementsGeneraux.push('Montant en HTG : comparaison aux plafonds publiés en USD impossible sans taux de change confirmé par le FDI.')
    }
    if (usd !== null) {
      const pp = get('pret-participatif')
      if (usd > PLAFOND_PRET_PARTICIPATIF_USD) pp.avertissements.push(`Au-dessus du plafond publié (USD 500 000, ${BROCHURE}).`)
      const cr = get('capital-risque')
      if (cr && usd > PLAFOND_CAPITAL_RISQUE_USD)
        cr.avertissements.push(`Au-dessus du plafond de l'investissement initial publié (USD 300 000, ${BROCHURE}).`)
    }
  }

  const viaIntermediaire = VIA_INTERMEDIAIRE.map((v) => ({ slug: v.slug, nom: nomDe(v.slug), note: v.note }))
  return resultatVide('recommandation', 'Produits compatibles avec vos réponses. Orientation indicative, la décision appartient au FDI.', {
    produits,
    viaIntermediaire,
    avertissementsGeneraux,
    ordreAConfirmer: produits.length > 1,
  })
}

// Les 5 questions. `valider` renvoie la valeur normalisée, ou null si la réponse est refusée.
const idsDe = (liste) => liste.map((o) => o.id)
export const QUESTIONS = [
  {
    id: 'secteur',
    libelle: "Dans quel secteur votre entreprise ou votre projet opère-t-il ?",
    options: [...SECTEURS, { id: 'autre', libelle: 'Autre secteur' }],
    erreur: 'Choisissez un secteur dans la liste.',
    valider: (v) => (idsDe(QUESTIONS[0].options).includes(v) ? v : null),
  },
  {
    id: 'taille',
    libelle: "Combien d'employés compte l'entreprise ?",
    erreur: "Saisissez un nombre entier d'employés, 0 ou plus.",
    valider: (v) => {
      const n = lire(v)
      return Number.isInteger(n) && n >= 0 ? n : null
    },
  },
  {
    id: 'projet',
    libelle: 'Quel est le type de projet ?',
    options: TYPES_PROJET,
    erreur: 'Choisissez un type de projet.',
    valider: (v) => (idsDe(TYPES_PROJET).includes(v) ? v : null),
  },
  {
    id: 'besoin',
    libelle: 'Quel est votre besoin de financement ?',
    options: BESOINS,
    erreur: 'Choisissez un besoin.',
    valider: (v) => (idsDe(BESOINS).includes(v) ? v : null),
  },
  {
    id: 'montant',
    libelle: 'Quel montant sollicitez-vous, et dans quelle monnaie ?',
    erreur: 'Saisissez un montant supérieur à 0 et choisissez HTG ou USD.',
    valider: (v) => {
      if (!v || !DEVISES.includes(v.devise)) return null
      const montant = lire(v.montant)
      return Number.isFinite(montant) && montant > 0 ? { montant, devise: v.devise } : null
    },
  },
]

// Question suivante selon les réponses déjà données (diagramme APPFLOW §4d).
function suivante(etape, reponses) {
  if (etape === 'secteur') return reponses.secteur === 'autre' ? 'resultat' : 'taille'
  if (etape === 'taille') return 'projet'
  if (etape === 'projet') return ['creation', 'expansion', 'modernisation', 'financement_bfr'].includes(reponses.projet) ? 'besoin' : 'resultat'
  if (etape === 'besoin') return 'montant'
  return 'resultat'
}

export function demarrer(options = {}) {
  return { etape: 'secteur', reponses: {}, historique: [], erreur: null, resultat: null, options }
}

export function repondre(etat, valeur) {
  if (etat.etape === 'resultat') return etat
  const question = QUESTIONS.find((q) => q.id === etat.etape)
  const normalisee = question.valider(valeur)
  if (normalisee === null) return { ...etat, erreur: question.erreur }
  const reponses = { ...etat.reponses, [etat.etape]: normalisee }
  const etape = suivante(etat.etape, reponses)
  return {
    ...etat,
    etape,
    reponses,
    historique: [...etat.historique, etat.etape],
    erreur: null,
    resultat: etape === 'resultat' ? recommander(reponses, etat.options) : null,
  }
}

// Retour d'une étape : les réponses restent mémorisées pour pré-sélectionner les champs.
export function retour(etat) {
  if (!etat.historique.length) return etat
  return { ...etat, etape: etat.historique.at(-1), historique: etat.historique.slice(0, -1), erreur: null, resultat: null }
}

// Pré-remplissage du formulaire de demande (APPFLOW §6) : champs du wizard, valeur null si inconnue.
export function preremplirDemande(reponses, slugChoisi) {
  const projet = TYPES_PROJET.find((t) => t.id === reponses.projet)
  const montantPosee = ['creation', 'expansion', 'modernisation', 'financement_bfr'].includes(reponses.projet) && reponses.secteur !== 'autre'
  const m = montantPosee ? reponses.montant : null

  let types
  if (slugChoisi) types = PRODUITS.find((p) => p.slug === slugChoisi)?.typesFormulaire ?? []
  else types = [...new Set(recommander(reponses).produits.flatMap((p) => PRODUITS.find((x) => x.slug === p.slug).typesFormulaire))]

  return {
    type_projet: projet ? projet.libelle : null,
    type_financement_sollicite: types.length === 1 ? types[0] : null,
    montant_financement_sollicite: m ? m.montant : null,
    monnaie_operation: m ? m.devise : null,
    nombre_employes_beneficiaire: reponses.taille ?? null,
  }
}
