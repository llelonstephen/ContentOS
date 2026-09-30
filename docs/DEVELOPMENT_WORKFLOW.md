# ContentOS — Engineering and Development Workflow

This document outlines the mandatory development protocol for ContentOS. Every engineering milestone, feature implementation, and bugfix must adhere to this workflow to preserve architectural integrity, specification fidelity, and formal auditability.

---

## 1. The Audit-Driven Lifecycle

```text
 ┌────────────────────────────────────────────────────────┐
 │ 1. Spec Reasoning & Analysis                           │
 │    - Analyze requirements against Blueprint & Specs    │
 │    - Identify authority boundaries & data flow         │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │ 2. Freeze Candidate Specification                      │
 │    - Draft exact normative text & data models          │
 │    - Define preflight and adversarial test vectors     │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │ 3. Independent Specification Audit                     │
 │    - External audit of normative consistency           │
 │    - Remediation of ambiguities or spec gaps           │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │ 4. Spec Freezing & Cryptographic Pinning               │
 │    - Commit `ContentOS_SPEC<N>_*_FROZEN.md`            │
 │    - Record immutable SHA256 in CURRENT_STATUS.md      │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │ 5. Bounded Implementation by Authority Boundary        │
 │    - Domain types & pure logic first                   │
 │    - Database schemas, migrations & immutability       │
 │    - Application orchestrators & port contracts        │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │ 6. Targeted Preflight & Adversarial Test Suites        │
 │    - Implement locked test vectors from the spec       │
 │    - Ensure all vectors pass locally against live DB   │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │ 7. Checkpoint Commit & Push                            │
 │    - Clean Git commit with conventional commit format  │
 │    - Push to feature/milestone branch                  │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │ 8. Independent External Source Audit                   │
 │    - Review source against frozen spec normative text  │
 │    - Identify any authority bypasses or scope leaks    │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │ 9. Full System Verification Run                        │
 │    - Run: npm test (all unit & integration suites)     │
 │    - Run: npx tsc --noEmit && npm run build            │
 │    - Run: live M0–M4 integration suites                │
 │    - Run: clean migration chain from empty database    │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │ 10. Verified Tag Creation & Push                       │
 │     - Tag exact verified commit (e.g., m4-v1-verified) │
 │     - Push annotated tag to origin repository          │
 └───────────────────────────┬────────────────────────────┘
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │ 11. Documentation Update & Milestone Handoff           │
 │     - Update CURRENT_STATUS.md & MILESTONES.md         │
 │     - Record ADRs for architectural decisions          │
 │     - Handoff to next milestone                        │
 └────────────────────────────────────────────────────────┘
```

---

## 2. Cardinal Operating Rules

### Rule 1: Never Implement Against an Unfrozen or Unaudiated Specification
Implementation must never begin against draft, working, or unaudited specification documents. Even when an upstream specification file exists (e.g., `ContentOS_SPEC06_Evaluation_Framework_v1.0.2_FROZEN.md`), work begins only after the specification is formally audited for the current milestone, verified free of gaps and contradictions, confirmed in repository evidence, and cryptographically pinned with its SHA256 checksum recorded in `docs/CURRENT_STATUS.md`.

### Rule 2: Never Modify a Frozen Specification During Implementation
If a defect, contradiction, or gap is discovered in a frozen specification during implementation:
1. **Stop implementation immediately.**
2. Report the contradiction citing exact normative line numbers.
3. Formal specification remediation and re-audit must occur before code changes resume.
4. Developers and agents are strictly forbidden from modifying frozen spec files to accommodate convenient code designs.

### Rule 3: Never Self-Declare an External Audit PASS
Engineers and autonomous coding agents must never declare an external audit passed on their own authority. An audit PASS is valid only when confirmed by an independent external source review, or a user-provided verified audit result/evidence.

### Rule 4: Never Create a Verified Tag Prematurely
A verified milestone tag (`m<N>-v<K>-verified`) must **never** be created until:
- The independent external audit has explicitly issued a PASS.
- The full test suite (`npm test`) passes 100% with zero failures.
- TypeScript compilation (`npx tsc --noEmit`) passes with zero diagnostics.
- The production bundle builds successfully (`npm run build`).
- The clean migration chain applies from scratch with zero errors.
- The frozen specification SHA256 is verified byte-exact.

### Rule 5: Standard Workspace Discipline
- **CANONICAL WORKSPACE**: The root of the active ContentOS Git repository.
- **Current local workspace on the owner's Mac**:
  `/Users/elonstephen/Downloads/App/ContentOS`
- New coding platforms, containers, or local clones must use their own active repository root.
- Do not create additional Git worktrees or temporary shadow repositories unless explicitly requested.
- Keep the working directory clean. Clean up scratch scripts, temporary SQL dumps, or debug logs before committing.

### Rule 6: Mandatory Documentation and ADR Updates
- Immediately upon completing a verified milestone, update `docs/CURRENT_STATUS.md` and `docs/MILESTONES.md`.
- Whenever a non-trivial architectural decision is made (e.g., changing schema role membership, establishing hashing schemes, structuring secret boundaries), document it in a new Architecture Decision Record in `docs/adr/`.

---

## 3. Daily Verification Commands

Before staging any commit, run this verification sequence:

```bash
# 1. Typecheck the entire codebase
npm run typecheck

# 2. Run focused tests for the active milestone
npm test -- <milestone-pattern>

# 3. Run full test suite across all milestones
npm test

# 4. Verify production compilation
npm run build

# 5. Check git working tree status
git status
```
