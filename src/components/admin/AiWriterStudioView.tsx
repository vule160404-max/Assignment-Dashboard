import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Bot,
  Cloud,
  CloudOff,
  Download,
  FileText,
  Layers,
  Paperclip,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  AiRefineAction,
  generateOutlineWithAi,
  generateSectionWithAi,
  loadAiChatbotSettings,
  loadGlobalSkillLibrary,
  loadWriterSessions,
  parseAiOutlineJson,
  refineTextWithAi,
  saveAiChatbotSettings,
  saveGlobalSkillLibrary,
  saveWriterSessions,
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
import { countWords } from '../../lib/wordHumanizer';
import { CitationStyle, OrderRecord } from '../../types/domain';
import {
  ACADEMIC_FORMAT_PRESETS,
  AcademicPresetKey,
  AiChatbotSettingsStore,
  DocumentFormatConfig,
  SessionContextFile,
  SkillDocument,
  WriterOutlineSection,
  WriterSession,
} from './writer/types';
import { WriterApiSettingsModal } from './writer/WriterApiSettingsModal';
import { WriterBriefPanel } from './writer/WriterBriefPanel';
import { WriterOutlinePanel } from './writer/WriterOutlinePanel';
import { WriterPaperCanvas } from './writer/WriterPaperCanvas';
import { WriterSkillLibraryModal } from './writer/WriterSkillLibraryModal';
import { WriterWordRibbon } from './writer/WriterWordRibbon';
import {
  WriterWorkspaceTabs,
  isWriterSessionBusy,
} from './writer/WriterWorkspaceTabs';

interface AiWriterStudioViewProps {
  orders: OrderRecord[];
  initialOrderCode?: string;
  onAttachDocxToOrder?: (order: OrderRecord, file: File) => Promise<void>;
  onSendDocxToHumanizer?: (orderCode: string, file: File) => void;
  onToast: (msg: string) => void;
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
      runningHeader: order?.topic ? order.topic.slice(0, 50).toUpperCase() : '',
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
  onAttachDocxToOrder,
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
    const saved = loadWriterSessions();
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
  const [zoomPercent, setZoomPercent] = useState(100);
  const [concurrencyLimit, setConcurrencyLimit] = useState(2);
  const [refiningSection, setRefiningSection] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingAllDocx, setExportingAllDocx] = useState(false);
  const [attachingToOrder, setAttachingToOrder] = useState(false);
  const [cloudSyncState, setCloudSyncState] = useState<CloudSyncState>('connecting');

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

    const unsubSessions = subscribeWriterSessions((cloudSessions) => {
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
          if (local && isWriterSessionBusy(local)) {
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
      for (const s of sessionsRef.current) {
        if (isWriterSessionBusy(s)) continue;
        const hasMeaningfulData = Boolean(
          s.topic.trim() ||
            s.subject.trim() ||
            s.instructions.trim() ||
            s.linkedOrderCode.trim() ||
            s.outline.some((sec) => sec.content.trim().length > 0)
        );
        if (!hasMeaningfulData) continue;

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

  const activeProfile = aiSettings.profiles[aiSettings.activeProvider];
  const enabledSkillsCount = useMemo(
    () => skills.filter((s) => s.enabled).length,
    [skills]
  );

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
        runningHeader: ord.topic.slice(0, 50).toUpperCase(),
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
    void deleteWriterSessionFromCloud(id);
    if (sessions.length <= 1) {
      const reset = createDefaultSession(null);
      setSessions([reset]);
      setActiveSessionId(reset.id);
      return;
    }
    const next = sessions.filter((s) => s.id !== id);
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
  const handleAiGenerateOutlineForSession = async (targetSessionId: string) => {
    const sess = sessionsRef.current.find((s) => s.id === targetSessionId);
    if (!sess) return;
    if (!activeProfile.apiKey.trim()) {
      setShowApiModal(true);
      onToast('Vui lòng nhập API Key Chatbot trước khi tạo dàn ý.');
      return;
    }
    if (targetSessionId === activeSession?.id) {
      setLeftTab('outline');
    }

    mutateSessionById(targetSessionId, (s) => ({
      ...s,
      batchStatus: 'outlining',
      batchErrorMsg: undefined,
    }));

    try {
      const sections = await generateOutlineWithAi(sess, skills, activeProfile);
      mutateSessionById(targetSessionId, (s) => ({
        ...s,
        outline: sections,
        activeSectionId: sections[0]?.id || '',
        batchStatus: 'idle',
      }));
      onToast(
        `AI (${activeProfile.model}) đã lập dàn ý ${sections.length} mục cho "${sess.title}".`
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Tạo dàn ý bằng AI thất bại.';
      mutateSessionById(targetSessionId, (s) => ({
        ...s,
        batchStatus: 'error',
        batchErrorMsg: msg,
      }));
      onToast(msg);
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
    if (!activeProfile.apiKey.trim()) {
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

    try {
      const latestSession =
        sessionsRef.current.find((s) => s.id === targetSessionId) ||
        activeSession;
      const generatedText = await generateSectionWithAi(
        latestSession,
        sectionId,
        skills,
        activeProfile
      );

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
      onToast('Đã viết xong mục dàn ý!');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Lỗi khi gọi AI viết mục này.';
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

    try {
      const sectionIds = initialSnap.outline.map((sec) => sec.id);

      for (const secId of sectionIds) {
        if (pausedSessionIdsRef.current.has(targetSessionId)) {
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

        const latestBeforeCall =
          sessionsRef.current.find((s) => s.id === targetSessionId) ||
          currentSnap;

        const generatedText = await generateSectionWithAi(
          latestBeforeCall,
          secId,
          skills,
          activeProfile
        );

        if (pausedSessionIdsRef.current.has(targetSessionId)) {
          mutateSessionById(targetSessionId, (s) => ({
            ...s,
            batchStatus: 'paused',
            outline: s.outline.map((sec) =>
              sec.id === secId ? { ...sec, status: 'idle' } : sec
            ),
          }));
          return;
        }

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
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Quá trình viết bài tự động bị gián đoạn.';
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
    if (!activeProfile.apiKey.trim()) {
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
   * Run ALL open sessions that have remaining unwritten sections in parallel
   * using a bounded worker pool (`concurrencyLimit` papers at once).
   */
  const handleRunAllPapersParallel = async () => {
    if (!activeProfile.apiKey.trim()) {
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
      /^(#{1,3}\s+|[-*•]\s+|\d+\.\s+)/,
      ''
    );

    const nextLine = prefix === 'body' ? strippedLine : `${prefix}${strippedLine}`;
    const nextContent =
      text.slice(0, lineStart) + nextLine + text.slice(lineEnd);
    handleUpdateOutlineSection(currentSection.id, { content: nextContent }, true);
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
    if (!activeProfile.apiKey.trim()) {
      setShowApiModal(true);
      onToast('Vui lòng nhập API Key Chatbot trước.');
      return;
    }

    setRefiningSection(true);
    try {
      const revised = await refineTextWithAi(
        activeSession,
        currentSection.title,
        currentSection.content,
        action,
        customPrompt,
        skills,
        activeProfile
      );
      handleUpdateOutlineSection(
        currentSection.id,
        { content: revised, status: 'completed' },
        true
      );
      onToast(`AI đã nâng cấp mục "${currentSection.title}".`);
    } catch (err) {
      onToast(
        err instanceof Error
          ? err.message
          : 'Không thể chỉnh sửa mục này bằng AI.'
      );
    } finally {
      setRefiningSection(false);
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

  const totalOutlineTargetWords = useMemo(() => {
    if (!activeSession) return 0;
    return activeSession.outline.reduce((sum, sec) => sum + sec.targetWords, 0);
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
      {/* Multi-Paper Workspace Tabs & Parallel Runner */}
      <WriterWorkspaceTabs
        sessions={sessions}
        activeSessionId={activeSession.id}
        orders={orders}
        concurrencyLimit={concurrencyLimit}
        exportingAll={exportingAllDocx}
        onSelectSession={setActiveSessionId}
        onAddNewBlank={handleCreateNewSession}
        onImportMultipleOrders={handleImportMultipleOrders}
        onCloseSession={handleDeleteSession}
        onRunAllParallel={() => void handleRunAllPapersParallel()}
        onPauseAll={handlePauseAllPapers}
        onConcurrencyChange={setConcurrencyLimit}
        onExportAllDocx={() => void handleExportAllDraftedDocx()}
      />

      {/* Current Paper Action Bar */}
      <div className="bg-white border border-zinc-200/90 rounded-xl px-3.5 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 bg-blue-50 text-[#12489B] px-2.5 py-1.5 rounded-lg text-xs font-bold">
            <Wand2 className="w-3.5 h-3.5" />
            <span className="truncate max-w-[200px]">
              {activeSession.title || 'Bài nghiên cứu'}
            </span>
          </div>

          <select
            aria-label="Nạp đề bài từ mã đơn cho tab hiện tại"
            value={activeSession.linkedOrderCode}
            onChange={(e) => handleLoadFromOrder(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-mono font-medium bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#12489B]"
          >
            <option value="">-- Nạp đề từ Đơn hàng cho tab này --</option>
            {orders.map((o) => (
              <option key={o.id} value={o.orderCode}>
                #{o.orderCode} · {o.subject} ({o.wordCount}w)
              </option>
            ))}
          </select>
        </div>

        {/* Right Controls: Cloud Sync Status, Skill Library, API Chatbot, Export .DOCX */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            title={
              cloudSyncState === 'synced'
                ? 'API Keys, Skills và các bài viết đang được đồng bộ thời gian thực qua Firestore giữa các trình duyệt.'
                : cloudSyncState === 'permission_denied'
                  ? 'Chưa thể đồng bộ đám mây vì Firestore Rules mới chưa được cập nhật lên Firebase Console.'
                  : 'Đang kết nối đồng bộ đám mây...'
            }
            className={`px-2 py-1.5 text-[11px] font-medium rounded-lg border inline-flex items-center gap-1.5 ${
              cloudSyncState === 'synced'
                ? 'border-emerald-200/80 bg-emerald-50/70 text-emerald-700'
                : cloudSyncState === 'permission_denied'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-zinc-200 bg-zinc-50 text-zinc-500'
            }`}
          >
            {cloudSyncState === 'permission_denied' ? (
              <CloudOff className="w-3.5 h-3.5" />
            ) : (
              <Cloud className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {cloudSyncState === 'synced'
                ? 'Đã đồng bộ'
                : cloudSyncState === 'permission_denied'
                  ? 'Chưa đồng bộ Cloud'
                  : 'Đang đồng bộ...'}
            </span>
          </span>

          <button
            type="button"
            onClick={() => setShowSkillModal(true)}
            className="btn-press px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-blue-200/80 bg-blue-50/60 text-[#12489B] hover:bg-blue-100 inline-flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Skills ({enabledSkillsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowApiModal(true)}
            className={`btn-press px-2.5 py-1.5 text-xs font-semibold rounded-lg border inline-flex items-center gap-1.5 ${
              activeProfile.apiKey.trim()
                ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100'
                : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>
              {activeProfile.apiKey.trim()
                ? activeProfile.model
                : 'Cài đặt API'}
            </span>
          </button>

          {linkedOrder && onAttachDocxToOrder && (
            <button
              type="button"
              disabled={attachingToOrder || totalDraftedWords === 0}
              onClick={() => void handleAttachToLinkedOrder()}
              className="btn-press px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-white text-slate-800 hover:bg-zinc-50 disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <Paperclip className="w-3.5 h-3.5 text-[#12489B]" />
              <span>
                {attachingToOrder
                  ? 'Đang lưu...'
                  : `Gắn vào #${linkedOrder.orderCode}`}
              </span>
            </button>
          )}

          {onSendDocxToHumanizer && (
            <button
              type="button"
              disabled={totalDraftedWords === 0}
              onClick={() => void handlePushToHumanizer()}
              className="btn-press px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-white text-slate-800 hover:bg-zinc-50 disabled:opacity-40 inline-flex items-center gap-1.5"
              title="Xuất file Word và chuyển thẳng sang tab Word Humanizer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Humanize</span>
            </button>
          )}

          <button
            type="button"
            disabled={exportingDocx}
            onClick={() => void handleExportDocx()}
            className="btn-press px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#12489B] text-white hover:bg-[#0B2559] shadow-2xs inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exportingDocx ? 'Đang xuất...' : 'Tải .DOCX'}</span>
          </button>
        </div>
      </div>

      {/* Streamlined Single-Row Word Ribbon */}
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
      />

      {/* Main 2-Zone Workspace Grid: Segmented Sidebar (4 cols) + Live A4 Paper (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {!focusPaperMode && (
          <div className="lg:col-span-4 bg-white border border-zinc-200/90 rounded-2xl shadow-2xs overflow-hidden">
            {/* Segmented Tab Switcher (Brief vs Outline) */}
            <div className="p-1.5 bg-zinc-100/80 border-b border-zinc-200/80 grid grid-cols-2 gap-1">
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

            {leftTab === 'brief' ? (
              <WriterBriefPanel
                session={activeSession}
                onUpdateSession={(updater) => mutateActiveSession(updater)}
                onUploadContextFiles={handleUploadContextFiles}
                onSwitchToOutlineWithAi={() => {
                  setLeftTab('outline');
                  void handleAiGenerateOutlineForSession(activeSession.id);
                }}
              />
            ) : (
              <WriterOutlinePanel
                session={activeSession}
                currentSectionId={currentSection?.id || ''}
                totalDraftedWords={totalDraftedWords}
                totalOutlineTargetWords={totalOutlineTargetWords}
                generatingOutline={isActivePaperOutlining}
                runningAllSections={isActivePaperWriting}
                onSelectSection={(secId) =>
                  mutateActiveSession((s) => ({ ...s, activeSectionId: secId }))
                }
                onAiGenerateOutline={() =>
                  void handleAiGenerateOutlineForSession(activeSession.id)
                }
                onWriteAllSequentially={() =>
                  void handleWriteCurrentPaperSequentially()
                }
                onStopSequential={() => {
                  pausedSessionIdsRef.current.add(activeSession.id);
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
        )}

        <WriterPaperCanvas
          session={activeSession}
          currentSectionId={currentSection?.id || ''}
          zoomPercent={zoomPercent}
          focusPaperMode={focusPaperMode}
          activeTextareaRef={activeTextareaRef}
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
          onUpdateSection={handleUpdateOutlineSection}
        />
      </div>

      {/* Modals */}
      <WriterApiSettingsModal
        isOpen={showApiModal}
        settings={aiSettings}
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
    </div>
  );
}
