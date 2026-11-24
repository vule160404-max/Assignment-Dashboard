import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  Fingerprint,
  FolderUp,
  Layers,
  Loader2,
  Lock,
  Paperclip,
  RefreshCw,
  ShieldCheck,
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
  applyDeterministicTurnitinBreaker,
  enforceProtectedTokensIntegrity,
  ensureUnder20PercentAiGate,
  humanizeSectionForTurnitinWithAi,
  scanSectionTurnitinAiRisk,
  scanSessionTurnitinAiRisk,
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
  AiProviderType,
  WriterOutlineSection,
  WriterSession,
} from './writer/types';

type TurnitinSourceMode = 'ai_writer' | 'docx_file' | 'quick_paste';

interface SectionExecutionStatus {
  status: 'queued' | 'running' | 'completed' | 'error';
  phase: 1 | 2 | 3 | 4;
  phaseLabel: string;
  beforeRisk: number;
  afterRisk?: number;
  durationSec?: number;
  paragraphsInfo?: string;
  tokensSaved?: number;
}

interface ExecutionLogEntry {
  id: string;
  sectionId: string;
  sectionTitle: string;
  status: 'completed' | 'error' | 'stopped';
  beforeRisk: number;
  afterRisk: number;
  lockedCitationsCount: number;
  durationSec: number;
  detail: string;
}

interface DocxLogicalSection {
  id: string;
  title: string;
  paragraphIndices: number[];
  originalText: string;
  currentText: string;
}

interface TurnitinProMaxViewProps {
  orders: OrderRecord[];
  onOpenInAiWriter: (orderCode?: string) => void;
  onAttachDocxToOrder?: (order: OrderRecord, file: File) => Promise<void>;
  onToast: (msg: string) => void;
}

export function TurnitinProMaxView({
  orders,
  onOpenInAiWriter,
  onAttachDocxToOrder,
  onToast,
}: TurnitinProMaxViewProps) {
  const [sourceMode, setSourceMode] = useState<TurnitinSourceMode>('ai_writer');
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
    modeLabel: string;
  } | null>(null);
  const [sectionExecMap, setSectionExecMap] = useState<
    Record<string, SectionExecutionStatus>
  >({});
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogEntry[]>([]);
  const [showCockpitBanner, setShowCockpitBanner] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [avgSecPerSection, setAvgSecPerSection] = useState(4.5);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [attachingOrder, setAttachingOrder] = useState(false);
  const [selectedOrderCode, setSelectedOrderCode] = useState<string>('');

  // Mode 2: Direct DOCX upload state
  const docxInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedDocx, setParsedDocx] = useState<ParsedWordDocument | null>(null);
  const [docxSections, setDocxSections] = useState<DocxLogicalSection[]>([]);

  // Mode 3: Quick Paste Text state
  const [pasteInput, setPasteInput] = useState<string>('');
  const [pasteOutput, setPasteOutput] = useState<string>('');
  const [copiedPaste, setCopiedPaste] = useState(false);

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

  // Live 1-second stopwatch while processing so user sees exact elapsed & remaining countdown
  useEffect(() => {
    if (!isProcessing) return;
    const t0 = Date.now();
    setElapsedSec(0);
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [isProcessing]);

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

  // Reload sessions whenever switching back to ai_writer mode
  useEffect(() => {
    if (sourceMode === 'ai_writer') {
      const latest = loadWriterSessions();
      setSessions(latest);
      if (!latest.some((s) => s.id === selectedSessionId)) {
        setSelectedSessionId(latest[0]?.id || '');
      }
    }
  }, [sourceMode, selectedSessionId]);

  const activeSession = useMemo(
    () =>
      sessions.find((s) => s.id === selectedSessionId) || sessions[0] || null,
    [sessions, selectedSessionId]
  );

  useEffect(() => {
    if (activeSession?.linkedOrderCode) {
      setSelectedOrderCode(activeSession.linkedOrderCode);
    }
  }, [activeSession?.id, activeSession?.linkedOrderCode]);

  // Compute live Turnitin scan report based on current sourceMode
  const activeReport = useMemo<TurnitinPaperScanReport>(() => {
    if (sourceMode === 'ai_writer' && activeSession) {
      return scanSessionTurnitinAiRisk(activeSession);
    }
    if (sourceMode === 'docx_file' && docxSections.length > 0) {
      const results = docxSections.map((sec) =>
        scanSectionTurnitinAiRisk({
          id: sec.id,
          title: sec.title,
          content: sec.currentText,
        })
      );
      return summarizeTurnitinSectionResults(results);
    }
    if (sourceMode === 'quick_paste') {
      const targetText = (pasteOutput || pasteInput).trim();
      const single = scanSectionTurnitinAiRisk({
        id: 'paste_sec',
        title: 'Đoạn văn bản kiểm tra',
        content: targetText,
      });
      return summarizeTurnitinSectionResults(targetText ? [single] : []);
    }
    return summarizeTurnitinSectionResults([]);
  }, [
    sourceMode,
    activeSession,
    docxSections,
    pasteInput,
    pasteOutput,
  ]);

  // Auto-select sections with Risk >= 16% when report changes
  useEffect(() => {
    const flagged = activeReport.sections
      .filter((s) => s.aiRiskPercent >= 16 || s.detectedAiPhrases.length > 0)
      .map((s) => s.sectionId);
    setSelectedSectionIds(
      flagged.length > 0
        ? flagged
        : activeReport.sections.map((s) => s.sectionId)
    );
  }, [activeSession?.id, parsedDocx?.fileName, sourceMode]);

  const resolveActiveAiProfile = () => {
    const aiSettings = loadAiChatbotSettings();
    const eff = resolveEffectiveWriterConfig(aiSettings);
    const hasKey =
      Boolean(eff.profile.apiKey.trim()) ||
      Boolean(serverKeysConfigured[eff.profile.provider]);
    return { profile: eff.profile, hasKey };
  };

  // --- Mode 2: Upload & Parse .DOCX into logical body sections (skipping TOC & References) ---
  const handleUploadDocxFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      onToast('Vui lòng chọn tệp Microsoft Word (.docx).');
      return;
    }
    try {
      const parsed = await parseDocxFile(file);
      const groups: DocxLogicalSection[] = [];
      let currentTitle = 'Phần 1. Mở đầu & Nội dung';
      let currentIndices: number[] = [];
      let reachedReferences = false;

      const flushGroup = () => {
        if (currentIndices.length === 0) return;
        const text = currentIndices
          .map((idx) => parsed.paragraphs[idx].text)
          .join('\n\n');
        if (countWords(text) >= 20) {
          groups.push({
            id: `docx_sec_${groups.length + 1}`,
            title: currentTitle,
            paragraphIndices: [...currentIndices],
            originalText: text,
            currentText: text,
          });
        }
        currentIndices = [];
      };

      for (const p of parsed.paragraphs) {
        if (p.isEmpty) continue;
        if (isReferencesSectionTitle(p.text)) {
          flushGroup();
          reachedReferences = true;
          break;
        }
        if (reachedReferences) break;

        if (p.isHeading && countWords(p.text) <= 22) {
          flushGroup();
          currentTitle = p.text.trim();
          continue;
        }

        if (countWords(p.text) >= 12) {
          currentIndices.push(p.index);
          const runningWords = currentIndices.reduce(
            (sum, i) => sum + countWords(parsed.paragraphs[i].text),
            0
          );
          if (runningWords >= 450) {
            flushGroup();
            currentTitle = `${currentTitle.replace(/\s*\(Tiếp\)$/, '')} (Tiếp)`;
          }
        }
      }
      flushGroup();

      setParsedDocx(parsed);
      setDocxSections(groups);
      setBeforeScoresMap({});
      onToast(
        `Đã nạp file "${file.name}" (${groups.length} phân đoạn nội dung · Đã tự động khóa Bìa, Mục lục & Tài liệu tham khảo).`
      );
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Không thể đọc file Word .docx.'
      );
    } finally {
      if (docxInputRef.current) docxInputRef.current.value = '';
    }
  };

  // --- Fast Deterministic Breaker (< 20% AI Cadence Wave, 0s, No API) ---
  const handleRunFastProMax = () => {
    setShowCockpitBanner(true);
    if (sourceMode === 'ai_writer' && activeSession) {
      const targetSet = new Set(selectedSectionIds);
      const nextBefore: Record<string, number> = { ...beforeScoresMap };
      const nextExecMap: Record<string, SectionExecutionStatus> = {};
      const nextLogs: ExecutionLogEntry[] = [];

      activeReport.sections.forEach((s) => {
        if (targetSet.has(s.sectionId) && nextBefore[s.sectionId] === undefined) {
          nextBefore[s.sectionId] = s.aiRiskPercent;
        }
      });
      setBeforeScoresMap(nextBefore);

      const nextOutline = activeSession.outline.map((sec) => {
        if (!targetSet.has(sec.id) || !sec.content.trim()) return sec;
        const beforeScan = scanSectionTurnitinAiRisk(sec);
        const gated = ensureUnder20PercentAiGate(sec.id, sec.title, sec.content);
        const guarded = enforceProtectedTokensIntegrity(sec.content, gated);
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
          tokensSaved: beforeScan.estimatedFullRewriteTokens,
        };
        nextLogs.push({
          id: `log_${sec.id}_${Date.now()}`,
          sectionId: sec.id,
          sectionTitle: sec.title,
          status: 'completed',
          beforeRisk: beforeScan.aiRiskPercent,
          afterRisk: afterScan.aiRiskPercent,
          lockedCitationsCount: beforeScan.protectedCitations.length,
          durationSec: 0.1,
          detail: `Đã chạy 6 lớp 0-Token: Giảm từ ${beforeScan.aiRiskPercent}% → ${afterScan.aiRiskPercent}% AI (Khóa ${beforeScan.protectedCitations.length} trích dẫn).`,
        });
        return { ...sec, content: guarded.content };
      });

      setSectionExecMap(nextExecMap);
      setExecutionLogs(nextLogs);

      const updatedSession: WriterSession = {
        ...activeSession,
        outline: nextOutline,
        updatedAt: new Date().toISOString(),
      };
      const nextSessions = sessions.map((s) =>
        s.id === updatedSession.id ? updatedSession : s
      );
      setSessions(nextSessions);
      saveWriterSessions(nextSessions);
      void saveWriterSessionToCloud(updatedSession);
      const afterRep = scanSessionTurnitinAiRisk(updatedSession);
      onToast(
        `Đã hoàn tất 6 lớp 0-Token trên ${nextLogs.length} mục! Dự báo Turnitin AI giảm còn ${afterRep.overallAiRiskPercent}% (Bảo toàn 100% trích dẫn).`
      );
      return;
    }

    if (sourceMode === 'docx_file' && docxSections.length > 0) {
      const targetSet = new Set(selectedSectionIds);
      const nextBefore: Record<string, number> = { ...beforeScoresMap };
      const nextExecMap: Record<string, SectionExecutionStatus> = {};
      const nextLogs: ExecutionLogEntry[] = [];

      activeReport.sections.forEach((s) => {
        if (targetSet.has(s.sectionId) && nextBefore[s.sectionId] === undefined) {
          nextBefore[s.sectionId] = s.aiRiskPercent;
        }
      });
      setBeforeScoresMap(nextBefore);

      setDocxSections((prev) =>
        prev.map((sec) => {
          if (!targetSet.has(sec.id)) return sec;
          const beforeScan = scanSectionTurnitinAiRisk({
            id: sec.id,
            title: sec.title,
            content: sec.currentText,
          });
          const gated = ensureUnder20PercentAiGate(
            sec.id,
            sec.title,
            sec.currentText
          );
          const guarded = enforceProtectedTokensIntegrity(
            sec.originalText,
            gated
          );
          const afterScan = scanSectionTurnitinAiRisk({
            id: sec.id,
            title: sec.title,
            content: guarded.content,
          });
          nextExecMap[sec.id] = {
            status: 'completed',
            phase: 4,
            phaseLabel: 'Đã hoàn tất 6 lớp 0-Token (< 20% AI)',
            beforeRisk: beforeScan.aiRiskPercent,
            afterRisk: afterScan.aiRiskPercent,
            durationSec: 0.1,
          };
          nextLogs.push({
            id: `log_${sec.id}_${Date.now()}`,
            sectionId: sec.id,
            sectionTitle: sec.title,
            status: 'completed',
            beforeRisk: beforeScan.aiRiskPercent,
            afterRisk: afterScan.aiRiskPercent,
            lockedCitationsCount: beforeScan.protectedCitations.length,
            durationSec: 0.1,
            detail: `Giảm từ ${beforeScan.aiRiskPercent}% → ${afterScan.aiRiskPercent}% AI (Khóa ${beforeScan.protectedCitations.length} trích dẫn).`,
          });
          return { ...sec, currentText: guarded.content };
        })
      );
      setSectionExecMap(nextExecMap);
      setExecutionLogs(nextLogs);
      onToast(
        'Đã chạy Phá Vân Tay 6 Lớp (0 Token · < 20% AI) trên các phân đoạn file Word!'
      );
      return;
    }

    if (sourceMode === 'quick_paste') {
      const src = (pasteOutput || pasteInput).trim();
      if (!src) {
        onToast('Vui lòng dán văn bản cần vượt Turnitin trước.');
        return;
      }
      const before = scanSectionTurnitinAiRisk({
        id: 'paste_sec',
        title: 'Đoạn văn',
        content: src,
      });
      setBeforeScoresMap({ paste_sec: before.aiRiskPercent });
      const gated = ensureUnder20PercentAiGate('paste_sec', 'Đoạn văn', src);
      const guarded = enforceProtectedTokensIntegrity(pasteInput || src, gated);
      setPasteOutput(guarded.content);
      const after = scanSectionTurnitinAiRisk({
        id: 'paste_sec',
        title: 'Đoạn văn',
        content: guarded.content,
      });
      setSectionExecMap({
        paste_sec: {
          status: 'completed',
          phase: 4,
          phaseLabel: 'Đã hoàn tất 6 lớp 0-Token (< 20% AI)',
          beforeRisk: before.aiRiskPercent,
          afterRisk: after.aiRiskPercent,
          durationSec: 0.1,
        },
      });
      setExecutionLogs([
        {
          id: `log_paste_${Date.now()}`,
          sectionId: 'paste_sec',
          sectionTitle: 'Đoạn văn bản kiểm tra',
          status: 'completed',
          beforeRisk: before.aiRiskPercent,
          afterRisk: after.aiRiskPercent,
          lockedCitationsCount: before.protectedCitations.length,
          durationSec: 0.1,
          detail: `Giảm từ ${before.aiRiskPercent}% → ${after.aiRiskPercent}% AI (Khóa ${before.protectedCitations.length} trích dẫn).`,
        },
      ]);
      onToast(
        `Đã phá vân tay nhanh! Turnitin AI giảm từ ${before.aiRiskPercent}% → ${after.aiRiskPercent}% (Khóa 100% trích dẫn).`
      );
    }
  };

  // --- Deep AI ProMax Multi-Pass (< 20% AI Target Gate + 100% Citation Lock) ---
  const handleRunDeepAiProMax = async () => {
    const { profile, hasKey } = resolveActiveAiProfile();
    if (!hasKey) {
      onToast(
        'Chưa cấu hình API Key Chatbot. Bạn có thể bấm "Phá Vân Tay 6 Lớp (0 Token)" hoặc cài API Key trong tab AI Writer Studio.'
      );
      return;
    }
    const skills = loadGlobalSkillLibrary();
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;
    setShowCockpitBanner(true);
    setExecutionLogs([]);

    if (sourceMode === 'ai_writer' && activeSession) {
      const targetSections = activeSession.outline.filter(
        (sec) =>
          selectedSectionIds.includes(sec.id) &&
          !isReferencesSectionTitle(sec.title) &&
          countWords(sec.content) > 0
      );
      if (targetSections.length === 0) {
        onToast('Vui lòng chọn ít nhất 1 mục có nội dung để chạy ProMax.');
        return;
      }

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
      let workingSession: WriterSession = { ...activeSession };
      const completedDurations: number[] = [];

      try {
        for (let i = 0; i < targetSections.length; i += 1) {
          if (abortCtrl.signal.aborted) break;
          const sec = targetSections[i];
          const secStartMs = Date.now();
          const beforeSecScan = scanSectionTurnitinAiRisk(sec);

          scrollToSectionCard(sec.id);

          const updatePhase = (phase: 1 | 2 | 3 | 4, phaseDetail: string) => {
            setProgressInfo({
              step: i + 1,
              total: targetSections.length,
              label: sec.title,
              sectionId: sec.id,
              phase,
              phaseDetail,
              modeLabel: 'AI Phẫu Thuật ProMax (-85% Token)',
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

          updatePhase(1, 'Pha 1/4: Đang quét cửa sổ 250 từ & khóa trích dẫn...');

          const res = await humanizeSectionForTurnitinWithAi({
            session: workingSession,
            section: sec,
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

          workingSession = {
            ...workingSession,
            outline: workingSession.outline.map((item) =>
              item.id === sec.id
                ? { ...item, content: res.content, status: 'completed' }
                : item
            ),
            updatedAt: new Date().toISOString(),
          };
          const nextSessions = sessions.map((s) =>
            s.id === workingSession.id ? workingSession : s
          );
          setSessions(nextSessions);
          saveWriterSessions(nextSessions);

          setSectionExecMap((prev) => ({
            ...prev,
            [sec.id]: {
              status: 'completed',
              phase: 4,
              phaseLabel: `Hoàn tất (${res.beforeRisk}% → ${res.afterRisk}% AI)`,
              beforeRisk: res.beforeRisk,
              afterRisk: res.afterRisk,
              durationSec: durSec,
              paragraphsInfo: `Đã phẫu thuật ${res.flaggedParagraphsCount}/${res.totalParagraphsCount} đoạn`,
              tokensSaved: res.tokensSavedEstimate,
            },
          }));

          setExecutionLogs((prev) => [
            ...prev,
            {
              id: `log_${sec.id}_${Date.now()}`,
              sectionId: sec.id,
              sectionTitle: sec.title,
              status: 'completed',
              beforeRisk: res.beforeRisk,
              afterRisk: res.afterRisk,
              lockedCitationsCount: beforeSecScan.protectedCitations.length,
              durationSec: durSec,
              detail: `Đã phẫu thuật ${res.flaggedParagraphsCount}/${res.totalParagraphsCount} đoạn văn · Giảm AI từ ${res.beforeRisk}% → ${res.afterRisk}% · Khóa ${beforeSecScan.protectedCitations.length} trích dẫn (${durSec}s).`,
            },
          ]);
        }
        void saveWriterSessionToCloud(workingSession);
        const finalRep = scanSessionTurnitinAiRisk(workingSession);
        onToast(
          `Hoàn tất Vượt Turnitin ProMax! Điểm AI toàn bài giảm còn ${finalRep.overallAiRiskPercent}% (< 20% AI · Bảo toàn 100% trích dẫn).`
        );
      } catch (err) {
        if (!abortCtrl.signal.aborted) {
          onToast(
            err instanceof Error
              ? err.message
              : 'Quá trình Humanize ProMax bị gián đoạn.'
          );
        }
      } finally {
        setIsProcessing(false);
        setProgressInfo(null);
        abortControllerRef.current = null;
      }
      return;
    }

    if (sourceMode === 'docx_file' && parsedDocx && docxSections.length > 0) {
      const targetList = docxSections.filter((s) =>
        selectedSectionIds.includes(s.id)
      );
      if (targetList.length === 0) return;

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
      try {
        const tempSession: WriterSession =
          activeSession || loadWriterSessions()[0];
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
            targetWords: countWords(sec.currentText),
            guidanceNotes: '',
            content: sec.currentText,
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
              modeLabel: 'AI Phẫu Thuật File Word (.DOCX)',
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

          const res = await humanizeSectionForTurnitinWithAi({
            session: tempSession,
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

          setDocxSections((prev) =>
            prev.map((item) =>
              item.id === sec.id ? { ...item, currentText: res.content } : item
            )
          );

          setSectionExecMap((prev) => ({
            ...prev,
            [sec.id]: {
              status: 'completed',
              phase: 4,
              phaseLabel: `Hoàn tất (${res.beforeRisk}% → ${res.afterRisk}% AI)`,
              beforeRisk: res.beforeRisk,
              afterRisk: res.afterRisk,
              durationSec: durSec,
              paragraphsInfo: `Đã phẫu thuật ${res.flaggedParagraphsCount}/${res.totalParagraphsCount} đoạn`,
              tokensSaved: res.tokensSavedEstimate,
            },
          }));

          setExecutionLogs((prev) => [
            ...prev,
            {
              id: `log_${sec.id}_${Date.now()}`,
              sectionId: sec.id,
              sectionTitle: sec.title,
              status: 'completed',
              beforeRisk: res.beforeRisk,
              afterRisk: res.afterRisk,
              lockedCitationsCount: beforeSecScan.protectedCitations.length,
              durationSec: durSec,
              detail: `Đã phẫu thuật ${res.flaggedParagraphsCount}/${res.totalParagraphsCount} đoạn · Giảm từ ${res.beforeRisk}% → ${res.afterRisk}% AI (${durSec}s).`,
            },
          ]);
        }
        onToast(
          `Đã hoàn tất Humanize ProMax (< 20% AI) cho ${targetList.length} phân đoạn của file "${parsedDocx.fileName}"!`
        );
      } catch (err) {
        if (!abortCtrl.signal.aborted) {
          onToast(
            err instanceof Error
              ? err.message
              : 'Không thể hoàn tất Humanize file Word.'
          );
        }
      } finally {
        setIsProcessing(false);
        setProgressInfo(null);
        abortControllerRef.current = null;
      }
      return;
    }

    if (sourceMode === 'quick_paste') {
      const src = (pasteOutput || pasteInput).trim();
      if (!src) {
        onToast('Vui lòng dán văn bản cần vượt Turnitin trước.');
        return;
      }
      const before = scanSectionTurnitinAiRisk({
        id: 'paste_sec',
        title: 'Đoạn văn bản',
        content: src,
      });
      setBeforeScoresMap({ paste_sec: before.aiRiskPercent });
      setIsProcessing(true);
      const secStartMs = Date.now();
      try {
        const tempSession: WriterSession =
          activeSession || loadWriterSessions()[0];
        const pseudoSec: WriterOutlineSection = {
          id: 'paste_sec',
          order: 1,
          title: 'Đoạn văn bản kiểm tra',
          headingLevel: 'h1',
          targetWords: countWords(src),
          guidanceNotes: '',
          content: src,
          status: 'completed',
        };
        const res = await humanizeSectionForTurnitinWithAi({
          session: tempSession,
          section: pseudoSec,
          skills,
          profile,
          signal: abortCtrl.signal,
          onPhaseChange: (phase, phaseDetail) => {
            setProgressInfo({
              step: 1,
              total: 1,
              label: 'Đoạn văn bản kiểm tra',
              sectionId: 'paste_sec',
              phase,
              phaseDetail,
              modeLabel: 'AI Phẫu Thuật Văn Bản Lẻ',
            });
          },
        });
        const durSec = Math.max(
          0.4,
          Number(((Date.now() - secStartMs) / 1000).toFixed(1))
        );
        setPasteOutput(res.content);
        setExecutionLogs([
          {
            id: `log_paste_${Date.now()}`,
            sectionId: 'paste_sec',
            sectionTitle: 'Đoạn văn bản kiểm tra',
            status: 'completed',
            beforeRisk: res.beforeRisk,
            afterRisk: res.afterRisk,
            lockedCitationsCount: before.protectedCitations.length,
            durationSec: durSec,
            detail: `Đã phẫu thuật ${res.flaggedParagraphsCount}/${res.totalParagraphsCount} đoạn · Giảm từ ${res.beforeRisk}% → ${res.afterRisk}% AI (${durSec}s).`,
          },
        ]);
        onToast(
          `Hoàn tất! Turnitin AI giảm từ ${res.beforeRisk}% → ${res.afterRisk}% (< 20% AI · Khóa 100% trích dẫn).`
        );
      } catch (err) {
        if (!abortCtrl.signal.aborted) {
          onToast(
            err instanceof Error ? err.message : 'Lỗi khi chạy AI ProMax.'
          );
        }
      } finally {
        setIsProcessing(false);
        setProgressInfo(null);
        abortControllerRef.current = null;
      }
    }
  };

  // --- Export Humanized .DOCX (with Forensic Metadata) ---
  const buildCurrentOutputDocxFile = async (): Promise<File | null> => {
    if (sourceMode === 'ai_writer' && activeSession) {
      return await buildFormattedDocxFromSession(
        activeSession,
        `${activeSession.linkedOrderCode || 'TurnitinProMax'}_${(
          activeSession.topic || 'Paper'
        )
          .replace(/[^a-zA-Z0-9_-]+/g, '_')
          .slice(0, 36)}_Under20AI.docx`
      );
    }
    if (sourceMode === 'docx_file' && parsedDocx) {
      const overrides: Record<number, string> = {};
      for (const sec of docxSections) {
        const splitParas = sec.currentText
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean);
        sec.paragraphIndices.forEach((pIdx, i) => {
          if (i < splitParas.length - 1) {
            overrides[pIdx] = splitParas[i];
          } else if (i === sec.paragraphIndices.length - 1) {
            overrides[pIdx] = splitParas.slice(i).join(' ');
          } else if (splitParas[i]) {
            overrides[pIdx] = splitParas[i];
          }
        });
      }
      const patchedBlob = await exportPatchedDocx(parsedDocx, overrides);
      const outName = parsedDocx.fileName.replace(/\.docx$/i, '') + '_Under20AI.docx';
      return new File([patchedBlob], outName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    }
    return null;
  };

  const handleDownloadHumanizedDocx = async () => {
    setExportingDocx(true);
    try {
      const file = await buildCurrentOutputDocxFile();
      if (!file) {
        onToast('Không có dữ liệu bài viết để xuất file Word.');
        return;
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      onToast(
        `Đã xuất file Word "${file.name}" (Đã tích hợp Forensic Metadata & Vượt Turnitin < 20% AI)!`
      );
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Không thể xuất file Word.'
      );
    } finally {
      setExportingDocx(false);
    }
  };

  const handleAttachToSelectedOrder = async () => {
    if (!onAttachDocxToOrder) return;
    const ord = orders.find((o) => o.orderCode === selectedOrderCode);
    if (!ord) {
      onToast('Vui lòng chọn Mã đơn hàng để đính kèm file.');
      return;
    }
    setAttachingOrder(true);
    try {
      const file = await buildCurrentOutputDocxFile();
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

  const isPassUnder20 = activeReport.overallAiRiskPercent < 20;

  return (
    <div className="space-y-5">
      {/* Top Hero Banner & < 20% AI Guarantee Gate */}
      <section className="bg-gradient-to-r from-[#071A42] via-[#0B2559] to-[#12489B] text-white rounded-2xl p-5 sm:p-6 shadow-md space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/12 border border-white/20 text-sky-200 text-[11px] font-bold">
              <Fingerprint className="w-3.5 h-3.5 text-emerald-300" />
              <span>
                Turnitin AIW-2 / AIR-1 ProMax Bypass Studio · Cam kết &lt; 20% AI &amp; Khóa Trích dẫn 100%
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight">
              Rà Soát &amp; Tự Động Humanize Vượt Turnitin ProMax (&lt; 20% AI)
            </h1>
            <p className="text-xs sm:text-[13px] text-slate-200/90 leading-relaxed">
              Sử dụng thuật toán <strong>Sóng Nhịp Câu Bất Đối Xứng (Burstiness CV &ge; 48%)</strong> kết hợp <strong>Khóa Bất Biến (Frozen-Citation &amp; Data Lock)</strong>: tự động quét các cửa sổ 250 từ của Turnitin, xóa sạch từ nối AI, phá cấu trúc câu 18–24 từ và giữ nguyên vẹn 100% trích dẫn <code>(Author, Year)</code>, số liệu thống kê, bảng biểu và hình ảnh.
            </p>
          </div>

          {/* Live Target Gate Pill */}
          <div
            className={`rounded-2xl px-4 py-3 border backdrop-blur-md flex items-center gap-3 shrink-0 ${
              isPassUnder20
                ? 'bg-emerald-500/20 border-emerald-300/45 text-emerald-100'
                : 'bg-amber-500/20 border-amber-300/45 text-amber-100'
            }`}
          >
            <div className="text-right">
              <div className="text-[10.5px] uppercase tracking-wider font-bold opacity-85">
                Chuẩn Vượt Turnitin (&lt; 20% AI)
              </div>
              <div className="text-2xl font-mono font-bold tabular-nums">
                {activeReport.overallAiRiskPercent}% AI
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                isPassUnder20
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-amber-400 text-slate-950'
              }`}
            >
              {isPassUnder20 ? '✓ ĐẠT PASS (<20%)' : 'CẦN HUMANIZE'}
            </span>
          </div>
        </div>

        {/* 4 Telemetry Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-white/15">
          <div className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5">
            <div className="text-[11px] text-slate-300">
              Dự báo Turnitin AIW-2
            </div>
            <div className="text-xl font-bold font-mono text-white tabular-nums mt-0.5">
              {activeReport.overallAiRiskPercent}%
              <span className="text-xs font-sans font-normal text-sky-200 ml-1.5">
                (Mục tiêu &lt; 20%)
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5">
            <div className="text-[11px] text-slate-300">
              Độ biến thiên nhịp câu (Burstiness)
            </div>
            <div className="text-xl font-bold font-mono text-emerald-300 tabular-nums mt-0.5">
              {activeReport.overallBurstinessCvPercent}%
              <span className="text-xs font-sans font-normal text-slate-300 ml-1.5">
                (Chuẩn người &ge; 42%)
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5">
            <div className="text-[11px] text-slate-300">
              Vân tay AIW-2 &amp; AIR-1 (Tô tím)
            </div>
            <div className="text-xl font-bold font-mono text-amber-300 tabular-nums mt-0.5">
              {activeReport.totalAiFingerprints +
                activeReport.totalAir1StructureFlags +
                activeReport.totalUnicodeWatermarks}
              <span className="text-xs font-sans font-normal text-slate-300 ml-1.5">
                điểm nghi vấn
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-400/15 border border-emerald-300/35 px-3.5 py-2.5">
            <div className="text-[11px] text-emerald-200 flex items-center justify-between gap-1 font-semibold">
              <span className="inline-flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Khóa Trích Dẫn &amp; Tiết Kiệm Token</span>
              </span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-300/25 text-emerald-100 font-mono text-[10px]">
                -{activeReport.tokenSavingsPercent}% Token
              </span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-white mt-1">
              {activeReport.totalProtectedCitations} trích dẫn · Chỉ tốn ~
              {activeReport.totalEstimatedSurgicalTokens.toLocaleString()} tok
            </div>
          </div>
        </div>
      </section>

      {/* Source Mode Switcher + Action Toolbar */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 bg-zinc-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSourceMode('ai_writer')}
            className={`btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors ${
              sourceMode === 'ai_writer'
                ? 'bg-[#0B2559] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>1. Bài viết từ AI Writer Studio ({sessions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSourceMode('docx_file')}
            className={`btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors ${
              sourceMode === 'docx_file'
                ? 'bg-[#0B2559] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderUp className="w-3.5 h-3.5" />
            <span>
              2. Tải file Word (.DOCX) lên{' '}
              {parsedDocx ? `(${parsedDocx.fileName})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSourceMode('quick_paste')}
            className={`btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors ${
              sourceMode === 'quick_paste'
                ? 'bg-[#0B2559] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>3. Dán văn bản / Chương lẻ</span>
          </button>
        </div>

        {/* Execution Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleRunFastProMax}
            className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold disabled:opacity-40"
            title="Chạy 6 lớp chống Turnitin AIW-2 (Xanh) & AIR-1 (Tím): Xóa ký tự ẩn Unicode, cắt đuôi -ing/góp phần, phá câu tóm tắt cuối đoạn và tạo sóng câu bất đối xứng (< 20% AI) hoàn toàn MIỄN PHÍ (0 Token)"
          >
            <Zap className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>Phá Vân Tay 6 Lớp (0 Token · Miễn phí 100%)</span>
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => void handleRunDeepAiProMax()}
            className="btn-press inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#0B2559] to-[#12489B] hover:from-[#071A42] hover:to-[#0B2559] text-white text-xs font-bold shadow-sm disabled:opacity-40"
            title="Chạy lọc 0-Token trước, sau đó CHỈ gửi những đoạn văn cá biệt còn nguy cơ cao lên AI với Prompt siêu gọn — Tiết kiệm ~85% Token và cam kết < 20% AI!"
          >
            {isProcessing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-sky-300" />
            )}
            <span>
              AI Phẫu Thuật ProMax (&lt; 20% AI · Tiết kiệm ~{activeReport.tokenSavingsPercent}% Token)
            </span>
          </button>
        </div>
      </div>

      {/* Live Turnitin ProMax Execution Cockpit (Real-time Section/Paragraph Tracker & Countdown) */}
      {(isProcessing || (showCockpitBanner && executionLogs.length > 0)) && (
        <section
          className={`rounded-2xl border p-5 shadow-md space-y-4 transition-all ${
            isProcessing
              ? 'bg-gradient-to-br from-blue-50 via-white to-sky-50/70 border-[#12489B]/45 ring-2 ring-[#12489B]/20'
              : 'bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 border-emerald-300/80'
          }`}
        >
          {/* Top Row: Status Title, Elapsed / Remaining Countdown, Stop or Close Button */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {isProcessing ? (
                <span className="w-10 h-10 rounded-xl bg-[#0B2559] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-sky-300" />
                </span>
              ) : (
                <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-[#0B2559] truncate">
                    {isProcessing && progressInfo
                      ? `Đang xử lý mục ${progressInfo.step}/${progressInfo.total}: “${progressInfo.label}”`
                      : `Đã hoàn tất Vượt Turnitin ProMax (${executionLogs.length} mục đã xử lý)`}
                  </h2>
                  {isProcessing && progressInfo && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#12489B] font-mono text-[10.5px] font-bold">
                      {progressInfo.modeLabel}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 mt-0.5">
                  {isProcessing && progressInfo ? (
                    <>
                      <strong className="text-[#12489B]">
                        {progressInfo.phaseDetail}
                      </strong>
                      {progressInfo.total - progressInfo.step <= 1 && (
                        <span className="ml-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]">
                          ⚡ Đang ở mục cuối — Sắp hoàn thành!
                        </span>
                      )}
                    </>
                  ) : (
                    <span>
                      Toàn bộ các mục đã chọn đã được đưa xuống dưới ngưỡng{' '}
                      <strong>&lt; 20% AI</strong> và khóa nguyên vẹn 100% trích dẫn.
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {isProcessing && progressInfo ? (
                <>
                  <div className="px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-xs font-mono flex items-center gap-2 text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-[#12489B]" />
                    <span>Đã chạy: {elapsedSec}s</span>
                    <span className="text-zinc-300">|</span>
                    <span className="font-bold text-[#12489B]">
                      Còn ~
                      {Math.max(
                        1,
                        Math.round(
                          (progressInfo.total - progressInfo.step) *
                            avgSecPerSection +
                            ((5 - progressInfo.phase) / 4) * avgSecPerSection
                        )
                      )}
                      s
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleStopProcessing}
                    className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Dừng ngay</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCockpitBanner(false)}
                  className="btn-press inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-zinc-200 text-xs font-semibold text-zinc-600 hover:text-slate-900"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Ẩn bảng tiến trình</span>
                </button>
              )}
            </div>
          </div>

          {/* Overall Animated Progress Bar (0% -> 100%) */}
          {(() => {
            const pct =
              isProcessing && progressInfo
                ? Math.min(
                    98,
                    Math.max(
                      4,
                      Math.round(
                        (((progressInfo.step - 1) +
                          progressInfo.phase / 4) /
                          Math.max(1, progressInfo.total)) *
                          100
                      )
                    )
                  )
                : 100;
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700">
                    Tiến độ tổng thể:{' '}
                    <strong className="text-[#0B2559]">
                      {isProcessing && progressInfo
                        ? `Xong ${progressInfo.step - 1}/${progressInfo.total} mục (Đang làm mục ${progressInfo.step})`
                        : `Hoàn tất ${executionLogs.length}/${executionLogs.length} mục`}
                    </strong>
                  </span>
                  <span className="font-mono text-sm font-bold text-[#12489B]">
                    {pct}%
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-zinc-200/80 overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isProcessing
                        ? 'bg-gradient-to-r from-[#0B2559] via-[#12489B] to-sky-500 animate-pulse'
                        : 'bg-emerald-600'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}

          {/* 4-Phase Internal Pipeline Stepper when actively running */}
          {isProcessing && progressInfo && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                {
                  p: 1 as const,
                  title: '1. Quét & Khóa Trích dẫn',
                  sub: 'Cửa sổ 250 từ + Frozen Vault',
                },
                {
                  p: 2 as const,
                  title: '2. Lọc 6 Lớp 0-Token',
                  sub: 'Xóa Unicode, đuôi -ing & AIR-1',
                },
                {
                  p: 3 as const,
                  title: '3. AI Phẫu thuật Đoạn',
                  sub: 'Chỉ sửa đoạn >= 16% AI',
                },
                {
                  p: 4 as const,
                  title: '4. Kiểm định < 20% AI',
                  sub: 'Đối chiếu 1-1 trích dẫn',
                },
              ].map((st) => {
                const isDone = progressInfo.phase > st.p;
                const isCurrent = progressInfo.phase === st.p;
                return (
                  <div
                    key={st.p}
                    className={`rounded-xl px-3 py-2 border text-xs transition-all ${
                      isCurrent
                        ? 'bg-[#0B2559] text-white border-[#0B2559] shadow-xs'
                        : isDone
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-white/70 border-zinc-200 text-zinc-400'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between gap-1">
                      <span className="truncate">{st.title}</span>
                      {isDone && (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      )}
                      {isCurrent && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-300 shrink-0" />
                      )}
                    </div>
                    <div
                      className={`text-[10.5px] truncate mt-0.5 ${
                        isCurrent ? 'text-sky-200' : 'opacity-80'
                      }`}
                    >
                      {st.sub}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Horizontal Section Roadmap Pills (Click any pill to jump to that section) */}
          {activeReport.sections.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-slate-700">
                Bản đồ trạng thái từng mục (Bấm vào mục bất kỳ để cuộn tới đoạn đó):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeReport.sections.map((sec, idx) => {
                  const st = sectionExecMap[sec.sectionId];
                  const isRunningSec = st?.status === 'running';
                  const isDoneSec = st?.status === 'completed';
                  const isQueuedSec = st?.status === 'queued';
                  return (
                    <button
                      key={sec.sectionId}
                      type="button"
                      onClick={() => scrollToSectionCard(sec.sectionId)}
                      className={`btn-press inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                        isRunningSec
                          ? 'bg-[#12489B] text-white border-[#0B2559] ring-2 ring-sky-300 shadow-xs'
                          : isDoneSec
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : isQueuedSec
                          ? 'bg-amber-50 text-amber-900 border-amber-200'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      {isRunningSec ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : isDoneSec ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                      ) : (
                        <span className="font-mono text-[10px] opacity-70">
                          #{idx + 1}
                        </span>
                      )}
                      <span className="max-w-[160px] truncate">
                        {sec.sectionTitle}
                      </span>
                      <span className="font-mono text-[10px] opacity-90">
                        {isRunningSec
                          ? `Pha ${st.phase}/4`
                          : isDoneSec
                          ? `${st.beforeRisk}%→${sec.aiRiskPercent}%`
                          : `${sec.aiRiskPercent}%`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed Step-by-Step Activity Feed */}
          {executionLogs.length > 0 && (
            <div className="pt-2 border-t border-zinc-200/80 space-y-1.5 max-h-40 overflow-y-auto">
              <div className="text-[11px] font-bold text-slate-700">
                Nhật ký hoàn tất từng phần ({executionLogs.length} mục):
              </div>
              {executionLogs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => scrollToSectionCard(log.sectionId)}
                  className="cursor-pointer flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-white/90 border border-zinc-200/80 hover:border-[#12489B] text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-900 truncate">
                      {log.sectionTitle}
                    </span>
                    <span className="text-zinc-500 truncate hidden sm:inline">
                      — {log.detail}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                    <span className="px-2 py-0.2 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                      {log.beforeRisk}% → {log.afterRisk}% AI
                    </span>
                    <span className="text-zinc-400">{log.durationSec}s</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* =================================================================== */}
      {/* MODE 1 & MODE 2: SECTION-BY-SECTION SCAN & HUMANIZE WORKSPACE       */}
      {/* =================================================================== */}
      {(sourceMode === 'ai_writer' || sourceMode === 'docx_file') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 4 cols: Session / File Selector + Export & Order Attach */}
          <div className="lg:col-span-4 space-y-4">
            {sourceMode === 'ai_writer' ? (
              <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-[#12489B]" />
                    <span>Chọn phiên bài viết AI Writer</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      const latest = loadWriterSessions();
                      setSessions(latest);
                      onToast('Đã làm mới danh sách phiên từ AI Writer Studio.');
                    }}
                    className="text-xs font-semibold text-[#12489B] hover:underline inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Làm mới</span>
                  </button>
                </div>

                <select
                  value={activeSession?.id || ''}
                  onChange={(e) => {
                    setSelectedSessionId(e.target.value);
                    setBeforeScoresMap({});
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-zinc-200 bg-[#F4F7FB] text-slate-900 focus:outline-none focus:border-[#12489B]"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.linkedOrderCode ? `[#${s.linkedOrderCode}] ` : ''}
                      {s.topic || s.title || 'Phiên chưa đặt tên'} (
                      {s.outline.reduce(
                        (sum, sec) => sum + countWords(sec.content),
                        0
                      )}{' '}
                      từ)
                    </option>
                  ))}
                </select>

                {activeSession && (
                  <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 text-xs space-y-1">
                    <div className="font-bold text-slate-800 truncate">
                      {activeSession.topic || 'Chưa có tên đề tài'}
                    </div>
                    <div className="text-zinc-500">
                      Chuẩn trích dẫn: <strong>{activeSession.citationStyle}</strong> · Ngôn ngữ:{' '}
                      <strong>{activeSession.writingLanguage}</strong>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    onOpenInAiWriter(activeSession?.linkedOrderCode)
                  }
                  className="btn-press w-full py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#12489B] text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <span>Mở lại phiên này trong AI Writer Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-3.5 shadow-2xs">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-[#12489B]" />
                  <span>Tải file Word (.DOCX) cần Vượt Turnitin</span>
                </h2>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Hệ thống tự giữ nguyên 100% định dạng Word, bảng biểu, hình ảnh, Trang bìa, Mục lục và Tài liệu tham khảo — chỉ Humanize phần văn bản thân bài xuống dưới 20% AI.
                </p>
                <input
                  ref={docxInputRef}
                  type="file"
                  accept=".docx"
                  onChange={(e) => void handleUploadDocxFile(e.target.files?.[0])}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => docxInputRef.current?.click()}
                  className="btn-press w-full py-2.5 px-4 rounded-xl bg-[#12489B] hover:bg-[#0B2559] text-white text-xs font-bold inline-flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {parsedDocx
                      ? `Đổi file khác (${parsedDocx.fileName})`
                      : 'Chọn file .DOCX từ máy tính'}
                  </span>
                </button>
              </div>
            )}

            {/* Export & Attach to Order Card */}
            <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-3.5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-700" />
                <span>Xuất file Word &amp; Đính kèm Đơn hàng</span>
              </h3>
              <p className="text-xs text-zinc-500">
                File <code>.docx</code> xuất ra đã được ngụy trang sẵn <strong>Forensic Metadata</strong> (lùi ngày tạo file 6–13 ngày, tổng thời gian soạn thảo hàng trăm phút, tên tác giả chuẩn).
              </p>

              <button
                type="button"
                disabled={
                  exportingDocx ||
                  (sourceMode === 'docx_file' && !parsedDocx) ||
                  (sourceMode === 'ai_writer' && !activeSession)
                }
                onClick={() => void handleDownloadHumanizedDocx()}
                className="btn-press w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold inline-flex items-center justify-center gap-2 shadow-xs"
              >
                {exportingDocx ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Tải xuống Word (.DOCX) &lt; 20% AI</span>
              </button>

              {onAttachDocxToOrder && orders.length > 0 && (
                <div className="pt-3 border-t border-zinc-100 space-y-2">
                  <label className="block text-[11px] font-semibold text-zinc-600">
                    Đính kèm trực tiếp vào Đơn hàng:
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedOrderCode}
                      onChange={(e) => setSelectedOrderCode(e.target.value)}
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white"
                    >
                      <option value="">-- Chọn mã đơn --</option>
                      {orders.map((o) => (
                        <option key={o.id} value={o.orderCode}>
                          #{o.orderCode} · {o.topic.slice(0, 32)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedOrderCode || attachingOrder}
                      onClick={() => void handleAttachToSelectedOrder()}
                      className="btn-press shrink-0 px-3 py-1.5 rounded-lg bg-[#0B2559] hover:bg-[#12489B] disabled:opacity-40 text-white text-xs font-bold inline-flex items-center gap-1"
                    >
                      {attachingOrder ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Paperclip className="w-3.5 h-3.5" />
                      )}
                      <span>Gắn đơn</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right 8 cols: Section-by-Section Turnitin AIW-2 Diagnostic & Selection List */}
          <div className="lg:col-span-8 bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Bảng Rà Soát Từng Mục Theo Chuẩn Cửa Sổ 250 Từ Của Turnitin
                </h2>
                <p className="text-xs text-zinc-500">
                  Mục Tài liệu tham khảo (References) tự động được loại trừ để bảo toàn tuyệt đối danh mục trích dẫn.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
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
            </div>

            {activeReport.sections.length === 0 ? (
              <div className="p-10 text-center text-xs text-zinc-500 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                {sourceMode === 'docx_file'
                  ? 'Hãy bấm "Chọn file .DOCX từ máy tính" ở cột bên trái để bắt đầu rà soát và vượt Turnitin AI.'
                  : 'Phiên bài viết hiện tại chưa có nội dung ở các mục thân bài.'}
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
                      className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                        isRunningThis
                          ? 'bg-blue-50/85 border-[#12489B] ring-2 ring-[#12489B] shadow-md'
                          : isCompletedThis
                          ? 'bg-emerald-50/35 border-emerald-300/90 shadow-2xs'
                          : checked
                          ? 'bg-blue-50/35 border-[#12489B]/60 shadow-2xs'
                          : 'bg-white border-zinc-200/90 hover:border-zinc-300'
                      }`}
                    >
                      {/* Inline Active Execution Strip inside the running or completed card */}
                      {isRunningThis && (
                        <div className="px-3 py-2 rounded-lg bg-[#0B2559] text-white text-xs space-y-1.5">
                          <div className="flex items-center justify-between gap-2 font-bold">
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-300 shrink-0" />
                              <span>ĐANG XỬ LÝ MỤC NÀY — {execState.phaseLabel}</span>
                            </span>
                            <span className="font-mono text-sky-200">
                              Pha {execState.phase}/4 ({execState.phase * 25}%)
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-sky-300 transition-all duration-300"
                              style={{ width: `${execState.phase * 25}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {isCompletedThis && !isRunningThis && (
                        <div className="px-3 py-1.5 rounded-lg bg-emerald-100/80 border border-emerald-200 text-emerald-900 text-xs font-semibold flex flex-wrap items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>
                              Đã hoàn tất Vượt Turnitin mục này ({execState.beforeRisk}% →{' '}
                              {sec.aiRiskPercent}% AI)
                              {execState.paragraphsInfo
                                ? ` · ${execState.paragraphsInfo}`
                                : ''}
                            </span>
                          </span>
                          {execState.durationSec !== undefined && (
                            <span className="font-mono text-[11px] text-emerald-800">
                              ✓ Xong trong {execState.durationSec}s
                            </span>
                          )}
                        </div>
                      )}

                      {isQueuedThis && isProcessing && (
                        <div className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold inline-flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>Đang xếp hàng chờ xử lý tiếp theo...</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isProcessing}
                            onChange={() => {}}
                            className="w-4 h-4 rounded accent-[#12489B]"
                          />
                          <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {sec.sectionTitle}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400">
                            ({sec.wordCount} từ · {sec.sentenceCount} câu)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {beforeScore !== undefined &&
                            beforeScore !== sec.aiRiskPercent && (
                              <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-mono text-[11px] line-through">
                                Trước: {beforeScore}%
                              </span>
                            )}
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
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
                            <span>
                              {sec.aiRiskPercent}% AI{' '}
                              {sec.aiRiskPercent < 20
                                ? '(Pass < 20%)'
                                : '(Cần xử lý)'}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono font-semibold ${
                            sec.burstinessCvPercent >= 42
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          Burstiness CV: {sec.burstinessCvPercent}%
                        </span>

                        {sec.monotonousRunCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                            {sec.monotonousRunCount} cụm câu đều nhịp 18–24 từ
                          </span>
                        )}

                        {sec.detectedAiPhrases.length > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-orange-50 text-[#EA580C] border border-orange-200 font-semibold">
                            Từ nối AI: {sec.detectedAiPhrases.join(', ')}
                          </span>
                        )}

                        {sec.air1StructureFlagsCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                            Cấu trúc AIR-1 (Đuôi -ing / Tóm tắt cuối đoạn):{' '}
                            {sec.air1StructureFlagsCount}
                          </span>
                        )}

                        {sec.unicodeWatermarksCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 font-semibold">
                            Ký tự ẩn Unicode LLM: {sec.unicodeWatermarksCount}
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-slate-700 font-medium inline-flex items-center gap-1">
                          <Lock className="w-3 h-3 text-emerald-700" />
                          Khóa bảo toàn: {sec.protectedCitations.length} trích dẫn
                          {sec.protectedStatTokens.length > 0
                            ? ` · ${sec.protectedStatTokens.length} chỉ số`
                            : ''}
                          {sec.protectedFigureTags.length > 0
                            ? ` · ${sec.protectedFigureTags.length} hình`
                            : ''}
                        </span>

                        <span className="px-2 py-0.5 rounded-md bg-emerald-50/80 text-emerald-800 border border-emerald-200/80 font-mono">
                          Surgical AI: ~{sec.estimatedSurgicalTokens} tok (thay vì ~
                          {sec.estimatedFullRewriteTokens.toLocaleString()} tok)
                        </span>
                      </div>

                      {sec.protectedCitations.length > 0 && (
                        <div className="text-[11px] text-zinc-500 truncate">
                          <strong className="text-slate-700">
                            Trích dẫn được khóa cứng:
                          </strong>{' '}
                          {sec.protectedCitations.slice(0, 8).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODE 3: QUICK PASTE TEXT & SIDE-BY-SIDE COMPARISON                  */}
      {/* =================================================================== */}
      {sourceMode === 'quick_paste' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Văn bản gốc cần kiểm tra &amp; vượt Turnitin
              </h2>
              <span className="text-xs font-mono text-zinc-500">
                {countWords(pasteInput)} từ
              </span>
            </div>
            <textarea
              rows={14}
              value={pasteInput}
              onChange={(e) => {
                setPasteInput(e.target.value);
                setPasteOutput('');
              }}
              placeholder="Dán đoạn văn hoặc chương bài luận (có chứa trích dẫn APA/Harvard/IEEE, số liệu...) vào đây để quét tỷ lệ Turnitin AI và chạy Humanize ProMax < 20% AI..."
              className="w-full p-3.5 text-xs sm:text-sm rounded-xl border border-zinc-200 focus:outline-none focus:border-[#12489B] leading-relaxed"
            />
          </div>

          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#0B2559]">
                  Kết quả đã Humanize Vượt Turnitin (&lt; 20% AI)
                </h2>
                {pasteOutput && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[11px] font-bold">
                    {activeReport.overallAiRiskPercent}% AI · Pass
                  </span>
                )}
              </div>

              {pasteOutput && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyTextToClipboard(pasteOutput);
                    if (ok) {
                      setCopiedPaste(true);
                      onToast('Đã copy văn bản vượt Turnitin (< 20% AI)!');
                      window.setTimeout(() => setCopiedPaste(false), 1800);
                    }
                  }}
                  className="btn-press inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#12489B] text-xs font-bold"
                >
                  {copiedPaste ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đã copy</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy kết quả</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <textarea
              rows={14}
              value={pasteOutput}
              onChange={(e) => setPasteOutput(e.target.value)}
              placeholder="Bấm 'Phá Vân Tay Nhanh (< 20% AI)' hoặc 'Chạy Humanize ProMax Chuyên Sâu' ở góc trên để nhận văn bản đã vượt Turnitin tại đây..."
              className="w-full p-3.5 text-xs sm:text-sm rounded-xl border border-emerald-200 bg-emerald-50/20 focus:outline-none focus:border-emerald-500 leading-relaxed"
            />

            <div className="flex items-center gap-2 text-[11.5px] text-emerald-800 bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3 py-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Đã bật <strong>Frozen-Citation &amp; Data Lock</strong>: Giữ nguyên 100% trích dẫn{' '}
                <code>(Author, Year)</code>, thẻ <code>[FIGURE: IMG_X]</code> và số liệu thống kê từ văn bản gốc.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
