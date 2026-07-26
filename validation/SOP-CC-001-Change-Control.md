# SOP — Change Control

| | |
|---|---|
| **Document ID** | SOP-CC-001 |
| **Version** | 1.0 |
| **Author** | ali4.hassan6@gmail.com (Student Developer) |
| **Effective date** | 2026-07-26 |
| **Review cycle** | Annual |

### Approval
| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author | ali4.hassan6@gmail.com (Student Developer) | *electronically prepared* | 2026-07-26 |
| Approver — QA | ⟨illustrative role placeholder⟩ | ________________ | __________ |

> Portfolio artefact — not for GxP use.

---

## 1. Purpose
To ensure that all changes to the validated eCRF (code, configuration,
dependencies, environment, or documentation) are assessed for impact, authorised,
tested, and documented so the validated state is maintained (21 CFR 11.10(a),(k)).

## 2. Scope
All changes to the system after initial release, including: source code,
`package.json`/lockfile dependency changes, runtime configuration (password policy,
lockout, session, secrets), the signature pepper, database schema/indexes, and
validation documentation.

## 3. Responsibilities
- **Requestor** — raises the change request (CR) with rationale.
- **System Owner** — authorises the change and its risk classification.
- **Developer** — implements the change on a branch; runs the OQ suite.
- **QA** — reviews impact assessment, test evidence, and approves closure.

## 4. Procedure
1. **Raise CR** — record: description, reason, affected components, requestor, date.
2. **Impact assessment & classification:**
   - *Minor* (no impact on a Part 11 control) — e.g. cosmetic UI, comments.
   - *Major* (affects function or a control) — e.g. edit-check logic, RBAC matrix,
     signature binding, audit service, dependency upgrades.
   - *Critical* (directly affects audit trail, signatures, or access control).
3. **Determine revalidation extent** from classification:
   - Minor → run full automated OQ suite (regression) and confirm 54/54 Pass.
   - Major → OQ regression **plus** targeted new/updated OQ cases and RTM update.
   - Critical → OQ + PQ re-execution and QA re-approval of affected documents.
4. **Implement** on a feature branch; never commit directly to the release branch.
5. **Test** — execute `cd oq && npm run oq:api`; attach `evidence/oq-results-*.json`
   to the CR. For dependency changes, record new lockfile SHA-256 (IQ-001 §4).
6. **Review & approve** — QA verifies evidence; System Owner authorises release.
7. **Release & close** — merge, tag, update affected validation documents and the
   change history; close the CR.

## 5. Special controls
- **Signature pepper (`SIGNATURE_PEPPER`)** — rotation is a **Critical** change:
  it invalidates all historical signatures. Requires System Owner + QA approval and
  a documented migration/impact note.
- **Emergency changes** — may be implemented first, but the CR and full test
  evidence must be completed within 5 business days.

## 6. Records
CR log, impact assessments, OQ evidence artefacts, updated lockfile hashes,
approval signatures, Git history/tags.
