import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));
assert.equal(read('NOTICE'), read('../NOTICE'), 'Packaged NOTICE source must match the canonical root notice');
assert(read('README.md').includes('[NOTICE](NOTICE)'), 'README must link to the included notice');
const settings = pkg.contributes.configuration.properties;
assert.equal(settings['fidan.run.maxErrors'].default, 1);
assert.equal(settings['fidan.run.maxErrors'].minimum, 0);
assert(settings['fidan.build.emit'].items.enum.includes('obj'));
assert(!settings['fidan.run.emit'].items.enum.includes('obj'));
assert(!pkg.categories.includes('Debuggers'));
assert.deepEqual(Object.keys(settings).filter(key => key.startsWith('fidan.run.sandbox.')).sort(),
  ['allowEnv', 'allowRead', 'allowWrite', 'memLimit', 'timeLimit'].map(key => `fidan.run.sandbox.${key}`).sort());
const grammar = JSON.parse(read('syntaxes/fidan.tmLanguage.json'));
assert(new RegExp(grammar.repository['type-builtin'].match).test('hashset'));

// Execute the real builders and registered callbacks; stub only VS Code UI/terminal APIs.
const source = ts.createSourceFile('extension.ts', read('src/extension.ts'), ts.ScriptTarget.Latest, true);
const functionNames = new Set(['q', 'fidanBin', 'terminalBin', 'needsPowerShellCallOperator',
  'resolveTerminalShellHint', 'runCmd', 'buildRunCommand', 'buildBuildArgs']);
const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && functionNames.has(node.name?.text));
const registrations = [];
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'vscode.commands.registerCommand') registrations.push(node);
  ts.forEachChild(node, visit);
}
visit(source);
let values = {};
let projectName = '  project name; echo nope  ';
const config = { get: key => values[key] };
const commands = new Map();
const sent = [];
let informationMessages = 0;
const vscode = {
  workspace: { getConfiguration: () => config },
  commands: {
    registerCommand: (name, callback) => commands.set(name, callback),
    executeCommand: () => { throw new Error('Scaffolding must not automatically open a folder'); },
  },
  window: {
    terminals: [],
    createTerminal: () => ({ show() {}, sendText: text => sent.push(text) }),
    showInputBox: async () => projectName,
    showOpenDialog: async () => [{ fsPath: 'C:/Projects with spaces' }],
    showInformationMessage: () => { informationMessages++; },
  },
};
const context = vm.createContext({ vscode, process: { platform: 'linux' } });
const code = [...functions, ...registrations].map(node => node.getText(source)).join(';\n')
  + '; globalThis.builders = { buildRunCommand, buildBuildArgs };';
vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
assert.deepEqual([...commands.keys()].sort(), pkg.contributes.commands.map(command => command.command).sort());
for (const doc of ['README.md', '../README.md']) {
  const titles = [...read(doc).matchAll(/\| `([^`]+)` \|/g)].map(match => match[1]).filter(title => title.startsWith('Fidan:'));
  assert.deepEqual(titles.sort(), pkg.contributes.commands.map(command => command.title).sort(), `${doc} commands differ from manifest`);
}
for (const maxErrors of [undefined, 0, 1, 7]) {
  values = { 'run.maxErrors': maxErrors };
  const command = context.builders.buildRunCommand('fidan', 'file with spaces.fdn', config, false);
  assert(command.includes('"file with spaces.fdn"'));
  if (maxErrors === undefined || maxErrors === 1) assert(!command.includes('--max-errors'));
  else assert(command.endsWith(`--max-errors ${maxErrors}`));
}
values = { 'run.sandbox': true, 'run.sandbox.allowEnv': true };
for (const suffix of ['Net', 'Spawn']) values[`run.sandbox.allow${suffix}`] = true;
const sandboxCommand = context.builders.buildRunCommand('fidan', 'file.fdn', config, false);
assert(sandboxCommand.includes('--sandbox --allow-env'));
for (const permission of ['net', 'spawn']) assert(!sandboxCommand.includes(`--allow-${permission}`));
values = { 'build.emit': ['obj'] };
assert.equal(context.builders.buildBuildArgs(config, false), ' --emit obj');
for (const trace of [undefined, 'none', 'short', 'full', 'compact']) {
  values = { 'run.trace': trace };
  commands.get('fidan.openRepl')();
  assert.equal(sent.at(-1), `"fidan" repl --trace ${trace ?? 'none'}`);
}
values = {};
await commands.get('fidan.newProject')();
assert.equal(sent.at(-1), '"fidan" new "project name; echo nope" --dir "C:/Projects with spaces"');
assert.equal(informationMessages, 0);
const beforeCancellation = sent.length;
projectName = undefined;
await commands.get('fidan.newProject')();
assert.equal(sent.length, beforeCancellation);
context.process.platform = 'win32';
commands.get('fidan.openRepl')();
assert.equal(sent.at(-1), '& "fidan" repl --trace none');

console.log('CLI compatibility regressions passed (builders, callbacks, metadata, grammar and README commands).');
