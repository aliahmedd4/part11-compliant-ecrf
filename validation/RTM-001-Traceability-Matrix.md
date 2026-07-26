# Requirements Traceability Matrix — Part 11 Compliant eCRF

| | |
|---|---|
| **Document ID** | RTM-001 |
| **Version** | 1.0 |
| **Author** | ali4.hassan6@gmail.com (Student Developer) |
| **Date** | 2026-07-26 |
| **Status** | Approved |

### Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author | ali4.hassan6@gmail.com (Student Developer) | *electronically prepared* | 2026-07-26 |
| Reviewer — QA | ⟨illustrative role placeholder⟩ | ________________ | __________ |
| Approver — System Owner | ⟨illustrative role placeholder⟩ | ________________ | __________ |

> Portfolio artefact — not for GxP use.

---

## 1. Purpose

This matrix provides bidirectional traceability from each **User Requirement**
(URS-001) through its **Functional design** (FS-001) and **implementing module**
to the **OQ/PQ test case(s)** that verify it and their **result**. A complete
matrix with no orphan requirements and no orphan tests is an acceptance criterion
in VP-001. Results are taken from the executed evidence artefact
`evidence/oq-results-latest.json` (54/54 cases passed).

## 2. Traceability

| URS | Requirement (short) | FS | Implementing module | Verifying test(s) | Result |
|---|---|---|---|---|---|
| URS-001 | Four roles | FS-001-01 | `models/user.model.js`, `security/permissions.js` | OQ-RBAC-01 | Pass |
| URS-002 | Server-side RBAC | FS-001-02 | `security/requirePermission.js`, `authenticate.js`, `permissions.js` | OQ-RBAC-01, -02, -03, -04, -05 | Pass |
| URS-003 | Password policy | FS-001-03 | `services/auth.service.js` | OQ-AUTH-05, OQ-AUTH-06 | Pass |
| URS-004 | Account lockout | FS-001-04 | `services/auth.service.js` | OQ-AUTH-03, OQ-AUTH-04 | Pass |
| URS-005 | Session timeout + warning | FS-001-05 | `services/auth.service.js`, `client/src/AuthContext.jsx` | OQ-AUTH-07, OQ-AUTH-08; OQ-UI-* (session) | Pass |
| URS-006 | Field-level audit of every change | FS-001-06 | `services/audit.service.js`, `form.service.js` | OQ-AUD-01, OQ-AUD-04, OQ-FORM-04 | Pass |
| URS-007 | Append-only audit | FS-001-07 | `plugins/appendOnly.plugin.js` | OQ-AUD-02, OQ-AUD-03, OQ-FORM-06, OQ-SIG-06 | Pass |
| URS-008 | Soft delete only | FS-001-08 | `plugins/softDelete.plugin.js` | OQ-SD-01, OQ-SD-02, OQ-SD-03 | Pass |
| URS-009 | Server-side timestamps | FS-001-09 | `lib/time.js` | OQ-AUD-01, OQ-FORM-01, OQ-FORM-02 | Pass |
| URS-010 | Re-authentication to sign | FS-001-10 | `services/signature.service.js` | OQ-SIG-01 | Pass |
| URS-011 | Signature manifestation (name/time/meaning) | FS-001-11 | `services/signature.service.js`, `models/signature.model.js` | OQ-SIG-02, OQ-SIG-05 | Pass |
| URS-012 | Content binding (hash) | FS-001-12 | `lib/canonicalJson.js`, `lib/hash.js`, `signature.service.js` | OQ-SIG-04, OQ-AMD-04 | Pass |
| URS-013 | Signed record read-only | FS-001-13 | `services/signature.service.js`, `form.service.js` | OQ-SIG-03, OQ-AMD-01 | Pass |
| URS-014 | Amendment workflow | FS-001-14 | `services/form.service.js` | OQ-AMD-02, OQ-AMD-03, OQ-AMD-04 | Pass |
| URS-015 | Study/visit/enrolment | FS-001-15 | `models/{study,visit,subject}.model.js`, `form.service.enrolSubject` | OQ-FORM-01; PQ-001 §Enrolment | Pass |
| URS-016 | Three form types | FS-001-16 | `models/formInstance.model.js`, `routes/form.routes.js` | OQ-RBAC-02, OQ-EC-01..07; PQ-001 | Pass |
| URS-017 | Edit checks | FS-001-17 | `validation/editChecks.js` | OQ-EC-01, -02, -03, -04, -05, -06, -07, OQ-FORM-03 | Pass |
| URS-018 | Query workflow + history | FS-001-18 | `services/query.service.js`, `routes/query.routes.js` | OQ-QRY-01, -02, -03, -04 | Pass |
| URS-019 | Export with checksum | FS-001-19 | `services/export.service.js`, `lib/hash.js` | OQ-EXP-01, -02, -03, -04 | Pass |

## 3. Supporting / Infrastructure Tests

The following executed OQ cases verify system bootstrap and configuration and
support the qualified state, though they do not map to a single URS:
OQ-APP-01 (health), OQ-APP-02 (structured 404), OQ-APP-03 (config singleton).

## 4. Coverage Analysis

- **Requirements covered:** 19 / 19 (100%). No orphan requirements.
- **Critical requirements (11):** all verified by ≥1 passing OQ test; security-
  critical requirements (URS-002, 006–014) verified by explicit negative/security
  tests.
- **Tests mapped:** all URS-linked OQ cases trace back to a requirement; the 3
  infrastructure cases are accounted for in §3. No orphan tests.
- **Result:** 54 / 54 OQ cases **Pass** per `evidence/oq-results-latest.json`.

## 5. Conclusion

Full bidirectional traceability is established with a 100% pass result. The
acceptance criterion in VP-001 §8(1) is met.
