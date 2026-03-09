# Contributing to Fidan

Thank you for your interest in contributing to **Fidan**. Contributions help improve the language, tooling, and ecosystem. We welcome improvements such as bug fixes, performance optimizations, documentation updates, tooling, editor support, and ecosystem integrations.

Please read this document before submitting a contribution.

---

## Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/fidan-lang/fidan-editors.git
cd fidan-editors
```

### 2. Install dependencies

```bash
cd vscode
npm install
```

### 3. Compile the extension

```bash
npm run compile
```

Press **F5** in VS Code (with this workspace open) to launch the **Extension Development Host** and test the extension live.

### 4. Run tests

```bash
npm test
```

Before submitting a pull request, make sure the project compiles cleanly and all relevant tests pass.

---

## Project Structure

```text
fidan-editors/
├── vscode/          # VS Code extension (TypeScript)
│   ├── src/         # Extension source (extension.ts)
│   ├── syntaxes/    # TextMate grammar + code snippets (.json)
│   ├── icons/       # Extension icons
│   ├── package.json # Extension manifest
│   └── tsconfig.json
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
└── LICENSE
```

All extension source lives inside `vscode/`. Additional editor integrations (e.g. Neovim, JetBrains) may be added as sibling directories in the future.

As the project evolves, additional crates and tooling may be added. Please try to keep contributions aligned with the existing project structure.

---

## Contribution Guidelines

Please follow these guidelines when contributing:

- Keep pull requests **focused and minimal**
- Include **tests whenever possible**
- Write **clear and descriptive commit messages**
- Follow the existing code style and architecture
- Avoid unrelated refactoring in the same pull request
- Keep changes easy to review

Large architectural changes, language design changes, or major runtime/compiler changes should be discussed in an **issue before implementation**.

If you are unsure whether something fits the project direction, open an issue first before investing large amounts of time.

---

## Branching Rules

Do **not commit directly to `main`**.

All contributions must be made from a separate branch.

Example workflows:

```bash
git checkout -b feature/my-improvement
```

```bash
git checkout -b fix/parser-bug
```

Use descriptive branch names that reflect the purpose of the change.

Recommended prefixes:

- `feature/`
- `fix/`
- `docs/`
- `perf/`
- `refactor/`

---

## Code Style

The extension is written in **TypeScript** and follows standard TypeScript/Node.js conventions.

Before submitting a pull request, run:

```bash
cd vscode
npm run compile
```

Code should compile cleanly with no TypeScript errors or warnings whenever possible.

Please try to match the style and structure already used in the surrounding code. Consistency is more important than personal style preferences.

---

## Pull Request Process

1. Fork the repository
2. Create a new branch for your change
3. Implement your changes
4. Run formatting and tests
5. Open a pull request

Pull requests should include:

- A clear description of the change
- Motivation for the change
- Any relevant issue references
- Tests if applicable
- Notes about limitations or unfinished parts if relevant

All pull requests must pass CI before they can be merged.

Pull requests that mix multiple unrelated changes may be asked to be split into smaller PRs.

---

## Commit Messages

Please write commit messages that clearly explain the purpose of the change.

Good examples:

- `parser: fix precedence handling for null-coalescing operator`
- `runtime: reduce allocation overhead in bytecode VM`
- `docs: add syntax examples for extension actions`

Avoid vague commit messages like:

- `fix stuff`
- `update`
- `changes`

---

## Tests

If your contribution changes behavior, please add or update tests whenever practical.

Relevant test categories may include:

- Extension activation tests
- LSP client integration tests
- Command registration tests
- Syntax highlighting / grammar tests
- Settings round-trip tests

Bug fixes should ideally include a regression test so the issue does not return later.

---

## Documentation

If you introduce new syntax, change behavior, or modify developer workflows, please update the relevant documentation as part of the same pull request when possible.

This may include:

- `README`
- language documentation
- architecture notes
- editor/tooling documentation

---

## Contributor License Agreement (CLA)

Before a pull request can be merged, contributors must sign the **Fidan Contributor License Agreement (CLA)**.

The CLA ensures that contributions can legally be included in the Fidan project and distributed under the project’s license.

Details will be provided during the pull request process.

---

## Reporting Bugs

If you encounter a bug, please open a GitHub issue and include:

- Extension version (found in the Extensions panel)
- VS Code version
- `fidan` binary version (`fidan --version`)
- Operating system
- Steps to reproduce
- Expected behaviour
- Actual behaviour
- Any relevant logs (use `Fidan: Show Language Server Output` to capture LSP output)

Clear reproduction steps make issues much easier to investigate.

---

## Feature Requests

Feature proposals should include:

- Motivation for the feature
- A short design overview
- Potential impact on the language or tooling
- Examples of intended usage
- Possible tradeoffs if relevant

Major language features should always be discussed before implementation.

---

## Security

If you discover a security issue, please avoid posting exploit details publicly before the issue can be assessed.

If a dedicated security policy exists later, follow that process. Until then, report security-sensitive issues responsibly.

See [SECURITY.md](SECURITY.md) for more details.

---

## Code of Conduct

Please be respectful, constructive, and professional when interacting with other contributors.

Fidan aims to maintain a welcoming and high-quality development environment.

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for more details.

---

## Final Note

By contributing to Fidan, you help improve the language and its ecosystem for everyone. Thank you for your contribution.