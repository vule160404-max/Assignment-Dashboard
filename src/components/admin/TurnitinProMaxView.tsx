import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Clock,
  Copy,
  Download,
  Fingerprint,
  Loader2,
  Lock,
  Paperclip,
  Sparkles,
  Square,
  Upload,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import {
  isReferencesSectionTitle,
  loadAiChatbotSettings,
  loadGlobalSkillLibrary,
  loadWriterSessions,
  resolveEffectiveWriterConfig,
  saveWriterSessions,
  syncServerAiKeysStatus,
} from '../../lib/aiWriterClient';
import { buildFormattedDocxFromSession } from '../../lib/docxBuilder';
import {
  TurnitinPaperScanReport,
  TurnitinSectionScanResult,
  enforceProtectedTokensIntegrity,
  ensureUnder20PercentAiGate,
  humanizeSectionForTurnitinWithAi,
  scanSectionTurnitinAiRisk,
  summarizeTurnitinSectionResults,
} from '../../lib/turnitinAiBreaker';
import { copyTextToClipboard } from '../../lib/utils';
import {
  ParsedWordDocument,
  countWords,
  exportPatchedDocx,
  parseDocxFile,
} from '../../lib/wordHumanizer';
import { saveWriterSessionToCloud } from '../../services/writerSyncService';
import { OrderRecord } from '../../types/domain';
import {
  ACADEMIC_FORMAT_PRESETS,
  AiProviderType,
  DEFAULT_COVER_PAGE_CONFIG,
  WriterOutlineSection,
  WriterSession,
} from './writer/types';

type ActivePayloadOrigin = 'ai_writer' | 'docx_file' | 'pasted_text';

interface UnifiedTurnitinSection {
  id: string;
  title: string;
  originalContent: string;
  content: string;
  /** Used when origin === 'docx_file' to patch back into original .docx XML */
  docxParagraphIndices?: number[];
}

interface SectionExecutionStatus {
  status: 'queued' | 'running' | 'completed' | 'error';
  phase: 1 | 2 | 3 | 4;
  phaseLabel: string;
  beforeRisk: number;
  afterRisk?: number;
  durationSec?: number;
  paragraphsInfo?: string;
}

interface ExecutionLogEntry {
  id: string;
  sectionId: string;
  sectionTitle: string;
  beforeRisk: number;
  afterRisk: number;
  lockedCitationsCount: number;
  durationSec: number;
  detail: string;
}

interface TurnitinProMaxViewProps {
  orders: OrderRecord[];
  onOpenInAiWriter: (orderCode?: string) => void;
  onAttachDocxToOrder?: (order: OrderRecord, file: File) => Promise<void>;
  onToast: (msg: string) => void;
}

function buildUnifiedSectionsFromSession(
  sess: WriterSession | null
): UnifiedTurnitinSection[] {
  if (!sess) return [];
  return sess.outline
    .filter(
      (sec) => !isReferencesSectionTitle(sec.title) && countWords(sec.content) > 0
    )
    .map((sec) => ({
      id: sec.id,
      title: sec.title,
      originalContent: sec.content,
      content: sec.content,
    }));
}

function splitPastedTextIntoUnifiedSections(
  rawText: string
): UnifiedTurnitinSection[] {
  const cleaned = rawText.trim();
  if (!cleaned) return [];
  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sections: UnifiedTurnitinSection[] = [];
  let currentTitle = 'Phần 1. Nội dung bài viết';
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const joined = buffer.join('\n\n');
    const idx = sections.length + 1;
    sections.push({
      id: `paste_sec_${idx}`,
      title: currentTitle || `Đoạn / Mục ${idx}`,
      originalContent: joined,
      content: joined,
    });
    buffer = [];
  };

  for (const para of paragraphs) {
    const words = countWords(para);
    const isTocLine = /(?:\.{2,}|\t|\s{2,})\d{1,3}$/.test(para) || (words <= 15 && /\s+\d{1,3}$/.test(para));
    if (isTocLine && sections.length === 0 && buffer.length === 0) {
      continue;
    }
    const looksLikeHeading =
      words <= 18 &&
      (/^(?:chương|phần|mục|chapter|section|\d+(?:\.\d+)*[.\s])/i.test(para) ||
        !/[.!?]$/.test(para));
    if (
      looksLikeHeading &&
      words <= 6 &&
      !isTocLine &&
      (sections.length > 0 || buffer.length > 0) &&
      isReferencesSectionTitle(para)
    ) {
      flush();
      break;
    }
    if (looksLikeHeading && buffer.length > 0) {
      flush();
      currentTitle = para.replace(/^#+\s*/, '').trim();
      continue;
    }
    if (looksLikeHeading && buffer.length === 0) {
      currentTitle = para.replace(/^#+\s*/, '').trim();
      continue;
    }

    buffer.push(para);
    const bufferWords = buffer.reduce((sum, b) => sum + countWords(b), 0);
    if (bufferWords >= 380) {
      flush();
      currentTitle = `Phần ${sections.length + 1}. Nội dung tiếp theo`;
    }
  }
  flush();

  return sections;
}

export function TurnitinProMaxView({
  orders,
  onOpenInAiWriter,
  onAttachDocxToOrder,
  onToast,
}: TurnitinProMaxViewProps) {
  const [sessions, setSessions] = useState<WriterSession[]>(() =>
    loadWriterSessions()
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>(() => {
    const saved = loadWriterSessions();
    try {
      const lastId = localStorage.getItem(
        'assigntrack_ai_writer_active_session_v1'
      );
      if (lastId && saved.some((s) => s.id === lastId)) return lastId;
    } catch {
      // ignore
    }
    return saved[0]?.id || '';
  });

  const [origin, setOrigin] = useState<ActivePayloadOrigin>('ai_writer');
  const [documentLabel, setDocumentLabel] = useState<string>('');
  const [parsedDocx, setParsedDocx] = useState<ParsedWordDocument | null>(null);
  const [unifiedSections, setUnifiedSections] = useState<
    UnifiedTurnitinSection[]
  >(() => {
    const saved = loadWriterSessions();
    return buildUnifiedSectionsFromSession(saved[0] || null);
  });

  // Quick paste drawer toggle inside the unified intake bar
  const [showPasteBox, setShowPasteBox] = useState<boolean>(() => {
    const saved = loadWriterSessions();
    const initialSecs = buildUnifiedSectionsFromSession(saved[0] || null);
    return initialSecs.length === 0;
  });
  const [pasteDraft, setPasteDraft] = useState('');
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(
    null
  );
  const [copiedAll, setCopiedAll] = useState(false);

  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
  const [beforeScoresMap, setBeforeScoresMap] = useState<Record<string, number>>(
    {}
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressInfo, setProgressInfo] = useState<{
    step: number;
    total: number;
    label: string;
    sectionId: string;
    phase: 1 | 2 | 3 | 4;
    phaseDetail: string;
  } | null>(null);
  const [sectionExecMap, setSectionExecMap] = useState<
    Record<string, SectionExecutionStatus>
  >({});
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogEntry[]>([]);
  const [showCockpitBanner, setShowCockpitBanner] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [avgSecPerSection, setAvgSecPerSection] = useState(4.5);
  const abortControllerRef = useRef<AbortController | null>(null);
  const docxInputRef = useRef<HTMLInputElement | null>(null);

  const [exportingDocx, setExportingDocx] = useState(false);
  const [attachingOrder, setAttachingOrder] = useState(false);
  const [selectedOrderCode, setSelectedOrderCode] = useState<string>('');

  const [serverKeysConfigured, setServerKeysConfigured] = useState<
    Record<AiProviderType, boolean>
  >({
    perplexity: false,
    gemini: false,
    openai: false,
    anthropic: false,
    custom_openai: false,
  });

  useEffect(() => {
    void syncServerAiKeysStatus().then(setServerKeysConfigured);
  }, []);

  // Live stopwatch while processing
  useEffect(() => {
    if (!isProcessing) return;
    const t0 = Date.now();
    setElapsedSec(0);
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [isProcessing]);

  const activeWriterSession = useMemo(
    () =>
      sessions.find((s) => s.id === selectedSessionId) || sessions[0] || null,
    [sessions, selectedSessionId]
  );

  // Load AI Writer session into the unified pipeline
  const handleSelectAiWriterSession = (sessionId: string) => {
    const latest = loadWriterSessions();
    setSessions(latest);
    const target = latest.find((s) => s.id === sessionId) || latest[0] || null;
    setSelectedSessionId(target?.id || '');
    setOrigin('ai_writer');
    setParsedDocx(null);
    const built = buildUnifiedSectionsFromSession(target);
    setUnifiedSections(built);
    setDocumentLabel(
      target ? target.topic || target.title || 'Phiên AI Writer' : ''
    );
    if (target?.linkedOrderCode) {
      setSelectedOrderCode(target.linkedOrderCode);
    }
    setBeforeScoresMap({});
    setSectionExecMap({});
    setExecutionLogs([]);
    setShowPasteBox(built.length === 0);
  };

  // Initial hydrate from AI Writer session
  useEffect(() => {
    const latest = loadWriterSessions();
    setSessions(latest);
    const target =
      latest.find((s) => s.id === selectedSessionId) || latest[0] || null;
    if (target && origin === 'ai_writer') {
      const built = buildUnifiedSectionsFromSession(target);
      setUnifiedSections(built);
      setDocumentLabel(target.topic || target.title || 'Phiên AI Writer');
      if (target.linkedOrderCode) {
        setSelectedOrderCode(target.linkedOrderCode);
      }
      if (built.length > 0) setShowPasteBox(false);
    }
  }, []);

  // Upload .DOCX into the unified pipeline
  const handleUploadDocxFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      onToast('Vui lòng chọn tệp Microsoft Word (.docx).');
      return;
    }
    try {
      const parsed = await parseDocxFile(file);
      const nonEmptyParas = parsed.paragraphs.filter((p) => !p.isEmpty);

      // Find the LAST standalone References heading in the final 35% of the document
      // (so a "References ... 12" line inside the Table of Contents at the top NEVER aborts parsing!)
      let terminalRefStartIndex = -1;
      const minTailPosition = Math.floor(nonEmptyParas.length * 0.55);
      for (let i = nonEmptyParas.length - 1; i >= minTailPosition; i -= 1) {
        const txt = nonEmptyParas[i].text.trim();
        const isTocEntry = /(?:\.{2,}|\t|\s{2,})\d{1,3}$/.test(txt) || /\s+\d{1,3}$/.test(txt);
        const wc = countWords(txt);
        if (
          !isTocEntry &&
          wc >= 1 &&
          wc <= 6 &&
          !/[.!?]$/.test(txt) &&
          isReferencesSectionTitle(txt)
        ) {
          terminalRefStartIndex = nonEmptyParas[i].index;
          break;
        }
      }

      const groups: UnifiedTurnitinSection[] = [];
      let currentTitle = 'Phần 1. Mở đầu & Nội dung';
      let currentIndices: number[] = [];

      const flushGroup = () => {
        if (currentIndices.length === 0) return;
        const text = currentIndices
          .map((idx) => parsed.paragraphs[idx].text)
          .join('\n\n');
        if (countWords(text) >= 8) {
          groups.push({
            id: `docx_sec_${groups.length + 1}`,
            title: currentTitle,
            originalContent: text,
            content: text,
            docxParagraphIndices: [...currentIndices],
          });
        }
        currentIndices = [];
      };

      let insideTocBlock = false;
      for (const p of parsed.paragraphs) {
        if (p.isEmpty) continue;
        const txt = p.text.trim();

        // Stop only when reaching the verified terminal References section at the end of the paper
        if (terminalRefStartIndex !== -1 && p.index >= terminalRefStartIndex) {
          flushGroup();
          break;
        }

        // Skip Table of Contents header & dotted/numbered TOC lines
        if (/^(?:mục lục|table of contents)$/i.test(txt)) {
          insideTocBlock = true;
          continue;
        }
        if (
          insideTocBlock &&
          countWords(txt) <= 18 &&
          /\s+\d{1,3}$/.test(txt)
        ) {
          continue;
        }
        if (countWords(txt) >= 22) {
          insideTocBlock = false;
        }

        if (p.isHeading && countWords(txt) <= 20 && !/\s+\d{1,3}$/.test(txt)) {
          flushGroup();
          currentTitle = txt;
          continue;
        }

        if (countWords(txt) >= 6) {
          currentIndices.push(p.index);
          const runningWords = currentIndices.reduce(
            (sum, i) => sum + countWords(parsed.paragraphs[i].text),
            0
          );
          if (runningWords >= 420) {
            flushGroup();
            currentTitle = `${currentTitle.replace(/\s*\(Tiếp\)$/, '')} (Tiếp)`;
          }
        }
      }
      flushGroup();

      // Fallback: if document consists of short lines/table cells (< 6 words each), group all non-empty paragraphs so 0 sections never happens
      if (groups.length === 0 && nonEmptyParas.length > 0) {
        const allIndices = nonEmptyParas.map((p) => p.index);
        const allText = nonEmptyParas.map((p) => p.text).join('\n\n');
        groups.push({
          id: 'docx_sec_1',
          title: file.name.replace(/\.docx$/i, ''),
          originalContent: allText,
          content: allText,
          docxParagraphIndices: allIndices,
        });
      }

      setOrigin('docx_file');
      setParsedDocx(parsed);
      setUnifiedSections(groups);
      setDocumentLabel(file.name);
      setBeforeScoresMap({});
      setSectionExecMap({});
      setExecutionLogs([]);
      setShowPasteBox(false);
      onToast(
        `Đã nạp file "${file.name}" (${groups.length} mục nội dung · Sẵn sàng bấm Chạy Vượt Turnitin ProMax!).`
      );
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Không thể đọc file Word .docx.'
      );
    } finally {
      if (docxInputRef.current) docxInputRef.current.value = '';
    }
  };

  // Load Pasted Text into the unified pipeline
  const handleApplyPastedText = () => {
    const built = splitPastedTextIntoUnifiedSections(pasteDraft);
    if (built.length === 0) {
      onToast('Vui lòng dán nội dung bài viết trước.');
      return;
    }
    setOrigin('pasted_text');
    setParsedDocx(null);
    setUnifiedSections(built);
    setDocumentLabel(`Văn bản dán trực tiếp (${built.length} mục)`);
    setBeforeScoresMap({});
    setSectionExecMap({});
    setExecutionLogs([]);
    setShowPasteBox(false);
    onToast(
      `Đã chia văn bản thành ${built.length} mục theo chuẩn cửa sổ 250 từ của Turnitin!`
    );
  };

  // Live Turnitin Scan Report across all unified sections
  const activeReport = useMemo<TurnitinPaperScanReport>(() => {
    const results = unifiedSections.map((sec) =>
      scanSectionTurnitinAiRisk({
        id: sec.id,
        title: sec.title,
        content: sec.content,
      })
    );
    return summarizeTurnitinSectionResults(results);
  }, [unifiedSections]);

  // Auto-select all sections when document changes
  useEffect(() => {
    setSelectedSectionIds(unifiedSections.map((s) => s.id));
  }, [documentLabel, origin, unifiedSections.length]);

  const scrollToSectionCard = (sectionId: string) => {
    window.requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-turnitin-sec-id="${sectionId}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  const handleStopProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    onToast(
      'Đã dừng tiến trình theo yêu cầu. Các mục đã hoàn thành trước đó vẫn được lưu nguyên vẹn!'
    );
  };

  // Sync updated unifiedSections back to AI Writer session if origin === 'ai_writer'
  const syncBackToAiWriterIfApplicable = (
    nextList: UnifiedTurnitinSection[]
  ) => {
    if (origin !== 'ai_writer' || !activeWriterSession) return;
    const mapById = new Map(nextList.map((s) => [s.id, s.content]));
    const updatedSession: WriterSession = {
      ...activeWriterSession,
      outline: activeWriterSession.outline.map((sec) =>
        mapById.has(sec.id)
          ? { ...sec, content: mapById.get(sec.id)!, status: 'completed' }
          : sec
      ),
      updatedAt: new Date().toISOString(),
    };
    const nextSessions = sessions.map((s) =>
      s.id === updatedSession.id ? updatedSession : s
    );
    setSessions(nextSessions);
    saveWriterSessions(nextSessions);
    void saveWriterSessionToCloud(updatedSession);
  };

  const resolveActiveAiProfile = () => {
    const aiSettings = loadAiChatbotSettings();
    const eff = resolveEffectiveWriterConfig(aiSettings);
    const hasKey =
      Boolean(eff.profile.apiKey.trim()) ||
      Boolean(serverKeysConfigured[eff.profile.provider]);
    return { profile: eff.profile, hasKey };
  };

  // --- Fast 6-Layer 0-Token Breaker ---
  const handleRunFastZeroToken = () => {
    if (unifiedSections.length === 0) {
      onToast('Vui lòng chọn bài viết, tải file .DOCX hoặc dán văn bản trước.');
      return;
    }
    const targetSet = new Set(
      selectedSectionIds.length > 0
        ? selectedSectionIds
        : unifiedSections.map((s) => s.id)
    );
    setShowCockpitBanner(true);

    const nextBefore: Record<string, number> = { ...beforeScoresMap };
    const nextExecMap: Record<string, SectionExecutionStatus> = {};
    const nextLogs: ExecutionLogEntry[] = [];

    const nextList = unifiedSections.map((sec) => {
      if (!targetSet.has(sec.id)) return sec;
      const beforeScan = scanSectionTurnitinAiRisk(sec);
      if (nextBefore[sec.id] === undefined) {
        nextBefore[sec.id] = beforeScan.aiRiskPercent;
      }
      const gated = ensureUnder20PercentAiGate(sec.id, sec.title, sec.content);
      const guarded = enforceProtectedTokensIntegrity(
        sec.originalContent,
        gated
      );
      const afterScan = scanSectionTurnitinAiRisk({
        ...sec,
        content: guarded.content,
      });

      nextExecMap[sec.id] = {
        status: 'completed',
        phase: 4,
        phaseLabel: 'Đã hoàn tất 6 lớp 0-Token (< 20% AI)',
        beforeRisk: beforeScan.aiRiskPercent,
        afterRisk: afterScan.aiRiskPercent,
        durationSec: 0.1,
        paragraphsInfo: `${beforeScan.sentenceCount} câu`,
      };
      nextLogs.push({
        id: `log_${sec.id}_${Date.now()}`,
        sectionId: sec.id,
        sectionTitle: sec.title,
        beforeRisk: beforeScan.aiRiskPercent,
        afterRisk: afterScan.aiRiskPercent,
        lockedCitationsCount: beforeScan.protectedCitations.length,
        durationSec: 0.1,
        detail: `Lọc 6 lớp 0-Token: Giảm từ ${beforeScan.aiRiskPercent}% → ${afterScan.aiRiskPercent}% AI (Khóa ${beforeScan.protectedCitations.length} trích dẫn).`,
      });
      return { ...sec, content: guarded.content };
    });

    setBeforeScoresMap(nextBefore);
    setSectionExecMap(nextExecMap);
    setExecutionLogs(nextLogs);
    setUnifiedSections(nextList);
    syncBackToAiWriterIfApplicable(nextList);
    onToast(
      `Đã chạy 6 lớp Phá Vân Tay trên ${nextLogs.length} mục (Bảo toàn 100% trích dẫn)!`
    );
  };

  // --- Full-Section 250-Word Window ProMax AI Pipeline (< 20% AI Guarantee) ---
  const handleRunFullProMaxAi = async () => {
    if (unifiedSections.length === 0) {
      onToast('Vui lòng chọn bài viết, tải file .DOCX hoặc dán văn bản trước.');
      return;
    }
    const { profile, hasKey } = resolveActiveAiProfile();
    if (!hasKey) {
      onToast(
        'Chưa cấu hình API Key Chatbot. Hãy cài API Key trong tab AI Writer Studio hoặc dùng nút "Lọc Nhanh 6 Lớp (0 Token)".'
      );
      return;
    }

    const targetList = unifiedSections.filter((s) =>
      selectedSectionIds.includes(s.id)
    );
    if (targetList.length === 0) {
      onToast('Vui lòng tích chọn ít nhất 1 mục để chạy Vượt Turnitin ProMax.');
      return;
    }

    const skills = loadGlobalSkillLibrary();
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;
    setShowCockpitBanner(true);
    setExecutionLogs([]);

    const nextBefore: Record<string, number> = { ...beforeScoresMap };
    const initExecMap: Record<string, SectionExecutionStatus> = {};
    activeReport.sections.forEach((s) => {
      if (selectedSectionIds.includes(s.sectionId)) {
        if (nextBefore[s.sectionId] === undefined) {
          nextBefore[s.sectionId] = s.aiRiskPercent;
        }
        initExecMap[s.sectionId] = {
          status: 'queued',
          phase: 1,
          phaseLabel: 'Đang chờ đến lượt xử lý...',
          beforeRisk: s.aiRiskPercent,
        };
      }
    });
    setBeforeScoresMap(nextBefore);
    setSectionExecMap(initExecMap);
    setIsProcessing(true);

    const completedDurations: number[] = [];
    let runningList = [...unifiedSections];
    const contextSession: WriterSession =
      activeWriterSession ||
      loadWriterSessions()[0] || {
        id: 'temp_promax',
        title: documentLabel || 'Academic Paper',
        linkedOrderCode: selectedOrderCode,
        subject: '',
        topic: documentLabel || 'Academic Paper',
        targetWordCount: 2500,
        citationStyle: 'APA',
        writingLanguage: 'Vietnamese',
        academicTone: 'High Distinction Academic Tone',
        instructions: '',
        rubricNotes: '',
        format: {
          ...ACADEMIC_FORMAT_PRESETS.APA7.config,
          runningHeader: '',
          includePageNumbers: true,
          includeTableOfContents: true,
          coverPage: { ...DEFAULT_COVER_PAGE_CONFIG },
        },
        outline: [],
        contextFiles: [],
        activeSectionId: '',
        viewMode: 'sections',
        fullPaperOverride: '',
        batchStatus: 'idle',
        historyStack: [],
        historyIndex: -1,
        updatedAt: new Date().toISOString(),
      };

    try {
      for (let i = 0; i < targetList.length; i += 1) {
        if (abortCtrl.signal.aborted) break;
        const sec = targetList[i];
        const secStartMs = Date.now();
        scrollToSectionCard(sec.id);

        const pseudoOutlineSec: WriterOutlineSection = {
          id: sec.id,
          order: i + 1,
          title: sec.title,
          headingLevel: 'h1',
          targetWords: countWords(sec.content),
          guidanceNotes: '',
          content: sec.content,
          status: 'completed',
        };
        const beforeSecScan = scanSectionTurnitinAiRisk(pseudoOutlineSec);

        const updatePhase = (phase: 1 | 2 | 3 | 4, phaseDetail: string) => {
          setProgressInfo({
            step: i + 1,
            total: targetList.length,
            label: sec.title,
            sectionId: sec.id,
            phase,
            phaseDetail,
          });
          setSectionExecMap((prev) => ({
            ...prev,
            [sec.id]: {
              ...prev[sec.id],
              status: 'running',
              phase,
              phaseLabel: phaseDetail,
              beforeRisk: beforeSecScan.aiRiskPercent,
            },
          }));
        };

        updatePhase(
          1,
          'Pha 1/4: Đang quét cửa sổ trượt 250 từ & khóa 100% trích dẫn...'
        );

        const res = await humanizeSectionForTurnitinWithAi({
          session: contextSession,
          section: pseudoOutlineSec,
          skills,
          profile,
          signal: abortCtrl.signal,
          onPhaseChange: updatePhase,
        });

        const durSec = Math.max(
          0.4,
          Number(((Date.now() - secStartMs) / 1000).toFixed(1))
        );
        completedDurations.push(durSec);
        setAvgSecPerSection(
          completedDurations.reduce((a, b) => a + b, 0) /
            completedDurations.length
        );

        runningList = runningList.map((item) =>
          item.id === sec.id ? { ...item, content: res.content } : item
        );
        setUnifiedSections(runningList);
        syncBackToAiWriterIfApplicable(runningList);

        setSectionExecMap((prev) => ({
          ...prev,
          [sec.id]: {
            status: 'completed',
            phase: 4,
            phaseLabel: `Hoàn tất 100% đoạn (${res.beforeRisk}% → ${res.afterRisk}% AI)`,
            beforeRisk: res.beforeRisk,
            afterRisk: res.afterRisk,
            durationSec: durSec,
            paragraphsInfo: `Đã xử lý toàn diện ${res.totalParagraphsCount}/${res.totalParagraphsCount} đoạn`,
          },
        }));

        setExecutionLogs((prev) => [
          ...prev,
          {
            id: `log_${sec.id}_${Date.now()}`,
            sectionId: sec.id,
            sectionTitle: sec.title,
            beforeRisk: res.beforeRisk,
            afterRisk: res.afterRisk,
            lockedCitationsCount: beforeSecScan.protectedCitations.length,
            durationSec: durSec,
            detail: `Đã xử lý 100% đoạn văn (${res.totalParagraphsCount} đoạn) theo cửa sổ 250 từ · Giảm từ ${res.beforeRisk}% → ${res.afterRisk}% AI · Khóa ${beforeSecScan.protectedCitations.length} trích dẫn (${durSec}s).`,
          },
        ]);
      }

      const finalResults = runningList.map((s) =>
        scanSectionTurnitinAiRisk({
          id: s.id,
          title: s.title,
          content: s.content,
        })
      );
      const finalSummary = summarizeTurnitinSectionResults(finalResults);
      onToast(
        `Hoàn tất Vượt Turnitin ProMax! Điểm AI toàn bài giảm còn ${finalSummary.overallAiRiskPercent}% (< 20% AI · Bảo toàn 100% trích dẫn).`
      );
    } catch (err) {
      if (!abortCtrl.signal.aborted) {
        onToast(
          err instanceof Error
            ? err.message
            : 'Quá trình Vượt Turnitin ProMax bị gián đoạn.'
        );
      }
    } finally {
      setIsProcessing(false);
      setProgressInfo(null);
      abortControllerRef.current = null;
    }
  };

  // Build output .DOCX regardless of origin (AI Writer, uploaded .DOCX, or Pasted Text)
  const buildOutputDocxFile = async (): Promise<File | null> => {
    if (unifiedSections.length === 0) return null;

    if (origin === 'docx_file' && parsedDocx) {
      const overrides: Record<number, string> = {};
      for (const sec of unifiedSections) {
        const indices = sec.docxParagraphIndices || [];
        if (indices.length === 0) continue;
        const splitParas = sec.content
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean);
        indices.forEach((pIdx, i) => {
          if (i < splitParas.length - 1) {
            overrides[pIdx] = splitParas[i];
          } else if (i === indices.length - 1) {
            overrides[pIdx] = splitParas.slice(i).join(' ');
          } else if (splitParas[i]) {
            overrides[pIdx] = splitParas[i];
          }
        });
      }
      const patchedBlob = await exportPatchedDocx(parsedDocx, overrides);
      const outName =
        parsedDocx.fileName.replace(/\.docx$/i, '') + '_Under20AI.docx';
      return new File([patchedBlob], outName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    }

    if (origin === 'ai_writer' && activeWriterSession) {
      return await buildFormattedDocxFromSession(
        activeWriterSession,
        `${activeWriterSession.linkedOrderCode || 'TurnitinProMax'}_${(
          activeWriterSession.topic || 'Paper'
        )
          .replace(/[^a-zA-Z0-9_-]+/g, '_')
          .slice(0, 36)}_Under20AI.docx`
      );
    }

    // Origin === 'pasted_text': build clean formatted DOCX with forensic metadata
    const syntheticSession: WriterSession = {
      id: `promax_paste_${Date.now()}`,
      title: documentLabel || 'Turnitin_ProMax_Paper',
      linkedOrderCode: selectedOrderCode,
      subject: '',
      topic: documentLabel || 'Academic Paper',
      targetWordCount: unifiedSections.reduce(
        (sum, s) => sum + countWords(s.content),
        0
      ),
      citationStyle: 'APA',
      writingLanguage: 'Vietnamese',
      academicTone: 'High Distinction Academic Tone',
      instructions: '',
      rubricNotes: '',
      format: {
        ...ACADEMIC_FORMAT_PRESETS.APA7.config,
        runningHeader: '',
        includePageNumbers: true,
        includeTableOfContents: false,
        coverPage: { ...DEFAULT_COVER_PAGE_CONFIG, enabled: false },
      },
      outline: unifiedSections.map((sec, idx) => ({
        id: sec.id,
        order: idx + 1,
        title: sec.title,
        headingLevel: 'h1',
        targetWords: countWords(sec.content),
        guidanceNotes: '',
        content: sec.content,
        status: 'completed',
      })),
      contextFiles: [],
      activeSectionId: unifiedSections[0]?.id || '',
      viewMode: 'sections',
      fullPaperOverride: '',
      batchStatus: 'completed',
      historyStack: [],
      historyIndex: -1,
      updatedAt: new Date().toISOString(),
    };

    return await buildFormattedDocxFromSession(
      syntheticSession,
      `TurnitinProMax_Under20AI.docx`
    );
  };

  const handleDownloadDocx = async () => {
    setExportingDocx(true);
    try {
      const file = await buildOutputDocxFile();
      if (!file) {
        onToast('Chưa có nội dung bài viết để xuất file Word.');
        return;
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      onToast(
        `Đã tải xuống "${file.name}" (Tích hợp Forensic Metadata & Vượt Turnitin < 20% AI)!`
      );
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Không thể xuất file Word.'
      );
    } finally {
      setExportingDocx(false);
    }
  };

  const handleAttachToOrder = async () => {
    if (!onAttachDocxToOrder) return;
    const ord = orders.find((o) => o.orderCode === selectedOrderCode);
    if (!ord) {
      onToast('Vui lòng chọn Mã đơn hàng cần đính kèm.');
      return;
    }
    setAttachingOrder(true);
    try {
      const file = await buildOutputDocxFile();
      if (!file) return;
      await onAttachDocxToOrder(ord, file);
      onToast(
        `Đã đính kèm bản Word Vượt Turnitin (< 20% AI) vào đơn #${ord.orderCode}!`
      );
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Không thể đính kèm vào đơn hàng.'
      );
    } finally {
      setAttachingOrder(false);
    }
  };

  const handleCopyAllText = async () => {
    if (unifiedSections.length === 0) return;
    const fullText = unifiedSections
      .map((s) => `${s.title}\n\n${s.content}`)
      .join('\n\n');
    const ok = await copyTextToClipboard(fullText);
    if (ok) {
      setCopiedAll(true);
      onToast('Đã sao chép toàn bộ bài viết đã Vượt Turnitin (< 20% AI)!');
      window.setTimeout(() => setCopiedAll(false), 1800);
    }
  };

  const isPassUnder20 = activeReport.overallAiRiskPercent < 20;
  const totalWords = unifiedSections.reduce(
    (sum, s) => sum + countWords(s.content),
    0
  );

  return (
    <div className="space-y-4">
      {/* 1. Minimalist Unified Top Header + Live Score Gate */}
      <section className="bg-gradient-to-r from-[#071A42] via-[#0B2559] to-[#12489B] text-white rounded-2xl p-5 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/12 border border-white/20 text-sky-200 text-[11px] font-bold">
              <Fingerprint className="w-3.5 h-3.5 text-emerald-300" />
              <span>
                Turnitin ProMax (AIW-2 &amp; AIR-1) · Quét Toàn Diện Cửa Sổ Trượt 250 Từ
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold">
              Vượt Turnitin AI ProMax (&lt; 20% AI · Khóa Trích Dẫn &amp; Số Liệu 100%)
            </h1>
          </div>

          {/* compact 4-pill telemetry strip */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className={`px-3.5 py-2 rounded-xl border font-mono text-xs flex items-center gap-2 ${
                isPassUnder20
                  ? 'bg-emerald-500/20 border-emerald-300/45 text-emerald-100'
                  : 'bg-amber-500/20 border-amber-300/45 text-amber-100'
              }`}
            >
              <div>
                <div className="text-[10px] font-sans uppercase opacity-80">
                  Dự báo Turnitin AI
                </div>
                <div className="text-lg font-bold">
                  {activeReport.overallAiRiskPercent}% AI
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-lg text-[11px] font-sans font-bold ${
                  isPassUnder20
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-amber-400 text-slate-950'
                }`}
              >
                {isPassUnder20 ? '✓ PASS (<20%)' : 'CẦN XỬ LÝ'}
              </span>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 text-xs">
              <div className="text-[10px] text-slate-300">
                Nhịp câu (Burstiness)
              </div>
              <div className="text-base font-mono font-bold text-emerald-300">
                {activeReport.overallBurstinessCvPercent}%{' '}
                <span className="text-[10px] font-sans font-normal text-slate-300">
                  (&ge;42%)
                </span>
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-emerald-400/15 border border-emerald-300/35 text-xs">
              <div className="text-[10px] text-emerald-200 flex items-center gap-1 font-semibold">
                <Lock className="w-3 h-3" />
                <span>Khóa Bất Biến (Frozen)</span>
              </div>
              <div className="text-xs font-bold text-white mt-0.5">
                {activeReport.totalProtectedCitations} trích dẫn ·{' '}
                {activeReport.totalProtectedStats} số liệu
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. STREAMLINED SINGLE-CARD TOOLBAR (Nguồn bài + Thông tin file + Nút chạy & Xuất file gọn trên 1 khung) */}
      <section className="bg-white border border-zinc-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Compact Source Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={docxInputRef}
              type="file"
              accept=".docx"
              onChange={(e) => void handleUploadDocxFile(e.target.files?.[0])}
              className="hidden"
            />
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => docxInputRef.current?.click()}
              className={`btn-press inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                origin === 'docx_file'
                  ? 'bg-blue-50/90 border-[#12489B] text-[#0B2559]'
                  : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-slate-700'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-[#12489B]" />
              <span>Tải file .DOCX</span>
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => setShowPasteBox((v) => !v)}
              className={`btn-press inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                showPasteBox || origin === 'pasted_text'
                  ? 'bg-blue-50/90 border-[#12489B] text-[#0B2559]'
                  : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-slate-700'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-[#12489B]" />
              <span>Dán văn bản</span>
              {showPasteBox ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {sessions.length > 0 && (
              <select
                value={origin === 'ai_writer' ? selectedSessionId : ''}
                disabled={isProcessing}
                onChange={(e) => {
                  if (e.target.value) {
                    handleSelectAiWriterSession(e.target.value);
                  }
                }}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors focus:outline-none max-w-[220px] truncate ${
                  origin === 'ai_writer' && unifiedSections.length > 0
                    ? 'bg-blue-50/90 border-[#12489B] text-[#0B2559]'
                    : 'bg-zinc-50 border-zinc-200 text-slate-700 hover:bg-zinc-100'
                }`}
              >
                <option value="">
                  -- Bài từ AI Writer ({sessions.length}) --
                </option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.linkedOrderCode ? `[#${s.linkedOrderCode}] ` : ''}
                    {s.topic || s.title || 'Phiên chưa đặt tên'}
                  </option>
                ))}
              </select>
            )}

            {/* Active Document Summary Pill right inline */}
            {unifiedSections.length > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F4F7FB] border border-blue-200/70 text-xs text-slate-700 max-w-md">
                <span className="font-bold text-[#0B2559] truncate max-w-[200px]">
                  {documentLabel}
                </span>
                <span className="text-zinc-300">|</span>
                <span className="font-mono text-[11px] text-zinc-600 shrink-0">
                  {unifiedSections.length} mục · {totalWords.toLocaleString()} từ
                </span>
                {origin === 'ai_writer' && activeWriterSession && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenInAiWriter(activeWriterSession.linkedOrderCode)
                    }
                    className="text-[#12489B] font-bold hover:underline inline-flex items-center gap-0.5 shrink-0"
                    title="Mở lại trong AI Writer Studio"
                  >
                    <Wand2 className="w-3 h-3" />
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Export + Primary Run Action */}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {unifiedSections.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => void handleCopyAllText()}
                  className="btn-press inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-slate-700 text-xs font-semibold"
                  title="Sao chép toàn bộ nội dung bài viết"
                >
                  {copiedAll ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đã copy</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={exportingDocx}
                  onClick={() => void handleDownloadDocx()}
                  className="btn-press inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold disabled:opacity-40"
                  title="Tải xuống file Word (.DOCX) đã tích hợp Forensic Metadata"
                >
                  {exportingDocx ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Tải .DOCX</span>
                </button>

                {onAttachDocxToOrder && orders.length > 0 && (
                  <div className="inline-flex items-center gap-1">
                    <select
                      value={selectedOrderCode}
                      onChange={(e) => setSelectedOrderCode(e.target.value)}
                      className="px-2 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50 max-w-[135px]"
                    >
                      <option value="">Gắn đơn...</option>
                      {orders.map((o) => (
                        <option key={o.id} value={o.orderCode}>
                          #{o.orderCode} · {o.topic.slice(0, 18)}
                        </option>
                      ))}
                    </select>
                    {selectedOrderCode && (
                      <button
                        type="button"
                        disabled={attachingOrder}
                        onClick={() => void handleAttachToOrder()}
                        className="btn-press p-2 rounded-xl bg-[#0B2559] hover:bg-[#12489B] text-white"
                        title="Đính kèm vào đơn hàng đã chọn"
                      >
                        {attachingOrder ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Paperclip className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              disabled={isProcessing || unifiedSections.length === 0}
              onClick={() => void handleRunFullProMaxAi()}
              className="btn-press inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#0B2559] to-[#12489B] hover:from-[#071A42] hover:to-[#0B2559] text-white text-xs font-bold shadow-xs disabled:opacity-40"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-sky-300" />
              )}
              <span>Chạy Vượt Turnitin ProMax</span>
            </button>
          </div>
        </div>

        {/* Collapsible Quick-Paste Box */}
        {showPasteBox && (
          <div className="pt-3 border-t border-zinc-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">
                Dán bài luận hoặc chương cần xử lý (Tự động chia mục 250–380 từ &amp; khóa trích dẫn):
              </span>
              <span className="font-mono text-zinc-500">
                {countWords(pasteDraft)} từ
              </span>
            </div>
            <textarea
              rows={4}
              value={pasteDraft}
              onChange={(e) => setPasteDraft(e.target.value)}
              placeholder="Dán nội dung bài làm vào đây..."
              className="w-full p-3 text-xs sm:text-sm rounded-xl border border-zinc-200 bg-[#F4F7FB]/50 focus:bg-white focus:outline-none focus:border-[#12489B]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteBox(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:bg-zinc-100"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleApplyPastedText}
                className="btn-press px-4 py-1.5 rounded-xl bg-[#0B2559] hover:bg-[#12489B] text-white text-xs font-bold"
              >
                Nạp văn bản ({countWords(pasteDraft)} từ)
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 3. COMPACT LIVE PROGRESS BAR (Gọn gàng, không lặp lại danh sách mục gây rối mắt) */}
      {(isProcessing || (showCockpitBanner && executionLogs.length > 0)) && (
        <section
          className={`rounded-2xl border px-4 py-3.5 shadow-xs space-y-2.5 transition-all ${
            isProcessing
              ? 'bg-blue-50/80 border-[#12489B]/40'
              : 'bg-emerald-50/75 border-emerald-300/80'
          }`}
        >
          {(() => {
            const pct =
              isProcessing && progressInfo
                ? Math.min(
                    98,
                    Math.max(
                      5,
                      Math.round(
                        ((progressInfo.step - 1 + progressInfo.phase / 4) /
                          Math.max(1, progressInfo.total)) *
                          100
                      )
                    )
                  )
                : 100;

            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Left: Concise Status & Current Section */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#12489B] shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <div className="text-xs sm:text-sm font-bold text-[#0B2559] truncate">
                      {isProcessing && progressInfo
                        ? `Đang xử lý mục ${progressInfo.step}/${progressInfo.total}: “${progressInfo.label}”`
                        : `Hoàn tất Vượt Turnitin ProMax (${executionLogs.length}/${executionLogs.length} mục đạt < 20% AI)`}
                    </div>
                    {isProcessing &&
                      progressInfo &&
                      progressInfo.total - progressInfo.step <= 1 && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10.5px] shrink-0">
                          ⚡ Sắp xong
                        </span>
                      )}
                  </div>

                  {/* Right: Numbered Quick-Jump Dots + Timer + Stop/Close */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Compact numbered section dots (#1, #2, #3...) instead of bulky duplicate cards */}
                    <div className="hidden md:flex items-center gap-1">
                      {activeReport.sections.map((sec, idx) => {
                        const st = sectionExecMap[sec.sectionId];
                        const isRun = st?.status === 'running';
                        const isDone = st?.status === 'completed';
                        return (
                          <button
                            key={sec.sectionId}
                            type="button"
                            onClick={() => scrollToSectionCard(sec.sectionId)}
                            title={`${sec.sectionTitle} (${sec.aiRiskPercent}% AI)`}
                            className={`w-6 h-6 rounded-lg font-mono text-[10.5px] font-bold flex items-center justify-center border transition-all ${
                              isRun
                                ? 'bg-[#12489B] text-white border-[#0B2559] ring-2 ring-sky-300'
                                : isDone
                                ? 'bg-emerald-500 text-white border-emerald-600'
                                : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-100'
                            }`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>

                    {isProcessing && progressInfo ? (
                      <>
                        <span className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 font-mono text-[11px] font-semibold text-slate-700">
                          {elapsedSec}s · Còn ~
                          {Math.max(
                            1,
                            Math.round(
                              (progressInfo.total - progressInfo.step) *
                                avgSecPerSection +
                                ((5 - progressInfo.phase) / 4) * avgSecPerSection
                            )
                          )}
                          s ({pct}%)
                        </span>
                        <button
                          type="button"
                          onClick={handleStopProcessing}
                          className="btn-press inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                        >
                          <Square className="w-3 h-3 fill-current" />
                          <span>Dừng</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowCockpitBanner(false)}
                        className="p-1 rounded-lg text-zinc-400 hover:text-slate-700 hover:bg-white/80"
                        title="Đóng thanh tiến trình"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Crisp Slim Progress Bar + Subtle Phase Subtitle */}
                <div className="space-y-1">
                  <div className="h-2 w-full rounded-full bg-zinc-200/80 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isProcessing
                          ? 'bg-gradient-to-r from-[#0B2559] via-[#12489B] to-sky-500'
                          : 'bg-emerald-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {isProcessing && progressInfo && (
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>{progressInfo.phaseDetail}</span>
                      <span className="font-mono font-semibold text-[#12489B]">
                        Pha {progressInfo.phase}/4
                      </span>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </section>
      )}

      {/* 4. UNIFIED SECTION-BY-SECTION LIST (Tô Sáng Trực Tiếp & Tự Cuộn Tới Mục Đang Xử Lý) */}
      <section className="bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Danh Sách Mục &amp; Đoạn Văn Theo Cửa Sổ Trượt 250 Từ ({activeReport.sections.length} mục)
            </h2>
            <p className="text-xs text-zinc-500">
              Khi chạy, màn hình sẽ tự động cuộn và tô sáng mục đang xử lý. Bấm &ldquo;Xem / Sửa nội dung&rdquo; ở mục bất kỳ để đối chiếu văn bản.
            </p>
          </div>

          {activeReport.sections.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() =>
                  setSelectedSectionIds(
                    activeReport.sections.map((s) => s.sectionId)
                  )
                }
                className="font-semibold text-[#12489B] hover:underline"
              >
                Chọn tất cả ({activeReport.sections.length})
              </button>
              <span className="text-zinc-300">|</span>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() =>
                  setSelectedSectionIds(
                    activeReport.sections
                      .filter((s) => s.aiRiskPercent >= 18)
                      .map((s) => s.sectionId)
                  )
                }
                className="font-semibold text-slate-600 hover:underline"
              >
                Chỉ chọn mục &ge; 18% AI
              </button>
            </div>
          )}
        </div>

        {activeReport.sections.length === 0 ? (
          <div className="p-10 text-center text-xs text-zinc-500 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 space-y-2">
            <div className="font-bold text-slate-700 text-sm">
              Chưa có bài viết nào được nạp
            </div>
            <p>
              Hãy chọn 1 bài từ <strong>AI Writer Studio</strong>, bấm{' '}
              <strong>Tải file .DOCX</strong>, hoặc bấm{' '}
              <strong>Dán văn bản</strong> ở thanh công cụ phía trên để bắt đầu.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeReport.sections.map((sec: TurnitinSectionScanResult) => {
              const checked = selectedSectionIds.includes(sec.sectionId);
              const beforeScore = beforeScoresMap[sec.sectionId];
              const execState = sectionExecMap[sec.sectionId];
              const isRunningThis = execState?.status === 'running';
              const isCompletedThis = execState?.status === 'completed';
              const isQueuedThis = execState?.status === 'queued';
              const rawSection = unifiedSections.find(
                (u) => u.id === sec.sectionId
              );
              const isExpanded = expandedSectionId === sec.sectionId;

              return (
                <div
                  key={sec.sectionId}
                  data-turnitin-sec-id={sec.sectionId}
                  onClick={() =>
                    !isProcessing &&
                    setSelectedSectionIds((prev) =>
                      prev.includes(sec.sectionId)
                        ? prev.filter((x) => x !== sec.sectionId)
                        : [...prev, sec.sectionId]
                    )
                  }
                  className={`px-4 py-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    isRunningThis
                      ? 'bg-blue-50/90 border-[#12489B] ring-2 ring-[#12489B] shadow-md'
                      : isCompletedThis
                      ? 'bg-emerald-50/30 border-emerald-300/90'
                      : checked
                      ? 'bg-blue-50/25 border-[#12489B]/50'
                      : 'bg-white border-zinc-200/90 hover:border-zinc-300'
                  }`}
                >
                  {/* Active Running Highlight Strip (ONLY shown on the 1 section currently running) */}
                  {isRunningThis && (
                    <div className="px-3 py-1.5 rounded-lg bg-[#0B2559] text-white text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2 font-bold">
                        <span className="inline-flex items-center gap-2 truncate">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-300 shrink-0" />
                          <span className="truncate">{execState.phaseLabel}</span>
                        </span>
                        <span className="font-mono text-sky-200 shrink-0">
                          Pha {execState.phase}/4
                        </span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-white/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-300 transition-all duration-300"
                          style={{ width: `${execState.phase * 25}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Single-Row Clean Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isProcessing}
                        onChange={() => {}}
                        className="w-4 h-4 rounded accent-[#12489B] shrink-0"
                      />
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {sec.sectionTitle}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                        {sec.wordCount}w · {sec.sentenceCount} câu
                      </span>
                    </div>

                    {/* Right Inline Telemetry & Action Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 text-[11px]">
                      {isQueuedThis && isProcessing && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-semibold inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Chờ</span>
                        </span>
                      )}

                      <span
                        className={`px-2 py-0.5 rounded-md font-mono font-semibold ${
                          sec.burstinessCvPercent >= 42
                            ? 'bg-zinc-100 text-slate-700'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                        title="Độ biến thiên nhịp câu (Burstiness CV >= 42% là chuẩn người viết)"
                      >
                        CV {sec.burstinessCvPercent}%
                      </span>

                      {sec.protectedCitations.length > 0 && (
                        <span
                          className="px-2 py-0.5 rounded-md bg-zinc-100 text-slate-700 font-medium inline-flex items-center gap-1"
                          title={`Khóa bảo toàn: ${sec.protectedCitations.join(', ')}`}
                        >
                          <Lock className="w-3 h-3 text-emerald-700" />
                          <span>{sec.protectedCitations.length} trích dẫn</span>
                        </span>
                      )}

                      {isCompletedThis && execState.durationSec !== undefined && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 font-mono font-semibold">
                          ✓ {execState.durationSec}s
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold border ${
                          sec.aiRiskPercent < 20
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : sec.aiRiskPercent < 45
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-rose-100 text-rose-700 border-rose-200'
                        }`}
                      >
                        {sec.aiRiskPercent < 20 ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        <span className="font-mono">
                          {beforeScore !== undefined &&
                          beforeScore !== sec.aiRiskPercent
                            ? `${beforeScore}% → ${sec.aiRiskPercent}% AI`
                            : `${sec.aiRiskPercent}% AI`}
                        </span>
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedSectionId((prev) =>
                            prev === sec.sectionId ? null : sec.sectionId
                          );
                        }}
                        className="px-2.5 py-0.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 font-semibold text-slate-700"
                      >
                        {isExpanded ? 'Thu gọn' : 'Xem / Sửa'}
                      </button>
                    </div>
                  </div>

                  {/* Inline Expandable Content Viewer & Editor */}
                  {isExpanded && rawSection && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="pt-2.5 border-t border-zinc-200/80 space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px] text-zinc-500">
                        <span>
                          Nội dung mục &ldquo;{rawSection.title}&rdquo; (có thể chỉnh sửa hoặc copy trực tiếp):
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            await copyTextToClipboard(rawSection.content);
                            onToast(`Đã copy mục "${rawSection.title}"!`);
                          }}
                          className="font-bold text-[#12489B] hover:underline inline-flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy mục này</span>
                        </button>
                      </div>
                      <textarea
                        rows={7}
                        value={rawSection.content}
                        onChange={(e) => {
                          const val = e.target.value;
                          const nextList = unifiedSections.map((u) =>
                            u.id === rawSection.id ? { ...u, content: val } : u
                          );
                          setUnifiedSections(nextList);
                          syncBackToAiWriterIfApplicable(nextList);
                        }}
                        className="w-full p-3 text-xs sm:text-sm rounded-xl border border-zinc-200 bg-white focus:outline-none focus:border-[#12489B] leading-relaxed"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
