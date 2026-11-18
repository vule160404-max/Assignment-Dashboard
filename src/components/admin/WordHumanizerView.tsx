import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FolderUp,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
  Upload,
} from 'lucide-react';
import { buildExtensionZipBlob } from '../../lib/extensionZip';
import {
  EXPECTED_EXTENSION_VERSION,
  HixBridgeStatus,
  HixBypassMode,
  cancelHixExtensionRun,
  checkHixBridgeStatus,
  humanizeChunkViaExtension,
} from '../../lib/hixBridgeClient';
import {
  GlitchCheckResult,
  HumanizeChunk,
  MIN_HIX_CHUNK_WORDS,
  ParsedWordDocument,
  buildSentenceBoundaryChunks,
  computeWordDiff,
  countWords,
  createWordDocumentFromText,
  detectHixGlitch,
  exportPatchedDocx,
  parseDocxFile,
  splitParagraphIntoTerminalPeriodSentences,
} from '../../lib/wordHumanizer';
import { OrderRecord } from '../../types/domain';

type PlaybackStatus =
  | 'idle'
  | 'ready'
  | 'highlighting'
  | 'processing_hix'
  | 'review_glitch'
  | 'pasting'
  | 'paused'
  | 'completed';

interface ChunkResult {
  outputText: string;
  accepted: boolean;
}

interface GlitchReviewPayload {
  chunk: HumanizeChunk;
  rawOutput: string;
  editedOutput: string;
  check: GlitchCheckResult;
}

interface WordHumanizerViewProps {
  orders: OrderRecord[];
  initialOrderCode?: string;
  onAttachDocxToOrder?: (order: OrderRecord, file: File) => Promise<void>;
  onToast: (msg: string) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightSuspectTokens(text: string, tokens: string[]) {
  if (!tokens || tokens.length === 0) return text;
  const pattern = tokens
    .filter((t) => t.trim().length > 0)
    .map(escapeRegExp)
    .join('|');
  if (!pattern) return text;

  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, idx) => {
    const isSuspect = tokens.some((t) => t.toLowerCase() === part.toLowerCase());
    if (!isSuspect) return <span key={idx}>{part}</span>;
    return (
      <mark
        key={idx}
        className="bg-red-100 text-[#DC2626] font-semibold px-1 rounded underline decoration-[#DC2626]/60"
      >
        {part}
      </mark>
    );
  });
}

export function WordHumanizerView({
  orders,
  initialOrderCode = '',
  onAttachDocxToOrder,
  onToast,
}: WordHumanizerViewProps) {
  // Bridge & Extension connection state
  const [bridgeStatus, setBridgeStatus] = useState<HixBridgeStatus>({
    extensionInstalled: false,
    extensionVersion: '',
    hixTabOpen: false,
    hixTabTitle: '',
    hixTabUrl: '',
  });
  const [checkingBridge, setCheckingBridge] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // Document & Chunks state
  const [wordDoc, setWordDoc] = useState<ParsedWordDocument | null>(null);
  const [chunks, setChunks] = useState<HumanizeChunk[]>([]);
  const [chunkResults, setChunkResults] = useState<Record<string, ChunkResult>>({});
  const [maxWordsPerChunk, setMaxWordsPerChunk] = useState<number>(115);
  const [hixMode, setHixMode] = useState<HixBypassMode>('Balanced');
  const [selectedOrderCode, setSelectedOrderCode] = useState<string>(initialOrderCode);

  // Optional paste-to-create Word mode
  const [showPasteCreator, setShowPasteCreator] = useState(false);
  const [pasteDocTitle, setPasteDocTitle] = useState('assignment-draft.docx');
  const [pasteDocBody, setPasteDocBody] = useState('');

  // Playback Presentation state
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('idle');
  const [currentChunkIdx, setCurrentChunkIdx] = useState<number>(0);
  const [playbackError, setPlaybackError] = useState<string>('');
  const [hixStepText, setHixStepText] = useState<string>('');
  const [glitchReview, setGlitchReview] = useState<GlitchReviewPayload | null>(null);
  const [showOverwriteTint, setShowOverwriteTint] = useState<boolean>(true);
  const [inspectChunkId, setInspectChunkId] = useState<string | null>(null);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [attachingOrder, setAttachingOrder] = useState(false);
  const [downloadingExt, setDownloadingExt] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeSpanRef = useRef<HTMLSpanElement | null>(null);
  const glitchPanelRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Async run loop control refs (prevents stale closures on Pause/Stop/Retry)
  const runControlRef = useRef<{
    runId: number;
    paused: boolean;
    aborted: boolean;
  }>({ runId: 0, paused: false, aborted: false });

  const glitchDecisionResolverRef = useRef<
    ((decision: { action: 'accept'; text: string } | { action: 'retry' } | { action: 'abort' }) => void) | null
  >(null);

  useEffect(() => {
    if (initialOrderCode) {
      setSelectedOrderCode(initialOrderCode);
    }
  }, [initialOrderCode]);

  const refreshBridge = useCallback(async () => {
    setCheckingBridge(true);
    try {
      const st = await checkHixBridgeStatus();
      setBridgeStatus(st);
    } finally {
      setCheckingBridge(false);
    }
  }, []);

  useEffect(() => {
    void refreshBridge();
  }, [refreshBridge]);

  // Rebuild chunks whenever wordDoc or maxWordsPerChunk changes (only before running)
  useEffect(() => {
    if (!wordDoc) {
      setChunks([]);
      return;
    }
    const built = buildSentenceBoundaryChunks(wordDoc.paragraphs, maxWordsPerChunk);
    setChunks(built);
  }, [wordDoc, maxWordsPerChunk]);

  // Smoothly scroll the currently highlighted sentence block into view during playback
  useEffect(() => {
    if (
      (playbackStatus === 'highlighting' ||
        playbackStatus === 'processing_hix' ||
        playbackStatus === 'pasting') &&
      activeSpanRef.current
    ) {
      activeSpanRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [playbackStatus, currentChunkIdx]);

  useEffect(() => {
    if (playbackStatus === 'review_glitch' && glitchPanelRef.current) {
      glitchPanelRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [playbackStatus, glitchReview]);

  const activeOrder = useMemo(
    () => orders.find((o) => o.orderCode === selectedOrderCode) || null,
    [orders, selectedOrderCode]
  );

  const completedCount = useMemo(
    () => chunks.filter((c) => chunkResults[c.id]?.accepted).length,
    [chunks, chunkResults]
  );

  const totalDocumentWords = useMemo(() => {
    if (!wordDoc) return 0;
    return wordDoc.paragraphs.reduce((sum, p) => sum + countWords(p.text), 0);
  }, [wordDoc]);

  const chunkedWordsTotal = useMemo(
    () => chunks.reduce((sum, c) => sum + c.wordCount, 0),
    [chunks]
  );

  const handleUploadDocx = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      onToast('Vui lòng chọn tệp Word định dạng .docx.');
      return;
    }
    try {
      const parsed = await parseDocxFile(file);
      const nonEmpty = parsed.paragraphs.filter((p) => !p.isEmpty);
      if (nonEmpty.length === 0) {
        onToast('File Word này không chứa văn bản.');
        return;
      }
      runControlRef.current.aborted = true;
      runControlRef.current.runId += 1;
      setWordDoc(parsed);
      setChunkResults({});
      setCurrentChunkIdx(0);
      setPlaybackError('');
      setGlitchReview(null);
      setInspectChunkId(null);
      setPlaybackStatus('ready');
      onToast(`Đã tải bài Word "${parsed.fileName}" (${countWords(nonEmpty.map((p) => p.text).join(' '))} từ).`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Không thể đọc file Word.');
    }
  };

  const handleCreateFromPaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteDocBody.trim()) {
      onToast('Vui lòng dán nội dung bài làm trước.');
      return;
    }
    try {
      const parsed = await createWordDocumentFromText(pasteDocTitle, pasteDocBody);
      runControlRef.current.aborted = true;
      runControlRef.current.runId += 1;
      setWordDoc(parsed);
      setChunkResults({});
      setCurrentChunkIdx(0);
      setPlaybackError('');
      setGlitchReview(null);
      setInspectChunkId(null);
      setShowPasteCreator(false);
      setPlaybackStatus('ready');
      onToast(`Đã khởi tạo bản trình chiếu Word "${parsed.fileName}".`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Không thể tạo tài liệu Word.');
    }
  };

  const waitForGlitchDecision = (
    payload: GlitchReviewPayload
  ): Promise<{ action: 'accept'; text: string } | { action: 'retry' } | { action: 'abort' }> => {
    setGlitchReview(payload);
    setPlaybackStatus('review_glitch');
    return new Promise((resolve) => {
      glitchDecisionResolverRef.current = resolve;
    });
  };

  const runPlaybackFromIndex = async (startIdx: number) => {
    if (!wordDoc || chunks.length === 0) return;

    const statusNow = await checkHixBridgeStatus();
    setBridgeStatus(statusNow);

    if (!statusNow.extensionInstalled) {
      setShowInstallGuide(true);
      setPlaybackError(
        'Chưa phát hiện Chrome Extension "AssignTrack HIX Bridge". Hãy tải và cài Extension rồi tải lại trang (F5).'
      );
      setPlaybackStatus('paused');
      return;
    }

    if (!statusNow.hixTabOpen) {
      setPlaybackError(
        'Chưa thấy tab hixbypass.com đang mở trong Chrome. Hãy mở & đăng nhập https://hixbypass.com/ trước khi chạy.'
      );
      setPlaybackStatus('paused');
      return;
    }

    const myRunId = runControlRef.current.runId + 1;
    runControlRef.current = {
      runId: myRunId,
      paused: false,
      aborted: false,
    };
    setPlaybackError('');
    setGlitchReview(null);
    setInspectChunkId(null);

    let idx = startIdx;
    while (idx < chunks.length) {
      const ctrl = runControlRef.current;
      if (ctrl.runId !== myRunId || ctrl.aborted || ctrl.paused) {
        return;
      }

      const chunk = chunks[idx];
      if (chunkResults[chunk.id]?.accepted) {
        idx += 1;
        continue;
      }

      setCurrentChunkIdx(idx);

      // Step 1: Visual highlight / "AI tô đen đoạn cần humanize"
      setPlaybackStatus('highlighting');
      await sleep(550);

      if (
        runControlRef.current.runId !== myRunId ||
        runControlRef.current.aborted ||
        runControlRef.current.paused
      ) {
        return;
      }

      // Step 2: Send complete sentence chunk to logged-in hixbypass.com tab via Chrome Extension
      setPlaybackStatus('processing_hix');
      setHixStepText('Đang dán văn bản sang tab HIX Bypass...');
      abortControllerRef.current?.abort();
      const chunkAbort = new AbortController();
      abortControllerRef.current = chunkAbort;

      const res = await humanizeChunkViaExtension(chunk.text, hixMode, {
        signal: chunkAbort.signal,
        onStepUpdate: (step) => setHixStepText(step),
      });
      setHixStepText('');

      if (
        runControlRef.current.runId !== myRunId ||
        runControlRef.current.aborted ||
        runControlRef.current.paused
      ) {
        return;
      }

      if (!res.ok || !res.outputText) {
        const errMsg =
          res.error || 'HIX Bypass không trả về văn bản hợp lệ. Vui lòng kiểm tra tab hixbypass.com.';
        setPlaybackError(errMsg);
        onToast(errMsg);
        runControlRef.current.paused = true;
        setPlaybackStatus('paused');
        return;
      }

      // Step 3: Check output for garbled characters / corrupted HIX generation
      const glitchCheck = detectHixGlitch(chunk.text, res.outputText);
      let finalOutputText = res.outputText;

      if (glitchCheck.hasGlitch) {
        const decision = await waitForGlitchDecision({
          chunk,
          rawOutput: res.outputText,
          editedOutput: res.outputText,
          check: glitchCheck,
        });

        setGlitchReview(null);
        glitchDecisionResolverRef.current = null;

        if (
          runControlRef.current.runId !== myRunId ||
          runControlRef.current.aborted ||
          decision.action === 'abort'
        ) {
          return;
        }

        if (decision.action === 'retry') {
          // Loop stays at same idx to retry HIX Bypass cleanly
          onToast(`Đang chạy lại đoạn ${idx + 1}/${chunks.length} trên HIX Bypass...`);
          continue;
        }

        finalOutputText = decision.text.trim();
      }

      // Step 4: Visual overwrite / "Dán đè lên đoạn văn cũ"
      setPlaybackStatus('pasting');
      setChunkResults((prev) => ({
        ...prev,
        [chunk.id]: {
          outputText: finalOutputText,
          accepted: true,
        },
      }));
      await sleep(520);

      idx += 1;
    }

    if (runControlRef.current.runId === myRunId && !runControlRef.current.aborted) {
      setPlaybackStatus('completed');
      onToast('Đã hoàn thành trình chiếu & Humanize toàn bộ bài Word!');
    }
  };

  const handleStartOrResume = () => {
    if (playbackStatus === 'paused') {
      void runPlaybackFromIndex(currentChunkIdx);
      return;
    }
    const firstPending = chunks.findIndex((c) => !chunkResults[c.id]?.accepted);
    const startAt = firstPending >= 0 ? firstPending : 0;
    void runPlaybackFromIndex(startAt);
  };

  const handlePause = () => {
    runControlRef.current.paused = true;
    abortControllerRef.current?.abort();
    setHixStepText('');
    void cancelHixExtensionRun();
    if (glitchDecisionResolverRef.current) {
      glitchDecisionResolverRef.current({ action: 'abort' });
      glitchDecisionResolverRef.current = null;
      setGlitchReview(null);
    }
    setPlaybackStatus('paused');
    onToast(`Đã tạm dừng tại đoạn ${currentChunkIdx + 1}/${chunks.length}.`);
  };

  const handleStopAndReset = () => {
    runControlRef.current.aborted = true;
    runControlRef.current.runId += 1;
    abortControllerRef.current?.abort();
    setHixStepText('');
    void cancelHixExtensionRun();
    if (glitchDecisionResolverRef.current) {
      glitchDecisionResolverRef.current({ action: 'abort' });
      glitchDecisionResolverRef.current = null;
      setGlitchReview(null);
    }
    setChunkResults({});
    setCurrentChunkIdx(0);
    setPlaybackError('');
    setInspectChunkId(null);
    setPlaybackStatus(wordDoc ? 'ready' : 'idle');
  };

  // Reconstruct current text of every paragraph with accepted humanized chunks pasted in place
  const updatedParagraphTexts = useMemo(() => {
    const map: Record<number, string> = {};
    if (!wordDoc) return map;

    const chunksByPara = new Map<number, HumanizeChunk[]>();
    chunks.forEach((c) => {
      const list = chunksByPara.get(c.paragraphIndex) || [];
      list.push(c);
      chunksByPara.set(c.paragraphIndex, list);
    });

    for (const para of wordDoc.paragraphs) {
      const paraChunks = chunksByPara.get(para.index);
      if (!paraChunks || paraChunks.length === 0) continue;

      let rebuilt = '';
      let cursor = 0;
      let anyReplaced = false;

      for (const chk of paraChunks) {
        if (chk.startOffset > cursor) {
          rebuilt += para.text.slice(cursor, chk.startOffset);
        }
        const res = chunkResults[chk.id];
        if (res?.accepted) {
          rebuilt += res.outputText;
          anyReplaced = true;
        } else {
          rebuilt += para.text.slice(chk.startOffset, chk.endOffset);
        }
        cursor = chk.endOffset;
      }

      if (cursor < para.text.length) {
        rebuilt += para.text.slice(cursor);
      }

      if (anyReplaced) {
        map[para.index] = rebuilt;
      }
    }

    return map;
  }, [wordDoc, chunks, chunkResults]);

  const buildOutputDocxFile = async (): Promise<File | null> => {
    if (!wordDoc) return null;
    const blob = await exportPatchedDocx(wordDoc, updatedParagraphTexts);
    const baseName = wordDoc.fileName.replace(/\.docx$/i, '');
    return new File([blob], `${baseName}_humanized.docx`, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  };

  const handleDownloadDocx = async () => {
    if (!wordDoc) return;
    setExportingDocx(true);
    try {
      const outFile = await buildOutputDocxFile();
      if (!outFile) return;
      const url = URL.createObjectURL(outFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = outFile.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onToast(`Đã tải xuống "${outFile.name}".`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Xuất file Word thất bại.');
    } finally {
      setExportingDocx(false);
    }
  };

  const handleAttachToOrder = async () => {
    if (!activeOrder || !onAttachDocxToOrder || !wordDoc) return;
    setAttachingOrder(true);
    try {
      const outFile = await buildOutputDocxFile();
      if (!outFile) return;
      await onAttachDocxToOrder(activeOrder, outFile);
      onToast(`Đã đính kèm "${outFile.name}" vào đơn #${activeOrder.orderCode}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Không thể đính kèm vào đơn hàng.');
    } finally {
      setAttachingOrder(false);
    }
  };

  const handleDownloadExtensionZip = async () => {
    setShowInstallGuide(true);
    setDownloadingExt(true);
    try {
      let zipBlob: Blob | null = null;
      try {
        const res = await fetch('/api/extension/hix-bridge.zip');
        const ctype = (res.headers.get('content-type') || '').toLowerCase();
        if (res.ok && ctype.includes('zip')) {
          zipBlob = await res.blob();
        }
      } catch {
        // Fallback to in-browser packaging below
      }

      if (!zipBlob) {
        zipBlob = await buildExtensionZipBlob();
      }

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'assigntrack-hix-bridge.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      onToast('Đã tải xuống "assigntrack-hix-bridge.zip". Hãy giải nén và làm theo 3 bước bên dưới.');
    } catch {
      onToast('Không thể đóng gói file Extension. Vui lòng thử lại.');
    } finally {
      setDownloadingExt(false);
    }
  };

  const isRunning =
    playbackStatus === 'highlighting' ||
    playbackStatus === 'processing_hix' ||
    playbackStatus === 'pasting';

  const progressPercent =
    chunks.length > 0 ? Math.round((completedCount / chunks.length) * 100) : 0;

  const activeChunk = chunks[currentChunkIdx] || null;
  const inspectedChunk = chunks.find((c) => c.id === inspectChunkId) || null;
  const inspectedResult = inspectedChunk ? chunkResults[inspectedChunk.id] : null;

  let statusHeadline = 'Sẵn sàng trình chiếu';
  if (playbackStatus === 'highlighting') {
    statusHeadline = `AI đang tô đen đoạn ${currentChunkIdx + 1}/${chunks.length}...`;
  } else if (playbackStatus === 'processing_hix') {
    statusHeadline = `Đoạn ${currentChunkIdx + 1}/${chunks.length}: ${
      hixStepText || 'Đang gửi sang tab HIX Bypass...'
    }`;
  } else if (playbackStatus === 'review_glitch') {
    statusHeadline = `Tạm dừng kiểm duyệt lỗi văn bản (Đoạn ${currentChunkIdx + 1}/${chunks.length})`;
  } else if (playbackStatus === 'pasting') {
    statusHeadline = `Đang dán đè văn bản mới lên đoạn ${currentChunkIdx + 1}/${chunks.length}...`;
  } else if (playbackStatus === 'paused') {
    statusHeadline = `Đã tạm dừng tại đoạn ${currentChunkIdx + 1}/${chunks.length}`;
  } else if (playbackStatus === 'completed') {
    statusHeadline = `Hoàn tất dán đè ${completedCount}/${chunks.length} đoạn`;
  }

  const isOutdatedExtension =
    bridgeStatus.extensionInstalled &&
    bridgeStatus.extensionVersion !== EXPECTED_EXTENSION_VERSION;

  return (
    <div className="space-y-5">
      {/* 1. Extension & HIX Bypass Tab Connection Bar */}
      <section className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              Trình chiếu Word & Tự động Humanize qua HIX Bypass
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span
                className={
                  bridgeStatus.extensionInstalled
                    ? isOutdatedExtension
                      ? 'font-medium text-[#D97706]'
                      : 'font-medium text-[#16A34A]'
                    : 'font-medium text-[#D97706]'
                }
              >
                {bridgeStatus.extensionInstalled
                  ? isOutdatedExtension
                    ? `Extension: Bản cũ (${bridgeStatus.extensionVersion || '1.0.0'}) — nên cập nhật lên ${EXPECTED_EXTENSION_VERSION}`
                    : `Extension: Đã kết nối (v${bridgeStatus.extensionVersion})`
                  : 'Extension: Chưa cài đặt trên Chrome'}
              </span>
              <span aria-hidden="true" className="text-zinc-300">
                ·
              </span>
              <span
                className={
                  bridgeStatus.hixTabOpen
                    ? 'font-medium text-[#16A34A]'
                    : 'font-medium text-zinc-500'
                }
              >
                {bridgeStatus.hixTabOpen
                  ? 'Tab HIX Bypass: Đang mở & sẵn sàng'
                  : 'Tab HIX Bypass: Chưa mở trong Chrome'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void refreshBridge()}
              disabled={checkingBridge}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-slate-800 rounded-lg whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingBridge ? 'animate-spin' : ''}`} />
              <span>Kiểm tra kết nối</span>
            </button>

            <a
              href="https://hixbypass.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-[#4338CA] rounded-lg whitespace-nowrap"
            >
              <span>Mở HIX Bypass</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              disabled={downloadingExt}
              onClick={() => void handleDownloadExtensionZip()}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0F172A] hover:bg-slate-800 text-white rounded-lg whitespace-nowrap disabled:opacity-45"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {downloadingExt ? 'Đang đóng gói...' : 'Tải Chrome Extension (.zip)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowInstallGuide((v) => !v)}
              className="btn-press px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-slate-900"
            >
              {showInstallGuide ? 'Ẩn hướng dẫn' : 'Cách cài Extension'}
            </button>
          </div>
        </div>

        {showInstallGuide && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-xs text-zinc-700 space-y-2">
            <p className="font-semibold text-slate-900">
              Hướng dẫn cài Extension kết nối tab HIX Bypass (chỉ làm 1 lần, 30 giây):
            </p>
            <ol className="list-decimal list-inside space-y-1 leading-relaxed">
              <li>
                Nhấn nút <span className="font-semibold text-slate-900">Tải Chrome Extension (.zip)</span> ở trên rồi giải nén ra một thư mục trên máy tính.
              </li>
              <li>
                Mở tab mới trên Chrome truy cập <span className="font-mono font-semibold text-slate-900">chrome://extensions</span>, gạt bật chế độ <span className="font-semibold">Developer mode</span> (góc phải trên).
              </li>
              <li>
                Bấm <span className="font-semibold">Load unpacked</span> và chọn thư mục vừa giải nén. Sau đó bấm <span className="font-semibold">F5</span> tải lại trang AssignTrack này và mở sẵn tab <span className="font-mono">hixbypass.com</span> đã đăng nhập.
              </li>
            </ol>
          </div>
        )}
      </section>

      {/* 2. Upload Word (.docx) & Configuration Toolbar */}
      <section className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleUploadDocx(file);
                }
                e.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={isRunning}
              onClick={() => fileInputRef.current?.click()}
              className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] disabled:opacity-45 whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{wordDoc ? 'Đổi file Word (.docx)' : 'Tải file Word (.docx) lên'}</span>
            </button>

            <button
              type="button"
              disabled={isRunning}
              onClick={() => setShowPasteCreator((v) => !v)}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-slate-800 rounded-lg disabled:opacity-45 whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Dán bài làm trực tiếp</span>
            </button>
          </div>

          {/* Controls: Order link, Word-per-chunk, Mode */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <select
              value={selectedOrderCode}
              onChange={(e) => setSelectedOrderCode(e.target.value)}
              disabled={isRunning}
              aria-label="Gắn với đơn hàng"
              className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-slate-800"
            >
              <option value="">Không gắn đơn hàng</option>
              {orders
                .filter((o) => o.orderStatus !== 'cancelled')
                .map((ord) => (
                  <option key={ord.id} value={ord.orderCode}>
                    #{ord.orderCode} · {ord.subject}
                  </option>
                ))}
            </select>

            <select
              value={maxWordsPerChunk}
              onChange={(e) => setMaxWordsPerChunk(Number(e.target.value))}
              disabled={isRunning || completedCount > 0}
              aria-label="Giới hạn từ mỗi lượt HIX Bypass"
              className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-slate-800 font-mono"
            >
              <option value={115}>~115 từ/lượt (Free)</option>
              <option value={250}>~250 từ/lượt</option>
              <option value={500}>~500 từ/lượt (Pro)</option>
              <option value={1000}>~1000 từ/lượt</option>
            </select>

            <select
              value={hixMode}
              onChange={(e) => setHixMode(e.target.value as HixBypassMode)}
              disabled={isRunning}
              aria-label="Chế độ HIX Bypass"
              className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-slate-800"
            >
              <option value="Balanced">Chế độ: Balanced</option>
              <option value="Fast">Chế độ: Fast</option>
              <option value="Aggressive">Chế độ: Aggressive</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-zinc-500 leading-relaxed">
          Quy tắc tách câu an toàn: Hệ thống chỉ copy những câu hoàn chỉnh kết thúc bằng dấu chấm{' '}
          <span className="font-mono font-semibold text-slate-800">(.)</span> và ghép mỗi lượt{' '}
          <span className="font-mono font-semibold text-slate-800">
            tối thiểu {MIN_HIX_CHUNK_WORDS} từ
          </span>{' '}
          đúng yêu cầu của HIX Bypass (các đoạn ngắn dưới {MIN_HIX_CHUNK_WORDS} từ được giữ nguyên).
        </p>

        {showPasteCreator && (
          <form
            onSubmit={handleCreateFromPaste}
            className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-900">
                Tạo nhanh tài liệu Word từ văn bản tiếng Anh
              </span>
              <input
                type="text"
                value={pasteDocTitle}
                onChange={(e) => setPasteDocTitle(e.target.value)}
                placeholder="ten-bai-lam.docx"
                className="px-2.5 py-1 text-xs font-mono bg-white border border-zinc-200 rounded-lg w-52"
              />
            </div>
            <textarea
              rows={5}
              value={pasteDocBody}
              onChange={(e) => setPasteDocBody(e.target.value)}
              placeholder="Dán các đoạn văn tiếng Anh học thuật vào đây..."
              className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteCreator(false)}
                className="btn-press px-3 py-1.5 text-xs font-medium text-zinc-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn-press px-3.5 py-1.5 text-xs font-semibold bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3]"
              >
                Nạp vào màn trình chiếu Word
              </button>
            </div>
          </form>
        )}
      </section>

      {/* 3. Word Presentation / Playback Stage */}
      {!wordDoc ? (
        <section
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void handleUploadDocx(f);
          }}
          className="bg-white border border-dashed border-zinc-300 rounded-xl py-16 px-6 text-center space-y-3"
        >
          <FolderUp className="w-8 h-8 text-zinc-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-900">
            Kéo thả hoặc tải lên file Word (.docx) để bắt đầu trình chiếu
          </p>
          <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
            Màn trình chiếu sẽ hiển thị nguyên bài Word gốc, tự động tô đen từng cụm câu hoàn chỉnh kết thúc bằng dấu chấm, gửi sang HIX Bypass và kiểm tra lỗi ký tự trước khi dán đè.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-press inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Chọn file .docx từ máy</span>
          </button>
        </section>
      ) : (
        <section className="relative bg-[#F4F4F5] border border-zinc-200 rounded-2xl p-4 sm:p-7 space-y-5">
          {/* Corner Pause / Stop Floating Control ("Có 1 nút dừng ở góc để có thể tạm dừng quá trình làm") */}
          {(isRunning || playbackStatus === 'paused' || playbackStatus === 'review_glitch') && (
            <div className="sticky top-16 z-30 flex justify-end pointer-events-none">
              <div className="pointer-events-auto inline-flex items-center gap-1.5 bg-white/95 backdrop-blur border border-zinc-200 rounded-xl p-1.5 shadow-[0_10px_28px_rgb(15,23,42,0.12)]">
                {isRunning || playbackStatus === 'review_glitch' ? (
                  <button
                    type="button"
                    onClick={handlePause}
                    className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#DC2626] text-white rounded-lg hover:bg-red-700 whitespace-nowrap"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Tạm dừng</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleStartOrResume}
                      className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Tiếp tục</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStopAndReset}
                      className="btn-press inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-zinc-100 text-slate-800 hover:bg-zinc-200 rounded-lg whitespace-nowrap"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Dừng hẳn</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Playback Control & Progress Header */}
          <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono tabular-nums">
                  <span className="font-semibold text-slate-900 truncate max-w-[260px]">
                    {wordDoc.fileName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{totalDocumentWords} từ gốc</span>
                  <span aria-hidden="true">·</span>
                  <span>{chunks.length} lượt câu hoàn chỉnh ({chunkedWordsTotal} từ)</span>
                </div>
                <p className="text-sm font-bold text-slate-900">{statusHeadline}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowOverwriteTint((v) => !v)}
                  className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-slate-800 rounded-lg whitespace-nowrap"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{showOverwriteTint ? 'Ẩn màu đã dán đè' : 'Hiện màu đã dán đè'}</span>
                </button>

                {!isRunning && playbackStatus !== 'review_glitch' && (
                  <button
                    type="button"
                    disabled={chunks.length === 0 || (playbackStatus === 'completed' && completedCount === chunks.length)}
                    onClick={handleStartOrResume}
                    className="btn-press inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] disabled:opacity-45 whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>
                      {playbackStatus === 'paused' ? 'Tiếp tục trình chiếu' : 'Bắt đầu Humanize'}
                    </span>
                  </button>
                )}

                {completedCount > 0 && (
                  <>
                    <button
                      type="button"
                      disabled={exportingDocx}
                      onClick={() => void handleDownloadDocx()}
                      className="btn-press inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#16A34A] text-white rounded-lg hover:bg-emerald-700 disabled:opacity-45 whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{exportingDocx ? 'Đang xuất...' : 'Tải Word (.docx)'}</span>
                    </button>

                    {activeOrder && onAttachDocxToOrder && (
                      <button
                        type="button"
                        disabled={attachingOrder}
                        onClick={() => void handleAttachToOrder()}
                        className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-[#4338CA] hover:bg-indigo-100 rounded-lg disabled:opacity-45 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {attachingOrder
                            ? 'Đang đính kèm...'
                            : `Gắn vào đơn #${activeOrder.orderCode}`}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleStopAndReset}
                      className="btn-press inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-slate-900"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Làm lại</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-zinc-500">
                <span>
                  Đã hoàn thành {completedCount}/{chunks.length} đoạn câu
                </span>
                <span className="font-semibold text-slate-900">{progressPercent}%</span>
              </div>
              <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="progress-fill h-full w-full bg-[#4338CA]"
                  style={{ transform: `scaleX(${progressPercent / 100})` }}
                />
              </div>
            </div>

            {playbackError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-[#DC2626] flex items-start gap-2.5 leading-relaxed"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{playbackError}</span>
              </div>
            )}
          </div>

          {/* Pre-Paste Glitch Review Dialog (triggered automatically if corrupted output detected) */}
          {playbackStatus === 'review_glitch' && glitchReview && (
            <div
              ref={glitchPanelRef}
              className="surface-enter bg-white border border-amber-300 rounded-xl p-5 space-y-4 shadow-[0_14px_36px_rgb(15,23,42,0.08)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#D97706] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Phát hiện đoạn văn từ HIX Bypass có dấu hiệu lỗi ký tự (Chưa dán đè)
                  </p>
                  <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5">
                    {glitchReview.check.reasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                </div>
                <span className="font-mono text-xs text-zinc-500 tabular-nums">
                  Đoạn {glitchReview.chunk.chunkOrder}/{chunks.length}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 space-y-1.5">
                  <p className="text-xs font-semibold text-zinc-600">Đoạn gốc trong Word</p>
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {glitchReview.chunk.text}
                  </p>
                </div>

                <div className="bg-amber-50/40 border border-amber-200 rounded-lg p-3.5 space-y-2">
                  <p className="text-xs font-semibold text-[#D97706]">
                    Bản HIX Bypass trả về (vị trí nghi lỗi được tô đỏ)
                  </p>
                  <p className="text-xs text-slate-800 leading-relaxed bg-white border border-zinc-200 rounded-md p-2.5">
                    {highlightSuspectTokens(
                      glitchReview.rawOutput,
                      glitchReview.check.suspectTokens
                    )}
                  </p>
                  <label className="block text-[11px] font-medium text-zinc-600">
                    Chỉnh sửa nhanh nếu muốn vẫn dán đoạn này:
                  </label>
                  <textarea
                    rows={4}
                    value={glitchReview.editedOutput}
                    onChange={(e) =>
                      setGlitchReview((prev) =>
                        prev ? { ...prev, editedOutput: e.target.value } : null
                      )
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() =>
                    glitchDecisionResolverRef.current?.({ action: 'retry' })
                  }
                  className="btn-press inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Không dán & Thử lại (Retry) ở HIX Bypass</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    glitchDecisionResolverRef.current?.({
                      action: 'accept',
                      text: glitchReview.editedOutput,
                    })
                  }
                  className="btn-press inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white border border-zinc-300 text-slate-800 hover:bg-zinc-50 rounded-lg"
                >
                  <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                  <span>Vẫn dán đoạn này & Tiếp tục</span>
                </button>
              </div>
            </div>
          )}

          {/* Simulated Microsoft Word Paper Canvas */}
          <div className="bg-white border border-zinc-200 rounded-xl max-w-[780px] mx-auto px-6 sm:px-14 py-9 sm:py-12 shadow-[0_8px_28px_rgb(15,23,42,0.04)] space-y-5">
            <div className="pb-4 border-b border-zinc-100 flex items-center justify-between gap-4 text-xs text-zinc-400 font-mono">
              <span className="truncate">{wordDoc.fileName}</span>
              <span>Academic Word Playback</span>
            </div>

            <div className="space-y-4">
              {wordDoc.paragraphs.map((para) => {
                if (para.isEmpty) {
                  return <div key={para.index} className="h-2" />;
                }

                if (para.isHeading) {
                  return (
                    <h3
                      key={para.index}
                      className="text-base sm:text-lg font-bold text-slate-900 pt-2"
                    >
                      {para.text}
                    </h3>
                  );
                }

                const paraChunks = chunks.filter((c) => c.paragraphIndex === para.index);
                if (paraChunks.length === 0) {
                  // Paragraph had no complete terminal-period sentences (kept untouched)
                  const rawSentences = splitParagraphIntoTerminalPeriodSentences(para.text);
                  return (
                    <p key={para.index} className="text-[15px] leading-[1.75] text-slate-800">
                      {rawSentences.length > 0 ? para.text : para.text}
                    </p>
                  );
                }

                // Render paragraph piecewise so active chunk is highlighted & completed chunks overwrite cleanly
                const nodes: ReactElement[] = [];
                let cursor = 0;

                paraChunks.forEach((chk) => {
                  if (chk.startOffset > cursor) {
                    nodes.push(
                      <span key={`pre_${chk.id}`}>
                        {para.text.slice(cursor, chk.startOffset)}
                      </span>
                    );
                  }

                  const isCurrentActive =
                    activeChunk?.id === chk.id &&
                    (playbackStatus === 'highlighting' ||
                      playbackStatus === 'processing_hix' ||
                      playbackStatus === 'review_glitch' ||
                      playbackStatus === 'pasting' ||
                      playbackStatus === 'paused');

                  const doneResult = chunkResults[chk.id];

                  if (isCurrentActive && playbackStatus === 'pasting' && doneResult?.accepted) {
                    nodes.push(
                      <span
                        key={chk.id}
                        ref={activeSpanRef}
                        className="relative inline bg-emerald-100 text-slate-900 px-1 py-0.5 rounded ring-1 ring-[#16A34A]/40 transition-colors"
                      >
                        <span className="inline-flex items-center gap-1 mr-1.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#16A34A] text-white rounded align-middle">
                          Đang dán đè
                        </span>
                        {doneResult.outputText}
                      </span>
                    );
                  } else if (
                    isCurrentActive &&
                    (playbackStatus === 'highlighting' ||
                      playbackStatus === 'processing_hix' ||
                      playbackStatus === 'review_glitch' ||
                      playbackStatus === 'paused')
                  ) {
                    const actionBadge = (() => {
                      if (playbackStatus === 'highlighting') return 'AI đang tô đen';
                      if (playbackStatus === 'processing_hix') return 'Đang qua HIX Bypass';
                      if (playbackStatus === 'review_glitch') return 'Chờ kiểm duyệt';
                      return 'Đang tạm dừng';
                    })();

                    nodes.push(
                      <span
                        key={chk.id}
                        ref={activeSpanRef}
                        className="relative inline bg-indigo-100/95 text-slate-900 px-1 py-0.5 rounded ring-1 ring-[#4338CA]/45"
                      >
                        <span className="inline-flex items-center gap-1 mr-1.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#4338CA] text-white rounded align-middle">
                          {actionBadge}
                        </span>
                        {doneResult?.accepted ? doneResult.outputText : chk.text}
                      </span>
                    );
                  } else if (doneResult?.accepted) {
                    nodes.push(
                      <span
                        key={chk.id}
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setInspectChunkId((prev) => (prev === chk.id ? null : chk.id))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setInspectChunkId((prev) => (prev === chk.id ? null : chk.id));
                          }
                        }}
                        title="Bấm để xem đối chiếu thay đổi trước/sau"
                        className={`cursor-pointer rounded px-0.5 transition-colors ${
                          showOverwriteTint
                            ? 'bg-emerald-50/85 border-b border-emerald-300 hover:bg-emerald-100/80'
                            : 'hover:bg-zinc-100'
                        }`}
                      >
                        {doneResult.outputText}
                      </span>
                    );
                  } else {
                    nodes.push(
                      <span key={chk.id} className="text-slate-800">
                        {chk.text}
                      </span>
                    );
                  }

                  cursor = chk.endOffset;
                });

                if (cursor < para.text.length) {
                  nodes.push(
                    <span key={`tail_${para.index}`} className="text-slate-500">
                      {para.text.slice(cursor)}
                    </span>
                  );
                }

                return (
                  <p key={para.index} className="text-[15px] leading-[1.75] text-slate-900">
                    {nodes}
                  </p>
                );
              })}
            </div>
          </div>

          {/* Click-to-Inspect Word Diff Drawer for any completed chunk */}
          {inspectedChunk && inspectedResult && (
            <div className="surface-enter max-w-[780px] mx-auto bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span>Đối chiếu thay đổi · Đoạn {inspectedChunk.chunkOrder}/{chunks.length}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-mono text-zinc-500">
                    {countWords(inspectedChunk.text)}w → {countWords(inspectedResult.outputText)}w
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  {!isRunning && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetIdx = chunks.findIndex((c) => c.id === inspectedChunk.id);
                        if (targetIdx >= 0) {
                          setChunkResults((prev) => {
                            const copy = { ...prev };
                            delete copy[inspectedChunk.id];
                            return copy;
                          });
                          setInspectChunkId(null);
                          void runPlaybackFromIndex(targetIdx);
                        }
                      }}
                      className="btn-press inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-indigo-50 text-[#4338CA] hover:bg-indigo-100 rounded-md"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Chạy lại đoạn này</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setInspectChunkId(null)}
                    className="btn-press px-2 py-1 text-xs font-medium text-zinc-500 hover:text-slate-900"
                  >
                    Đóng
                  </button>
                </div>
              </div>

              <div className="text-sm leading-relaxed bg-zinc-50 border border-zinc-200 rounded-lg p-3.5">
                {computeWordDiff(inspectedChunk.text, inspectedResult.outputText).map(
                  (part, i) => {
                    if (part.type === 'removed') {
                      return (
                        <del
                          key={i}
                          className="bg-red-100/80 text-[#DC2626] px-1 rounded mx-0.5"
                        >
                          {part.value}
                        </del>
                      );
                    }
                    if (part.type === 'added') {
                      return (
                        <ins
                          key={i}
                          className="no-underline bg-emerald-100/90 text-[#16A34A] font-medium px-1 rounded mx-0.5"
                        >
                          {part.value}
                        </ins>
                      );
                    }
                    return (
                      <span key={i} className="text-slate-800 mx-0.5">
                        {part.value}
                      </span>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
