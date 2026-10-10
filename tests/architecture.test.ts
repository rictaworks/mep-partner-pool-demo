import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}

it('preserves the original requirements byte-for-byte', () => {
  const bytes = readFileSync('requirements.md');
  expect(bytes.length).toBe(21184);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(
    '89ad526d468315e1e009037fe57b2d572ba2d03d9beb46a7961d7ab48d568fd6',
  );
});

it('keeps core imports inside core and prevents UI/HTTP adapter coupling', () => {
  const core = resolve('src/core') + sep;
  const frontend = resolve('src/frontend') + sep;
  const backend = resolve('src/backend') + sep;
  for (const file of sources(resolve('src'))) {
    const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function checkImport(specifier: string): void {
      const target = resolve(dirname(file), specifier);
      if (file.startsWith(core)) {
        expect(specifier.startsWith('.'), `${file}: core cannot import a package`).toBe(true);
        expect(target.startsWith(core), `${file}: core import escapes its boundary`).toBe(true);
      }
      if (file.startsWith(frontend)) expect(target.startsWith(backend)).toBe(false);
      if (file.startsWith(backend)) expect(target.startsWith(frontend)).toBe(false);
    }
    function visit(node: ts.Node): void {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        expect(ts.isStringLiteral(node.moduleSpecifier)).toBe(true);
        if (ts.isStringLiteral(node.moduleSpecifier)) checkImport(node.moduleSpecifier.text);
      }
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(ast) === 'require')) {
        const argument = node.arguments[0];
        expect(argument && ts.isStringLiteral(argument), 'Imports must be statically inspectable').toBeTruthy();
        if (argument && ts.isStringLiteral(argument)) checkImport(argument.text);
      }
      if (ts.isImportEqualsDeclaration(node)) throw new Error('Use standard ESM imports for architecture checks.');
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});
