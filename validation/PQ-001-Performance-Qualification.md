# Performance Qualification (Protocol & Report) — Part 11 Compliant eCRF

| | |
|---|---|
| **Document ID** | PQ-001 |
| **Version** | 1.0 |
| **Author** | ali4.hassan6@gmail.com (Student Developer) |
| **Date** | 2026-07-26 |
| **Status** | Executed — Pass |

### Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author / Executed by | ali4.hassan6@gmail.com (Student Developer) | *electronically prepared* | 2026-07-26 |
| Reviewer — QA | ⟨illustrative role placeholder⟩ | ________________ | __________ |
| Approver — System Owner | ⟨illustrative role placeholder⟩ | ________________ | __________ |

> Portfolio artefact — not for GxP use.

---

## 1. Purpose

The Performance Qualification (PQ) demonstrates that the system supports the
**intended clinical business process end-to-end**, with realistic data and real
users acting in their roles, and that the data-integrity and Part 11 controls hold
throughout the workflow. Where OQ verifies functions in isolation, PQ verifies the
whole process as it will actually be used.

## 2. Mock Study

| Item | Value |
|---|---|
| Study | "Demonstration Study", protocol PROTO-001, sponsor Acme Pharma |
| Visit schedule | Screening, Baseline, Week 4 |
| Roles exercised | Investigator, Data Manager, Monitor, Administrator |
| Subjects | S-001, S-002 (enrolled), plus an additional enrolment during PQ |
| Environment | Same qualified build as IQ-001/OQ-001 |

The mock scenario is executed by the evidence generator `oq/dumpAudit.js`, which
drives the real API through the full lifecycle and exports the resulting audit
trail to `evidence/audit-trail-latest.json` as objective PQ evidence.

## 3. End-to-End Scenario and Results

| Step | Actor (role) | Action | Expected outcome | Result | Evidence |
|---|---|---|---|---|---|
| PQ-01 | Administrator | Provision users; seed study & visits | Users/study/visits created; provisioning audited | Pass | seed.js / audit `create` |
| PQ-02 | Investigator | Log in | Session issued; login audited | Pass | audit `login` (investigator) |
| PQ-03 | Investigator | Enrol subject | enrolledAtUTC = server time; audited | Pass | OQ-FORM-01; audit `create` Subject |
| PQ-04 | Investigator | Enter vital signs (systolic 120/80, HR 70) | Edit checks pass; form created + audited | Pass | audit `create` FormInstance |
| PQ-05 | Investigator | Attempt out-of-range entry (systolic 400) | Rejected 422; nothing written | Pass | OQ-FORM-03 |
| PQ-06 | Monitor | Raise query on systolic | Query open; history + audit | Pass | audit `query_raise` (monitor) |
| PQ-07 | Investigator | Respond to query | Query answered; history + audit | Pass | audit `query_respond` |
| PQ-08 | Data Manager | Close query | Query closed; history + audit | Pass | audit `query_close` (datamanager) |
| PQ-09 | Investigator | Electronically sign the vitals form (author) | Re-auth required; record locked; signature bound | Pass | audit `sign`; OQ-SIG-02/03 |
| PQ-10 | Investigator | Attempt to edit the signed record | Blocked (409); amendment required | Pass | OQ-AMD-01 |
| PQ-11 | Investigator | Amend the signed record with a reason | Version→2; re-opened; prior signature now invalid; audited | Pass | audit `amend` ×2; OQ-AMD-04 |
| PQ-12 | Monitor | Attempt to enter form data (privilege escalation) | Blocked 403 + audited | Pass | audit `access_denied` (monitor); OQ-RBAC-03 |
| PQ-13 | Data Manager | Export dataset | Dataset + SHA-256 checksum manifest; export audited | Pass | OQ-EXP-01/02/03 |

## 4. Data-Integrity Assessment (ALCOA+)

The PQ audit-trail evidence (`evidence/audit-trail-latest.json`, 11 events)
demonstrates each ALCOA+ attribute in a real workflow:

- **Attributable** — every event carries `whoUsername` (investigator, monitor,
  datamanager) and role context.
- **Legible** — structured JSON, human-readable.
- **Contemporaneous** — every `whenUTC` is server-generated; the client back-dating
  attempt (PQ/OQ-FORM-02) was ignored.
- **Original / Accurate** — the amendment preserved old values and the superseded
  (now-invalid) signature rather than overwriting; old/new values recorded.
- **Complete, Consistent, Enduring, Available** — the append-only trail retains the
  full history including the raise/respond/close of the query and the blocked
  privilege-escalation attempt.

## 5. Conclusion

The system supports the intended clinical process end-to-end with realistic data
and role-based users, and the Part 11 / ALCOA+ controls hold throughout, including
under attempted misuse. **PQ result: Pass.**
