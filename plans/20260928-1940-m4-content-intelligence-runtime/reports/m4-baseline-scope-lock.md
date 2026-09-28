# M4 Baseline and Scope Lock

Date: 2026-09-28 (Asia/Ho_Chi_Minh)

## Baseline

- Branch: `codex/m4-content-intelligence-runtime`
- HEAD: `fcbce2d10737671a5e5832f5dc5017463a182526`
- Tag `m3-v9-verified`: `fcbce2d10737671a5e5832f5dc5017463a182526`
- Baseline ancestry: verified
- Pre-implementation repository suite: 21 files, 589/589 tests passed
- Pre-implementation typecheck: passed
- Node: v24.11.1; npm: 11.6.2; PostgreSQL client: 16.15; Redis: 8.10.2
- PostgreSQL and Redis health: available

## Frozen fingerprints

```text
24e024bff59e5f5bce73172d82ca0c8a5fd696264d1498a3b8884cec55a95fa9  ContentOS_Blueprint_v2.13.1_FROZEN.md
cc74f045e6e1cd25f8ebe37e7db85bb66550b5cde5d5e99db1a098a0816e858d  ContentOS_SPEC01_System_Architecture_v1.1.3_FROZEN.md
6cd0f47de653e260f35729dc4cb62ba0bd5155962eb84caa6a7570c4ba6313c6  ContentOS_SPEC02_Domain_Data_Model_v1.0.6_FROZEN.md
f532c6a75f267744f0d1e8fe1a7964e5c79e448eabae8445ca68eca03c5a02c5  ContentOS_SPEC03_Evidence_Proposition_Epistemic_State_v1.0.1_FROZEN.md
b8fd07453cde9556e4113bebd14b3abd467fc6f04b32714c15d9ddb3c6a48d7b  ContentOS_SPEC04_Governance_Policy_Engine_v1.0.2_FROZEN.md
d7b7470813f17da1bb50098ca46e52c6b3d69248ca9c8bfa4f24716a1be882e5  ContentOS_SPEC05_Content_Intelligence_Runtime_v1.0.1_FROZEN.md
8a3c0420fefda8dfed367f55d86f3f81375c5c2bbc7bad4e0800247e31a9cb47  ContentOS_SPEC06_Evaluation_Framework_v1.0.1_FROZEN.md
4e8691f85f3a811045cc10a59519314fd260a4fa343a25cf2ca7410ec12808ba  ContentOS_SPEC07_Measurement_Experimentation_Learning_v1.0_FROZEN.md
7d86c1ebfba6d40073f7b7930d9446dde58cb21d8b221a008f525e4551109803  ContentOS_SPEC08_Security_Privacy_Rights_v1.0.1_FROZEN.md
aa2bb4e78f12a0bb38684a9dc8855b2415e24375098e0a301536eb7be0825683  ContentOS_SPEC09_V1A_Decision_Core_v1.0_FROZEN.md
22a999e0909e29f983232d19807d9027ac023de1718b7b1f42ff61421e92bee2  ContentOS_SPEC10_V1B_Learning_Closure_v1.0_FROZEN.md
```

## Binding scope

- Implement only SPEC05/M4. Frozen files are read-only.
- No SPEC06 assertion/evaluation implementation; handoff DTO/port only.
- No public API, publication, measurement, learning, or Control Plane mutation.
- No new canonical entity or `StrategyGateResult` table.
- M4 canonical writes require decision-cycle authority and the authority/bypass matrix.
- Operational variant slots live in StageExecution identity/hash, not frozen entity schemas.
- Add one idempotent manual forward migration `0006`; do not rewrite prior migration history.

## Worktree isolation

Original checkout remains on `main` at the baseline. The isolated worktree contains only plan/research artifacts before production edits. No pre-existing production changes were present.

## Unresolved questions

- None.
