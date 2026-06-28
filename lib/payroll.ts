/**
 * Calcul de paie simplifié — législation belge (estimation).
 *
 * Sens « employeur » : on part du NET versé au travailleur et on remonte
 * au BRUT puis au COÛT TOTAL employeur (brut + cotisations patronales).
 *
 * ⚠️ Estimation. La paie belge réelle dépend de la situation familiale,
 * des réductions (bonus à l'emploi, frais forfaitaires), des barèmes de
 * précompte professionnel officiels, des CP sectorielles, etc.
 * Les taux sont paramétrables dans les Réglages.
 */

export type Statut = "employe" | "etudiant" | "flexi" | "independant";

export interface PayrollParams {
  /** Cotisation ONSS travailleur (employé/ouvrier), ex. 0.1307 */
  onssWorkerRate: number;
  /** Cotisation de solidarité étudiant, ex. 0.0271 */
  onssStudentRate: number;
  /** Cotisation patronale ONSS (approx.), ex. 0.25 */
  employerOnssRate: number;
}

export const DEFAULT_PARAMS: PayrollParams = {
  onssWorkerRate: 0.1307,
  onssStudentRate: 0.0271,
  employerOnssRate: 0.25,
};

export interface PayBreakdown {
  statut: Statut;
  brut: number; // salaire brut (mensuel)
  onssWorker: number; // cotisation travailleur retenue
  imposable: number; // base imposable
  precompte: number; // précompte professionnel
  net: number; // net en poche
  employerOnss: number; // cotisation patronale
  employerCost: number; // coût total pour l'employeur (brut + patronal)
}

/**
 * Barème d'impôt des personnes physiques (Belgique, ordre de grandeur 2024),
 * appliqué sur le revenu IMPOSABLE ANNUEL. Quotité exemptée incluse.
 */
const TAX_FREE = 10160; // quotité du revenu exemptée d'impôt (annuel)
const BRACKETS: Array<{ upTo: number; rate: number }> = [
  { upTo: 15820, rate: 0.25 },
  { upTo: 27920, rate: 0.4 },
  { upTo: 48320, rate: 0.45 },
  { upTo: Infinity, rate: 0.5 },
];

/** Impôt annuel sur un revenu imposable annuel (au-delà de la quotité exemptée). */
function annualTax(annualTaxable: number): number {
  let taxable = Math.max(0, annualTaxable - TAX_FREE);
  let tax = 0;
  let lower = 0;
  for (const b of BRACKETS) {
    if (taxable <= 0) break;
    const span = Math.min(taxable, b.upTo - lower);
    if (span > 0) {
      tax += span * b.rate;
      taxable -= span;
      lower = b.upTo;
    }
  }
  return tax;
}

/** Précompte professionnel mensuel estimé à partir d'un imposable mensuel. */
export function monthlyWithholding(monthlyImposable: number): number {
  if (monthlyImposable <= 0) return 0;
  return annualTax(monthlyImposable * 12) / 12;
}

/**
 * BRUT mensuel -> détail complet (net, cotisations, coût employeur).
 */
export function fromGross(
  brut: number,
  statut: Statut,
  params: PayrollParams = DEFAULT_PARAMS
): PayBreakdown {
  brut = Math.max(0, brut);

  if (statut === "independant") {
    // Pas de paie : le montant facturé est le coût. Pas de cotisation employeur.
    return {
      statut,
      brut,
      onssWorker: 0,
      imposable: brut,
      precompte: 0,
      net: brut,
      employerOnss: 0,
      employerCost: brut,
    };
  }

  if (statut === "flexi") {
    // Flexi-job : net = brut (exonéré ONSS travailleur + précompte).
    // Cotisation patronale spéciale (~25%).
    const employerOnss = brut * params.employerOnssRate;
    return {
      statut,
      brut,
      onssWorker: 0,
      imposable: 0,
      precompte: 0,
      net: brut,
      employerOnss,
      employerCost: brut + employerOnss,
    };
  }

  if (statut === "etudiant") {
    // Étudiant (dans le quota) : cotisation de solidarité, pas de précompte.
    const onssWorker = brut * params.onssStudentRate;
    const employerOnss = brut * 0.0542; // solidarité patronale ~5,42%
    return {
      statut,
      brut,
      onssWorker,
      imposable: brut - onssWorker,
      precompte: 0,
      net: brut - onssWorker,
      employerOnss,
      employerCost: brut + employerOnss,
    };
  }

  // Employé / ouvrier régulier
  const onssWorker = brut * params.onssWorkerRate;
  const imposable = brut - onssWorker;
  const precompte = monthlyWithholding(imposable);
  const net = imposable - precompte;
  const employerOnss = brut * params.employerOnssRate;
  return {
    statut,
    brut,
    onssWorker,
    imposable,
    precompte,
    net,
    employerOnss,
    employerCost: brut + employerOnss,
  };
}

/**
 * NET mensuel souhaité -> BRUT (recherche par dichotomie sur fromGross).
 * Le net est croissant avec le brut, donc la dichotomie converge.
 */
export function fromNet(
  net: number,
  statut: Statut,
  params: PayrollParams = DEFAULT_PARAMS
): PayBreakdown {
  net = Math.max(0, net);
  if (net === 0) return fromGross(0, statut, params);

  let lo = net; // le brut est toujours >= net
  let hi = net * 3 + 1000; // borne haute large
  // garantir que hi.net >= net
  for (let i = 0; i < 40 && fromGross(hi, statut, params).net < net; i++) hi *= 2;

  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const r = fromGross(mid, statut, params).net;
    if (Math.abs(r - net) < 0.01) {
      lo = hi = mid;
      break;
    }
    if (r < net) lo = mid;
    else hi = mid;
  }
  return fromGross((lo + hi) / 2, statut, params);
}

/**
 * Calcule le détail à partir d'un montant qui est soit un net, soit un brut.
 */
export function compute(
  amount: number,
  statut: Statut,
  basis: "net" | "brut",
  params: PayrollParams = DEFAULT_PARAMS
): PayBreakdown {
  return basis === "net"
    ? fromNet(amount, statut, params)
    : fromGross(amount, statut, params);
}
