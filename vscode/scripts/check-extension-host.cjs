// Real installed VS Code + real CLI smoke; no Marketplace, provider or user-profile writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const extensionRoot = path.resolve(__dirname, "..");

if (require.main === module) {
  const compiler = process.env.FIDAN_BIN;
  const executable = process.env.VSCODE_EXECUTABLE;
  assert(compiler && fs.statSync(compiler).isFile(), "Set FIDAN_BIN to the candidate CLI");
  assert(executable && fs.statSync(executable).isFile(), "Set VSCODE_EXECUTABLE to the installed Code executable");
  const output = path.resolve(extensionRoot, "../target");
  fs.mkdirSync(output, { recursive: true });
  const scratch = fs.mkdtempSync(path.join(output, "host-smoke-"));
  const workspace = path.join(scratch, "workspace with spaces");
  const profile = path.join(scratch, "profile");
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(path.join(profile, "User"), { recursive: true });
  fs.writeFileSync(path.join(profile, "User/settings.json"), JSON.stringify({
    "fidan.server.path": compiler,
    "fidan.run.sandbox.enabled": true, "fidan.run.sandbox.allowRead": [workspace],
    "telemetry.telemetryLevel": "off", "update.mode": "none",
    "extensions.autoUpdate": false, "extensions.autoCheckUpdates": false,
    "workbench.enableExperiments": false, "git.enabled": false,
    "security.workspace.trust.enabled": false,
    "editor.tabSize": 4, "editor.detectIndentation": false,
  }));
  fs.writeFileSync(path.join(workspace, "main file.fdn"), "use unavailable_host_smoke_module\n");
  fs.writeFileSync(path.join(workspace, "helper.fdn"),
    "#> [Untrusted documentation](command:workbench.action.closeWindow)\naction answer returns integer { return 42 }\n");
  const env = { ...process.env, FIDAN_HOST_SMOKE_WORKSPACE: workspace };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(executable, [
    "--new-window", "--skip-welcome", "--skip-release-notes",
    `--user-data-dir=${profile}`, `--extensions-dir=${path.join(scratch, "extensions")}`,
    `--extensionDevelopmentPath=${extensionRoot}`, `--extensionTestsPath=${__filename}`, workspace,
  ], { env, windowsHide: true, encoding: "utf8", timeout: 120000 });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) throw result.error;
  assert.equal(result.status, 0, "VS Code Extension Development Host smoke failed");
} else {
  exports.run = async () => {
    const vscode = require("vscode");
    const workspace = process.env.FIDAN_HOST_SMOKE_WORKSPACE;
    assert(workspace, "Use the standalone smoke launcher");
    const uri = vscode.Uri.file(path.join(workspace, "main file.fdn"));
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
    const extension = vscode.extensions.getExtension("fidan.fidan");
    assert(extension, "Fidan extension must be discovered");
    await extension.activate();
    assert.equal(doc.languageId, "fidan");
    assert(extension.isActive);
    const commands = new Set(await vscode.commands.getCommands());
    for (const { command } of extension.packageJSON.contributes.commands) assert(commands.has(command), command);
    console.log("HOST PASS activation, language and contributed commands");

    async function diagnosticsMatch(predicate) {
      const current = vscode.languages.getDiagnostics(uri);
      if (predicate(current)) return current;
      return new Promise((resolve, reject) => {
        const subscription = vscode.languages.onDidChangeDiagnostics(event => {
          if (!event.uris.some(changed => changed.toString() === uri.toString())) return;
          const diagnostics = vscode.languages.getDiagnostics(uri);
          if (predicate(diagnostics)) { clearTimeout(timer); subscription.dispose(); resolve(diagnostics); }
        });
        const timer = setTimeout(() => {
          subscription.dispose();
          reject(new Error(`LSP diagnostics timed out: ${JSON.stringify(vscode.languages.getDiagnostics(uri))}`));
        }, 20000);
      });
    }
    async function replace(text) {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)), text);
      assert(await vscode.workspace.applyEdit(edit));
    }
    await diagnosticsMatch(items => items.some(item => item.code === "E0106" && item.severity === vscode.DiagnosticSeverity.Error)
      && items.some(item => item.message.includes("unused import") && item.severity === vscode.DiagnosticSeverity.Information));
    console.log("HOST PASS missing import error plus unused note");
    await replace('var converted = "42".toInt()\nprint(converted)\n');
    await diagnosticsMatch(items => !items.some(item => item.severity === vscode.DiagnosticSeverity.Error));
    const hovers = await vscode.commands.executeCommand("vscode.executeHoverProvider", uri, doc.positionAt(doc.getText().lastIndexOf("converted") + 2));
    const hoverText = hovers?.flatMap(hover => hover.contents.map(content => typeof content === "string" ? content : content.value)).join("\n");
    assert(hoverText?.includes("integer"), hoverText);
    assert(hovers.every(hover => hover.contents.every(content => content.isTrusted !== true)), "Source hover Markdown must not be trusted");
    console.log("HOST PASS conversion type hover and diagnostic refresh");

    await replace('var converted = "42".to\n');
    const completions = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", uri, new vscode.Position(0, doc.lineAt(0).text.length));
    const labels = completions?.items.map(item => typeof item.label === "string" ? item.label : item.label.label) ?? [];
    for (const name of ["toInt", "toFloat", "toBool", "toString"]) assert(labels.includes(name), JSON.stringify(labels));
    console.log("HOST PASS conversion receiver completions");

    await replace('action greet returns string {\nreturn "hello"\n}\n');
    // The editor UI command can resolve before its asynchronous edits land.
    // Observe the real document event; never treat command dispatch as completion.
    const formatted = new Promise((resolve, reject) => {
      const subscription = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.uri.toString() === uri.toString() && doc.getText().includes('\n    return "hello"')) {
          clearTimeout(timer); subscription.dispose(); resolve();
        }
      });
      const timer = setTimeout(() => {
        subscription.dispose(); reject(new Error(`Format command did not update document: ${doc.getText()}`));
      }, 20000);
    });
    await vscode.commands.executeCommand("fidan.formatFile");
    await formatted;
    assert(doc.getText().includes('\n    return "hello"'), doc.getText());
    console.log("HOST PASS actual format command");
    const actualConfig = vscode.workspace.getConfiguration("fidan");
    assert.equal(actualConfig.get("run.sandbox.enabled"), true);
    assert.deepEqual(actualConfig.get("run.sandbox.allowRead"), [workspace]);
    console.log("HOST PASS sandbox permission settings survive VS Code configuration resolution");

    await replace('use "./helper.fdn" as helpers\nvar result = helpers.answer()\nprint(result)\n');
    const position = doc.positionAt(doc.getText().indexOf("answer") + 2);
    const definitions = await vscode.commands.executeCommand("vscode.executeDefinitionProvider", uri, position);
    assert(definitions?.some(item => path.normalize((item.targetUri ?? item.uri)?.fsPath ?? "").toLowerCase() === path.join(workspace, "helper.fdn").toLowerCase()), JSON.stringify(definitions));
    console.log("HOST PASS cross-file definition");
    const importedHover = await vscode.commands.executeCommand("vscode.executeHoverProvider", uri, position);
    assert(importedHover?.length, "Imported action must have hover information");
    assert(importedHover.some(hover => hover.contents.some(content => content.value?.includes("command:workbench.action.closeWindow"))), "Untrusted source documentation must be preserved as inert Markdown");
    assert(importedHover.every(hover => hover.contents.every(content => content.isTrusted !== true)),
      "Package/source documentation must not become trusted command Markdown");
    console.log("HOST PASS untrusted hover Markdown");
    await vscode.commands.executeCommand("fidan.restartServer");
    const afterRestart = await vscode.commands.executeCommand("vscode.executeDefinitionProvider", uri, position);
    assert(afterRestart?.length, "LSP must respond after restart");
    console.log("HOST PASS language server restart");
  };
}
