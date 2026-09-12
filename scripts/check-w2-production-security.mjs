import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const base = process.env.W3_1_BASE_SHA;
if (!base || !/^[0-9a-f]{40}$/i.test(base)) {
  throw new Error('W3_1_BASE_SHA must be an exact commit SHA');
}

const changed = execFileSync('git', [
  'diff', '--name-only', `${base}...HEAD`, '--',
  'packages/**/*.ts', 'packages/**/*.js',
], { encoding: 'utf8' })
  .split(/\r?\n/)
  .map(value => value.trim())
  .filter(Boolean);

const findings = [];
const assignmentKinds = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.PlusEqualsToken,
  ts.SyntaxKind.MinusEqualsToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.AsteriskAsteriskEqualsToken,
  ts.SyntaxKind.SlashEqualsToken,
  ts.SyntaxKind.PercentEqualsToken,
  ts.SyntaxKind.LessThanLessThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  ts.SyntaxKind.AmpersandEqualsToken,
  ts.SyntaxKind.BarEqualsToken,
  ts.SyntaxKind.CaretEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
]);

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function add(file, source, node, rule, detail) {
  findings.push({ file, line: lineOf(source, node), rule, detail });
}

function isIdentifier(node, text) {
  return ts.isIdentifier(node) && node.text === text;
}

function propertyPath(node) {
  if (ts.isIdentifier(node)) return [node.text];
  if (ts.isPropertyAccessExpression(node)) return [...propertyPath(node.expression), node.name.text];
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
    return [...propertyPath(node.expression), node.argumentExpression.text];
  }
  return [];
}

for (const file of changed) {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );

  for (const range of ts.getLeadingCommentRanges(text, 0) || []) {
    const comment = text.slice(range.pos, range.end);
    if (/@ts-(?:ignore|nocheck)/.test(comment)) {
      findings.push({ file, line: 1, rule: 'typescript-bypass', detail: '@ts-ignore/@ts-nocheck is forbidden' });
    }
  }
  const commentDirective = /\/\*[\s\S]*?@ts-(?:ignore|nocheck)[\s\S]*?\*\/|\/\/[^\n]*@ts-(?:ignore|nocheck)/g;
  for (const match of text.matchAll(commentDirective)) {
    const prefix = text.slice(0, match.index);
    findings.push({
      file,
      line: prefix.split(/\r?\n/).length,
      rule: 'typescript-bypass',
      detail: '@ts-ignore/@ts-nocheck is forbidden',
    });
  }

  function visit(node) {
    if ((ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) && node.type.kind === ts.SyntaxKind.AnyKeyword) {
      add(file, source, node, 'typescript-bypass', 'cast/assertion to any is forbidden in the W2 production diff');
    }

    if (ts.isCallExpression(node) && (isIdentifier(node.expression, 'eval') || isIdentifier(node.expression, 'Function'))) {
      add(file, source, node, 'dynamic-code', `${node.expression.getText(source)}() is forbidden`);
    }
    if (ts.isNewExpression(node) && isIdentifier(node.expression, 'Function')) {
      add(file, source, node, 'dynamic-code', 'new Function() is forbidden');
    }

    if (ts.isBinaryExpression(node) && assignmentKinds.has(node.operatorToken.kind)) {
      const path = propertyPath(node.left);
      if (path.length === 2 && path[0] === 'console' && path[1] === 'log') {
        add(file, source, node, 'console-tamper', 'assignment to console.log is forbidden');
      }
      if (path.length === 2 && path[0] === 'document' && path[1] === 'cookie') {
        add(file, source, node, 'credential-persistence', 'document.cookie mutation is forbidden');
      }
    }

    const path = propertyPath(node);
    if (path.length) {
      const hasPersistentStorage = path.includes('localStorage') || path.includes('sessionStorage');
      if (hasPersistentStorage && (
        path[0] === 'localStorage' || path[0] === 'sessionStorage' ||
        path[0] === 'window' || path[0] === 'globalThis' || path[0] === 'self'
      )) {
        add(file, source, node, 'credential-persistence', `browser persistent storage access is forbidden: ${path.join('.')}`);
      }
      if (path.length >= 2 && path[0] === 'document' && path[1] === 'cookie') {
        add(file, source, node, 'credential-persistence', 'document.cookie access is forbidden');
      }
      if (path.length >= 2 && path[0] === 'location' && (path[1] === 'search' || path[1] === 'href')) {
        add(file, source, node, 'query-credential-surface', `location.${path[1]} access is forbidden in W2 operator production changes`);
      }
    }

    if ((ts.isNewExpression(node) || ts.isCallExpression(node)) && isIdentifier(node.expression, 'URLSearchParams')) {
      add(file, source, node, 'query-credential-surface', 'URLSearchParams is forbidden in W2 operator production changes');
    }

    ts.forEachChild(node, visit);
  }
  visit(source);
}

if (findings.length) {
  process.stderr.write(`${JSON.stringify({ schema: 'cgev11.w2-production-security/v1', findings }, null, 2)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({
    schema: 'cgev11.w2-production-security/v1',
    base,
    filesScanned: changed,
    result: 'PASS',
  }, null, 2)}\n`);
}
