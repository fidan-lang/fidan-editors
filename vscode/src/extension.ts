import * as path from "path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn,
  ServerOptions,
  Trace,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient | undefined;
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;
let formatOnSaveDisposable: vscode.Disposable | undefined;
let configWatcherDisposable: vscode.Disposable | undefined;

function fidanBin(config: vscode.WorkspaceConfiguration): string {
  return config.get<string>("server.path") ?? "fidan";
}

function terminalBin(config: vscode.WorkspaceConfiguration): string {
  const bin = q(fidanBin(config));
  return needsPowerShellCallOperator() ? `& ${bin}` : bin;
}

function q(p: string): string {
  return `"${p.replace(/"/g, '\\"')}"`;
}

function needsPowerShellCallOperator(): boolean {
  if (process.platform !== "win32") {
    return false;
  }

  const shellHint = resolveTerminalShellHint();
  if (!shellHint) {
    return true;
  }

  return /(pwsh|powershell)(\.exe)?$/i.test(shellHint);
}

function resolveTerminalShellHint(): string | undefined {
  const terminalConfig = vscode.workspace.getConfiguration("terminal.integrated");
  const defaultProfile = terminalConfig.get<string>("defaultProfile.windows");
  const profiles = terminalConfig.get<Record<string, { path?: string | string[]; source?: string }>>(
    "profiles.windows",
  );

  if (defaultProfile && profiles?.[defaultProfile]) {
    const profile = profiles[defaultProfile];
    if (typeof profile.source === "string" && profile.source.length > 0) {
      return profile.source;
    }

    const shellPath = Array.isArray(profile.path) ? profile.path[0] : profile.path;
    if (typeof shellPath === "string" && shellPath.length > 0) {
      return shellPath;
    }
  }

  return undefined;
}

async function requireActiveFidanFile(save = true): Promise<string | undefined> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Fidan: No active file.");
    return undefined;
  }
  if (editor.document.languageId !== "fidan") {
    vscode.window.showWarningMessage("Fidan: Active file is not a Fidan (.fdn) file.");
    return undefined;
  }
  if (save) {
    await editor.document.save();
  }
  return editor.document.uri.fsPath;
}

function runCmd(name: string, cmd: string): void {
  let terminal = vscode.window.terminals.find(
    t => t.name === name && t.exitStatus === undefined,
  );
  if (!terminal) {
    terminal = vscode.window.createTerminal(name);
  }
  terminal.show(true);
  terminal.sendText(cmd);
}

function buildRunCommand(
  bin: string,
  filePath: string,
  config: vscode.WorkspaceConfiguration,
  reload: boolean,
): string {
  const args: string[] = [q(filePath)];

  if (reload) {
    args.push("--reload");
  }
  if (config.get<boolean>("run.strict") ?? false) {
    args.push("--strict");
  }

  const trace = config.get<string>("run.trace") ?? "none";
  if (trace !== "none") {
    args.push(`--trace ${trace}`);
  }

  const jit = config.get<number>("run.jitThreshold") ?? 500;
  if (jit !== 500) {
    args.push(`--jit-threshold ${jit}`);
  }

  const maxErrors = config.get<number>("run.maxErrors") ?? 0;
  if (maxErrors > 0) {
    args.push(`--max-errors ${maxErrors}`);
  }

  const suppress = (config.get<string[]>("run.suppress") ?? []).join(",");
  if (suppress) {
    args.push(`--suppress ${suppress}`);
  }

  const emit = (config.get<string[]>("run.emit") ?? []).join(",");
  if (emit) {
    args.push(`--emit ${emit}`);
  }

  if (config.get<boolean>("run.sandbox") ?? false) {
    args.push("--sandbox");
    const allowRead = (config.get<string[]>("run.sandbox.allowRead") ?? []).join(",");
    if (allowRead) {
      args.push(`--allow-read ${allowRead}`);
    }
    const allowWrite = (config.get<string[]>("run.sandbox.allowWrite") ?? []).join(",");
    if (allowWrite) {
      args.push(`--allow-write ${allowWrite}`);
    }
    if (config.get<boolean>("run.sandbox.allowEnv") ?? false) {
      args.push("--allow-env");
    }
    if (config.get<boolean>("run.sandbox.allowNet") ?? false) {
      args.push("--allow-net");
    }
    if (config.get<boolean>("run.sandbox.allowSpawn") ?? false) {
      args.push("--allow-spawn");
    }
    const timeLimit = config.get<number>("run.sandbox.timeLimit") ?? 0;
    if (timeLimit > 0) {
      args.push(`--time-limit ${timeLimit}`);
    }
    const memLimit = config.get<number>("run.sandbox.memLimit") ?? 0;
    if (memLimit > 0) {
      args.push(`--mem-limit ${memLimit}`);
    }
  }

  return `${bin} run ${args.join(" ")}`;
}

function buildCheckArgs(config: vscode.WorkspaceConfiguration, strict: boolean): string {
  const parts: string[] = [];
  if (strict) {
    parts.push("--strict");
  }
  const maxErrors = config.get<number>("check.maxErrors") ?? 0;
  if (maxErrors > 0) {
    parts.push(`--max-errors ${maxErrors}`);
  }
  const suppress = (config.get<string[]>("check.suppress") ?? []).join(",");
  if (suppress) {
    parts.push(`--suppress ${suppress}`);
  }
  return parts.length ? " " + parts.join(" ") : "";
}

function buildBuildArgs(config: vscode.WorkspaceConfiguration, release: boolean): string {
  const parts: string[] = [];
  if (release) {
    parts.push("--release");
  }
  const outputPath = config.get<string>("build.outputPath") ?? "";
  if (outputPath) {
    parts.push(`--output ${q(outputPath)}`);
  }
  const emit = (config.get<string[]>("build.emit") ?? []).join(",");
  if (emit) {
    parts.push(`--emit ${emit}`);
  }
  return parts.length ? " " + parts.join(" ") : "";
}

function traceLevelFromSetting(setting: string): Trace {
  switch (setting) {
    case "messages":
      return Trace.Messages;
    case "verbose":
      return Trace.Verbose;
    default:
      return Trace.Off;
  }
}

async function applyClientTraceFromConfig(): Promise<void> {
  if (!client) {
    return;
  }
  const config = vscode.workspace.getConfiguration("fidan");
  await client.setTrace(traceLevelFromSetting(config.get<string>("trace.server") ?? "off"));
}

function refreshFormatOnSave(context: vscode.ExtensionContext): void {
  formatOnSaveDisposable?.dispose();
  formatOnSaveDisposable = undefined;

  const config = vscode.workspace.getConfiguration("fidan");
  if (!(config.get<boolean>("format.onSave") ?? true)) {
    return;
  }

  formatOnSaveDisposable = vscode.workspace.onWillSaveTextDocument(
    async (event: vscode.TextDocumentWillSaveEvent) => {
      if (event.document.languageId !== "fidan") {
        return;
      }
      if (!client || !client.isRunning()) {
        return;
      }

      const editorConfig = vscode.workspace.getConfiguration("editor", event.document.uri);
      if (editorConfig.get<boolean>("formatOnSave") ?? false) {
        return;
      }

      const liveConfig = vscode.workspace.getConfiguration("fidan");
      const tabSizeSetting = editorConfig.get<number | string>("tabSize");
      const tabSize =
        typeof tabSizeSetting === "number"
          ? tabSizeSetting
          : (liveConfig.get<number>("format.indentWidth") ?? 4);
      const insertSpaces = editorConfig.get<boolean>("insertSpaces") ?? true;
      event.waitUntil(
        vscode.commands
          .executeCommand<vscode.TextEdit[]>(
            "vscode.executeFormatDocumentProvider",
            event.document.uri,
            { tabSize, insertSpaces },
          )
          .then((edits: vscode.TextEdit[] | undefined) => edits ?? []),
      );
    },
  );
  context.subscriptions.push(formatOnSaveDisposable);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel("Fidan Language Server");
  context.subscriptions.push(outputChannel);

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  statusBarItem.command = "fidan.showOutput";
  statusBarItem.tooltip = "Fidan Language Server — click to show output";
  setStatusBarStarting();
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand("fidan.restartServer", async () => {
      setStatusBarStarting();
      await stopClient();
      await startClient();
      vscode.window.showInformationMessage("Fidan language server restarted.");
    }),
    vscode.commands.registerCommand("fidan.showOutput", () => {
      outputChannel.show();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("fidan.runFile", async () => {
      const filePath = await requireActiveFidanFile();
      if (!filePath) {
        return;
      }
      const config = vscode.workspace.getConfiguration("fidan");
      const reloadDefault = config.get<boolean>("run.reload") ?? false;
      const pick = await vscode.window.showQuickPick(
        [
          { label: "$(play) Run", detail: "Run the file once", reload: false },
          {
            label: "$(sync) Run with --reload",
            detail: "Watch for changes and re-run",
            reload: true,
          },
        ].map(item => ({ ...item, picked: item.reload === reloadDefault })),
        { title: "Fidan: Run Current File", placeHolder: "Select run mode" },
      );
      if (!pick) {
        return;
      }
      const termName = config.get<string>("run.terminalName") ?? "Fidan";
      runCmd(
        pick.reload ? `${termName}: Reload` : termName,
        buildRunCommand(terminalBin(config), filePath, config, pick.reload),
      );
    }),
    vscode.commands.registerCommand("fidan.checkFile", async () => {
      const filePath = await requireActiveFidanFile();
      if (!filePath) {
        return;
      }
      const config = vscode.workspace.getConfiguration("fidan");
      const strictDefault = config.get<boolean>("check.strict") ?? false;
      const pick = await vscode.window.showQuickPick(
        [
          { label: "$(check) Check", detail: "Standard diagnostics", strict: false },
          {
            label: "$(warning) Check --strict",
            detail: "Treat select warnings as errors",
            strict: true,
          },
        ].map(item => ({ ...item, picked: item.strict === strictDefault })),
        { title: "Fidan: Check File", placeHolder: "Select check mode" },
      );
      if (!pick) {
        return;
      }
      runCmd(
        "Fidan: Check",
        `${terminalBin(config)} check ${q(filePath)}${buildCheckArgs(config, pick.strict)}`,
      );
    }),
    vscode.commands.registerCommand("fidan.fixFile", async () => {
      const filePath = await requireActiveFidanFile();
      if (!filePath) {
        return;
      }
      const config = vscode.workspace.getConfiguration("fidan");
      const pick = await vscode.window.showQuickPick(
        [
          { label: "$(tools) Apply fixes", detail: "Rewrite the file in place", dryRun: false },
          { label: "$(eye) Dry run (preview only)", detail: "Show what would change", dryRun: true },
        ],
        { title: "Fidan: Fix File", placeHolder: "Select fix mode" },
      );
      if (!pick) {
        return;
      }
      const dryRunArg = pick.dryRun ? " --dry-run" : "";
      runCmd("Fidan: Fix", `${terminalBin(config)} fix${dryRunArg} ${q(filePath)}`);
    }),
    vscode.commands.registerCommand("fidan.formatFile", async () => {
      await vscode.commands.executeCommand("editor.action.formatDocument");
    }),
    vscode.commands.registerCommand("fidan.buildFile", async () => {
      const filePath = await requireActiveFidanFile();
      if (!filePath) {
        return;
      }
      const config = vscode.workspace.getConfiguration("fidan");
      const releaseDefault = config.get<boolean>("build.release") ?? false;
      const pick = await vscode.window.showQuickPick(
        [
          { label: "$(package) Build", detail: "Debug build", release: false },
          { label: "$(rocket) Build --release", detail: "Optimized build", release: true },
        ].map(item => ({ ...item, picked: item.release === releaseDefault })),
        { title: "Fidan: Build File", placeHolder: "Select build mode" },
      );
      if (!pick) {
        return;
      }
      runCmd(
        "Fidan: Build",
        `${terminalBin(config)} build ${q(filePath)}${buildBuildArgs(config, pick.release)}`,
      );
    }),
    vscode.commands.registerCommand("fidan.testFile", async () => {
      const filePath = await requireActiveFidanFile();
      if (!filePath) {
        return;
      }
      const config = vscode.workspace.getConfiguration("fidan");
      const suppress = (config.get<string[]>("check.suppress") ?? []).join(",");
      const suppressArg = suppress ? ` --suppress ${suppress}` : "";
      runCmd("Fidan: Test", `${terminalBin(config)} test ${q(filePath)}${suppressArg}`);
    }),
    vscode.commands.registerCommand("fidan.profileFile", async () => {
      const filePath = await requireActiveFidanFile();
      if (!filePath) {
        return;
      }
      const config = vscode.workspace.getConfiguration("fidan");
      const outFile = config.get<string>("profile.outputFile") ?? "";
      const outArg = outFile ? ` --profile-out ${q(outFile)}` : "";
      runCmd("Fidan: Profile", `${terminalBin(config)} profile ${q(filePath)}${outArg}`);
    }),
    vscode.commands.registerCommand("fidan.explainCode", async () => {
      const code = await vscode.window.showInputBox({
        title: "Fidan: Explain Diagnostic Code",
        prompt: "Enter a Fidan diagnostic code",
        placeHolder: "E0101",
        validateInput: value =>
          /^[EWR]\d{4}$/i.test(value.trim())
            ? undefined
            : "Format must be like E0101, W1005, or R2001",
      });
      if (!code) {
        return;
      }
      const config = vscode.workspace.getConfiguration("fidan");
      runCmd(
        "Fidan: Explain Diagnostic",
        `${terminalBin(config)} explain-diag ${code.trim().toUpperCase()}`,
      );
    }),
    vscode.commands.registerCommand("fidan.explainLine", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "fidan") {
        vscode.window.showWarningMessage("Fidan: Open a .fdn file first.");
        return;
      }
      await editor.document.save();
      const filePath = editor.document.uri.fsPath;
      const startLine = editor.selection.start.line + 1;
      const endLine = editor.selection.end.line + 1;
      const config = vscode.workspace.getConfiguration("fidan");
      const endArg = endLine > startLine ? ` --end-line ${endLine}` : "";
      runCmd(
        "Fidan: Explain",
        `${terminalBin(config)} explain ${q(filePath)} --line ${startLine}${endArg}`,
      );
    }),
    vscode.commands.registerCommand("fidan.newProject", async () => {
      const name = await vscode.window.showInputBox({
        title: "Fidan: New Project",
        prompt: "Project name",
        placeHolder: "my_project",
        validateInput: value => (value.trim() ? undefined : "Project name cannot be empty."),
      });
      if (!name) {
        return;
      }
      const folderUris = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select parent directory",
        title: "Choose where to create the project",
      });
      const dir = folderUris?.[0]?.fsPath;
      const dirArg = dir ? ` --dir ${q(dir)}` : "";
      const config = vscode.workspace.getConfiguration("fidan");
      runCmd("Fidan: New", `${terminalBin(config)} new ${name.trim()}${dirArg}`);
      if (dir) {
        const projectPath = path.join(dir, name.trim());
        const choice = await vscode.window.showInformationMessage(
          `Project '${name.trim()}' created at ${projectPath}`,
          "Open Folder",
        );
        if (choice === "Open Folder") {
          void vscode.commands.executeCommand(
            "vscode.openFolder",
            vscode.Uri.file(projectPath),
            { forceNewWindow: false },
          );
        }
      }
    }),
    vscode.commands.registerCommand("fidan.openRepl", () => {
      const config = vscode.workspace.getConfiguration("fidan");
      const trace = config.get<string>("run.trace") ?? "none";
      const traceArg = trace !== "none" ? ` --trace ${trace}` : "";
      const terminal = vscode.window.createTerminal("Fidan: REPL");
      terminal.show();
      terminal.sendText(`${terminalBin(config)} repl${traceArg}`);
    }),
  );

  refreshFormatOnSave(context);
  configWatcherDisposable = vscode.workspace.onDidChangeConfiguration(async e => {
    if (
      e.affectsConfiguration("fidan.server.path") ||
      e.affectsConfiguration("fidan.server.extraArgs") ||
      e.affectsConfiguration("fidan.format.indentWidth") ||
      e.affectsConfiguration("fidan.format.maxLineLen")
    ) {
      setStatusBarStarting();
      await stopClient();
      await startClient();
      return;
    }

    if (e.affectsConfiguration("fidan.trace.server")) {
      await applyClientTraceFromConfig();
    }
    if (e.affectsConfiguration("fidan.format.onSave")) {
      refreshFormatOnSave(context);
    }
  });
  context.subscriptions.push(configWatcherDisposable);

  await startClient();
}

export async function deactivate(): Promise<void> {
  formatOnSaveDisposable?.dispose();
  configWatcherDisposable?.dispose();
  await stopClient();
}

async function startClient(): Promise<void> {
  const config = vscode.workspace.getConfiguration("fidan");
  const binaryPath = fidanBin(config);
  const extraArgs: string[] = config.get("server.extraArgs") ?? [];

  const serverOptions: ServerOptions = {
    run: {
      command: binaryPath,
      args: ["lsp", ...extraArgs],
      transport: TransportKind.stdio,
    },
    debug: {
      command: binaryPath,
      args: ["lsp", ...extraArgs],
      transport: TransportKind.stdio,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "fidan" }],
    outputChannel,
    revealOutputChannelOn: RevealOutputChannelOn.Error,
    traceOutputChannel: outputChannel,
    initializationOptions: {
      indentWidth: config.get<number>("format.indentWidth") ?? 4,
      maxLineLen: config.get<number>("format.maxLineLen") ?? 100,
    },
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.fdn"),
    },
    markdown: { isTrusted: true },
  };

  client = new LanguageClient("fidan", "Fidan Language Server", serverOptions, clientOptions);

  try {
    await client.start();
    await applyClientTraceFromConfig();
    outputChannel.appendLine("[fidan] Language server started.");
    setStatusBarRunning();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[fidan] Failed to start language server: ${message}`);
    outputChannel.appendLine(
      "[fidan] Make sure the 'fidan' binary is on your PATH or set 'fidan.server.path' in settings.",
    );
    setStatusBarError();
  }
}

async function stopClient(): Promise<void> {
  if (client) {
    outputChannel.appendLine("[fidan] Stopping language server.");
    await client.stop();
    client = undefined;
    setStatusBarStopped();
  }
}

function setStatusBarRunning(): void {
  if (!statusBarItem) {
    return;
  }
  statusBarItem.text = "$(check) Fidan";
  statusBarItem.backgroundColor = undefined;
  statusBarItem.tooltip = "Fidan Language Server — running. Click to show output.";
}

function setStatusBarStarting(): void {
  if (!statusBarItem) {
    return;
  }
  statusBarItem.text = "$(sync~spin) Fidan";
  statusBarItem.backgroundColor = undefined;
  statusBarItem.tooltip = "Fidan Language Server — starting…";
}

function setStatusBarStopped(): void {
  if (!statusBarItem) {
    return;
  }
  statusBarItem.text = "$(circle-slash) Fidan";
  statusBarItem.backgroundColor = undefined;
  statusBarItem.tooltip = "Fidan Language Server — stopped. Click to show output.";
}

function setStatusBarError(): void {
  if (!statusBarItem) {
    return;
  }
  statusBarItem.text = "$(error) Fidan";
  statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
  statusBarItem.tooltip = "Fidan Language Server — failed to start. Click to show output.";
}
