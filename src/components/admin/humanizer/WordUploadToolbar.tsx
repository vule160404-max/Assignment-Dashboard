import { useRef, useState } from 'react';
import { FileText, ShieldCheck, Upload } from 'lucide-react';
import { HixBypassMode, HixTabInfo } from '../../../lib/hixBridgeClient';
import { MIN_HIX_CHUNK_WORDS } from '../../../lib/wordHumanizer';
import { OrderRecord } from '../../../types/domain';
import { HumanizerSession, isSessionRunning } from './types';

interface WordUploadToolbarProps {
  orders: OrderRecord[];
  activeSession: HumanizerSession | null;
  hixTabs: HixTabInfo[];
  completedCount: number;
  onUploadFiles: (files: File[]) => Promise<void>;
  onCreateFromPaste: (title: string, body: string) => Promise<void>;
  onUpdateSessionConfig: (
    sessionId: string,
    patch: Partial<
      Pick<
        HumanizerSession,
        | 'selectedOrderCode'
        | 'maxWordsPerChunk'
        | 'hixMode'
        | 'protectedTermsInput'
        | 'preferredTabId'
      >
    >
  ) => void;
}

export function WordUploadToolbar({
  orders,
  activeSession,
  hixTabs,
  completedCount,
  onUploadFiles,
  onCreateFromPaste,
  onUpdateSessionConfig,
}: WordUploadToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showPasteCreator, setShowPasteCreator] = useState(false);
  const [pasteDocTitle, setPasteDocTitle] = useState('assignment-draft.docx');
  const [pasteDocBody, setPasteDocBody] = useState('');

  const isRunning = activeSession ? isSessionRunning(activeSession.playbackStatus) : false;

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateFromPaste(pasteDocTitle, pasteDocBody);
    if (pasteDocBody.trim()) {
      setShowPasteCreator(false);
      setPasteDocBody('');
    }
  };

  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) {
                void onUploadFiles(files);
              }
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>
              {activeSession ? 'Tải thêm / Mở nhiều file .docx' : 'Tải file Word (.docx) lên'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowPasteCreator((v) => !v)}
            className="btn-press inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 text-slate-800 rounded-lg whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Dán bài làm trực tiếp</span>
          </button>
        </div>

        {activeSession && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {hixTabs.length > 0 && (
              <select
                value={
                  typeof activeSession.preferredTabId === 'number'
                    ? String(activeSession.preferredTabId)
                    : 'auto'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdateSessionConfig(activeSession.sessionId, {
                    preferredTabId: val === 'auto' ? undefined : Number(val),
                  });
                }}
                disabled={isRunning}
                aria-label="Chọn tab HIX Bypass cho bài này"
                className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-slate-800 font-mono"
              >
                <option value="auto">Tab HIX: Tự động chọn tab rảnh</option>
                {hixTabs.map((t, idx) => (
                  <option key={t.tabId} value={String(t.tabId)}>
                    Chỉ chạy trên Tab HIX #{idx + 1}
                  </option>
                ))}
              </select>
            )}

            <select
              value={activeSession.selectedOrderCode}
              onChange={(e) =>
                onUpdateSessionConfig(activeSession.sessionId, {
                  selectedOrderCode: e.target.value,
                })
              }
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
              value={activeSession.maxWordsPerChunk}
              onChange={(e) =>
                onUpdateSessionConfig(activeSession.sessionId, {
                  maxWordsPerChunk: Number(e.target.value),
                })
              }
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
              value={activeSession.hixMode}
              onChange={(e) =>
                onUpdateSessionConfig(activeSession.sessionId, {
                  hixMode: e.target.value as HixBypassMode,
                })
              }
              disabled={isRunning}
              aria-label="Chế độ HIX Bypass"
              className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-slate-800"
            >
              <option value="Balanced">Chế độ: Balanced</option>
              <option value="Fast">Chế độ: Fast</option>
              <option value="Aggressive">Chế độ: Aggressive</option>
            </select>
          </div>
        )}
      </div>

      {activeSession && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 pt-2 border-t border-zinc-100">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-[#4338CA]" />
            <span>Từ khóa bắt buộc giữ nguyên:</span>
          </div>
          <input
            type="text"
            value={activeSession.protectedTermsInput}
            onChange={(e) =>
              onUpdateSessionConfig(activeSession.sessionId, {
                protectedTermsInput: e.target.value,
              })
            }
            disabled={isRunning}
            placeholder="VD: VinFast, SPayLater, Porter's Five Forces (tự động bảo vệ trích dẫn (Author, 2023) & số liệu %)"
            className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
          />
        </div>
      )}

      <p className="text-xs text-zinc-500 leading-relaxed">
        Quy tắc tách câu an toàn: Hệ thống chỉ copy những câu hoàn chỉnh kết thúc bằng dấu chấm{' '}
        <span className="font-mono font-semibold text-slate-800">(.)</span> và ghép mỗi lượt{' '}
        <span className="font-mono font-semibold text-slate-800">
          tối thiểu {MIN_HIX_CHUNK_WORDS} từ
        </span>{' '}
        đúng yêu cầu của HIX Bypass (có thể chọn nhiều file .docx cùng lúc để mở nhiều tab bài chạy song song).
      </p>

      {showPasteCreator && (
        <form
          onSubmit={(e) => void handlePasteSubmit(e)}
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
              Thêm vào màn trình chiếu Word
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
