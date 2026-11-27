import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildExtensionZipBlob } from '../../../lib/extensionZip';
import {
  HixBridgeStatus,
  cancelHixExtensionRun,
  checkHixBridgeStatus,
  humanizeChunkViaExtension,
} from '../../../lib/hixBridgeClient';
import {
  ParsedWordDocument,
  computeDocFingerprint,
  countWords,
  createWordDocumentFromText,
  detectHixGlitch,
  detectReferenceSectionStartIndex,
  exportPatchedDocx,
  parseDocxFile,
} from '../../../lib/wordHumanizer';
import { OrderRecord } from '../../../types/domain';
import {
  GlitchReviewPayload,
  HumanizerSession,
  SavedHumanizeCheckpoint,
  clearAllCheckpoints,
  computeSessionChunks,
  isSessionRunning,
  readCheckpoints,
  rebuildParagraphTextsForSession,
  removeCheckpoint,
  writeCheckpoint,
} from './types';

type GlitchDecision =
  | { action: 'accept'; text: string }
  | { action: 'retry' }
  | { action: 'abort' };

interface SessionControl {
  runId: number;
  paused: boolean;
  aborted: boolean;
  abortController: AbortController | null;
  glitchResolver: ((decision: GlitchDecision) => void) | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useHumanizerSessions(params: {
  orders: OrderRecord[];
  initialOrderCode: string;
  onAttachDocxToOrder?: (order: OrderRecord, file: File) => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const { orders, initialOrderCode, onAttachDocxToOrder, onToast } = params;

  const [bridgeStatus, setBridgeStatus] = useState<HixBridgeStatus>({
    extensionInstalled: false,
    extensionVersion: '',
    hixTabOpen: false,
    hixTabTitle: '',
    hixTabUrl: '',
    hixTabs: [],
  });
  const [checkingBridge, setCheckingBridge] = useState(false);
  const [downloadingExt, setDownloadingExt] = useState(false);

  const [sessions, setSessions] = useState<HumanizerSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [exportingDocx, setExportingDocx] = useState(false);
  const [attachingOrder, setAttachingOrder] = useState(false);
  const [checkpointVersion, setCheckpointVersion] = useState(0);

  const sessionsRef = useRef<HumanizerSession[]>([]);
  const controlsRef = useRef<Map<string, SessionControl>>(new Map());
  /** Synchronously reserves tabIds during async bridge startup so rapid multi-clicks cannot collide */
  const claimingTabsRef = useRef<Map<string, number>>(new Map());
  const orderCodeRef = useRef<string>(initialOrderCode);

  useEffect(() => {
    orderCodeRef.current = initialOrderCode;
    if (!initialOrderCode) return;
    setSessions((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.map((s) =>
        s.sessionId === activeSessionId && !s.selectedOrderCode
          ? { ...s, selectedOrderCode: initialOrderCode }
          : s
      );
      sessionsRef.current = next;
      return next;
    });
  }, [initialOrderCode, activeSessionId]);

  const mutateSession = useCallback(
    (sessionId: string, updater: (cur: HumanizerSession) => HumanizerSession) => {
      const next = sessionsRef.current.map((s) =>
        s.sessionId === sessionId ? updater(s) : s
      );
      sessionsRef.current = next;
      setSessions(next);
    },
    []
  );

  const getOrCreateControl = useCallback((sessionId: string): SessionControl => {
    const existing = controlsRef.current.get(sessionId);
    if (existing) return existing;
    const created: SessionControl = {
      runId: 0,
      paused: false,
      aborted: false,
      abortController: null,
      glitchResolver: null,
    };
    controlsRef.current.set(sessionId, created);
    return created;
  }, []);

  const refreshBridge = useCallback(async () => {
    setCheckingBridge(true);
    try {
      const st = await checkHixBridgeStatus();
      setBridgeStatus(st);
      return st;
    } finally {
      setCheckingBridge(false);
    }
  }, []);

  useEffect(() => {
    void refreshBridge();
    return () => {
      claimingTabsRef.current.clear();
      for (const ctrl of controlsRef.current.values()) {
        ctrl.aborted = true;
        ctrl.abortController?.abort();
        ctrl.glitchResolver?.({ action: 'abort' });
      }
      void cancelHixExtensionRun();
    };
  }, [refreshBridge]);

  // Persist checkpoints when any session updates accepted chunks
  useEffect(() => {
    for (const sess of sessions) {
      const doneCount = Object.values(sess.chunkResults).filter((r) => r.accepted).length;
      if (doneCount === 0 || !sess.docFingerprint) continue;
      writeCheckpoint({
        fingerprint: sess.docFingerprint,
        fileName: sess.wordDoc.fileName,
        maxWordsPerChunk: sess.maxWordsPerChunk,
        hixMode: sess.hixMode,
        protectedTermsInput: sess.protectedTermsInput,
        excludedParagraphIndices: sess.excludedParaIndices,
        chunkResults: sess.chunkResults,
        pastedPlainText: sess.isPastedDoc ? sess.pastedSourceText : undefined,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [sessions]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.sessionId === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  const busyTabIds = useMemo(() => {
    const set = new Set<number>();
    sessions.forEach((s) => {
      if (isSessionRunning(s.playbackStatus) && typeof s.assignedTabId === 'number') {
        set.add(s.assignedTabId);
      }
    });
    return set;
  }, [sessions]);

  const recentCheckpoints = useMemo(
    () =>
      Object.values(readCheckpoints())
        .filter((cp) => Object.values(cp.chunkResults).some((r) => r.accepted))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [sessions.length, checkpointVersion]
  );

  const handleDeleteCheckpoint = useCallback(
    (fingerprint: string, fileName?: string) => {
      removeCheckpoint(fingerprint);
      setCheckpointVersion((v) => v + 1);
      onToast(
        fileName
          ? `Đã xóa bản lưu tạm "${fileName}".`
          : 'Đã xóa bản lưu tạm.'
      );
    },
    [onToast]
  );

  const handleClearAllCheckpoints = useCallback(() => {
    clearAllCheckpoints();
    setCheckpointVersion((v) => v + 1);
    onToast('Đã xóa toàn bộ các bản lưu tạm (Auto-save).');
  }, [onToast]);

  const addParsedDocumentAsSession = useCallback(
    (
      parsed: ParsedWordDocument,
      options: { isPasted: boolean; pastedText?: string }
    ): HumanizerSession => {
      const fp = computeDocFingerprint(parsed);
      const alreadyOpen = sessionsRef.current.find((s) => s.docFingerprint === fp);
      if (alreadyOpen) {
        setActiveSessionId(alreadyOpen.sessionId);
        onToast(`Bài "${parsed.fileName}" đang được mở sẵn.`);
        return alreadyOpen;
      }

      const refIdx = detectReferenceSectionStartIndex(parsed.paragraphs);
      const defaultExcluded =
        refIdx >= 0
          ? parsed.paragraphs.filter((p) => p.index >= refIdx).map((p) => p.index)
          : [];

      const existingCp = readCheckpoints()[fp];
      const existingDoneCount = existingCp
        ? Object.values(existingCp.chunkResults).filter((r) => r.accepted).length
        : 0;

      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      let newSession: HumanizerSession;

      if (existingCp && existingDoneCount > 0) {
        const provisional: HumanizerSession = {
          sessionId,
          wordDoc: parsed,
          docFingerprint: fp,
          isPastedDoc: options.isPasted,
          pastedSourceText: options.pastedText || '',
          excludedParaIndices: existingCp.excludedParagraphIndices || defaultExcluded,
          refSectionIdx: refIdx,
          protectedTermsInput: existingCp.protectedTermsInput || '',
          restoredFromCheckpoint: true,
          chunkResults: existingCp.chunkResults,
          maxWordsPerChunk: existingCp.maxWordsPerChunk,
          hixMode: existingCp.hixMode,
          selectedOrderCode: orderCodeRef.current,
          playbackStatus: 'paused',
          currentChunkIdx: 0,
          playbackError: '',
          hixStepText: '',
          glitchReview: null,
          inspectChunkId: null,
          showOverwriteTint: true,
        };
        const chks = computeSessionChunks(provisional);
        const firstPending = chks.findIndex((c) => !existingCp.chunkResults[c.id]?.accepted);
        provisional.currentChunkIdx = firstPending >= 0 ? firstPending : 0;
        provisional.playbackStatus = firstPending >= 0 ? 'paused' : 'completed';
        newSession = provisional;
        onToast(
          `Đã khôi phục "${parsed.fileName}" (${existingDoneCount} đoạn đã xong).`
        );
      } else {
        newSession = {
          sessionId,
          wordDoc: parsed,
          docFingerprint: fp,
          isPastedDoc: options.isPasted,
          pastedSourceText: options.pastedText || '',
          excludedParaIndices: defaultExcluded,
          refSectionIdx: refIdx,
          protectedTermsInput: '',
          restoredFromCheckpoint: false,
          chunkResults: {},
          maxWordsPerChunk: 115,
          hixMode: 'Balanced',
          selectedOrderCode: orderCodeRef.current,
          playbackStatus: 'ready',
          currentChunkIdx: 0,
          playbackError: '',
          hixStepText: '',
          glitchReview: null,
          inspectChunkId: null,
          showOverwriteTint: true,
        };
        const nonEmptyWords = countWords(
          parsed.paragraphs
            .filter((p) => !p.isEmpty)
            .map((p) => p.text)
            .join(' ')
        );
        const refNote =
          refIdx >= 0 ? ' (đã tự động bỏ qua phần References/Phụ lục)' : '';
        onToast(`Đã mở bài "${parsed.fileName}" (${nonEmptyWords} từ)${refNote}.`);
      }

      const next = [...sessionsRef.current, newSession];
      sessionsRef.current = next;
      setSessions(next);
      setActiveSessionId(sessionId);
      return newSession;
    },
    [onToast]
  );

  const handleUploadFiles = useCallback(
    async (files: File[]): Promise<HumanizerSession[]> => {
      const importedSessions: HumanizerSession[] = [];
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.docx')) {
          onToast(`Bỏ qua "${file.name}": chỉ hỗ trợ tệp .docx.`);
          continue;
        }
        try {
          const parsed = await parseDocxFile(file);
          const nonEmpty = parsed.paragraphs.filter((p) => !p.isEmpty);
          if (nonEmpty.length === 0) {
            onToast(`File "${file.name}" không chứa văn bản.`);
            continue;
          }
          const created = addParsedDocumentAsSession(parsed, { isPasted: false });
          importedSessions.push(created);
        } catch (err) {
          onToast(err instanceof Error ? err.message : `Không thể đọc "${file.name}".`);
        }
      }
      return importedSessions;
    },
    [addParsedDocumentAsSession, onToast]
  );

  const handleCreateFromPaste = useCallback(
    async (title: string, body: string) => {
      if (!body.trim()) {
        onToast('Vui lòng dán nội dung bài làm trước.');
        return;
      }
      try {
        const parsed = await createWordDocumentFromText(title, body);
        addParsedDocumentAsSession(parsed, { isPasted: true, pastedText: body });
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Không thể tạo tài liệu Word.');
      }
    },
    [addParsedDocumentAsSession, onToast]
  );

  const handleRestorePastedCheckpoint = useCallback(
    async (cp: SavedHumanizeCheckpoint) => {
      if (!cp.pastedPlainText) return;
      try {
        const parsed = await createWordDocumentFromText(cp.fileName, cp.pastedPlainText);
        addParsedDocumentAsSession(parsed, {
          isPasted: true,
          pastedText: cp.pastedPlainText,
        });
      } catch {
        onToast('Không thể khôi phục bài dán đã lưu.');
      }
    },
    [addParsedDocumentAsSession, onToast]
  );

  const waitForGlitchDecision = useCallback(
    (sessionId: string, payload: GlitchReviewPayload): Promise<GlitchDecision> => {
      const ctrl = getOrCreateControl(sessionId);
      mutateSession(sessionId, (s) => ({
        ...s,
        glitchReview: payload,
        playbackStatus: 'review_glitch',
      }));
      return new Promise((resolve) => {
        ctrl.glitchResolver = resolve;
      });
    },
    [getOrCreateControl, mutateSession]
  );

  const runSessionFromIndex = useCallback(
    async (sessionId: string, startIdx: number, forcedTabId?: number) => {
      const currentSess = sessionsRef.current.find((s) => s.sessionId === sessionId);
      if (!currentSess) return;
      const initialChunks = computeSessionChunks(currentSess);
      if (initialChunks.length === 0) return;

      const ctrl = getOrCreateControl(sessionId);
      // Prevent duplicate concurrent start on the exact same session while awaiting bridge or awaiting glitch review
      if (
        isSessionRunning(currentSess.playbackStatus) ||
        currentSess.playbackStatus === 'review_glitch' ||
        claimingTabsRef.current.has(sessionId)
      ) {
        return;
      }

      const myRunId = ctrl.runId + 1;
      ctrl.runId = myRunId;
      ctrl.paused = false;
      ctrl.aborted = false;

      // Synchronously reserve forcedTabId or known preferredTabId immediately before async bridge check
      if (typeof forcedTabId === 'number') {
        claimingTabsRef.current.set(sessionId, forcedTabId);
      } else if (typeof currentSess.preferredTabId === 'number') {
        claimingTabsRef.current.set(sessionId, currentSess.preferredTabId);
      } else {
        claimingTabsRef.current.set(sessionId, -1);
      }

      try {
        const statusNow = await refreshBridge();
        if (
          ctrl.runId !== myRunId ||
          ctrl.aborted ||
          ctrl.paused ||
          !sessionsRef.current.some((s) => s.sessionId === sessionId)
        ) {
          return;
        }

        if (!statusNow.extensionInstalled) {
          mutateSession(sessionId, (s) => ({
            ...s,
            playbackStatus: 'paused',
            playbackError:
              'Chưa phát hiện Chrome Extension "AssignTrack HIX Bridge". Hãy tải và cài Extension rồi bấm F5.',
          }));
          return;
        }

        if (!statusNow.hixTabOpen || statusNow.hixTabs.length === 0) {
          mutateSession(sessionId, (s) => ({
            ...s,
            playbackStatus: 'paused',
            playbackError:
              'Chưa thấy tab hixbypass.com đang mở trong Chrome. Hãy mở & đăng nhập https://hixbypass.com/ trước khi chạy.',
          }));
          return;
        }

        const otherBusyTabs = new Set<number>();
        sessionsRef.current.forEach((other) => {
          if (
            other.sessionId !== sessionId &&
            isSessionRunning(other.playbackStatus) &&
            typeof other.assignedTabId === 'number'
          ) {
            otherBusyTabs.add(other.assignedTabId);
          }
        });
        claimingTabsRef.current.forEach((claimedTid, claimedSessId) => {
          if (claimedSessId !== sessionId && claimedTid >= 0) {
            otherBusyTabs.add(claimedTid);
          }
        });

        let targetTabId: number | undefined = forcedTabId;
        if (targetTabId === undefined) {
          const latestSess =
            sessionsRef.current.find((s) => s.sessionId === sessionId) || currentSess;
          if (typeof latestSess.preferredTabId === 'number') {
            const found = statusNow.hixTabs.find(
              (t) => t.tabId === latestSess.preferredTabId
            );
            if (!found) {
              mutateSession(sessionId, (s) => ({
                ...s,
                playbackStatus: 'paused',
                playbackError:
                  'Tab HIX Bypass đã chọn cho bài này hiện đang đóng. Vui lòng chọn "Tự động chọn tab rảnh" hoặc mở lại tab.',
              }));
              return;
            }
            if (otherBusyTabs.has(found.tabId)) {
              mutateSession(sessionId, (s) => ({
                ...s,
                playbackStatus: 'paused',
                playbackError:
                  'Tab HIX Bypass này đang chạy một bài khác. Hãy mở thêm tab hixbypass.com hoặc chọn tab khác để chạy song song.',
              }));
              return;
            }
            targetTabId = found.tabId;
          } else {
            const idleTab = statusNow.hixTabs.find((t) => !otherBusyTabs.has(t.tabId));
            if (!idleTab) {
              mutateSession(sessionId, (s) => ({
                ...s,
                playbackStatus: 'paused',
                playbackError: `Cả ${statusNow.hixTabs.length} tab HIX Bypass đang mở đều đang bận chạy bài khác. Hãy bấm "Mở thêm tab HIX" để chạy đồng thời thêm bài.`,
              }));
              return;
            }
            targetTabId = idleTab.tabId;
          }
        }

        claimingTabsRef.current.set(sessionId, targetTabId);
        mutateSession(sessionId, (s) => ({
          ...s,
          assignedTabId: targetTabId,
          playbackStatus: 'highlighting',
          playbackError: '',
          glitchReview: null,
          inspectChunkId: null,
        }));
        claimingTabsRef.current.delete(sessionId);

        let idx = startIdx;
        while (true) {
          const liveSession = sessionsRef.current.find((s) => s.sessionId === sessionId);
          if (!liveSession) return;
          const liveChunks = computeSessionChunks(liveSession);
          if (idx >= liveChunks.length) break;

          const latestCtrl = controlsRef.current.get(sessionId);
          if (
            !latestCtrl ||
            latestCtrl.runId !== myRunId ||
            latestCtrl.aborted ||
            latestCtrl.paused
          ) {
            return;
          }

          const chunk = liveChunks[idx];
          if (liveSession.chunkResults[chunk.id]?.accepted) {
            idx += 1;
            continue;
          }

          // Guard against tab collisions after resuming from a Glitch Review pause
          const collectBusyTabs = (): Set<number> => {
            const set = new Set<number>();
            sessionsRef.current.forEach((other) => {
              if (
                other.sessionId !== sessionId &&
                isSessionRunning(other.playbackStatus) &&
                typeof other.assignedTabId === 'number'
              ) {
                set.add(other.assignedTabId);
              }
            });
            claimingTabsRef.current.forEach((claimedTid, claimedSessId) => {
              if (claimedSessId !== sessionId && claimedTid >= 0) {
                set.add(claimedTid);
              }
            });
            return set;
          };

          let currentActiveBusy = collectBusyTabs();
          let chunkTargetTabId = liveSession.assignedTabId ?? targetTabId;
          if (currentActiveBusy.has(chunkTargetTabId)) {
            if (typeof liveSession.preferredTabId === 'number') {
              ctrl.paused = true;
              mutateSession(sessionId, (s) => ({
                ...s,
                playbackStatus: 'paused',
                playbackError:
                  'Tab HIX Bypass của bài này hiện đang bận chạy bài khác trong lúc chờ duyệt lỗi.',
              }));
              return;
            }
            const refreshed = await refreshBridge();
            if (
              ctrl.runId !== myRunId ||
              ctrl.aborted ||
              ctrl.paused ||
              !sessionsRef.current.some((s) => s.sessionId === sessionId)
            ) {
              return;
            }
            currentActiveBusy = collectBusyTabs();
            const fallbackIdle = refreshed.hixTabs.find((t) => !currentActiveBusy.has(t.tabId));
            if (!fallbackIdle) {
              ctrl.paused = true;
              mutateSession(sessionId, (s) => ({
                ...s,
                playbackStatus: 'paused',
                playbackError:
                  'Không còn tab HIX Bypass rảnh để chạy lại đoạn vừa duyệt lỗi.',
              }));
              return;
            }
            chunkTargetTabId = fallbackIdle.tabId;
            mutateSession(sessionId, (s) => ({ ...s, assignedTabId: chunkTargetTabId }));
          }

          mutateSession(sessionId, (s) => ({
            ...s,
            currentChunkIdx: idx,
            playbackStatus: 'highlighting',
          }));
          await sleep(480);

          if (ctrl.runId !== myRunId || ctrl.aborted || ctrl.paused) {
            return;
          }

          const beforeHix =
            sessionsRef.current.find((s) => s.sessionId === sessionId) || liveSession;
          mutateSession(sessionId, (s) => ({
            ...s,
            playbackStatus: 'processing_hix',
            hixStepText: 'Đang dán văn bản sang tab HIX Bypass...',
          }));

          ctrl.abortController?.abort();
          const chunkAbort = new AbortController();
          ctrl.abortController = chunkAbort;

          const res = await humanizeChunkViaExtension(chunk.text, beforeHix.hixMode, {
            preferredTabId: chunkTargetTabId,
            signal: chunkAbort.signal,
            onStepUpdate: (step) =>
              mutateSession(sessionId, (s) => ({ ...s, hixStepText: step })),
            onTabAssigned: (tid) =>
              mutateSession(sessionId, (s) => ({ ...s, assignedTabId: tid })),
          });

          mutateSession(sessionId, (s) => ({ ...s, hixStepText: '' }));

          if (ctrl.runId !== myRunId || ctrl.aborted || ctrl.paused) {
            return;
          }

          if (!res.ok || !res.outputText) {
            const errMsg =
              res.error ||
              'HIX Bypass không trả về văn bản hợp lệ. Vui lòng kiểm tra tab hixbypass.com.';
            ctrl.paused = true;
            mutateSession(sessionId, (s) => ({
              ...s,
              playbackError: errMsg,
              playbackStatus: 'paused',
            }));
            onToast(`[${beforeHix.wordDoc.fileName}] ${errMsg}`);
            return;
          }

          const protectedTerms = beforeHix.protectedTermsInput
            .split(/[,;\n]+/)
            .map((t) => t.trim())
            .filter((t) => t.length >= 2);

          const glitchCheck = detectHixGlitch(chunk.text, res.outputText, protectedTerms);
          let finalOutputText = res.outputText;

          if (glitchCheck.hasGlitch) {
            const decision = await waitForGlitchDecision(sessionId, {
              chunk,
              rawOutput: res.outputText,
              editedOutput: res.outputText,
              check: glitchCheck,
            });

            ctrl.glitchResolver = null;
            mutateSession(sessionId, (s) => ({ ...s, glitchReview: null }));

            if (ctrl.runId !== myRunId || ctrl.aborted || decision.action === 'abort') {
              return;
            }

            if (decision.action === 'retry') {
              onToast(
                `[${beforeHix.wordDoc.fileName}] Đang chạy lại đoạn ${idx + 1}/${liveChunks.length}...`
              );
              continue;
            }

            finalOutputText = decision.text.trim();
          }

          mutateSession(sessionId, (s) => ({
            ...s,
            playbackStatus: 'pasting',
            chunkResults: {
              ...s.chunkResults,
              [chunk.id]: {
                outputText: finalOutputText,
                accepted: true,
              },
            },
          }));
          await sleep(450);

          idx += 1;
        }

        if (ctrl.runId === myRunId && !ctrl.aborted) {
          const doneSess = sessionsRef.current.find((s) => s.sessionId === sessionId);
          mutateSession(sessionId, (s) => ({ ...s, playbackStatus: 'completed' }));
          onToast(
            `Đã hoàn tất Humanize bài "${doneSess?.wordDoc.fileName || 'Word'}"!`
          );
        }
      } finally {
        claimingTabsRef.current.delete(sessionId);
      }
    },
    [getOrCreateControl, mutateSession, onToast, refreshBridge, waitForGlitchDecision]
  );

  const handleStartOrResume = useCallback(
    (sessionId: string) => {
      const sess = sessionsRef.current.find((s) => s.sessionId === sessionId);
      if (!sess) return;
      if (sess.playbackStatus === 'paused') {
        void runSessionFromIndex(sessionId, sess.currentChunkIdx);
        return;
      }
      const chks = computeSessionChunks(sess);
      const firstPending = chks.findIndex((c) => !sess.chunkResults[c.id]?.accepted);
      void runSessionFromIndex(sessionId, firstPending >= 0 ? firstPending : 0);
    },
    [runSessionFromIndex]
  );

  const handlePauseSession = useCallback(
    (sessionId: string) => {
      const sess = sessionsRef.current.find((s) => s.sessionId === sessionId);
      const ctrl = getOrCreateControl(sessionId);
      ctrl.paused = true;
      ctrl.abortController?.abort();
      ctrl.glitchResolver?.({ action: 'abort' });
      ctrl.glitchResolver = null;
      void cancelHixExtensionRun(undefined, sess?.assignedTabId);
      mutateSession(sessionId, (s) => ({
        ...s,
        hixStepText: '',
        glitchReview: null,
        playbackStatus: 'paused',
      }));
      if (sess) {
        onToast(`Đã tạm dừng bài "${sess.wordDoc.fileName}".`);
      }
    },
    [getOrCreateControl, mutateSession, onToast]
  );

  const handleStopAndReset = useCallback(
    (sessionId: string) => {
      const sess = sessionsRef.current.find((s) => s.sessionId === sessionId);
      const ctrl = getOrCreateControl(sessionId);
      ctrl.aborted = true;
      ctrl.runId += 1;
      ctrl.abortController?.abort();
      ctrl.glitchResolver?.({ action: 'abort' });
      ctrl.glitchResolver = null;
      void cancelHixExtensionRun(undefined, sess?.assignedTabId);
      if (sess?.docFingerprint) {
        removeCheckpoint(sess.docFingerprint);
      }
      mutateSession(sessionId, (s) => ({
        ...s,
        chunkResults: {},
        currentChunkIdx: 0,
        playbackError: '',
        hixStepText: '',
        glitchReview: null,
        inspectChunkId: null,
        restoredFromCheckpoint: false,
        playbackStatus: 'ready',
      }));
    },
    [getOrCreateControl, mutateSession]
  );

  const handleRunAllParallel = useCallback(async () => {
    const statusNow = await refreshBridge();
    if (!statusNow.extensionInstalled || statusNow.hixTabs.length === 0) {
      onToast('Cần cài Chrome Extension và mở ít nhất 1 tab hixbypass.com trước.');
      return;
    }

    const activeBusy = new Set<number>();
    sessionsRef.current.forEach((s) => {
      if (isSessionRunning(s.playbackStatus) && typeof s.assignedTabId === 'number') {
        activeBusy.add(s.assignedTabId);
      }
    });
    claimingTabsRef.current.forEach((claimedTid) => {
      if (claimedTid >= 0) {
        activeBusy.add(claimedTid);
      }
    });

    const availableTabs = statusNow.hixTabs.filter((t) => !activeBusy.has(t.tabId));
    const runnable = sessionsRef.current.filter((s) => {
      if (
        isSessionRunning(s.playbackStatus) ||
        s.playbackStatus === 'review_glitch' ||
        claimingTabsRef.current.has(s.sessionId)
      ) {
        return false;
      }
      const chks = computeSessionChunks(s);
      const done = chks.filter((c) => s.chunkResults[c.id]?.accepted).length;
      return chks.length > 0 && done < chks.length;
    });

    if (runnable.length === 0) return;

    let started = 0;
    const claimedTabIds = new Set<number>();
    const launchQueue: Array<{ session: HumanizerSession; tabId: number; startAt: number }> = [];

    // Pass 1: Honor sessions that explicitly pinned a preferredTabId first
    for (const sess of runnable) {
      if (typeof sess.preferredTabId !== 'number') continue;
      const isFree =
        availableTabs.some((t) => t.tabId === sess.preferredTabId) &&
        !claimedTabIds.has(sess.preferredTabId);
      if (!isFree) continue;
      claimedTabIds.add(sess.preferredTabId);
      const chks = computeSessionChunks(sess);
      const startAt =
        sess.playbackStatus === 'paused'
          ? sess.currentChunkIdx
          : Math.max(0, chks.findIndex((c) => !sess.chunkResults[c.id]?.accepted));
      launchQueue.push({ session: sess, tabId: sess.preferredTabId, startAt });
    }

    // Pass 2: Allocate remaining idle HIX tabs to Auto sessions
    for (const sess of runnable) {
      if (launchQueue.some((item) => item.session.sessionId === sess.sessionId)) continue;
      const free = availableTabs.find((t) => !claimedTabIds.has(t.tabId));
      if (!free) continue;
      claimedTabIds.add(free.tabId);
      const chks = computeSessionChunks(sess);
      const startAt =
        sess.playbackStatus === 'paused'
          ? sess.currentChunkIdx
          : Math.max(0, chks.findIndex((c) => !sess.chunkResults[c.id]?.accepted));
      launchQueue.push({ session: sess, tabId: free.tabId, startAt });
    }

    for (const item of launchQueue) {
      started += 1;
      void runSessionFromIndex(item.session.sessionId, item.startAt, item.tabId);
    }

    if (started < runnable.length) {
      onToast(
        `Đã khởi chạy song song ${started}/${runnable.length} bài trên ${started} tab HIX Bypass đang rảnh. Hãy mở thêm tab hixbypass.com để chạy đồng thời các bài còn lại.`
      );
    } else {
      onToast(`Đã khởi chạy song song ${started} bài trên ${started} tab HIX Bypass riêng biệt!`);
    }
  }, [onToast, refreshBridge, runSessionFromIndex]);

  const handlePauseAll = useCallback(() => {
    sessionsRef.current.forEach((s) => {
      if (isSessionRunning(s.playbackStatus) || s.playbackStatus === 'review_glitch') {
        handlePauseSession(s.sessionId);
      }
    });
  }, [handlePauseSession]);

  const handleCloseSession = useCallback(
    (sessionId: string) => {
      const target = sessionsRef.current.find((s) => s.sessionId === sessionId);
      const ctrl = controlsRef.current.get(sessionId);
      if (ctrl) {
        ctrl.aborted = true;
        ctrl.abortController?.abort();
        ctrl.glitchResolver?.({ action: 'abort' });
        controlsRef.current.delete(sessionId);
      }
      if (target && isSessionRunning(target.playbackStatus)) {
        void cancelHixExtensionRun(undefined, target.assignedTabId);
      }
      const next = sessionsRef.current.filter((s) => s.sessionId !== sessionId);
      sessionsRef.current = next;
      setSessions(next);
      setActiveSessionId((cur) => {
        if (cur !== sessionId) return cur;
        return next[0]?.sessionId || '';
      });
    },
    []
  );

  const handleRetrySingleChunk = useCallback(
    (sessionId: string, chunkId: string) => {
      const sess = sessionsRef.current.find((s) => s.sessionId === sessionId);
      if (!sess) return;
      const chks = computeSessionChunks(sess);
      const targetIdx = chks.findIndex((c) => c.id === chunkId);
      if (targetIdx < 0) return;

      mutateSession(sessionId, (s) => {
        const nextResults = { ...s.chunkResults };
        delete nextResults[chunkId];
        return {
          ...s,
          chunkResults: nextResults,
          inspectChunkId: null,
        };
      });
      void runSessionFromIndex(sessionId, targetIdx);
    },
    [mutateSession, runSessionFromIndex]
  );

  const handleResolveGlitch = useCallback(
    (sessionId: string, decision: GlitchDecision) => {
      controlsRef.current.get(sessionId)?.glitchResolver?.(decision);
    },
    []
  );

  const handleDownloadDocx = useCallback(
    async (sessionId: string) => {
      const sess = sessionsRef.current.find((s) => s.sessionId === sessionId);
      if (!sess) return;
      setExportingDocx(true);
      try {
        const chks = computeSessionChunks(sess);
        const map = rebuildParagraphTextsForSession(
          sess.wordDoc,
          chks,
          sess.chunkResults
        );
        const blob = await exportPatchedDocx(sess.wordDoc, map);
        const baseName = sess.wordDoc.fileName.replace(/\.docx$/i, '');
        const fileName = `${baseName}_humanized.docx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        onToast(`Đã tải xuống "${fileName}".`);
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Xuất file Word thất bại.');
      } finally {
        setExportingDocx(false);
      }
    },
    [onToast]
  );

  const handleAttachToOrder = useCallback(
    async (sessionId: string) => {
      const sess = sessionsRef.current.find((s) => s.sessionId === sessionId);
      if (!sess || !onAttachDocxToOrder) return;
      const code = sess.selectedOrderCode;
      const targetOrder = orders.find((o) => o.orderCode === code);
      if (!targetOrder) return;

      setAttachingOrder(true);
      try {
        const chks = computeSessionChunks(sess);
        const map = rebuildParagraphTextsForSession(
          sess.wordDoc,
          chks,
          sess.chunkResults
        );
        const blob = await exportPatchedDocx(sess.wordDoc, map);
        const baseName = sess.wordDoc.fileName.replace(/\.docx$/i, '');
        const outFile = new File([blob], `${baseName}_humanized.docx`, {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        await onAttachDocxToOrder(targetOrder, outFile);
        onToast(
          `Đã đính kèm "${outFile.name}" vào đơn #${targetOrder.orderCode}.`
        );
      } catch (err) {
        onToast(
          err instanceof Error ? err.message : 'Không thể đính kèm vào đơn hàng.'
        );
      } finally {
        setAttachingOrder(false);
      }
    },
    [onAttachDocxToOrder, onToast, orders]
  );

  const handleDownloadExtensionZip = useCallback(async () => {
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
        // Fallback to client JSZip
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
      onToast(
        'Đã tải xuống "assigntrack-hix-bridge.zip". Giải nén & Reload Extension để cập nhật bản đa tab chống khựng.'
      );
    } catch {
      onToast('Không thể đóng gói file Extension. Vui lòng thử lại.');
    } finally {
      setDownloadingExt(false);
    }
  }, [onToast]);

  return {
    bridgeStatus,
    checkingBridge,
    downloadingExt,
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    busyTabIds,
    recentCheckpoints,
    exportingDocx,
    attachingOrder,
    refreshBridge,
    mutateSession,
    handleUploadFiles,
    handleCreateFromPaste,
    handleRestorePastedCheckpoint,
    handleStartOrResume,
    handlePauseSession,
    handleStopAndReset,
    handleRunAllParallel,
    handlePauseAll,
    handleCloseSession,
    handleRetrySingleChunk,
    handleResolveGlitch,
    handleDownloadDocx,
    handleAttachToOrder,
    handleDownloadExtensionZip,
    handleDeleteCheckpoint,
    handleClearAllCheckpoints,
  };
}
