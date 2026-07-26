# Deviation Log — Part 11 Compliant eCRF

| | |
|---|---|
| **Document ID** | DEV-001 |
| **Version** | 1.0 |
| **Author** | ali4.hassan6@gmail.com (Student Developer) |
| **Date** | 2026-07-26 |
| **Status** | All deviations closed |

### Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author | ali4.hassan6@gmail.com (Student Developer) | *electronically prepared* | 2026-07-26 |
| Reviewer — QA | ⟨illustrative role placeholder⟩ | ________________ | __________ |
| Approver — System Owner | ⟨illustrative role placeholder⟩ | ________________ | __________ |

> Portfolio artefact — not for GxP use.

---

## 1. Purpose

This log records deviations — any departure from expected behaviour, specification,
or a failed test — observed during development and qualification, together with
their classification, root-cause analysis, corrective action (CAPA), and
disposition. Recording genuine findings (rather than presenting a flawless
narrative) is itself a data-integrity expectation: the validation record must be
**complete and honest**.

Classification: **Critical** (affects patient safety / data integrity / a Part 11
control), **Major** (affects function), **Minor** (cosmetic / non-functional).

## 2. Deviations

### DEV-001-01 — Reserved schema path on the audit model
| Field | Detail |
|---|---|
| **Phase** | Build (Phase 1) |
| **Classification** | Minor (integrity-adjacent — raised as caution) |
| **Description** | The `AuditEvent` schema initially used a field named `collection`. Mongoose emits a warning that `collection` is a reserved schema pathname and "may break some functionality." |
| **Detection** | Warning surfaced during the first OQ execution. |
| **Root cause** | Field naming collided with a Mongoose-reserved property. |
| **Risk** | Potential undefined behaviour on an integrity-critical model (the audit trail). |
| **CAPA** | Renamed the field to `targetModel` across the model, audit service, admin route filter, and tests. Re-ran OQ. |
| **Verification** | OQ suite re-executed: 10/10 (then 54/54) Pass, warning eliminated. |
| **Disposition** | **Closed.** No reserved paths remain on integrity-critical models. |

### DEV-001-02 — Edit-check violations not surfaced to the client
| Field | Detail |
|---|---|
| **Phase** | OQ execution (Phase 3) |
| **Classification** | Major |
| **Description** | Test OQ-FORM-03 failed: on a 422 edit-check rejection the response body did not include the structured `errors[]` array (it was `undefined`), so a client could not display the specific violation. |
| **Detection** | Automated OQ (`api/form.test.js`) — a real test failure. |
| **Root cause** | The central Express error handler serialized only `error` and `message`, dropping the `errors` array attached to the typed edit-check error. |
| **Risk** | Usability and data-quality: users would not know *why* an entry was rejected. |
| **CAPA** | Updated the error handler in `server/src/app.js` to include `err.errors` when present. |
| **Verification** | Re-ran OQ: OQ-FORM-03 Pass; full suite 54/54 Pass. |
| **Disposition** | **Closed.** |

### DEV-001-03 — OQ harness missing a test-only dependency
| Field | Detail |
|---|---|
| **Phase** | OQ execution (Phase 2) |
| **Classification** | Minor (test tooling only; no product impact) |
| **Description** | The `auth` and `rbac` OQ suites failed to load with "Cannot find module 'jsonwebtoken'" because the test files mint/inspect tokens but `jsonwebtoken` was declared only as a server dependency, not in the OQ package. |
| **Detection** | Automated OQ — suite load failure. |
| **Root cause** | Missing devDependency in `oq/package.json`. |
| **Risk** | None to the product; blocked evidence generation for two suites. |
| **CAPA** | Added `jsonwebtoken@9.0.2` to `oq/package.json` devDependencies and `npm install`. |
| **Verification** | Re-ran OQ: both suites load; 54/54 Pass. |
| **Disposition** | **Closed.** |

### DEV-001-04 — Environmental: concurrent dependency install left an empty tree
| Field | Detail |
|---|---|
| **Phase** | Environment setup (Phase 1) |
| **Classification** | Minor (environmental; no product/spec impact) |
| **Description** | Two `npm install` processes were briefly launched against the same `oq/` directory, and `node_modules` transiently appeared empty. |
| **Detection** | Manual observation during install. |
| **Root cause** | Two overlapping install invocations racing on the same folder. |
| **Risk** | Non-reproducible install state if not resolved. |
| **CAPA** | Allowed a single install to complete; verified dependency tree and re-ran OQ successfully. IQ-001 now mandates `npm ci` (deterministic, lockfile-driven) for qualified installs. |
| **Verification** | Clean `npm ci` per IQ-001 §7; OQ 54/54 Pass. |
| **Disposition** | **Closed.** |

## 3. Observations (not deviations)

- **OBS-01** — A blocked illegal edit of a signed record (OQ-AMD-01) returns 409 as
  a business-rule rejection and is *not* separately written to the audit trail
  (only the subsequent successful amendment is). This is acceptable (no data
  changed), but is noted for periodic review (SOP-PR-001) as a candidate
  enhancement: optionally log blocked mutation attempts on signed records.

## 4. Summary

| Classification | Count | Open |
|---|---|---|
| Critical | 0 | 0 |
| Major | 1 | 0 |
| Minor | 3 | 0 |

All deviations are **closed** with verified corrective action. One enhancement
observation (OBS-01) is carried to periodic review. No open deviation affects the
qualified state or the release recommendation.
