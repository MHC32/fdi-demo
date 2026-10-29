// Généré par build-bundle.mjs : ne pas modifier à la main.
(function (global) {
'use strict'
global.FDIOutils = {
  simulateur: (function () {
// Simulateur de prêt : annuité constante après un différé optionnel (APPFLOW §4e).
// Porté de fdi-site/src/lib/amortissement.js. Fonctions pures, sans dépendance.
// Valeurs de simulateur.json recopiées ici : le prototype s'ouvre en file://, où un
// import de JSON échoue.

const TAUX_DEFAUT = { valeur: 12, illustratif: true } // à confirmer par le FDI
const DEVISES = ['HTG', 'USD']
const SOURCE_BORNES = 'brochure 2005, à confirmer'

const BESOINS = {
  immobilisations: { libelle: 'Immobilisations', dureeMaxMois: 216, differeMaxMois: 36 },
  fonds_de_roulement: { libelle: 'Fonds de roulement', dureeMaxMois: 30, differeMaxMois: 6 },
}

// Les intérêts du différé sont payés (défaut de démo, APPFLOW §4e, à confirmer par le FDI).
function simuler({ montant, dureeMois, tauxAnnuel, differeMois = 0 }) {
  const i = tauxAnnuel / 100 / 12
  const n = dureeMois - differeMois
  const mensualite = i === 0 ? montant / n : (montant * i) / (1 - Math.pow(1 + i, -n))

  const lignes = []
  let solde = montant
  let totalRembourse = 0
  for (let mois = 1; mois <= dureeMois; mois += 1) {
    const interets = solde * i
    const differe = mois <= differeMois
    // La dernière échéance solde exactement le capital restant (absorbe les arrondis flottants).
    const capital = differe ? 0 : mois === dureeMois ? solde : mensualite - interets
    const paiement = capital + interets
    solde = mois === dureeMois ? 0 : solde - capital
    totalRembourse += paiement
    lignes.push({ mois, differe, paiement, interets, capital, solde })
  }
  return {
    mensualite,
    mensualiteDiffere: montant * i,
    echeancesAmortissement: n,
    totalRembourse,
    coutTotal: totalRembourse - montant,
    lignes,
  }
}

// Lit un nombre saisi à la française : « 1 000 000 », « 12,5 ». NaN si illisible ou négatif.
function lireNombre(texte) {
  const propre = String(texte).replace(/[\s  ]/g, '').replace(',', '.')
  return /^\d*\.?\d+$|^\d+\.$/.test(propre) ? Number(propre) : NaN
}

// Erreurs bloquantes : un message par champ.
function valider({ montant, dureeMois, tauxAnnuel, differeMois }) {
  const e = {}
  if (!Number.isFinite(montant) || montant <= 0) e.montant = 'Saisissez un montant supérieur à 0.'
  if (!Number.isInteger(dureeMois) || dureeMois < 1) e.duree = "Saisissez une durée entière, d'au moins 1 mois."
  if (!Number.isFinite(tauxAnnuel) || tauxAnnuel < 0) e.taux = 'Saisissez un taux égal ou supérieur à 0.'
  if (!Number.isInteger(differeMois) || differeMois < 0) e.differe = 'Saisissez un différé entier, de 0 mois ou plus.'
  else if (!e.duree && differeMois >= dureeMois) e.differe = 'Le différé doit être plus court que la durée.'
  return e
}

// Avertissements : le calcul est maintenu quand une valeur dépasse les bornes publiées.
function alertes({ dureeMois, differeMois }, besoin) {
  const a = []
  if (dureeMois > besoin.dureeMaxMois)
    a.push(`Durée de ${dureeMois} mois : ${besoin.dureeMaxMois} mois au maximum pour ce besoin (${SOURCE_BORNES}).`)
  if (differeMois > besoin.differeMaxMois)
    a.push(`Différé de ${differeMois} mois : ${besoin.differeMaxMois} mois au maximum pour ce besoin (${SOURCE_BORNES}).`)
  return a
}

// Point d'entrée du prototype : prend les champs tels que saisis (texte ou nombres).
function calculer({ montant, devise, dureeMois, tauxAnnuel, differeMois, besoin }) {
  const entree = {
    montant: lireNombre(montant),
    dureeMois: lireNombre(dureeMois),
    tauxAnnuel: lireNombre(tauxAnnuel),
    differeMois: String(differeMois ?? '').trim() === '' ? 0 : lireNombre(differeMois),
  }
  const erreurs = valider(entree)
  if (!DEVISES.includes(devise)) erreurs.devise = 'Choisissez HTG ou USD.'
  const bornes = BESOINS[besoin]
  if (!bornes) erreurs.besoin = 'Choisissez un type de besoin.'
  if (Object.keys(erreurs).length) return { erreurs, resultat: null, alertes: [], devise, entree }
  return { erreurs, resultat: simuler(entree), alertes: alertes(entree, bornes), devise, entree }
}

const virgule = (n) => String(n).replace('.', ',')

// Pré-remplissage du wizard (APPFLOW §6) : monnaie, montant, termes sollicités.
function preremplirDemande(calcul) {
  if (!calcul.resultat) return null
  const { montant, dureeMois, tauxAnnuel, differeMois } = calcul.entree
  const differe = differeMois > 0 ? `, différé de ${differeMois} mois (intérêts payés)` : ''
  return {
    monnaie_operation: calcul.devise,
    montant_financement_sollicite: montant,
    conditions: `Durée ${dureeMois} mois, taux illustratif ${virgule(tauxAnnuel)} %${differe}. Issu du simulateur FDI : simulation indicative, non contractuelle.`,
  }
}

return { TAUX_DEFAUT, DEVISES, BESOINS, simuler, lireNombre, valider, alertes, calculer, preremplirDemande }
})(),
  eligibilite: (function () {
// Test d'éligibilité en 5 questions (APPFLOW §4d, règles R0 à R11 ; table produits §2.2).
// Fonctions pures : aucune donnée n'est envoyée nulle part.
// Les plafonds viennent de la brochure FDI de 2005 : à confirmer par le FDI.

const BROCHURE = 'brochure 2005, à confirmer'

// Secteurs prioritaires : les 13 de la page secteurs-prioritaires.php (APPFLOW §9, E1).
const SECTEURS = [
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
const TYPES_PROJET = [
  { id: 'creation', libelle: 'Création' },
  { id: 'expansion', libelle: 'Expansion' },
  { id: 'modernisation', libelle: 'Modernisation' },
  { id: 'recherche_developpement', libelle: 'Recherche et développement' },
  { id: 'financement_bfr', libelle: 'Financement BFR' },
  { id: 'etude_faisabilite', libelle: 'Étude de faisabilité' },
  { id: 'autre', libelle: 'Autre' },
]

const BESOINS = [
  { id: 'immobilier', libelle: 'Prêt immobilier industriel et commercial' },
  { id: 'equipement', libelle: 'Achat de matériel, équipement, technologie' },
  { id: 'fonds_de_roulement', libelle: 'Fonds de roulement' },
]

const DEVISES = ['HTG', 'USD']

// 9 produits et types du formulaire correspondants (APPFLOW §2.2).
const PRODUITS = [
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
function recommander(reponses, options = {}) {
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
const QUESTIONS = [
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

function demarrer(options = {}) {
  return { etape: 'secteur', reponses: {}, historique: [], erreur: null, resultat: null, options }
}

function repondre(etat, valeur) {
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
function retour(etat) {
  if (!etat.historique.length) return etat
  return { ...etat, etape: etat.historique.at(-1), historique: etat.historique.slice(0, -1), erreur: null, resultat: null }
}

// Pré-remplissage du formulaire de demande (APPFLOW §6) : champs du wizard, valeur null si inconnue.
function preremplirDemande(reponses, slugChoisi) {
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

return { SECTEURS, TYPES_PROJET, BESOINS, DEVISES, PRODUITS, recommander, QUESTIONS, demarrer, repondre, retour, preremplirDemande }
})(),
  checklist: (function () {
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

const CATEGORIES = [
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

const TOTAL = CATEGORIES.reduce((n, c) => n + c.elements.length, 0)
const IDS = new Set(CATEGORIES.flatMap((c) => c.elements.map((e) => e.id)))

function stockageMemoire() {
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

function creer({ stockage = null, cle = CLE_DEFAUT } = {}) {
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

return { CATEGORIES, TOTAL, stockageMemoire, creer }
})(),
}
})(typeof globalThis !== "undefined" ? globalThis : window)
