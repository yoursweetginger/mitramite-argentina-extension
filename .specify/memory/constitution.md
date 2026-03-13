<!--
SYNC IMPACT REPORT
==================
Version change: (uninitialized) → 1.0.0
Added sections:
  - Core Principles (I–IV)
  - Quality Gates
  - Development Workflow
  - Governance
Modified principles: N/A (initial ratification)
Removed sections: N/A
Templates reviewed:
  ✅ .specify/templates/plan-template.md — Constitution Check section is dynamic;
     gates now resolvable from this document.
  ✅ .specify/templates/spec-template.md — Success Criteria and performance goal
     fields already aligned with Principle IV.
  ✅ .specify/templates/tasks-template.md — Test task phases reflect Principle II;
     no structural changes required.
  ✅ .specify/templates/checklist-template.md — Generic; no constitution-specific
     tokens to update.
Follow-up TODOs: None. All fields defined.
-->

# Mitramite Argentina Extension Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)

Every contribution MUST meet a high and consistent standard of code quality before
it is merged. Specifically:

- Functions and methods MUST follow the single-responsibility principle; a unit of
  code MUST do one thing and do it well.
- Cyclomatic complexity per function MUST NOT exceed 10.
- All code MUST pass linter and static-analysis checks (zero warnings treated as
  errors) before a pull request is opened.
- Dead code, commented-out blocks, and unreachable branches MUST NOT be committed.
- External dependencies MUST be explicitly justified; prefer platform/runtime
  built-ins and minimal-footprint libraries.
- Public APIs MUST be documented with clear parameter, return, and error semantics.

**Rationale**: Uncontrolled complexity is the primary source of defects and
maintenance burden. Enforcing quality at contribution time is cheaper than
remediating it later.

### II. Testing Standards (NON-NEGOTIABLE)

Automated tests are first-class citizens of the codebase, not an afterthought.

- Tests MUST be written before or alongside implementation (Test-Driven Development).
  No production code path is considered complete without a corresponding test.
- Line coverage MUST be ≥80% project-wide; any PR that drops coverage below this
  threshold MUST be blocked.
- Tests MUST be organized into three levels: unit (fast, isolated), integration
  (cross-module workflows), and end-to-end (VS Code extension host).
- Each test MUST be deterministic and independent; test suites MUST be runnable in
  any order and in isolation.
- Flaky tests MUST be quarantined and fixed within one sprint of discovery; flaky
  tests MUST NOT block CI.
- Test names MUST describe behavior, not implementation (e.g., `should show error
when activation fails`, not `test_activate_2`).

**Rationale**: A reliable test suite is the foundation for confident refactoring,
safe dependency upgrades, and trustworthy releases.

### III. User Experience Consistency

The extension MUST feel like a native, polished part of VS Code, not a foreign
add-on.

- All UI elements (commands, menus, status bar items, notifications, settings) MUST
  follow the VS Code UX Guidelines and use only stable extension API surfaces.
- Extension commands MUST use the consistent namespace `mitramite.<verb>` (e.g.,
  `mitramite.openPanel`, `mitramite.refreshData`).
- Error messages shown to users MUST be actionable plain-language text; raw stack
  traces, internal IDs, or technical jargon MUST NOT be surfaced.
- Operations that may take longer than 500 ms MUST display a progress indicator
  (using `vscode.window.withProgress` or equivalent) so the user is never left
  wondering whether the extension has stalled.
- All interactive features MUST be keyboard-accessible and MUST respect the active
  VS Code color theme (light, dark, high-contrast).

**Rationale**: Inconsistent UX erodes trust and adoption. Users expect extensions to
feel integral to the editor, not bolted on.

### IV. Performance Requirements

Responsiveness and resource efficiency are quantified, not aspirational.

- Extension activation MUST complete in <150 ms on a reference mid-range laptop
  (measured via the VS Code startup profiler).
- All synchronous user-triggered operations MUST respond or display progress within
  200 ms; long-running work MUST be moved to async/background tasks.
- The main extension host thread MUST NOT be blocked by I/O, heavy computation, or
  network calls; use worker threads, async APIs, or language server protocol
  off-loading.
- The packaged VSIX bundle MUST NOT exceed 5 MB; unused assets and large transitive
  dependencies MUST be excluded via `.vscodeignore`.
- All `Disposable` objects MUST be registered and released; memory leaks MUST be
  detected and fixed before merge (verified by automated or manual profiling in CI).

**Rationale**: A slow or bloated extension degrades the editor for all projects and
users, making adoption impossible in professional environments.

## Quality Gates

Every pull request MUST pass all of the following gates before merge:

| Gate           | Check                                                    | Enforced By                   |
| -------------- | -------------------------------------------------------- | ----------------------------- |
| Code Quality   | Zero lint/static-analysis warnings                       | CI lint job                   |
| Code Quality   | No dead code or commented-out blocks                     | Code review                   |
| Testing        | Coverage ≥80% project-wide                               | CI coverage report            |
| Testing        | All tests green and deterministic                        | CI test job                   |
| UX Consistency | Commands follow `mitramite.<verb>` naming                | Code review                   |
| UX Consistency | No raw errors surfaced to users                          | Code review                   |
| Performance    | Activation budget verified (new activation-path changes) | Code review + profiler output |
| Performance    | VSIX ≤5 MB                                               | CI package job                |
| Performance    | No synchronous I/O on extension host thread              | Static analysis / code review |

PR authors MUST self-certify gate compliance in the PR description.
Reviewers MUST re-verify compliance before approving.

## Development Workflow

1. **Specify first**: New features MUST have a specification (`spec.md`) and
   plan (`plan.md`) produced by the speckit workflow before any implementation
   begins.
2. **Test before code**: Write failing tests that describe the desired behavior,
   get them reviewed, then implement until tests pass (Red → Green → Refactor).
3. **Small, focused PRs**: A PR MUST address a single concern. If a PR touches
   more than three unrelated modules, it MUST be split.
4. **CI is the gate**: No merges are allowed with failing CI. Bypassing CI
   (e.g., `--no-verify`, forced merges) is prohibited except in declared
   production incidents with a post-mortem required.
5. **Dependency review**: Every new dependency MUST be reviewed for license
   compatibility, maintenance health, and transitive impact on bundle size.

## Governance

This constitution supersedes all informal conventions, README instructions, and
prior verbal agreements.

- **Amendments** require: a written rationale, a version bump (see versioning
  policy below), and majority consensus from active maintainers.
- **Versioning**: MAJOR — principle removal or backward-incompatible governance
  change; MINOR — new principle or material expansion; PATCH — clarification or
  wording fix.
- **Compliance reviews** MUST occur at every sprint retrospective; recurring
  violations MUST trigger a principle revision or tooling improvement.
- **Escalation**: Disputes about compliance are resolved by the lead maintainer;
  unresolved disputes block the PR until resolved.

**Version**: 1.0.0 | **Ratified**: 2026-03-13 | **Last Amended**: 2026-03-13
