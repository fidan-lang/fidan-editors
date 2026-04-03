<div align="center">
  <img src="vscode/icons/icon.png" width="96" alt="Fidan logo" />
  <h1>fidan-editors</h1>
  <p><em>Official editor integrations for the <strong>Fidan</strong> programming language</em></p>

  [![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/fidan.fidan?label=Marketplace&logo=visualstudiocode&logoColor=white&color=0078d7)](https://marketplace.visualstudio.com/items?itemName=fidan.fidan)&nbsp;[![VS Code Engine](https://img.shields.io/badge/VS%20Code-%5E1.110.0-007ACC?logo=visualstudiocode&logoColor=white)](https://code.visualstudio.com)
  [![License](https://img.shields.io/badge/license-Apache--2.0%20(Modified)-brightgreen)](LICENSE)&nbsp;[![Fidan Language](https://img.shields.io/badge/language-Fidan-orange)](https://fidan.dev)
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
| Bracket, comment, and indent configuration | ✅ |
| Code snippets | ✅ |
| Format on save (`fidan format`) | ✅ via LSP |
| Error & warning diagnostics | ✅ via LSP |
| Hover documentation | ✅ via LSP |
| Auto-completion | ✅ via LSP |
| Go to definition / find references | ✅ via LSP |
| Inline type hints | ✅ via LSP |
| Quick fixes / code actions | ✅ via LSP |
| Run / Build / Test / Check / Fix from the editor | ✅ |
| Integrated REPL | ✅ |
| Profiling | ✅ |
| Sandbox mode with fine-grained permissions | ✅ |

---

### Installation

#### From the Marketplace *(recommended)*

Search for **Fidan** in the VS Code Extensions panel, or install directly:

```bash
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
   git clone https://github.com/fidan-lang/fidan-editors
   cd fidan-editors/vscode
   npm install
   npm run compile
   ```

   Press **F5** in VS Code to launch the Extension Development Host.

> **Requirement:** The `fidan` binary must be on your `PATH`, or configure `fidan.server.path` to point to it explicitly.

---

### Language Overview

Fidan is an English-readable native language with interpreter, JIT, and AOT workflows. Below are bite-sized examples of common patterns in current `.fdn` syntax.

#### Variables

```fidan
var x = 10
var greeting = "hello"
var ratio = 3.14
var flag = true
var nothingVal = nothing
var d = dynamic
```

#### Actions (functions)

```fidan
action greet with (certain name oftype string) returns string {
    return "Hello, {name}"
}

action safeDiv with (
    certain a oftype integer,
    certain b oftype integer,
) returns float {
    if b == 0 {
        return 0.0
    }
    return a / b
}
```

#### Objects (classes)

```fidan
object Point {
    var x oftype integer = 0
    var y oftype integer = 0

    new with (certain x oftype integer, certain y oftype integer) {
        this.x = x
        this.y = y
    }

    action toString returns string {
        return "({this.x}, {this.y})"
    }
}
```

#### Enums

```fidan
enum Direction {
    North
    South
    East
    West
}
```

#### Control Flow

```fidan
if score > 90 {
    print("A")
} else if score > 75 {
    print("B")
} else {
    print("C")
}

for item in items {
    print(item)
}

while queue.length() > 0 {
    process(queue.pop())
}

check status {
    200 => {
        print("OK")
    }
    404 => {
        print("Not found")
    }
    _ => {
        print("Unknown")
    }
}
```

#### Concurrency

```fidan
use std.async

action square with (certain n oftype integer) returns integer {
    return n * n
}

var handle = spawn square(12)
print("spawn returned a pending handle immediately")
print("await result = {string(await handle)}")

concurrent {
    task first {
        print("same-thread task A")
    }
    task second {
        var nested = spawn square(5)
        print("same-thread task B = {string(await nested)}")
    }
}

parallel {
    task left {
        print("threaded task A")
    }
    task right {
        print("threaded task B")
    }
}

var raced = await async.waitAny([async.sleep(25), async.ready(99)])
print(raced)
```

#### Imports, Raw Strings, and Decorators

```fidan
use std.io
use std.async as async
use mymodule as mod

print(r"literal \\n \{value\}")

@precompile
action hotPath with (certain n oftype integer) returns integer {
    return n * n
}
```

---

### Commands

All commands are reachable via the **Command Palette** (`Ctrl+Shift+P`). **Run** and **Test** also appear as title-bar icons when a `.fdn` file is active.

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
| `fidan.format.indentWidth` | `4` | Spaces per indent level used by formatting defaults |
| `fidan.format.maxLineLen` | `100` | Target maximum line length used by formatting defaults |
| `fidan.format.onSave` | `true` | Format automatically on save |

`.fidanfmt` files are still respected by the formatter itself; these settings act as editor-side defaults and overrides.

#### Run

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

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and follow the [Code of Conduct](CODE_OF_CONDUCT.md) before submitting a pull request.

Security issues should be reported in accordance with [SECURITY.md](SECURITY.md) rather than opened as public issues.

---

## License

This extension is licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for the full text.

Additional terms apply regarding trademark use and commercial distribution of the Fidan language itself; see [NOTICE](NOTICE).

Copyright © 2026 Kaan Gönüldinc (AppSolves). All rights reserved.
**Fidan™** is a trademark of Kaan Gönüldinc (AppSolves).
