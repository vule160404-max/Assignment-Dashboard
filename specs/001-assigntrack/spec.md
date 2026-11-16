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

### User Story 4 - Mini-CRM, Deadline Calendar & Revenue Analytics (Priority: P2)
Admin manages client profiles (Zalo number, school/major, New/VIP/Watchlist tiers, computed debt), monitors monthly deadline density in Calendar View, and tracks weekly/monthly collected revenue, receivables, and completion/cancellation rates.

## Functional Requirements
- **FR-001**: Admin Portal protected by Google Auth (`cycloneielts@gmail.com`) with full CRUD on `orders`, `clients`, `settings`.
- **FR-002**: Client Tracking Portal accessible via Order Code only (`trackingPortals/{orderCode}`), `allow list: if false`, zero client PII exposed.
- **FR-003**: Deadline countdown badge with color + label alerts (`>72h` Green, `24–72h` Amber, `<24h`/Overdue Crimson).
- **FR-004**: Hybrid attachment support (direct server file upload + external URL) with PDF.js page-windowed blur previews and server-enforced download locks.
- **FR-005**: 48-hour ephemeral chat (`expiresAtMs == createdAtMs + 172800000`) enforced in Firestore rules and client/admin sync.
