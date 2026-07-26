# Validation Plan — Part 11 Compliant eCRF

| | |
|---|---|
| **Document ID** | VP-001 |
| **Version** | 1.0 |
| **Author** | ali4.hassan6@gmail.com (Student Developer) |
| **Date** | 2026-07-26 |
| **Status** | Approved for execution |
| **System** | Part 11 Compliant eCRF (MERN) |

### Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author / Validation Lead | ali4.hassan6@gmail.com (Student Developer) | *electronically prepared* | 2026-07-26 |
| Reviewer — Quality Assurance | ⟨illustrative role placeholder⟩ | ________________ | __________ |
| Approver — System Owner | ⟨illustrative role placeholder⟩ | ________________ | __________ |

> **Portfolio artefact — not for GxP use.** Approver/reviewer signature lines are illustrative placeholders demonstrating document structure.

---

## 1. Purpose

This Validation Plan (VP) defines the strategy, scope, deliverables, roles, and
acceptance criteria for the computerized system validation (CSV) of the **Part 11
Compliant eCRF**. It establishes *what will be validated, how, by whom, and what
constitutes success*, and governs all subordinate validation documents (URS, FS,
DS, RA, RTM, IQ, OQ, PQ, VSR).

## 2. System Overview

The eCRF is a minimal electronic data capture (EDC) system supporting one clinical
study. It captures subject enrolment and three form types (demographics, vital
signs, adverse events), enforces access control, maintains an immutable audit
trail, supports electronic signatures, provides a data-clarification query
workflow, and exports the dataset with an integrity checksum. It is a **MERN**
application (MongoDB, Express, React, Node).

The system's purpose is to demonstrate the **technical controls required by
21 CFR Part 11** (electronic records and electronic signatures) and the ALCOA+
data-integrity principles.

## 3. GAMP 5 Software Category and Validation Rigour

### 3.1 Categorisation

Per **GAMP 5 (Second Edition)**, software is categorised to drive a risk- and
science-based validation effort:

| Category | Description | Validation leverage |
|---|---|---|
| 1 | Infrastructure software (OS, DB engine) | Qualify installation only |
| 3 | Non-configured products (COTS used as-is) | Leverage supplier testing; verify intended use |
| 4 | Configured products (e.g. a commercial EDC configured to a protocol) | Verify configuration; leverage supplier's product validation |
| **5** | **Custom / bespoke software** | **No supplier validation exists — the full lifecycle must be specified, designed, risk-assessed, and tested by the developing organisation** |

This eCRF is **Category 5 (custom software)**. Every regulatory control
(audit trail immutability, RBAC, signature binding, amendment workflow) is
**bespoke code we authored**.

### 3.2 Why Category 5 Drives the Most Testing (the key teaching point)

For a Category 3/4 COTS EDC, the vendor has already validated the product against
its own specifications; the regulated user primarily verifies *configuration* and
*intended use*, and may rely on a supplier audit. **That leverage does not exist
for custom software.** Because we wrote the logic that enforces trustworthiness,
there is no external body of evidence that it behaves correctly — so:

1. Requirements must be explicitly specified (URS) — nothing is "assumed handled
   by the product".
2. Every requirement must trace to a design element (FS/DS) we can point at in
   code.
3. Every requirement must be independently **tested** (OQ/PQ) because no supplier
   test report covers it.
4. Failure modes must be actively hunted (Risk Assessment / FMEA) because bespoke
   code has bespoke defects.

The consequence is a **larger test burden and a formal traceability obligation**
than a comparable COTS deployment. This plan therefore mandates a full V-model.

## 4. Validation Approach — V-Model and Computer Software Assurance (CSA)

The validation follows the **V-model**: each specification tier on the left is
verified by a corresponding test tier on the right.

```
 User Requirements (URS) ───────────────────────► Performance Qualification (PQ)
   Functional Spec (FS) ──────────────────► Operational Qualification (OQ)
     Design Spec (DS) ────────────► Installation Qualification (IQ)
                         \        /
                          Build (code)
```

Consistent with the FDA's **Computer Software Assurance (CSA)** guidance and GAMP
5 Second Edition, testing effort is **risk-based** and, wherever possible,
**automated with electronic evidence** rather than manual, screenshot-heavy
scripts. The OQ is implemented as an **executable test suite** (Jest for the API,
Playwright for the UI) that emits structured, timestamped results and an
audit-trail dump as objective evidence.

## 5. Scope

### 5.1 In Scope
- All Part 11 technical controls: audit trail, access control, electronic
  signatures, amendment workflow, soft delete, server-side timestamps.
- Clinical functions: enrolment, three form types, edit checks, query workflow,
  export with checksum.
- The API (server), the React client, and the automated OQ suite + CI.

### 5.2 Out of Scope
- Infrastructure qualification of the host OS and the MongoDB engine beyond
  version pinning (treated as GAMP Category 1; assumed qualified).
- Multi-study/multi-site operation, randomisation, medical coding dictionaries.
- Procedural (SOP) controls are documented but their operational execution is
  outside this technical validation.

## 6. Deliverables

| ID | Deliverable |
|---|---|
| VP-001 | Validation Plan (this document) |
| URS-001 | User Requirements Specification |
| FS-001 | Functional Specification |
| DS-001 | Design Specification |
| RA-001 | Risk Assessment (FMEA) |
| RTM-001 | Requirements Traceability Matrix |
| IQ-001 | Installation Qualification Protocol & Report |
| OQ-001 | Operational Qualification Protocol & Report |
| PQ-001 | Performance Qualification Protocol & Report |
| DEV-001 | Deviation Log |
| VSR-001 | Validation Summary Report |
| P11-001 | 21 CFR Part 11 Assessment |
| SOP-CC/UAM/BR/PR/IM/DA-001 | Standard Operating Procedures |

## 7. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| Validation Lead | Authors validation documents, executes protocols, compiles evidence |
| Quality Assurance | Reviews and approves documents, dispositions deviations |
| System Owner | Owns the system, approves release for use |
| Developer | Implements requirements; maintains code and automated tests |
| System Administrator | Manages environment, users, backups per SOPs |

*(In this portfolio project a single author performs the technical work; approver
roles are illustrative.)*

## 8. Acceptance Criteria

Validation is considered successful when:
1. Every URS requirement traces through FS → DS → at least one OQ/PQ test with a
   **Pass** result (RTM-001 shows no orphans).
2. All OQ security/negative tests confirm that privilege escalation, modification
   of signed records, and audit-trail alteration are **blocked and, where
   applicable, logged**.
3. The PQ mock study completes end-to-end with data-integrity evidence intact.
4. All deviations are recorded (DEV-001) and dispositioned; no open critical
   deviations remain.
5. The VSR recommends release.

## 9. Change Control and Revalidation

Post-release changes are governed by **SOP-CC-001 (Change Control)**. Impact
assessment determines the extent of revalidation. The automated OQ suite enables
efficient regression testing for any change (re-run the suite; compare evidence).

## 10. References

- 21 CFR Part 11 — Electronic Records; Electronic Signatures
- FDA Guidance — *Computer Software Assurance for Production and Quality System
  Software* (2022, draft)
- ISPE GAMP 5: *A Risk-Based Approach to Compliant GxP Computerized Systems*, 2nd ed.
- ICH E6(R2) Good Clinical Practice
- MHRA *GxP Data Integrity Guidance* (ALCOA+)
