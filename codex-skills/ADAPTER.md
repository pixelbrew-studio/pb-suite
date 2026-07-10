# pb-suite Codex adapter

Each `pb-*` Codex skill is an adapter over the matching canonical command in
`commands/`. This keeps pb-suite behavior in one source while exposing
Codex-native skill discovery and trigger descriptions.

When executing an adapter:

1. Resolve the suite checkout with:

   ```bash
   source "$HOME/.codex/skills/pb-bootstrap.sh"
   ```

   If that file is absent, locate `pb-suite` from `PB_SUITE_HOME` or ask the
   user to run `pb-suite/install-codex`. Do not guess a different checkout.

2. Read the entire matching `$PB_SUITE/commands/<name>.md` before acting. It
   remains the authoritative procedure, reports, refusal flags, severity
   model, and script/reference paths.

3. Interpret command arguments from the user's request. There is no
   `$ARGUMENTS` variable in Codex.

4. Translate Claude-only mechanics without weakening the workflow:

   - `AskUserQuestion` means ask one concise direct question when the source
     genuinely requires a decision or missing information.
   - Replace every `source "$HOME/.claude/commands/pb-bootstrap.sh"` snippet
     in the canonical command with `source "$HOME/.codex/skills/pb-bootstrap.sh"`.
     Never require a Claude installation for a Codex skill.
   - `Skill` or `/pb-*` invocations mean apply the corresponding installed
     Codex skill's procedure inline. Do not pretend a shell slash command ran.
   - For `pb-across`, a `pb-*` argument means run that corresponding procedure
     separately in each discovered project; it is not an executable shell
     command.
   - `allowed-tools` is advisory; use only tools actually available in the
     current Codex session.
   - A requested unavailable skill, connector, CLI, or script is a concrete
     blocker. State it instead of fabricating its output.
   - Follow the current session's safety and collaboration rules over the
     source command. In particular, do not delegate or use sub-agents unless
     the current instructions permit it.

5. Preserve the source command's scope, read-only guarantees, refusal flags,
   evidence threshold, and exact report shape whenever they apply.
