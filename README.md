<div align="center">
  <img src="vscode/icons/icon.png" width="96" alt="Fidan logo" />
  <h1>fidan-editors</h1>
  <p><em>Official editor integrations for the <strong>Fidan</strong> programming language</em></p>

  [![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/fidan.fidan?label=Marketplace&logo=visualstudiocode&logoColor=white&color=0078d7)](https://marketplace.visualstudio.com/items?itemName=fidan.fidan)
  [![VS Code Engine](https://img.shields.io/badge/VS%20Code-%5E1.110.0-007ACC?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com)
  [![License](https://img.shields.io/badge/license-Apache--2.0%20(Modified)-brightgreen)](LICENSE)
  [![Fidan Language](https://img.shields.io/badge/language-Fidan-orange)](https://github.com/fidan-lang/fidan)
</div>

---

## Contents

- [VS Code Extension](#-vs-code-extension)
  - [Features](#features)
  - [Installation](#installation)
  - [Language Overview](#language-overview)
  - [Commands](#commands)
  - [Settings](#settings)
  - [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## VS Code Extension

The **Fidan** VS Code extension (`fidan.fidan`) provides first-class editing support for `.fdn` source files, backed by the `fidan lsp` language server that ships with the compiler.

### Features

| Feature | Status |
|---|---|
| Syntax highlighting (TextMate grammar) | ✅ |
| Semantic token highlighting | ✅ |
| Bracket & comment configuration | ✅ |
| Code snippets | ✅ |
| Format on save (`fidan fmt`) | ✅ via LSP |
| Error & warning diagnostics | ✅ via LSP |
| Run / Build / Test / Check / Fix from the editor | ✅ |
| Integrated REPL | ✅ |
| Profiling | ✅ |
| Sandbox mode with fine-grained permissions | ✅ |
| Hover documentation | 🚧 in progress |
| Auto-completion | 🚧 planned |
| Go to definition / find references | 🚧 planned |
| Inline type hints | 🚧 in progress |

---

### Installation

#### From the Marketplace *(recommended)*

Search for **Fidan** in the VS Code Extensions panel, or install directly:

```
ext install fidan.fidan
```

#### From Source

1. Clone this repository and build the [Fidan compiler](https://github.com/fidan-lang/fidan):

   ```bash
   git clone https://github.com/fidan-lang/fidan
   cd fidan
   cargo build --release
   # Add target/release/ to your PATH
   ```

2. Then build and install the extension:

   ```bash
   cd fidan-editors/vscode
   npm install
   npm run compile
   ```

   Press **F5** in VS Code to launch the Extension Development Host.

> **Requirement:** The `fidan` binary must be on your `PATH`, or configure `fidan.server.path` to point to it explicitly.

---

### Language Overview

Fidan is an English-readable compiled language. Below are bite-sized examples of common patterns — all valid `.fdn` syntax.

#### Variables

```fidan
var x set 10                    # integer
var greeting set "hello"        # string
var ratio set 3.14              # float
var flag set true               # boolean
var nothing_val set nothing     # null
var d set dynamic               # opt out of static type checking
```

#### Actions (functions)

```fidan
action greet with (certain name oftype string) returns string
    return "Hello, " + name
end

action safe_div with (certain a oftype integer, certain b oftype integer) returns float
    if b equals 0 then return 0.0 end
    return a / b
end
```

#### Objects (classes)

```fidan
object Point
    var x oftype integer
    var y oftype integer

    action new with (certain x oftype integer, certain y oftype integer)
        set self.x = x
        set self.y = y
    end

    action to_string returns string
        return "(" + self.x + ", " + self.y + ")"
    end
end
```

#### Enums

```fidan
enum Direction
    North
    South
    East
    West
end
```

#### Control Flow

```fidan
# if / else if / else
if score > 90 then
    print("A")
else if score > 75 then
    print("B")
else
    print("C")
end

# loop (range-based, implicit loop variable i)
loop from 1 to 10
    print(i)
end

# for-each
for item in items
    print(item)
end

# while
while queue is not empty
    process(queue)
end

# pattern matching
check status
    case 200 => print("OK")
    case 404 => print("Not found")
    else     => print("Unknown")
end
```

#### Concurrency

```fidan
# Cooperative I/O tasks
concurrent
    task A { fetch("https://api.example.com/a") }
    task B { fetch("https://api.example.com/b") }
end

# True OS threads (Rayon)
parallel
    task A { heavy_compute_a() }
    task B { heavy_compute_b() }
end

# Explicit futures
var handle set spawn expensive_action()
await handle

# Shared cross-thread state (Arc<Mutex>)
var counter oftype Shared oftype integer set 0
```

#### Imports & Decorators

```fidan
use std.io                    # stdlib I/O namespace
use std.io.{print, read}      # selective import
use mymodule as mod           # import with alias

@precompile                   # eager Cranelift JIT warm-up
action hot_path with (certain n oftype integer) returns integer
    return n * n
end
```

---

### Commands

All commands are reachable via the **Command Palette** (`Ctrl+Shift+P`). Run and Test also appear as title-bar icons when a `.fdn` file is active.

| Command | Description |
|---|---|
| `Fidan: Run Current File` | Run the active `.fdn` file in an integrated terminal |
| `Fidan: Build File` | Compile to a native binary via Cranelift AOT |
| `Fidan: Check File` | Type-check without producing output |
| `Fidan: Fix File` | Apply auto-fixable diagnostics |
| `Fidan: Format Current File` | Invoke `fidan fmt` on the active file |
| `Fidan: Run Tests in Current File` | Discover and run all `test { }` blocks |
| `Fidan: Profile Current File` | Run with profiling instrumentation |
| `Fidan: Open REPL` | Open a `fidan repl` session |
| `Fidan: New Project` | Scaffold a new Fidan project |
| `Fidan: Explain Diagnostic Code` | Look up a diagnostic code (e.g. `E0109`) |
| `Fidan: Explain Current Line(s)` | Inline explanation for selected line(s) |
| `Fidan: Restart Language Server` | Kill and restart the LSP process |
| `Fidan: Show Language Server Output` | Open the LSP output channel |

---

### Settings

All settings live under the `fidan.*` namespace in VS Code.

#### Language Server

| Setting | Default | Description |
|---|---|---|
| `fidan.server.path` | `"fidan"` | Path to the `fidan` binary |
| `fidan.server.extraArgs` | `[]` | Extra arguments forwarded to `fidan lsp` |
| `fidan.trace.server` | `"off"` | LSP trace level: `off` \| `messages` \| `verbose` |

#### Formatting

| Setting | Default | Description |
|---|---|---|
| `fidan.format.indentWidth` | `4` | Spaces per indent level |
| `fidan.format.maxLineLen` | `100` | Target maximum line length |
| `fidan.format.onSave` | `true` | Format automatically on save |

#### Run

| Setting | Default | Description |
|---|---|---|
| `fidan.run.terminalName` | `"Fidan"` | Name of the integrated terminal |
| `fidan.run.reload` | `false` | Pass `--reload` (watch & re-run on change) |
| `fidan.run.strict` | `false` | Treat select warnings as errors |
| `fidan.run.trace` | `"none"` | Panic stack-trace mode: `none` \| `short` \| `full` \| `compact` |
| `fidan.run.jitThreshold` | `500` | Cranelift JIT call threshold (`0` = disable JIT) |
| `fidan.run.suppress` | `[]` | Diagnostic codes to suppress (e.g. `["W1004"]`) |
| `fidan.run.emit` | `[]` | Emit intermediate IRs: `tokens` \| `ast` \| `hir` \| `mir` |
| `fidan.run.maxErrors` | `0` | Stop after N errors (`0` = no limit) |

#### Sandbox

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

#### Check

| Setting | Default | Description |
|---|---|---|
| `fidan.check.strict` | `false` | Pass `--strict` to `fidan check` |
| `fidan.check.maxErrors` | `0` | Stop after N errors |
| `fidan.check.suppress` | `[]` | Suppressed diagnostic codes |

#### Build & Profile

| Setting | Default | Description |
|---|---|---|
| `fidan.build.release` | `false` | Build in release mode |
| `fidan.build.outputPath` | `""` | Output binary path (empty = default `out/`) |
| `fidan.build.emit` | `[]` | Emit intermediate IRs during build |
| `fidan.profile.outputFile` | `""` | Write profiling data to a JSON file |

---

### Development

```bash
# Clone this repo
git clone https://github.com/fidan-lang/fidan-editors
cd fidan-editors/vscode

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (incremental rebuild)
npm run watch
```

Press **F5** in VS Code (with this workspace open) to launch the **Extension Development Host** with the extension loaded. Make sure the `fidan` binary is on your PATH first.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and follow the [Code of Conduct](CODE_OF_CONDUCT.md) before submitting a pull request.

Security issues should be reported in accordance with [SECURITY.md](SECURITY.md) rather than opened as public issues.

---

## License

This extension is licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for the full text.

Additional terms apply regarding trademark use and commercial distribution of the Fidan language itself; see [NOTICE](NOTICE).

Copyright © 2026 Kaan Gönüldinc (AppSolves). All rights reserved.  
**Fidan™** is a trademark of Kaan Gönüldinc (AppSolves).
