// Layout recognition supplies rows; this parser never guesses concepts, dates or units.
export function parseReportLine(line: { text: string }) {
  const match =
    /^(.+?)\s+(<=|>=|<|>|=)?\s*(-?(?:0|[1-9]\d*)(?:\.\d+)?)\s+([^\s]+)(?:\s+(.+))?$/.exec(
      line.text.trim(),
    );
  if (!match || !/[A-Za-z]/.test(match[1]!)) {
    const qualitative =
      /^(.+?)\s+(positive|negative|not detected|detected|reactive|nonreactive)$/i.exec(
        line.text.trim(),
      );
    if (qualitative)
      return {
        originalName: qualitative[1]!.trim(),
        value: { kind: 'qualitative' as const, text: qualitative[2]! },
        unit: null,
        referenceText: null,
      };
    const missing =
      /^(.+?)\s+(not performed|insufficient sample|not available)$/i.exec(
        line.text.trim(),
      );
    if (missing)
      return {
        originalName: missing[1]!.trim(),
        value: { kind: 'missing' as const, reason: missing[2]! },
        unit: null,
        referenceText: null,
      };
    return null;
  }
  return {
    originalName: match[1]!.trim(),
    value: {
      kind: 'quantity' as const,
      comparator: match[2] ?? '=',
      amount: match[3]!,
    },
    unit: match[4]!,
    referenceText: match[5] ?? null,
  };
}
