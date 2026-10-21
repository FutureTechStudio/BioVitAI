import type { ObservationEvidence } from '../../../../shared/contracts/src/intelligence.js';
// Exact verified context only. No inferred concepts, conversion or aggregation.
export function analyzeEvidence(rows: ObservationEvidence[]) {
  const groups = new Map<string, ObservationEvidence[]>(),
    exclusions: { observation: ObservationEvidence; reason: string }[] = [];
  for (const row of rows) {
    const missing = [
      'conceptSystem',
      'conceptCode',
      'specimen',
      'method',
      'unit',
      'date',
    ].filter((key) => !row[key as keyof ObservationEvidence]);
    if (missing.length) {
      exclusions.push({
        observation: row,
        reason: 'Missing verified ' + missing.join(', '),
      });
      continue;
    }
    if (row.amount === null || row.comparator !== '=') {
      exclusions.push({
        observation: row,
        reason:
          'Non-exact or non-numeric result; source comparator is preserved',
      });
      continue;
    }
    const key = JSON.stringify([
      row.conceptSystem,
      row.conceptCode,
      row.specimen,
      row.method,
      row.unit,
    ]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return {
    version: '1.0.0',
    cohorts: [...groups.values()].map((observations) => ({
      label: observations[0]!.name,
      unit: observations[0]!.unit,
      observations: observations.sort(
        (a, b) => a.date!.localeCompare(b.date!) || a.id.localeCompare(b.id),
      ),
    })),
    exclusions,
    organs: ['Heart', 'Liver', 'Kidneys', 'Thyroid', 'Metabolic'].map(
      (name) => ({
        name,
        state: 'not_assessed',
        reason: 'No approved organ interpretation rules are active',
      }),
    ),
    aggregation: 'disabled',
    normalization: 'disabled',
  };
}
export function compareEvidence(
  rows: ObservationEvidence[],
  left: string,
  right: string,
) {
  const selected = rows.filter(
      (r) => r.reportId === left || r.reportId === right,
    ),
    analysis = analyzeEvidence(selected);
  const paired = new Set(
    analysis.cohorts
      .filter(
        (c) =>
          c.observations.some((r) => r.reportId === left) &&
          c.observations.some((r) => r.reportId === right),
      )
      .flatMap((c) => c.observations.map((o) => o.id)),
  );
  return {
    ...analysis,
    left,
    right,
    exclusions: [
      ...analysis.exclusions,
      ...analysis.cohorts.flatMap((c) =>
        c.observations
          .filter((o) => !paired.has(o.id))
          .map((observation) => ({
            observation,
            reason:
              'No counterpart with identical verified concept, specimen, method and unit in the other report',
          })),
      ),
    ],
    pairs: analysis.cohorts.flatMap((c) =>
      c.observations
        .filter((r) => r.reportId === left)
        .flatMap((a) =>
          c.observations
            .filter((r) => r.reportId === right)
            .map((b) => ({
              left: a,
              right: b,
              reason:
                'Exact verified concept, specimen, method and unit; results remain distinct',
            })),
        ),
    ),
  };
}
