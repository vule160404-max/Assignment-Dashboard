import { useEffect, useState } from 'react';
import {
  FileText,
  Lock,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';

export type PolicyTabKey = 'refund' | 'privacy' | 'terms';

interface PolicyModalProps {
  initialTab: PolicyTabKey | null;
  onClose: () => void;
}

const TABS: {
  key: PolicyTabKey;
  label: string;
  icon: typeof RotateCcw;
}[] = [
  { key: 'refund', label: 'Chính sách Hoàn tiền', icon: RotateCcw },
  { key: 'privacy', label: 'Chính sách Bảo mật', icon: Lock },
  { key: 'terms', label: 'Điều khoản Sử dụng', icon: FileText },
];

export function PolicyModal({ initialTab, onClose }: PolicyModalProps) {
  const [activeTab, setActiveTab] = useState<PolicyTabKey>(
    initialTab || 'refund'
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (!initialTab) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [initialTab, onClose]);

  if (!initialTab) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-white rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#0B2559] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-sky-400/20 border border-sky-300/30 text-sky-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="text-[10.5px] uppercase tracking-wider text-sky-200/80 font-semibold">
                AssignTrack · Cam kết minh bạch &amp; Pháp lý
              </div>
              <h2 className="text-base font-bold truncate">
                {TABS.find((t) => t.key === activeTab)?.label}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Tab Switcher */}
        <div className="px-6 py-2.5 bg-[#F4F7FB] border-b border-zinc-200/90 flex flex-wrap gap-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`btn-press inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#0B2559] text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-zinc-200 hover:border-[#12489B] hover:text-[#12489B]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Policy Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-5 text-xs sm:text-[13.5px] text-slate-700 leading-relaxed">
          {activeTab === 'refund' && (
            <>
              <div className="rounded-2xl bg-blue-50/70 border border-blue-200/80 p-4 text-xs text-[#0B2559]">
                <strong>Nguyên tắc cốt lõi:</strong> AssignTrack đặt quyền lợi học thuật của sinh viên lên hàng đầu. Mọi yêu cầu chỉnh sửa và hoàn tiền đều được xử lý minh bạch, có căn cứ rõ ràng theo đúng gói dịch vụ đã thỏa thuận.
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">
                  1. Chính sách 100% Hài lòng &amp; Bảo hành Chỉnh sửa Miễn phí
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Khách hàng được hỗ trợ <strong>chỉnh sửa miễn phí</strong> trong phạm vi đề bài và Rubric ban đầu cho đến khi đáp ứng đúng yêu cầu học thuật (tối thiểu 01 lượt cho gói <em>Standard</em>, không giới hạn lượt sửa hợp lệ cho gói <em>Premium</em> và <em>Ultra Distinction</em>).
                  </li>
                  <li>
                    Thời hạn gửi yêu cầu chỉnh sửa miễn phí là trong vòng <strong>07 ngày</strong> kể từ thời điểm bàn giao bài hoàn chỉnh (hoặc theo lịch phản hồi chính thức của giảng viên đối với luận văn dài hạn).
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">
                  2. Các trường hợp được Hoàn tiền 100%
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    <strong>Không thể triển khai đơn hàng:</strong> AssignTrack không bố trí được chuyên gia đúng chuyên ngành sau khi khách hàng đã đặt cọc.
                  </li>
                  <li>
                    <strong>Trễ hạn nghiêm trọng do lỗi hệ thống/chuyên gia:</strong> Bài bàn giao chậm hơn hạn nộp chính thức khiến khách hàng không thể nộp bài (trừ trường hợp khách hàng gửi thiếu đề bài hoặc phản hồi chậm).
                  </li>
                  <li>
                    <strong>Vi phạm cam kết Đạo văn / AI:</strong> Bài hoàn chỉnh có tỷ lệ trùng lặp Turnitin vượt ngưỡng cam kết hoặc phát sinh lỗi chất lượng nghiêm trọng mà đội ngũ không thể khắc phục trước giờ nộp.
                  </li>
                  <li>
                    <strong>Thanh toán nhầm / trùng lặp:</strong> Khách hàng chuyển khoản dư hoặc trùng giao dịch sẽ được hoàn lại phần chênh lệch ngay sau khi đối soát sao kê.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">
                  3. Chính sách Hoàn tiền theo Cam kết Điểm số
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Áp dụng cho các đơn hàng đăng ký gói có cam kết mức điểm (<em>Standard 55–64</em>, <em>Premium 65–74</em>, <em>Ultra Distinction 75–85+</em>).
                  </li>
                  <li>
                    Nếu điểm số thực tế thấp hơn mức cam kết của gói đã chọn (và bài nộp không bị khách hàng tự ý sửa sai lệch nội dung), AssignTrack sẽ hoàn trả từ <strong>30% đến 100%</strong> giá trị đơn hàng tương ứng với mức chênh lệch bậc điểm theo thỏa thuận đơn hàng.
                  </li>
                  <li>
                    Khách hàng vui lòng cung cấp <strong>bảng điểm chính thức và nhận xét chi tiết của giảng viên (Feedback/Rubric)</strong> trong vòng 07 ngày kể từ khi trường công bố kết quả để bộ phận QA thẩm định công bằng.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">
                  4. Các trường hợp Không áp dụng Hoàn tiền
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Khách hàng tự ý thay đổi đề tài, yêu cầu hoặc Rubric khác với thỏa thuận ban đầu sau khi chuyên gia đã bắt đầu viết bài.
                  </li>
                  <li>
                    Khách hàng tự ý chỉnh sửa, chèn thêm đoạn văn từ AI/nguồn ngoài làm sai lệch cấu trúc hoặc tăng tỷ lệ đạo văn/AI.
                  </li>
                  <li>
                    Khách hàng đơn phương hủy đơn khi bài làm đã hoàn thiện trên 50% tiến độ mà không xuất phát từ lỗi của AssignTrack (trường hợp hủy trước khi đạt 50%, mức hoàn sẽ tính theo khối lượng thực tế chưa thực hiện).
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">
                  5. Quy trình &amp; Thời gian Hoàn tiền
                </h3>
                <p>
                  Gửi yêu cầu kèm <strong>Mã đơn hàng</strong> và chứng từ liên quan qua Zalo <strong>0916.045.202</strong> hoặc Facebook Messenger chính thức. AssignTrack xác minh trong <strong>24–48 giờ làm việc</strong> và thực hiện chuyển khoản hoàn tiền trong vòng <strong>1–3 ngày làm việc</strong> sau khi thống nhất phương án.
                </p>
              </section>
            </>
          )}

          {activeTab === 'privacy' && (
            <>
              <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-4 text-xs text-emerald-900">
                <strong>Cam kết Ẩn danh &amp; Không chia sẻ bên thứ ba:</strong> Bảo mật danh tính sinh viên là ưu tiên số 1 tại AssignTrack. Mọi thông tin liên hệ và tệp đề bài của bạn đều được mã hóa và lưu trữ nội bộ nghiêm ngặt.
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">
                  1. Nguyên tắc Ẩn danh Tuyệt đối Hai chiều
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Thông tin cá nhân của khách hàng (họ tên, số Zalo, Facebook, tên trường, thông tin chuyển khoản) được tách biệt hoàn toàn với chuyên gia viết bài (Writer).
                  </li>
                  <li>
                    Chuyên gia chỉ tiếp nhận <strong>Mã đơn hàng</strong>, yêu cầu học thuật và file đề bài đã lược bỏ thông tin nhận dạng cá nhân.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">
                  2. Bảo mật Cổng tra cứu Mã đơn (Passcode) &amp; Lưu trữ R2
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Khách hàng theo dõi tiến độ trực tiếp bằng <strong>Mã đơn hàng có hậu tố ngẫu nhiên</strong>, không cần tạo tài khoản. Trang tra cứu công khai <strong>tuyệt đối không lưu và không hiển thị</strong> tên thật, số điện thoại hay thông tin cá nhân của khách hàng.
                  </li>
                  <li>
                    Hệ thống chặn hoàn toàn việc liệt kê danh sách đơn hàng từ bên ngoài; chỉ người nắm giữ chính xác mã đơn mới xem được tiến độ của đơn hàng đó.
                  </li>
                  <li>
                    Tệp đề bài, Rubric và bài hoàn chỉnh được lưu trữ bảo mật trên hạ tầng đám mây Cloudflare R2. AssignTrack cam kết <strong>không công khai, không bán lại và không tái sử dụng</strong> bài viết của bạn dưới bất kỳ hình thức nào.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">
                  3. An toàn Kiểm tra Đạo văn &amp; Thanh toán
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Quá trình kiểm tra đạo văn và dấu vết AI luôn sử dụng chế độ không lưu trữ vào kho dữ liệu công khai, đảm bảo bài của bạn không bị tự trùng lặp khi nộp lên hệ thống trường.
                  </li>
                  <li>
                    Giao dịch chuyển khoản VietQR / ngân hàng chỉ phục vụ đối soát thanh toán đơn hàng; AssignTrack không thu thập hay lưu trữ mật khẩu ngân hàng hoặc thông tin thẻ của khách hàng.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">
                  4. Quyền Yêu cầu Xóa dữ liệu &amp; Ngoại lệ Pháp lý
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Sau khi hoàn tất môn học, khách hàng có toàn quyền yêu cầu AssignTrack xóa vĩnh viễn tệp đề bài, bản thảo và lịch sử liên hệ khỏi hệ thống.
                  </li>
                  <li>
                    AssignTrack chỉ tiết lộ thông tin trong trường hợp bắt buộc theo yêu cầu hợp pháp bằng văn bản của cơ quan pháp luật có thẩm quyền.
                  </li>
                </ul>
              </section>
            </>
          )}

          {activeTab === 'terms' && (
            <>
              <div className="rounded-2xl bg-amber-50/70 border border-amber-200/80 p-4 text-xs text-amber-950">
                <strong>Lưu ý quan trọng:</strong> Khi gửi phiếu đăng ký, xác nhận báo giá và đặt cọc tại AssignTrack, bạn xác nhận đã đọc, hiểu rõ và đồng ý tuân thủ các Điều khoản &amp; Điều kiện sử dụng dưới đây.
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">
                  1. Phạm vi &amp; Mục đích Dịch vụ Hỗ trợ Học thuật
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    AssignTrack cung cấp dịch vụ tư vấn học thuật, biên soạn tài liệu tham khảo mẫu, hiệu đính văn phong (Proofreading / Humanize) và kiểm tra định dạng trích dẫn theo yêu cầu riêng.
                  </li>
                  <li>
                    Các bài mẫu trong <em>Sample Library</em> và tài liệu bàn giao nhằm hỗ trợ sinh viên tham khảo cấu trúc lập luận, phương pháp nghiên cứu và chuẩn trích dẫn. Khách hàng tự chịu trách nhiệm về việc sử dụng tài liệu phù hợp với quy chế đào tạo của trường.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">
                  2. Quy trình Đặt đơn, Thanh toán &amp; Bàn giao
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    <strong>Bước 1 — Tiếp nhận &amp; Báo giá:</strong> Khách hàng điền phiếu đăng ký kèm đầy đủ đề bài, Rubric, số từ, chuẩn trích dẫn và hạn nộp. Tư vấn viên báo giá rõ ràng trước khi triển khai.
                  </li>
                  <li>
                    <strong>Bước 2 — Đặt cọc &amp; Cấp Mã đơn:</strong> Đơn hàng chính thức được khởi động khi khách hàng hoàn tất đặt cọc theo thỏa thuận và nhận <strong>Mã đơn hàng (Passcode)</strong> theo dõi tiến độ 6 mốc.
                  </li>
                  <li>
                    <strong>Bước 3 — Xem trước &amp; Tất toán:</strong> Khi bài hoàn thành, khách hàng xem trước chất lượng bản thảo và báo cáo kiểm tra đạo văn trên Portal; sau khi tất toán phần còn lại, hệ thống mở khóa tải bản hoàn chỉnh.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">
                  3. Trách nhiệm cung cấp thông tin của Khách hàng
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Cung cấp đầy đủ, chính xác đề bài, tài liệu môn học, số liệu bắt buộc và thời hạn nộp thực tế ngay từ thời điểm chốt đơn.
                  </li>
                  <li>
                    Mọi yêu cầu bổ sung mới (tăng số từ, đổi chủ đề, thêm tiêu chí ngoài Rubric ban đầu) sau khi bài đã triển khai sẽ được báo phụ phí và điều chỉnh hạn bàn giao tương ứng.
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">
                  4. Quyền Sở hữu Trí tuệ &amp; Kênh Liên hệ Chính thức
                </h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    Toàn bộ giao diện, nội dung bài viết và tài liệu mẫu hiển thị trên website AssignTrack thuộc quyền sở hữu của AssignTrack. Đối với bài viết đặt riêng, quyền sử dụng được chuyển giao hoàn toàn cho khách hàng sau khi tất toán 100%.
                  </li>
                  <li>
                    <strong>Thời gian hỗ trợ:</strong> 08:00 – 23:30 hằng ngày (GMT+7) qua Zalo chính thức <strong>0916.045.202</strong> và trang Facebook Messenger của AssignTrack.
                  </li>
                </ul>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-zinc-500">
            Cập nhật lần cuối: 2026 · Hỗ trợ Zalo: 0916.045.202
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-press px-4 py-1.5 rounded-full bg-[#0B2559] hover:bg-[#12489B] text-white font-bold"
          >
            Đã hiểu &amp; Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
