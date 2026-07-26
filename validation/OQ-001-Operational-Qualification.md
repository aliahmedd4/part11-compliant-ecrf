# Operational Qualification (Protocol & Report) — Part 11 Compliant eCRF

| | |
|---|---|
| **Document ID** | OQ-001 |
| **Version** | 1.0 |
| **Author** | ali4.hassan6@gmail.com (Student Developer) |
| **Date** | 2026-07-26 |
| **Status** | Executed — Pass (54/54) |

### Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author / Executed by | ali4.hassan6@gmail.com (Student Developer) | *electronically prepared* | 2026-07-26 |
| Reviewer — QA | ⟨illustrative role placeholder⟩ | ________________ | __________ |
| Approver — System Owner | ⟨illustrative role placeholder⟩ | ________________ | __________ |

> Portfolio artefact — not for GxP use.

---

## 1. Purpose and Approach

The Operational Qualification (OQ) provides documented evidence that the system
performs its intended functions and enforces its controls across the operating
range, **including negative and security conditions**. Consistent with the FDA
**Computer Software Assurance (CSA)** approach, the OQ is implemented as an
**executable automated test suite** rather than manual screenshot scripts:

- **API OQ:** Jest + supertest, executed against a real MongoDB engine
  (`mongodb-memory-server`) — see `oq/api/*.test.js`.
- **UI OQ:** Playwright specs for critical user flows — see `oq/ui/*.spec.js`.

Each execution emits **objective, timestamped evidence**:
- `evidence/oq-results-latest.json` — structured per-case results (id, status,
  duration, run start/finish UTC, environment).
- `evidence/audit-trail-latest.json` — a dump of the resulting audit trail,
  demonstrating the ALCOA+ record produced by the tested operations.

## 2. Execution Record

| Item | Value |
|---|---|
| Suite | API OQ (Jest + supertest) |
| Cases executed | **54** |
| Passed / Failed | **54 / 0** |
| Evidence file | `evidence/oq-results-latest.json` |
| Audit evidence | `evidence/audit-trail-latest.json` (11-event ALCOA+ scenario) |
| Environment | Node v24.14.0; MongoDB (in-memory, mongodb-memory-server 10.1.2) |
| Re-run command | `cd oq && npm run oq:api` |

The suite exceeds the protocol minimum of 30 cases and includes **11 explicit
negative/security cases** (marked ★).

## 3. Test Cases and Results

### 3.1 Audit trail integrity (URS-006, 007, 009)
| Case | Description | Expected | Result |
|---|---|---|---|
| OQ-AUD-01 | writeAudit persists event with server timestamp | Event stored; whenUTC≈server now | Pass |
| OQ-AUD-02 ★ | AuditEvent update blocked via every pathway | All update ops throw "append-only" | Pass |
| OQ-AUD-03 ★ | AuditEvent delete blocked via every pathway | All delete ops throw "append-only" | Pass |
| OQ-AUD-04 | diffAndAudit writes one event per changed field | Exactly the changed field logged | Pass |

### 3.2 Soft delete (URS-008)
| Case | Description | Expected | Result |
|---|---|---|---|
| OQ-SD-01 | New docs default not-deleted | isDeleted=false | Pass |
| OQ-SD-02 ★ | Hard delete pathways throw | deleteOne/Many/findByIdAndDelete throw | Pass |
| OQ-SD-03 | softDelete hides from default reads, retained | Hidden by default; retrievable w/ includeDeleted | Pass |

### 3.3 Authentication, policy, lockout, session (URS-003, 004, 005)
| Case | Description | Expected | Result |
|---|---|---|---|
| OQ-AUTH-01 | Valid login returns JWT with configured expiry | Token exp−iat = idle timeout | Pass |
| OQ-AUTH-02 | Successful login audited | `login` event present | Pass |
| OQ-AUTH-03 ★ | Wrong password rejected + audited | 401; `login_failed` event | Pass |
| OQ-AUTH-04 ★ | Lockout after threshold failures | Correct password then refused (423) | Pass |
| OQ-AUTH-05 ★ | Weak password rejected on change | 422 password_policy | Pass |
| OQ-AUTH-06 ★ | Password reuse rejected | 422 password_reuse | Pass |
| OQ-AUTH-07 ★ | Expired session token rejected | 401 session_expired | Pass |
| OQ-AUTH-08 ★ | No token rejected | 401 | Pass |

### 3.4 Access control / RBAC (URS-001, 002)
| Case | Description | Expected | Result |
|---|---|---|---|
| OQ-RBAC-01 | Matrix authority decisions correct | can() returns expected booleans | Pass |
| OQ-RBAC-02 | Authorized Investigator writes form | 201 created | Pass |
| OQ-RBAC-03 ★ | Monitor privilege escalation via direct API | 403 + `access_denied` audited | Pass |
| OQ-RBAC-04 ★ | Tampered-role token does not escalate | 403 (role re-read from DB) | Pass |
| OQ-RBAC-05 ★ | Token signed with wrong secret rejected | 401 invalid_token | Pass |

### 3.5 Electronic signatures (URS-010, 011, 012, 013)
| Case | Description | Expected | Result |
|---|---|---|---|
| OQ-SIG-01 ★ | Signing requires correct re-auth | Wrong password → 401, no signature | Pass |
| OQ-SIG-02 | Signature captures name/UTC/meaning/hash | Fields present; SHA-256 hex hash | Pass |
| OQ-SIG-03 | Signing locks the record | locked=true, status signed | Pass |
| OQ-SIG-04 | Signature valid immediately after signing | verification.valid = true | Pass |
| OQ-SIG-05 | Invalid meaning rejected | 422 | Pass |
| OQ-SIG-06 ★ | Signature collection append-only | update/delete throw | Pass |

### 3.6 Amendment workflow (URS-013, 014)
| Case | Description | Expected | Result |
|---|---|---|---|
| OQ-AMD-01 ★ | Editing signed record via normal update blocked | 409 record_locked | Pass |
| OQ-AMD-02 | Amendment requires a reason | 422 reason_required | Pass |
| OQ-AMD-03 | Valid amendment bumps version, re-opens, audited | version→2, locked=false, amend events | Pass |
| OQ-AMD-04 ★ | Prior signature invalid after amendment | verification.valid = false | Pass |

### 3.7 Edit checks (URS-016, 017)
| Case | Description | Expected | Result |
|---|---|---|---|
| OQ-EC-01 | Demographics requires DOB and sex | Both flagged when missing | Pass |
| OQ-EC-02 | Future DOB rejected | not_future violation | Pass |
| OQ-EC-03 | Vitals systolic out-of-range | range violation | Pass |
| OQ-EC-04 | Vitals systolic > diastolic (cross-field) | cross_field violation | Pass |
| OQ-EC-05 | Valid vitals produce no errors | [] | Pass |
| OQ-EC-06 | AE end date not before start | cross_field violation | Pass |
| OQ-EC-07 | Ongoing AE cannot have end date | cross_field violation | Pass |

### 3.8 Form data entry & server time (URS-006, 009, 015, 016)
| Case | Description | Expected | Result |
|---|---|---|---|
| OQ-FORM-01 | Enrolment sets server time + audited | enrolledAtUTC set; create event | Pass |
| OQ-FORM-02 ★ | Client-supplied timestamp ignored | Stored time is server time | Pass |
| OQ-FORM-03 | Invalid data rejected, nothing written | 422; no create audit event | Pass |
| OQ-FORM-04 | Update diff-audits changed field w/ reason | data.systolic old→new, reason stored | Pass |
| OQ-FORM-05 | Update without reason rejected | 422 reason_required | Pass |
| OQ-FORM-06 ★ | No API path to modify an audit entry | PATCH/DELETE /admin/audit → 404; model throws | Pass |

### 3.9 Query workflow (URS-018)
| Case | Description | Expected | Result |
|---|---|---|---|
| OQ-QRY-01 | Monitor raises query | open + history + audit | Pass |
| OQ-QRY-02 | Full lifecycle raise→respond→close | history = [raise,respond,close] | Pass |
| OQ-QRY-03 ★ | Investigator cannot raise query | 403 | Pass |
| OQ-QRY-04 ★ | Investigator cannot close query | 403 (separation of duties) | Pass |

### 3.10 Export with checksum (URS-019)
| Case | Description | Expected | Result |
|---|---|---|---|
| OQ-EXP-01 | DataManager export returns files + manifest | JSON/CSV/checksums.txt; SHA-256 | Pass |
| OQ-EXP-02 | Recomputed checksum matches manifest | Hashes equal | Pass |
| OQ-EXP-03 | Export audited | `export` event present | Pass |
| OQ-EXP-04 ★ | Investigator cannot export | 403 + `access_denied` audited | Pass |

### 3.11 Bootstrap / configuration (supporting)
| Case | Description | Expected | Result |
|---|---|---|---|
| OQ-APP-01 | Health endpoint | 200 {status:ok} | Pass |
| OQ-APP-02 | Unknown route structured 404 | error:not_found | Pass |
| OQ-APP-03 | Config singleton seeds & reused | Same singleton id | Pass |

### 3.12 UI OQ (Playwright — authored/runnable)
| Case | Description | Expected |
|---|---|---|
| OQ-UI-01 | Valid login shows workspace + role | Topbar + role visible |
| OQ-UI-02 | Invalid credentials rejected generically | Generic error |
| OQ-UI-03 | Out-of-range vitals show inline error, not saved | Field error visible |
| OQ-UI-04 | Sign requires re-auth then locks record | Signed pill + read-only |

## 4. Deviations

Deviations encountered during OQ development/execution are recorded in **DEV-001**.
No open deviations affect the final result.

## 5. Conclusion

All 54 executed API OQ cases **Pass**, including all 11 security/negative cases.
The objective evidence is retained in `evidence/oq-results-latest.json` and
`evidence/audit-trail-latest.json`. The system meets its functional and control
requirements. **OQ result: Pass.**
