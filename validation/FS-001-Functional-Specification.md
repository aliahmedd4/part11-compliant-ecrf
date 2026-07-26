# Functional Specification — Part 11 Compliant eCRF

| | |
|---|---|
| **Document ID** | FS-001 |
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

This Functional Specification describes **how** each user requirement (URS-001) is
implemented, naming the specific code modules and functions. It is the bridge
between the *what* (URS) and the *architecture/design* (DS-001), and provides the
implementation anchors used by the Requirements Traceability Matrix (RTM-001) and
the Part 11 Assessment (P11-001).

Code paths are relative to the repository root. Server code lives under `server/src/`.

## 2. Functional Design by Requirement

### FS-ACC — Access Control

**FS-001-01 (URS-001) — Four roles.**
Roles are defined as an enumeration on the User model (`models/user.model.js`,
`ROLES = ['Investigator','DataManager','Monitor','Administrator']`) and are the
keys of the permission matrix (`security/permissions.js`).

**FS-001-02 (URS-002) — Server-side permission enforcement.**
A single source-of-truth matrix `MATRIX` and function `can(role, action, resource)`
in `security/permissions.js` express every authority. The Express middleware
`requirePermission(action, resource)` (`security/requirePermission.js`) gates each
protected route and returns HTTP 403 on denial, writing an `access_denied` audit
event. Authentication middleware `authenticate` (`security/authenticate.js`)
verifies the JWT and **re-reads the user's role from the database**, so a tampered
token cannot escalate privilege. UI controls in the React client are cosmetic only.

**FS-001-03 (URS-003) — Password policy.**
`services/auth.service.js::assertPasswordMeetsPolicy()` checks candidate passwords
against `Config.passwordPolicy` (min length, required character classes) and
compares against the current hash plus `passwordHistory[]` using bcrypt to block
reuse. Passwords are stored only as bcrypt hashes (`hashPassword()`).

**FS-001-04 (URS-004) — Account lockout.**
`services/auth.service.js::login()` and `registerFailure()` maintain a rolling
failure counter (`failedAttempts`, `failedWindowStartUTC`) and set `lockedUntil`
once `Config.lockout.threshold` is reached, after which `login()` returns HTTP 423
regardless of password correctness. Lockouts are audited (`account_locked`).

**FS-001-05 (URS-005) — Session timeout + warning.**
The session JWT is signed with `expiresIn` equal to `Config.session.idleTimeoutMinutes`
(`auth.service.login`). The client (`client/src/AuthContext.jsx`) arms an idle
timer that shows a warning modal `warnBeforeMinutes` before expiry and logs out at
expiry; the server independently rejects expired tokens (`authenticate` → HTTP 401
`session_expired`).

### FS-DI — Data Integrity

**FS-001-06 (URS-006) — Field-level audit trail.**
`services/audit.service.js::diffAndAudit()` compares before/after record state and
writes one `AuditEvent` per changed field via `writeAudit()`, capturing
`whoUserId/whoUsername`, `whenUTC`, `targetModel`, `docId`, `field`, `oldValue`,
`newValue`, `reason`, and `action`. All clinical mutations route through
`services/form.service.js`, which requires a `reason` for updates.

**FS-001-07 (URS-007) — Append-only audit.**
`plugins/appendOnly.plugin.js` registers pre-hooks on every Mongoose
update/replace/delete operation and on re-`save()` of an existing document, each
throwing `AuditEvent is append-only`. Applied by `models/auditEvent.model.js` and
`models/signature.model.js`. No API route exposes a write/modify verb for audit
entries; `admin.routes.js` exposes audit **read** only.

**FS-001-08 (URS-008) — Soft delete only.**
`plugins/softDelete.plugin.js` adds a `deleted{isDeleted,atUTC,byUserId,reason}`
subdocument, overrides hard-delete operations to throw `Hard deletes are
prohibited`, provides `softDelete()`, and filters soft-deleted documents from
default reads (opt back in with `{ includeDeleted: true }`). Applied to all domain
models.

**FS-001-09 (URS-009) — Server-side timestamps.**
`lib/time.js::serverNow()` is the single time source. Services call it for
`enrolledAtUTC`, `whenUTC`, signature time, and deletion time. Request bodies
containing timestamps are ignored (verified by OQ-FORM-02).

### FS-SIG — Electronic Signatures

**FS-001-10 (URS-010) — Re-authentication.**
`services/signature.service.js::sign()` calls
`auth.service.verifyCredentials(username, password)` before creating a signature;
failure returns HTTP 401 `reauth_failed` and writes an `access_denied` audit
event, and no signature is persisted.

**FS-001-11 (URS-011) — Signature manifestation.**
`sign()` persists a `Signature` document with `printedName` (from the user
record), `whenUTC` (server clock), and `meaning` constrained to
`['author','reviewer','approver']`.

**FS-001-12 (URS-012) — Content binding.**
`lib/canonicalJson.js` produces a deterministic key-sorted serialization of the
signed subset (`signableContent()`); `lib/hash.js::contentHash()` computes
`SHA-256(canonicalJson + serverPepper)`. `verifySignature()` recomputes the hash
against current content and returns `valid:false` on any change.

**FS-001-13 (URS-013) — Signed records read-only.**
`sign()` sets `FormInstance.locked = true` and `status = 'signed'`.
`form.service.updateForm()` rejects any update to a locked record with HTTP 409
`record_locked`.

**FS-001-14 (URS-014) — Amendment workflow.**
`form.service.amendForm()` requires a `reason`, increments `version`, re-opens the
record (`locked=false`), writes `amend` audit events for every changed field plus
the version bump, and leaves the prior `Signature` in place — now failing
`verifySignature()` against the new content.

### FS-CLIN — Clinical Functions

**FS-001-15 (URS-015) — Study/visit/enrolment.**
Models `study.model.js`, `visit.model.js`, `subject.model.js`; enrolment via
`form.service.enrolSubject()` and `routes/subject.routes.js`. `seed.js` provisions
one study, a three-visit schedule, and subjects.

**FS-001-16 (URS-016) — Three form types.**
`models/formInstance.model.js` (`FORM_TYPES`), created/updated via
`routes/form.routes.js`.

**FS-001-17 (URS-017) — Edit checks.**
`validation/editChecks.js::checkForm(type, data)` implements required, range, and
cross-field checks per type and returns structured `{field, rule, message}`
violations; `form.service` rejects with HTTP 422 and no write occurs.

**FS-001-18 (URS-018) — Query workflow.**
`services/query.service.js` implements `raiseQuery/respondQuery/closeQuery` with a
state machine and `history[]`; `routes/query.routes.js` maps each transition to a
distinct authority (`raise:query`, `respond:query`, `close:query`).

**FS-001-19 (URS-019) — Export with checksum.**
`services/export.service.js::buildExport()` serializes the dataset to JSON and CSV
and computes a SHA-256 manifest (`lib/hash.js::sha256()`); `routes/export.routes.js`
gates it behind `export:dataset` authority and audits the export.

## 3. Error Handling

The Express error handler (`app.js`) maps typed service errors to HTTP status
codes (`status`) and codes (`code`), and surfaces structured edit-check violations
(`errors[]`) to the client. Authorization failures return 401/403; business-rule
violations return 409; validation failures return 422.

## 4. Interfaces

REST/JSON over HTTP. Authentication via `Authorization: Bearer <JWT>`. The client
communicates exclusively through these endpoints; there is no privileged client
back-channel.
