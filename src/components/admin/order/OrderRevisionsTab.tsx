import { RevisionRequest } from '../../../types/domain';
import { OrderChatPanel } from '../../shared/OrderChatPanel';

interface OrderRevisionsTabProps {
  orderCode: string;
  editorDisplayName: string;
  revisions: RevisionRequest[];
  revReplies: Record<string, string>;
  onChangeReply: (revId: string, value: string) => void;
  onUpdateRevision: (rev: RevisionRequest, status: RevisionRequest['status']) => void;
}

export function OrderRevisionsTab({
  orderCode,
  editorDisplayName,
  revisions,
  revReplies,
  onChangeReply,
  onUpdateRevision,
}: OrderRevisionsTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <OrderChatPanel
        orderCode={orderCode}
        senderRole="admin"
        senderName={editorDisplayName}
      />

      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Yêu cầu chỉnh sửa từ khách ({revisions.length})
        </h3>
        {revisions.length === 0 ? (
          <p className="text-xs text-zinc-500 py-8 text-center">
            Khách hàng chưa gửi yêu cầu chỉnh sửa nào cho đơn này.
          </p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {revisions.map((rev) => (
              <div
                key={rev.id}
                className="border border-zinc-200 rounded-xl p-3.5 space-y-2.5 text-sm"
              >
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="font-mono tabular-nums">
                    {new Date(rev.createdAt).toLocaleString('vi-VN')}
                  </span>
                  <span className="font-semibold text-slate-700 uppercase">
                    {rev.status}
                  </span>
                </div>
                <p className="text-slate-900 whitespace-pre-wrap">{rev.message}</p>
                <input
                  type="text"
                  value={revReplies[rev.id] || ''}
                  onChange={(e) => onChangeReply(rev.id, e.target.value)}
                  placeholder="Phản hồi cho khách (VD: Đã up Final v2)..."
                  className="w-full px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA]"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdateRevision(rev, 'in_progress')}
                    className="btn-press px-2.5 py-1 text-xs font-medium bg-amber-50 text-[#D97706] border border-amber-200 rounded-md hover:bg-amber-100"
                  >
                    Đang sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateRevision(rev, 'resolved')}
                    className="btn-press px-2.5 py-1 text-xs font-medium bg-emerald-50 text-[#16A34A] border border-emerald-200 rounded-md hover:bg-emerald-100"
                  >
                    Đánh dấu đã xong
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
