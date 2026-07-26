# Risk Assessment (FMEA) — Part 11 Compliant eCRF

| | |
|---|---|
| **Document ID** | RA-001 |
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

## 1. Methodology

A **Failure Mode and Effects Analysis (FMEA)** is used, focused on **patient
safety** and **data integrity** — the two consequences a clinical record system
must protect. Each failure mode is scored on three axes (scale **1–5**):

- **Severity (S)** — impact if the failure occurs (5 = patient harm or loss of
  regulatory-critical data).
- **Occurrence (O)** — likelihood the cause arises (5 = frequent).
- **Detection (D)** — likelihood the failure goes *undetected* (5 = almost never
  detected; 1 = always detected).

**Risk Priority Number = S × O × D** (range 1–125). Risks with **RPN ≥ 27** (or any
Severity = 5 with Detection ≥ 3) require a designed control. After controls, a
**residual RPN** is scored; the primary lever for custom software is usually
**Detection** (a control that makes the failure impossible or immediately caught).

Each control references the implementing module and the **OQ test** that provides
objective evidence the control works.

## 2. FMEA Table

| # | Failure mode | Effect | Cause | S | O | D | RPN | Control (module) | Verifying OQ test | Res. S | Res. O | Res. D | Res. RPN |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R1 | Audit entry is altered or deleted | Loss of the trustworthy record of changes; regulatory finding | Malicious or accidental update/delete on audit collection | 5 | 3 | 4 | 60 | Append-only plugin blocks all mutation pathways; no write API (`appendOnly.plugin.js`) | OQ-AUD-02, OQ-AUD-03, OQ-FORM-06 | 5 | 3 | 1 | **15** |
| R2 | Record is hard-deleted | Permanent loss of clinical data / history | `deleteOne`/`deleteMany` used | 5 | 3 | 3 | 45 | Soft-delete plugin throws on hard delete; deletions audited (`softDelete.plugin.js`) | OQ-SD-02, OQ-SD-03 | 5 | 2 | 1 | **10** |
| R3 | Unauthorized user changes clinical data (privilege escalation) | Corrupted data; patient-safety impact | Missing/only-UI authority check; direct API call | 5 | 3 | 3 | 45 | Server-side RBAC middleware; role re-read from DB (`requirePermission.js`, `authenticate.js`) | OQ-RBAC-03, OQ-RBAC-04 | 5 | 2 | 1 | **10** |
| R4 | Signed record altered without detection | Undetected data falsification | Edit path bypasses lock; no content binding | 5 | 2 | 4 | 40 | Lock on sign + amendment-only edit; SHA-256 content binding (`signature.service.js`) | OQ-AMD-01, OQ-AMD-04, OQ-SIG-04 | 5 | 2 | 1 | **10** |
| R5 | Back-dated / client-supplied timestamp | Loss of "contemporaneous"; masks late entries | Client sends timestamp; server trusts it | 4 | 3 | 4 | 48 | Server clock only via `lib/time.serverNow()`; client time ignored | OQ-FORM-02 | 4 | 2 | 1 | **8** |
| R6 | Signature forged or repudiated | Non-attributable approval | Signing without re-auth; guessable binding | 5 | 2 | 3 | 30 | Re-authentication at signing; hash + server pepper (`signature.service.js`, `lib/hash.js`) | OQ-SIG-01, OQ-SIG-02 | 5 | 1 | 1 | **5** |
| R7 | Invalid/implausible clinical value stored | Wrong data drives clinical/safety decisions | No or weak edit checks | 5 | 3 | 3 | 45 | Required/range/cross-field edit checks reject bad data (`editChecks.js`) | OQ-EC-01..07, OQ-FORM-03 | 5 | 2 | 1 | **10** |
| R8 | Brute-force password guessing | Account compromise → unauthorized access | Weak policy; unlimited attempts | 4 | 3 | 3 | 36 | Password policy + account lockout (`auth.service.js`) | OQ-AUTH-04, OQ-AUTH-05 | 4 | 2 | 1 | **8** |
| R9 | Unattended active session misused | Actions under another identity | No session timeout | 4 | 3 | 3 | 36 | Configurable JWT expiry + client idle warning (`auth.service.js`, `AuthContext.jsx`) | OQ-AUTH-07 | 4 | 2 | 1 | **8** |
| R10 | Exported dataset altered undetected | Analysis on corrupted data | No integrity check on export | 4 | 2 | 4 | 32 | SHA-256 checksum manifest (`export.service.js`) | OQ-EXP-02 | 4 | 2 | 1 | **8** |
| R11 | Update made without reason for change | Incomplete audit; unexplained change | Reason not enforced | 4 | 3 | 3 | 36 | Service requires `reason`; recorded in audit (`form.service.updateForm`) | OQ-FORM-04, OQ-FORM-05 | 4 | 2 | 1 | **8** |
| R12 | Query resolution / history lost | Cannot reconstruct data clarifications | History not retained | 3 | 2 | 3 | 18 | Query history[] + audit per transition (`query.service.js`) | OQ-QRY-02 | 3 | 1 | 1 | **3** |
| R13 | Loss/rotation of signature pepper | Historical signatures fail verification | Secret mismanaged | 4 | 2 | 2 | 16 | Key management in environment; controlled change (IQ-001, SOP-CC-001) | *procedural* | 4 | 1 | 2 | **8** |
| R14 | Future code writes a model directly, bypassing audit | Silent unaudited change | Developer bypasses service layer | 5 | 2 | 3 | 30 | Single-writer design; code review; OQ regression suite in CI (DS-001, SOP-CC-001) | full OQ suite | 5 | 1 | 2 | **10** |

## 3. Risk Summary

- All identified risks with pre-mitigation RPN ≥ 27 or Severity = 5 have a designed
  control whose effectiveness is demonstrated by a named OQ test.
- Controls reduce risk predominantly by improving **Detection** to 1 (the failure
  is made structurally impossible or is caught deterministically by an automated
  test), consistent with the CSA principle of designing controls that produce
  objective, repeatable evidence.
- **Residual risks R13 and R14** retain a procedural/detective component (key
  management; developer discipline) and are carried into periodic review
  (SOP-PR-001) and change control (SOP-CC-001).

## 4. Conclusion

No residual risk exceeds the acceptance threshold (RPN < 27 and no Severity-5 risk
with Detection > 2). The design and its automated verification adequately control
the patient-safety and data-integrity risks of the system. Residual procedural
risks are accepted and managed through the referenced SOPs.
