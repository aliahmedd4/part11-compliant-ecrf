# SOP — Backup and Restore

| | |
|---|---|
| **Document ID** | SOP-BR-001 |
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
To ensure clinical records, the audit trail, and signatures are backed up reliably
and can be restored accurately and completely, protecting data availability and
integrity throughout the retention period (21 CFR 11.10(c)).

## 2. Scope
The MongoDB database (all collections: User, Study, Visit, Subject, FormInstance,
AuditEvent, Signature, Query, Config) and the environment configuration required to
run the qualified build (excluding secrets, which are managed separately).

## 3. Responsibilities
- **System Administrator** — executes and monitors backups; performs restores.
- **QA** — reviews restore-test evidence periodically.

## 4. Procedure
### 4.1 Backup
1. **Schedule:** automated daily full backup via `mongodump` (or the managed
   database provider's snapshot facility), retained per the retention schedule.
2. **Integrity:** each backup artefact's SHA-256 checksum is recorded so its
   integrity can be verified before any restore.
3. **Storage:** backups stored in a separate, access-controlled location;
   encryption at rest.
4. **Secrets:** `JWT_SECRET` and `SIGNATURE_PEPPER` are backed up separately under
   restricted access. The pepper is essential — without it, historical signatures
   cannot be re-verified.

### 4.2 Restore
1. Restore into an isolated environment first (never overwrite production blindly).
2. Verify the backup checksum before restoring.
3. Restore with `mongorestore` (or provider snapshot restore).
4. **Post-restore verification:**
   - Boot the application; confirm `GET /health` = 200.
   - Confirm audit-trail immutability still holds (append-only plugin active).
   - Spot-check that a signed record still verifies against its signature
     (requires the correct pepper) — confirms records + signatures restored
     consistently.

### 4.3 Restore testing
A restore test is performed at least **annually** and after any major
infrastructure change, with results recorded and reviewed by QA.

## 5. Recovery objectives
- **RPO** (max data loss): 24 hours (daily backup).
- **RTO** (max downtime): to be defined per production SLA.

## 6. Records
Backup logs and checksums, restore-test records and verification evidence,
retention/rotation schedule.
