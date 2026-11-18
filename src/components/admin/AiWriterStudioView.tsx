import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Bot,
  Download,
  FilePlus,
  FileText,
  Layers,
  Paperclip,
  Sparkles,
  Trash2,
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
    if (saved.length > 0) return saved;
    const matchedOrder = initialOrderCode
      ? orders.find((o) => o.orderCode === initialOrderCode) || null
      : null;
    return [createDefaultSession(matchedOrder)];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const saved = loadWriterSessions();
    return saved[0]?.id || '';
  });

  const [leftTab, setLeftTab] = useState<'brief' | 'outline'>('outline');
  const [focusPaperMode, setFocusPaperMode] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [runningAllSections, setRunningAllSections] = useState(false);
  const [refiningSection, setRefiningSection] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [attachingToOrder, setAttachingToOrder] = useState(false);

  const stopSequentialRef = useRef(false);
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    saveWriterSessions(sessions);
  }, [sessions]);

  const activeSession = useMemo(
    () =>
      sessions.find((s) => s.id === activeSessionId) || sessions[0] || null,
    [sessions, activeSessionId]
  );

  useEffect(() => {
    if (activeSession && activeSession.id !== activeSessionId) {
      setActiveSessionId(activeSession.id);
    }
  }, [activeSession, activeSessionId]);

  useEffect(() => {
    if (!initialOrderCode) return;
    const existing = sessions.find(
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

  const mutateActiveSession = (
    updater: (prev: WriterSession) => WriterSession,
    pushHistory = false
  ) => {
    if (!activeSession) return;
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSession.id) return s;
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

  const handleSaveAiSettings = (next: AiChatbotSettingsStore) => {
    setAiSettings(next);
    saveAiChatbotSettings(next);
  };

  const handleUpdateSkills = (next: SkillDocument[]) => {
    setSkills(next);
    saveGlobalSkillLibrary(next);
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
    setSessions((prev) => [created, ...prev]);
    setActiveSessionId(created.id);
    setLeftTab('brief');
    onToast('Đã tạo phiên làm bài mới.');
  };

  const handleDeleteSession = (id: string) => {
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

  // --- Outline Management ---
  const handleAiGenerateOutline = async () => {
    if (!activeSession) return;
    if (!activeProfile.apiKey.trim()) {
      setShowApiModal(true);
      onToast('Vui lòng nhập API Key Chatbot trước khi tạo dàn ý.');
      return;
    }
    setLeftTab('outline');
    setGeneratingOutline(true);
    try {
      const sections = await generateOutlineWithAi(
        activeSession,
        skills,
        activeProfile
      );
      mutateActiveSession((s) => ({
        ...s,
        outline: sections,
        activeSectionId: sections[0]?.id || '',
      }));
      onToast(
        `AI (${activeProfile.model}) đã thiết kế dàn ý gồm ${sections.length} mục bám sát Rubric & Skill.`
      );
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Tạo dàn ý bằng AI thất bại.'
      );
    } finally {
      setGeneratingOutline(false);
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
      guidanceNotes: 'Luận điểm, dẫn chứng học thuật và trích dẫn cần triển khai...',
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

  // --- AI Section Writing (Single & Sequential All) ---
  const handleWriteSingleSection = async (sectionId: string) => {
    if (!activeSession) return;
    if (!activeProfile.apiKey.trim()) {
      setShowApiModal(true);
      onToast('Vui lòng nhập API Key Chatbot trước khi viết bài.');
      return;
    }

    handleUpdateOutlineSection(sectionId, {
      status: 'generating',
      errorMsg: undefined,
    });

    try {
      const latestSession =
        sessions.find((s) => s.id === activeSession.id) || activeSession;
      const generatedText = await generateSectionWithAi(
        latestSession,
        sectionId,
        skills,
        activeProfile
      );

      handleUpdateOutlineSection(
        sectionId,
        {
          content: generatedText,
          status: 'completed',
          errorMsg: undefined,
        },
        true
      );
      onToast('Đã viết xong mục dàn ý! Bạn có thể kiểm tra và sửa trực tiếp trên trang A4.');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Lỗi khi gọi AI viết mục này.';
      handleUpdateOutlineSection(sectionId, {
        status: 'error',
        errorMsg: msg,
      });
      onToast(msg);
    }
  };

  const handleWriteAllSectionsSequentially = async () => {
    if (!activeSession) return;
    if (!activeProfile.apiKey.trim()) {
      setShowApiModal(true);
      onToast('Vui lòng nhập API Key Chatbot trước khi chạy tự động.');
      return;
    }

    stopSequentialRef.current = false;
    setRunningAllSections(true);

    try {
      let workingSession: WriterSession = { ...activeSession };

      for (let i = 0; i < workingSession.outline.length; i++) {
        if (stopSequentialRef.current) {
          onToast('Đã dừng viết tuần tự theo yêu cầu.');
          break;
        }
        const targetSec = workingSession.outline[i];

        workingSession = {
          ...workingSession,
          activeSectionId: targetSec.id,
          outline: workingSession.outline.map((sec) =>
            sec.id === targetSec.id
              ? { ...sec, status: 'generating', errorMsg: undefined }
              : sec
          ),
        };
        setSessions((prev) =>
          prev.map((s) => (s.id === workingSession.id ? workingSession : s))
        );

        const generatedText = await generateSectionWithAi(
          workingSession,
          targetSec.id,
          skills,
          activeProfile
        );

        workingSession = {
          ...workingSession,
          outline: workingSession.outline.map((sec) =>
            sec.id === targetSec.id
              ? { ...sec, content: generatedText, status: 'completed' }
              : sec
          ),
          updatedAt: new Date().toISOString(),
        };
        setSessions((prev) =>
          prev.map((s) => (s.id === workingSession.id ? workingSession : s))
        );
      }

      if (!stopSequentialRef.current) {
        onToast(
          'Hoàn tất viết toàn bộ các mục trong dàn ý! Bạn có thể rà soát trên trang giấy A4.'
        );
      }
    } catch (err) {
      onToast(
        err instanceof Error
          ? err.message
          : 'Quá trình viết tuần tự bị gián đoạn.'
      );
    } finally {
      setRunningAllSections(false);
    }
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

  return (
    <div className="surface-enter space-y-3">
      {/* Compact Studio Header Bar */}
      <div className="bg-white border border-zinc-200/90 rounded-xl px-3.5 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        {/* Session & Linked Order Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Phiên làm bài"
            value={activeSession.id}
            onChange={(e) => setActiveSessionId(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-semibold bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#4338CA] max-w-[210px]"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || 'Bài nghiên cứu mới'}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleCreateNewSession}
            title="Tạo bài viết mới"
            className="btn-press px-2 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 rounded-lg inline-flex items-center gap-1"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>Bài mới</span>
          </button>

          {sessions.length > 1 && (
            <button
              type="button"
              onClick={() => handleDeleteSession(activeSession.id)}
              title="Xóa phiên làm bài này"
              className="btn-press p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="inline-flex items-center gap-1.5 pl-2 border-l border-zinc-200">
            <select
              aria-label="Nạp đề bài từ mã đơn"
              value={activeSession.linkedOrderCode}
              onChange={(e) => handleLoadFromOrder(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-mono font-medium bg-white border border-zinc-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#4338CA]"
            >
              <option value="">Nạp đề từ Đơn hàng...</option>
              {orders.map((o) => (
                <option key={o.id} value={o.orderCode}>
                  #{o.orderCode} · {o.subject} ({o.wordCount}w)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Controls: Skill Library, API Chatbot, Export .DOCX */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowSkillModal(true)}
            className="btn-press px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200/80 bg-indigo-50/60 text-[#4338CA] hover:bg-indigo-100 inline-flex items-center gap-1.5"
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
              <Paperclip className="w-3.5 h-3.5 text-[#4338CA]" />
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
            className="btn-press px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#4338CA] text-white hover:bg-indigo-700 shadow-2xs inline-flex items-center gap-1.5"
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
        aiBusy={generatingOutline || runningAllSections || refiningSection}
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
                    ? 'bg-white text-[#4338CA] shadow-2xs'
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
                    ? 'bg-white text-[#4338CA] shadow-2xs'
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
                  void handleAiGenerateOutline();
                }}
              />
            ) : (
              <WriterOutlinePanel
                session={activeSession}
                currentSectionId={currentSection?.id || ''}
                totalDraftedWords={totalDraftedWords}
                totalOutlineTargetWords={totalOutlineTargetWords}
                generatingOutline={generatingOutline}
                runningAllSections={runningAllSections}
                onSelectSection={(secId) =>
                  mutateActiveSession((s) => ({ ...s, activeSectionId: secId }))
                }
                onAiGenerateOutline={() => void handleAiGenerateOutline()}
                onWriteAllSequentially={() =>
                  void handleWriteAllSectionsSequentially()
                }
                onStopSequential={() => {
                  stopSequentialRef.current = true;
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
