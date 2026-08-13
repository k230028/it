# DB CLI Analysis Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a global OpenCode skill that safely performs read-only Oracle and Tibero live-database analysis using project-local `agents(db).md` credentials.

**Architecture:** A concise discoverable skill delegates credential parsing, SQL validation, and client execution to one PowerShell 5.1-compatible helper. Vendor references hold catalog guidance. Tests invoke the helper with validation-only and fake-client modes so safety behavior is verified without a real database.

**Tech Stack:** OpenCode Agent Skills, PowerShell 5.1/7, SQL*Plus/SQLcl, tbSQL

## Global Constraints

- Do not modify existing `AGENTS.md`, `CLAUDE.md`, or `.gitignore`.
- Support only Oracle (`sqlplus`/`sql`) and Tibero (`tbsql`).
- Allow only one `SELECT` or `WITH ... SELECT` statement.
- Reject DML, DDL, PL/SQL, transaction control, `EXPLAIN PLAN`, client commands, substitutions, `FOR UPDATE`, and `SELECT *`.
- Require `read_only: true` and `dedicated_read_only_account: true`.
- Never place the password in argv, environment variables, temporary SQL files, logs, or tool output.
- Refuse to use `agents(db).md` when Git tracks it.
- Keep compatibility with Windows PowerShell 5.1 and PowerShell 7.

---

### Task 1: SQL and Configuration Safety Helper

**Files:**
- Create: `C:/Users/KDB/.config/opencode/skills/db-cli-analysis/scripts/invoke-db-analysis.ps1`
- Create: `C:/Users/KDB/.config/opencode/skills/db-cli-analysis/tests/verify-db-cli-analysis.ps1`

**Interfaces:**
- Consumes: `agents(db).md` fixed YAML schema and SQL from stdin or `-Sql`.
- Produces: validated query output, nonzero exit on policy or client failure, `-ValidateOnly` for tests.

- [ ] Write a test runner covering valid SELECT/CTE, all denied command classes, invalid config, Git tracking, and password masking.
- [ ] Run the runner and verify it fails because the helper is absent.
- [ ] Implement fixed-schema parsing, SQL tokenization/validation, Git check, client invocation, and redaction.
- [ ] Run the runner in Windows PowerShell 5.1 and PowerShell 7 when available.

### Task 2: Skill and Vendor References

**Files:**
- Create: `C:/Users/KDB/.config/opencode/skills/db-cli-analysis/SKILL.md`
- Create: `C:/Users/KDB/.config/opencode/skills/db-cli-analysis/references/oracle.md`
- Create: `C:/Users/KDB/.config/opencode/skills/db-cli-analysis/references/tibero.md`
- Create: `C:/Users/KDB/.config/opencode/skills/db-cli-analysis/references/safety.md`

**Interfaces:**
- Consumes: helper from Task 1.
- Produces: automatic discovery for Oracle, Tibero, schema, index, constraint, data-integrity, and live DB questions.

- [ ] Write the minimal skill around baseline failures: no direct credential read, no argv password, explicit DBMS detection, no `SELECT *`, no EXPLAIN/DDL.
- [ ] Add compact Oracle and Tibero catalog references.
- [ ] Re-run pressure scenarios with the skill and verify compliance.

### Task 3: Project Template and Offline Package

**Files:**
- Create: `C:/it/agents(db).md`
- Copy: global skill to `C:/Users/KDB/Desktop/오프라인-플러그인-이관/db-cli-analysis/`
- Modify: `C:/Users/KDB/Desktop/오프라인-플러그인-이관/README.txt`

**Interfaces:**
- Consumes: deployed global skill.
- Produces: placeholder-only local configuration and transportable closed-network package.

- [ ] Create an Oracle placeholder configuration with `CHANGE_ME`, not a real password.
- [ ] Ensure `agents(db).md` is not staged or committed.
- [ ] Copy the verified skill tree to the offline package.
- [ ] Add closed-network install and configuration instructions to README.
- [ ] Verify global and offline copies match byte-for-byte.

### Task 4: Final Verification

**Files:**
- Verify all files above.

- [ ] Validate `SKILL.md` frontmatter and folder name.
- [ ] Run helper test suite.
- [ ] Verify no real secret or placeholder credential was copied into command output.
- [ ] Confirm original `AGENTS.md`, `CLAUDE.md`, and `.gitignore` are unchanged by this task.
- [ ] Report restart requirement and exact installation paths.
