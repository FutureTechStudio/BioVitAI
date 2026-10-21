import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export function inspectSource(filename, source) {
  const file = filename.replaceAll('\\', '/');
  const violations = [];
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const moduleName = file.match(/^modules\/([^/]+)\//)?.[1];
  const domain = file.includes('/domain/');
  const gateway = file.startsWith('infrastructure/ai-gateway/');
  const browserTransport = [
    'apps/web/src/api.ts',
    'apps/mobile/src/api.ts',
  ].includes(file);
  function fail(message) {
    violations.push(`${file}: ${message}`);
  }
  function inspectImport(specifier) {
    // Fail closed for internal aliases until they are registered/resolved here.
    // Otherwise a new tsconfig path or package alias could bypass relative-path checks.
    if (
      specifier.startsWith('@biovitai/') &&
      specifier !== '@biovitai/contracts'
    )
      fail('Unregistered internal package alias');
    if (
      specifier.startsWith('@/') ||
      specifier.startsWith('~/') ||
      specifier.startsWith('#')
    )
      fail('Unregistered internal path alias');
    const resolved = specifier.startsWith('.')
      ? path.posix.normalize(
          path.posix.join(path.posix.dirname(file), specifier),
        )
      : specifier === '@biovitai/contracts'
        ? 'shared/contracts/src/index.ts'
        : specifier;
    const targetModule = resolved.match(/^modules\/([^/]+)\//)?.[1];
    if (
      moduleName &&
      targetModule &&
      moduleName !== targetModule &&
      !resolved.includes('/contracts/')
    )
      fail('Cross-module imports must use contracts');
    if (
      file.startsWith('apps/') &&
      !file.startsWith('apps/api/') &&
      !file.startsWith('apps/worker/') &&
      /^(modules|infrastructure)\//.test(resolved)
    )
      fail('Clients may import only public contracts');
    if (
      file.includes('/controllers/') &&
      /\/(domain|infrastructure)\//.test(resolved)
    )
      fail('Controllers must use application services');
    if (
      domain &&
      !resolved.startsWith('shared/contracts/') &&
      resolved !== 'zod' &&
      !(moduleName && resolved.startsWith(`modules/${moduleName}/src/domain/`))
    )
      fail('Domain must remain pure');
    if (
      !gateway &&
      /(?:openai|anthropic|google.*genai|azure.*inference|@ai-sdk|^ai$)/i.test(
        specifier,
      )
    )
      fail('Provider SDK outside AI Gateway');
    if (
      file.startsWith('modules/ai/') &&
      /(?:infrastructure\/|prisma|drizzle|^pg$|sqlite|redis)/i.test(resolved)
    )
      fail('AI may use tool and Gateway contracts only');
    if (
      file.startsWith('shared/') &&
      /^(modules|apps|infrastructure)\//.test(resolved)
    )
      fail('Shared contracts cannot depend on implementation');
    if (
      file.includes('/application/') &&
      /(?:^|\/)infrastructure\//.test(resolved)
    )
      fail('Application services depend on ports, not infrastructure');
    if (
      !gateway &&
      file !== 'infrastructure/http/server.ts' &&
      /^(?:node:)?(?:https?|http2|net|tls)$|^(?:axios|undici)(?:\/|$)/.test(
        specifier,
      )
    )
      fail('Network clients require an infrastructure architecture review');
  }
  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      inspectImport(node.moduleSpecifier.text);
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      inspectImport(node.argument.literal.text);
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const argument = node.moduleReference.expression;
      if (argument && ts.isStringLiteral(argument))
        inspectImport(argument.text);
    }
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(ast);
      if (
        name === 'require' ||
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        const argument = node.arguments[0];
        if (
          argument &&
          (ts.isStringLiteral(argument) ||
            ts.isNoSubstitutionTemplateLiteral(argument))
        )
          inspectImport(argument.text);
        else fail('Computed imports require an explicit architecture review');
      }
      if (
        !gateway &&
        !browserTransport &&
        ['fetch', 'globalThis.fetch'].includes(name)
      )
        fail('Network access must use infrastructure adapters');
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return violations;
}

export function scan(root) {
  const violations = [];
  function walk(folder) {
    if (!fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (
        entry.isDirectory() &&
        !['.next', 'node_modules', '.expo', 'android', 'ios', 'dist'].includes(
          entry.name,
        )
      )
        walk(full);
      else if (/\.[cm]?[jt]sx?$/.test(entry.name))
        violations.push(
          ...inspectSource(
            path.relative(root, full),
            fs.readFileSync(full, 'utf8'),
          ),
        );
    }
  }
  for (const folder of ['apps', 'modules', 'shared', 'infrastructure'])
    walk(path.join(root, folder));
  return violations;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const violations = scan(process.cwd());
  if (violations.length) {
    console.error(violations.join('\n'));
    process.exitCode = 1;
  } else console.log('PASS: module import boundaries');
}
