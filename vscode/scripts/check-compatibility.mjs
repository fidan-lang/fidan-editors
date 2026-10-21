import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.license, 'Apache-2.0');
assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root, '../LICENSE'))).digest('hex'),
  'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30');
assert.equal(read('LICENSE'), read('../LICENSE'), 'Packaged LICENSE must match unmodified Apache 2.0');
assert.equal(read('NOTICE'), read('../NOTICE'), 'Packaged NOTICE source must match the canonical root notice');
assert(read('README.md').includes('[NOTICE](NOTICE)'), 'README must link to the included notice');
const settings = pkg.contributes.configuration.properties;
assert.equal(settings['fidan.run.maxErrors'].default, 1);
assert.equal(settings['fidan.run.maxErrors'].minimum, 0);
assert.equal(settings['fidan.run.sandbox.enabled'].default, false);
assert(!Object.hasOwn(settings, 'fidan.run.sandbox'), 'A scalar parent would hide permission settings');
assert(settings['fidan.build.emit'].items.enum.includes('obj'));
assert(!settings['fidan.run.emit'].items.enum.includes('obj'));
assert(!pkg.categories.includes('Debuggers'));
assert.deepEqual(Object.keys(settings).filter(key => key.startsWith('fidan.run.sandbox.')).sort(),
  ['allowEnv', 'allowRead', 'allowWrite', 'enabled', 'memLimit', 'timeLimit'].sort().map(key => `fidan.run.sandbox.${key}`).sort());
const grammar = JSON.parse(read('syntaxes/fidan.tmLanguage.json'));
assert(new RegExp(grammar.repository['type-builtin'].match).test('hashset'));

// Execute the real builders and registered callbacks; stub only VS Code UI/terminal APIs.
const source = ts.createSourceFile('extension.ts', read('src/extension.ts'), ts.ScriptTarget.Latest, true);
const functionNames = new Set(['q', 'fidanBin', 'terminalBin', 'needsPowerShellCallOperator',
  'terminalShellKind', 'resolveTerminalShellHint', 'runCmd', 'buildRunCommand', 'buildBuildArgs']);
const functions = source.statements.filter(node => ts.isFunctionDeclaration(node) && functionNames.has(node.name?.text));
const registrations = [];
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'vscode.commands.registerCommand') registrations.push(node);
  ts.forEachChild(node, visit);
}
visit(source);
let values = {};
let projectName = '  project name; echo nope  ';
const config = { get: key => values[key] ?? settings[`fidan.${key}`]?.default };
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
  assert(command.endsWith("'file with spaces.fdn'"));
  if (maxErrors === undefined || maxErrors === 1) assert(!command.includes('--max-errors'));
  else assert(command.includes(`--max-errors '${maxErrors}'`));
}
// VS Code also returns contributed defaults when the user has only the legacy flag.
values = { 'run.sandbox': true };
assert(context.builders.buildRunCommand('fidan', 'file.fdn', config, false).includes('--sandbox'));
values = { 'run.sandbox.enabled': true, 'run.sandbox.allowEnv': true };
for (const suffix of ['Net', 'Spawn']) values[`run.sandbox.allow${suffix}`] = true;
const sandboxCommand = context.builders.buildRunCommand('fidan', 'file.fdn', config, false);
assert(sandboxCommand.includes('--sandbox --allow-env'));
for (const permission of ['net', 'spawn']) assert(!sandboxCommand.includes(`--allow-${permission}`));
values = { 'build.emit': ['obj'] };
assert.equal(context.builders.buildBuildArgs(config, false), " --emit 'obj'");
for (const trace of [undefined, 'none', 'short', 'full', 'compact']) {
  values = { 'run.trace': trace };
  commands.get('fidan.openRepl')();
  assert.equal(sent.at(-1), `'fidan' repl --trace '${trace ?? 'none'}'`);
}
values = {};
await commands.get('fidan.newProject')();
assert.equal(sent.at(-1), "'fidan' new 'project name; echo nope' --dir 'C:/Projects with spaces'");
assert.equal(informationMessages, 0);
const beforeCancellation = sent.length;
projectName = undefined;
await commands.get('fidan.newProject')();
assert.equal(sent.length, beforeCancellation);
context.process.platform = 'win32';
commands.get('fidan.openRepl')();
assert.equal(sent.at(-1), "& 'fidan' repl --trace 'none'");

console.log('CLI compatibility regressions passed (builders, callbacks, metadata, grammar and README commands).');

for (const platform of ['linux','win32']) {
  context.process.platform=platform;
  const command=context.builders.buildRunCommand('fidan',"file $(echo injected) `echo injected`.fdn",config,false);
  assert(command.endsWith("'file $(echo injected) `echo injected`.fdn'"));
  values={'run.sandbox.enabled':true};
  const sandbox=context.builders.buildRunCommand('fidan','file.fdn',config,false);
  assert(sandbox.indexOf('--sandbox')<sandbox.indexOf("'file.fdn'"));
}

// The built-in Windows profile source is a display name, not an executable path.
context.process.platform='win32';
for (const hint of ['Command Prompt','C:\\Windows\\System32\\cmd.exe']) {
  values={'defaultProfile.windows':'Fixture','profiles.windows':{Fixture:{source:hint}}};
  commands.get('fidan.openRepl')();
  assert.equal(sent.at(-1),'"fidan" repl --trace "none"');
  const command=context.builders.buildRunCommand('fidan','C:/path with spaces/file.fdn',config,false);
  assert(command.endsWith('"C:/path with spaces/file.fdn"'));
  assert.throws(()=>context.builders.buildRunCommand('fidan','C:/bad%PATH%.fdn',config,false));
}
values={'defaultProfile.windows':'Command Prompt','profiles.windows':{}};
commands.get('fidan.openRepl')();
assert.equal(sent.at(-1),'"fidan" repl --trace "none"','built-in Command Prompt needs no user profile override');
values={'defaultProfile.windows':'Ubuntu (WSL)','profiles.windows':{}};
commands.get('fidan.openRepl')();
assert.equal(sent.at(-1),"'fidan' repl --trace 'none'",'built-in WSL needs POSIX quoting without a user profile override');
// A terminal named like ours may have an old profile or a nested interactive shell.
let reused=false;
vscode.window.terminals=[{name:'Fidan: Test',exitStatus:undefined,show(){},sendText(){reused=true;}}];
values={};
context.runCmd('Fidan: Test','safe fixture command');
assert.equal(reused,false,'quoted commands must not run in a terminal with unknown shell state');
assert.equal(sent.at(-1),'safe fixture command');
vscode.window.terminals=[];
values={};
if (process.env.FIDAN_BIN) {
  const {spawnSync,spawn}=await import('node:child_process');
  const {tmpdir}=await import('node:os');
  const executable=path.resolve(process.env.FIDAN_BIN);
  const folder=fs.mkdtempSync(path.join(tmpdir(),'fidan-editor-compat-'));
  try {
    const filename=path.join(folder,"source $(echo unwanted) `literal` 'quote'.fdn");
    fs.writeFileSync(filename,'use std.env\nprint(env.get("FIDAN_EDITOR_TEST"))\n');
    context.process.platform=process.platform;
    values={'run.sandbox.enabled':true,'run.jitThreshold':0};
    const binary=process.platform==='win32'?`& '${executable.replaceAll("'","''")}'`:`'${executable.replaceAll("'","'\\''")}'`;
    const command=context.builders.buildRunCommand(binary,filename,config,false);
    const result=process.platform==='win32'
      ?spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',env:{...process.env,FIDAN_EDITOR_TEST:'local-fixture'},timeout:20000})
      :spawnSync('bash',['-c',command],{encoding:'utf8',env:{...process.env,FIDAN_EDITOR_TEST:'local-fixture'},timeout:20000});
    assert.equal(result.status,1,`Sandbox command must reject env access. Command: ${command}; stdout: ${result.stdout}; stderr: ${result.stderr}`);
    assert.match(result.stderr,/sandbox|permission|denied/i);
    assert(!result.stdout.includes('local-fixture'));
    const server=spawn(executable,['lsp'],{stdio:['pipe','pipe','pipe'],windowsHide:true});
    const request={jsonrpc:'2.0',id:1,method:'initialize',params:{processId:null,rootUri:null,capabilities:{}}};
    const body=JSON.stringify(request);
    const response=new Promise((resolve,reject)=>{
      let buffer=Buffer.alloc(0);
      server.once('error',reject);
      server.stdout.on('data',chunk=>{
        buffer=Buffer.concat([buffer,chunk]);
        for (;;) {
          const end=buffer.indexOf('\r\n\r\n');if(end<0)return;
          const length=/Content-Length: (\d+)/i.exec(buffer.subarray(0,end).toString())?.[1];
          if(!length)return reject(new Error('Invalid LSP response framing'));
          const size=Number(length);if(buffer.length<end+4+size)return;
          const message=JSON.parse(buffer.subarray(end+4,end+4+size).toString());buffer=buffer.subarray(end+4+size);
          if(message.id===1)resolve(message);
        }
      });
    });
    const timer=setTimeout(()=>server.kill(),10000);
    try {
      server.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
      const initialized=await Promise.race([response,new Promise((_,reject)=>server.once('exit',()=>reject(new Error('LSP exited before initialize'))))]);
      assert(initialized.result.capabilities.completionProvider);
      assert(initialized.result.capabilities.documentFormattingProvider);
    } finally {clearTimeout(timer);server.kill();}
    console.log('Actual CLI sandbox/quoting and LSP initialize checks passed.');
  } finally {fs.rmSync(folder,{recursive:true,force:true});}
}
