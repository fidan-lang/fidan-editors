// Real installed VS Code + real CLI smoke; no Marketplace, provider or user-profile writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const extensionRoot = path.resolve(__dirname, "..");
const traceDiagnostics = process.env.FIDAN_HOST_DIAGNOSTICS === "trace";

// Output and protocol channels append independently; a combined string offset
// can skip the start marker when a different channel grows first.
function serverStartedInLogs(before, current, selected) {
  for (const [file, contents] of current) {
    const output = contents.slice(before.get(file)?.length ?? 0);
    const start = output.indexOf(`[fidan] Starting language server: ${JSON.stringify(selected)}`);
    if (start >= 0 && output.indexOf("[fidan] Language server started:", start) >= 0) return true;
  }
  return false;
}
exports.serverStartedInLogs = serverStartedInLogs;

if (require.main === module) {
  const argsRoot = process.env.FIDAN_ARGS_ROOT;
  assert(argsRoot, "FIDAN_ARGS_ROOT is required for actual args Extension Host coverage");
  for (const file of ["src/core.fdn", "src/app.fdn", "src/init.fdn", "examples/greet.fdn"]) {
    assert(fs.statSync(path.join(argsRoot, file)).isFile(), `Missing actual args source: ${file}`);
  }
  const sourceCompiler = process.env.FIDAN_BIN;
  assert(sourceCompiler && fs.statSync(sourceCompiler).isFile(), "Set FIDAN_BIN to the candidate CLI");
  if (traceDiagnostics) {
    const help = spawnSync(sourceCompiler, ["--help"], { encoding: "utf8", windowsHide: true });
    assert.equal(help.status, 0, help.stderr);
    assert(help.stdout.includes("--verbose"), "TRACE host checks require the new compiler candidate; old public versions do not implement global verbosity");
  }
  const executable = process.env.VSCODE_EXECUTABLE;
  assert(executable && fs.statSync(executable).isFile(), "Set VSCODE_EXECUTABLE to the installed Code executable");
  const output = path.resolve(extensionRoot, "../target");
  fs.mkdirSync(output, { recursive: true });
  const scratch = fs.mkdtempSync(path.join(output, "host-smoke-"));
  const workspace = path.join(scratch, "workspace with spaces");
  const profile = path.join(scratch, "profile");
  const compiler = path.join(scratch, "compiler with spaces", path.basename(sourceCompiler));
  fs.mkdirSync(path.dirname(compiler));
  fs.copyFileSync(sourceCompiler, compiler);
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(path.join(profile, "User"), { recursive: true });
  fs.writeFileSync(path.join(profile, "User/settings.json"), JSON.stringify({
    "fidan.server.path": compiler, "fidan.trace.server": "verbose",
    "fidan.server.extraArgs": traceDiagnostics ? ["-vvv"] : [],
    "fidan.run.sandbox.enabled": true, "fidan.run.sandbox.allowRead": [workspace],
    "telemetry.telemetryLevel": "off", "update.mode": "none",
    "extensions.autoUpdate": false, "extensions.autoCheckUpdates": false,
    "workbench.enableExperiments": false, "git.enabled": false,
    "security.workspace.trust.enabled": false,
    "window.title": "Fidan isolated audit - ${activeEditorShort}",
    "window.restoreWindows": "none",
    "editor.tabSize": 4, "editor.detectIndentation": false,
  }));
  fs.writeFileSync(path.join(workspace, "main file.fdn"), "use unavailable_host_smoke_module\n");
  fs.writeFileSync(path.join(workspace, "helper.fdn"),
    "#> [Untrusted documentation](command:workbench.action.closeWindow)\naction answer returns integer { return 42 }\n");
  const env = { ...process.env, FIDAN_ARGS_ROOT: path.resolve(argsRoot), FIDAN_HOST_SMOKE_WORKSPACE: workspace, FIDAN_HOST_SMOKE_PROFILE: profile, FIDAN_HOST_SELECTED_COMPILER: compiler };
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
    function readOutputLogFiles() {
      const output = new Map();
      function walk(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) walk(file);
          else if (entry.name.includes("Fidan") && entry.name.endsWith(".log")) output.set(file, fs.readFileSync(file, "utf8"));
        }
      }
      walk(path.join(process.env.FIDAN_HOST_SMOKE_PROFILE, "logs"));
      return output;
    }
    function readOutputLogs() {
      return [...readOutputLogFiles().values()].join("\n");
    }
    function serverStarted(selected) {
      const previous = readOutputLogFiles();
      return new Promise((resolve, reject) => {
        const watcher = fs.watch(path.join(process.env.FIDAN_HOST_SMOKE_PROFILE, "logs"), { recursive: true }, () => {
          if (serverStartedInLogs(previous, readOutputLogFiles(), selected)) {
            watcher.close(); clearTimeout(timer); resolve();
          }
        });
        const timer = setTimeout(() => { watcher.close(); reject(new Error(`Server did not start with ${selected}`)); }, 20000);
        watcher.on("error", error => { watcher.close(); clearTimeout(timer); reject(error); });
      });
    }
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

      function publication(target, predicate = () => true) {
        return new Promise((resolve, reject) => {
          const subscription = vscode.languages.onDidChangeDiagnostics(event => {
            if (!event.uris.some(changed => changed.toString() === target.toString())) return;
            const items = vscode.languages.getDiagnostics(target);
            if (predicate(items)) { clearTimeout(timer); subscription.dispose(); resolve(items); }
          });
          const timer = setTimeout(() => {
            subscription.dispose();
            reject(new Error(`No matching actual args diagnostics: ${target.fsPath}: ${JSON.stringify(vscode.languages.getDiagnostics(target))}`));
          }, 20000);
        });
      }
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

    const validFormattingInput = publication(uri, items => !items.some(item => item.severity === vscode.DiagnosticSeverity.Error));
    await replace('action greet returns string {\nreturn "hello"\n}\n');
    await validFormattingInput;
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
    // UI format actions require an active code editor, unlike URI-based providers.
    // Completion requests can leave the workbench focus in their auxiliary widget.
    await vscode.window.showTextDocument(doc, {preview: false, preserveFocus: false});
    await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    assert.equal(vscode.window.activeTextEditor?.document.uri.toString(), uri.toString());
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

    assert(process.env.FIDAN_ARGS_ROOT, "Actual args source is mandatory");
    {
      const argsRoot = path.resolve(process.env.FIDAN_ARGS_ROOT);
      let greet;
      let greetUri;
      for (const relative of ["src/core.fdn", "src/app.fdn", "src/init.fdn", "examples/greet.fdn"]) {
        const target = vscode.Uri.file(path.join(argsRoot, relative));
        const published = publication(target);
        const actual = await vscode.workspace.openTextDocument(target);
        await vscode.window.showTextDocument(actual);
        const items = await published;
        assert(!items.some(item => item.severity <= vscode.DiagnosticSeverity.Warning), `${relative}: ${JSON.stringify(items)}`);
        if (relative === "examples/greet.fdn") { greet = actual; greetUri = target; }
      }
      console.log("HOST PASS actual args source and greet diagnostics (real publications)");
      const original = greet.getText();
      const coreDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(path.join(argsRoot, "src/core.fdn")));
      const originalCore = coreDoc.getText();
      const originalBytes = new Map([coreDoc, greet].map(document => [document.uri.fsPath, fs.readFileSync(document.uri.fsPath)]));
      async function editGreet(text, predicate) {
        const published = publication(greetUri, predicate);
        const edit = new vscode.WorkspaceEdit();
        edit.replace(greetUri, new vscode.Range(greet.positionAt(0), greet.positionAt(greet.getText().length)), text);
        assert(await vscode.workspace.applyEdit(edit));
        return published;
      }
      try {
        const decorator = greet.positionAt(original.indexOf("@command") + 2);
        const definition = await vscode.commands.executeCommand("vscode.executeDefinitionProvider", greetUri, decorator);
        assert(definition?.some(item => path.normalize((item.targetUri ?? item.uri)?.fsPath ?? "").endsWith(path.join("src", "core.fdn"))), JSON.stringify(definition));
        const hover = await vscode.commands.executeCommand("vscode.executeHoverProvider", greetUri, decorator);
        assert(hover?.length, "Imported decorator hover must be available");
        const call = original.lastIndexOf("run(") + 4;
        const signature = await vscode.commands.executeCommand("vscode.executeSignatureHelpProvider", greetUri, greet.positionAt(call));
        assert(signature?.signatures?.length, JSON.stringify(signature));
        console.log("HOST PASS imported decorator definition/hover and run signature");
        await editGreet(original + "\nvar member_probe = greet.\n");
        const memberItems = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", greetUri,
          greet.positionAt(greet.getText().lastIndexOf("greet.") + 6));
        const memberNames = memberItems?.items.map(item => typeof item.label === "string" ? item.label : item.label.label) ?? [];
        for (const name of ["name", "parameters", "invoke"]) assert(memberNames.includes(name), JSON.stringify(memberNames));
        await editGreet(original + "\n@", () => true);
        const decorators = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", greetUri, greet.positionAt(greet.getText().length));
        const decoratorNames = decorators?.items.map(item => typeof item.label === "string" ? item.label : item.label.label) ?? [];
        assert(decoratorNames.includes("command") || decoratorNames.includes("@command"), JSON.stringify(decoratorNames));
        console.log("HOST PASS callable member and imported decorator completions");
        await editGreet(original + "\n@missing_host_decorator\naction control {}\nprint(greet.missing_host_member)\n",
          items => items.some(item => item.code === "W2004") && items.some(item => item.code === "E0204"));
        await editGreet(original, items => !items.some(item => item.severity <= vscode.DiagnosticSeverity.Warning));
        console.log("HOST PASS actual args unsaved negative controls and recovery");
        const dependencyFailure = publication(greetUri, items => items.some(item => item.code === "E0101" && item.message.includes("missing_dependency_control")));
        const dependencyEdit = new vscode.WorkspaceEdit();
        dependencyEdit.insert(coreDoc.uri, coreDoc.positionAt(coreDoc.getText().length), "\nvar dependency_control = missing_dependency_control\n");
        assert(await vscode.workspace.applyEdit(dependencyEdit));
        await dependencyFailure;
        const dependencyRecovery = publication(greetUri, items => !items.some(item => item.severity <= vscode.DiagnosticSeverity.Warning));
        const restoreDependency = new vscode.WorkspaceEdit();
        restoreDependency.replace(coreDoc.uri, new vscode.Range(coreDoc.positionAt(0), coreDoc.positionAt(coreDoc.getText().length)), originalCore);
        assert(await vscode.workspace.applyEdit(restoreDependency));
        await dependencyRecovery;
        console.log("HOST PASS actual unsaved dependency invalidation and transitive recovery");

        // Observe actual server re-open publications after each setting change.
        const selectedCompiler = process.env.FIDAN_HOST_SELECTED_COMPILER;
        const originalCompiler = process.env.FIDAN_BIN;
        for (const selected of [originalCompiler, selectedCompiler]) {
          const started = serverStarted(selected);
          await vscode.workspace.getConfiguration("fidan").update("server.path", selected, vscode.ConfigurationTarget.Workspace);
          await started;
          const resolved = await vscode.commands.executeCommand("vscode.executeDefinitionProvider", greetUri, decorator);
          assert(resolved?.length, "Server configuration change must use a working fresh server");
        }
        console.log("HOST PASS server.path changes and compiler executable path with spaces");
        if (process.env.FIDAN_HOST_OLD_COMPILER) {
          if (traceDiagnostics) {
            const plainRestart = serverStarted(selectedCompiler);
            await vscode.workspace.getConfiguration("fidan").update("server.extraArgs", [], vscode.ConfigurationTarget.Workspace);
            await plainRestart;
          }
          const controlUri = vscode.Uri.file(path.join(workspace, "old compiler capability.fdn"));
          fs.writeFileSync(controlUri.fsPath, "action known {}\nprint(known.parameters)\n");
          const oldDiagnostics = publication(controlUri, items => items.some(item => item.code === "E0204"));
          const oldStarted = serverStarted(process.env.FIDAN_HOST_OLD_COMPILER);
          await vscode.workspace.getConfiguration("fidan").update("server.path", process.env.FIDAN_HOST_OLD_COMPILER, vscode.ConfigurationTarget.Workspace);
          await oldStarted;
          await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(controlUri));
          await oldDiagnostics;
          const recovered = serverStarted(selectedCompiler);
          await vscode.workspace.getConfiguration("fidan").update("server.path", selectedCompiler, vscode.ConfigurationTarget.Workspace);
          await recovered;
          const definition = await vscode.commands.executeCommand("vscode.executeDefinitionProvider", greetUri, decorator);
          assert(definition?.length, "Candidate must recover imported decorator semantics after old server");
          if (traceDiagnostics) {
            const verboseRestart = serverStarted(selectedCompiler);
            await vscode.workspace.getConfiguration("fidan").update("server.extraArgs", ["-vvv"], vscode.ConfigurationTarget.Workspace);
            await verboseRestart;
          }
          console.log("HOST PASS old public compiler reports unsupported callable API and candidate recovery");
        } else {
          console.log("HOST SKIP old compiler comparison: set FIDAN_HOST_OLD_COMPILER");
        }
        const output = readOutputLogs();
        assert(output.includes(JSON.stringify(selectedCompiler)), "Output must identify selected compiler path");
        assert(/Language server started: fidan-lsp \d+\.\d+\.\d+/.test(output), "Output must identify server-reported version");
        if (process.env.FIDAN_HOST_OLD_COMPILER) assert(output.includes(JSON.stringify(process.env.FIDAN_HOST_OLD_COMPILER)));
        if (traceDiagnostics) {
          assert(output.includes("LSP initialize received"), "CLI diagnostics must reach the stderr output channel");
          assert(output.includes("LSP diagnostics ready"), "Verbose diagnostics must coexist with JSON-RPC");
          console.log("HOST PASS verbose CLI stderr and actual LSP diagnostics coexist");
        }
        console.log("HOST PASS actual output logs show executable selection and reported version");

      } finally {
        // The actual repository files were edited only in memory and never saved.
        for (const document of [coreDoc, greet]) {
          await vscode.window.showTextDocument(document);
          await vscode.commands.executeCommand("workbench.action.files.revert");
          assert.deepEqual(fs.readFileSync(document.uri.fsPath), originalBytes.get(document.uri.fsPath));
        }
      }
    }

  };
}
