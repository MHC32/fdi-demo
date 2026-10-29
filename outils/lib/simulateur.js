// Simulateur de prêt : annuité constante après un différé optionnel (APPFLOW §4e).
// Porté de fdi-site/src/lib/amortissement.js. Fonctions pures, sans dépendance.
// Valeurs de simulateur.json recopiées ici : le prototype s'ouvre en file://, où un
// import de JSON échoue.

export const TAUX_DEFAUT = { valeur: 12, illustratif: true } // à confirmer par le FDI
export const DEVISES = ['HTG', 'USD']
const SOURCE_BORNES = 'brochure 2005, à confirmer'

export const BESOINS = {
  immobilisations: { libelle: 'Immobilisations', dureeMaxMois: 216, differeMaxMois: 36 },
  fonds_de_roulement: { libelle: 'Fonds de roulement', dureeMaxMois: 30, differeMaxMois: 6 },
}

// Les intérêts du différé sont payés (défaut de démo, APPFLOW §4e, à confirmer par le FDI).
export function simuler({ montant, dureeMois, tauxAnnuel, differeMois = 0 }) {
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
export function lireNombre(texte) {
  const propre = String(texte).replace(/[\s  ]/g, '').replace(',', '.')
  return /^\d*\.?\d+$|^\d+\.$/.test(propre) ? Number(propre) : NaN
}

// Erreurs bloquantes : un message par champ.
export function valider({ montant, dureeMois, tauxAnnuel, differeMois }) {
  const e = {}
  if (!Number.isFinite(montant) || montant <= 0) e.montant = 'Saisissez un montant supérieur à 0.'
  if (!Number.isInteger(dureeMois) || dureeMois < 1) e.duree = "Saisissez une durée entière, d'au moins 1 mois."
  if (!Number.isFinite(tauxAnnuel) || tauxAnnuel < 0) e.taux = 'Saisissez un taux égal ou supérieur à 0.'
  if (!Number.isInteger(differeMois) || differeMois < 0) e.differe = 'Saisissez un différé entier, de 0 mois ou plus.'
  else if (!e.duree && differeMois >= dureeMois) e.differe = 'Le différé doit être plus court que la durée.'
  return e
}

// Avertissements : le calcul est maintenu quand une valeur dépasse les bornes publiées.
export function alertes({ dureeMois, differeMois }, besoin) {
  const a = []
  if (dureeMois > besoin.dureeMaxMois)
    a.push(`Durée de ${dureeMois} mois : ${besoin.dureeMaxMois} mois au maximum pour ce besoin (${SOURCE_BORNES}).`)
  if (differeMois > besoin.differeMaxMois)
    a.push(`Différé de ${differeMois} mois : ${besoin.differeMaxMois} mois au maximum pour ce besoin (${SOURCE_BORNES}).`)
  return a
}

// Point d'entrée du prototype : prend les champs tels que saisis (texte ou nombres).
export function calculer({ montant, devise, dureeMois, tauxAnnuel, differeMois, besoin }) {
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
export function preremplirDemande(calcul) {
  if (!calcul.resultat) return null
  const { montant, dureeMois, tauxAnnuel, differeMois } = calcul.entree
  const differe = differeMois > 0 ? `, différé de ${differeMois} mois (intérêts payés)` : ''
  return {
    monnaie_operation: calcul.devise,
    montant_financement_sollicite: montant,
    conditions: `Durée ${dureeMois} mois, taux illustratif ${virgule(tauxAnnuel)} %${differe}. Issu du simulateur FDI : simulation indicative, non contractuelle.`,
  }
}
