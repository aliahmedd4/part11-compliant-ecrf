# Design Spec — Part 11 Compliant eCRF + Validation Package

- **Doc:** DESIGN-001
- **Version:** 0.1 (draft for approval)
- **Author:** ali4.hassan6@gmail.com (Student Developer)
- **Date:** 2026-07-25
- **Status:** Awaiting user approval

---

## 1. Purpose & Educational Frame

Build a **deliberately small** electronic Case Report Form (eCRF) that demonstrates
the *technical controls* required by **21 CFR Part 11**, and wrap it in a **full
Computerized System Validation (CSV) package** of the kind produced in a real
regulated engagement. The validation is the primary deliverable; the software is
minimal so that every control is traceable to code and testable.

**Why custom software drives maximum validation rigour (GAMP 5):** GAMP 5
classifies software by category. Category 3 (non-configured COTS) and Category 4
(configured products) let you leverage the *vendor's* validation. This eCRF is
**Category 5 — custom/bespoke code**: we authored the logic that enforces every
regulatory property, so no external validation exists to lean on. Everything must
be specified, risk-assessed, and tested by us. That is the reasoning the Validation
Plan will document.

## 2. Scope

**In scope:** one study, one visit schedule, subject enrolment; three form types
(demographics, vital signs, adverse events); edit checks; query workflow; dataset
export with checksum; audit trail; soft delete; RBAC; auth hardening; electronic
signatures with amendment workflow; automated OQ (API + UI) emitting real evidence;
CI; and the 13-part validation package + 6 SOPs.

**Out of scope (YAGNI):** multi-study/multi-site, randomization, coding
dictionaries (MedDRA/WHODrug), reporting/analytics, email, real deployment infra,
2-factor auth, and any feature not needed to demonstrate a Part 11 control.

## 3. Decisions (locked with user)

| Decision | Choice |
|---|---|
| Stack | MERN — Node/Express + React (Vite) + MongoDB/Mongoose |
| Database runtime | `mongodb-memory-server` for dev/test/CI; IQ documents production `MONGODB_URI` |
| Language | JavaScript (+ JSDoc) |
| Execution this session | Build app; run **API OQ (Jest+supertest)** for real, capture evidence; Playwright UI tests written & runnable |
| Doc depth | Full real-engagement depth for all 13 docs + SOPs |
| Workflow | Design → phased build (5 phases), reviewable per phase |
| Doc identity | Author = user email ("Student Developer"); approvers = illustrative role/signature lines marked "portfolio — not for GxP use" |

## 4. Architecture

```
Client (React/Vite)  ──HTTP──▶  Express API
   reflects perms only            │
                                  ▼
                         requirePermission()  (RBAC, server-side)
                                  │
                                  ▼
                          Service layer  ◀── ONLY writer of data
                     (audit diffs, server timestamps,
                      soft-delete, signature locks)
                                  │
                                  ▼
                        Mongoose models  ──▶  MongoDB
                    (append-only AuditEvent; global
                     soft-delete + no-hard-delete plugins)
```

**Principle:** the UI never enforces security. Enforcement is server-only, and the
OQ proves it by attacking the API directly (bypassing the UI).

## 5. Data Model (collections)

- **User** — `username, printedName, role, passwordHash, passwordHistory[],
  failedAttempts, lockedUntil, mustChangePassword, deleted{}`
- **Study** — one study; `name, protocolId, visitScheduleId, deleted{}`
- **Visit** — visit schedule entries; `studyId, name, order, deleted{}`
- **Subject** — enrolment; `studyId, subjectCode, status, enrolledAtUTC, deleted{}`
- **FormInstance** — `subjectId, visitId, type(demographics|vitals|adverse_event),
  data{}, status, locked, version, deleted{}`
- **AuditEvent** — **append-only**: `whoUserId, whoUsername, whenUTC(server),
  collection, docId, field, oldValue, newValue, reason, action`
- **Signature** — `recordCollection, recordId, recordVersion, signerUserId,
  printedName, whenUTC(server), meaning(author|reviewer|approver), contentHash`
- **Query** — `formInstanceId, field, text, status(open|answered|closed),
  history[]{action, byUserId, whenUTC, text}, deleted{}`
- **Config** — singleton runtime policy: `passwordPolicy{minLen, complexity,
  historyDepth}, lockout{threshold, windowMin}, session{idleTimeoutMin, warnBeforeMin}`

Every domain doc carries `deleted:{isDeleted:false, atUTC, byUserId, reason}`.

## 6. The Five Part 11 Mechanisms (heart of the system)

### 6.1 Audit Trail — §11.10(e) (ALCOA+)
Append-only `AuditEvent` collection. A Mongoose plugin on the model throws on any
`update*`, `delete*`, `findOneAndUpdate`, `findOneAndDelete`, `bulkWrite`. The
**service layer** is the single writer: for each domain mutation it diffs changed
fields and emits **one AuditEvent per field** with old/new value + reason.
Timestamps are **server-generated** (`new Date()`); any client-supplied timestamp
is rejected. Satisfies ALCOA+: Attributable (whoUserId), Legible (structured),
Contemporaneous (server clock), Original & Accurate (old/new preserved), plus
Complete/Consistent/Enduring/Available (append-only, never mutated).

### 6.2 Soft Delete only
Global Mongoose plugin strips hard-delete code paths. A "delete" operation sets
`deleted.isDeleted=true` + metadata and writes an AuditEvent. Default queries
filter `deleted.isDeleted:false`. No `deleteOne/deleteMany/drop` anywhere in
application code (enforced by an OQ grep-style test + runtime plugin).

### 6.3 RBAC — §11.10(d),(g)
Single source-of-truth **permission matrix** (`permissions.js`): map of
`role → { action:resource → allow }`. Roles: **Investigator, DataManager,
Monitor, Administrator**. `requirePermission(action, resource)` Express middleware
consults the matrix. JWT carries userId+role; role is re-read server-side, never
trusted from client. Example: Monitor may raise queries and read data but cannot
enter/modify form data; only Administrator manages users.

### 6.4 Authentication Hardening — §11.10(d),(g)
bcrypt password hashing; configurable policy (min length, complexity classes,
history depth to prevent reuse); **account lockout** after configurable failed
attempts within a window; **configurable session idle timeout** via JWT expiry +
client idle-warning modal before expiry. All auth events (login, failure, lockout,
password change, signature) are audited.

### 6.5 Electronic Signatures — §11.50/§11.70/§11.200
- **Re-authentication:** signing requires username + password again (fresh
  credential check), even within an active session.
- **Signature manifestation:** stores `printedName`, server `whenUTC`, and
  **meaning** (author | reviewer | approver) — §11.50.
- **Cryptographic binding — §11.70:** `contentHash =
  SHA-256( canonicalJSON(signed subset of record fields) + serverPepper )`.
  Canonical JSON = deterministic key-sorted serialization so the hash is stable.
- **Lock on sign:** signed FormInstance becomes `locked=true` → read-only.
- **Amendment workflow:** modifying a locked record requires an explicit
  **amendment with a reason**. It bumps `version`, writes AuditEvents, and leaves
  the prior Signature verifying as **INVALID** against the new content —
  `verifySignature()` recomputes the hash and flags any post-signing alteration.
  This is the tamper-evidence property §11.70 demands.

## 7. Clinical Functionality (minimal)

- **Study/visit/enrolment:** seed one study, a small visit schedule, enrol subjects.
- **Form types & edit checks:**
  - *Demographics:* required fields (DOB, sex), DOB not in future.
  - *Vital signs:* range checks (e.g. systolic 60–300, diastolic 30–200, HR
    20–250), required, cross-field (systolic > diastolic).
  - *Adverse events:* required term/severity, cross-field (end date ≥ start date;
    ongoing ⇒ no end date).
- **Query workflow:** raise → respond → close with full `history[]`; permissioned.
- **Export:** dataset to CSV **and** JSON plus a `checksums.txt` (SHA-256 per file)
  = integrity manifest.

## 8. Automated Evidence (Computer Software Assurance)

- **`oq/` package:** Jest + supertest for **API OQ (≥30 test cases)** including
  negative + security tests:
  - privilege escalation via direct API call (e.g. Monitor POSTing form data) →
    **blocked (403) AND logged**;
  - modifying a signed/locked record without amendment → **blocked AND logged**;
  - attempting to update/delete an AuditEvent → **blocked** (plugin throws);
  - client-supplied timestamp ignored; expired/invalid JWT rejected; lockout fires.
  - Playwright covers critical UI flows (login, enter vitals with edit-check
    failure, sign, attempt edit-after-sign).
- **Structured evidence:** custom Jest reporter writes timestamped JSON results to
  `/evidence/oq-results-<ts>.json`; a post-run script **dumps the AuditEvent
  collection** to `/evidence/audit-trail-<ts>.json`. Evidence is objective data
  from the app + audit trail, not screenshots — the CSA argument.
- **CI:** `.github/workflows/oq.yml` runs the suite on push and **uploads the
  evidence artefact**.

## 9. Validation Package (`/validation`) — all 13 + SOPs

Every doc has **Document ID / Version / Author / Date / Approval block**.

| ID | Document |
|---|---|
| VP-001 | Validation Plan (GAMP 5 Cat 5 rationale) |
| URS-001 | User Requirements Specification (numbered, atomic, testable) |
| FS-001 | Functional Specification (per-requirement implementation) |
| DS-001 | Design Specification (architecture, data model, audit + signature binding) |
| RA-001 | Risk Assessment (FMEA with RPN; patient safety + data integrity focus) |
| RTM-001 | Requirements Traceability Matrix (URS→FS→test→result) |
| IQ-001 | Installation Qualification (env, dependency versions + lockfile hashes, DB config, deploy verify) |
| OQ-001 | Operational Qualification protocol (≥30 cases; mirrors Jest suite; negative + security) |
| PQ-001 | Performance Qualification (mock study end-to-end, realistic data) |
| DEV-001 | Deviation Log (genuine findings from real runs) |
| VSR-001 | Validation Summary Report |
| P11-001 | 21 CFR Part 11 Assessment (clause-by-clause → code module) |
| SOP-CC-001 | SOP: Change Control |
| SOP-UAM-001 | SOP: User Access Management |
| SOP-BR-001 | SOP: Backup & Restore |
| SOP-PR-001 | SOP: Periodic Review |
| SOP-IM-001 | SOP: Incident Management |
| SOP-DA-001 | SOP: Data Archival |

**README** opens with a plain-language explanation of what CSV is and why a
software portfolio project ships a hundred pages of documentation, then a CSA note
on why this uses executable evidence instead of screenshots.

## 10. Repository Layout

```
/server              Express API, models, services, permission matrix
/client              React (Vite) app
/oq                  Jest API OQ + Playwright UI OQ + reporters
/evidence            generated timestamped evidence artefacts
/validation          13 docs + 6 SOPs
/.github/workflows   CI (oq.yml)
README.md
docs/superpowers/specs/2026-07-25-part11-ecrf-design.md
```

## 11. Build Phases (each independently reviewable)

1. **App core:** models, service layer, append-only audit trail, soft-delete
   plugins, server-timestamp enforcement + unit proof.
2. **Auth + RBAC + e-signature:** password policy, lockout, session timeout,
   permission matrix/middleware, re-auth signing, hash binding, amendment workflow.
3. **Clinical:** study/visit/enrolment, three forms + edit checks, query workflow,
   export + checksum.
4. **OQ suite + CI + real evidence run:** Jest API (≥30), Playwright UI, reporters,
   audit dump, GitHub Actions.
5. **Validation package:** author all 13 docs + 6 SOPs, traced to the code and to
   the real evidence produced in Phase 4.

## 12. Success Criteria

- Every Part 11 control in §6 is enforced **server-side** and demonstrated by a
  passing OQ test that also shows the corresponding **audit entry**.
- Security/negative OQ tests confirm privilege escalation, signed-record edits, and
  audit-trail tampering are **blocked and logged**.
- `/evidence` contains **real** timestamped results + audit-trail dump from an
  actual run (not templates).
- RTM links every URS item → FS → OQ test id → result with no orphans.
- README explains CSV + the CSA evidence approach.
