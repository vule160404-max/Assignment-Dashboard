# AssignTrack Constitution

## Core Principles

### I. Security & Zero-PII Client Isolation (NON-NEGOTIABLE)
Admin operations (`orders`, `clients`, `settings`) MUST be strictly restricted to verified Admin authentication (`cycloneielts@gmail.com`). Client access via Order Code MUST read only from a sanitized projection (`trackingPortals/{orderCode}`) with `allow list: if false` and zero client PII (no Zalo numbers, social links, school names, or CRM tiers).

### II. Payment-Gated Deliverable Integrity (NON-NEGOTIABLE)
Payment-locked drafts and final files MUST enforce both UI preview truncation (pages 1–2 clear, pages 3+ blurred) and server-side download blocking until `paymentStatus === 'fully_paid'`. Turnitin/AI check reports MUST render only pages `1` through `scorePage + 2`.

### III. Spec-Driven Architecture & Real Persistence
All domain state (orders, clients, bank settings, 48-hour chat messages, revision requests) MUST persist to Cloud Firestore with structured error handling (`handleFirestoreError`), while binary files and QR images persist via the Express storage adapter (`/api/files/*`) with optional Cloudflare R2 S3 hooks.

### IV. Tabular & Operational Clarity (Notion/Linear Aesthetic)
Use `Plus Jakarta Sans` for headings, `DM Sans` for body copy, and `JetBrains Mono` (`tabular-nums`) for order codes, VND amounts, and deadline countdowns. Never use hue-only status indicators, nested cards-within-cards, or static pill-badge clutter.

### V. Ephemeral Client Communication Governance
Client-Admin order chat messages MUST carry a strict 48-hour expiration (`expiresAt = createdAt + 48h`), automatically filtered from view and purged upon expiry, while formal revision requests remain auditable per order.
