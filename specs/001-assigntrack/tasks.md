# Tasks: AssignTrack

## Phase 1: Setup & Governance
- [x] T001 Establish `.specify/memory/constitution.md` and `metadata.json` / `index.html` branding
- [x] T002 Provision Firebase Auth + Firestore (`firebase-applet-config.json`) and install dependencies

## Phase 2: Security & Backend Infrastructure
- [x] T003 Create `firebase-blueprint.json`, `security_spec.md`, `firestore.rules.test.ts`, and hardened `firestore.rules`
- [x] T004 Lint (`@firebase/eslint-plugin-security-rules`) and deploy `firestore.rules`
- [x] T005 Implement Express server (`server.ts`) with `/api/files/upload`, `/api/files/:fileId` lock guard, and Vite middleware

## Phase 3: Core Tracking, Previews & Admin Operations
- [x] T006 Implement `src/types/domain.ts`, `src/lib/firebase.ts`, `src/lib/utils.ts`, `src/services/firestoreService.ts`
- [x] T007 Implement `PdfPreviewModal.tsx` (1-2p draft blur + Turnitin `scorePage+2` windowing) and `DeadlineBadge.tsx`
- [x] T008 Implement `PaymentQrCard.tsx`, `OrderChatPanel.tsx` (48h TTL), and `ClientPortalView.tsx`
- [x] T009 Implement `AdminPortalView.tsx`, `OrderWorkspaceModal.tsx`, `CalendarView.tsx`, `ClientsCrmView.tsx`, `RevenueDashboardView.tsx`, `BankSettingsView.tsx`
- [x] T010 Wire `src/App.tsx` and verify `npm run lint` + `npm run build`
