# SOP — Incident Management

| | |
|---|---|
| **Document ID** | SOP-IM-001 |
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
To ensure incidents affecting the eCRF — security events, data-integrity concerns,
system failures, or suspected unauthorised access — are detected, contained,
investigated, and resolved with appropriate CAPA and, where required, escalation
(21 CFR 11.10(d), 11.300(d)).

## 2. Scope
Any event that threatens the confidentiality, integrity, or availability of the
system or its records, including: repeated failed logins / lockouts, suspected
credential compromise, unexpected `access_denied` patterns, data anomalies, service
outages, and dependency vulnerabilities.

## 3. Severity classification
- **Critical** — confirmed unauthorised data change, audit-trail or signature
  integrity concern, or data loss.
- **Major** — attempted breach, credential compromise, extended outage.
- **Minor** — isolated failed-login lockout, transient error with no data impact.

## 4. Procedure
1. **Detect & record** — log the incident (time, reporter, description). Sources
   include the audit trail (`login_failed`, `account_locked`, `access_denied`
   events), monitoring, and user reports.
2. **Contain** — take immediate protective action: deactivate affected accounts
   (SOP-UAM-001), revoke/rotate secrets if credentials/pepper are suspect
   (SOP-CC-001 Critical change), or isolate the environment.
3. **Investigate** — use the immutable audit trail to reconstruct events
   (attributable, time-stamped). Because the trail is append-only, it is reliable
   forensic evidence.
4. **Assess impact** — determine whether any record integrity or signature validity
   was affected; verify signed records via the signatures endpoint.
5. **Remediate (CAPA)** — corrective action (fix, restore per SOP-BR-001) and
   preventive action (control improvement via SOP-CC-001).
6. **Close & report** — document resolution, root cause, and CAPA; escalate to QA/
   management per severity; feed lessons into periodic review (SOP-PR-001).

## 5. Data-integrity incidents
Any suspicion that a record was altered outside the sanctioned workflow triggers a
signature verification and audit-trail review. A confirmed integrity breach is a
**Critical** incident requiring notification and a formal investigation record.

## 6. Records
Incident log, investigation notes (with audit-trail excerpts), CAPA records,
closure and escalation documentation.
