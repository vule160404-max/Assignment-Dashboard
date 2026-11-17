import { useEffect, useRef, useState } from 'react';
import { Clock, MessageSquare, Send } from 'lucide-react';
import { sendOrderMessage, subscribeOrderMessages } from '../../services/firestoreService';
import { FIELD_LIMITS, OrderMessage } from '../../types/domain';

interface OrderChatPanelProps {
  orderCode: string;
  senderRole: 'admin' | 'client';
  senderName: string;
}

export function OrderChatPanel({
  orderCode,
  senderRole,
  senderName,
}: OrderChatPanelProps) {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orderCode) return;
    const unsub = subscribeOrderMessages(
      orderCode,
      senderRole === 'admin',
      (list) => setMessages(list)
    );
    return () => unsub();
  }, [orderCode, senderRole]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError('');
    try {
      await sendOrderMessage({
        orderCode,
        senderRole,
        senderName,
        body: trimmed,
      });
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi tin nhắn.');
    } finally {
      setSending(false);
    }
  };

  const formatRemainingHours = (expiresAtMs: number) => {
    const hrs = Math.max(1, Math.ceil((expiresAtMs - Date.now()) / (1000 * 60 * 60)));
    return `Còn ${hrs}h`;
  };

  return (
    <section className="bg-white border border-zinc-200 rounded-xl flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-200/80 bg-zinc-50/70 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-[#4338CA] shrink-0" />
          <h3 className="text-sm font-semibold text-slate-900 truncate">
            Trao đổi trực tiếp theo đơn
          </h3>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 whitespace-nowrap shrink-0 font-mono tabular-nums">
          <Clock className="w-3 h-3" />
          48h
        </span>
      </div>

      <div className="p-4 space-y-3 max-h-72 min-h-[190px] overflow-y-auto bg-[#FAFAFA]">
        {messages.length === 0 ? (
          <div className="py-8 px-4 text-center text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
            Chưa có tin nhắn nào trong 48 giờ qua. Nhắn tin ngay để trao đổi trực tiếp, tránh trôi tin trên Zalo.
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.senderRole === senderRole;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-1">
                  <span className="font-medium text-zinc-700">{m.senderName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {new Date(m.createdAtMs).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-zinc-400">
                    {formatRemainingHours(m.expiresAtMs)}
                  </span>
                </div>
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    isMine
                      ? 'bg-[#0F172A] text-white'
                      : 'bg-white border border-zinc-200 text-slate-900'
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-[#DC2626] bg-red-50 border-t border-red-200">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="p-3 border-t border-zinc-200/80 bg-white flex items-center gap-2"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={FIELD_LIMITS.messageBodyMax}
          placeholder="Nhập nội dung trao đổi (lưu 48h)..."
          className="flex-1 min-w-0 px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4338CA]/20 focus:border-[#4338CA] transition-colors"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="btn-press inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#4338CA] text-white rounded-lg hover:bg-[#3730A3] disabled:opacity-45 whitespace-nowrap shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          Gửi
        </button>
      </form>
    </section>
  );
}
