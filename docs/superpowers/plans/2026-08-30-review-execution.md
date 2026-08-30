# Repository Review Documentation Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute `C:\it\REVIEW.md` in order, adding only evidence-backed Korean comments/TODOs and synchronizing the seven specified documentation files with the current repositories.

**Architecture:** Independent repository analysis is delegated to parallel reviewers. Findings are then integrated sequentially into shared documentation and source comments, preserving existing structure and avoiding business-logic changes.

**Tech Stack:** Spring Boot/Java, Nuxt 4/Vue 3/TypeScript, Markdown, Gradle, npm, Graphify, PowerShell.

**Spec:** `C:\it\REVIEW.md`

## Global Constraints

- Follow `C:\it\CLAUDE.md` and repository-specific `CLAUDE.md` files as the source of truth.
- Preserve UTF-8 encoding and existing document structure.
- Write new Java/TypeScript comments in Korean.
- Do not modify business logic while adding annotations.
- Do not use broad Git staging or revert unrelated user changes.
- Record only facts verified in source code; do not add volatile counts or speculative plans to README/CLAUDE.

### Task 1: Source Code Annotation

**Files:**
- Inspect: `C:\it\it_backend\**\*.java`
- Inspect: `C:\it\it_frontend\**\*.ts`, `C:\it\it_frontend\**\*.vue`
- Modify only evidence-backed source comment/TODO locations identified by reviewers.

- [ ] Dispatch `java-reviewer`, `typescript-reviewer`, and `silent-failure-hunter` in parallel with disjoint scopes.
- [ ] Integrate findings sequentially; add or correct Korean comments and actionable `TODO:`/`FIXME:` markers without changing executable behavior.
- [ ] Review the resulting diff for accidental logic changes.

### Task 2: README Update

**Files:**
- Modify: `C:\it\it_backend\README.md`
- Modify: `C:\it\it_frontend\README.md`
- Modify: `C:\it\README.md`

- [ ] Analyze each repository's actual structure, startup path, architecture, and design decisions.
- [ ] Update backend and frontend READMEs with verified onboarding context.
- [ ] Integrate cross-repository flow into the root README without duplicating CLAUDE-only rules.

### Task 3: CLAUDE Update

**Files:**
- Modify: `C:\it\CLAUDE.md`
- Modify: `C:\it\it_backend\CLAUDE.md`
- Modify: `C:\it\it_frontend\CLAUDE.md`

- [ ] Compare current implementation against documented conventions and record only verified rules.
- [ ] Review authentication/authorization boundaries and add missing security guardrails to the appropriate SoT.
- [ ] Keep volatile status/count information out of CLAUDE files.

### Task 4: TASK Maintenance

**Files:**
- Modify: `C:\it\TASK.md`

- [ ] Dispatch `refactor-cleaner` and `database-reviewer` in parallel.
- [ ] Merge their findings with Task 1 silent-failure findings as actionable backlog entries.
- [ ] Mark existing entries `[Done]` only when current code verifies completion and include the action date.

### Verification

- [ ] Run the final `code-reviewer` over the complete diff and resolve inconsistencies.
- [ ] Re-read all target files and check every REVIEW.md requirement.
- [ ] Run applicable backend/frontend formatting, checks, tests, and documentation consistency checks.
- [ ] Repeat only the affected task when a verification gap is found.
