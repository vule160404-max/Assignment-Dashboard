# Project Agent Instructions — Spec Kit (Spec-Driven Development)

This project follows **GitHub Spec Kit** (`github/spec-kit`) Spec-Driven Development (SDD) and Idea Assessment workflows. All feature work, planning, and implementation must adhere to this instruction set.

---

## 1. Core Philosophy & Ground Rules

1. **Intent Before Implementation**: Always separate **WHAT** users need and **WHY** (`spec.md`) from **HOW** it is built (`plan.md`, code). Never jump straight to coding before a specification is agreed upon (unless explicitly asked for a quick hotfix via the bug-fix track).
2. **Constitution Authority**: Project principles stored in `.specify/memory/constitution.md` are **non-negotiable**. Every plan, task breakdown, analysis, and convergence check MUST pass the Constitution Check gate.
3. **Templates & Artifacts**: Use the canonical templates in `.specify/templates/` when generating artifacts. Never omit mandatory sections; remove inapplicable optional sections rather than leaving `"N/A"`.
4. **Controlled Clarification**: Never flood the user with open-ended questions. Limit `[NEEDS CLARIFICATION: ...]` markers to **at most 3 critical items** (prioritized by: `scope > security/privacy > user experience > technical details`), making reasonable, documented assumptions for everything else.
5. **Independent MVP Slices**: User stories in `spec.md` and tasks in `tasks.md` MUST be organized by priority (`P1`, `P2`, `P3`, ...) so each story is independently implementable, testable, and deliverable as an MVP increment.

---

## 2. Directory & Artifact Layout

```text
.specify/
├── memory/
│   └── constitution.md          # Project-wide non-negotiable engineering & UX principles
├── templates/                   # Canonical Spec Kit templates
│   ├── constitution-template.md
│   ├── spec-template.md
│   ├── plan-template.md
│   ├── tasks-template.md
│   └── checklist-template.md
├── assessments/<slug>/          # (Optional) Pre-SDD Idea Assessment artifacts
│   ├── intake.md
│   ├── research.md
│   ├── problem.md
│   ├── concept.md
│   └── decision.md
└── bugs/<slug>/                 # (Optional) Bug-fix assessment & verification artifacts

specs/<###-feature-name>/
├── spec.md                      # Functional spec (WHAT & WHY — tech-agnostic)
├── plan.md                      # Technical plan (HOW — stack, architecture, gates)
├── research.md                  # Phase 0 resolution of technical unknowns
├── data-model.md                # Entities, fields, relationships, validation, state
├── quickstart.md                # Runnable end-to-end validation scenarios
├── contracts/                   # API / UI / interface contracts
├── checklists/                  # Requirements-quality checklists (NOT QA test plans)
└── tasks.md                     # Dependency-ordered, story-grouped execution tasks
```

---

## 3. Available Workflows & Commands

The user can invoke any phase using `/speckit-*` commands (or natural-language equivalents):

### Track A: Idea Assessment (Optional Pre-SDD Discovery)
Use when an idea should be challenged, researched, and shaped before committing to build:
1. `/speckit-assess-intake` — Capture and normalize the raw idea into `intake.md`.
2. `/speckit-assess-research` — Gather supporting evidence AND explicit *Evidence Against the Idea* (`ASSUMPTION` tags for unsourced claims) into `research.md`.
3. `/speckit-assess-define` — Define target users, problem statement, goals, non-goals, success metrics, and cost of inaction into `problem.md`.
4. `/speckit-assess-shape` — Shape 2–3 concept options with appetite and trade-offs into `concept.md`.
5. `/speckit-assess-decide` — Render a verdict (`go`, `needs-clarification`, or `kill`) in `decision.md`. Only `go` ideas hand off to `/speckit-specify`. (Never write source code during assessment.)

### Track B: Spec-Driven Development (Core Delivery Pipeline)

- **Shorter Path** (small/focused features): `specify` → `plan` → `tasks` → `implement` → `converge`
- **Full Path** (production features with quality gates):
  1. `/speckit-constitution` — *(Once per project)* Establish non-negotiable engineering, security, UX, and quality principles in `.specify/memory/constitution.md`.
  2. `/speckit-specify` — Create `specs/<###-feature>/spec.md` from the user's idea.
     - Focus strictly on user journeys (`US1` P1, `US2` P2...), edge cases, Functional Requirements (`FR-###`), Key Entities, tech-agnostic measurable Success Criteria (`SC-###`), and Assumptions.
     - Validate against a built-in spec-quality checklist (`checklists/requirements.md`).
  3. `/speckit-clarify` — Surface remaining ambiguities via targeted multiple-choice/short questions (max 3–5 per pass) and fold answers directly into `spec.md`.
  4. `/speckit-plan` — Create `plan.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`.
     - Populate Technical Context (React/Vite/TypeScript/Tailwind/Express or stack chosen), run **Constitution Check** (gate), resolve all unknowns, and re-check Constitution post-design.
  5. `/speckit-checklist` — *(Optional gate)* Generate domain-specific requirements-quality checklists (e.g. `ux.md`, `security.md`, `api.md`) that test whether requirements are clear, complete, and measurable — **never** implementation tests.
  6. `/speckit-tasks` — Generate `tasks.md` organized strictly by phase:
     - Phase 1: Setup (shared infrastructure)
     - Phase 2: Foundational (blocking prerequisites before any user story)
     - Phase 3+: One phase per User Story (`US1` MVP, `US2`, `US3`...) with `[P]` parallel markers and exact file paths
     - Final Phase: Polish & cross-cutting concerns
  7. `/speckit-analyze` — *(Strictly read-only)* Cross-check `spec.md`, `plan.md`, `tasks.md`, and `constitution.md` for inconsistencies, gaps, duplications, or constitution conflicts before coding.
  8. `/speckit-implement` — Check checklist gates, then execute `tasks.md` phase-by-phase, marking completed tasks `- [x]` and validating each User Story checkpoint independently.
  9. `/speckit-converge` — Audit actual implemented code against `spec.md`, `plan.md`, `tasks.md`, and `constitution.md`. Classify gaps as `missing`, `partial`, `contradicts`, or `unrequested` (graded CRITICAL/HIGH/MEDIUM/LOW). Append corrective tasks to a new `## Phase N: Convergence` section in `tasks.md` and repeat `implement` → `converge` until **Converged**.

### Track C: Bug Fixing (Standalone)
- `/speckit-bug-assess` → `/speckit-bug-fix` → `/speckit-bug-test` (artifacts in `.specify/bugs/<slug>/`; final verdict must be `verified`).

---

## 4. Runtime & Stack Context (This Workspace)

- **Stack**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Express (`server.ts` when backend routes are needed), running on port `3000`.
- **Verification**: All code changes must pass `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`) without errors before reporting completion or convergence.

---

## 5. Code Review Workflow — Open Code Review (`alibaba/open-code-review`)

- **Skills Installed**: `.agents/skills/open-code-review/SKILL.md` and `.agents/skills/open-code-review-delegate/SKILL.md`
- **Project Rules**: `.opencodereview/rule.json` (merged with built-in OCR language rules)
- **Usage**: Run `ocr delegate preview --format json` and `ocr delegate rule --format json <files...>` to scope reviewable files and rules, inspect each file individually, classify findings by severity (`critical`, `high`, `medium`, `low`), filter out false positives, and report coverage (`total_files`, `reviewed_files`, `skipped_files`, `coverage_rate`).

---

## 6. Design Engineering & Motion Workflow (`emilkowalski/skills`)

- **Skills Installed**: `.agents/skills/emilkowalski/` (`emil-design-eng`, `animate`, `choreograph`, `apple-design`, `learn-taste`, `ui-cheatsheet.md`, `performance-cheatsheet.md`).
- **Core Rules**: Use `--ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`) under `300ms` for UI; never use `transition: all`, `ease-in`, or `scale(0)`; animate only `transform` and `opacity` (plus `clip-path` or `<20px` blur); gate hover effects with `@media (hover: hover) and (pointer: fine)`; provide `btn-press` tactile feedback (`scale(0.97)`); support `prefers-reduced-motion: reduce`.

---

## 7. AssignTrack Project Context & Non-Negotiable Guardrails

- **Full Context Handbook**: Always read `docs/ASSIGNTRACK_CONTEXT.md` and `.specify/memory/constitution.md` (and activate `.agents/skills/assigntrack-handbook/SKILL.md` when working on product features, UI, APIs, or deploys).
- **1. Firebase Database Lock**: Target ONLY Firebase project `gen-lang-client-0888688386`, database **`ai-studio-39ecaf2f-943a-4559-8128-4524e07fb377`** (`firebase.json`, `firebase-applet-config.json`). NEVER write or deploy rules to sibling databases (`ai-studio-nordicsound-...`). Modify `firestore.rules` only via `firestore-rules-author` and deploy with `npx -y firebase-tools@latest deploy --only firestore:rules --project gen-lang-client-0888688386`.
- **2. Vercel ESM Serverless Self-Containment**: `package.json` sets `"type": "module"`. `api/ai/generate.ts` and `api/check/analyze.ts` MUST stay self-contained without extensionless relative imports from `../../server/...` (which cause HTTP 500 `ERR_MODULE_NOT_FOUND` on Vercel).
- **3. Modal Portal Rule**: `.surface-enter` sets `transform: translateY(0)`, trapping `position: fixed` elements. Fixed modals/overlays opened inside `.surface-enter` MUST use `createPortal(..., document.body)`.
- **4. Brand Palette & Logo System**: Harmonize all UI with `public/assets/assigntrack-logo.png`: Deep Academic Navy (`#0B2559`), Royal Blue (`#12489B`), Scholar Gold (`#F5B700` / `#D97706`), and `blue-*` tints. Never reintroduce legacy purple/indigo (`#4338CA`, `indigo-*`). Preserve only the semantic `violet-*` AI mixed-sentence highlight classes in `ClientIntegrityCheckerView.tsx`.
- **5. Client Portal Auth, Intent Hub, Pricing & UX Rules**: Mandatory Client login (`!user` sees only the Email/Password Auth Gate; `trackingPortals`, `messages`, `revisions` require `isSignedIn()` in `firestore.rules` — never `isVerifiedEmail()` for clients). Signed-in clients land on `"Bạn muốn làm gì?"` (`ClientIntentHubView.tsx`: Consult Thesis/Report → Zalo `0916045202` `299K`; Check Order Progress → `lookup` tab; Reduce Plagiarism/AI → Zalo `0916045202`; plus `Free` Turnitin/AI Checker). Compact 1-screen desktop layout; 3-zone header (`Trang chủ`, `Tra cứu tiến độ`, `Check Đạo văn & AI`); Integrity Checker accepts files only (drag-drop / click / paste `.docx`/`.txt`/`.md`, no manual text box/sample button) with prominent reference-only disclaimer and non-Turnitin Zalo link.
- **6. Verification & Living Doc Discipline**: On Windows PowerShell 5.1 (use `;` instead of `&&`), verify `npm run lint; npm run build` (`tsc --noEmit && eslint firestore.rules` + `vite build`) before every commit/push, and update `docs/ASSIGNTRACK_CONTEXT.md` in the same commit whenever business rules, pricing, contacts, collections, or architectural invariants change.



