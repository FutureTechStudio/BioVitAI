import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { ReportError } from '../../modules/health/src/contracts/ingestion.js';
import type {
  ExtractedLine,
  ExtractedPage,
  ReportProcessor,
} from '../../modules/health/src/contracts/ingestion.js';

const execute = promisify(execFile);
export function pdfTextPages(xml: string) {
  const decode = (value: string) =>
    value
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'");
  return [
    ...xml.matchAll(
      /<page\s+width="([\d.]+)"\s+height="([\d.]+)"[^>]*>([\s\S]*?)<\/page>/g,
    ),
  ].map((page) => {
    const width = Number(page[1]),
      height = Number(page[2]);
    if (!width || !height) return [];
    return [
      ...page[3]!.matchAll(
        /<line\s+xMin="([\d.]+)"\s+yMin="([\d.]+)"\s+xMax="([\d.]+)"\s+yMax="([\d.]+)"[^>]*>([\s\S]*?)<\/line>/g,
      ),
    ].flatMap((line) => {
      const text = [...line[5]!.matchAll(/<word[^>]*>([\s\S]*?)<\/word>/g)]
          .map((w) => decode(w[1]!))
          .join(' '),
        box = {
          x0: Number(line[1]) / width,
          y0: Number(line[2]) / height,
          x1: Number(line[3]) / width,
          y1: Number(line[4]) / height,
        };
      return text &&
        box.x0 >= 0 &&
        box.y0 >= 0 &&
        box.x1 <= 1 &&
        box.y1 <= 1 &&
        box.x0 < box.x1 &&
        box.y0 < box.y1
        ? [{ text, box, confidence: null }]
        : [];
    });
  });
}
function binary(name: string, env: Record<string, string | undefined>) {
  if (name === 'clamscan')
    return (
      env.CLAMSCAN_PATH ??
      (process.platform === 'win32'
        ? path.resolve('.local/tools/clamav/clamav-1.5.4.win.x64/clamscan.exe')
        : 'clamscan')
    );
  return env.POPPLER_BIN_DIR
    ? path.join(
        env.POPPLER_BIN_DIR,
        name + (process.platform === 'win32' ? '.exe' : ''),
      )
    : name;
}
async function scratch<T>(work: (directory: string) => Promise<T>) {
  const base = path.resolve('.local/report-scratch');
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const directory = path.join(base, randomUUID());
  await fs.mkdir(directory, { mode: 0o700 });
  if (path.dirname(directory) !== base) throw new Error('Unsafe scratch path');
  try {
    return await work(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
function linesFromTsv(
  tsv: string,
  width: number,
  height: number,
): ExtractedLine[] {
  const groups = new Map<
    string,
    {
      words: string[];
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      confidence: number[];
    }
  >();
  for (const raw of tsv.split(/\r?\n/).slice(1)) {
    const cells = raw.split('\t');
    if (cells[0] !== '5' || !cells[11]?.trim()) continue;
    const [x, y, w, h, confidence] = cells.slice(6, 11).map(Number) as [
      number,
      number,
      number,
      number,
      number,
    ];
    if (
      ![x, y, w, h, confidence].every(Number.isFinite) ||
      w <= 0 ||
      h <= 0 ||
      x < 0 ||
      y < 0
    )
      continue;
    const key = cells.slice(1, 5).join(':');
    const old = groups.get(key) ?? {
      words: [],
      x0: x,
      y0: y,
      x1: x + w,
      y1: y + h,
      confidence: [],
    };
    old.words.push(cells.slice(11).join('\t').trim());
    old.x0 = Math.min(old.x0, x);
    old.y0 = Math.min(old.y0, y);
    old.x1 = Math.max(old.x1, x + w);
    old.y1 = Math.max(old.y1, y + h);
    old.confidence.push(confidence);
    groups.set(key, old);
  }
  return [...groups.values()].map((g) => ({
    text: g.words.join(' '),
    box: {
      x0: Math.max(0, g.x0 / width),
      y0: Math.max(0, g.y0 / height),
      x1: Math.min(1, g.x1 / width),
      y1: Math.min(1, g.y1 / height),
    },
    confidence: Math.max(
      0,
      Math.min(
        1,
        g.confidence.reduce((a, b) => a + b, 0) / g.confidence.length / 100,
      ),
    ),
  }));
}
export function createLocalReportProcessor(
  env: Record<string, string | undefined> = process.env,
): ReportProcessor {
  return {
    async scan(bytes) {
      return scratch(async (dir) => {
        const file = path.join(dir, 'original');
        await fs.writeFile(file, bytes, { mode: 0o600, flag: 'wx' });
        try {
          const result = await execute(
            binary('clamscan', env),
            [
              '--database=' +
                (env.CLAMAV_DATABASE_DIR ??
                  path.resolve('.local/tools/clamav/database')),
              '--max-filesize=20M',
              '--max-scansize=40M',
              '--alert-exceeds-max=yes',
              '--fail-if-cvd-older-than=7',
              file,
            ],
            { windowsHide: true, timeout: 60000, maxBuffer: 16384 },
          );
          if (
            !/Known viruses:\s*[1-9]\d*/i.test(result.stdout) ||
            !/Scanned files:\s*1\b/i.test(result.stdout)
          )
            throw new ReportError('SCANNER_UNAVAILABLE', 503);
          return 'clean' as const;
        } catch (error) {
          if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            error.code === 1
          )
            return 'infected' as const;
          throw new ReportError('SCANNER_UNAVAILABLE', 503);
        }
      });
    },
    async extract(bytes, mediaType) {
      return scratch(async (dir) => {
        const images: Uint8Array[] = [];
        let embedded: ExtractedLine[][] = [];
        const deadline = Date.now() + 240000;
        let total = 0;
        function check(png?: Uint8Array) {
          if (png) total += png.byteLength;
          if (Date.now() > deadline || total > 80 * 1024 * 1024)
            throw new ReportError('EXTRACTION_RESOURCE_LIMIT');
        }
        try {
          if (mediaType === 'application/pdf') {
            const pdf = path.join(dir, 'original.pdf');
            await fs.writeFile(pdf, bytes, { mode: 0o600, flag: 'wx' });
            let info: string;
            try {
              info = (
                await execute(binary('pdfinfo', env), [pdf], {
                  windowsHide: true,
                  timeout: 15000,
                  maxBuffer: 65536,
                })
              ).stdout;
            } catch (error) {
              if (
                error &&
                typeof error === 'object' &&
                'code' in error &&
                error.code === 'ENOENT'
              )
                throw new ReportError('OCR_UNAVAILABLE', 503);
              throw new ReportError('INVALID_DOCUMENT');
            }
            if (!/^Encrypted:\s+no\b/im.test(info))
              throw new ReportError('ENCRYPTED_PDF');
            const count = Number(/^Pages:\s+(\d+)/im.exec(info)?.[1]);
            if (!Number.isInteger(count) || count < 1 || count > 50)
              throw new ReportError('PAGE_LIMIT');
            try {
              const textFile = path.join(dir, 'embedded.xhtml');
              await execute(
                binary('pdftotext', env),
                ['-bbox-layout', '-enc', 'UTF-8', pdf, textFile],
                { windowsHide: true, timeout: 15000, maxBuffer: 16384 },
              );
              const stat = await fs.stat(textFile);
              if (stat.size <= 4 * 1024 * 1024)
                embedded = pdfTextPages(await fs.readFile(textFile, 'utf8'));
            } catch {
              /* Missing or unsupported embedded extraction falls back to bounded local OCR. */
            }
            for (let page = 1; page <= count; page++) {
              check();
              const prefix = path.join(dir, `page-${page}`);
              await execute(
                binary('pdftoppm', env),
                [
                  '-f',
                  String(page),
                  '-l',
                  String(page),
                  '-singlefile',
                  '-r',
                  '150',
                  '-scale-to',
                  '3000',
                  '-png',
                  pdf,
                  prefix,
                ],
                { windowsHide: true, timeout: 30000, maxBuffer: 16384 },
              );
              const png = await fs.readFile(prefix + '.png');
              check(png);
              images.push(png);
            }
          } else {
            const info = await sharp(bytes, {
              limitInputPixels: 40_000_000,
              failOn: 'warning',
              animated: true,
            }).metadata();
            if (!['png', 'jpeg', 'tiff', 'webp'].includes(info.format ?? ''))
              throw new ReportError('INVALID_DOCUMENT');
            const count = info.pages ?? 1;
            if (count > 50) throw new ReportError('PAGE_LIMIT');
            for (let page = 0; page < count; page++) {
              check();
              const png = await sharp(bytes, {
                page,
                pages: 1,
                limitInputPixels: 40_000_000,
                failOn: 'warning',
              })
                .rotate()
                .resize({
                  width: 3000,
                  height: 3000,
                  fit: 'inside',
                  withoutEnlargement: true,
                })
                .png()
                .toBuffer();
              check(png);
              images.push(png);
            }
          }
          const language = path.resolve(
            'node_modules/@tesseract.js-data/eng/4.0.0_best_int',
          );
          let worker;
          try {
            worker = await createWorker('eng', 1, {
              langPath: language,
              cachePath: dir,
              logger: () => {},
              errorHandler: () => {},
            });
          } catch {
            throw new ReportError('OCR_UNAVAILABLE', 503);
          }
          try {
            const pages: ExtractedPage[] = [];
            for (const png of images) {
              check();
              const meta = await sharp(png, {
                limitInputPixels: 40_000_000,
              }).metadata();
              const width = meta.width!,
                height = meta.height!;
              const textLines = embedded[pages.length];
              if (textLines?.length) {
                pages.push({ png, width, height, lines: textLines });
                continue;
              }
              let timer: ReturnType<typeof setTimeout> | undefined;
              const result = await Promise.race([
                worker.recognize(
                  Buffer.from(png),
                  {},
                  { tsv: true, text: true },
                ),
                new Promise<never>((_, reject) => {
                  timer = setTimeout(
                    () => reject(new ReportError('OCR_DEADLINE')),
                    Math.max(1, deadline - Date.now()),
                  );
                }),
              ]).finally(() => {
                if (timer) clearTimeout(timer);
              });
              const lines = linesFromTsv(result.data.tsv ?? '', width, height);
              pages.push({ png, width, height, lines });
            }
            return pages;
          } finally {
            await worker.terminate();
          }
        } catch (error) {
          if (error instanceof ReportError) throw error;
          throw new ReportError('INVALID_DOCUMENT');
        }
      });
    },
  };
}
