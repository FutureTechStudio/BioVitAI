import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import sharp from 'sharp';
import {
  createLocalReportProcessor,
  pdfTextPages,
} from '../dist/infrastructure/reports/local-processor.js';

test('embedded PDF extraction retains comparator text, pages and valid source boxes', () => {
  const lines = pdfTextPages(
    '<doc><page width="200" height="100"><line xMin="10" yMin="20" xMax="100" yMax="40"><word>Glucose</word><word>&lt;5.90</word><word>mmol/L</word></line><line xMin="190" yMin="20" xMax="210" yMax="40"><word>invalid box</word></line></page><page width="200" height="100"></page></doc>',
  );
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0], [
    {
      text: 'Glucose <5.90 mmol/L',
      box: { x0: 0.05, y0: 0.2, x1: 0.5, y1: 0.4 },
      confidence: null,
    },
  ]);
  assert.deepEqual(lines[1], []);
});

test(
  'local OCR reads a real synthetic PNG and returns genuine source coordinates',
  { timeout: 60000 },
  async () => {
    const svg =
      '<svg width="1200" height="400"><rect width="1200" height="400" fill="white"/><text x="40" y="80" font-family="Arial" font-size="36" fill="black">Patient: Synthetic Subject</text><text x="40" y="160" font-family="Arial" font-size="36" fill="black">Glucose 5.90 mmol/L</text></svg>';
    const bytes = await sharp(Buffer.from(svg)).png().toBuffer();
    const pages = await createLocalReportProcessor().extract(
      bytes,
      'image/png',
    );
    assert.equal(pages.length, 1);
    assert.ok(
      pages[0].lines.some(
        (l) => l.text.includes('Glucose') && l.text.includes('5.90'),
      ),
    );
    for (const line of pages[0].lines) {
      assert.ok(
        line.box.x0 >= 0 &&
          line.box.y0 >= 0 &&
          line.box.x1 <= 1 &&
          line.box.y1 <= 1,
      );
      assert.ok(line.box.x0 < line.box.x1 && line.box.y0 < line.box.y1);
    }
  },
);
