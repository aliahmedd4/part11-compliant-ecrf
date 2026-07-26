# SOP — Data Archival

| | |
|---|---|
| **Document ID** | SOP-DA-001 |
| **Version** | 1.0 |
| **Author** | ali4.hassan6@gmail.com (Student Developer) |
| **Effective date** | 2026-07-26 |
| **Review cycle** | Annual |

### Approval
| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author | ali4.hassan6@gmail.com (Student Developer) | *electronically prepared* | 2026-07-26 |
| Approver — QA | ⟨illustrative role placeholder⟩ | ________________ | __________ |

> Portfolio artefact — not for GxP use.

---

## 1. Purpose
To govern the long-term archival and eventual retrieval of clinical records, the
audit trail, and electronic signatures so they remain **accurate, complete,
readable, and retrievable** for the full regulatory retention period (21 CFR
11.10(b),(c); ICH GCP retention).

## 2. Scope
All study data (subjects, forms), the complete audit trail, all signatures, and the
metadata needed to interpret them (study/visit definitions, configuration, and the
signature pepper required to re-verify signatures).

## 3. Retention
Records are retained for the period required by the applicable regulation and
sponsor policy (commonly ≥ the study duration plus a defined number of years). No
record is destroyed before the retention period expires; deletion is only ever
logical (soft delete) during operation.

## 4. Archival procedure
1. **Trigger** — study closure or a scheduled archival milestone.
2. **Export** — produce a complete dataset export (`GET /export/dataset`) including
   subjects, forms, and signatures, plus a full audit-trail dump. Each archived
   file is accompanied by its **SHA-256 checksum** (integrity manifest) so future
   integrity can be proven.
3. **Completeness check** — verify the export against the live system counts and
   confirm all signatures are included with their `contentHash`.
4. **Readable form** — retain both the electronic form (JSON/CSV) and the means to
   render it human-readable (11.10(b)).
5. **Preserve verification capability** — archive the signature pepper securely and
   record the application version/lockfile hashes (IQ-001) so signatures can be
   re-verified and the data reconstructed on the qualified build.
6. **Storage** — archive to durable, access-controlled, encrypted storage with
   documented media/format migration to prevent obsolescence.

## 5. Retrieval
On request, retrieve the archive, verify checksums, and restore into a qualified
read environment (SOP-BR-001). Confirm sample records and signature verification
before use.

## 6. Integrity over time
Periodically (per SOP-PR-001) validate archived checksums to detect bit-rot or
tampering. Any mismatch is a **Critical** incident (SOP-IM-001).

## 7. Records
Archival manifests (files + checksums), completeness-check evidence, storage/format
migration records, retrieval and verification records.
