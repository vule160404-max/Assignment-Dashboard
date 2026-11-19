---
name: assigntrack-handbook
description: >-
  Project operational handbook for AssignTrack. Activate BEFORE modifying any UI
  components, pricing/contact copy, branding/theme tokens, Client Portal views,
  AI Writer Studio, Plagiarism/AI Checker, Vercel API functions (`api/**/*.ts`),
  Cloudflare R2 storage routes, or Firebase/Firestore config and security rules.
---

# AssignTrack Project Runbook

Before proposing or implementing changes in this repository, read the complete living context handbook and constitution:

1. **Architecture, Business Rules, Palette & Pitfalls:** `docs/ASSIGNTRACK_CONTEXT.md`
2. **Non-Negotiable Security & Product Principles:** `.specify/memory/constitution.md`

## Standard Workflow for Every Task

### 1. Pre-Change Invariant Check
Verify your planned change respects these non-negotiable project constraints:
- **Brand Palette:** Only Deep Academic Navy (`#0B2559`), Royal Academic Blue (`#12489B`), and Scholar Gold (`#F5B700` / `#D97706`) with soft `blue-*` tints. Never reintroduce legacy purple/indigo (`#4338CA`, `indigo-*`). Preserve only the semantic `violet-*` AI mixed-sentence highlight in `ClientIntegrityCheckerView.tsx`.
- **Client Portal Constraints:** Single-screen desktop bento layout (`max-w-6xl`), 3-zone sticky header (no duplicate in-page tab bar), Zalo contact `https://zalo.me/0916045202`, and file-only upload/drag-drop/`Ctrl+V` input on the Integrity Checker with reference-only disclaimer.
- **Vercel ESM Rule:** Keep `api/ai/generate.ts` and `api/check/analyze.ts` 100% self-contained (zero extensionless relative imports like `../../server/...`).
- **Modal Portal Rule:** Always render `position: fixed` modals/overlays opened inside `.surface-enter` via `createPortal(..., document.body)`.
- **Database Target Lock:** Target ONLY Firestore project `gen-lang-client-0888688386`, database `ai-studio-39ecaf2f-943a-4559-8128-4524e07fb377` (`firebase.json` & `firebase-applet-config.json`). Never touch sibling databases.

### 2. Implementation & Rules Authoring
- If modifying `firestore.rules`, always delegate to the `firestore-rules-author` subagent.
- Keep `src/services/writerSyncService.ts` schema-aligned with `firestore.rules` when adding AI Writer synced fields.
- Never use `transition: all` / `transition-all` or `scale(0)` in CSS or Tailwind classes.

### 3. Mandatory Verification Gate
On Windows PowerShell 5.1 (use `;` instead of `&&`):
```powershell
npm run lint; npm run build
```
- `npm run lint` runs `tsc --noEmit && eslint firestore.rules`.
- `npm run build` runs `vite build`.
- Both must exit with code `0` before committing or reporting completion.

### 4. Living Documentation Sync & Deployment
- If pricing, Zalo contact links, Firestore collections, storage layout, or visual/brand rules changed, **update `docs/ASSIGNTRACK_CONTEXT.md` in the same commit**.
- If `firestore.rules` changed, deploy strictly to the AssignTrack database:
  ```powershell
  npx -y firebase-tools@latest deploy --only firestore:rules --project gen-lang-client-0888688386
  ```
- Push verified commits to `origin/main` so Vercel auto-deploys cleanly.
