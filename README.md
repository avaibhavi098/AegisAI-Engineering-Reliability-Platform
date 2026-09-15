# AegisAI — AI-Powered Engineering Service Reliability Platform

AegisAI is a production-grade Site Reliability Engineering (SRE) operations platform designed to monitor microservice health, manage incident lifecycles, and accelerate Mean Time to Resolution (MTTR) using Google Gemini AI root-cause analysis (RCA).

---

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Database Design & Schema](#database-design--schema)
- [REST API Reference](#rest-api-reference)
- [Authentication & Role-Based Access Control (RBAC)](#authentication--role-based-access-control-rbac)
- [Gemini AI Workflow & Integration](#gemini-ai-workflow--integration)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Performance & Scalability](#performance--scalability)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Environment Variables](#environment-variables)
- [Local Setup Guide](#local-setup-guide)
- [Deployment Instructions](#deployment-instructions)
- [Security Considerations](#security-considerations)
- [Known Limitations](#known-limitations)
- [Future Improvements](#future-improvements)

---

## Overview

AegisAI bridges the gap between observability data and engineering response. Built with a unified full-stack architecture, it provides site reliability engineers, operations leads, and technical stakeholders with a centralized control plane for:

- Real-time service catalog tracking and health metrics (SLI/SLA).
- End-to-end incident management from declaration to postmortem.
- Automated and interactive Gemini AI diagnostics with executable remediation runbooks.
- Structured telemetry stream filtering and anomaly correlation.
- Team on-call duty scheduling and shift monitoring.
- Cryptographically secured audit logging and compliance records.

---

## Problem Statement

Modern microservice architectures generate millions of telemetry events, distributed logs, and metrics across heterogeneous infrastructure. When an outage occurs:

1. **High Mean Time to Detect (MTTD)**: Siloed dashboards delay visibility into cascading failures across upstream and downstream dependencies.
2. **Alert Fatigue & Cognitive Overload**: Engineers waste critical minutes sifting through high-volume log streams to identify the primary failure mode.
3. **Inconsistent Incident Triage**: Different responders follow varying triage patterns without standardized runbooks or automated hypotheses.
4. **Weak Auditability**: Fragmented postmortem notes and ad-hoc troubleshooting histories hinder organizational learning and SOC2/ISO compliance.

AegisAI addresses these challenges by combining continuous service health monitoring with server-side AI reasoning that parses telemetry, predicts cascading impact, and generates verified diagnostic runbooks.

---

## Key Features

### 1. Service Catalog & Health Monitoring
- **Tier Classification**: Categorizes services across Tier-1 (Mission Critical), Tier-2 (Core), and Tier-3 (Supporting).
- **Service Level Indicators**: Tracks real-time uptime percentage, average request latency (p50/p95), error rates, and RPS.
- **Dependency Topology**: Visualizes upstream and downstream dependencies for instant blast-radius assessment.
- **Status Lifecycle**: Live health state transitions (`HEALTHY`, `DEGRADED`, `DOWN`, `MAINTENANCE`).

### 2. Incident Response Management
- **Structured Declaration**: Declare incidents with severity levels (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) and linked affected services.
- **State Transition Machine**: Enforces valid status progressions: `OPEN` -> `INVESTIGATING` -> `MITIGATED` -> `RESOLVED` -> `CLOSED`.
- **Assignment & Escalation**: Assign on-call engineers with automatic workload balance tracking.
- **Immutable Timeline**: Automatically logs timeline updates, status changes, engineer assignments, and resolution notes.

### 3. Server-Side Gemini AI Root-Cause Analysis
- **Automated RCA**: Triggered automatically on critical incidents or on-demand by engineers.
- **Structured Diagnosis**: Returns primary root cause, failure mechanism, confidence score (0–100%), and identified risk factors.
- **Remediation Runbooks**: Generates executable shell commands and mitigation steps tailored to the affected service architecture.
- **Prevention Recommendations**: Delivers actionable engineering suggestions to prevent recurring regressions.

### 4. Interactive AI RCA Studio
- **Ad-Hoc Diagnostic Playground**: Run AI hypotheses against custom logs, stack traces, and simulated failure scenarios.
- **Custom Telemetry Ingestion**: Paste or upload raw system logs and receive instant AI classification, failure categorization, and mitigation plans.
- **Model Switching**: Support for Gemini model selection (`gemini-3.8-flash`, `gemini-2.5-flash`) directly from platform settings.

### 5. Telemetry & Log Explorer
- **High-Throughput Filtering**: Search structured logs by level (`INFO`, `WARN`, `ERROR`, `FATAL`), service key, and trace ID.
- **Debounced Exploration**: Sub-millisecond client filtering with memoized search hooks to handle large log batches without UI lag.
- **Log Injection Simulation**: Inject test log events with custom stack traces and error metadata for incident drill simulation.

### 6. Team On-Call Operations
- **Live Roster**: View available, on-call, and off-shift engineers with current active incident counts.
- **Shift Tracking**: Monitors active shift windows and handover schedules.
- **Role Assignment**: Dynamic status toggles between `AVAILABLE`, `ON_CALL`, and `OFF_SHIFT`.

### 7. Historical Archive & Compliance Audit Trail
- **Postmortem Archive**: Query resolved and closed incidents with calculated duration (MTTR) metrics.
- **Audit Logging**: Every service registration, incident update, AI execution, and configuration change is persistently logged with user identity, timestamp, IP address, and payload delta.

---

## System Architecture

AegisAI employs a unified full-stack architecture running inside a single containerized Node.js process:

```
+-------------------------------------------------------------------------+
|                              Client Browser                             |
|    React 19 SPA + Vite 6 + Tailwind CSS v4 + Motion + Lucide React      |
+------------------------------------+------------------------------------+
                                     |  HTTP / REST (Bearer Auth)
                                     v
+-------------------------------------------------------------------------+
|                        Express 4 HTTP Server (Node.js)                  |
|  +-------------------------------------------------------------------+  |
|  | Middleware: Auth (PBKDF2/Tokens) | RBAC | Telemetry | Validation  |  |
|  +-------------------------------------------------------------------+  |
|                                    |                                    |
|         +--------------------------+--------------------------+         |
|         |                                                     |         |
|         v                                                     v         |
|  +---------------+                                     +-------------+  |
|  | SQLite Store  | (node:sqlite DatabaseSync)          | Gemini API  |  |
|  | WAL Mode      |                                     | Server-Side |  |
|  | In-Memory     |                                     | @google/    |  |
|  | Page Caches   |                                     | genai       |  |
|  +---------------+                                     +-------------+  |
+-------------------------------------------------------------------------+
```

- **Frontend**: Single-page application built with React 19, TypeScript, Tailwind CSS v4, Motion layout animations, and Lucide React icons.
- **Backend**: Express 4 REST API handling request validation, authentication, authorization, and telemetry metrics.
- **Database**: In-process SQLite database managed via Node.js native `DatabaseSync` (`node:sqlite`), configured with Write-Ahead Logging (`WAL`), in-memory caches, and covering indexes.
- **AI Integration**: Server-only Google Gemini API calls via `@google/genai`. API keys are never bundled or exposed to the client.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19, TypeScript, Vite 6 |
| **Styling & UI** | Tailwind CSS v4, Motion (`motion/react`), Lucide React |
| **Backend Runtime** | Node.js 22+, Express 4, TypeScript |
| **Database** | Node.js Native SQLite (`node:sqlite` DatabaseSync) |
| **AI / Machine Learning** | Google Gemini API (`@google/genai` SDK) |
| **Build & Bundling** | Vite 6 (Frontend), esbuild (Backend bundle) |
| **Testing Framework** | Node.js Test Runner (`node:test`, `node:assert/strict`), `tsx` |
| **Security & Crypto** | Node.js Native `crypto` (PBKDF2, `timingSafeEqual`, `randomBytes`) |

---

## Database Design & Schema

The relational schema is managed in SQLite with foreign key enforcement and Write-Ahead Logging:

```sql
-- Core Service Catalog
CREATE TABLE services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  tier TEXT CHECK(tier IN ('TIER-1', 'TIER-2', 'TIER-3')),
  status TEXT CHECK(status IN ('HEALTHY', 'DEGRADED', 'DOWN', 'MAINTENANCE')),
  uptime_percent REAL NOT NULL DEFAULT 100.0,
  latency_ms REAL NOT NULL DEFAULT 0.0,
  error_rate REAL NOT NULL DEFAULT 0.0,
  request_rate REAL NOT NULL DEFAULT 0.0,
  owner_team TEXT NOT NULL,
  dependencies_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Incidents & Lifecycle
CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  service_id TEXT NOT NULL REFERENCES services(id),
  severity TEXT CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  status TEXT CHECK(status IN ('OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED')),
  started_at TEXT NOT NULL,
  mitigated_at TEXT,
  resolved_at TEXT,
  assigned_engineer_id TEXT REFERENCES engineers(id),
  impact_summary TEXT,
  resolution_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Incident History & Audit Trail
CREATE TABLE incident_history (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL
);

-- Gemini AI RCA Diagnostics
CREATE TABLE incident_analyses (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  summary TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  confidence REAL NOT NULL,
  risk_factors_json TEXT NOT NULL,
  prevention_suggestions_json TEXT NOT NULL,
  runbook_commands_json TEXT NOT NULL,
  analyzed_by_user_id TEXT,
  analyzed_by_user_name TEXT
);

-- Users & Authentication
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT CHECK(role IN ('ADMIN', 'ENGINEER', 'VIEWER')),
  title TEXT NOT NULL,
  avatar TEXT,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT,
  is_demo INTEGER DEFAULT 0
);

-- Active User Sessions
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Structured Logs
CREATE TABLE logs (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id),
  timestamp TEXT NOT NULL,
  level TEXT CHECK(level IN ('INFO', 'WARN', 'ERROR', 'FATAL')),
  message TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  stack_trace TEXT,
  metadata_json TEXT
);

-- Platform Settings & Model Configuration
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Immutable Platform Audit Log
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  ip_address TEXT
);
```

### Database Indexes
To maintain sub-millisecond query performance at scale, the database defines covering and compound indexes:
- `idx_incidents_status_severity`: `(status, severity)`
- `idx_incidents_service`: `(service_id)`
- `idx_incidents_resolved`: `(status, resolved_at, started_at)`
- `idx_services_status_tier`: `(status, tier)`
- `idx_logs_service_level`: `(service_id, level)`
- `idx_logs_trace`: `(trace_id)`
- `idx_audit_logs_timestamp`: `(timestamp DESC)`
- `idx_sessions_user_expires`: `(user_id, expires_at)`

---

## REST API Reference

All protected endpoints require the HTTP header `Authorization: Bearer <session_token>`.

### Authentication
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticate operator with email and password |
| `POST` | `/api/auth/register` | Public | Register a new operator account |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current session profile and role |
| `POST` | `/api/auth/logout` | Authenticated | Invalidate active session token |

### Services
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/services` | Authenticated | List all services (supports `page`, `limit`, `search`, `status`, `tier`) |
| `GET` | `/api/services/:id` | Authenticated | Get detailed service record |
| `POST` | `/api/services` | `ADMIN` | Register a new service |
| `PUT` | `/api/services/:id` | `ADMIN` | Update service configuration |
| `PATCH` | `/api/services/:id/status` | `ADMIN`, `ENGINEER` | Update service status (`HEALTHY`, `DEGRADED`, `DOWN`, `MAINTENANCE`) |
| `GET` | `/api/services/:id/metrics` | Authenticated | Get historical latency, uptime, and request rate metrics |

### Incidents
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/incidents` | Authenticated | List incidents (supports `page`, `limit`, `search`, `status`, `severity`, `serviceId`) |
| `GET` | `/api/incidents/:id` | Authenticated | Get incident details |
| `POST` | `/api/incidents` | `ADMIN`, `ENGINEER` | Declare new incident (triggers auto-RCA if enabled) |
| `PATCH` | `/api/incidents/:id` | `ADMIN`, `ENGINEER` | Update incident metadata, description, or severity |
| `PATCH` | `/api/incidents/:id/status` | `ADMIN`, `ENGINEER` | Transition incident status (`OPEN` -> `INVESTIGATING` -> `MITIGATED` -> `RESOLVED` -> `CLOSED`) |
| `PATCH` | `/api/incidents/:id/assign` | `ADMIN`, `ENGINEER` | Assign or reassign incident to an engineer |
| `POST` | `/api/incidents/:id/resolve` | `ADMIN`, `ENGINEER` | Mark incident as resolved with root cause summary and resolution notes |
| `GET` | `/api/incidents/:id/history` | Authenticated | Retrieve timeline event history |
| `GET` | `/api/incidents/:id/analyses` | Authenticated | Retrieve past AI analyses for the incident |

### Gemini AI Root-Cause Analysis
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/ai/analyze-incident` | `ADMIN`, `ENGINEER` | Trigger Gemini AI root-cause analysis on an incident |
| `POST` | `/api/ai/analyze-logs` | `ADMIN`, `ENGINEER` | Trigger Gemini AI log pattern diagnosis and anomaly classification |

### Monitoring & Telemetry
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Standard container liveness probe |
| `GET` | `/api/health/live` | Public | Process memory and uptime probe |
| `GET` | `/api/health/ready` | Public | Database and AI readiness probe |
| `GET` | `/api/health/deep` | Public | Comprehensive health probe (DB read/write latency, schema tables, AI service status) |
| `GET` | `/api/telemetry` | Authenticated | Live API telemetry monitor (p50, p95, p99 latencies, RPS, error rate) |
| `GET` | `/api/metrics` | Authenticated | Platform-wide reliability aggregates (MTTR, MTTD, error budget burn) |
| `GET` | `/api/logs` | Authenticated | Query structured logs with level and service filters |
| `POST` | `/api/logs/simulate` | `ADMIN`, `ENGINEER` | Inject simulated log entry for testing |

### Engineers & Team
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/engineers` | Authenticated | List all engineers and duty statuses |
| `PATCH` | `/api/engineers/:id/status` | `ADMIN`, `ENGINEER` | Update engineer availability status (`AVAILABLE`, `ON_CALL`, `OFF_SHIFT`) |

### System & Audit
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/settings` | Authenticated | Get system settings |
| `PUT` | `/api/settings` | `ADMIN` | Update system settings and AI model selection |
| `GET` | `/api/audit-logs` | Authenticated | Query immutable audit logs (supports `page`, `limit`, `search`, `action`) |
| `POST` | `/api/seed/reset` | `ADMIN` | Reset database to initial seed dataset |

---

## Authentication & Role-Based Access Control (RBAC)

AegisAI implements industry-standard cryptographic authentication and Role-Based Access Control (RBAC):

### Cryptographic Implementation
- **Password Hashing**: PBKDF2 (Password-Based Key Derivation Function 2) with `sha512`, 100,000 iterations, and a unique 16-byte cryptographically random salt per user.
- **Timing Attack Resistance**: Hashes are compared using `crypto.timingSafeEqual` to eliminate timing vulnerability side-channels.
- **Session Tokens**: 256-bit cryptographically random tokens (`crypto.randomBytes(32).toString('hex')`) with configurable expiration (7 days) and automated background purging.

### Role Hierarchy
| Capability | ADMIN | ENGINEER | VIEWER |
|---|:---:|:---:|:---:|
| View Dashboards & Service Catalog | Yes | Yes | Yes |
| View Incident History & Audit Logs | Yes | Yes | Yes |
| Run AI RCA & Log Diagnostics | Yes | Yes | No |
| Declare & Update Incidents | Yes | Yes | No |
| Transition Incident Status & Assign Engineers | Yes | Yes | No |
| Simulate & Inject Test Logs | Yes | Yes | No |
| Register & Update Services in Catalog | Yes | No | No |
| Modify Platform & AI Model Settings | Yes | No | No |
| Reset Database to Seed State | Yes | No | No |

---

## Gemini AI Workflow & Integration

AegisAI leverages the `@google/genai` TypeScript SDK server-side to provide accurate, context-aware operational diagnostics:

```
+------------------+     +--------------------+     +-------------------+
|  Incident Event  | --> | Gather Context     | --> | Build Structured  |
|  or Manual Query |     | (Logs, Dependency, |     | System Prompt     |
+------------------+     |  Metrics, Service) |     +---------+---------+
                         +--------------------+               |
                                                              v
+------------------+     +--------------------+     +-------------------+
| Persist Analysis | <-- | Validate & Sanitize| <-- | Call Gemini Model |
| to SQLite & UI   |     | JSON Schema Output |     | (flash-3.8 / 2.5) |
+------------------+     +--------------------+     +-------------------+
```

1. **Context Aggregation**:
   The server compiles telemetry for the affected service, including recent `ERROR`/`FATAL` logs, stack traces, upstream/downstream dependency keys, and error rates.
2. **Structured Prompt Construction**:
   Prompts instruct the Gemini model to respond strictly with valid JSON conforming to an explicit schema specifying `summary`, `rootCause`, `confidenceScore`, `riskFactors`, `preventionSuggestions`, and `runbookCommands`.
3. **Resilience & Fallback Strategy**:
   - Primary model: `gemini-3.8-flash` (or model selected in platform settings).
   - Fallback model: `gemini-2.5-flash` if primary encounters rate limits or transient capacity constraints.
   - Exponential backoff with jitter on HTTP 429/503 responses.
   - Request timeout guards (60s) preventing thread exhaustion.
4. **Sanitization**:
   All error outputs and responses pass through `sanitizeErrorMessage()` to ensure no API keys, internal file paths, or authorization tokens are exposed in logs or user-facing responses.

---

## Monitoring & Health Checks

AegisAI includes multi-tier health and performance monitoring:

### Health Endpoints
- `GET /api/health`: Basic liveness check returning status code 200.
- `GET /api/health/live`: Node.js process health including uptime and memory usage (RSS, heap total, heap used).
- `GET /api/health/ready`: Readiness probe checking SQLite database connectivity and Gemini AI key presence.
- `GET /api/health/deep`: Comprehensive probe that:
  - Executes a test write and read query to measure database latency (ms).
  - Verifies presence of all 10 core database tables.
  - Reports SQLite WAL mode and page cache configuration.
  - Verifies Gemini AI SDK connectivity.

### Live Telemetry Monitor
The backend tracks in-flight and historical API metrics without external agents:
- Rolling window latency tracking calculating p50, p95, and p99 percentiles.
- Live Requests Per Second (RPS) and rolling error rate percentages.
- Active concurrent connection counters.

---

## Performance & Scalability

The platform is engineered for high throughput and low resource utilization:

- **SQLite WAL Mode**: Write-Ahead Logging allows concurrent readers without blocking writers.
- **In-Memory Page Cache**: Configured with 64MB memory page cache (`PRAGMA cache_size = -64000`) and in-memory temporary storage (`PRAGMA temp_store = MEMORY`).
- **Busy Timeout**: Configured with `PRAGMA busy_timeout = 5000` to eliminate database locked exceptions under burst traffic.
- **Single-Query Aggregations**: Dashboard metrics compute service counts, active incidents, and average MTTR in unified SQL queries rather than iterative row loops.
- **Server-Side Pagination**: `/api/services`, `/api/incidents`, `/api/incidents/:id/history`, and `/api/audit-logs` support offset pagination and server-side filtering.
- **Frontend Optimization**:
  - In-flight request deduplication prevents duplicate simultaneous `GET` requests.
  - Custom `useDebounce` hook prevents redundant filtering during search input.
  - Memoized filtering across incident, service, and log views.

---

## Testing & Quality Assurance

The codebase includes an extensive automated test suite run via the native Node.js test runner (`node:test`):

```bash
npm test
```

### Verified Test Suites (86 Automated Tests)
- `tests/auth.test.ts`: User registration, PBKDF2 authentication, session creation, token validation, and logout.
- `tests/services.test.ts`: Service catalog CRUD, status transitions, metric updates, and validation.
- `tests/incidents.test.ts`: Incident declaration, status workflow enforcement, engineer assignment, resolution, and timeline history.
- `tests/ai-analysis.test.ts`: Gemini AI RCA execution, structured output validation, and fallback mechanisms.
- `tests/monitoring.test.ts`: Telemetry monitoring, latency percentiles, and live request tracking.
- `tests/health.test.ts`: Standard, liveness, readiness, and deep diagnostic probe verification.
- `tests/validation.test.ts`: Input validation, SQL injection protection, and credential sanitization.
- `tests/error-handling.test.ts`: Malformed JSON handling, 404 routes, 401 unauthorized, and 403 forbidden responses.
- `tests/performance.test.ts`: Database pagination, server-side filtering, composite index utilization, and session cleanup.

---

## Environment Variables

Configure environment variables in a `.env` file or provide them via your container deployment environment / cloud secrets:

| Variable Name | Required | Default Value | Description |
|---|:---:|:---:|---|
| `DATABASE_URL` | **Yes** (in production) | *None* | PostgreSQL connection string (e.g. `postgresql://user:pass@host:5432/db?sslmode=require`) |
| `GEMINI_API_KEY` | **Yes** (for AI) | *None* | Google Gemini API key for AI root-cause analysis and log diagnostics |
| `APP_URL` | Optional | `http://localhost:3000` | Hosted application base URL |
| `PORT` | Optional | `3000` | Port for the Node.js Express server |
| `NODE_ENV` | Optional | `development` | Runtime environment (`production`, `development`, `test`) |
| `DATABASE_PATH` | Optional | `./data/aegisai.db` | File path to local SQLite database (used only in development when `DATABASE_URL` is omitted) |
| `DEMO_USER_PASSWORD`| Optional | `AegisSec2026!` | Initial password used when seeding default demo accounts |

*Refer to `.env.example` for a clean template containing placeholder variable definitions.*

---

## Local Setup Guide

### Prerequisites
- Node.js version 20.x or 22.x (LTS recommended)
- npm version 9+

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/aegis-ai.git
   cd aegis-ai
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env and supply your GEMINI_API_KEY from https://aistudio.google.com/
   # Supply DATABASE_URL for PostgreSQL or leave blank to use local SQLite in dev
   ```

4. **Run the test suite**:
   ```bash
   npm test
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

6. **Default Demo Credentials**:
   | Role | Email | Password |
   |---|---|---|
   | **ADMIN** | `admin@aegis.internal` | `AegisSec2026!` |
   | **ENGINEER** | `engineer@aegis.internal` | `AegisSec2026!` |
   | **VIEWER** | `viewer@aegis.internal` | `AegisSec2026!` |

---

## Deployment Instructions

### Production Build & Run

AegisAI compiles the frontend into static assets and bundles the Express backend into a self-contained CommonJS artifact:

1. **Build the application**:
   ```bash
   npm run build
   ```
   This executes:
   - `vite build`: Compiles React 19 SPA to `dist/`
   - `esbuild server.ts`: Bundles Express backend into `dist/server.cjs`

2. **Start the production server**:
   ```bash
   npm start
   ```
   The production server runs on port 3000 and serves both the API endpoints and the compiled frontend assets.

### Container & Cloud Run Deployment
The application is pre-configured for containerized platforms such as Google Cloud Run:
- The server binds to `0.0.0.0` on port `3000`.
- Health probes are accessible at `/api/health`.
- In production (`NODE_ENV=production`), `DATABASE_URL` is **strictly required** and connects to enterprise PostgreSQL with automatic schema migration and pooling.
- Ensure the `GEMINI_API_KEY` secret is injected into the container environment.
- SQLite fallback is strictly restricted to development environments and is blocked in production.

---

## Security Considerations

1. **No Client-Side Secrets**:
   The Gemini API key is strictly managed on the server side via `process.env.GEMINI_API_KEY`. It is never bundled into frontend assets or sent over the wire.
2. **Credential Sanitization & Injection Prevention**:
   Error handling middleware strips all API keys, authorization tokens, passwords, and server file paths using `sanitizeErrorMessage()` before logging or returning error responses.
3. **Database Security & Secrets Management**:
   `DATABASE_URL` is sourced exclusively from environment variables / secret managers. No database credentials are committed to Git or hardcoded in templates.
4. **Password Security**:
   Passwords are never stored in plaintext. They are salted with 16 random bytes and hashed using PBKDF2 with 100,000 iterations.
5. **Input Validation & RBAC**:
   All mutation endpoints validate request payloads against strict type, length, and enum constraints (`server/validation.ts`) to prevent malformed requests and unexpected data corruption. Strict RBAC middleware enforces ADMIN, ENGINEER, and VIEWER permissions.
6. **Git Hygiene**:
   `.gitignore` comprehensively excludes all `.env` files, database binaries (`data/`, `*.sqlite`, `*.db`), build artifacts (`dist/`, `build/`), logs, and editor caches.

---

## Known Limitations

- **Production Persistence**: In production (`NODE_ENV=production`), AegisAI enforces PostgreSQL for high availability, transactional consistency, and horizontal clustering. SQLite is restricted strictly to local developer sandboxes.
- **AI Connectivity**: Gemini root-cause analysis requires egress network access to Google AI APIs. If the API key is absent or network is unavailable, the application gracefully degrades with clear UI status indicators.

---

## Future Improvements

- [ ] OpenTelemetry OTLP receiver for ingesting traces and metrics directly from Kubernetes clusters.
- [ ] Real-time incident collaboration rooms powered by WebSockets / SSE.
- [ ] Webhook integrations for Slack, PagerDuty, and Opsgenie bi-directional alerts.
- [ ] Automated postmortem PDF generation and export.
- [ ] Single Sign-On (SSO) integration with SAML 2.0 and OpenID Connect (OIDC).
