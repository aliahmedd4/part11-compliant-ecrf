# SOP — User Access Management

| | |
|---|---|
| **Document ID** | SOP-UAM-001 |
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
To govern the provisioning, modification, periodic review, and deactivation of user
accounts and their roles so that only authorised, identity-verified, trained
individuals have access appropriate to their function (21 CFR 11.10(d),(g),(i);
11.100(b); 11.300).

## 2. Scope
All eCRF user accounts across the four roles: Investigator, Data Manager, Monitor,
Administrator.

## 3. Role authority (reference)
Authority is defined in `security/permissions.js`. Summary:
- **Investigator** — enter/sign form data, enrol subjects, respond to queries.
- **Data Manager** — review data, raise/close queries, export, sign as reviewer.
- **Monitor** — read-only access + raise queries + review audit trail.
- **Administrator** — user management + full access.

## 4. Procedure
### 4.1 Provisioning
1. Requestor submits an access request specifying the individual, role, and
   business justification.
2. Administrator **verifies the person's identity** and confirms required training
   is complete (11.100(b)).
3. Administrator creates the account via `POST /admin/users`; the system enforces
   the password policy and records the provisioning in the audit trail.
4. The initial password is delivered securely; the user changes it at first use.

### 4.2 Modification
Role changes follow the same authorisation path and are audited. Because the server
re-reads the role from the database on every request, changes take effect
immediately (no stale token risk).

### 4.3 Password controls
Enforced by configuration (`Config.passwordPolicy`, `Config.lockout`): minimum
length, complexity, non-reuse history, and lockout after failed attempts. Users
change compromised passwords immediately per SOP-IM-001.

### 4.4 Deactivation (leavers)
1. On role change or departure, the Administrator deactivates the account via
   `POST /admin/users/:id/deactivate` (soft — never a hard delete).
2. Deactivation is audited; the account cannot authenticate thereafter.
3. Accounts are **never reused or reassigned** to a different person (11.100(a)).

### 4.5 Periodic access review
Quarterly, the Administrator/QA reviews the user list (`GET /admin/users`) against
current staffing and confirms each account's role remains appropriate. Findings are
recorded and remediated.

## 5. Records
Access requests, identity-verification/training confirmations, the audit-trail
entries for account create/deactivate/role change, and periodic review records.
