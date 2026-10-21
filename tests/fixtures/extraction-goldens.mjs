import sharp from 'sharp';
import { Buffer } from 'node:buffer';
// Synthetic engineering fixtures only. No clinical interpretation or human approval.
export const extractionGoldens = Array.from({ length: 56 }, (_, index) => {
  const comparator = ['=', '<', '>', '<=', '>='][index % 5],
    amount = `${10 + index}.50`,
    name = 'Synthetic Marker',
    unit = 'mg/L';
  const kind =
    index % 14 === 12
      ? 'qualitative'
      : index % 14 === 13
        ? 'missing'
        : 'quantity';
  const row =
    kind === 'quantity'
      ? `${name} ${comparator === '=' ? '' : comparator}${amount} ${unit}`
      : kind === 'qualitative'
        ? `${name} Positive`
        : `${name} Not performed`;
  return {
    id: `SYN-${String(index + 1).padStart(3, '0')}`,
    format: ['png', 'jpeg', 'webp', 'tiff', 'pdf'][index % 5],
    pages: index % 7 === 0 ? 2 : 1,
    identity:
      index % 11 === 0 ? 'conflict' : index % 11 === 1 ? 'missing' : 'pending',
    relationship:
      index === 54 ? 'duplicate' : index === 55 ? 'amendment' : 'distinct',
    row,
    expected: {
      originalName: name,
      value:
        kind === 'quantity'
          ? { kind, comparator, amount }
          : kind === 'qualitative'
            ? { kind, text: 'Positive' }
            : { kind, reason: 'Not performed' },
      unit: kind === 'quantity' ? unit : null,
      referenceText: null,
    },
  };
});
function pdf(pages) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', ''];
  const refs = [];
  for (const lines of pages) {
    const pageId = objects.length + 1,
      contentId = pageId + 1;
    refs.push(`${pageId} 0 R`);
    const content =
      'BT /F1 22 Tf ' +
      lines
        .map(
          (line, i) =>
            `1 0 0 1 30 ${260 - i * 55} Tm (${line.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')}) Tj`,
        )
        .join(' ') +
      ' ET';
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 700 330] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
  }
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${refs.join(' ')}] >>`;
  let result = '%PDF-1.4\n',
    offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(result));
    result += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(result);
  result +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
      .join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(result);
}
export async function goldenDocument(test) {
  const lines = [
    ...(test.identity === 'missing' ? [] : ['Patient: Synthetic Subject']),
    ...(test.identity === 'conflict' ? ['Patient: Different Subject'] : []),
    test.row,
  ];
  if (test.format === 'pdf')
    return {
      mediaType: 'application/pdf',
      bytes: pdf(Array.from({ length: test.pages }, () => lines)),
    };
  const xml = lines
    .map(
      (text, i) =>
        `<text x="40" y="${70 + i * 70}" font-family="Arial" font-size="36">${text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</text>`,
    )
    .join('');
  const bytes = await sharp(
    Buffer.from(
      `<svg width="1400" height="400"><rect width="1400" height="400" fill="white"/>${xml}</svg>`,
    ),
  )
    .toFormat(test.format)
    .toBuffer();
  return { mediaType: 'image/' + test.format, bytes };
}
