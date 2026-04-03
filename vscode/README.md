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
| Integrated REPL | ✅ |
| Profiling | ✅ |
| Sandbox mode with fine-grained permissions | ✅ |

## Requirements

The `fidan` binary must be on your `PATH`, or point the extension at it via `fidan.server.path`.

Build from source:

```bash
git clone https://github.com/fidan-lang/fidan
cd fidan
cargo build --release
# Add target/release/ to your PATH
```

## Commands

All commands are available from the **Command Palette** (`Ctrl+Shift+P`). **Run** and **Test** also appear as title-bar icons when a `.fdn` file is active.

| Command | Description |
|---|---|
| `Fidan: Run Current File` | Run the active `.fdn` file in an integrated terminal |
| `Fidan: Build File` | Compile to a native binary via Cranelift AOT |
| `Fidan: Check File` | Type-check without producing output |
| `Fidan: Fix File` | Apply auto-fixable diagnostics |
| `Fidan: Format Current File` | Format the active file through the language server |
| `Fidan: Run Tests in Current File` | Discover and run all `test { }` blocks |
| `Fidan: Profile Current File` | Run with profiling instrumentation |
| `Fidan: Open REPL` | Open a `fidan repl` session |
| `Fidan: New Project` | Scaffold a new Fidan project |
| `Fidan: Explain Diagnostic Code` | Look up a diagnostic code (for example `E0109`) |
| `Fidan: Explain Current Line(s)` | Explain the selected line range |
| `Fidan: Restart Language Server` | Kill and restart the LSP process |
| `Fidan: Show Language Server Output` | Open the LSP output channel |

## Extension Settings

### Language Server

| Setting | Default | Description |
|---|---|---|
| `fidan.server.path` | `"fidan"` | Path to the `fidan` binary |
| `fidan.server.extraArgs` | `[]` | Extra arguments forwarded to `fidan lsp` |
| `fidan.trace.server` | `"off"` | LSP trace level: `off` \| `messages` \| `verbose` |

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
| `fidan.run.trace` | `"none"` | Panic stack-trace mode: `none` \| `short` \| `full` \| `compact` |
| `fidan.run.jitThreshold` | `500` | Cranelift JIT call threshold (`0` = disable JIT) |
| `fidan.run.suppress` | `[]` | Diagnostic codes to suppress |
| `fidan.run.emit` | `[]` | Emit intermediate IRs: `tokens` \| `ast` \| `hir` \| `mir` |
| `fidan.run.maxErrors` | `0` | Stop after N errors (`0` = no limit) |

### Sandbox

When `fidan.run.sandbox` is `true`, file/env/net/spawn access is denied by default. Grant permissions individually:

| Setting | Default | Description |
|---|---|---|
| `fidan.run.sandbox` | `false` | Enable sandbox mode |
| `fidan.run.sandbox.allowRead` | `[]` | Allowed read path prefixes (`["*"]` = all) |
| `fidan.run.sandbox.allowWrite` | `[]` | Allowed write path prefixes |
| `fidan.run.sandbox.allowEnv` | `false` | Allow environment variable access |
| `fidan.run.sandbox.allowNet` | `false` | Allow network access |
| `fidan.run.sandbox.allowSpawn` | `false` | Allow spawning child processes |
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
| `fidan.build.emit` | `[]` | Emit intermediate IRs during build |
| `fidan.profile.outputFile` | `""` | Write profiling data to a JSON file |

## License

Licensed under the **Apache License 2.0** — see [LICENSE](LICENSE) for the full text.

Additional terms apply regarding trademark use and commercial distribution of the Fidan language; see [NOTICE](NOTICE).

Copyright © 2026 Kaan Gönüldinc (AppSolves). All rights reserved.  
**Fidan™** is a trademark of Kaan Gönüldinc (AppSolves).
