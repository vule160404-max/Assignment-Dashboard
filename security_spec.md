# AssignTrack Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants
1. **Tiered RBAC Authority**:
   - **Owner / Admin**: Verified `vule160404@gmail.com` or an active `/users/{uid}` profile with `role in ['owner', 'admin'] && status == 'active'` may manage all `/orders`, `/clients`, `/settings`, `/teamInvites`, `/users`, and `/trackingPortals`.
   - **Staff / Collaborator**: Active `/users/{uid}` with `role == 'staff' && status == 'active'` may read and update ONLY orders assigned to them (`assignedStaffUid == request.auth.uid`), limited strictly to `['stage', 'progressPercent', 'publicStatusNote', 'internalNotes', 'attachments', 'updatedAt']` (cannot mutate pricing, paymentStatus, clientId, orderCode, or delete orders).
   - **Client Account**: Verified user with `role == 'client'` may manage only their own `displayName` and `savedOrderCodes` bookmark array (`<= 50` valid order codes) and cannot self-escalate `role` or `status`.
2. **Invitation-Backed Staff Onboarding**: Registering a `/users/{uid}` with `role in ['admin', 'staff']` requires an atomic batch accepting a `pending` `/teamInvites/{inviteCode}` whose `email` matches `request.auth.token.email.lower()` and `role` matches `incoming().role`.
3. **PII Isolation**: `/users/{uid}` and `/teamInvites/{inviteCode}` disallow blanket `list`/`get` by unrelated signed-in users.
4. **Order Code Isolation**: `/trackingPortals/{orderCode}` MUST forbid `list` queries (`allow list: if false`) and contain zero client/staff PII.
5. **Ephemeral 48h Chat & Revision Integrity**: Messages carry strict 48-hour TTL (`expiresAtMs == createdAtMs + 172800000`) and reference existing `trackingPortals/{orderCode}`.

## 2. "Dirty Dozen" Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Shadow Field Injection on Order**: Creating `/orders/ord1` with an extra key `isAdminOverride: true` -> Rejected by `keys().hasOnly(...)`.
2. **Unverified Admin Email Spoof**: Request with `email: 'vule160404@gmail.com'` and `email_verified: false` -> Rejected by `isAdmin()`.
3. **Client Self-Privilege Escalation on Registration**: Client registering `/users/{uid}` with `role: 'admin'` without a matching pending `teamInvites` record -> Rejected by invite verification.
4. **Self-Role Upgrade on Profile Update**: Existing `'client'` or `'staff'` updating `/users/{uid}` with `role: 'owner'` or `status: 'active'` -> Rejected by `incoming().role == existing().role && incoming().status == existing().status`.
5. **Uninvited User Accepting Another Person's Staff Invite**: User B (`other@gmail.com`) attempting to accept `/teamInvites/TEAM-123` addressed to `staff@gmail.com` -> Rejected by `existing().email == request.auth.token.email.lower()`.
6. **Staff Mutating Order Price / Payment**: Active staff updating `paidAmount` or `totalAmount` on an assigned order -> Rejected by `affectedKeys().hasOnly(['stage', 'progressPercent', 'publicStatusNote', 'internalNotes', 'attachments', 'updatedAt'])`.
7. **Staff Reading Unassigned Order or CRM Clients**: Staff user reading `/clients` or an order where `assignedStaffUid != request.auth.uid` -> Rejected by `isAdmin()` / `assignedStaffUid == request.auth.uid`.
8. **Path Poisoning**: Creating `/orders/` or `/users/` with a 500-char ID containing `/` or spaces -> Rejected by `isValidId()`.
9. **Chat TTL Bypass & Role Spoofing**: Client creating a message with `expiresAtMs = createdAtMs + 99999999999` or `senderRole: 'admin'` -> Rejected by `isValidOrderMessage()`.
10. **Unauthenticated Order Enumeration**: Unauthenticated `list` on `/trackingPortals` -> Rejected by `allow list: if false`.
11. **Pre-Resolved Revision Spoof**: Client creating a revision with `status: 'resolved'` -> Rejected by `status == 'open'`.
12. **PII List Scraping on Users**: Non-admin `list` on `/users` -> Rejected by `allow list: if isAdmin()`.
