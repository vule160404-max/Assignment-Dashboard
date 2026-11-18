# AI Writer Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the integrated AI Writer Studio tab in AssignTrack with order brief loading, reusable Skill file uploads, multi-provider AI chatbot API integration, step-by-step outline-to-section generation, an optimized Word-like formatting ribbon & A4 editor, and real OpenXML `.docx` export.

**Architecture:**
1. Add `/api/ai/generate` in `server/createApp.ts` to proxy Gemini, OpenAI, Anthropic Claude, and Custom OpenAI-compatible chat completions without browser CORS issues (plus client-side fallback in `src/lib/aiWriterClient.ts`).
2. Create `src/lib/docxBuilder.ts` using `JSZip` to build authentic OpenXML `.docx` files preserving font family, font size (pt), line spacing, text alignment, page margins, first-line indent, headings, lists, and inline bold/italic/underline formatting, plus parsing `.docx` skill uploads.
3. Build `src/components/admin/AiWriterStudioView.tsx` and modular subcomponents under `src/components/admin/writer/` (`WriterWordRibbon.tsx`, `WriterSkillLibraryModal.tsx`, `WriterApiSettingsModal.tsx`, `WriterPaperCanvas.tsx`) and wire them into `AdminPortalView.tsx` and `OrderWorkspaceModal.tsx`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Express, JSZip, Lucide React.

**Spec:** `docs/superpowers/specs/2026-11-18-ai-writer-studio-design.md`

## Global Constraints
- Must preserve existing `npm run lint` (`tsc --noEmit && eslint firestore.rules`) and `npm run build` (`vite build`) without errors.
- Support 4 AI Provider types: `gemini`, `openai`, `anthropic`, and `custom_openai`.
- Support 4 Academic formatting presets: `APA 7th`, `MLA 9th`, `Harvard`, `IEEE`, plus custom font, size, line spacing, alignment, margins, first-line indent, bold/italic/underline, headings, lists, find & replace, and undo/redo.

## Review Focus
- Malformed or markdown-fenced JSON returned by an LLM when generating an outline must be safely parsed into structured `WriterOutlineSection[]` without crashing.
- Empty or missing API key must return a clear Vietnamese error message before firing network requests.
- Special XML characters (`&`, `<`, `>`, `"`, `'`) in user/AI text must be escaped when building OpenXML `word/document.xml`.
- Uploading a `.docx` file as a Skill must extract readable plain text via `parseDocxFile` rather than binary garbage.
- Exporting a `.docx` from the studio must produce a valid zip archive accepted by `parseDocxFile` so it can be sent directly to `WordHumanizerView`.

---

### Task 1: Backend Multi-Provider AI Proxy (`/api/ai/generate`) & Client Service

**Files:**
- Modify: `server/createApp.ts`
- Create: `src/lib/aiWriterClient.ts`

**Interfaces:**
- Produces:
  - `POST /api/ai/generate` accepting `{ provider, apiKey, baseUrl?, model, systemPrompt, userPrompt, temperature? }` and returning `{ text: string, model: string }`
  - `AiProviderType = 'gemini' | 'openai' | 'anthropic' | 'custom_openai'`
  - `AiChatbotConfig`, `callAiChatbot(req)`, `generateOutlineWithAi(...)`, `generateSectionWithAi(...)`, `refineSelectionWithAi(...)`

- [ ] **Step 1: Add `/api/ai/generate` route in `server/createApp.ts`**
  Support `gemini` (Google Generative Language REST / `@google/genai`), `openai` & `custom_openai` (`/v1/chat/completions`), and `anthropic` (`https://api.anthropic.com/v1/messages`).
- [ ] **Step 2: Create `src/lib/aiWriterClient.ts`**
  Implement provider presets, localStorage persistence for API configurations (with built-in default Skills), prompt builders that inject active Skill files + Session context files + Rubric + Citation rules + previously drafted sections, and robust outline JSON parsing.
- [ ] **Step 3: Verify TypeScript compilation**
  Run: `npx tsc --noEmit`

---

### Task 2: True OpenXML `.docx` Formatted Builder & Skill File Parser (`src/lib/docxBuilder.ts`)

**Files:**
- Create: `src/lib/docxBuilder.ts`

**Interfaces:**
- Produces:
  - `DocumentFormatConfig` (`preset`, `fontFamily`, `fontSizePt`, `lineSpacing`, `textAlign`, `marginInch`, `firstLineIndent`, `paragraphSpacingAfterPt`, `runningHeader`, `includePageNumbers`)
  - `ACADEMIC_FORMAT_PRESETS` (`APA 7th`, `MLA 9th`, `Harvard`, `IEEE`)
  - `buildFormattedDocxFile(doc: WriterDocumentContent, format: DocumentFormatConfig, fileName: string): Promise<File>`
  - `extractTextFromSkillFile(file: File): Promise<string>`

- [ ] **Step 1: Implement `src/lib/docxBuilder.ts`**
  Generate a valid OpenXML `.docx` zip package (`[Content_Types].xml`, `_rels/.rels`, `word/_rels/document.xml.rels`, `word/styles.xml`, `word/document.xml`) with exact WordprocessingML properties:
  - `w:pgMar` calculated from `marginInch` (`1 inch = 1440 twips`)
  - `w:rFonts` (`w:ascii`, `w:hAnsi`, `w:cs`) from `fontFamily`
  - `w:sz` (`fontSizePt * 2` half-points)
  - `w:spacing` (`w:line = Math.round(lineSpacing * 240)`, `w:after = paragraphSpacingAfterPt * 20`)
  - `w:jc` (`left`, `center`, `right`, `both` for justify)
  - `w:ind` (`w:firstLine="720"` when `firstLineIndent` is true on body paragraphs)
  - Inline markdown/tag parsing for `**bold**`, `*italic*`, `__underline__`, headings (`#`, `##`, `###`), and bullet/numbered lists.
- [ ] **Step 2: Verify TypeScript compilation**
  Run: `npx tsc --noEmit`

---

### Task 3: Optimized Word Ribbon Toolbar, Skill Library, API Settings & A4 Studio View

**Files:**
- Create: `src/components/admin/writer/types.ts`
- Create: `src/components/admin/writer/WriterWordRibbon.tsx`
- Create: `src/components/admin/writer/WriterApiSettingsModal.tsx`
- Create: `src/components/admin/writer/WriterSkillLibraryModal.tsx`
- Create: `src/components/admin/AiWriterStudioView.tsx`
- Modify: `src/components/admin/AdminPortalView.tsx`
- Modify: `src/components/admin/OrderWorkspaceModal.tsx`

- [ ] **Step 1: Build `src/components/admin/writer/types.ts`**
  Define `WriterSession`, `WriterOutlineSection`, `SkillDocument`, and default academic skills (e.g. Academic Writing & Citation Guide, Critical Analysis & Rubric Alignment).
- [ ] **Step 2: Build `src/components/admin/writer/WriterWordRibbon.tsx`**
  Design an optimized Word-like two-tier ribbon toolbar containing:
  - Academic Presets (`APA 7th`, `MLA 9th`, `Harvard`, `IEEE`)
  - Font family selector, Font size (`10pt`–`16pt`), A+/A- quick resize
  - Bold (`Ctrl+B`), Italic (`Ctrl+I`), Underline (`Ctrl+U`), Clear Formatting
  - Block style selector (`Title`, `Heading 1`, `Heading 2`, `Heading 3`, `Body Paragraph`, `Reference Entry`)
  - Text Alignment (`Left`, `Center`, `Right`, `Justify`), Line spacing (`1.0`, `1.15`, `1.5`, `2.0`), First-line indent (`0.5"`), Page Margin (`1"`, `0.5"`, `1.25"`), Bullet list, Numbered list
  - Undo / Redo, Find & Replace toggle bar, Zoom (`80%`–`130%`), and Quick AI Selection Actions (`Viết lại đoạn chọn`, `Mở rộng ý`, `Thu gọn`, `Kiểm tra theo Rubric`).
- [ ] **Step 3: Build `WriterApiSettingsModal.tsx` & `WriterSkillLibraryModal.tsx`**
  - Multi-provider API configuration modal with quick model chips, custom Base URL, temperature slider, and "Kiểm tra kết nối (Test API)" button.
  - Global Skill Library + Session Context uploader supporting `.md`, `.txt`, `.docx`, `.json`, toggle switches, inline editor, and creating custom skills from text.
- [ ] **Step 4: Build `src/components/admin/AiWriterStudioView.tsx` & wire into `AdminPortalView.tsx` and `OrderWorkspaceModal.tsx`**
  - 3-zone studio layout (collapsible Brief & Skills panel, Outline & Step-by-Step Section AI Generator panel, and live A4 Paper Canvas with manual editing + inline section/full-paper mode).
  - Direct actions: Export formatted `.docx`, Attach `.docx` to Order (`draft`/`final`), or Send `.docx` directly into `WordHumanizerView`.
- [ ] **Step 5: Run full lint & production build verification**
  Run: `npm run lint && npm run build`
