import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  FileText,
  Layers,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  AiRefineAction,
  PaperAuditReport,
  alignThesisTypeWording,
  buildCrossrefVerifiedReferences,
  fixReferencesTargetedWithAi,
  generateOutlineWithAi,
  generateSectionWithAi,
  isReferencesSectionTitle,
  loadAiChatbotSettings,
  loadGlobalSkillLibrary,
  loadWriterSessions,
  parseAiOutlineJson,
  refineTextWithAi,
  researchSourcesWithPerplexity,
  resolveEffectiveWriterConfig,
  resolveThesisTypeFromEvidence,
  reviseOrCompleteSectionWithAi,
  runAiPaperAudit,
  runDeterministicPaperAudit,
  sanitizeWriterSession,
  saveAiChatbotSettings,
  saveGlobalSkillLibrary,
  saveWriterSessions,
  stripMarkdownHashesFromText,
  syncServerAiKeysStatus,
} from '../../lib/aiWriterClient';
import {
  CloudSyncState,
  deleteWriterSessionFromCloud,
  mergeAiSettingsInitial,
  mergeSkillLibrariesInitial,
  saveAiWriterSettingsToCloud,
  saveAiWriterSkillsToCloud,
  saveWriterSessionToCloud,
  subscribeAiWriterSettings,
  subscribeAiWriterSkills,
  subscribeWriterSessions,
} from '../../services/writerSyncService';
import {
  buildFormattedDocxFromSession,
  extractTextFromSkillFile,
} from '../../lib/docxBuilder';
import { exportWriterSessionToPdf } from '../../lib/pdfExporter';
import { countWords } from '../../lib/wordHumanizer';
import { CitationStyle, OrderRecord } from '../../types/domain';
import {
  ACADEMIC_FORMAT_PRESETS,
  AcademicPresetKey,
  AiChatbotSettingsStore,
  AiProviderType,
  CoverPageConfig,
   DEFAULT_COVER_PAGE_CONFIG,
  DocumentFormatConfig,
  SessionContextFile,
  SessionContextImage,
  SkillDocument,
  WriterOutlineSection,
  WriterSession,
} from './writer/types';
import {
  COHORT_METHODOLOGIES,
  COHORT_STRUCTURAL_ARCHETYPES,
  CohortPairSimilarity,
  buildRandomSampledDossierForClone,
  buildSlotQueryCacheKey,
  fetchCohortMasterCrossrefPool,
  fetchCohortTargetedCrossrefCache,
} from '../../lib/cohortEngine';
import { DataLabAiWriterPayload } from './DataLabView';
import { WriterApiSettingsModal } from './writer/WriterApiSettingsModal';
import {
  CohortCloneLaunchConfig,
  WriterCohortCloneModal,
} from './writer/WriterCohortCloneModal';
import { WriterCohortSimilarityModal } from './writer/WriterCohortSimilarityModal';
import {
  WriterActivityLogEntry,
  WriterActivityPanel,
  WriterActivityStatus,
} from './writer/WriterActivityPanel';
import { WriterBriefPanel } from './writer/WriterBriefPanel';
import { WriterCoverPageModal } from './writer/WriterCoverPageModal';
import { WriterDeliverModal } from './writer/WriterDeliverModal';
import { WriterAuditModal } from './writer/WriterAuditModal';
import { WriterOutlinePanel } from './writer/WriterOutlinePanel';
import {
  SectionAuditVisualState,
  WriterPaperCanvas,
} from './writer/WriterPaperCanvas';
import { WriterSkillLibraryModal } from './writer/WriterSkillLibraryModal';
import { WriterWordRibbon } from './writer/WriterWordRibbon';
import {
  WriterWorkspaceTabs,
  isWriterSessionBusy,
} from './writer/WriterWorkspaceTabs';

interface AiWriterStudioViewProps {
  orders: OrderRecord[];
  initialOrderCode?: string;
  pendingDataLabPayload?: DataLabAiWriterPayload | null;
  onConsumeDataLabPayload?: () => void;
  onAttachDocxToOrder?: (order: OrderRecord, file: File) => Promise<void>;
  onDeliverDocxToClient?: (
    order: OrderRecord,
    file: File,
    opts: { isDraftOnly: boolean; isLocked: boolean; note: string }
  ) => Promise<void>;
  onSendDocxToHumanizer?: (
    orderCode: string,
    file: File,
    options?: { autoStart?: boolean }
  ) => void;
  onToast: (msg: string) => void;
}

const DELETED_SESSIONS_STORAGE_KEY =
  'assigntrack_ai_writer_deleted_session_ids_v1';

function loadDeletedSessionIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_SESSIONS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === 'string'));
    }
  } catch {
    // ignore
  }
  return new Set();
}

function markSessionIdDeleted(id: string): void {
  if (!id) return;
  try {
    const set = loadDeletedSessionIds();
    set.add(id);
    const trimmed = Array.from(set).slice(-120);
    localStorage.setItem(DELETED_SESSIONS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

function formatDefaultRunningHeader(topic?: string): string {
  if (!topic) return '';
  const text = topic.trim().toUpperCase();
  if (text.length <= 60) return text;
  const sliced = text.slice(0, 60);
  const lastSpace = sliced.lastIndexOf(' ');
  return lastSpace > 25 ? sliced.slice(0, lastSpace) : sliced;
}

function createDefaultSession(order?: OrderRecord | null): WriterSession {
  const citation: CitationStyle = order?.citationStyle || 'APA';
  const presetKey: Exclude<AcademicPresetKey, 'CUSTOM'> =
    citation === 'MLA'
      ? 'MLA9'
      : citation === 'Harvard'
      ? 'HARVARD'
      : citation === 'IEEE'
      ? 'IEEE'
      : 'APA7';

  const wordCount = order?.wordCount || 2000;
  const defaultOutline = parseAiOutlineJson('', wordCount, citation);

  return {
    id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: order ? `${order.orderCode} · ${order.subject}` : 'Bài nghiên cứu mới',
    linkedOrderCode: order?.orderCode || '',
    subject: order?.subject || '',
    topic: order?.topic || '',
    targetWordCount: wordCount,
    citationStyle: citation,
    writingLanguage: 'English',
    academicTone: 'High Distinction (HD) University Scholarly Tone',
    instructions: order?.outlineAndInstructions || '',
    rubricNotes: order?.rubricNotes || '',
    format: {
      ...ACADEMIC_FORMAT_PRESETS[presetKey].config,
      runningHeader: formatDefaultRunningHeader(order?.topic),
    },
    outline: defaultOutline,
    contextFiles: [],
    activeSectionId: defaultOutline[0]?.id || '',
    viewMode: 'sections',
    fullPaperOverride: '',
    batchStatus: 'idle',
    historyStack: [],
    historyIndex: -1,
    updatedAt: new Date().toISOString(),
  };
}

export function AiWriterStudioView({
  orders,
  initialOrderCode = '',
  pendingDataLabPayload = null,
  onConsumeDataLabPayload,
  onAttachDocxToOrder,
  onDeliverDocxToClient,
  onSendDocxToHumanizer,
  onToast,
}: AiWriterStudioViewProps) {
  const [aiSettings, setAiSettings] = useState<AiChatbotSettingsStore>(() =>
    loadAiChatbotSettings()
  );
  const [skills, setSkills] = useState<SkillDocument[]>(() =>
    loadGlobalSkillLibrary()
  );
  const [sessions, setSessions] = useState<WriterSession[]>(() => {
    const deletedIds = loadDeletedSessionIds();
    const saved = loadWriterSessions().filter((s) => !deletedIds.has(s.id));
    if (saved.length > 0) {
      // Reset any stuck generating statuses from previous page reload
      return saved.map((s) => ({
        ...s,
        batchStatus:
          s.batchStatus === 'outlining' ||
          s.batchStatus === 'writing_sections' ||
          s.batchStatus === 'queued'
            ? 'idle'
            : s.batchStatus,
        outline: s.outline.map((sec) => ({
          ...sec,
          status: sec.status === 'generating' ? 'idle' : sec.status,
        })),
      }));
    }
    const matchedOrder = initialOrderCode
      ? orders.find((o) => o.orderCode === initialOrderCode) || null
      : null;
    return [createDefaultSession(matchedOrder)];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const saved = loadWriterSessions();
    try {
      const lastId = localStorage.getItem('assigntrack_ai_writer_active_session_v1');
      if (lastId && saved.some((s) => s.id === lastId)) {
        return lastId;
      }
    } catch {
      // ignore
    }
    return saved[0]?.id || '';
  });

  const [leftTab, setLeftTab] = useState<'brief' | 'outline'>(() => {
    try {
      const savedTab = localStorage.getItem('assigntrack_ai_writer_left_tab_v1');
      if (savedTab === 'brief' || savedTab === 'outline') return savedTab;
    } catch {
      // ignore
    }
    return 'outline';
  });
  const [focusPaperMode, setFocusPaperMode] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditReport, setAuditReport] = useState<PaperAuditReport | null>(null);
  const [isAuditingPaper, setIsAuditingPaper] = useState(false);
  const [isAutoFixingAudit, setIsAutoFixingAudit] = useState(false);
  const [auditStatusLabel, setAuditStatusLabel] = useState('');
  const [sectionAuditStates, setSectionAuditStates] = useState<
    Record<string, SectionAuditVisualState>
  >({});
  const [focusedAuditIssueId, setFocusedAuditIssueId] = useState<string | null>(
    null
  );
  const [autoFixProgress, setAutoFixProgress] = useState<{
    currentStepIndex: number;
    batchTotal: number;
    currentStepTitle: string;
  }>({ currentStepIndex: 0, batchTotal: 0, currentStepTitle: '' });
  const [fullAutoSessionId, setFullAutoSessionId] = useState<string | null>(null);
  const [fullAutoPhase, setFullAutoPhase] = useState<
    'outlining' | 'writing' | 'pushing_hix' | null
  >(null);

  useEffect(() => {
    setAuditReport(null);
    setSectionAuditStates({});
    setFocusedAuditIssueId(null);
  }, [activeSessionId]);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [showActivityPanel, setShowActivityPanel] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('assigntrack_ai_writer_activity_open_v1');
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  });
  const ACTIVITY_LOGS_STORAGE_KEY =
    'assigntrack_ai_writer_activity_logs_by_order_v1';

  const getActivityLogKeyForSession = (sess?: WriterSession | null): string => {
    const code = sess?.linkedOrderCode?.trim();
    if (code) return `order:${code}`;
    if (sess?.id) return `session:${sess.id}`;
    return 'default';
  };

  const [activityLogsByKey, setActivityLogsByKey] = useState<
    Record<string, WriterActivityLogEntry[]>
  >(() => {
    try {
      const raw = localStorage.getItem(ACTIVITY_LOGS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<
        string,
        WriterActivityLogEntry[]
      >;
      if (!parsed || typeof parsed !== 'object') return {};
      const cleaned: Record<string, WriterActivityLogEntry[]> = {};
      for (const [k, list] of Object.entries(parsed)) {
        if (!Array.isArray(list)) continue;
        cleaned[k] = list.slice(0, 60).map((item) =>
          item.status === 'running'
            ? {
                ...item,
                status: 'warning',
                detail: item.detail || 'Tác vụ trước đó đã kết thúc khi tải lại trang.',
              }
            : item
        );
      }
      return cleaned;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      const entries = Object.entries(activityLogsByKey).slice(-40);
      localStorage.setItem(
        ACTIVITY_LOGS_STORAGE_KEY,
        JSON.stringify(Object.fromEntries(entries))
      );
    } catch {
      // ignore storage quota errors
    }
  }, [activityLogsByKey]);

  const activeSessionIdRef = useRef<string>(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  const resolveLogKey = (targetSessionId?: string): string => {
    const sid = targetSessionId || activeSessionIdRef.current;
    const matched =
      sessionsRef.current.find((s) => s.id === sid) || sessionsRef.current[0];
    return getActivityLogKeyForSession(matched);
  };

  const [currentStepLabel, setCurrentStepLabel] = useState<string>('');
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const ribbonWrapperRef = useRef<HTMLDivElement | null>(null);
  const [stickyPanelsTopPx, setStickyPanelsTopPx] = useState<number>(154);

  const isAbortError = (err: unknown): boolean =>
    Boolean(
      err &&
        typeof err === 'object' &&
        ((err as { name?: string }).name === 'AbortError' ||
          String((err as { message?: string }).message || '')
            .toLowerCase()
            .includes('aborted'))
    );

  const getFreshAiSignal = (): AbortSignal => {
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;
    return controller.signal;
  };

  const handleStopActiveAi = () => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    sessionsRef.current.forEach((s) => {
      if (isWriterSessionBusy(s) || s.id === activeSession?.id) {
        pausedSessionIdsRef.current.add(s.id);
        mutateSessionById(s.id, (prev) => ({
          ...prev,
          batchStatus:
            prev.batchStatus === 'outlining' ? 'idle' : 'paused',
          outline: prev.outline.map((sec) =>
            sec.status === 'generating'
              ? { ...sec, status: 'idle', errorMsg: undefined }
              : sec
          ),
        }));
      }
    });
    setRefiningSection(false);
    setFullAutoSessionId(null);
    setFullAutoPhase(null);
    setCurrentStepLabel('');
    const currentKey = resolveLogKey();
    setActivityLogsByKey((prev) => {
      const list = prev[currentKey] || [];
      return {
        ...prev,
        [currentKey]: list.map((item) =>
          item.status === 'running'
            ? {
                ...item,
                status: 'warning',
                detail: 'Đã dừng ngay theo yêu cầu người dùng.',
              }
            : item
        ),
      };
    });
    pushActivityLog(
      'warning',
      'Đã dừng Trợ lý AI',
      'Hủy lệnh đang chạy để bạn chỉnh lại đề bài hoặc dàn ý.'
    );
    onToast('Đã dừng ngay Trợ lý AI.');
  };

  useEffect(() => {
    const el = ribbonWrapperRef.current;
    if (!el) return;
    const updateOffset = () => {
      const h = el.getBoundingClientRect().height;
      // 60px (sticky top-15 below 56px header) + actual ribbon height + 10px breathing gap
      setStickyPanelsTopPx(Math.max(116, Math.round(60 + h + 10)));
    };
    updateOffset();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateOffset);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, []);

  const toggleActivityPanel = () => {
    setShowActivityPanel((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(
          'assigntrack_ai_writer_activity_open_v1',
          next ? '1' : '0'
        );
      } catch {
        // ignore
      }
      return next;
    });
  };

  const formatNowTime = () => {
    const d = new Date();
    return d.toLocaleTimeString('vi-VN', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const pushActivityLog = (
    status: WriterActivityStatus,
    title: string,
    detail?: string,
    model?: string,
    durationSec?: number,
    targetSessionId?: string
  ): string => {
    const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const entry: WriterActivityLogEntry = {
      id,
      timestamp: formatNowTime(),
      status,
      title,
      detail,
      model,
      durationSec,
    };
    const key = resolveLogKey(targetSessionId);
    setActivityLogsByKey((prev) => ({
      ...prev,
      [key]: [entry, ...(prev[key] || [])].slice(0, 60),
    }));
    return id;
  };

  const updateActivityLog = (
    id: string,
    patch: Partial<WriterActivityLogEntry>
  ) => {
    setActivityLogsByKey((prev) => {
      let changed = false;
      const next: Record<string, WriterActivityLogEntry[]> = {};
      for (const [k, list] of Object.entries(prev)) {
        let bucketChanged = false;
        const updatedList = list.map((item) => {
          if (item.id === id) {
            bucketChanged = true;
            changed = true;
            return { ...item, ...patch };
          }
          return item;
        });
        next[k] = bucketChanged ? updatedList : list;
      }
      return changed ? next : prev;
    });
  };

  const handleClearActiveOrderLogs = () => {
    const key = resolveLogKey();
    setActivityLogsByKey((prev) => ({
      ...prev,
      [key]: [],
    }));
  };
  const [resetScope, setResetScope] = useState<
    'content_and_outline' | 'content_only' | 'everything'
  >('content_and_outline');
  const [zoomPercent, setZoomPercent] = useState(100);
  const [concurrencyLimit, setConcurrencyLimit] = useState(2);
  const [refiningSection, setRefiningSection] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingAllDocx, setExportingAllDocx] = useState(false);
  const [attachingToOrder, setAttachingToOrder] = useState(false);
  const [showCohortCloneModal, setShowCohortCloneModal] = useState(false);
  const [launchingCohort, setLaunchingCohort] = useState(false);
  const [cohortLaunchStatus, setCohortLaunchStatus] = useState('');
  const [showCohortSimilarityModal, setShowCohortSimilarityModal] = useState(false);
  const [scrubbingPairKey, setScrubbingPairKey] = useState<string | null>(null);
  const [cloudSyncState, setCloudSyncState] = useState<CloudSyncState>('connecting');
  const [serverKeysConfigured, setServerKeysConfigured] = useState<
    Record<AiProviderType, boolean>
  >({
    perplexity: false,
    gemini: false,
    openai: false,
    anthropic: false,
    custom_openai: false,
  });

  // Refs for background multi-session parallel execution & cloud sync loop protection
  const sessionsRef = useRef<WriterSession[]>(sessions);
  sessionsRef.current = sessions;
  const aiSettingsRef = useRef<AiChatbotSettingsStore>(aiSettings);
  aiSettingsRef.current = aiSettings;
  const skillsRef = useRef<SkillDocument[]>(skills);
  skillsRef.current = skills;
  const pausedSessionIdsRef = useRef<Set<string>>(new Set());
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const hydratedSettingsRef = useRef(false);
  const hydratedSkillsRef = useRef(false);
  const hydratedSessionsRef = useRef(false);
  const lastSyncedSessionAtRef = useRef<Record<string, string>>({});

  useEffect(() => {
    saveWriterSessions(sessions);
  }, [sessions]);

  // Inject APA statistical report + high-res PNG charts pushed from Data Lab tab
  useEffect(() => {
    if (!pendingDataLabPayload) return;
    const targetId = activeSessionId || sessionsRef.current[0]?.id;
    if (!targetId) return;

    const nowIso = new Date().toISOString();
    const reportFile: SessionContextFile = {
      id: `datalab_report_${Date.now()}`,
      name: `${pendingDataLabPayload.reportTitle} (SPSS-APA).txt`,
      content: pendingDataLabPayload.reportText,
      wordCount: countWords(pendingDataLabPayload.reportText),
      uploadedAt: nowIso,
    };

    setSessions((prev) =>
      prev.map((sess) => {
        if (sess.id !== targetId) return sess;
        const existingFiles = (sess.contextFiles || []).filter(
          (f) => !f.id.startsWith('datalab_report_')
        );
        const existingImages = (sess.contextImages || []).filter(
          (img) => !img.id.startsWith('datalab_chart_')
        );
        const maxNum = existingImages.reduce((acc, img) => {
          const m = /^IMG_(\d+)$/i.exec(img.tag);
          return m ? Math.max(acc, Number(m[1])) : acc;
        }, 0);
        let nextNum = maxNum + 1;

        const injectedImages: SessionContextImage[] = pendingDataLabPayload.charts.map(
          (chart) => ({
            id: `datalab_chart_${chart.id}_${Date.now()}_${nextNum}`,
            tag: `IMG_${nextNum++}`,
            name: `${chart.id}.png`,
            caption: chart.caption,
            mimeType: 'image/png',
            dataUrl: chart.dataUrl,
            width: chart.width,
            height: chart.height,
            sizeBytes: Math.round((chart.dataUrl.length * 3) / 4),
            insertIntoPaper: true,
            uploadedAt: nowIso,
          })
        );

        return {
          ...sess,
          contextFiles: [...existingFiles, reportFile],
          contextImages: [...existingImages, ...injectedImages],
          updatedAt: nowIso,
        };
      })
    );

    setLeftTab('brief');
    onConsumeDataLabPayload?.();
    onToast(
      `Đã nạp Báo cáo thống kê APA + ${pendingDataLabPayload.charts.length} biểu đồ PNG từ Data Lab vào phiên AI Writer!`
    );
  }, [pendingDataLabPayload, activeSessionId, onConsumeDataLabPayload, onToast]);

  // Probe server vault & migrate any legacy localStorage keys to server vault
  useEffect(() => {
    void syncServerAiKeysStatus().then((status) => {
      setServerKeysConfigured(status);
    });
  }, []);

  // Auto-clean any residual leading markdown hashes (# or ##) from outline content across sessions
  useEffect(() => {
    setSessions((prev) => {
      let changed = false;
      const next = prev.map((sess) => {
        const sanitized = sanitizeWriterSession(sess);
        const hasOutlineDiff = sess.outline.some(
          (sec, idx) => sec.content !== sanitized.outline[idx]?.content
        );
        if (hasOutlineDiff || sess.fullPaperOverride !== sanitized.fullPaperOverride) {
          changed = true;
          return sanitized;
        }
        return sess;
      });
      return changed ? next : prev;
    });
  }, []);

  // Real-time Firestore Cloud Sync for AI API Settings, Skills Library, and Paper Sessions
  useEffect(() => {
    const updateSyncState = (next: CloudSyncState) => {
      setCloudSyncState((prev) => {
        if (next === 'permission_denied') return 'permission_denied';
        if (prev === 'permission_denied' && next === 'connecting') return prev;
        return next;
      });
    };

    const unsubSettings = subscribeAiWriterSettings((cloudSettings) => {
      if (!hydratedSettingsRef.current) {
        hydratedSettingsRef.current = true;
        if (!cloudSettings) {
          void saveAiWriterSettingsToCloud(aiSettingsRef.current);
          return;
        }
        const { merged, shouldPushBack } = mergeAiSettingsInitial(
          aiSettingsRef.current,
          cloudSettings
        );
        setAiSettings(merged);
        saveAiChatbotSettings(merged);
        if (shouldPushBack) {
          void saveAiWriterSettingsToCloud(merged);
        }
        return;
      }

      if (cloudSettings) {
        setAiSettings(cloudSettings);
        saveAiChatbotSettings(cloudSettings);
      }
    }, updateSyncState);

    const unsubSkills = subscribeAiWriterSkills((cloudSkills) => {
      if (!hydratedSkillsRef.current) {
        hydratedSkillsRef.current = true;
        if (!cloudSkills) {
          void saveAiWriterSkillsToCloud(skillsRef.current);
          return;
        }
        const { merged, shouldPushBack } = mergeSkillLibrariesInitial(
          skillsRef.current,
          cloudSkills
        );
        setSkills(merged);
        saveGlobalSkillLibrary(merged);
        if (shouldPushBack) {
          void saveAiWriterSkillsToCloud(merged);
        }
        return;
      }

      if (cloudSkills) {
        setSkills(cloudSkills);
        saveGlobalSkillLibrary(cloudSkills);
      }
    }, updateSyncState);

    const unsubSessions = subscribeWriterSessions((rawCloudSessions) => {
      // Never resurrect any tab/session that the user explicitly closed or deleted
      const deletedIds = loadDeletedSessionIds();
      const cloudSessions: WriterSession[] = [];
      for (const cs of rawCloudSessions) {
        if (deletedIds.has(cs.id)) {
          void deleteWriterSessionFromCloud(cs.id);
          continue;
        }
        cloudSessions.push(cs);
      }

      const hasMeaningfulData = (s: WriterSession) =>
        Boolean(
          s.topic.trim() ||
            s.subject.trim() ||
            s.instructions.trim() ||
            s.linkedOrderCode.trim() ||
            s.outline.some((sec) => sec.content.trim().length > 0)
        );

      if (!hydratedSessionsRef.current) {
        hydratedSessionsRef.current = true;
        const localSessions = sessionsRef.current;

        if (cloudSessions.length === 0) {
          // Seed cloud with any meaningful local sessions
          for (const s of localSessions) {
            if (hasMeaningfulData(s)) {
              lastSyncedSessionAtRef.current[s.id] = s.updatedAt;
              void saveWriterSessionToCloud(s);
            }
          }
          return;
        }

        const mergedById = new Map<string, WriterSession>();
        for (const cs of cloudSessions) {
          mergedById.set(cs.id, cs);
          lastSyncedSessionAtRef.current[cs.id] = cs.updatedAt;
        }

        const toPush: WriterSession[] = [];
        for (const ls of localSessions) {
          if (!hasMeaningfulData(ls)) continue;
          const existing = mergedById.get(ls.id);
          if (!existing) {
            mergedById.set(ls.id, ls);
            toPush.push(ls);
          } else {
            const localTime = Date.parse(ls.updatedAt || '') || 0;
            const cloudTime = Date.parse(existing.updatedAt || '') || 0;
            if (localTime > cloudTime) {
              mergedById.set(ls.id, ls);
              toPush.push(ls);
            }
          }
        }

        const mergedList = Array.from(mergedById.values()).sort(
          (a, b) =>
            (Date.parse(b.updatedAt || '') || 0) -
            (Date.parse(a.updatedAt || '') || 0)
        );
        if (mergedList.length > 0) {
          setSessions(mergedList);
        }
        for (const s of toPush) {
          lastSyncedSessionAtRef.current[s.id] = s.updatedAt;
          void saveWriterSessionToCloud(s);
        }
        return;
      }

      if (cloudSessions.length === 0) return;

      // Subsequent real-time updates: merge cloud changes without clobbering any busy local session
      setSessions((prev) => {
        const localById = new Map(prev.map((s) => [s.id, s]));
        const nextList: WriterSession[] = [];
        const seen = new Set<string>();

        for (const cs of cloudSessions) {
          seen.add(cs.id);
          const local = localById.get(cs.id);
          const localTime = local ? Date.parse(local.updatedAt || '') || 0 : 0;
          const cloudTime = Date.parse(cs.updatedAt || '') || 0;
          if (local && (isWriterSessionBusy(local) || localTime > cloudTime)) {
            nextList.push(local);
          } else {
            lastSyncedSessionAtRef.current[cs.id] = cs.updatedAt;
            nextList.push(cs);
          }
        }

        for (const local of prev) {
          if (!seen.has(local.id) && isWriterSessionBusy(local)) {
            nextList.push(local);
          }
        }

        return nextList.length > 0 ? nextList : prev;
      });
    }, updateSyncState);

    return () => {
      unsubSettings();
      unsubSkills();
      unsubSessions();
    };
  }, []);

  // Debounced cloud push for modified Writer Sessions (skips sessions mid-generation)
  useEffect(() => {
    if (!hydratedSessionsRef.current || cloudSyncState === 'permission_denied') {
      return;
    }

    const timer = window.setTimeout(() => {
      const deletedIds = loadDeletedSessionIds();
      for (const s of sessionsRef.current) {
        if (deletedIds.has(s.id) || isWriterSessionBusy(s)) continue;
        const alreadySyncedBefore = Boolean(lastSyncedSessionAtRef.current[s.id]);
        const hasMeaningfulData = Boolean(
          s.topic.trim() ||
            s.subject.trim() ||
            s.instructions.trim() ||
            s.linkedOrderCode.trim() ||
            s.outline.some((sec) => sec.content.trim().length > 0)
        );
        if (!hasMeaningfulData && !alreadySyncedBefore) continue;

        if (lastSyncedSessionAtRef.current[s.id] !== s.updatedAt) {
          lastSyncedSessionAtRef.current[s.id] = s.updatedAt;
          void saveWriterSessionToCloud(s);
        }
      }
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [sessions, cloudSyncState]);

  const activeSession = useMemo(
    () =>
      sessions.find((s) => s.id === activeSessionId) || sessions[0] || null,
    [sessions, activeSessionId]
  );

  useEffect(() => {
    if (activeSession && activeSession.id !== activeSessionId) {
      setActiveSessionId(activeSession.id);
    }
    if (activeSession?.id) {
      try {
        localStorage.setItem(
          'assigntrack_ai_writer_active_session_v1',
          activeSession.id
        );
      } catch {
        // ignore
      }
    }
  }, [activeSession, activeSessionId]);

  useEffect(() => {
    try {
      localStorage.setItem('assigntrack_ai_writer_left_tab_v1', leftTab);
    } catch {
      // ignore
    }
  }, [leftTab]);

  useEffect(() => {
    if (!initialOrderCode) return;
    const existing = sessionsRef.current.find(
      (s) => s.linkedOrderCode === initialOrderCode
    );
    if (existing) {
      setActiveSessionId(existing.id);
      return;
    }
    const targetOrder = orders.find((o) => o.orderCode === initialOrderCode);
    if (targetOrder) {
      const created = createDefaultSession(targetOrder);
      setSessions((prev) => [created, ...prev]);
      setActiveSessionId(created.id);
    }
  }, [initialOrderCode, orders]);

  const effectiveWriter = useMemo(
    () => resolveEffectiveWriterConfig(aiSettings),
    [aiSettings]
  );
  const activeProfile = effectiveWriter.profile;
  const hasPerplexityKey =
    Boolean(aiSettings.profiles.perplexity?.apiKey?.trim()) ||
    Boolean(serverKeysConfigured.perplexity);
  const hasWriterKey =
    Boolean(activeProfile.apiKey.trim()) ||
    Boolean(serverKeysConfigured[activeProfile.provider]);
  const hasEffectiveApiKey = effectiveWriter.isHybrid
    ? hasPerplexityKey && hasWriterKey
    : hasWriterKey;
  const activeModelDisplayName = effectiveWriter.isHybrid
    ? `${
        effectiveWriter.researchProfile.model === 'perplexity-search'
          ? 'PPLX /search'
          : effectiveWriter.researchProfile.model.replace(/^perplexity\//, '')
      } → ${activeProfile.model.replace(/^perplexity\//, '')}`
    : activeProfile.model;
  const enabledSkillsCount = useMemo(
    () => skills.filter((s) => s.enabled).length,
    [skills]
  );

  /**
   * When Hybrid mode is active, runs Step 1 (Perplexity web search) once per session topic
   * to fetch verified real-time sources & citations, then caches them on the session
   * so Step 2 (GLM-5.3-Flash / GLM-5.3 / Writer) writes all sections cheaply & accurately.
   */
  const ensureHybridSourcesForSession = async (
    targetSessionId: string,
    signal?: AbortSignal,
    forceRefresh = false
  ): Promise<WriterSession | null> => {
    const sess = sessionsRef.current.find((s) => s.id === targetSessionId);
    if (!sess) return null;
    if (!effectiveWriter.isHybrid) return sess;

    const topicKey = (sess.topic || sess.title || '').trim();
    if (
      !forceRefresh &&
      sess.researchedSources?.trim() &&
      (sess.researchedSourcesTopic || '').trim() === topicKey
    ) {
      return sess;
    }

    const stepMsg = `Bước 1/2: Đang tra cứu song song Crossref (nguồn học thuật thật) + Perplexity Web chuẩn ${sess.citationStyle}...`;
    setCurrentStepLabel(stepMsg);
    onToast(stepMsg);
    const t0 = Date.now();
    const logId = pushActivityLog(
      'running',
      'Tra cứu nguồn web thực tế',
      undefined,
      effectiveWriter.researchProfile.model
    );

    try {
      const dossier = await researchSourcesWithPerplexity(
        sess,
        effectiveWriter.researchProfile,
        signal
      );
      const elapsed = (Date.now() - t0) / 1000;
      const urlCount = (dossier.match(/https?:\/\/[^\s)]+/g) || []).length;
      updateActivityLog(logId, {
        status: 'success',
        title:
          urlCount > 0
            ? `Đã tìm thấy ${urlCount} nguồn web`
            : 'Đã thu thập nguồn thực tế',
        detail: `Lưu bộ đệm nguồn chuẩn ${sess.citationStyle} cho toàn bài.`,
        durationSec: elapsed,
      });
      mutateSessionById(targetSessionId, (s) => ({
        ...s,
        researchedSources: dossier,
        researchedSourcesTopic: topicKey,
      }));
      const nextMsg = `Bước 2/2: Chuyển nguồn sang ${activeProfile.model.replace(/^perplexity\//, '')} để viết bài...`;
      setCurrentStepLabel(nextMsg);
      onToast(nextMsg);
      return {
        ...sess,
        researchedSources: dossier,
        researchedSourcesTopic: topicKey,
      };
    } catch (err) {
      updateActivityLog(logId, {
        status: 'error',
        title: 'Bước 1/2 · Tra cứu nguồn thất bại',
        detail: err instanceof Error ? err.message : 'Lỗi gọi Perplexity',
        durationSec: (Date.now() - t0) / 1000,
      });
      setCurrentStepLabel('');
      throw err;
    }
  };

  // Mutate a specific session by ID (safe for background concurrent tasks)
  const mutateSessionById = (
    targetId: string,
    updater: (prev: WriterSession) => WriterSession,
    pushHistory = false
  ) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== targetId) return s;
        const next = updater(s);
        if (pushHistory) {
          const snapshot = JSON.stringify(
            next.outline.map((sec) => ({ id: sec.id, content: sec.content }))
          );
          const trimmedHistory = next.historyStack.slice(
            0,
            next.historyIndex + 1
          );
          const nextStack = [...trimmedHistory, snapshot].slice(-30);
          return {
            ...next,
            historyStack: nextStack,
            historyIndex: nextStack.length - 1,
            updatedAt: new Date().toISOString(),
          };
        }
        return {
          ...next,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const mutateActiveSession = (
    updater: (prev: WriterSession) => WriterSession,
    pushHistory = false
  ) => {
    if (!activeSession) return;
    mutateSessionById(activeSession.id, updater, pushHistory);
  };

  const handleSaveAiSettings = (next: AiChatbotSettingsStore) => {
    setAiSettings(next);
    saveAiChatbotSettings(next);
    void saveAiWriterSettingsToCloud(next).then((res) => {
      if (res.ok) {
        setCloudSyncState('synced');
      } else if (res.permissionDenied) {
        setCloudSyncState('permission_denied');
        onToast(
          'Đã lưu API trên trình duyệt này. Hãy cập nhật Firestore Rules để đồng bộ giữa Edge & Chrome.'
        );
      }
    });
  };

  const handleUpdateSkills = (next: SkillDocument[]) => {
    setSkills(next);
    saveGlobalSkillLibrary(next);
    void saveAiWriterSkillsToCloud(next).then((res) => {
      if (res.ok) {
        setCloudSyncState('synced');
      } else if (res.permissionDenied) {
        setCloudSyncState('permission_denied');
      }
    });
  };

  const handleLoadFromOrder = (orderCode: string) => {
    if (!activeSession) return;
    if (!orderCode) {
      mutateActiveSession((s) => ({ ...s, linkedOrderCode: '' }));
      return;
    }
    const ord = orders.find((o) => o.orderCode === orderCode);
    if (!ord) return;

    const presetKey: Exclude<AcademicPresetKey, 'CUSTOM'> =
      ord.citationStyle === 'MLA'
        ? 'MLA9'
        : ord.citationStyle === 'Harvard'
        ? 'HARVARD'
        : ord.citationStyle === 'IEEE'
        ? 'IEEE'
        : 'APA7';

    mutateActiveSession((s) => ({
      ...s,
      title: `${ord.orderCode} · ${ord.subject}`,
      linkedOrderCode: ord.orderCode,
      subject: ord.subject,
      topic: ord.topic,
      targetWordCount: ord.wordCount,
      citationStyle: ord.citationStyle,
      instructions: ord.outlineAndInstructions || s.instructions,
      rubricNotes: ord.rubricNotes || s.rubricNotes,
      format: {
        ...ACADEMIC_FORMAT_PRESETS[presetKey].config,
        runningHeader: formatDefaultRunningHeader(ord.topic),
      },
    }));
    onToast(
      `Đã nạp đề bài, số từ (${ord.wordCount}w), chuẩn ${ord.citationStyle} và Rubric từ đơn #${ord.orderCode}.`
    );
  };

  const handleCreateNewSession = () => {
    const created = createDefaultSession(null);
    setSessions((prev) => [...prev, created]);
    setActiveSessionId(created.id);
    setLeftTab('brief');
    onToast('Đã thêm tab bài viết mới.');
  };

  const handleImportMultipleOrders = (selectedOrders: OrderRecord[]) => {
    if (selectedOrders.length === 0) return;
    const newSessions = selectedOrders.map((ord) => createDefaultSession(ord));
    setSessions((prev) => [...prev, ...newSessions]);
    setActiveSessionId(newSessions[0].id);
    onToast(
      `Đã mở thêm ${newSessions.length} tab bài viết từ danh sách Đơn hàng! Bạn có thể bấm "Viết song song tất cả".`
    );
  };

  const handleDeleteSession = (id: string) => {
    pausedSessionIdsRef.current.add(id);
    delete lastSyncedSessionAtRef.current[id];
    markSessionIdDeleted(id);

    const targetSess = sessions.find((s) => s.id === id);
    if (targetSess) {
      const logKey = getActivityLogKeyForSession(targetSess);
      setActivityLogsByKey((prev) => {
        const next = { ...prev };
        delete next[logKey];
        try {
          localStorage.setItem(
            ACTIVITY_LOGS_STORAGE_KEY,
            JSON.stringify(next)
          );
        } catch {
          // ignore
        }
        return next;
      });
    }
    if (activeSessionId === id || sessions.length <= 1) {
      setAuditReport(null);
      setSectionAuditStates({});
      setFocusedAuditIssueId(null);
      setAutoFixProgress({
        currentStepIndex: 0,
        batchTotal: 0,
        currentStepTitle: '',
      });
      setShowAuditModal(false);
    }
    void deleteWriterSessionFromCloud(id);
    if (sessions.length <= 1) {
      const reset = createDefaultSession(null);
      saveWriterSessions([reset]);
      try {
        localStorage.setItem(
          'assigntrack_ai_writer_active_session_v1',
          reset.id
        );
      } catch {
        // ignore
      }
      setSessions([reset]);
      setActiveSessionId(reset.id);
      return;
    }
    const next = sessions.filter((s) => s.id !== id);
    const nextActiveId = activeSessionId === id ? next[0].id : activeSessionId;
    // Persist synchronously so pressing F5 immediately after closing a tab NEVER restores it
    saveWriterSessions(next);
    try {
      localStorage.setItem(
        'assigntrack_ai_writer_active_session_v1',
        nextActiveId
      );
    } catch {
      // ignore
    }
    setSessions(next);
    if (activeSessionId === id) {
      setActiveSessionId(next[0].id);
    }
  };

  const handleUploadContextFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !activeSession) return;
    try {
      const added: SessionContextFile[] = [];
      for (const file of Array.from(fileList)) {
        const text = await extractTextFromSkillFile(file);
        if (!text.trim()) continue;
        added.push({
          id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          content: text.trim(),
          wordCount: countWords(text),
          uploadedAt: new Date().toISOString(),
        });
      }
      if (added.length > 0) {
        mutateActiveSession((s) => ({
          ...s,
          contextFiles: [...s.contextFiles, ...added],
        }));
        onToast(`Đã đính kèm ${added.length} tài liệu ngữ cảnh cho bài này.`);
      }
    } catch (err) {
      onToast(
        err instanceof Error
          ? err.message
          : 'Không thể đọc tệp ngữ cảnh tải lên.'
      );
    }
  };

  // --- Outline Management (Session-Safe) ---
  const handleAiGenerateOutlineForSession = async (
    targetSessionId: string,
    forceFreshSources = false
  ): Promise<boolean> => {
    const sess = sessionsRef.current.find((s) => s.id === targetSessionId);
    if (!sess) return false;
    if (!hasEffectiveApiKey) {
      setShowApiModal(true);
      onToast('Vui lòng nhập API Key Chatbot trước khi tạo dàn ý.');
      return false;
    }
    if (targetSessionId === activeSession?.id) {
      setLeftTab('outline');
    }

    const hasExistingContent =
      sess.outline.some((sec) => sec.content.trim().length > 0) ||
      Boolean(sess.fullPaperOverride?.trim());
    const shouldRefreshSources = forceFreshSources || hasExistingContent;

    mutateSessionById(targetSessionId, (s) => ({
      ...s,
      ...(shouldRefreshSources
        ? {
            researchedSources: undefined,
            researchedSourcesTopic: undefined,
            sourceRotationCount: (s.sourceRotationCount || 0) + 1,
          }
        : {}),
      batchStatus: 'outlining',
      batchErrorMsg: undefined,
    }));

    const t0 = Date.now();
    const signal = getFreshAiSignal();
    let outlineLogId = '';
    try {
      const preparedSess =
        (await ensureHybridSourcesForSession(
          targetSessionId,
          signal,
          shouldRefreshSources
        )) || sess;
      setCurrentStepLabel(
        `Đang lập dàn ý chuẩn ${sess.citationStyle} (${sess.targetWordCount} từ)...`
      );
      outlineLogId = pushActivityLog(
        'running',
        'Đang lập dàn ý học thuật',
        `Đề tài: "${(sess.topic || sess.title).slice(0, 70)}"`,
        activeProfile.model.replace(/^perplexity\//, '')
      );
      const sections = await generateOutlineWithAi(
        preparedSess,
        skills,
        activeProfile,
        effectiveWriter.enableWebSearch,
        signal
      );
      mutateSessionById(targetSessionId, (s) => ({
        ...s,
        outline: sections,
        activeSectionId: sections[0]?.id || '',
        batchStatus: 'idle',
      }));
      updateActivityLog(outlineLogId, {
        status: 'success',
        title: `Đã lập xong dàn ý (${sections.length} mục)`,
        detail: sections.map((sec) => sec.title).slice(0, 3).join(' · '),
        durationSec: (Date.now() - t0) / 1000,
      });
      setCurrentStepLabel('');
      onToast(
        `AI (${activeModelDisplayName}) đã lập dàn ý ${sections.length} mục cho "${sess.title}".`
      );
      return sections.length > 0;
    } catch (err) {
      if (isAbortError(err)) {
        setCurrentStepLabel('');
        mutateSessionById(targetSessionId, (s) => ({
          ...s,
          batchStatus: 'idle',
        }));
        return false;
      }
      const msg =
        err instanceof Error ? err.message : 'Tạo dàn ý bằng AI thất bại.';
      if (outlineLogId) {
        updateActivityLog(outlineLogId, {
          status: 'error',
          title: 'Lập dàn ý thất bại',
          detail: msg,
          durationSec: (Date.now() - t0) / 1000,
        });
      }
      setCurrentStepLabel('');
      mutateSessionById(targetSessionId, (s) => ({
        ...s,
        batchStatus: 'error',
        batchErrorMsg: msg,
      }));
      onToast(msg);
      return false;
    }
  };

  const handleAddOutlineSection = () => {
    if (!activeSession) return;
    const newSec: WriterOutlineSection = {
      id: `sec_${Date.now()}`,
      order: activeSession.outline.length + 1,
      title: `${activeSession.outline.length + 1}. Mục nội dung mới`,
      headingLevel: 'h1',
      targetWords: 350,
      guidanceNotes:
        'Luận điểm, dẫn chứng học thuật và trích dẫn cần triển khai...',
      content: '',
      status: 'idle',
    };
    mutateActiveSession((s) => ({
      ...s,
      outline: [...s.outline, newSec],
      activeSectionId: newSec.id,
    }));
  };

  const handleUpdateOutlineSection = (
    sectionId: string,
    patch: Partial<WriterOutlineSection>,
    pushHistory = false
  ) => {
    mutateActiveSession(
      (s) => ({
        ...s,
        outline: s.outline.map((sec) =>
          sec.id === sectionId ? { ...sec, ...patch } : sec
        ),
      }),
      pushHistory
    );
  };

  const handleMoveOutlineSection = (sectionId: string, dir: -1 | 1) => {
    if (!activeSession) return;
    const idx = activeSession.outline.findIndex((s) => s.id === sectionId);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= activeSession.outline.length) {
      return;
    }
    const copy = [...activeSession.outline];
    const [picked] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, picked);
    mutateActiveSession((s) => ({
      ...s,
      outline: copy.map((sec, i) => ({ ...sec, order: i + 1 })),
    }));
  };

  const handleDeleteOutlineSection = (sectionId: string) => {
    if (!activeSession || activeSession.outline.length <= 1) return;
    const filtered = activeSession.outline
      .filter((s) => s.id !== sectionId)
      .map((s, i) => ({ ...s, order: i + 1 }));
    mutateActiveSession((s) => ({
      ...s,
      outline: filtered,
      activeSectionId:
        s.activeSectionId === sectionId
          ? filtered[0]?.id || ''
          : s.activeSectionId,
    }));
  };

  // --- Single Section & Full-Paper Background Pipeline ---
  const handleWriteSingleSection = async (sectionId: string) => {
    if (!activeSession) return;
    const targetSessionId = activeSession.id;
    if (!hasEffectiveApiKey) {
      setShowApiModal(true);
      onToast('Vui lòng nhập API Key Chatbot trước khi viết bài.');
      return;
    }

    mutateSessionById(targetSessionId, (s) => ({
      ...s,
      outline: s.outline.map((sec) =>
        sec.id === sectionId
          ? { ...sec, status: 'generating', errorMsg: undefined }
          : sec
      ),
    }));

    const targetSecObj = activeSession.outline.find((s) => s.id === sectionId);
    const secLabel = targetSecObj?.title || 'Mục dàn ý';
    const t0 = Date.now();
    const signal = getFreshAiSignal();
    let secLogId = '';
    try {
      const preparedSession =
        (await ensureHybridSourcesForSession(targetSessionId, signal)) ||
        sessionsRef.current.find((s) => s.id === targetSessionId) ||
        activeSession;
      setCurrentStepLabel(`Đang viết mục: ${secLabel}...`);
      secLogId = pushActivityLog(
        'running',
        `Đang viết: ${secLabel}`,
        `Mục tiêu ~${targetSecObj?.targetWords || 300} từ`,
        activeProfile.model.replace(/^perplexity\//, '')
      );
      const generatedText = await generateSectionWithAi(
        preparedSession,
        sectionId,
        skills,
        activeProfile,
        effectiveWriter.enableWebSearch,
        signal,
        (partialText, progressLabel) => {
          setCurrentStepLabel(progressLabel);
          if (partialText) {
            mutateSessionById(targetSessionId, (s) => ({
              ...s,
              outline: s.outline.map((sec) =>
                sec.id === sectionId
                  ? { ...sec, content: partialText, status: 'generating' }
                  : sec
              ),
            }));
          }
        }
      );
      const writtenWords = countWords(generatedText);

      mutateSessionById(
        targetSessionId,
        (s) => ({
          ...s,
          outline: s.outline.map((sec) =>
            sec.id === sectionId
              ? {
                  ...sec,
                  content: generatedText,
                  status: 'completed',
                  errorMsg: undefined,
                }
              : sec
          ),
        }),
        true
      );
      updateActivityLog(secLogId, {
        status: 'success',
        title: `Hoàn tất: ${secLabel}`,
        detail: `Đã viết ${writtenWords.toLocaleString('vi-VN')} từ.`,
        durationSec: (Date.now() - t0) / 1000,
      });
      setCurrentStepLabel('');
      onToast('Đã viết xong mục dàn ý!');
    } catch (err) {
      if (isAbortError(err)) {
        setCurrentStepLabel('');
        mutateSessionById(targetSessionId, (s) => ({
          ...s,
          outline: s.outline.map((sec) =>
            sec.id === sectionId
              ? { ...sec, status: 'idle', errorMsg: undefined }
              : sec
          ),
        }));
        return;
      }
      const msg =
        err instanceof Error ? err.message : 'Lỗi khi gọi AI viết mục này.';
      if (secLogId) {
        updateActivityLog(secLogId, {
          status: 'error',
          title: `Lỗi viết mục: ${secLabel}`,
          detail: msg,
          durationSec: (Date.now() - t0) / 1000,
        });
      }
      setCurrentStepLabel('');
      mutateSessionById(targetSessionId, (s) => ({
        ...s,
        outline: s.outline.map((sec) =>
          sec.id === sectionId
            ? { ...sec, status: 'error', errorMsg: msg }
            : sec
        ),
      }));
      onToast(msg);
    }
  };

  /**
   * Executes a full paper pipeline for a single sessionId in the background:
   * 1. If the session still has a generic outline and has a topic/instructions, optionally generate outline if outline is empty.
   * 2. Sequentially write all sections that are still empty (or all sections if `forceAll` is true).
   */
  const runSinglePaperPipeline = async (
    targetSessionId: string,
    onlyUnwrittenSections = true
  ): Promise<void> => {
    pausedSessionIdsRef.current.delete(targetSessionId);

    const initialSnap = sessionsRef.current.find(
      (s) => s.id === targetSessionId
    );
    if (!initialSnap) return;

    mutateSessionById(targetSessionId, (s) => ({
      ...s,
      batchStatus: 'writing_sections',
      batchErrorMsg: undefined,
    }));

    const signal = getFreshAiSignal();
    try {
      // In Hybrid mode, run Step 1 (Perplexity web search) once before writing all sections
      await ensureHybridSourcesForSession(targetSessionId, signal);

      // For Same-Class Cohort Clones, automatically generate a structurally distinct AI Outline first!
      const afterSourceSnap =
        sessionsRef.current.find((s) => s.id === targetSessionId) || initialSnap;
      let activeOutline = afterSourceSnap.outline;

      if (afterSourceSnap.cohortMeta?.needsDistinctOutline) {
        mutateSessionById(targetSessionId, (s) => ({
          ...s,
          batchStatus: 'outlining',
        }));
        setCurrentStepLabel(
          `Đang lập dàn ý độc lập cho "${afterSourceSnap.title}"...`
        );
        const outlineLogId = pushActivityLog(
          'running',
          `Lập dàn ý riêng (${afterSourceSnap.cohortMeta.archetypeLabel})`,
          `Đảm bảo tiêu đề & bố cục khác biệt trong nhóm ${afterSourceSnap.cohortMeta.cohortSize} bài.`,
          activeProfile.model.replace(/^perplexity\//, ''),
          undefined,
          targetSessionId
        );
        const tOut = Date.now();
        const freshOutline = await generateOutlineWithAi(
          afterSourceSnap,
          skillsRef.current,
          activeProfile,
          effectiveWriter.enableWebSearch,
          signal
        );
        activeOutline = freshOutline;
        updateActivityLog(outlineLogId, {
          status: 'success',
          title: `Đã tạo dàn ý riêng (${freshOutline.length} mục)`,
          durationSec: (Date.now() - tOut) / 1000,
        });
        mutateSessionById(targetSessionId, (s) => ({
          ...s,
          outline: freshOutline,
          activeSectionId: freshOutline[0]?.id || '',
          batchStatus: 'writing_sections',
          cohortMeta: s.cohortMeta
            ? { ...s.cohortMeta, needsDistinctOutline: false }
            : undefined,
        }));
      }

      const sectionIds = activeOutline.map((sec) => sec.id);

      for (let i = 0; i < sectionIds.length; i++) {
        const secId = sectionIds[i];
        if (pausedSessionIdsRef.current.has(targetSessionId)) {
          setCurrentStepLabel('');
          pushActivityLog(
            'warning',
            'Đã tạm dừng viết bài',
            `Tạm dừng trước mục ${i + 1}/${sectionIds.length}.`
          );
          mutateSessionById(targetSessionId, (s) => ({
            ...s,
            batchStatus: 'paused',
          }));
          return;
        }

        const currentSnap = sessionsRef.current.find(
          (s) => s.id === targetSessionId
        );
        if (!currentSnap) return;
        const secObj = currentSnap.outline.find((sec) => sec.id === secId);
        if (!secObj) continue;

        if (onlyUnwrittenSections && countWords(secObj.content) > 0) {
          continue;
        }

        // Mark section generating
        mutateSessionById(targetSessionId, (s) => ({
          ...s,
          activeSectionId: secId,
          outline: s.outline.map((sec) =>
            sec.id === secId
              ? { ...sec, status: 'generating', errorMsg: undefined }
              : sec
          ),
        }));

        const secStart = Date.now();
        setCurrentStepLabel(
          `Đang viết (${i + 1}/${sectionIds.length}): ${secObj.title}...`
        );
        const batchSecLogId = pushActivityLog(
          'running',
          `Viết mục ${i + 1}/${sectionIds.length}: ${secObj.title}`,
          `Mục tiêu ~${secObj.targetWords} từ`,
          activeProfile.model.replace(/^perplexity\//, '')
        );

        const latestBeforeCall =
          sessionsRef.current.find((s) => s.id === targetSessionId) ||
          currentSnap;

        const generatedText = await generateSectionWithAi(
          latestBeforeCall,
          secId,
          skills,
          activeProfile,
          effectiveWriter.enableWebSearch,
          signal,
          (partialText, progressLabel) => {
            setCurrentStepLabel(progressLabel);
            if (partialText) {
              mutateSessionById(targetSessionId, (s) => ({
                ...s,
                outline: s.outline.map((sec) =>
                  sec.id === secId
                    ? { ...sec, content: partialText, status: 'generating' }
                    : sec
                ),
              }));
            }
          }
        );

        if (pausedSessionIdsRef.current.has(targetSessionId)) {
          updateActivityLog(batchSecLogId, {
            status: 'warning',
            title: `Đã tạm dừng ở mục: ${secObj.title}`,
            durationSec: (Date.now() - secStart) / 1000,
          });
          setCurrentStepLabel('');
          mutateSessionById(targetSessionId, (s) => ({
            ...s,
            batchStatus: 'paused',
            outline: s.outline.map((sec) =>
              sec.id === secId ? { ...sec, status: 'idle' } : sec
            ),
          }));
          return;
        }

        updateActivityLog(batchSecLogId, {
          status: 'success',
          title: `Xong mục ${i + 1}/${sectionIds.length}: ${secObj.title}`,
          detail: `Đã viết ${countWords(generatedText).toLocaleString('vi-VN')} từ.`,
          durationSec: (Date.now() - secStart) / 1000,
        });

        mutateSessionById(
          targetSessionId,
          (s) => ({
            ...s,
            outline: s.outline.map((sec) =>
              sec.id === secId
                ? {
                    ...sec,
                    content: generatedText,
                    status: 'completed',
                    errorMsg: undefined,
                  }
                : sec
            ),
          }),
          true
        );
      }

      mutateSessionById(targetSessionId, (s) => ({
        ...s,
        batchStatus: 'completed',
      }));
      setCurrentStepLabel('');
      const finishedSnap =
        sessionsRef.current.find((s) => s.id === targetSessionId) || initialSnap;
      const finishedWords = finishedSnap.outline.reduce(
        (sum, sec) => sum + countWords(sec.content),
        0
      );

      pushActivityLog(
        'success',
        'Hoàn tất viết toàn bộ bài!',
        `Đã hoàn thành ${sectionIds.length} mục (${finishedWords.toLocaleString('vi-VN')} từ) cho "${finishedSnap.title}".`,
        activeProfile.model.replace(/^perplexity\//, ''),
        undefined,
        targetSessionId
      );

      // Send completion notification via Telegram Bot only
      void fetch('/api/notifications/telegram/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'AssignTrack AI Writer · Đã viết xong bài tự động!',
          lines: [
            finishedSnap.linkedOrderCode
              ? `Mã đơn: #${finishedSnap.linkedOrderCode}`
              : 'Loại: Bài viết độc lập',
            `Đề tài: ${(finishedSnap.topic || finishedSnap.title || 'Bài nghiên cứu').slice(0, 220)}`,
            `Tiến độ: ${sectionIds.length} mục hoàn tất · ${finishedWords.toLocaleString('vi-VN')} từ (${finishedSnap.citationStyle})`,
            `Thời gian xong: ${new Date().toLocaleString('vi-VN')}`,
          ],
        }),
      }).catch(() => {});
    } catch (err) {
      if (isAbortError(err)) {
        setCurrentStepLabel('');
        mutateSessionById(targetSessionId, (s) => ({
          ...s,
          batchStatus: 'paused',
          outline: s.outline.map((sec) =>
            sec.status === 'generating'
              ? { ...sec, status: 'idle', errorMsg: undefined }
              : sec
          ),
        }));
        return;
      }
      const msg =
        err instanceof Error
          ? err.message
          : 'Quá trình viết bài tự động bị gián đoạn.';
      setCurrentStepLabel('');
      pushActivityLog('error', 'Viết bài bị gián đoạn', msg);
      mutateSessionById(targetSessionId, (s) => ({
        ...s,
        batchStatus: 'error',
        batchErrorMsg: msg,
        outline: s.outline.map((sec) =>
          sec.status === 'generating'
            ? { ...sec, status: 'error', errorMsg: msg }
            : sec
        ),
      }));
      throw err;
    }
  };

  const handleWriteCurrentPaperSequentially = async () => {
    if (!activeSession) return;
    if (!hasEffectiveApiKey) {
      setShowApiModal(true);
      onToast('Vui lòng nhập API Key Chatbot trước khi chạy tự động.');
      return;
    }
    try {
      await runSinglePaperPipeline(activeSession.id, false);
      onToast(`Đã viết hoàn tất bài "${activeSession.title}"!`);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Viết bài tuần tự bị gián đoạn.'
      );
    }
  };

  /**
   * 1-Click Full-Auto Mode:
   * 1) Generate outline (and Hybrid sources if enabled)
   * 2) Sequentially write all sections top-to-bottom
   * 3) Export formatted .docx and auto-launch HixBypass inside Word Humanizer
   */
  const handleRunFullAutoPipeline = async (
    targetSessionId?: string,
    forceFreshSources = false
  ) => {
    const sessId = targetSessionId || activeSession?.id;
    const sess = sessionsRef.current.find((s) => s.id === sessId);
    if (!sess || !sessId) return;

    if (!hasEffectiveApiKey) {
      setShowApiModal(true);
      onToast('Vui lòng nhập API Key Chatbot trước khi chạy Chế độ Tự động.');
      return;
    }

    if (!(sess.topic || sess.title || '').trim()) {
      onToast('Vui lòng điền Đề tài / Chủ đề bài viết trước khi chạy Tự động.');
      return;
    }

    const hasExistingContent =
      sess.outline.some((sec) => sec.content.trim().length > 0) ||
      Boolean(sess.fullPaperOverride?.trim());
    const shouldRefreshSources = forceFreshSources || hasExistingContent;

    if (shouldRefreshSources) {
      mutateSessionById(sessId, (s) => ({
        ...s,
        researchedSources: undefined,
        researchedSourcesTopic: undefined,
        fullPaperOverride: undefined,
        sourceRotationCount: (s.sourceRotationCount || 0) + 1,
        outline: s.outline.map((sec) => ({ ...sec, content: '', status: 'idle' })),
      }));
    }

    setFullAutoSessionId(sessId);
    setFullAutoPhase('outlining');
    setLeftTab('outline');

    try {
      const outlined = await handleAiGenerateOutlineForSession(
        sessId,
        shouldRefreshSources
      );
      if (!outlined || pausedSessionIdsRef.current.has(sessId)) {
        setFullAutoSessionId(null);
        setFullAutoPhase(null);
        return;
      }

      setFullAutoPhase('writing');
      await runSinglePaperPipeline(sessId, false);

      const finishedSess = sessionsRef.current.find((s) => s.id === sessId);
      const finishedWords = (finishedSess?.outline || []).reduce(
        (sum, sec) => sum + countWords(sec.content),
        0
      );

      if (
        !finishedSess ||
        finishedSess.batchStatus !== 'completed' ||
        finishedWords === 0 ||
        pausedSessionIdsRef.current.has(sessId)
      ) {
        setFullAutoSessionId(null);
        setFullAutoPhase(null);
        return;
      }

      setFullAutoPhase('pushing_hix');
      setCurrentStepLabel('Đang xuất Word & tự động chạy HixBypass...');
      pushActivityLog(
        'running',
        'Chế độ Tự động · Chuyển sang HixBypass',
        `Xuất .docx (${finishedWords.toLocaleString('vi-VN')} từ) và tự động kích hoạt Humanize.`
      );

      const docxFile = await buildFormattedDocxFromSession(finishedSess);
      if (onSendDocxToHumanizer) {
        onSendDocxToHumanizer(finishedSess.linkedOrderCode, docxFile, {
          autoStart: true,
        });
      } else {
        onToast(`Đã viết xong bài "${finishedSess.title}".`);
      }
    } catch (err) {
      if (!isAbortError(err)) {
        onToast(
          err instanceof Error
            ? err.message
            : 'Chế độ Hoàn toàn Tự động bị gián đoạn.'
        );
      }
    } finally {
      setFullAutoSessionId(null);
      setFullAutoPhase(null);
      setCurrentStepLabel('');
    }
  };

  /**
   * Run ALL open sessions that have remaining unwritten sections in parallel
   * using a bounded worker pool (`concurrencyLimit` papers at once).
   */
  const handleRunAllPapersParallel = async () => {
    if (!hasEffectiveApiKey) {
      setShowApiModal(true);
      onToast('Vui lòng nhập API Key Chatbot trước khi chạy song song nhiều bài.');
      return;
    }

    const runnableIds = sessionsRef.current
      .filter((s) => {
        if (isWriterSessionBusy(s)) return false;
        const doneSecs = s.outline.filter(
          (sec) => countWords(sec.content) > 0
        ).length;
        return doneSecs < s.outline.length;
      })
      .map((s) => s.id);

    if (runnableIds.length === 0) {
      onToast('Tất cả các bài đang mở đều đã viết đủ các mục.');
      return;
    }

    // Mark all runnable sessions as queued
    runnableIds.forEach((id) => {
      pausedSessionIdsRef.current.delete(id);
      mutateSessionById(id, (s) => ({
        ...s,
        batchStatus: 'queued',
        batchErrorMsg: undefined,
      }));
    });

    onToast(
      `Bắt đầu viết song song ${runnableIds.length} bài (${concurrencyLimit} luồng đồng thời)...`
    );

    const queue = [...runnableIds];
    const workerCount = Math.min(concurrencyLimit, queue.length);

    const runWorker = async () => {
      while (queue.length > 0) {
        const nextSessionId = queue.shift();
        if (!nextSessionId) break;
        if (pausedSessionIdsRef.current.has(nextSessionId)) continue;
        try {
          await runSinglePaperPipeline(nextSessionId, true);
        } catch {
          // Individual paper error is already recorded on its tab
        }
      }
    };

    await Promise.allSettled(
      Array.from({ length: workerCount }, () => runWorker())
    );

    onToast('Đã hoàn tất đợt chạy song song các bài viết!');
  };

  /**
   * Launches N independent Same-Class Cohort Clones from `activeSession`:
   * 1. Queries ONE rich Master CrossRef Pool (~35-45 real peer-reviewed DOI works) PLUS
   *    parallel targeted CrossRef queries for slots that chose custom sub-topics/methods/frameworks.
   * 2. Randomly shuffles & draws `config.sourcesPerPaper` (e.g. 15) sources per student clone.
   * 3. Applies each student's freely chosen Font, Font Size, Line Spacing, Alignment, Methodology,
   *    Structural Lens, Sub-Topic, Case Study, Theoretical Model, Citation Style & Language.
   * 4. Optionally runs parallel distinct outline + full-paper writing immediately.
   */
  const handleLaunchCohortClones = async (config: CohortCloneLaunchConfig) => {
    if (!activeSession) return;
    if (config.autoRunImmediately && !hasEffectiveApiKey) {
      setShowCohortCloneModal(false);
      setShowApiModal(true);
      onToast('Vui lòng cấu hình API Key trước khi chạy viết tự động cả nhóm.');
      return;
    }

    setLaunchingCohort(true);
    setCohortLaunchStatus(
      `Đang quét bể nguồn học thuật (CrossRef chung + chuyên biệt theo đề tài/phương pháp${
        effectiveWriter.isHybrid ? ' + Perplexity Web' : ''
      }) cho ${config.cloneCount} bài...`
    );

    const signal = getFreshAiSignal();
    try {
      const masterPoolPromise = fetchCohortMasterCrossrefPool(
        activeSession,
        signal
      );
      const targetedCachePromise = fetchCohortTargetedCrossrefCache(
        config.slots,
        activeSession.subject || '',
        signal
      );

      let sharedWebContext = '';
      const existingRaw = (activeSession.researchedSources || '').trim();
      const perpMarker = '=== PERPLEXITY REAL-TIME WEB RESEARCH';
      const existingSplit = existingRaw.indexOf(perpMarker);
      if (existingSplit !== -1) {
        sharedWebContext = existingRaw.slice(existingSplit).trim();
      } else if (effectiveWriter.isHybrid && hasPerplexityKey) {
        try {
          const fullDossier = await researchSourcesWithPerplexity(
            activeSession,
            effectiveWriter.researchProfile,
            signal
          );
          const idx = fullDossier.indexOf(perpMarker);
          sharedWebContext =
            idx !== -1 ? fullDossier.slice(idx).trim() : fullDossier;
        } catch {
          // Non-fatal: CrossRef pool still powers verified citations
        }
      }

      const [masterPool, targetedCache] = await Promise.all([
        masterPoolPromise,
        targetedCachePromise,
      ]);
      const cohortGroupId = `cohort_${Date.now().toString(36)}`;
      const nowMs = Date.now();

      const createdClones: WriterSession[] = config.slots.map((slot, idx) => {
        const cloneNumber = idx + 1;
        const archetype =
          COHORT_STRUCTURAL_ARCHETYPES.find((a) => a.id === slot.archetypeId) ||
          COHORT_STRUCTURAL_ARCHETYPES[
            idx % COHORT_STRUCTURAL_ARCHETYPES.length
          ];
        const methodology =
          COHORT_METHODOLOGIES.find((m) => m.id === slot.methodologyId) ||
          COHORT_METHODOLOGIES[0];

        const queryKey = buildSlotQueryCacheKey(slot, activeSession.subject || '');
        const targetedPool = queryKey ? targetedCache.get(queryKey) || [] : [];

        const slotCitationStyle = slot.citationStyle || activeSession.citationStyle;
        const { dossier, sampledCount } = buildRandomSampledDossierForClone(
          masterPool,
          slotCitationStyle,
          config.sourcesPerPaper,
          sharedWebContext,
          targetedPool
        );

        const resolvedWords = Math.max(
          300,
          Number(slot.targetWordCount) || activeSession.targetWordCount || 2000
        );
        const resolvedTopic = slot.customTopic.trim() || activeSession.topic;
        const resolvedLang =
          slot.writingLanguage || activeSession.writingLanguage;

        // Preserve original shared brief context if student overrode the sub-topic
        const instructionChunks: string[] = [];
        if (
          slot.customTopic.trim() &&
          activeSession.topic.trim() &&
          slot.customTopic.trim().toLowerCase() !==
            activeSession.topic.trim().toLowerCase()
        ) {
          instructionChunks.push(
            `[OVERARCHING CLASS PROMPT]: ${activeSession.topic.trim()}`
          );
        }
        if (activeSession.instructions.trim()) {
          instructionChunks.push(activeSession.instructions.trim());
        }
        if (slot.customInstructions.trim()) {
          instructionChunks.push(
            `[INDIVIDUAL PAPER DIRECTIVES (#${cloneNumber})]: ${slot.customInstructions.trim()}`
          );
        }
        const resolvedInstructions = instructionChunks.join('\n\n');

        const baseOutline = parseAiOutlineJson(
          '',
          resolvedWords,
          slotCitationStyle
        ).map((sec, sIdx) => ({
          ...sec,
          id: `sec_${nowMs}_${cloneNumber}_${sIdx}`,
        }));

        const linkedOrderObj = slot.linkedOrderCode
          ? orders.find((o) => o.orderCode === slot.linkedOrderCode)
          : undefined;
        const resolvedStudentName =
          slot.studentName.trim() || linkedOrderObj?.clientDisplayName || '';
        const resolvedStudentId = slot.studentId.trim();

        const baseCover =
          activeSession.format.coverPage || DEFAULT_COVER_PAGE_CONFIG;
        const nextCover: CoverPageConfig = {
          ...baseCover,
          enabled: Boolean(
            baseCover.enabled || resolvedStudentName || resolvedStudentId
          ),
          templateId: slot.coverTemplateId || baseCover.templateId,
          studentName: resolvedStudentName || baseCover.studentName,
          studentId: resolvedStudentId || baseCover.studentId,
        };

        const nextFormat: DocumentFormatConfig = {
          ...activeSession.format,
          preset: 'CUSTOM',
          fontFamily: slot.fontFamily || activeSession.format.fontFamily,
          fontSizePt:
            Number(slot.fontSizePt) || activeSession.format.fontSizePt || 12,
          lineSpacing:
            slot.lineSpacing || activeSession.format.lineSpacing || 1.5,
          textAlign: slot.textAlign || activeSession.format.textAlign || 'left',
          runningHeader: formatDefaultRunningHeader(resolvedTopic),
          coverPage: nextCover,
        };

        const customMethodText = slot.customMethodology.trim();
        const customApproachText = slot.customApproach.trim();
        const displayMethodTag = customMethodText
          ? customMethodText.slice(0, 22)
          : methodology.shortTag;

        const shortTopic = (resolvedTopic || activeSession.subject || 'Nhóm')
          .trim()
          .slice(0, 24);
        const tabTitle = slot.linkedOrderCode
          ? `${slot.linkedOrderCode} · Bản #${cloneNumber}`
          : resolvedStudentName
          ? `Bản #${cloneNumber} (${resolvedStudentName}) · ${shortTopic}`
          : `Bản #${cloneNumber}/${config.cloneCount} · ${displayMethodTag}`;

        return {
          ...activeSession,
          id: `ws_cohort_${nowMs}_${cloneNumber}_${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          title: tabTitle,
          linkedOrderCode: slot.linkedOrderCode,
          topic: resolvedTopic,
          targetWordCount: resolvedWords,
          citationStyle: slotCitationStyle,
          writingLanguage: resolvedLang,
          instructions: resolvedInstructions,
          format: nextFormat,
          outline: baseOutline,
          activeSectionId: baseOutline[0]?.id || '',
          fullPaperOverride: '',
          batchStatus: config.autoRunImmediately ? 'queued' : 'idle',
          batchErrorMsg: undefined,
          researchedSources: dossier || activeSession.researchedSources || '',
          researchedSourcesTopic: (resolvedTopic || tabTitle).trim(),
          cohortMeta: {
            cohortGroupId,
            cloneIndex: cloneNumber,
            cohortSize: config.cloneCount,
            archetypeId: archetype.id,
            archetypeLabel: customApproachText || archetype.label,
            customApproach: customApproachText || undefined,
            methodologyId: methodology.id,
            methodologyLabel: customMethodText || methodology.label,
            customMethodology: customMethodText || undefined,
            customTopic: slot.customTopic.trim() || undefined,
            customCaseFocus: slot.customCaseFocus.trim() || undefined,
            customFramework: slot.customFramework.trim() || undefined,
            customInstructions: slot.customInstructions.trim() || undefined,
            sampledSourceCount: sampledCount,
            poolTotalCount: masterPool.length + targetedPool.length,
            needsDistinctOutline: true,
          },
          historyStack: [],
          historyIndex: -1,
          updatedAt: new Date(nowMs + idx).toISOString(),
        };
      });

      const mergedSessions = [...sessionsRef.current, ...createdClones];
      sessionsRef.current = mergedSessions;
      setSessions(mergedSessions);
      setActiveSessionId(createdClones[0].id);
      setLeftTab('outline');
      setShowCohortCloneModal(false);
      setLaunchingCohort(false);
      setCohortLaunchStatus('');

      onToast(
        masterPool.length > 0
          ? `Đã tạo ${createdClones.length} bài riêng biệt (mỗi bài tự chọn Font/Cỡ chữ, Phương pháp & bốc ngẫu nhiên ${config.sourcesPerPaper} nguồn DOI thật)!`
          : `Đã tạo ${createdClones.length} bài riêng biệt với cấu trúc & phương pháp khác nhau!`
      );

      if (config.autoRunImmediately) {
        const cloneIds = createdClones.map((c) => c.id);
        cloneIds.forEach((id) => pausedSessionIdsRef.current.delete(id));
        const queue = [...cloneIds];
        const workerCount = Math.min(concurrencyLimit, queue.length);
        const runCloneWorker = async () => {
          while (queue.length > 0) {
            const nextId = queue.shift();
            if (!nextId || pausedSessionIdsRef.current.has(nextId)) continue;
            try {
              await runSinglePaperPipeline(nextId, true);
            } catch {
              // Recorded per session tab
            }
          }
        };
        await Promise.allSettled(
          Array.from({ length: workerCount }, () => runCloneWorker())
        );
        onToast(
          `Đã viết xong toàn bộ ${createdClones.length} bài nhóm cùng lớp! Bấm "Soi trùng chéo" để kiểm tra.`
        );
      }
    } catch (err) {
      setLaunchingCohort(false);
      setCohortLaunchStatus('');
      onToast(
        err instanceof Error
          ? err.message
          : 'Không thể khởi tạo nhóm nhân bản lúc này.'
      );
    }
  };

  /**
   * Rewrites ONLY the colliding sentences in `pair.sessionIdB` so pairwise contiguous
   * 5-word overlap between two classmates drops cleanly below < 1% while preserving citations.
   */
  const scrubSingleCohortPair = async (pair: CohortPairSimilarity) => {
    const sessB = sessionsRef.current.find((s) => s.id === pair.sessionIdB);
    if (!sessB || pair.collisions.length === 0) return;

    const bySectionB = new Map<string, string[]>();
    for (const col of pair.collisions) {
      const list = bySectionB.get(col.sectionIdB) || [];
      list.push(
        `- Overlapping phrase ("${col.sharedPhrase}") inside sentence: "${col.sentenceB}"`
      );
      bySectionB.set(col.sectionIdB, list);
    }

    const signal = getFreshAiSignal();
    for (const [secIdB, collisionLines] of bySectionB.entries()) {
      const latestB = sessionsRef.current.find((s) => s.id === pair.sessionIdB);
      const secObj = latestB?.outline.find((sec) => sec.id === secIdB);
      if (!latestB || !secObj || !secObj.content.trim()) continue;

      const customPrompt =
        latestB.writingLanguage === 'Vietnamese'
          ? `Chỉ viết lại các câu bị trùng cụm từ với bài bạn cùng lớp dưới đây bằng cấu trúc câu và từ vựng học thuật mới hoàn toàn (tuyệt đối không còn bất kỳ chuỗi 5 từ liên tiếp nào giống cụm bị đánh dấu), giữ nguyên 100% các trích dẫn (Tác giả, Năm), số liệu và độ dài đoạn văn:\n${collisionLines.join(
              '\n'
            )}`
          : `Rewrite ONLY the sentences containing cross-student overlapping phrases listed below using fresh clause structure and distinct academic phrasing (eliminate every 5+ word contiguous match with the flagged phrases), while preserving 100% of existing in-text citations (Author, Year), numbers, and section length:\n${collisionLines.join(
              '\n'
            )}`;

      const res = await refineTextWithAi(
        latestB,
        secObj.title,
        secObj.content,
        'rewrite_academic',
        customPrompt,
        skillsRef.current,
        activeProfile,
        effectiveWriter.enableWebSearch,
        signal
      );

      if (res.content.trim()) {
        mutateSessionById(
          pair.sessionIdB,
          (s) => ({
            ...s,
            outline: s.outline.map((sec) =>
              sec.id === secIdB ? { ...sec, content: res.content } : sec
            ),
          }),
          true
        );
      }
    }
  };

  const handleScrubPairCollisions = async (pair: CohortPairSimilarity) => {
    if (!hasEffectiveApiKey) {
      setShowCohortSimilarityModal(false);
      setShowApiModal(true);
      onToast('Vui lòng cấu hình API Key trước khi khử câu trùng bằng AI.');
      return;
    }
    const key = `${pair.sessionIdA}__${pair.sessionIdB}`;
    setScrubbingPairKey(key);
    try {
      await scrubSingleCohortPair(pair);
      onToast('Đã viết lại khử sạch các câu trùng chéo của cặp bài này!');
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Lỗi khi khử câu trùng chéo.'
      );
    } finally {
      setScrubbingPairKey(null);
    }
  };

  const handleScrubAllRiskyPairs = async (pairs: CohortPairSimilarity[]) => {
    if (!hasEffectiveApiKey) {
      setShowCohortSimilarityModal(false);
      setShowApiModal(true);
      onToast('Vui lòng cấu hình API Key trước khi khử câu trùng bằng AI.');
      return;
    }
    setScrubbingPairKey('__ALL__');
    try {
      for (const p of pairs) {
        await scrubSingleCohortPair(p);
      }
      onToast(`Đã khử sạch trùng lặp chéo cho toàn bộ ${pairs.length} cặp bài!`);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Lỗi khi khử câu trùng hàng loạt.'
      );
    } finally {
      setScrubbingPairKey(null);
    }
  };

  const handlePauseAllPapers = () => {
    sessionsRef.current.forEach((s) => {
      pausedSessionIdsRef.current.add(s.id);
      if (isWriterSessionBusy(s)) {
        mutateSessionById(s.id, (prev) => ({
          ...prev,
          batchStatus: 'paused',
          outline: prev.outline.map((sec) =>
            sec.status === 'generating' ? { ...sec, status: 'idle' } : sec
          ),
        }));
      }
    });
    onToast('Đã gửi lệnh tạm dừng tất cả các bài đang chạy.');
  };

  // --- Ribbon Formatting & Manual Editing Actions ---
  const handleUpdateFormat = (patch: Partial<DocumentFormatConfig>) => {
    mutateActiveSession((s) => ({
      ...s,
      format: {
        ...s.format,
        ...patch,
      },
    }));
  };

  const handleApplyPreset = (preset: Exclude<AcademicPresetKey, 'CUSTOM'>) => {
    const presetMeta = ACADEMIC_FORMAT_PRESETS[preset];
    mutateActiveSession((s) => ({
      ...s,
      format: {
        ...s.format,
        ...presetMeta.config,
      },
    }));
    onToast(`Đã áp dụng chuẩn định dạng ${presetMeta.label}.`);
  };

  const currentSection = useMemo(() => {
    if (!activeSession) return null;
    return (
      activeSession.outline.find((s) => s.id === activeSession.activeSectionId) ||
      activeSession.outline[0] ||
      null
    );
  }, [activeSession]);

  const handleInlineFormat = (marker: '**' | '*' | '__' | 'clear') => {
    if (!activeSession || !currentSection) return;
    const el = activeTextareaRef.current;
    const text = currentSection.content;

    if (!el || el.selectionStart === el.selectionEnd) {
      if (marker === 'clear') {
        const cleaned = text
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/__([^_]+)__/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1');
        handleUpdateOutlineSection(currentSection.id, { content: cleaned }, true);
        return;
      }
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = text.slice(start, end);

    let replacement = selected;
    if (marker === 'clear') {
      replacement = selected
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1');
    } else {
      replacement = `${marker}${selected}${marker}`;
    }

    const nextContent = text.slice(0, start) + replacement + text.slice(end);
    handleUpdateOutlineSection(currentSection.id, { content: nextContent }, true);
  };

  const handleBlockPrefix = (
    prefix: '# ' | '## ' | '### ' | '• ' | '1. ' | 'body'
  ) => {
    if (!activeSession || !currentSection) return;
    const el = activeTextareaRef.current;
    const text = currentSection.content;
    const cursor = el ? el.selectionStart : 0;

    const lineStart = text.lastIndexOf('\n', Math.max(0, cursor - 1)) + 1;
    const lineEndIdx = text.indexOf('\n', cursor);
    const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
    const currentLine = text.slice(lineStart, lineEnd);
    const strippedLine = currentLine.replace(
      /^(#{1,6}\s+|[-*•]\s+|\d+\.\s+)/,
      ''
    );

    const nextLine = prefix === 'body' ? strippedLine : `${prefix}${strippedLine}`;
    const nextContent =
      text.slice(0, lineStart) + nextLine + text.slice(lineEnd);
    handleUpdateOutlineSection(currentSection.id, { content: nextContent }, true);
  };

  const handleConfirmResetPaper = async () => {
    if (!activeSession) return;
    pausedSessionIdsRef.current.add(activeSession.id);

    const nowIso = new Date().toISOString();
    let nextSession: WriterSession;
    let nextTab: 'brief' | 'outline' = 'brief';
    let toastMessage = '';

    if (resetScope === 'content_only') {
      nextSession = {
        ...activeSession,
        batchStatus: 'idle',
        batchErrorMsg: undefined,
        fullPaperOverride: '',
        researchedSources: '',
        researchedSourcesTopic: '',
        historyStack: [],
        historyIndex: -1,
        outline: activeSession.outline.map((sec) => ({
          ...sec,
          content: '',
          status: 'idle',
          errorMsg: undefined,
        })),
        updatedAt: nowIso,
      };
      nextTab = 'outline';
      toastMessage =
        'Đã xóa toàn bộ nội dung chữ, báo cáo lỗi & bộ nguồn cũ (giữ nguyên Đề bài & khung Dàn ý) để tra cứu nguồn mới và viết lại!';
    } else if (resetScope === 'everything') {
      const fresh = createDefaultSession(null);
      nextSession = {
        ...fresh,
        id: activeSession.id,
        format: {
          ...fresh.format,
          fontFamily: activeSession.format.fontFamily,
          fontSizePt: activeSession.format.fontSizePt,
        },
        researchedSources: '',
        researchedSourcesTopic: '',
        updatedAt: nowIso,
      };
      nextTab = 'brief';
      toastMessage =
        'Đã xóa trắng toàn bộ nội dung, dàn ý & đề bài để bắt đầu bài mới từ đầu!';
    } else {
      // Default: 'content_and_outline' — reset written content and outline back to default while keeping brief/rubric/order link
      const resetOutline = parseAiOutlineJson(
        '',
        activeSession.targetWordCount,
        activeSession.citationStyle
      );
      nextSession = {
        ...activeSession,
        outline: resetOutline,
        activeSectionId: resetOutline[0]?.id || '',
        fullPaperOverride: '',
        researchedSources: '',
        researchedSourcesTopic: '',
        batchStatus: 'idle',
        batchErrorMsg: undefined,
        historyStack: [],
        historyIndex: -1,
        updatedAt: nowIso,
      };
      nextTab = 'brief';
      toastMessage =
        'Đã xóa toàn bộ bài viết & dàn ý đang làm (giữ lại Đề bài & Rubric) để làm lại từ đầu!';
    }

    // Update local state & localStorage synchronously so immediate F5 never restores deleted content
    const oldSessionId = activeSession.id;
    let finalNextSession = nextSession;
    if (resetScope === 'everything') {
      // Retire old ID completely so neither localStorage nor Firestore can resurrect the deleted paper
      markSessionIdDeleted(oldSessionId);
      delete lastSyncedSessionAtRef.current[oldSessionId];
      void deleteWriterSessionFromCloud(oldSessionId);
      finalNextSession = {
        ...nextSession,
        id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      };
    }

    lastSyncedSessionAtRef.current[finalNextSession.id] =
      finalNextSession.updatedAt;
    const updatedSessions = sessionsRef.current.map((s) =>
      s.id === oldSessionId ? finalNextSession : s
    );
    saveWriterSessions(updatedSessions);
    try {
      localStorage.setItem(
        'assigntrack_ai_writer_active_session_v1',
        finalNextSession.id
      );
    } catch {
      // ignore
    }
    setSessions(updatedSessions);
    if (finalNextSession.id !== oldSessionId) {
      setActiveSessionId(finalNextSession.id);
    }
    setLeftTab(nextTab);
    setShowResetConfirmModal(false);

    // Clear QA error report, red/green section highlights, and per-order activity log on paper reset
    setAuditReport(null);
    setSectionAuditStates({});
    setFocusedAuditIssueId(null);
    setAutoFixProgress({
      currentStepIndex: 0,
      batchTotal: 0,
      currentStepTitle: '',
    });
    setShowAuditModal(false);
    handleClearActiveOrderLogs();

    // Push reset immediately to Firestore (for partial resets that keep the same session)
    if (
      resetScope !== 'everything' &&
      cloudSyncState !== 'permission_denied'
    ) {
      await saveWriterSessionToCloud(finalNextSession);
    }

    onToast(toastMessage);
  };

  const handleUndo = () => {
    if (!activeSession || activeSession.historyIndex <= 0) return;
    const prevIdx = activeSession.historyIndex - 1;
    try {
      const snapshot = JSON.parse(activeSession.historyStack[prevIdx]) as Array<{
        id: string;
        content: string;
      }>;
      const contentMap = new Map(snapshot.map((i) => [i.id, i.content]));
      mutateActiveSession((s) => ({
        ...s,
        historyIndex: prevIdx,
        outline: s.outline.map((sec) => ({
          ...sec,
          content: contentMap.get(sec.id) ?? sec.content,
        })),
      }));
    } catch {
      // ignore
    }
  };

  const handleRedo = () => {
    if (
      !activeSession ||
      activeSession.historyIndex >= activeSession.historyStack.length - 1
    ) {
      return;
    }
    const nextIdx = activeSession.historyIndex + 1;
    try {
      const snapshot = JSON.parse(activeSession.historyStack[nextIdx]) as Array<{
        id: string;
        content: string;
      }>;
      const contentMap = new Map(snapshot.map((i) => [i.id, i.content]));
      mutateActiveSession((s) => ({
        ...s,
        historyIndex: nextIdx,
        outline: s.outline.map((sec) => ({
          ...sec,
          content: contentMap.get(sec.id) ?? sec.content,
        })),
      }));
    } catch {
      // ignore
    }
  };

  const handleFindReplace = (
    findText: string,
    replaceText: string,
    replaceAll: boolean
  ) => {
    if (!activeSession || !findText) return;
    let replacementsCount = 0;
    mutateActiveSession(
      (s) => ({
        ...s,
        outline: s.outline.map((sec) => {
          if (!sec.content.includes(findText)) return sec;
          if (replaceAll) {
            const parts = sec.content.split(findText);
            replacementsCount += parts.length - 1;
            return { ...sec, content: parts.join(replaceText) };
          }
          if (replacementsCount === 0) {
            replacementsCount += 1;
            return {
              ...sec,
              content: sec.content.replace(findText, replaceText),
            };
          }
          return sec;
        }),
      }),
      true
    );
    onToast(
      replacementsCount > 0
        ? `Đã thay thế ${replacementsCount} vị trí cho "${findText}".`
        : `Không tìm thấy "${findText}" trong bài.`
    );
  };

  const handleAiRefineCurrentSection = async (
    action: AiRefineAction,
    customPrompt = ''
  ) => {
    if (!activeSession || !currentSection) return;
    if (!currentSection.content.trim()) {
      onToast('Mục này chưa có nội dung. Hãy bấm "Viết" hoặc gõ bản nháp trước.');
      return;
    }
    if (!hasEffectiveApiKey) {
      setShowApiModal(true);
      onToast('Vui lòng nhập API Key Chatbot trước.');
      return;
    }

    setRefiningSection(true);
    const t0 = Date.now();
    const beforeWords = countWords(currentSection.content);
    const signal = getFreshAiSignal();
    setCurrentStepLabel(`Đang chỉnh sửa mục "${currentSection.title}"...`);
    const refineLogId = pushActivityLog(
      'running',
      `Sửa mục: ${currentSection.title}`,
      customPrompt.trim() || 'Đang nâng cấp văn phong & nội dung học thuật...'
    );
    try {
      const preparedSess =
        (await ensureHybridSourcesForSession(activeSession.id, signal)) ||
        activeSession;
      const { content: revised, changeSummary } = await refineTextWithAi(
        preparedSess,
        currentSection.title,
        currentSection.content,
        action,
        customPrompt,
        skills,
        activeProfile,
        effectiveWriter.enableWebSearch,
        signal
      );
      const afterWords = countWords(revised);
      const delta = afterWords - beforeWords;
      const deltaStr = `${beforeWords}w → ${afterWords}w (${delta >= 0 ? `+${delta}` : delta}w)`;
      handleUpdateOutlineSection(
        currentSection.id,
        { content: revised, status: 'completed' },
        true
      );
      updateActivityLog(refineLogId, {
        status: 'success',
        title: `Đã sửa mục: ${currentSection.title}`,
        detail: changeSummary
          ? `[${deltaStr}] ${changeSummary}`
          : `[${deltaStr}] Đã cập nhật và nâng cấp nội dung mục này.`,
        durationSec: (Date.now() - t0) / 1000,
      });
      setCurrentStepLabel('');
      onToast(`AI đã sửa xong mục "${currentSection.title}" (${deltaStr}).`);
    } catch (err) {
      setCurrentStepLabel('');
      if (isAbortError(err)) return;
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể chỉnh sửa mục này bằng AI.';
      updateActivityLog(refineLogId, {
        status: 'error',
        title: `Lỗi sửa mục: ${currentSection.title}`,
        detail: msg,
        durationSec: (Date.now() - t0) / 1000,
      });
      onToast(msg);
    } finally {
      setRefiningSection(false);
    }
  };

  // --- Final Academic QA Auditor Agent (Layer 1: Deterministic + Crossref, Layer 2: AI Examiner) ---
  const handleRunPaperAudit = async () => {
    if (!activeSession) return;
    if (totalDraftedWords === 0) {
      onToast('Bài viết chưa có nội dung để kiểm duyệt.');
      return;
    }

    setShowAuditModal(true);
    setIsAuditingPaper(true);
    setAuditStatusLabel('Lớp 1: Đang kiểm tra cấu trúc, trích dẫn 1-1 và xác thực DOI trên Crossref...');
    const targetSessionId = activeSession.id;
    const signal = getFreshAiSignal();
    const startTs = Date.now();
    const auditLogId = pushActivityLog(
      'running',
      'Kiểm duyệt bài cuối cùng (AI Academic QA)',
      'Lớp 1: Kiểm tra Crossref DOI thật, khớp trích dẫn 1-1 và độ hoàn chỉnh từng mục.'
    );
    setCurrentStepLabel('Đang kiểm duyệt bài viết (Crossref DOI + AI Giám khảo)...');

    try {
      const latestSess =
        sessionsRef.current.find((s) => s.id === targetSessionId) || activeSession;

      const detResult = await runDeterministicPaperAudit(
        latestSess,
        (label) => {
          setAuditStatusLabel(label);
          setCurrentStepLabel(label);
        },
        signal
      );

      let report: PaperAuditReport;
      if (hasEffectiveApiKey) {
        setAuditStatusLabel(
          'Lớp 2: AI Giám khảo đang rà soát mâu thuẫn nội dung, lệch tiêu đề và Rubric...'
        );
        setCurrentStepLabel('Lớp 2: AI Giám khảo đang đọc duyệt toàn bài...');
        report = await runAiPaperAudit(
          latestSess,
          detResult,
          skills,
          effectiveWriter.profile,
          effectiveWriter.enableWebSearch,
          signal
        );
      } else {
        const criticalCount = detResult.issues.filter(
          (i) => i.severity === 'critical'
        ).length;
        const warningCount = detResult.issues.filter(
          (i) => i.severity === 'warning'
        ).length;
        const score = Math.max(
          15,
          Math.min(100, 100 - criticalCount * 14 - warningCount * 5)
        );
        report = {
          score,
          verdict:
            criticalCount > 0
              ? 'critical_errors'
              : warningCount > 0 || score < 85
              ? 'needs_revision'
              : 'pass',
          summary:
            criticalCount === 0
              ? 'Đã hoàn tất kiểm tra Lớp 1 (Crossref DOI + Khớp trích dẫn). Cấu hình API Key để bật thêm Lớp 2 (AI Giám khảo).'
              : `Lớp 1 phát hiện ${criticalCount} lỗi nghiêm trọng và ${warningCount} cảnh báo cần xử lý.`,
          checkedDoiCount: detResult.checkedDoiCount,
          verifiedDoiCount: detResult.verifiedDoiCount,
          invalidDoiCount: detResult.invalidDoiCount,
          issues: detResult.issues,
          auditedAt: new Date().toISOString(),
        };
      }

      setAuditReport(report);
      // Paint all sections that have errors with red warning highlight on the paper canvas
      const initialErrorStates: Record<string, SectionAuditVisualState> = {};
      for (const issue of report.issues) {
        if (!issue.sectionId) continue;
        const prev = initialErrorStates[issue.sectionId];
        initialErrorStates[issue.sectionId] = {
          status: 'error',
          issueCount: (prev?.issueCount || 0) + 1,
          label: prev?.label || issue.title,
        };
      }
      setSectionAuditStates(initialErrorStates);

      const critCount = report.issues.filter((i) => i.severity === 'critical').length;
      const warnCount = report.issues.filter((i) => i.severity === 'warning').length;
      updateActivityLog(auditLogId, {
        status: critCount > 0 ? 'warning' : 'success',
        title: `Kết quả Kiểm duyệt: ${report.score}/100 điểm`,
        detail: `${critCount} lỗi nghiêm trọng · ${warnCount} cảnh báo · Crossref DOI hợp lệ: ${report.verifiedDoiCount}/${report.checkedDoiCount}.`,
        durationSec: (Date.now() - startTs) / 1000,
      });
    } catch (err) {
      if (!isAbortError(err)) {
        const msg =
          err instanceof Error ? err.message : 'Kiểm duyệt bài gặp lỗi.';
        updateActivityLog(auditLogId, {
          status: 'error',
          title: 'Kiểm duyệt bài bị gián đoạn',
          detail: msg,
          durationSec: (Date.now() - startTs) / 1000,
        });
        onToast(msg);
      }
    } finally {
      setIsAuditingPaper(false);
      setAuditStatusLabel('');
      setCurrentStepLabel('');
    }
  };

  const handleAutoFixAuditIssues = async (
    report: PaperAuditReport,
    selectedIssueIds?: string[]
  ) => {
    if (!activeSession) return;
    if (!hasEffectiveApiKey) {
      setShowApiModal(true);
      onToast('Vui lòng cấu hình API Key AI để tự động sửa lỗi.');
      return;
    }

    const selectedIdSet =
      selectedIssueIds && selectedIssueIds.length > 0
        ? new Set(selectedIssueIds)
        : null;
    const allFixableIssues = report.issues.filter(
      (i) => i.autoFixable && (!selectedIdSet || selectedIdSet.has(i.id))
    );
    if (allFixableIssues.length === 0) return;

    const targetSessionId = activeSession.id;
    const signal = getFreshAiSignal();

    // 1. Close the Audit modal immediately so the user watches the live red -> green walkthrough on the paper!
    setShowAuditModal(false);
    setIsAutoFixingAudit(true);

    const refSection = activeSession.outline.find((s) =>
      /^(references|bibliography|works cited|tài liệu tham khảo)/i.test(
        s.title.trim()
      )
    );

    // Order fixable issues top-to-bottom by their section index in the outline, then take up to 5 errors per batch
    const outlineIndexMap = new Map<string, number>();
    activeSession.outline.forEach((sec, idx) => outlineIndexMap.set(sec.id, idx));

    const resolveIssueSectionId = (issue: PaperAuditReport['issues'][number]): string | undefined => {
      if (
        issue.category === 'doi_and_sources' ||
        Boolean(issue.badDoi) ||
        Boolean(issue.missingCitations?.length)
      ) {
        return refSection?.id || issue.sectionId;
      }
      if (issue.sectionId) {
        return issue.sectionId;
      }
      if (issue.category === 'citation_sync') {
        return refSection?.id;
      }
      return issue.sectionId;
    };

    const sortedFixable = [...allFixableIssues].sort((a, b) => {
      const idxA = outlineIndexMap.get(resolveIssueSectionId(a) || '') ?? 999;
      const idxB = outlineIndexMap.get(resolveIssueSectionId(b) || '') ?? 999;
      return idxA - idxB;
    });

    const MAX_ERRORS_PER_BATCH = 5;
    const batchIssues = sortedFixable.slice(0, MAX_ERRORS_PER_BATCH);

    // Paint ALL sections with issues RED before starting sequential fixes
    const redMap: Record<string, SectionAuditVisualState> = {};
    for (const issue of report.issues) {
      const sid = resolveIssueSectionId(issue);
      if (!sid) continue;
      const prev = redMap[sid];
      redMap[sid] = {
        status: 'error',
        issueCount: (prev?.issueCount || 0) + 1,
        label: prev?.label || issue.title,
      };
    }
    setSectionAuditStates(redMap);

    // Group the selected batch (up to 5 errors) by section in top-to-bottom order
    type SectionFixTask = {
      sectionId: string;
      isReferences: boolean;
      issues: PaperAuditReport['issues'];
    };
    const orderedTasks: SectionFixTask[] = [];
    const taskBySec = new Map<string, SectionFixTask>();

    for (const issue of batchIssues) {
      const sid = resolveIssueSectionId(issue);
      if (!sid) continue;
      let existing = taskBySec.get(sid);
      if (!existing) {
        existing = {
          sectionId: sid,
          isReferences: Boolean(refSection && sid === refSection.id),
          issues: [],
        };
        taskBySec.set(sid, existing);
        orderedTasks.push(existing);
      }
      existing.issues.push(issue);
    }

    const scrollToPaperSection = (secId: string) => {
      const el = document.querySelector<HTMLElement>(
        `[data-writer-section-id="${secId}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    const waitMs = (ms: number) =>
      new Promise<void>((resolve) => window.setTimeout(resolve, ms));

    let fixedSectionsCount = 0;
    const fixedSectionIds = new Set<string>();
    const fixedSectionSummaries = new Map<string, string>();
    let processedErrorCount = 0;

    try {
      for (const task of orderedTasks) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const latestSess =
          sessionsRef.current.find((s) => s.id === targetSessionId) ||
          activeSession;
        const targetSec = latestSess.outline.find((s) => s.id === task.sectionId);
        if (!targetSec) continue;

        processedErrorCount += task.issues.length;
        const stepTitle = `${targetSec.title} (${task.issues.length} lỗi)`;
        setAutoFixProgress({
          currentStepIndex: Math.min(processedErrorCount, batchIssues.length),
          batchTotal: batchIssues.length,
          currentStepTitle: stepTitle,
        });

        // 1. Focus & smoothly scroll to the RED section on the A4 paper
        mutateSessionById(targetSessionId, (s) => ({
          ...s,
          activeSectionId: targetSec.id,
        }));
        scrollToPaperSection(targetSec.id);

        // 2. Switch highlight from RED -> FIXING (blue pulsing)
        setSectionAuditStates((prev) => ({
          ...prev,
          [targetSec.id]: {
            status: 'fixing',
            issueCount: task.issues.length,
            label: task.issues[0]?.title,
          },
        }));

        await waitMs(400);

        const secStart = Date.now();
        const label = `Đang tự động sửa "${targetSec.title}" (${processedErrorCount}/${batchIssues.length} lỗi)...`;
        setAuditStatusLabel(label);
        setCurrentStepLabel(label);
        const logId = pushActivityLog(
          'running',
          `Auto-Fix mục: ${targetSec.title}`,
          task.issues.map((i) => i.title).join(' · ').slice(0, 180)
        );

        const prevWords = countWords(targetSec.content);
        let newContent = '';
        let changeSummary = '';

        if (task.isReferences) {
          const badDois = task.issues
            .map((i) => i.badDoi)
            .filter((d): d is string => Boolean(d));
          const missingCites = task.issues.flatMap(
            (i) => i.missingCitations || []
          );

          const refFixed = await fixReferencesTargetedWithAi(
            latestSess,
            targetSec.id,
            badDois,
            missingCites,
            effectiveWriter.profile,
            effectiveWriter.enableWebSearch,
            signal
          );

          // Ground every entry on REAL Crossref metadata (eliminates reused titles, topic-as-title, stub entries, variant duplicates)
          const crossrefGrounded = await buildCrossrefVerifiedReferences(
            latestSess,
            refFixed.content,
            (progressLbl) => {
              setAuditStatusLabel(progressLbl);
              setCurrentStepLabel(progressLbl);
            },
            signal
          );

          let finalRefContent = crossrefGrounded.content.trim()
            ? crossrefGrounded.content
            : refFixed.content;
          const summaryParts = [crossrefGrounded.changeSummary];

          // Resolve doctoral vs Master's thesis contradiction across body & References if flagged
          const hasThesisContradiction = task.issues.some((i) =>
            /luận văn|luận án|doctoral|master/i.test(
              `${i.title} ${i.detail}`
            )
          );
          if (hasThesisContradiction) {
            const resolved = await resolveThesisTypeFromEvidence(
              latestSess,
              effectiveWriter.profile,
              signal
            );
            const targetThesisType =
              resolved.type !== 'unknown' ? resolved.type : 'doctoral';
            finalRefContent = alignThesisTypeWording(
              finalRefContent,
              targetThesisType
            );
            // Also align any conflicting wording in body sections
            mutateSessionById(
              targetSessionId,
              (s) => ({
                ...s,
                outline: s.outline.map((sec) =>
                  sec.id === targetSec.id
                    ? sec
                    : {
                        ...sec,
                        content: alignThesisTypeWording(
                          sec.content,
                          targetThesisType
                        ),
                      }
                ),
              }),
              false
            );
            summaryParts.push(
              `đồng bộ loại luận văn (${
                targetThesisType === 'doctoral'
                  ? 'Doctoral thesis / Luận án Tiến sĩ'
                  : "Master's thesis / Luận văn Thạc sĩ"
              }) giữa thân bài và References`
            );
          }

          newContent = finalRefContent;
          changeSummary = summaryParts.join(' · ');
        } else if (!targetSec.content.trim()) {
          newContent = await generateSectionWithAi(
            latestSess,
            targetSec.id,
            skills,
            effectiveWriter.profile,
            effectiveWriter.enableWebSearch,
            signal
          );
          changeSummary = 'Đã viết đầy đủ nội dung cho mục bị trống.';
        } else {
          const hints = task.issues.map(
            (i) => `${i.title}: ${i.detail}${i.fixHint ? ` -> ${i.fixHint}` : ''}`
          );
          const revised = await reviseOrCompleteSectionWithAi(
            latestSess,
            targetSec.id,
            'revise',
            `BẮT BUỘC SỬA TRIỆT ĐỂ CÁC LỖI KIỂM DUYỆT SAU (ưu tiên sửa đúng tiêu đề tiểu mục/chia tách mục 4.1 - 4.2 khớp với nội dung thực tế):\n${hints.join('\n')}`,
            skills,
            effectiveWriter.profile,
            effectiveWriter.enableWebSearch,
            signal,
            true
          );
          newContent = revised.content;
          changeSummary = revised.changeSummary;
        }

        const nextWords = countWords(newContent);
        const delta = nextWords - prevWords;

        mutateSessionById(
          targetSessionId,
          (s) => ({
            ...s,
            outline: s.outline.map((sec) =>
              sec.id === targetSec.id
                ? {
                    ...sec,
                    content: newContent,
                    status: 'completed',
                    errorMsg: undefined,
                  }
                : sec
            ),
          }),
          true
        );

        updateActivityLog(logId, {
          status: 'success',
          title: `Đã sửa xong: ${targetSec.title} (${prevWords} → ${nextWords} từ, ${
            delta >= 0 ? `+${delta}` : delta
          })`,
          detail: changeSummary,
          durationSec: (Date.now() - secStart) / 1000,
        });

        // 3. Turn this section GREEN ('fixed') so user sees clear visual confirmation!
        fixedSectionsCount++;
        fixedSectionIds.add(targetSec.id);
        fixedSectionSummaries.set(targetSec.id, changeSummary);
        setSectionAuditStates((prev) => ({
          ...prev,
          [targetSec.id]: {
            status: 'fixed',
            issueCount: 0,
            label: changeSummary,
          },
        }));

        // Brief pause so user clearly sees the green highlight before auto-scrolling to next red section
        await waitMs(750);
      }

      // 4. Re-run deterministic verification immediately to refresh the live score (e.g. 58/100 -> 100/100)
      if (fixedSectionsCount > 0) {
        setAuditStatusLabel('Đang kiểm chứng lại điểm QA sau khi sửa...');
        setCurrentStepLabel('Đang kiểm chứng lại điểm QA sau khi sửa...');
        const refreshedSess =
          sessionsRef.current.find((s) => s.id === targetSessionId) ||
          activeSession;
        const recheck = await runDeterministicPaperAudit(
          refreshedSess,
          (label) => {
            setAuditStatusLabel(label);
            setCurrentStepLabel(label);
          },
          signal
        );
        // Preserve any AI-layer issues on sections that were NOT part of this batch yet
        const batchIssueIds = new Set(batchIssues.map((i) => i.id));
        const remainingAiIssues = report.issues.filter(
          (i) =>
            i.id.startsWith('ai_') &&
            !batchIssueIds.has(i.id) &&
            (!i.sectionId || !fixedSectionIds.has(i.sectionId))
        );
        const mergedRemainingIssues = [...recheck.issues, ...remainingAiIssues];

        const critCount = mergedRemainingIssues.filter(
          (i) => i.severity === 'critical'
        ).length;
        const warnCount = mergedRemainingIssues.filter(
          (i) => i.severity === 'warning'
        ).length;
        const nextScore = Math.max(
          15,
          Math.min(100, 100 - critCount * 14 - warnCount * 5)
        );
        setAuditReport({
          score: nextScore,
          verdict:
            critCount > 0
              ? 'critical_errors'
              : warnCount > 0 || nextScore < 85
              ? 'needs_revision'
              : 'pass',
          summary:
            critCount === 0
              ? `Đã tự động sửa xong ${batchIssues.length} lỗi. Điểm kiểm duyệt hiện tại: ${nextScore}/100 — sẵn sàng xuất file!`
              : `Đã sửa xong đợt ${batchIssues.length} lỗi. Điểm tăng lên ${nextScore}/100 — còn lại ${critCount} lỗi nghiêm trọng và ${warnCount} cảnh báo.`,
          checkedDoiCount: recheck.checkedDoiCount,
          verifiedDoiCount: recheck.verifiedDoiCount,
          invalidDoiCount: recheck.invalidDoiCount,
          issues: mergedRemainingIssues,
          auditedAt: new Date().toISOString(),
        });

        // Update visual badges: keep cleanly fixed sections GREEN, mark any remaining errored sections RED
        const nextVisualStates: Record<string, SectionAuditVisualState> = {};
        fixedSectionIds.forEach((fid) => {
          nextVisualStates[fid] = {
            status: 'fixed',
            issueCount: 0,
            label: fixedSectionSummaries.get(fid),
          };
        });
        for (const issue of mergedRemainingIssues) {
          const sid = resolveIssueSectionId(issue);
          if (!sid) continue;
          const prev = nextVisualStates[sid];
          nextVisualStates[sid] = {
            status: 'error',
            issueCount: prev?.status === 'error' ? prev.issueCount + 1 : 1,
            label: prev?.status === 'error' ? prev.label : issue.title,
          };
        }
        setSectionAuditStates(nextVisualStates);

        onToast(
          critCount === 0
            ? `Hoàn tất! Bài viết đã đạt ${nextScore}/100 điểm — không còn lỗi nghiêm trọng!`
            : `Đã sửa xong đợt ${batchIssues.length} lỗi (Điểm hiện tại: ${nextScore}/100). Bấm "Sửa tiếp" ở thanh đầu trang nếu còn lỗi.`
        );
      }
    } catch (err) {
      if (!isAbortError(err)) {
        const msg =
          err instanceof Error ? err.message : 'Tự động sửa lỗi bị gián đoạn.';
        onToast(msg);
      }
    } finally {
      setIsAutoFixingAudit(false);
      setAutoFixProgress({ currentStepIndex: 0, batchTotal: 0, currentStepTitle: '' });
      setAuditStatusLabel('');
      setCurrentStepLabel('');
    }
  };

  // --- Export & Order Integration ---
  const totalDraftedWords = useMemo(() => {
    if (!activeSession) return 0;
    return activeSession.outline.reduce(
      (sum, sec) => sum + countWords(sec.content),
      0
    );
  }, [activeSession]);

  useEffect(() => {
    if (totalDraftedWords === 0) {
      setAuditReport((prev) => (prev ? null : prev));
      setSectionAuditStates((prev) =>
        Object.keys(prev).length > 0 ? {} : prev
      );
    }
  }, [totalDraftedWords]);

  const totalOutlineTargetWords = useMemo(() => {
    if (!activeSession) return 0;
    return activeSession.outline.reduce(
      (sum, sec) =>
        isReferencesSectionTitle(sec.title) ? sum : sum + (sec.targetWords || 0),
      0
    );
  }, [activeSession]);

  const linkedOrder = useMemo(() => {
    if (!activeSession?.linkedOrderCode) return null;
    return (
      orders.find((o) => o.orderCode === activeSession.linkedOrderCode) || null
    );
  }, [activeSession?.linkedOrderCode, orders]);

  const handleExportDocx = async () => {
    if (!activeSession) return;
    setExportingDocx(true);
    try {
      const file = await buildFormattedDocxFromSession(activeSession);
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast(`Đã xuất file Word chuẩn định dạng: ${file.name}`);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Không thể xuất file .docx.'
      );
    } finally {
      setExportingDocx(false);
    }
  };

  const handleExportAllDraftedDocx = async () => {
    const draftedSessions = sessionsRef.current.filter((s) =>
      s.outline.some((sec) => countWords(sec.content) > 0)
    );
    if (draftedSessions.length === 0) return;

    setExportingAllDocx(true);
    try {
      for (const sess of draftedSessions) {
        const file = await buildFormattedDocxFromSession(sess);
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      onToast(
        `Đã tải xuống hàng loạt ${draftedSessions.length} file Word (.DOCX)!`
      );
    } catch (err) {
      onToast(
        err instanceof Error
          ? err.message
          : 'Không thể xuất hàng loạt file .docx.'
      );
    } finally {
      setExportingAllDocx(false);
    }
  };

  const handleAttachToLinkedOrder = async () => {
    if (!activeSession || !linkedOrder || !onAttachDocxToOrder) return;
    setAttachingToOrder(true);
    try {
      const file = await buildFormattedDocxFromSession(activeSession);
      await onAttachDocxToOrder(linkedOrder, file);
    } catch (err) {
      onToast(
        err instanceof Error
          ? err.message
          : 'Đính kèm file vào đơn hàng thất bại.'
      );
    } finally {
      setAttachingToOrder(false);
    }
  };

  const handlePushToHumanizer = async () => {
    if (!activeSession || !onSendDocxToHumanizer) return;
    try {
      const file = await buildFormattedDocxFromSession(activeSession);
      onSendDocxToHumanizer(activeSession.linkedOrderCode, file);
    } catch (err) {
      onToast(
        err instanceof Error
          ? err.message
          : 'Không thể chuyển bài sang Word Humanizer.'
      );
    }
  };

  if (!activeSession) return null;

  const isActivePaperOutlining = activeSession.batchStatus === 'outlining';
  const isActivePaperWriting =
    activeSession.batchStatus === 'writing_sections' ||
    activeSession.outline.some((sec) => sec.status === 'generating');

  return (
    <div className="surface-enter space-y-3">
      {/* Unified Multi-Paper Studio Header & Action Bar */}
      <WriterWorkspaceTabs
        sessions={sessions}
        activeSession={activeSession}
        orders={orders}
        concurrencyLimit={concurrencyLimit}
        exportingAll={exportingAllDocx}
        cloudSyncState={cloudSyncState}
        enabledSkillsCount={enabledSkillsCount}
        activeModelName={activeModelDisplayName}
        hasApiKey={hasEffectiveApiKey}
        linkedOrder={linkedOrder}
        totalDraftedWords={totalDraftedWords}
        attachingToOrder={attachingToOrder}
        exportingDocx={exportingDocx}
        onSelectSession={setActiveSessionId}
        onAddNewBlank={handleCreateNewSession}
        onImportMultipleOrders={handleImportMultipleOrders}
        onOpenCohortCloner={() => setShowCohortCloneModal(true)}
        onOpenCohortSimilarity={() => setShowCohortSimilarityModal(true)}
        onCloseSession={handleDeleteSession}
        onRunAllParallel={() => void handleRunAllPapersParallel()}
        onPauseAll={handlePauseAllPapers}
        onConcurrencyChange={setConcurrencyLimit}
        onExportAllDocx={() => void handleExportAllDraftedDocx()}
        onLoadFromOrder={handleLoadFromOrder}
        onOpenSkills={() => setShowSkillModal(true)}
        onOpenApiSettings={() => setShowApiModal(true)}
        onAttachToLinkedOrder={
          linkedOrder && onAttachDocxToOrder
            ? () => void handleAttachToLinkedOrder()
            : undefined
        }
        onPushToHumanizer={
          onSendDocxToHumanizer ? () => void handlePushToHumanizer() : undefined
        }
        onOpenDeliverModal={
          onDeliverDocxToClient ? () => setShowDeliverModal(true) : undefined
        }
        onExportDocx={() => void handleExportDocx()}
        onExportPdf={() => {
          if (!activeSession || totalDraftedWords === 0) {
            onToast('Chưa có nội dung để xuất PDF.');
            return;
          }
          onToast('Đang tạo tệp .PDF chuẩn A4...');
          void exportWriterSessionToPdf(activeSession)
            .then((fileName) => {
              onToast(`Đã tải xuống tệp PDF: ${fileName}`);
            })
            .catch((err) => {
              onToast(
                err instanceof Error
                  ? err.message
                  : 'Không thể xuất tệp PDF.'
              );
            });
        }}
      />

      {/* Streamlined Word Ribbon (sticky wrapper measured dynamically so sidebars never overlap) */}
      <div ref={ribbonWrapperRef} className="sticky top-15 z-30">
        <WriterWordRibbon
          format={activeSession.format}
          canUndo={activeSession.historyIndex > 0}
          canRedo={
            activeSession.historyIndex < activeSession.historyStack.length - 1
          }
          zoomPercent={zoomPercent}
          aiBusy={
            isActivePaperOutlining || isActivePaperWriting || refiningSection
          }
          onUpdateFormat={handleUpdateFormat}
          onApplyPreset={handleApplyPreset}
          onInlineFormat={handleInlineFormat}
          onBlockPrefix={handleBlockPrefix}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onFindReplace={handleFindReplace}
          onZoomChange={setZoomPercent}
          onAiRefineSection={(action, customPrompt) =>
            void handleAiRefineCurrentSection(action, customPrompt)
          }
          onOpenCoverPage={() => setShowCoverModal(true)}
          onRequestResetPaper={() => setShowResetConfirmModal(true)}
        />
      </div>

      {/* Main 3-Zone Workspace: Compact Left Brief/Outline + Centered A4 Paper + Compact Right AI Panel */}
      <div className="flex flex-col lg:flex-row lg:flex-wrap xl:flex-nowrap gap-3.5 items-start">
        {!focusPaperMode && (
          <div
            style={{
              top: `${stickyPanelsTopPx}px`,
              maxHeight: `calc(100vh - ${stickyPanelsTopPx + 16}px)`,
            }}
            className="w-full lg:w-[290px] xl:w-[300px] shrink-0 lg:sticky lg:z-20 lg:flex lg:flex-col bg-white border border-zinc-200/90 rounded-2xl shadow-sm overflow-hidden transition-[top] duration-150"
          >
            {/* Segmented Tab Switcher (Brief vs Outline) */}
            <div className="shrink-0 p-1.5 bg-zinc-100/80 border-b border-zinc-200/80 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setLeftTab('brief')}
                className={`btn-press py-1.5 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${
                  leftTab === 'brief'
                    ? 'bg-white text-[#12489B] shadow-2xs'
                    : 'text-zinc-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>1. Đề bài & Rubric</span>
              </button>

              <button
                type="button"
                onClick={() => setLeftTab('outline')}
                className={`btn-press py-1.5 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${
                  leftTab === 'outline'
                    ? 'bg-white text-[#12489B] shadow-2xs'
                    : 'text-zinc-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>2. Dàn ý ({activeSession.outline.length})</span>
              </button>
            </div>

            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
              {fullAutoSessionId === activeSession.id && fullAutoPhase && (
                <div className="m-3 mb-0 rounded-xl bg-[#0B2559] text-white p-3 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                      <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
                      <span>CHẾ ĐỘ HOÀN TOÀN TỰ ĐỘNG</span>
                    </span>
                    <span className="text-[10px] font-mono text-sky-200/80">
                      {fullAutoPhase === 'outlining'
                        ? 'Bước 1/3'
                        : fullAutoPhase === 'writing'
                        ? 'Bước 2/3'
                        : 'Bước 3/3'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] font-semibold">
                    <div
                      className={`px-2 py-1 rounded text-center ${
                        fullAutoPhase === 'outlining'
                          ? 'bg-sky-400/25 text-sky-200 ring-1 ring-sky-300/50'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      1. Lập dàn ý
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-center ${
                        fullAutoPhase === 'writing'
                          ? 'bg-sky-400/25 text-sky-200 ring-1 ring-sky-300/50'
                          : fullAutoPhase === 'pushing_hix'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      2. Viết tuần tự
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-center ${
                        fullAutoPhase === 'pushing_hix'
                          ? 'bg-sky-400/25 text-sky-200 ring-1 ring-sky-300/50'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      3. HixBypass
                    </div>
                  </div>
                </div>
              )}

              {leftTab === 'brief' ? (
                <WriterBriefPanel
                  session={activeSession}
                  onUpdateSession={(updater) => mutateActiveSession(updater)}
                  onUploadContextFiles={handleUploadContextFiles}
                  onSwitchToOutlineWithAi={() => {
                    setLeftTab('outline');
                    void handleAiGenerateOutlineForSession(activeSession.id);
                  }}
                  onRunFullAuto={() =>
                    void handleRunFullAutoPipeline(activeSession.id)
                  }
                  onRewriteNewPerspective={() =>
                    void handleRunFullAutoPipeline(activeSession.id, true)
                  }
                  fullAutoRunning={fullAutoSessionId === activeSession.id}
                />
              ) : (
                <WriterOutlinePanel
                  session={activeSession}
                  currentSectionId={currentSection?.id || ''}
                  totalDraftedWords={totalDraftedWords}
                  totalOutlineTargetWords={totalOutlineTargetWords}
                  generatingOutline={isActivePaperOutlining}
                  runningAllSections={isActivePaperWriting}
                  fullAutoRunning={fullAutoSessionId === activeSession.id}
                  onSelectSection={(secId) =>
                    mutateActiveSession((s) => ({ ...s, activeSectionId: secId }))
                  }
                onAiGenerateOutline={() =>
                  void handleAiGenerateOutlineForSession(activeSession.id)
                }
                onWriteAllSequentially={() =>
                  void handleWriteCurrentPaperSequentially()
                }
                onRunFullAuto={() =>
                  void handleRunFullAutoPipeline(activeSession.id)
                }
                onStopSequential={() => {
                  pausedSessionIdsRef.current.add(activeSession.id);
                  if (fullAutoSessionId === activeSession.id) {
                    setFullAutoSessionId(null);
                    setFullAutoPhase(null);
                  }
                }}
                onWriteSingleSection={(secId) =>
                  void handleWriteSingleSection(secId)
                }
                onAddSection={handleAddOutlineSection}
                onUpdateSection={handleUpdateOutlineSection}
                onMoveSection={handleMoveOutlineSection}
                onDeleteSection={handleDeleteOutlineSection}
              />
              )}
            </div>
          </div>
        )}

        <WriterPaperCanvas
          session={activeSession}
          currentSectionId={currentSection?.id || ''}
          zoomPercent={zoomPercent}
          focusPaperMode={focusPaperMode}
          containerClassName="w-full lg:flex-1 min-w-0"
          activeTextareaRef={activeTextareaRef}
          sectionAuditStates={sectionAuditStates}
          auditIssues={auditReport?.issues || []}
          focusedAuditIssueId={focusedAuditIssueId}
          onFixSingleIssue={(issue) => {
            if (!auditReport) return;
            void handleAutoFixAuditIssues(auditReport, [issue.id]);
          }}
          qaBanner={
            auditReport || isAutoFixingAudit
              ? {
                  score: auditReport?.score ?? 0,
                  remainingErrorCount: auditReport?.issues.length ?? 0,
                  autoFixableCount:
                    auditReport?.issues.filter((i) => i.autoFixable).length ?? 0,
                  isFixing: isAutoFixingAudit,
                  currentStepIndex: autoFixProgress.currentStepIndex,
                  batchTotal: autoFixProgress.batchTotal,
                  currentStepTitle: autoFixProgress.currentStepTitle,
                  onOpenAuditModal: () => setShowAuditModal(true),
                  onFixNextBatch: auditReport
                    ? () => void handleAutoFixAuditIssues(auditReport)
                    : undefined,
                }
              : null
          }
          onSelectSection={(secId) =>
            mutateActiveSession((s) => ({ ...s, activeSectionId: secId }))
          }
          onUpdateTopic={(nextTopic) =>
            mutateActiveSession((s) => ({ ...s, topic: nextTopic }))
          }
          onUpdateViewMode={(mode) =>
            mutateActiveSession((s) => ({ ...s, viewMode: mode }))
          }
          onToggleFocusPaperMode={() => setFocusPaperMode((v) => !v)}
          onUpdateFormat={handleUpdateFormat}
          onOpenCoverPage={() => setShowCoverModal(true)}
          onUpdateContextImages={(nextImages) =>
            mutateActiveSession((s) => ({ ...s, contextImages: nextImages }))
          }
          onToast={onToast}
          onUpdateSection={handleUpdateOutlineSection}
        />

        <WriterActivityPanel
          isOpen={showActivityPanel}
          onToggleOpen={toggleActivityPanel}
          stickyTopPx={stickyPanelsTopPx}
          isBusy={
            isActivePaperOutlining || isActivePaperWriting || refiningSection
          }
          onStopAi={handleStopActiveAi}
          currentStepLabel={currentStepLabel}
          researchedSources={activeSession.researchedSources}
          onRefreshSources={
            effectiveWriter.isHybrid
              ? () => {
                  const signal = getFreshAiSignal();
                  void ensureHybridSourcesForSession(
                    activeSession.id,
                    signal,
                    true
                  ).finally(() => setCurrentStepLabel(''));
                }
              : undefined
          }
          completedSectionsCount={
            activeSession.outline.filter((s) => countWords(s.content) > 0).length
          }
          totalSectionsCount={activeSession.outline.length}
          errorSectionsCount={
            activeSession.outline.filter((s) => s.status === 'error').length
          }
          onJumpToFirstError={() => {
            const firstErr = activeSession.outline.find(
              (s) => s.status === 'error'
            );
            if (firstErr) {
              setLeftTab('outline');
              mutateActiveSession((s) => ({
                ...s,
                activeSectionId: firstErr.id,
              }));
            }
          }}
          totalDraftedWords={totalDraftedWords}
          targetWordCount={activeSession.targetWordCount}
          logs={
            activityLogsByKey[getActivityLogKeyForSession(activeSession)] || []
          }
          orderScopeLabel={
            activeSession.linkedOrderCode?.trim()
              ? `#${activeSession.linkedOrderCode.trim()}`
              : 'Phiên riêng'
          }
          onClearLogs={handleClearActiveOrderLogs}
          onRunAudit={() => {
            if (auditReport) {
              setShowAuditModal(true);
            } else {
              void handleRunPaperAudit();
            }
          }}
          lastAuditScore={auditReport?.score ?? null}
          lastAuditCriticalCount={
            auditReport?.issues.filter((i) => i.severity === 'critical').length ||
            0
          }
          isAuditing={isAuditingPaper || isAutoFixingAudit}
        />
      </div>

      {/* Modals */}
      <WriterAuditModal
        isOpen={showAuditModal}
        report={auditReport}
        isAuditing={isAuditingPaper}
        isAutoFixing={isAutoFixingAudit}
        auditStatusLabel={auditStatusLabel}
        onRunAudit={() => void handleRunPaperAudit()}
        onAutoFixAll={(rep, selectedIds) =>
          void handleAutoFixAuditIssues(rep, selectedIds)
        }
        onJumpToSection={(secId, issueId) => {
          setLeftTab('outline');
          mutateActiveSession((s) => ({ ...s, activeSectionId: secId }));
          setFocusedAuditIssueId(null);
          if (issueId) {
            window.requestAnimationFrame(() => {
              setFocusedAuditIssueId(issueId);
            });
          }
        }}
        onClose={() => setShowAuditModal(false)}
      />

      <WriterApiSettingsModal
        isOpen={showApiModal}
        settings={aiSettings}
        serverKeysConfigured={serverKeysConfigured}
        onUpdateServerKeysConfigured={setServerKeysConfigured}
        onSaveSettings={handleSaveAiSettings}
        onClose={() => setShowApiModal(false)}
        onToast={onToast}
      />

      <WriterSkillLibraryModal
        isOpen={showSkillModal}
        skills={skills}
        onUpdateSkills={handleUpdateSkills}
        onClose={() => setShowSkillModal(false)}
        onToast={onToast}
      />

      <WriterCoverPageModal
        isOpen={showCoverModal}
        session={activeSession}
        linkedClientName={linkedOrder?.clientDisplayName}
        onSaveCoverPage={(coverPage: CoverPageConfig, nextTopic?: string, nextSubject?: string) => {
          mutateActiveSession((s) => ({
            ...s,
            topic: typeof nextTopic === 'string' ? nextTopic : s.topic,
            subject: typeof nextSubject === 'string' ? nextSubject : s.subject,
            format: {
              ...s.format,
              coverPage,
            },
          }));
        }}
        onClose={() => setShowCoverModal(false)}
        onToast={onToast}
      />

      <WriterDeliverModal
        isOpen={showDeliverModal}
        orders={orders}
        session={activeSession}
        totalDraftedWords={totalDraftedWords}
        onDeliver={async (targetOrder, opts) => {
          if (!onDeliverDocxToClient) return;
          const file = await buildFormattedDocxFromSession(activeSession);
          await onDeliverDocxToClient(targetOrder, file, opts);
          onToast(
            `Đã bàn giao và đẩy bài thành công lên portal cho khách #${targetOrder.orderCode}!`
          );
        }}
        onClose={() => setShowDeliverModal(false)}
        onToast={onToast}
      />

      <WriterCohortCloneModal
        isOpen={showCohortCloneModal}
        baseSession={activeSession}
        orders={orders}
        launching={launchingCohort}
        launchStatusLabel={cohortLaunchStatus}
        onLaunchCohort={(cfg) => void handleLaunchCohortClones(cfg)}
        onClose={() => setShowCohortCloneModal(false)}
      />

      <WriterCohortSimilarityModal
        isOpen={showCohortSimilarityModal}
        sessions={sessions}
        activeSession={activeSession}
        orders={orders}
        scrubbingPairKey={scrubbingPairKey}
        exportingAll={exportingAllDocx}
        onScrubPairCollisions={handleScrubPairCollisions}
        onScrubAllRiskyPairs={handleScrubAllRiskyPairs}
        onExportAllDocx={() => void handleExportAllDraftedDocx()}
        onJumpToSessionSection={(sid, secId) => {
          setActiveSessionId(sid);
          setLeftTab('outline');
          mutateSessionById(sid, (s) => ({ ...s, activeSectionId: secId }));
        }}
        onClose={() => setShowCohortSimilarityModal(false)}
      />

      {showResetConfirmModal &&
        createPortal(
          <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div
              className="modal-panel bg-white border border-zinc-200 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between bg-rose-50/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Xác nhận xóa toàn bộ nội dung đang làm
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Xóa bài đang viết sai để làm lại từ đầu theo đúng phạm vi bạn chọn.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(false)}
                  className="btn-press p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/90 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800 truncate">
                      {activeSession.title || 'Bài nghiên cứu đang mở'}
                    </span>
                    <span className="font-mono font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md shrink-0">
                      {totalDraftedWords.toLocaleString('vi-VN')} từ ·{' '}
                      {activeSession.outline.length} mục
                    </span>
                  </div>
                  {activeSession.topic && (
                    <p className="text-[11px] text-zinc-500 line-clamp-2">
                      Đề tài: {activeSession.topic}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-800">
                    Chọn phạm vi nội dung muốn xóa để làm lại:
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                      resetScope === 'content_and_outline'
                        ? 'border-rose-600 bg-rose-50/50 ring-1 ring-rose-500/20'
                        : 'border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="writer_reset_scope"
                      checked={resetScope === 'content_and_outline'}
                      onChange={() => setResetScope('content_and_outline')}
                      className="mt-0.5 accent-rose-600"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-slate-900">
                        Xóa toàn bộ bài viết &amp; dàn ý (Giữ lại Đề bài &amp; Rubric)
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                        Xóa sạch phần chữ đã viết và dàn ý cũ để AI lập lại dàn ý mới từ đầu. Giữ nguyên môn học, chủ đề, yêu cầu đề bài, Rubric và tài liệu đính kèm.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                      resetScope === 'content_only'
                        ? 'border-rose-600 bg-rose-50/50 ring-1 ring-rose-500/20'
                        : 'border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="writer_reset_scope"
                      checked={resetScope === 'content_only'}
                      onChange={() => setResetScope('content_only')}
                      className="mt-0.5 accent-rose-600"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-slate-900">
                        Chỉ xóa phần chữ đã viết (Giữ nguyên Đề bài &amp; khung Dàn ý)
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                        Xóa toàn bộ đoạn văn bên trong các mục về 0 từ để bấm viết lại, nhưng vẫn giữ nguyên danh sách các mục dàn ý hiện tại.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                      resetScope === 'everything'
                        ? 'border-rose-600 bg-rose-50/50 ring-1 ring-rose-500/20'
                        : 'border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="writer_reset_scope"
                      checked={resetScope === 'everything'}
                      onChange={() => setResetScope('everything')}
                      className="mt-0.5 accent-rose-600"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-slate-900">
                        Xóa trắng hoàn toàn 100% (Xóa cả Đề bài, Rubric, Dàn ý &amp; Bài viết)
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                        Làm mới toàn bộ tab này về trạng thái trang giấy trắng tinh ban đầu.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 border-t border-zinc-200 bg-zinc-50 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(false)}
                  className="btn-press px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-100 rounded-lg"
                >
                  Hủy bỏ (Giữ nguyên)
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmResetPaper()}
                  className="btn-press px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xác nhận xóa &amp; Làm lại từ đầu</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
