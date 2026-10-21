import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
const errors = [];
async function scan(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.posix.join(dir, e.name);
    if (e.isDirectory()) await scan(file);
    else if (file.endsWith('.tsx')) {
      const source = ts.createSourceFile(
        file,
        await fs.readFile(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      function visit(n) {
        if (
          ts.isStringLiteral(n) &&
          (/#[a-f0-9]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(n.text) ||
            /^(white|black)$/i.test(n.text))
        )
          errors.push(file + ': hardcoded color ' + n.text);
        ts.forEachChild(n, visit);
      }
      visit(source);
    }
  }
}
await scan('apps/web/src');
await scan('apps/web/app');
await scan('apps/mobile/src');
const css = await fs.readFile('apps/web/app/style.css', 'utf8');
if (/#[a-f0-9]{3,8}\b|\brgba?\(|\bhsla?\(/i.test(css))
  errors.push('apps/web/app/style.css: hardcoded color outside token adapter');
if (errors.length) throw Error(errors.join('\n'));
console.log('PASS: frontend colors use BioFlow tokens');
