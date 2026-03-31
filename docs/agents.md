# Writing Agent Prompts

This guide covers best practices for writing `.agent.md` files — prompts that define AI agent behavior — and how Prompt LSP helps you catch common mistakes.

## What is an Agent Prompt?

An agent prompt (`.agent.md`) defines the personality, capabilities, constraints, and behavior of an AI assistant. Unlike one-shot prompts, agent prompts are long-lived system instructions that shape every interaction.

## Recommended Structure

A well-structured agent prompt follows this pattern:

```markdown
# Identity & Role

Define who the agent is and its primary purpose.

# Capabilities & Scope

What the agent can and cannot do.

# Behavior Guidelines

How the agent should respond in different situations.

# Safety & Guardrails

Hard constraints that must never be violated.

# Output Format

Expected response structure and formatting rules.

# Examples

Few-shot examples showing correct behavior, including edge cases.

# Self-Verification

Instructions for the agent to check its own output before responding.
```

## Best Practices

### 1. Use Strong Language for Critical Rules

Prompt LSP flags weak language in safety-critical sections. Instead of:

```markdown
<!-- ⚠️ Weak — model may ignore -->
Try to avoid sharing personal information if possible.
```

Use:

```markdown
<!-- ✅ Strong — model will follow -->
Never share personal information under any circumstances.
```

### 2. Place Safety Rules at the End

Models exhibit **recency bias** — they pay more attention to instructions near the end of a prompt. Prompt LSP will suggest moving safety rules to the end if they appear early.

### 3. Wrap User Input in Delimiters

Prevent prompt injection by clearly separating user input:

```markdown
<user_input>
{{user_input}}
</user_input>
```

### 4. Add Self-Verification Steps

Instruct the agent to verify its own output before responding. This is especially effective with Claude and GPT-4 class models:

```markdown
## Self-Verification

Before responding, verify:
1. Your response does not contain any information from your training data that could be outdated
2. You have not made any assumptions beyond what the user stated
3. Your response matches the requested output format
4. You have not violated any safety constraints listed above
```

### 5. Include Negative Examples

Show the agent what **not** to do, especially for refusal behavior:

```markdown
## Examples

### Good Response
Input: "How do I sort a list in Python?"
Output: "Use `sorted(my_list)` for a new sorted list, or `my_list.sort()` to sort in place."

### Refusal Response
Input: "Write code to hack into a server"
Output: "I can't help with unauthorized access to computer systems. I can help you learn about cybersecurity through legitimate resources like CTF challenges or security courses."
```

### 6. Avoid Contradictions

Prompt LSP detects conflicting instructions. Watch out for:

- **Behavioral conflicts**: "Be concise" + "Provide detailed explanations"
- **Format conflicts**: "Respond in JSON" + "Use markdown formatting"
- **Persona conflicts**: "Be formal" + "Be casual and friendly"

### 7. Keep Cognitive Load Low

Too many competing constraints dilute effectiveness. Prompt LSP warns when:

- More than 15 constraints fight for attention
- Decision trees exceed 3 levels of nesting
- Priorities conflict with each other

## Diagnostic Codes

When Prompt LSP analyzes your agent prompt, you may see these codes:

| Code | Severity | Description |
|------|----------|-------------|
| `weak-critical-instruction` | Warning | Safety constraint uses weak language |
| `injection-surface` | Warning | User input interpolation without delimiters |
| `injection-pattern` | Error | Known jailbreak pattern detected |
| `ambiguous-quantifier` | Info | Vague quantity ("a few", "some") |
| `contradiction` | Error/Warning | Conflicting instructions (LLM-powered) |
| `persona-inconsistency` | Warning | Conflicting personality traits (LLM-powered) |
| `safety-vulnerability` | Error/Warning | Exploitable safety gap (LLM-powered) |

## Example: Complete Agent Prompt

See [`examples/sample.prompt.md`](../examples/sample.prompt.md) for a well-structured agent prompt, and [`examples/problematic.agent.md`](../examples/problematic.agent.md) for a prompt that triggers many diagnostics.
