/**
 * ContentOS — Evidence Extraction & Origin Fidelity Validator
 *
 * Implements SPEC03 §5.1–5.4, §35–42:
 *   - Prohibits semantic strengthening:
 *       * may -> will
 *       * associated with -> causes
 *       * observed -> proven
 *       * reported -> established fact
 *   - Prohibits dropping material qualifications:
 *       * population scope (e.g. animal/in-vitro vs human)
 *       * jurisdiction scope (e.g. state/country specific)
 *       * measurement conditions (e.g. distance, temperature, dosage)
 *       * temporal scope (e.g. observation window)
 */
import { RegistryValidationError } from '../services/registry-validator.js';

export interface EvidenceExtractionParams {
  sourceContent: string;
  extractedStatement: string;
  qualifiers?: string[];
  conditions?: string[];
  populationScope?: string | null;
  jurisdictionScope?: string | null;
  measurementBasis?: string | null;
  timeWindow?: string | null;
}

const STRENGTHENING_PATTERNS: Array<{
  sourceRegex: RegExp;
  targetRegex: RegExp;
  errorMsg: string;
}> = [
  {
    sourceRegex: /\b(may|might|could|possibly|potential)\b/i,
    targetRegex: /\b(will|shall|must|always|guarantees)\b/i,
    errorMsg: 'Prohibited semantic strengthening: tentative modality ("may/might/could") converted to definitive assertion ("will/must/guarantees").',
  },
  {
    sourceRegex: /\b(associated with|correlated with|linked to|relationship between)\b/i,
    targetRegex: /\b(causes|causes of|leads to|results in|drives)\b/i,
    errorMsg: 'Prohibited causal strengthening: correlational relation ("associated with") converted to causal claim ("causes/drives").',
  },
  {
    sourceRegex: /\b(observed|suggests|indicates|preliminary observation)\b/i,
    targetRegex: /\b(proven|proves|established truth|factually proven)\b/i,
    errorMsg: 'Prohibited epistemic strengthening: observational finding ("observed/suggests") converted to proven certainty ("proven").',
  },
  {
    sourceRegex: /\b(reported by|self-reported|reported|claims to have)\b/i,
    targetRegex: /\b(established fact|verified fact|ground truth)\b/i,
    errorMsg: 'Prohibited epistemic strengthening: reported claim ("reported by") converted to established fact ("established fact").',
  },
];

const MATERIAL_POPULATION_KEYWORDS = [
  'in mice',
  'in rats',
  'in rodents',
  'in vitro',
  'adults aged 65+',
  'pediatric patients',
  'infants',
  'pregnant individuals',
];

const MATERIAL_JURISDICTION_KEYWORDS = [
  'in california',
  'in the european union',
  'under uk law',
  'in singapore',
  'in germany',
];

const MATERIAL_MEASUREMENT_KEYWORDS = [
  'at 1 metre',
  'at 1 meter',
  'at 3 metres',
  'at 3 meters',
  'at 50°c',
  'at 100 psi',
  'over 14 days',
  'over 24 hours',
];

export function validateEvidenceExtractionFidelity(params: EvidenceExtractionParams): void {
  const {
    sourceContent,
    extractedStatement,
    qualifiers = [],
    conditions = [],
    populationScope,
    jurisdictionScope,
    measurementBasis,
  } = params;

  const lowerSource = sourceContent.toLowerCase();
  const lowerExtracted = extractedStatement.toLowerCase();

  // 1. Semantic strengthening checks
  for (const pattern of STRENGTHENING_PATTERNS) {
    if (pattern.sourceRegex.test(sourceContent) && pattern.targetRegex.test(extractedStatement)) {
      throw new RegistryValidationError(
        'EVIDENCE_SEMANTIC_STRENGTHENING_PROHIBITED',
        pattern.errorMsg,
      );
    }
  }

  // 2. Material population scope dropped
  for (const pop of MATERIAL_POPULATION_KEYWORDS) {
    if (lowerSource.includes(pop)) {
      const preservedInStatement = lowerExtracted.includes(pop);
      const preservedInScope = populationScope && populationScope.toLowerCase().includes(pop.replace(/^in\s+/, ''));
      const preservedInQualifiers = qualifiers.some((q) => q.toLowerCase().includes(pop));
      if (!preservedInStatement && !preservedInScope && !preservedInQualifiers) {
        throw new RegistryValidationError(
          'MATERIAL_POPULATION_SCOPE_DROPPED',
          `Material population qualification '${pop}' present in source was dropped from extracted evidence.`,
        );
      }
    }
  }

  // 3. Material jurisdiction scope dropped
  for (const jur of MATERIAL_JURISDICTION_KEYWORDS) {
    if (lowerSource.includes(jur)) {
      const preservedInStatement = lowerExtracted.includes(jur);
      const preservedInScope = jurisdictionScope && jurisdictionScope.toLowerCase().includes(jur.replace(/^in\s+(the\s+)?/, ''));
      const preservedInQualifiers = qualifiers.some((q) => q.toLowerCase().includes(jur));
      if (!preservedInStatement && !preservedInScope && !preservedInQualifiers) {
        throw new RegistryValidationError(
          'MATERIAL_JURISDICTION_SCOPE_DROPPED',
          `Material jurisdiction qualification '${jur}' present in source was dropped from extracted evidence.`,
        );
      }
    }
  }

  // 4. Material measurement / condition dropped
  for (const meas of MATERIAL_MEASUREMENT_KEYWORDS) {
    if (lowerSource.includes(meas)) {
      const preservedInStatement = lowerExtracted.includes(meas);
      const preservedInConditions = conditions.some((c) => c.toLowerCase().includes(meas));
      const preservedInBasis = measurementBasis && measurementBasis.toLowerCase().includes(meas);
      if (!preservedInStatement && !preservedInConditions && !preservedInBasis) {
        throw new RegistryValidationError(
          'MATERIAL_MEASUREMENT_CONDITION_DROPPED',
          `Material measurement condition '${meas}' present in source was dropped from extracted evidence.`,
        );
      }
    }
  }
}
