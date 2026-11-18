# AI Writer Studio — Design Specification

**Date:** 2026-11-18
**Status:** Approved

## 1. Intent & Why
Build an integrated **AI Writer Studio** directly inside the AssignTrack Admin Portal so the user can conduct academic research, structure outlines, and draft/edit full papers in one place. It connects order briefs/rubrics, reusable uploaded Skill files, multi-provider AI chatbot APIs, step-by-step outline-driven generation, and an optimized Word-like A4 formatting & editing workspace that exports real formatted `.docx` files.

## 2. Goals & Non-Goals
- **Goals:**
  - Load assignment briefs (`subject`, `topic`, `wordCount`, `citationStyle`, `outlineAndInstructions`, `rubricNotes`) directly from any AssignTrack order (`ASG-YYYY-XXX`) or create standalone research sessions.
  - Provide a **Multi-Provider AI Chatbot Settings** manager supporting Google Gemini, OpenAI, Anthropic Claude, and Custom OpenAI-compatible endpoints (`baseUrl`, `apiKey`, `model`, `temperature`) with server-side proxy (`/api/ai/generate`) + client fallback.
  - Provide a **Global Skill Library** (upload `.md`, `.txt`, `.docx`, `.json`, toggle active skills, inspect/edit skill content, persist in localStorage) plus **Per-Session Context Files**.
  - Support **Step-by-Step Outline -> Section Generation**: AI generates or user customizes a structured outline (section title, heading level, target words, key instructions), then generates individual sections or runs all sections sequentially with cross-section continuity and citation adherence.
  - Provide an **Optimized Word-Style Ribbon Toolbar & A4 Document Canvas**:
    - Academic style presets (`APA 7th`, `MLA 9th`, `Harvard`, `IEEE`)
    - Font family (`Times New Roman`, `Arial`, `Calibri`, `Georgia`, `Cambria`) & Font size (`10pt`–`16pt`)
    - Line spacing (`1.0`, `1.15`, `1.5`, `2.0`) & Paragraph spacing after
    - Alignment (`Left`, `Center`, `Right`, `Justify`) & First-line indent (`0.5"`)
    - Page margins (`Normal 1"`, `Narrow 0.5"`, `Wide 1.25"`)
    - Core Word inline/block tools: Undo/Redo, Bold, Italic, Underline, Heading styles (`Title`, `H1`, `H2`, `H3`, `Body`), Bullet list, Numbered list, Find & Replace, Clear Formatting, Page Break / Section actions, and AI section actions (Rewrite, Expand, Shorten, Rubric Check).
  - Export real OpenXML `.docx` preserving font, size, line spacing, alignment, margins, indent, bold/italic/underline, headings, and lists; attach directly to an AssignTrack order or send straight to the Word Humanizer tab.
- **Non-Goals:**
  - Complex spreadsheet tables or floating image wrapping inside the Word canvas.

## 3. Approaches Considered
1. **Backend AI Proxy (`/api/ai/generate`) + True OpenXML `.docx` Builder (Selected):** Avoids browser CORS blocks on Anthropic/Custom endpoints and produces authentic `.docx` styling via `JSZip` OpenXML generation.
2. **Client-Only Fetch + Plain Text `.docx`:** Simpler but fails on CORS-restricted providers and loses Word formatting metrics on export.
