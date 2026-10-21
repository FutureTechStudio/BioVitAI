import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractionGoldens,
  goldenDocument,
} from './fixtures/extraction-goldens.mjs';
import { createLocalReportProcessor } from '../dist/infrastructure/reports/local-processor.js';
import { parseReportLine } from '../dist/modules/health/src/domain/extraction.js';
test(
  '56 synthetic documents retain exact expected result fields and source boxes',
  { timeout: 240000 },
  async () => {
    const processor = createLocalReportProcessor();
    for (const fixture of extractionGoldens) {
      const input = await goldenDocument(fixture),
        pages = await processor.extract(input.bytes, input.mediaType);
      assert.equal(
        pages.length,
        fixture.format === 'pdf' ? fixture.pages : 1,
        fixture.id,
      );
      const candidates = pages
        .flatMap((p) =>
          p.lines.map((line) => ({ line, parsed: parseReportLine(line) })),
        )
        .filter((v) => v.parsed);
      assert.ok(candidates.length, fixture.id + ' no result recognized');
      for (const candidate of candidates) {
        assert.deepEqual(candidate.parsed, fixture.expected, fixture.id);
        assert.ok(candidate.line.box.x1 > candidate.line.box.x0);
        assert.ok(candidate.line.box.y1 > candidate.line.box.y0);
      }
    }
  },
);
