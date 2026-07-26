# Part 11 Compliant eCRF — a validated electronic case report form

A minimal electronic Case Report Form (eCRF) built on the **MERN** stack
(MongoDB, Express, React, Node) that demonstrates the **technical controls required
by 21 CFR Part 11**, wrapped in a **complete Computerized System Validation (CSV)
package** of the kind produced in a real regulated engagement.

---

## What is CSV, and why does a software project ship a hundred pages of documents?

**Computerized System Validation (CSV)** is the discipline of producing *documented
evidence, to a high degree of assurance, that a computer system does what it is
supposed to do — and keeps doing it.* In regulated industries (pharmaceuticals,
medical devices, clinical trials) this is not optional: if a system creates or
manages records that support a drug's safety or a patient's data, a regulator (the
FDA, EMA, MHRA…) expects you to *prove* the system is trustworthy, not just assert
it.

That proof takes the form of a paper trail with a specific structure — the
**V-model**:

- You write down **what the users need** (User Requirements, URS).
- You specify **how the software will do it** (Functional & Design Specs, FS/DS).
- You analyse **what could go wrong** and how bad it would be (Risk Assessment).
- You **test** that each requirement is actually met (IQ/OQ/PQ protocols).
- You **trace** every requirement to its test and result (Traceability Matrix).
- You record every **deviation**, summarise the outcome (Summary Report), and put
  **procedures** (SOPs) in place to keep the system compliant over its life.

So the "hundred pages" are not bureaucratic padding — each document answers a
question a regulator (or an auditor, or a future maintainer) will ask: *How do you
know this works? Who is allowed to do what? What happens when someone tries to
cheat? How would you recover the data in five years?* For a software portfolio, this
package demonstrates something most projects never show: not just that you can
**build** a system, but that you can **prove it is correct and trustworthy** to a
professional standard.

### Why *this* system needs the most rigour (GAMP 5 Category 5)

GAMP 5 grades software by how much you have to prove yourself. Off-the-shelf tools
(Category 3/4) come with the vendor's own validation you can lean on. This eCRF is
**Category 5 — custom software**: *we* wrote the code that enforces every rule, so
*no external validation exists*. Everything must be specified, risk-assessed, and
tested by us. That is why custom software carries the largest validation burden —
explained in detail in [`validation/VP-001`](validation/VP-001-Validation-Plan.md).

### Why the evidence here is code, not screenshots (CSA)

Traditional CSV is often "screenshot-heavy": a human clicks through the system and
pastes pictures into a Word document. The FDA's newer **Computer Software Assurance
(CSA)** approach says: focus effort on *risk*, and prefer **automated, objective
evidence**. So the Operational Qualification here is an **executable test suite**
(Jest + Playwright) that runs against a real database and emits **timestamped,
structured results** plus a **dump of the resulting audit trail**. The green CI
check *is* the evidence. See [`evidence/`](evidence/) and
[`.github/workflows/oq.yml`](.github/workflows/oq.yml).

---

## The Part 11 controls, and where they live in the code

| Control (21 CFR Part 11) | Where it's implemented |
|---|---|
| **Immutable audit trail** (§11.10(e)) — who/UTC/field/old/new/reason, append-only | `server/src/plugins/appendOnly.plugin.js`, `services/audit.service.js` |
| **Soft delete only** — no hard deletes anywhere | `server/src/plugins/softDelete.plugin.js` |
| **Server-side timestamps only** | `server/src/lib/time.js` |
| **Role-based access, enforced server-side** (§11.10(d),(g)) | `server/src/security/permissions.js`, `requirePermission.js`, `authenticate.js` |
| **Password policy, lockout, session timeout** (§11.300) | `server/src/services/auth.service.js`, `client/src/AuthContext.jsx` |
| **E-signature: re-auth + name/UTC/meaning** (§11.50, §11.200) | `server/src/services/signature.service.js` |
| **Signature bound to content by hash** (§11.70) | `server/src/lib/canonicalJson.js`, `lib/hash.js` |
| **Signed records read-only; amendment workflow** | `server/src/services/form.service.js` |
| **Edit checks (range/required/cross-field)** | `server/src/validation/editChecks.js` |
| **Query workflow (raise/respond/close)** | `server/src/services/query.service.js` |
| **Export with integrity checksum** | `server/src/services/export.service.js` |

Full clause-by-clause mapping:
[`validation/P11-001`](validation/P11-001-Part11-Assessment.md).

---

## Repository layout

```
server/       Express API — models, services (the single writer of data), RBAC, plugins
client/       React (Vite) eCRF UI — reflects permissions; the server enforces them
oq/           Operational Qualification — Jest API tests + Playwright UI tests + evidence tooling
evidence/     Generated OQ results and audit-trail dumps (objective evidence)
validation/   The CSV package: VP, URS, FS, DS, RA, RTM, IQ, OQ, PQ, DEV, VSR, P11, 6 SOPs
.github/      CI workflow that runs the OQ suite and publishes evidence
```

---

## Running it

### Prerequisites
- Node.js 24.x, npm 11.x. No local MongoDB needed for tests (an in-memory MongoDB
  is provided by `mongodb-memory-server`).

### Run the automated OQ suite (the evidence engine)
```bash
cd server && npm ci
cd ../oq && npm ci
npm run oq:api        # runs 54 API OQ cases; writes evidence/oq-results-*.json
npm run dump:audit    # writes evidence/audit-trail-*.json (ALCOA+ trail)
```
Expected: **54/54 passing**, including 11 security/negative cases (privilege
escalation, editing a signed record, altering an audit entry — each blocked and,
where applicable, logged).

### Run the application locally
```bash
# 1. Start a MongoDB (any local instance) and set env vars:
export MONGODB_URI="mongodb://localhost:27017/ecrf"
export JWT_SECRET="<a strong secret>"
export SIGNATURE_PEPPER="<a strong secret>"

# 2. Seed and start the API:
cd server && npm ci && npm run seed && npm start      # API on :4000

# 3. Start the client:
cd ../client && npm ci && npm run dev                 # UI on :5173
```
Seeded logins (change immediately in any real use): `investigator`, `datamanager`,
`monitor`, `administrator` — password `Str0ng-Passw0rd!`.

### UI OQ (Playwright)
With the seeded API and client running:
```bash
cd oq && npx playwright install && npm run oq:ui
```

---

## Where to start reading the validation package

1. [`VP-001` Validation Plan](validation/VP-001-Validation-Plan.md) — the strategy and the GAMP 5 rationale.
2. [`URS-001` Requirements](validation/URS-001-User-Requirements.md) → [`RTM-001` Traceability](validation/RTM-001-Traceability-Matrix.md) — what's required and how it's proven.
3. [`RA-001` Risk Assessment](validation/RA-001-Risk-Assessment.md) — the FMEA driving the testing.
4. [`OQ-001`](validation/OQ-001-Operational-Qualification.md) + [`evidence/`](evidence/) — the executed tests and their objective results.
5. [`P11-001`](validation/P11-001-Part11-Assessment.md) — every Part 11 clause mapped to a code module.

---

## Important limitation

This is a **demonstration / portfolio artefact** validating the *technical controls*
of 21 CFR Part 11. It is **not** released for actual clinical or GxP use, and the
approver signatures throughout the validation package are illustrative placeholders.
See [`VSR-001` §6](validation/VSR-001-Validation-Summary-Report.md).
