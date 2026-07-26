# SOP — Periodic Review

| | |
|---|---|
| **Document ID** | SOP-PR-001 |
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
To confirm periodically that the eCRF remains in a validated, compliant state and
that its controls continue to operate effectively (21 CFR 11.10(a)).

## 2. Scope
The system, its controls, its documentation, and the accumulated operational
records (audit trail, deviations, changes, access).

## 3. Frequency
At least **annually**, and on trigger events (major change, security incident,
regulatory update).

## 4. Review checklist
1. **Validation status** — confirm the current release matches the qualified build
   (lockfile SHA-256 vs IQ-001 §4); confirm CI OQ runs are green.
2. **Automated OQ health** — re-execute `npm run oq:api`; confirm 54/54 Pass and
   review the latest `evidence/oq-results-latest.json`.
3. **Audit trail review** — sample the audit trail (`GET /admin/audit`) for
   anomalies; confirm append-only integrity; confirm no unexplained changes.
4. **Access review** — confirm SOP-UAM-001 quarterly reviews were performed and
   no orphan/over-privileged accounts exist.
5. **Change control** — all changes since last review followed SOP-CC-001 with
   appropriate revalidation.
6. **Deviations & incidents** — all entries in DEV-001 and incident records are
   closed or on track; recurring themes identified.
7. **Open observations** — status of carried items (e.g. OBS-01 re logging blocked
   edits of signed records).
8. **Backup/restore** — confirm annual restore test performed (SOP-BR-001).
9. **Configuration** — confirm password/lockout/session settings remain
   appropriate; confirm secrets management unchanged.

## 5. Outcome
A periodic review report recording items reviewed, findings, actions (CAPA), and a
conclusion on continued validated status. Findings feed change control and/or
incident management as needed.

## 6. Records
Periodic review reports, OQ evidence reviewed, access-review confirmations, action
items and their closure.
