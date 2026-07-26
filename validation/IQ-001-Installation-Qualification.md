# Installation Qualification (Protocol & Report) — Part 11 Compliant eCRF

| | |
|---|---|
| **Document ID** | IQ-001 |
| **Version** | 1.0 |
| **Author** | ali4.hassan6@gmail.com (Student Developer) |
| **Date** | 2026-07-26 |
| **Status** | Executed — Pass |

### Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author / Executed by | ali4.hassan6@gmail.com (Student Developer) | *electronically prepared* | 2026-07-26 |
| Reviewer — QA | ⟨illustrative role placeholder⟩ | ________________ | __________ |
| Approver — System Owner | ⟨illustrative role placeholder⟩ | ________________ | __________ |

> Portfolio artefact — not for GxP use.

---

## 1. Purpose

The Installation Qualification (IQ) provides documented evidence that the system,
its dependencies, and its environment are installed correctly and match the
controlled, version-pinned configuration on which the OQ/PQ evidence was produced.
For **GAMP Category 5** software, reproducibility of the build is essential: the
qualified state is defined by exact dependency versions and lockfile integrity.

## 2. Environment

| Item | Specification | Verified value (execution environment) |
|---|---|---|
| Operating system | 64-bit OS | Windows 11 (build 10.0.26200) |
| Node.js runtime | 24.x LTS | **v24.14.0** |
| npm | 11.x | **11.9.0** |
| Database engine (test/CI) | MongoDB via `mongodb-memory-server` | mongodb-memory-server **10.1.2** (provisions a real MongoDB 7-series `mongod` binary in-memory) |
| Database engine (production) | MongoDB 6.0+ reachable via `MONGODB_URI` | *documented; provisioned per deployment* |
| Source control | Git | git 2.53.x |

## 3. Dependency Manifest (version-pinned)

Exact versions are pinned in `package.json` and locked in `package-lock.json`.

**Server (`server/package.json`):**
| Package | Version |
|---|---|
| express | 4.21.2 |
| mongoose | 8.9.5 |
| bcryptjs | 2.4.3 |
| jsonwebtoken | 9.0.2 |
| cors | 2.8.5 |

**OQ test harness (`oq/package.json`):**
| Package | Version |
|---|---|
| jest | 29.7.0 |
| supertest | 7.0.0 |
| mongodb-memory-server | 10.1.2 |
| @playwright/test | 1.49.1 |
| jsonwebtoken | 9.0.2 |

**Client (`client/package.json`):**
| Package | Version |
|---|---|
| react / react-dom | 18.3.1 |
| vite | 5.4.11 |
| @vitejs/plugin-react | 4.3.4 |

## 4. Lockfile Integrity (SHA-256, first 32 hex chars)

The lockfiles fix the entire transitive dependency tree. Their hashes below are
the integrity anchor for the qualified build; a changed hash signals a dependency
change requiring impact assessment under SOP-CC-001.

| Lockfile | SHA-256 (truncated) |
|---|---|
| `server/package-lock.json` | `3e830674b8a25a9278cd04ff2dcf9fcd…` |
| `oq/package-lock.json` | `584ab70f280c7016d19b80a2586d3534…` |
| `client/package-lock.json` | `22214da60b73524579c9a9ae63fa0eac…` |

*(Regenerate with the command in §7 IQ-05; recorded values are from the qualified
execution on 2026-07-26.)*

## 5. Database Configuration

| Setting | Value |
|---|---|
| Connection | `mongoose.connect(uri)` with `strictQuery = true` (`server/src/db.js`) |
| Test/CI database | Ephemeral, isolated per test run (`mongodb-memory-server`); no shared state |
| Production database | Injected via `MONGODB_URI` (never hard-coded) |
| Secrets | `JWT_SECRET`, `SIGNATURE_PEPPER` supplied via environment; defaults are dev-only and **must** be overridden (`server/src/config.js`) |
| Indexes | Unique `(studyId, subjectCode)` on Subject; audit review index `(targetModel, docId, whenUTC)` |

## 6. Installation Steps (as executed)

1. Clone the repository.
2. `cd server && npm ci` — installs the locked server dependency tree.
3. `cd oq && npm ci` — installs the locked OQ harness.
4. `cd client && npm ci` — installs the locked client dependencies.
5. Provide environment variables for production (`MONGODB_URI`, `JWT_SECRET`,
   `SIGNATURE_PEPPER`); for test/CI none are required.

## 7. IQ Test Cases & Results

| IQ Test | Verification | Command / Method | Expected | Result |
|---|---|---|---|---|
| IQ-01 | Node runtime version | `node -v` | v24.x | **Pass** (v24.14.0) |
| IQ-02 | Server deps install cleanly | `cd server && npm ci` | Exit 0 | **Pass** |
| IQ-03 | OQ harness deps install cleanly | `cd oq && npm ci` | Exit 0 | **Pass** |
| IQ-04 | Client deps install & build | `cd client && npm run build` | Build succeeds (37 modules) | **Pass** |
| IQ-05 | Lockfile integrity recorded | SHA-256 of each `package-lock.json` | Hashes recorded (§4) | **Pass** |
| IQ-06 | Database connectivity | Boot in-memory Mongo; `GET /health` | 200 `{status:"ok"}` | **Pass** (OQ-APP-01) |
| IQ-07 | Config singleton seeds | `getConfig()` returns pinned policy | Seeded from defaults | **Pass** (OQ-APP-03) |
| IQ-08 | Deployment artefact present | `dist/` produced by client build | Static bundle exists | **Pass** |

## 8. Deployment Verification

Application boot is verified by the health endpoint returning `{status:"ok"}`
(OQ-APP-01) and by the OQ harness successfully mounting the same `createApp()`
factory used in production against a live database. The client production bundle
builds without error.

## 9. Conclusion

The system installs deterministically from version-pinned manifests with recorded
lockfile integrity, connects to its database, and boots successfully. **IQ result:
Pass.** The environment is qualified for OQ execution.
