# 21 CFR Part 11 Assessment — Part 11 Compliant eCRF

| | |
|---|---|
| **Document ID** | P11-001 |
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

## 1. Purpose and Scope

This assessment evaluates the eCRF **clause by clause** against 21 CFR Part 11,
mapping each applicable requirement to the **specific code module** that implements
the control and the **OQ test** that provides objective evidence. The system is a
**closed system** (§11.3(b)(4)): access is controlled by the organisation operating
it, so §11.30 (open systems) does not apply.

Legend: **T** = technical control (in scope for this system); **P** = procedural
control (covered by an SOP).

## 2. Subpart B — Electronic Records

### §11.10 Controls for Closed Systems

| Clause | Requirement | Type | Implementation (module) | Evidence |
|---|---|---|---|---|
| **11.10(a)** | Validation of systems to ensure accuracy, reliability, consistent intended performance, and the ability to discern invalid/altered records | T/P | Whole validation package (VP→VSR); tamper detection via signature verification (`signature.service.verifySignature`) and append-only audit (`plugins/appendOnly.plugin.js`) | OQ-AMD-04, OQ-AUD-02/03; RTM-001 |
| **11.10(b)** | Ability to generate accurate and complete copies in human-readable and electronic form | T | Dataset export to JSON + CSV (`services/export.service.js`) | OQ-EXP-01 |
| **11.10(c)** | Protection of records to enable accurate and ready retrieval throughout the retention period | T | Soft-delete only (records retained) + append-only audit; no hard delete anywhere (`plugins/softDelete.plugin.js`, `appendOnly.plugin.js`); archival procedure SOP-DA-001 | OQ-SD-02/03, OQ-AUD-03 |
| **11.10(d)** | Limiting system access to authorized individuals | T | Authentication (JWT, bcrypt) + RBAC; role re-read from DB (`security/authenticate.js`, `requirePermission.js`, `services/auth.service.js`) | OQ-AUTH-08, OQ-RBAC-03/04 |
| **11.10(e)** | Secure, computer-generated, time-stamped audit trails recording operator entries and actions that create/modify/delete records, without obscuring prior data; retained as long as the record | T | Append-only audit trail with server timestamps and old/new values (`services/audit.service.js`, `plugins/appendOnly.plugin.js`, `lib/time.js`) | OQ-AUD-01/02/03/04, OQ-FORM-04/06 |
| **11.10(f)** | Operational system checks to enforce permitted sequencing of steps/events | T | Query state machine (open→answered→closed) and signature lifecycle (draft→signed→amended) enforce valid transitions (`services/query.service.js`, `form.service.js`, `signature.service.js`) | OQ-QRY-02, OQ-AMD-01/03 |
| **11.10(g)** | Authority checks to ensure only authorized individuals can use the system, operate, alter records, or perform operations | T | Server-side permission matrix + middleware on every protected route (`security/permissions.js`, `requirePermission.js`) | OQ-RBAC-01/02/03, OQ-QRY-03/04, OQ-EXP-04 |
| **11.10(h)** | Device (terminal) checks to determine validity of the source of data input | T/NA | Not applicable to this browser-based system (no specialised input devices); data source authenticated via user session | — |
| **11.10(i)** | Persons who develop/maintain/use the system have the education, training, and experience to perform their tasks | P | SOP-UAM-001 (access tied to role/training); training records maintained procedurally | — |
| **11.10(j)** | Written policies holding individuals accountable for actions under their electronic signatures | P | SOP-UAM-001, SOP-IM-001; signature meaning captured technically (`signature.model.js`) | OQ-SIG-02 |
| **11.10(k)** | Controls over systems documentation (distribution, access, revision, change control) | P | SOP-CC-001 (change control); validation documents version-controlled in Git | — |

### §11.30 Controls for Open Systems
Not applicable — the eCRF is a **closed system**. Were it deployed as an open
system, additional measures (e.g. document encryption in transit at rest, digital
signatures) would apply; TLS is assumed at the infrastructure layer.

## 3. Subpart C — Electronic Signatures

### §11.50 Signature Manifestations

| Clause | Requirement | Type | Implementation | Evidence |
|---|---|---|---|---|
| **11.50(a)(1)** | Printed name of the signer | T | `Signature.printedName` from the authenticated user (`signature.service.sign`) | OQ-SIG-02 |
| **11.50(a)(2)** | Date and time of signing | T | `Signature.whenUTC` from server clock (`lib/time.serverNow`) | OQ-SIG-02 |
| **11.50(a)(3)** | Meaning of the signature | T | `Signature.meaning` ∈ {author, reviewer, approver} | OQ-SIG-02/05 |
| **11.50(b)** | The above are subject to the same controls as records and included in any human-readable form | T | Signatures stored in an append-only collection; surfaced (with live verification) via the signatures endpoint (`routes/signature.routes.js`) | OQ-SIG-04/06 |

### §11.70 Signature/Record Linking

| Clause | Requirement | Type | Implementation | Evidence |
|---|---|---|---|---|
| **11.70** | Signatures shall be linked to their records so they cannot be excised, copied, or transferred to falsify a record | T | SHA-256 content binding over canonical serialization + server pepper; verification recomputes and detects any alteration; amendment invalidates prior signature (`lib/canonicalJson.js`, `lib/hash.js`, `signature.service.js`) | OQ-SIG-04, OQ-AMD-04 |

### §11.100 General Requirements

| Clause | Requirement | Type | Implementation | Evidence |
|---|---|---|---|---|
| **11.100(a)** | Each e-signature unique to one individual, not reused or reassigned | T/P | Unique `username`; accounts are soft-deactivated, never deleted/reassigned (`user.model.js`, `admin.routes.js` deactivate) | OQ (RBAC uses distinct identities) |
| **11.100(b)** | Verify the identity of an individual before establishing their signature | P | SOP-UAM-001 (identity verification at account provisioning) | — |
| **11.100(c)** | Certification to the FDA that e-signatures are legally binding | P | Procedural/organisational (out of technical scope) | — |

### §11.200 Electronic Signature Components and Controls

| Clause | Requirement | Type | Implementation | Evidence |
|---|---|---|---|---|
| **11.200(a)(1)** | Non-biometric signatures employ ≥2 components (id + password); on signing, all components used | T | Signing requires username (session identity) + password **re-authentication** (`signature.service.sign` → `auth.service.verifyCredentials`) | OQ-SIG-01 |
| **11.200(a)(1)(i)** | For a series of signings during a single session, first uses all components, subsequent use ≥1 | T | Each signing action re-verifies the password (stronger than the minimum) | OQ-SIG-01 |
| **11.200(a)(3)** | Used only by their genuine owners | T/P | Password re-auth + session identity; SOP-UAM-001 | OQ-SIG-01 |
| **11.200(b)** | Biometric signatures | NA | Not used | — |

### §11.300 Controls for Identification Codes / Passwords

| Clause | Requirement | Type | Implementation | Evidence |
|---|---|---|---|---|
| **11.300(a)** | Uniqueness of each combined id-and-password | T | Unique `username`; policy-enforced passwords (`user.model.js`, `auth.service.js`) | — |
| **11.300(b)** | Passwords periodically checked, recalled, or revised (aging) | T/P | Password change flow with history/non-reuse (`auth.service.changePassword`); aging interval set procedurally (SOP-UAM-001) | OQ-AUTH-05/06 |
| **11.300(c)** | Loss-management to deauthorize lost/compromised tokens/passwords | T/P | Account deactivation + forced credential reset (`admin.routes.js`); SOP-IM-001 | — |
| **11.300(d)** | Transaction safeguards to prevent unauthorized use; detect and report attempts | T | Account lockout after failed attempts; failed logins and denials written to the audit trail (`auth.service.registerFailure`, `requirePermission.js`) | OQ-AUTH-03/04, OQ-RBAC-03 |
| **11.300(e)** | Testing of devices (tokens/cards) | NA | No hardware tokens used | — |

## 4. Assessment Summary

| Subpart | Applicable technical clauses | Implemented | Evidenced by OQ |
|---|---|---|---|
| 11.10 (records) | (a)(b)(c)(d)(e)(f)(g) | Yes | Yes |
| 11.50 (manifestation) | all | Yes | Yes |
| 11.70 (linking) | all | Yes | Yes |
| 11.200 (components) | (a) | Yes | Yes |
| 11.300 (passwords) | (a)(b)(d) | Yes | Yes |

Procedural clauses (11.10(i)(j)(k), 11.100(b)(c), 11.300(c)) are addressed by the
SOPs referenced above; their execution is outside this technical validation.

**Conclusion:** all applicable **technical** requirements of 21 CFR Part 11 are
implemented in identifiable code modules and demonstrated by passing OQ evidence.
Procedural requirements are covered by issued SOPs.
