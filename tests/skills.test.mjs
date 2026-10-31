import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = resolve(root, '.agents/skills');
const expectedSkills = [
  'api-and-interface-design', 'browser-testing-with-devtools', 'ci-cd-and-automation',
  'code-review-and-quality', 'code-simplification', 'constraint-driven-development',
  'context-engineering', 'debugging-and-error-recovery', 'deploy-to-vercel',
  'deprecation-and-migration', 'documentation-and-adrs', 'doubt-driven-development',
  'frontend-ui-engineering', 'git-workflow-and-versioning', 'idea-refine',
  'incremental-implementation', 'interview-me', 'observability-and-instrumentation',
  'performance-optimization', 'planning-and-task-breakdown', 'security-and-hardening',
  'shipping-and-launch', 'source-driven-development', 'spec-driven-development',
  'test-driven-development', 'ui-ux-pro-max', 'using-agent-skills',
  'vercel-cli-with-tokens', 'vercel-composition-patterns', 'vercel-optimize',
  'vercel-react-best-practices', 'vercel-react-native-skills',
  'vercel-react-view-transitions', 'web-design-guidelines', 'writing-guidelines',
];

function python(args) {
  const candidates = process.platform === 'win32'
    ? [['py', '-3'], ['python']]
    : [['python3'], ['python']];
  let result;
  for (const [command, ...prefix] of candidates) {
    result = spawnSync(command, [...prefix, ...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    });
    if (result.error?.code !== 'ENOENT') return result;
  }
  return result;
}

function search(...args) {
  const result = python(['.agents/skills/ui-ux-pro-max/scripts/search.py', ...args, '--json']);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}

test('the project guide and all requested skills are present and discoverable', () => {
  const guide = readFileSync(resolve(root, 'AGENTS.md'), 'utf8');
  assert.match(guide, /\.agents\/skills\//);
  assert.ok(existsSync(resolve(root, '.agents/SOURCES.md')));
  const directories = readdirSync(skillsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  for (const name of expectedSkills) {
    assert.ok(directories.includes(name), `Missing skill directory: ${name}`);
    const definition = readFileSync(resolve(skillsRoot, name, 'SKILL.md'), 'utf8');
    assert.match(definition, /^---\s*\n/);
    assert.match(definition, new RegExp(`^name:\\s*${name}\\s*$`, 'm'));
    assert.match(definition, /^description:/m);
  }
});

test('local references linked by skill definitions exist', () => {
  for (const name of expectedSkills) {
    const directory = resolve(skillsRoot, name);
    const definition = readFileSync(resolve(directory, 'SKILL.md'), 'utf8');
    const links = [...definition.matchAll(/\]\(([^)\s]+)\)/g)]
      .map(match => match[1].split('#')[0])
      .filter(link => link && !/^(https?:\/\/|mailto:|#)/.test(link));
    const sharedReferences = [...definition.matchAll(/`(\.\.\/\.\.\/references\/[\w./-]+\.md)(?:#[^`]*)?`/g)]
      .map(match => match[1]);
    for (const link of [...links, ...sharedReferences]) {
      assert.ok(existsSync(resolve(directory, link)), `${name}: missing ${link}`);
    }
  }
});

test('UI/UX Pro Max commands use the saved project path', () => {
  const definition = readFileSync(resolve(skillsRoot, 'ui-ux-pro-max/SKILL.md'), 'utf8');
  assert.match(definition, /python3 \.agents\/skills\/ui-ux-pro-max\/scripts\/search\.py/);
  assert.doesNotMatch(definition, /CLAUDE_PLUGIN_ROOT/);
});

test('UI/UX Pro Max finds UX and stack-specific guidance', () => {
  const ux = search('keyboard focus modal', '--domain', 'ux');
  assert.equal(ux.domain, 'ux');
  assert.ok(ux.count > 0);
  const react = search('form validation', '--stack', 'react');
  assert.equal(react.stack, 'react');
  assert.ok(react.count > 0);
});

test('UI/UX Pro Max generates a design system without writing files', () => {
  const result = search('marketing specialist portfolio', '--design-system');
  assert.ok(result.design_system && Object.keys(result.design_system).length > 0);
  assert.equal(result.persistence, null);
});

test('the saved Vercel code scanner runs offline with its local modules', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'saved-skills-'));
  try {
    const sample = 'export const dynamic = "force-dynamic";';
    mkdirSync(join(fixture, 'app'), { recursive: true });
    mkdirSync(join(fixture, '.agents/skills/example/app'), { recursive: true });
    writeFileSync(join(fixture, 'app/page.js'), sample);
    writeFileSync(join(fixture, '.agents/skills/example/app/page.js'), sample);
    const result = spawnSync(process.execPath, [
      resolve(skillsRoot, 'vercel-optimize/scripts/scan-codebase.mjs'), fixture,
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const output = JSON.parse(result.stdout);
    assert.equal(output.schemaVersion, '1.0');
    assert.ok(Array.isArray(output.scannerMetadata) && output.scannerMetadata.length > 0);
    if (process.platform !== 'win32') {
      assert.ok(output.findings.some(finding => finding.file === 'app/page.js' && finding.pattern === 'force-dynamic'));
    }
    const isSkillFile = path => path.replace(/\\/g, '/').startsWith('.agents/');
    assert.ok(output.findings.every(finding => !isSkillFile(finding.file)),
      'Saved skill examples must not be treated as application code');
    assert.ok(output.routes.every(route => !isSkillFile(route.file)));
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('offline guideline snapshots and upstream license notices are saved', () => {
  for (const relativePath of [
    '.agents/references/vercel-web-interface-guidelines.md',
    '.agents/references/vercel-writing-guidelines.md',
    '.agents/licenses/ui-ux-pro-max-MIT.txt',
    '.agents/licenses/addyosmani-agent-skills-MIT.txt',
    '.agents/licenses/vercel-web-interface-guidelines-MIT.txt',
    '.agents/licenses/vercel-writing-guidelines-MIT.txt',
  ]) {
    assert.ok(readFileSync(resolve(root, relativePath), 'utf8').trim(), `${relativePath} is empty`);
  }
});
