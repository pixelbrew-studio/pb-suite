# Security

`pb-suite` is a local command suite for AI-assisted product engineering. It installs markdown command files and local helper scripts. It does not collect telemetry, phone home, or maintain a remote service.

## Reporting

Report security issues by email: [hello@pixelbrew.studio](mailto:hello@pixelbrew.studio).

Please include:

- the affected version or commit
- the command or script involved
- a minimal reproduction
- expected and actual behavior
- any practical impact you can demonstrate

There is no formal bug bounty program.

## Scope

In scope:

- install or uninstall behavior that writes outside documented locations
- helper scripts that expose local data beyond the requested task
- dependency or build-chain issues
- unsafe command instructions that would predictably cause destructive behavior

Out of scope:

- findings caused by downstream project instructions
- model behavior that ignores the command text
- requests involving Acme private systems or company-owned assets
