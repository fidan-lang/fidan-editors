# Fidan — VS Code Extension

First-class VS Code support for the [Fidan](https://fidan.dev) programming language. Powered by the `fidan lsp` language server.

## Features

| Feature | Status |
|---|---|
| Syntax highlighting (TextMate grammar) | ✅ |
| Semantic token highlighting | ✅ |
| Bracket, comment, and indent rules | ✅ |
| Code snippets | ✅ |
| Format on save (`fidan format`) | ✅ via LSP |
| Error & warning diagnostics | ✅ via LSP |
| Hover | ✅ via LSP |
| Auto-completion | ✅ via LSP |
| Go to definition | ✅ via LSP |
| Find references | ✅ via LSP |
| Inline type hints | ✅ via LSP |
| Quick fixes / code actions | ✅ via LSP |
| Run / Build / Test / Check / Fix from the editor | ✅ |
| AI-assisted fix / improve / explain commands | ✅ |
| Integrated REPL | ✅ |
| Profiling | ✅ |
| Sandbox mode with fine-grained permissions | ✅ |

## Requirements

Compatibility target: **Fidan CLI 1.0.16**. Normal editing and LSP features require only the `fidan` binary on your `PATH`, or an explicit `fidan.server.path`. AI-assisted commands additionally require a compatible `ai-analysis` toolchain and provider configuration; AI setup is optional for normal editing.

### Selecting the compiler for newer language APIs

The **Fidan** output channel records the executable selected by
`fidan.server.path`, the spawned `lsp` command and the server-reported version.
Changing that setting restarts the language server. An absolute path also avoids
selecting a different installation from PATH; paths containing spaces are supported.

Callable reflection (`action.name`, `.parameters`, `.invoke(list)`), imported
custom decorators and their associated diagnostics are tested with the coordinated
future compiler candidate. The published Fidan 1.0.16 binary does not implement
those new APIs. Point `fidan.server.path` at the candidate when editing candidate
sources; installing this extension does not upgrade the compiler. Normal editing
with the published compiler remains supported within that compiler's language
surface. AI provider configuration is unrelated to this selection.

Build from source:

```bash
git clone https://github.com/fidan-lang/fidan.git
cd fidan
cargo build --release
# Add target/release/ to your PATH
```

## Commands

All commands are available from the **Command Palette** (`Ctrl+Shift+P`). **Run** and **Test** also appear as title-bar icons when a `.fdn` file is active.

| Command | Description |
|---|---|
| `Fidan: Run Current File` | Run the active `.fdn` file in an integrated terminal |
| `Fidan: Build File` | Compile to a native binary using the selected available AOT backend |
| `Fidan: Check File` | Type-check without producing output |
| `Fidan: Fix File` | Apply auto-fixable diagnostics |
| `Fidan: AI Fix File` | Run `fidan fix --ai` with optional steering text |
| `Fidan: AI Improve File` | Run `fidan fix --improve` with optional steering text |
| `Fidan: Format Current File` | Format the active file through the language server |
| `Fidan: Run Tests in Current File` | Discover and run all `test { }` blocks |
| `Fidan: Profile Current File` | Run with profiling instrumentation |
| `Fidan: Open REPL` | Open a `fidan repl` session |
| `Fidan: New Project` | Send the scaffold command to the terminal; inspect its output for success |
| `Fidan: Explain Diagnostic Code` | Look up a diagnostic code (for example `E0109`) |
| `Fidan: Explain Selection` | Available from the editor context menu when text is selected; explains the selected line span |
| `Fidan: Explain Current Line(s)` | Explain the current line or derive the selected line range automatically |
| `Fidan: Explain Current Line(s) with AI` | Run `fidan explain <file> --line ... --ai` for the current line or active selection |
| `Fidan: Restart Language Server` | Kill and restart the LSP process |
| `Fidan: Show Language Server Output` | Open the LSP output channel |

## Extension Settings

### Language Server

| Setting | Default | Description |
|---|---|---|
| `fidan.server.path` | `"fidan"` | Path to the `fidan` binary |
| `fidan.server.extraArgs` | `[]` | Extra arguments forwarded to `fidan lsp` |
| `fidan.trace.server` | `"off"` | LSP trace level: `off` \| `messages` \| `verbose` |

### Compiler operational diagnostics (candidate)

When using the new compiler candidate, set `fidan.server.extraArgs` to `["-vvv"]`
for internal TRACE diagnostics, `["-vv"]` for DEBUG, or `["-v"]` for INFO.
These records reach the language-server output channel over stderr; JSON-RPC
continues to use stdout. `fidan.trace.server` separately controls client protocol
tracing. The published Fidan 1.0.16 binary does not support these new flags.
Normal editing needs neither verbose logging nor AI/provider setup. Logs omit
source and credential payloads but may contain private local paths and package
identities; review them before sharing.

### Formatting

| Setting | Default | Description |
|---|---|---|
| `fidan.format.indentWidth` | `4` | Spaces per indent level used for LSP formatting defaults |
| `fidan.format.maxLineLen` | `100` | Target maximum line length for formatting defaults |
| `fidan.format.onSave` | `true` | Format automatically on save |

`.fidanfmt` files are still respected by the formatter itself; these settings are the editor-side defaults and CLI overrides.

### Run

| Setting | Default | Description |
|---|---|---|
| `fidan.run.terminalName` | `"Fidan"` | Name of the integrated terminal |
| `fidan.run.reload` | `false` | Pass `--reload` (watch and re-run on change) |
| `fidan.run.strict` | `false` | Treat select warnings as errors |
| `fidan.run.trace` | `"none"` | Run and REPL stack-trace mode: `none` \| `short` \| `full` \| `compact`; REPL always receives the selected mode |
| `fidan.run.jitThreshold` | `500` | Cranelift JIT call threshold (`0` = disable JIT) |
| `fidan.run.suppress` | `[]` | Diagnostic codes to suppress |
| `fidan.run.emit` | `[]` | Emit intermediate IRs: `tokens` \| `ast` \| `hir` \| `mir` |
| `fidan.run.maxErrors` | `1` | Stop after N errors (`0` = no limit; passed explicitly) |

### Sandbox

When `fidan.run.sandbox.enabled` is `true`, file and environment access is denied by default. Grant permissions individually:

The audit candidate uses `.enabled` to avoid a VS Code configuration collision
between a boolean parent and its permission children. The old boolean
`fidan.run.sandbox` remains recognized as a legacy on/off flag; remove that key
and use `.enabled` when configuring permissions. This migration is unreleased.


| Setting | Default | Description |
|---|---|---|
| `fidan.run.sandbox.enabled` | `false` | Enable sandbox mode |
| `fidan.run.sandbox.allowRead` | `[]` | Allowed read path prefixes (`["*"]` = all) |
| `fidan.run.sandbox.allowWrite` | `[]` | Allowed write path prefixes |
| `fidan.run.sandbox.allowEnv` | `false` | Allow environment variable access |
| `fidan.run.sandbox.timeLimit` | `0` | Wall-time limit in seconds (`0` = none) |
| `fidan.run.sandbox.memLimit` | `0` | Memory limit in MB (`0` = none) |

### Check

| Setting | Default | Description |
|---|---|---|
| `fidan.check.strict` | `false` | Pass `--strict` to `fidan check` |
| `fidan.check.maxErrors` | `0` | Stop after N errors |
| `fidan.check.suppress` | `[]` | Suppressed diagnostic codes |

### Build & Profile

| Setting | Default | Description |
|---|---|---|
| `fidan.build.release` | `false` | Build in release mode |
| `fidan.build.outputPath` | `""` | Output binary path (empty = default `out/`) |
| `fidan.build.emit` | `[]` | Emit `tokens` \| `ast` \| `hir` \| `mir` \| `obj` during build (`obj` is build-only) |
| `fidan.profile.outputFile` | `""` | Write profiling data to a JSON file |

## License

Licensed under the **Apache License 2.0** — see [LICENSE](LICENSE) for the full text.

Commercial use, modification, redistribution, sale and hosting are permitted under
the license. Preserve [NOTICE](NOTICE) attribution. Branding is separate from the
software license: see the [Fidan trademark policy](https://github.com/fidan-lang/fidan/blob/main/TRADEMARKS.md).
Truthful descriptive references and independent forks are welcome; do not falsely
claim official affiliation or endorsement.

Copyright © 2026 Kaan Gönüldinc (AppSolves). All rights reserved.  
Fidan identifies the official language project; branding guidance is linked above.

Terminal commands quote arguments literally for PowerShell and POSIX shells. For cmd.exe, unsafe shell metacharacters are rejected; select PowerShell or Bash for such paths. Run settings are placed before the source filename so Fidan consumes them rather than forwarding them to the program.

Terminal commands open a fresh terminal using the current default profile, so
quoting cannot drift from a reused terminal's shell. PowerShell, the Windows
Command Prompt and WSL profiles, and POSIX-shell argument quoting are handled separately.
Arguments unsafe for Command Prompt expansion are rejected; use PowerShell/Bash
for paths containing its expansion/metacharacters. Commands sent to a terminal
do not imply successful completion.

To verify the candidate diagnostics transport locally, run `npm run check:host`
with `FIDAN_HOST_DIAGNOSTICS=trace`, `FIDAN_BIN` selecting the new candidate and
`VSCODE_EXECUTABLE` selecting an isolated VS Code host. The manual verification
workflow exposes the corresponding `cli_diagnostics` input alongside `compiler_ref`.
Old public compilers are not expected to implement these new flags.
