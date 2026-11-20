# 🏢 Corporate Office Store Management System

A cloud-native corporate office supply ordering and inventory tracking application built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Drizzle ORM**.

Designed for enterprise supply requisitions, manager budget enforcement, real-time inventory adjustments, and dynamic branding.

---

## 🚀 Key Features

- **Storefront Catalog & Cart**: Browse office supplies, check live stock levels, and place purchase requisitions.
- **Budget Tracking**: Real-time department budget meter with dynamic color zones (Green, Amber, Red).
- **Manager Approvals Portal**: Review, approve, or reject department purchase orders with mandatory feedback.
- **Admin Management Suite**:
  - Catalog inventory manager with quick stock adjustments and CSV bulk import.
  - Store configuration for auto-approval limits, company branding, logo uploads, and primary accent colors.
  - Immutable audit logs tracking all order and inventory mutations.
- **Edge Middleware Security**: RBAC protection for `EMPLOYEE`, `MANAGER`, and `ADMIN` personas + sliding-window rate limiting.
- **Zero-Dependency Mock Engine**: Built-in mock store allowing full application functionality without external databases.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: Next.js 15 (App Router, Server Components & Route Handlers)
- **Language**: TypeScript with strict typing
- **Styling**: Tailwind CSS with dark/light mode and custom brand accent palette
- **Data & ORM**: Drizzle ORM (Neon Serverless PostgreSQL) + in-memory mock engine
- **Caching & Reliability**: Upstash Redis (Idempotency locks, cache-aside, SLA timeout guards)
- **Validation**: Zod schema validation
- **Documentation**: See [ARCHITECTURE.md](file:///c:/Users/t&d/Desktop/Prince/Project1o/ARCHITECTURE.md) for layering, unidirectional data flows, and design standards.

---

## ⚙️ Quick Start & Local Setup

### 1. Prerequisites
- Node.js >= 20.9.0
- npm / pnpm / yarn

### 2. Installation
```bash
# Clone the repository
git clone <repo-url>
cd Project1o

# Install dependencies
npm install
```

### 3. Environment Configuration
Create a `.env.local` file in the root directory:

```env
# Database Mode ("true" for zero-dependency local development, "false" for live PostgreSQL)
MOCK_DATABASE="true"

# Live Database (Neon PostgreSQL) - required only if MOCK_DATABASE="false"
DATABASE_URL="postgres://user:password@host/database"

# Redis Cache & Idempotency (Upstash) - optional in mock mode
UPSTASH_REDIS_REST_URL="https://example.upstash.io"
UPSTASH_REDIS_REST_TOKEN="example_token"

# Cloudflare R2 / S3 Storage - optional in mock mode
R2_ACCOUNT_ID="account_id"
R2_ACCESS_KEY_ID="access_key"
R2_SECRET_ACCESS_KEY="secret_key"
R2_BUCKET_NAME="office-store-uploads"
```

### 4. Running Locally
```bash
# Start development server
npm run dev

# Open in browser: http://localhost:3000
```

---

## 🧪 Available Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Starts local Next.js development server at `http://localhost:3000` |
| `npm run build` | Compiles optimized production build |
| `npm run start` | Starts production server |
| `npm run lint` | Runs Next.js ESLint checks |
| `npm run test` | Runs Vitest automated test suite |
| `npm run db:push` | Pushes Drizzle ORM schema migrations to PostgreSQL |
| `npm run db:studio` | Opens Drizzle Studio visual database inspector |

---

## 👥 Demo Personas

When running with mock auth enabled, you can switch between three personas via the header dropdown:

1. **Alice Engineer (`EMPLOYEE`)**: Catalog browsing, cart management, placing requisitions, and viewing personal order history.
2. **Carol Manager (`MANAGER`)**: Department purchase order approval/rejection and budget oversight.
3. **Dave Admin (`ADMIN`)**: Full platform control, catalog editing, CSV imports, branding adjustments, and audit log inspection.
