# AssignTrack Constitution

## Core Principles

### I. Security & Zero-PII Client Isolation (NON-NEGOTIABLE)
Admin and Staff operations (`orders`, `clients`, `settings`, `users`, `staffInvites`) MUST require verified Firebase Authentication (`email_verified === true`) with active team RBAC (`owner` / `admin` / `staff`, bootstrapped owner `vule160404@gmail.com`). Privileged CRM financials, bank/notification settings, payment-unlock actions, and internal Admin notes remain strictly restricted to `owner`/`admin`. Client access via Order Code MUST read only from a sanitized projection (`trackingPortals/{orderCode}`) with `allow list: if false` and zero client PII (no Zalo numbers, social links, school names, CTV payout data, or internal notes).

### II. Payment-Gated Deliverable Integrity (NON-NEGOTIABLE)
Payment-locked drafts and final files MUST enforce both UI preview truncation (pages 1–2 clear, pages 3+ blurred) and server-side download blocking until `paymentStatus === 'fully_paid'`, with lock toggles and locked-file deletion restricted to `owner`/`admin`. Turnitin/AI check reports MUST render only pages `1` through `scorePage + 2`.

### III. Spec-Driven Architecture & Real Persistence
All domain state (orders, clients, bank & notification settings, team RBAC & invites, 48-hour chat messages, revision requests) MUST persist to Cloud Firestore with structured error handling (`handleFirestoreError`), while binary files, QR images, and server notification preferences persist via the Express storage adapter (`/api/files/*`, `/api/notifications/*`) backed by Cloudflare R2 S3 (with local-disk fallback in dev).

### IV. Tabular & Operational Clarity (Notion/Linear Aesthetic)
Use `Plus Jakarta Sans` for headings, `DM Sans` for body copy, and `JetBrains Mono` (`tabular-nums`) for order codes, VND amounts, and deadline countdowns. Never use hue-only status indicators, nested cards-within-cards, or static pill-badge clutter. Respect `prefers-reduced-motion: reduce`.

### V. Ephemeral Client Communication & Automated Alerts
Client-Admin order chat messages MUST carry a strict 48-hour expiration (`expiresAt = createdAt + 48h`), automatically filtered from view and purged upon expiry, while formal revision requests remain auditable per order. Server-side Telegram Bot alerts MUST verify authentic Firestore event records and server-stored Admin notification preferences.

