# Feature Specification: AssignTrack — Academic Assignment Operations & Client Tracking Hub

**Feature Branch**: `001-assigntrack`
**Created**: 2026-11-16
**Status**: Implemented

## User Scenarios & Testing

### User Story 1 - Order Management & Real-Time Client Tracking (Priority: P1)
Admin creates an assignment order ticket (subject, topic, word count, citation style, outline, rubric, deadline, VND pricing, attachments) and shares an Order Code (`ASG-YYYY-XXX`) or direct link (`?code=ASG-YYYY-XXX`). Clients open the Client Tracking Portal using only the Order Code to verify brief details and watch progress (`10–100%`) and 6-stage pipeline updates in real time.

### User Story 2 - Payment-Locked Previews, Turnitin Windowing & Bank QR (Priority: P1)
Admin configures default Bank Account details + uploaded Bank QR image (with future-ready VietQR toggle). Clients see exact VND deposit/balance due and QR info. Draft/Final PDFs uploaded with Payment Lock allow viewing pages 1–2 clearly while blurring pages 3+ and blocking downloads until `fully_paid`. Turnitin/AI PDF reports display only pages `1` through `scorePage + 2`.

### User Story 3 - 48-Hour Live Order Chat & Revision Requests (Priority: P2)
Clients and Admin exchange messages directly inside the order's 48-hour live chat (messages auto-expire after 48 hours). Clients can also submit formal Revision Requests tracked on the Admin Dashboard.

### User Story 4 - Mini-CRM, Deadline Calendar, CTV Payouts & Revenue Analytics (Priority: P2)
Admin manages client profiles (Zalo number, school/major, New/VIP/Watchlist tiers, computed debt), monitors monthly deadline density in Calendar View, tracks CTV/Staff payouts (`staffPayoutAmount`, `staffPayoutStatus`), and analyzes weekly/monthly collected revenue, net margin, receivables, and completion/cancellation rates.

### User Story 5 - Team RBAC, Staff Invites, Zalo Templates, Telegram Bot & Word Humanizer (Priority: P2)
Owner/Admin invites Staff/CTV accounts via `staffInvites`, manages active/suspended team roles (`owner`/`admin`/`staff`/`client`), enforces verified email sign-in, generates 1-tap Zalo status/payment messages, receives Telegram Bot alerts for revisions/chats/deadlines, and runs the Word (.docx) Humanizer with HIX Bypass Chrome Extension automation (50+ word paragraph batching, CAPTCHA pause/resume, and in-place `.docx` rebuild/attachment).

## Functional Requirements
- **FR-001**: Team Portal protected by Firebase Auth (Email/Password + Google) with mandatory `email_verified == true` enforcement (`vule160404@gmail.com` Owner bootstrap + RBAC `owner`/`admin`/`staff`).
- **FR-002**: Client Tracking Portal accessible via Order Code only (`trackingPortals/{orderCode}`), `allow list: if false`, zero client PII exposed.
- **FR-003**: Deadline countdown badge with color + label alerts (`>72h` Green, `24–72h` Amber, `<24h`/Overdue Crimson).
- **FR-004**: Hybrid attachment support (Cloudflare R2 S3 + local-disk fallback, direct presigned/multer upload + external URL) with PDF.js page-windowed blur previews and server-enforced Admin-locked downloads.
- **FR-005**: 48-hour ephemeral chat (`expiresAtMs == createdAtMs + 172800000`) enforced in Firestore rules and client/admin sync.
- **FR-006**: Word `.docx` XML-preserving Humanizer + HIX Bypass Chrome Extension Bridge with automatic sentence-boundary chunking (`>=50` words/batch), CAPTCHA detection pause/resume, and instant order attachment.
- **FR-007**: Server-side Telegram Bot alerts (`telegramNotifyRevision`, `telegramNotifyMessage`, `telegramNotifyDeadline`) validated against authentic Firestore documents and persisted Admin notification preferences.

