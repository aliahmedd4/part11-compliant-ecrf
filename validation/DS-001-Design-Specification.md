# Design Specification — Part 11 Compliant eCRF

| | |
|---|---|
| **Document ID** | DS-001 |
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

## 1. Architecture Overview

The system is a three-tier MERN application:

```
┌───────────────────────┐    HTTPS/JSON    ┌──────────────────────────────┐
│  React client (Vite)  │ ───────────────► │  Express API (Node)          │
│  - reflects perms only │                  │  authenticate → requirePerm  │
│  - session idle timer  │ ◄─────────────── │        ↓                     │
└───────────────────────┘                  │  Service layer (sole writer) │
                                            │  audit / auth / signature /   │
                                            │  form / query / export        │
                                            │        ↓                     │
                                            │  Mongoose models + plugins    │
                                            │  (append-only, soft-delete)   │
                                            │        ↓                     │
                                            │  MongoDB                      │
                                            └──────────────────────────────┘
```

**Key design principle — single writer.** All data mutations funnel through the
**service layer**. This is the linchpin of compliance: it guarantees that every
change is (a) authorised, (b) validated by edit checks, (c) stamped with server
time, and (d) written to the audit trail. Routes never touch models directly for
writes; models never bypass the plugins. Because there is exactly one write path,
"every change is audited" is a property we can reason about and test, not a hope.

## 2. Component Design

| Layer | Module(s) | Responsibility |
|---|---|---|
| Routing | `routes/*.routes.js` | HTTP surface; input shape; delegate to services |
| Security | `security/authenticate.js`, `requirePermission.js`, `permissions.js` | Identity + authority (server-side) |
| Services | `services/*.service.js` | Business rules; the only writers of data |
| Validation | `validation/editChecks.js` | Pure edit-check engine |
| Models | `models/*.model.js` | Schemas + applied plugins |
| Plugins | `plugins/appendOnly.plugin.js`, `softDelete.plugin.js` | Structural integrity guarantees |
| Libraries | `lib/time.js`, `canonicalJson.js`, `hash.js` | Server time, canonical serialization, hashing |

Each unit has a single responsibility and a narrow interface, so it can be
understood and tested in isolation (a design goal that also underpins the small,
focused OQ test files).

## 3. Data Model

| Collection | Key fields | Notes |
|---|---|---|
| **User** | username, printedName, role, passwordHash, passwordHistory[], failedAttempts, lockedUntil, active, deleted{} | bcrypt hashes only |
| **Study** | name, protocolId, sponsor, status, deleted{} | one study |
| **Visit** | studyId, name, order, expectedForms[], deleted{} | visit schedule |
| **Subject** | studyId, subjectCode, status, enrolledAtUTC, deleted{} | unique (studyId, subjectCode) |
| **FormInstance** | subjectId, visitId, type, data{}, status, locked, version, deleted{} | signable clinical record |
| **AuditEvent** | whoUserId, whoUsername, whenUTC, targetModel, docId, field, oldValue, newValue, reason, action | **append-only** |
| **Signature** | recordCollection, recordId, recordVersion, signerUserId, printedName, whenUTC, meaning, contentHash | **append-only** |
| **Query** | formInstanceId, field, status, history[]{action,by,when,text}, deleted{} | clarification workflow |
| **Config** | passwordPolicy, lockout, session | runtime-tunable controls (singleton) |

All domain collections carry `deleted{isDeleted, atUTC, byUserId, reason}` via the
soft-delete plugin. `AuditEvent` and `Signature` deliberately do **not** carry
soft-delete (they are never removed at all) and instead use the append-only plugin.

Note: the audit field is named `targetModel` (not `collection`) because
`collection` is a reserved Mongoose schema path — a deliberate design choice to
avoid undefined behaviour in an integrity-critical model.

## 4. Audit Trail Design

**Immutability is structural, enforced at two layers (defence in depth):**

1. **Model layer** — `appendOnly.plugin.js` intercepts every Mongoose write/delete
   pathway (`updateOne`, `updateMany`, `replaceOne`, `findOneAndUpdate`,
   `findOneAndReplace`, `findOneAndDelete`, `deleteOne`, `deleteMany`, document
   `save()` when not new, and `bulkWrite`) and throws. Nothing in the process can
   mutate an audit row.
2. **API layer** — no route exposes any verb that updates or deletes an audit
   entry; `admin.routes.js` provides read-only review. Even an Administrator can
   only read history.

**Content of each entry** maps directly to ALCOA+:

| Field | ALCOA+ attribute |
|---|---|
| whoUserId / whoUsername | Attributable |
| whenUTC (server) | Contemporaneous |
| oldValue / newValue | Original, Accurate |
| append-only storage | Enduring, Complete, Consistent, Available |
| structured schema | Legible |

**Write mechanism.** `audit.service.diffAndAudit()` performs a field-level diff and
emits one entry per changed leaf, so an update touching two fields produces two
precise entries (not one coarse "record changed"). Creation, signing, amendment,
deletion, login, lockout, export, and access-denied events are each written with a
specific `action` verb.

## 5. Signature Binding Mechanism

### 5.1 Algorithm
```
signedContent = { subjectId, visitId, type, version, data }   // the signed subset
canonical     = canonicalJson(signedContent)                  // key-sorted, deterministic
contentHash   = SHA-256( canonical + serverPepper )           // hex digest, stored on Signature
```

At verification, `verifySignature(signature, form)` recomputes `contentHash` from
the record's current content and compares. Equality ⇒ **valid** (content
unchanged). Inequality ⇒ **invalid** (content altered since signing) — the
tamper-evidence required by §11.70.

### 5.2 Why a canonical serialization
A hash is only stable if identical logical content always serializes to identical
bytes. `canonicalJson.js` recursively sorts object keys and normalises Dates to
ISO strings, so field ordering or serialization quirks cannot spuriously break a
valid signature, while any real change to a value or the set of fields does.

### 5.3 Why the signed *subset* (not the whole document)
Volatile fields such as `updatedAt` are excluded from `signableContent` so that
routine persistence metadata does not invalidate a signature, while every
clinically meaningful field is covered.

### 5.4 Server pepper — design decision and trade-off
The hash mixes in a **server-side secret pepper** (`config.signaturePepper`).

- **Benefit:** a signature cannot be forged or independently recomputed by a party
  who knows only the record content; producing a valid `contentHash` also requires
  the server secret. This strengthens non-repudiation and resists offline
  hash-matching.
- **Trade-off:** the hash is therefore **not verifiable from record content
  alone** — verification must run on the server (or wherever the pepper is
  available). A purist design could omit the pepper to make the binding
  independently verifiable by any third party holding only the content.
- **Decision (accepted):** retain the pepper. In this system verification is a
  server-side operation exposed through the read-only signatures endpoint, so the
  independent-verifiability property is not required, and the anti-forgery benefit
  is judged more valuable. The pepper must be a protected secret managed per
  environment (see IQ-001); rotating it would invalidate historical signatures and
  is therefore a controlled change.

### 5.5 Amendment interaction
An amendment bumps `FormInstance.version`, which is part of `signedContent`.
Consequently the prior signature (taken at the old version) will not match the new
content — it is preserved on file and correctly reported invalid, giving a
complete, tamper-evident history rather than a silent overwrite.

## 6. Session and Authentication Design

Stateless JWT sessions signed with `config.jwtSecret` and `expiresIn =
Config.session.idleTimeoutMinutes`. The token carries `sub` (user id) and `role`,
but **authority always derives from the DB-read role**, not the token claim, so
revocation and role changes take effect immediately and token tampering fails.

## 7. Deployment View

- **Production:** Node process (`src/index.js`) reading `MONGODB_URI`, `JWT_SECRET`,
  `SIGNATURE_PEPPER` from the environment; MongoDB as a managed service; client
  served as static build output.
- **Test/CI:** `mongodb-memory-server` provides a real MongoDB engine in-memory so
  the same code and plugins execute against genuine MongoDB semantics.

## 8. Design Risk Notes

- Loss/rotation of `SIGNATURE_PEPPER` invalidates historical signatures → treated
  as a controlled change (SOP-CC-001) and a key-management requirement (IQ-001).
- The single-writer principle must be preserved by future development; a direct
  model write outside the service layer would bypass auditing. Code review and the
  OQ regression suite mitigate this (RA-001).
