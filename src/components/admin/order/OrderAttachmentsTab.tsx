import { Eye, Link2, Lock, Trash2, Unlock, Upload } from 'lucide-react';
import { formatBytes } from '../../../lib/utils';
import { AttachmentCategory, AttachmentItem } from '../../../types/domain';

interface OrderAttachmentsTabProps {
  attachments: AttachmentItem[];
  attCategory: AttachmentCategory;
  attLocked: boolean;
  attPreviewPages: number;
  attTurnitinScorePage: number;
  externalUrl: string;
  externalName: string;
  uploadingFile: boolean;
  isStaffMode: boolean;
  onChangeCategory: (cat: AttachmentCategory) => void;
  onChangeLocked: (locked: boolean) => void;
  onChangePreviewPages: (pages: number) => void;
  onChangeTurnitinScorePage: (page: number) => void;
  onChangeExternalName: (name: string) => void;
  onChangeExternalUrl: (url: string) => void;
  onUploadAttachment: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddExternalUrl: () => void;
  onPreviewAttachment: (att: AttachmentItem) => void;
  onToggleLock: (attId: string) => void;
  onRemoveAttachment: (att: AttachmentItem) => void;
}

export function OrderAttachmentsTab({
  attachments,
  attCategory,
  attLocked,
  attPreviewPages,
  attTurnitinScorePage,
  externalUrl,
  externalName,
  uploadingFile,
  isStaffMode,
  onChangeCategory,
  onChangeLocked,
  onChangePreviewPages,
  onChangeTurnitinScorePage,
  onChangeExternalName,
  onChangeExternalUrl,
  onUploadAttachment,
  onAddExternalUrl,
  onPreviewAttachment,
  onToggleLock,
  onRemoveAttachment,
}: OrderAttachmentsTabProps) {
  return (
    <div className="space-y-6">
      <div className="border border-zinc-200 rounded-xl p-5 bg-zinc-50/60 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Thêm tài liệu mới (Upload trực tiếp hoặc Liên kết ngoài)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Phân loại tài liệu
            </label>
            <select
              value={attCategory}
              onChange={(e) => {
                const cat = e.target.value as AttachmentCategory;
                onChangeCategory(cat);
                onChangeLocked(cat === 'draft' || cat === 'final');
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
            >
              <option value="brief">Đề bài & Tài liệu khách</option>
              <option value="turnitin">Báo cáo Turnitin / AI Check</option>
              <option value="draft">Bản nháp (Draft)</option>
              <option value="final">Bài hoàn chỉnh (Final)</option>
            </select>
          </div>

          {attCategory === 'turnitin' && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Trang chứa % đạo văn/AI
              </label>
              <input
                type="number"
                min={1}
                value={attTurnitinScorePage}
                onChange={(e) =>
                  onChangeTurnitinScorePage(Math.max(1, Number(e.target.value)))
                }
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-zinc-200 rounded-lg"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Khách xem từ trang 1 đến trang {attTurnitinScorePage + 2}
              </p>
            </div>
          )}

          {(attCategory === 'draft' || attCategory === 'final') && (
            <>
              <div className="flex items-center gap-2 pt-5">
                <input
                  id="lockToggle"
                  type="checkbox"
                  checked={attLocked}
                  onChange={(e) => onChangeLocked(e.target.checked)}
                  className="w-4 h-4 accent-[#4338CA]"
                />
                <label htmlFor="lockToggle" className="text-xs font-medium text-slate-800">
                  Khóa tải xuống cho tới khi thanh toán đủ
                </label>
              </div>
              {attLocked && (
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Số trang xem trước rõ (còn lại làm mờ)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={attPreviewPages}
                    onChange={(e) =>
                      onChangePreviewPages(Math.max(1, Number(e.target.value)))
                    }
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-zinc-200 rounded-lg"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-200">
          <div className="bg-white border border-zinc-200 rounded-xl p-3.5 space-y-2">
            <span className="text-xs font-semibold text-slate-800 block">
              Cách 1: Tải file từ máy (PDF, DOCX, Ảnh...)
            </span>
            <label className="btn-press inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              {uploadingFile ? 'Đang tải lên...' : 'Chọn tệp để tải lên'}
              <input
                type="file"
                disabled={uploadingFile}
                onChange={onUploadAttachment}
                className="hidden"
              />
            </label>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-3.5 space-y-2">
            <span className="text-xs font-semibold text-slate-800 block">
              Cách 2: Dán liên kết ngoài (Google Drive / Docs)
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Tên hiển thị (VD: Final Google Doc)"
                value={externalName}
                onChange={(e) => onChangeExternalName(e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
              />
              <input
                type="url"
                placeholder="https://drive.google.com/..."
                value={externalUrl}
                onChange={(e) => onChangeExternalUrl(e.target.value)}
                className="flex-1 px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg"
              />
              <button
                type="button"
                onClick={onAddExternalUrl}
                disabled={!externalUrl.trim()}
                className="btn-press inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#0F172A] text-white rounded-lg hover:bg-slate-800 disabled:opacity-45 shrink-0"
              >
                <Link2 className="w-3.5 h-3.5" />
                Thêm link
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Attachment List */}
      <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 overflow-hidden">
        {attachments.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            Chưa có tệp đính kèm nào.
          </div>
        ) : (
          attachments.map((att) => (
            <div
              key={att.id}
              className="hover-row p-4 bg-white flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {att.name}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Loại: {att.category}
                  {att.sizeBytes > 0 && ` · ${formatBytes(att.sizeBytes)}`}
                  {att.category === 'turnitin' &&
                    ` · Cửa sổ Turnitin: Trang 1–${(att.turnitinScorePage || 1) + 2}`}
                  {att.isPaymentLocked &&
                    ` · Đang khóa tải (xem trước ${att.previewMaxPages || 2} trang)`}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onPreviewAttachment(att)}
                  className="btn-press inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200/80 rounded-lg"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Xem
                </button>
                <button
                  type="button"
                  disabled={isStaffMode && att.isPaymentLocked}
                  title={
                    isStaffMode && att.isPaymentLocked
                      ? 'Chỉ Admin mới có quyền mở khóa tệp'
                      : undefined
                  }
                  onClick={() => onToggleLock(att.id)}
                  className={`btn-press inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border rounded-lg disabled:opacity-60 disabled:cursor-not-allowed ${
                    att.isPaymentLocked
                      ? 'bg-amber-50 text-[#D97706] border-amber-200'
                      : 'bg-emerald-50 text-[#16A34A] border-emerald-200'
                  }`}
                >
                  {att.isPaymentLocked ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Đang khóa
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      Đang mở
                    </>
                  )}
                </button>
                {(!isStaffMode || !att.isPaymentLocked) && (
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(att)}
                    aria-label="Xóa tệp"
                    className="btn-press p-1.5 text-zinc-400 hover:text-[#DC2626] rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
