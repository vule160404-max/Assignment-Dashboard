# AssignTrack Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants
1. **Admin Authority**: Only the verified Admin (`cycloneielts@gmail.com` with `email_verified == true`) or a user listed in `/admins/{uid}` may read, list, create, update, or delete `/orders`, `/clients`, `/settings`, and `/admins`, or mutate `/trackingPortals`.
2. **Order Code Isolation**: `/trackingPortals/{orderCode}` MUST forbid `list` queries (`allow list: if false`) and contain zero client PII (no `zaloNumber`, `socialLink`, `schoolMajor`, `tier`, or `internalNotes`).
3. **Ephemeral 48h Chat**: Messages under `/trackingPortals/{orderCode}/messages/{msgId}` MUST match the parent `orderCode`, carry a strict 48-hour expiration (`expiresAtMs == createdAtMs + 172800000`), and reference an existing `trackingPortals/{orderCode}`.
4. **Revision Integrity**: Client-created revisions under `/trackingPortals/{orderCode}/revisions/{reqId}` MUST initialize with `status == 'open'` and `adminReply == ''`, and reference an existing `trackingPortals/{orderCode}`.
5. **Immutable & Bounded Payloads**: Every string and array enforces explicit `.size()` bounds matching `firebase-blueprint.json`; shadow/unknown keys are rejected via `keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update.

## 2. "Dirty Dozen" Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Shadow Field Injection on Order**: Creating `/orders/ord1` with an extra key `isAdminOverride: true` -> Rejected by `keys().hasOnly(...)`.
2. **Unverified Admin Email Spoof**: Request with `email: 'cycloneielts@gmail.com'` and `email_verified: false` -> Rejected by `isAdmin()`.
3. **PII Scraping on Clients**: Unauthenticated or non-admin `get`/`list` on `/clients` -> Rejected by `isAdmin()`.
4. **Order Enumeration**: Unauthenticated `list` on `/trackingPortals` -> Rejected by `allow list: if false`.
5. **Path Poisoning**: Creating `/orders/` with a 500-char ID containing `/` or spaces -> Rejected by `isValidId()`.
6. **Client Modifying Progress Stage**: Unauthenticated `update` on `/trackingPortals/ASG-2026-001` changing `paymentStatus: 'fully_paid'` -> Rejected by `allow update: if isAdmin()`.
7. **Chat TTL Bypass**: Client creating a message with `expiresAtMs = createdAtMs + 99999999999` -> Rejected by `expiresAtMs == createdAtMs + 172800000`.
8. **Chat Role Spoofing**: Unauthenticated client creating a message with `senderRole: 'admin'` -> Rejected by `senderRole == 'client'`.
9. **Orphaned Chat Message**: Client creating a message under `/trackingPortals/NON-EXISTENT/messages/m1` -> Rejected by `exists(.../trackingPortals/NON-EXISTENT)`.
10. **Pre-Resolved Revision Spoof**: Client creating a revision with `status: 'resolved'` -> Rejected by `status == 'open'`.
11. **Denial-of-Wallet Oversized Body**: Client creating a chat message with a 50KB `body` -> Rejected by `body.size() <= 1000`.
12. **Settings Tampering**: Non-admin updating `/settings/bankConfig` `accountNumber` -> Rejected by `isAdmin()`.
