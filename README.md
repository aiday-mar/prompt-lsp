# Prompt LSP

[![CI](https://github.com/pierceboggan/prompt-lsp/actions/workflows/ci.yml/badge.svg)](https://github.com/pierceboggan/prompt-lsp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Language Server Protocol implementation for analyzing, validating, and improving AI prompt files. Works with `.prompt.md`, `.agent.md`, `.instructions.md`, and skill files — providing LLM-powered semantic analysis directly in VS Code.

## Features

### LLM-Powered Analysis (via GitHub Copilot)

- **Contradiction Detection** — Finds logical, behavioral, and format conflicts
- **Semantic Ambiguity** — Deeper ambiguity analysis with rewrite suggestions
- **Persona Consistency** — Detects conflicting personality traits and tone drift
- **Cognitive Load Assessment** — Warns about overly complex prompts with too many nested conditions
- **Semantic Coverage** — Identifies gaps in intent handling and missing error paths
- **Composition Conflict Analysis** — Detects conflicts across linked/composed prompt files

### Editor Integration

- **Status Bar** — One-click "Analyze Prompt" button in the status bar

## Supported File Types

| Pattern | Type |
|---|---|
| `*.agent.md` | Agent |
| `*.prompt.md` | Prompt |
| `*.instructions.md` | Instructions |
| `**/skills/**/SKILL.md` | Skill |

## Installation

```bash
git clone https://github.com/pierceboggan/prompt-lsp.git
cd prompt-lsp
npm install
npm run build
```

Then press `F5` in VS Code to launch the Extension Development Host.

## Usage

1. Open any supported prompt file in VS Code
2. Click **Analyze Prompt** in the status bar or run the command
3. **LLM diagnostics** require GitHub Copilot
4. Use the **Problems panel** (`Ctrl+Shift+M`) to see all issues

### Commands

| Command | Description |
|---------|-------------|
| `Prompt LSP: Analyze Prompt` | Run full analysis (including LLM) |

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `promptLSP.enable` | `true` | Enable/disable the extension |
| `promptLSP.trace.server` | `off` | Trace communication between VS Code and the language server |

### LLM Analysis

LLM-powered analysis uses **GitHub Copilot's `vscode.lm` API** — no API keys needed. Just sign in to GitHub Copilot in VS Code and the semantic analyses activate automatically.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Prompt Document                         │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│  Layer 1: Static Analysis│  │ Layer 2: LLM Analysis        │
│                          │  │                              │
│  • Variables & structure │  │ • Contradictions & persona   │
│  • Strength & ambiguity  │  │ • Coverage & output shape    │
│  • Tokens & frontmatter  │  │ • Cognitive load & conflicts │
│  • Composition links     │  │ • Composition conflicts      │
│                          │  │                              │
│  Runs: every keystroke   │  │ Runs: on save                │
│  Cost: free              │  │ Cost: Copilot subscription   │
└──────────────────────────┘  └──────────────────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Analysis Cache                          │
│  Content-hash keyed • TTL-based expiry • 100 entry max     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       LSP Interface                         │
│  Diagnostics • CodeLens • Hover • Quick Fixes • Go-to-Def  │
└─────────────────────────────────────────────────────────────┘
```

For a deeper walkthrough, see [How It Works](docs/HOW_IT_WORKS.md).

## Project Structure

```
src/
├── server.ts              # LSP server entry point, document lifecycle, diagnostics
├── types.ts               # Shared TypeScript types and interfaces
├── cache.ts               # Content-hash analysis cache with TTL
├── parsing.ts             # Document parsing, frontmatter, composition links
├── lspFeatures.ts         # CodeLens, Go-to-Definition, variable lookup helpers
├── analyzers/
│   ├── static.ts          # All static analysis rules
│   └── llm.ts             # All LLM-powered analysis rules
└── __tests__/
    ├── static.test.ts     # Static analyzer tests
    ├── llm.test.ts        # LLM analyzer tests
    ├── cache.test.ts      # Cache tests
    ├── parsing.test.ts    # Parsing tests
    └── lspFeatures.test.ts # LSP features tests

client/
├── src/extension.ts       # VS Code extension activation, LLM proxy, status bar
├── syntaxes/              # TextMate grammar for syntax highlighting
└── package.json           # Extension manifest with configuration schema

examples/                  # Sample prompt files for manual testing
docs/                      # Design specs and guides
```

## Development

```bash
npm run compile      # Build server only
npm run build        # Build server + client
npm test             # Run tests (vitest)
npx vitest           # Run tests in watch mode
npm run watch        # Watch server changes
npm run lint         # Run ESLint
```

Press `F5` in VS Code to launch the Extension Development Host for manual testing.

## Documentation

- [How It Works](docs/HOW_IT_WORKS.md) — Detailed walkthrough of the analysis pipeline
- [Design Specification](docs/SPEC.md) — Full analysis tier details and design decisions
- [Contributing Guide](CONTRIBUTING.md) — How to set up, build, test, and contribute
- [Agent Prompts Guide](docs/agents.md) — Best practices for writing `.agent.md` files

## Examples

The `examples/` directory contains sample prompt files for testing:

- [`sample.prompt.md`](examples/sample.prompt.md) — A well-structured prompt demonstrating common patterns
- [`problematic.agent.md`](examples/problematic.agent.md) — An intentionally flawed prompt that triggers many diagnostics
- [`self-verification.agent.md`](examples/self-verification.agent.md) — Self-verification pattern for agents
- [`tdd.agent.md`](examples/tdd.agent.md) — TDD workflow agent

## License

MIT
