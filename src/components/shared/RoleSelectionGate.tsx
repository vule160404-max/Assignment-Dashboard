import { ArrowRight, Search, ShieldCheck } from 'lucide-react';

interface RoleSelectionGateProps {
  onSelectClient: () => void;
  onSelectAdmin: () => void;
}

export function RoleSelectionGate({
  onSelectClient,
  onSelectAdmin,
}: RoleSelectionGateProps) {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A] flex flex-col">
      {/* Top Bar Contract: 1-row, clean zones separated by gap-8 */}
      <header className="sticky top-0 z-20 sticky-glass border-b border-zinc-200/80 px-4 sm:px-8 h-14 flex items-center">
        <div className="max-w-4xl w-full mx-auto flex items-center justify-between gap-8">
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            AssignTrack
          </span>

          <span className="text-xs font-medium text-zinc-500 truncate">
            Hệ thống Điều phối & Tra cứu Đơn hàng Học thuật
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-8 py-10 sm:py-14">
        <div className="surface-enter max-w-2xl w-full mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Chọn vai trò của bạn để tiếp tục
            </h1>
            <p className="text-sm text-zinc-600 max-w-lg mx-auto leading-relaxed">
              Vui lòng chọn cổng truy cập dành cho <span className="font-semibold text-slate-900">Khách hàng</span> hoặc{' '}
              <span className="font-semibold text-slate-900">Quản trị viên / Nhân sự</span> trước khi đăng nhập hoặc đăng ký.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Option 1: Client Portal */}
            <button
              type="button"
              onClick={onSelectClient}
              className="btn-press group text-left bg-white border border-zinc-200 hover:border-[#4338CA] rounded-2xl p-6 flex flex-col justify-between gap-6 shadow-[0_8px_28px_rgb(15,23,42,0.03)] transition-colors"
            >
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4338CA]">
                  <Search className="w-5 h-5" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">
                    Tôi là Khách hàng
                  </h2>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Tra cứu tiến độ bài làm bằng mã đơn hàng, xem trước báo cáo Turnitin & PDF, thanh toán QR hoặc đăng nhập/đăng ký tài khoản Khách hàng.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-[#4338CA]">
                <span>Vào Cổng Khách hàng</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>

            {/* Option 2: Admin / Staff Portal */}
            <button
              type="button"
              onClick={onSelectAdmin}
              className="btn-press group text-left bg-white border border-zinc-200 hover:border-[#4338CA] rounded-2xl p-6 flex flex-col justify-between gap-6 shadow-[0_8px_28px_rgb(15,23,42,0.03)] transition-colors"
            >
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-xl bg-slate-100 border border-zinc-200 flex items-center justify-center text-slate-900">
                  <ShieldCheck className="w-5 h-5" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">
                    Tôi là Quản trị viên / Nhân sự
                  </h2>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Đăng nhập hệ thống điều hành dành cho Chủ hệ thống, Admin quản lý, Cộng tác viên hoặc đăng ký tài khoản Nhân sự bằng Mã mời.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-between text-xs font-semibold text-slate-900 group-hover:text-[#4338CA]">
                <span>Vào Cổng Quản trị</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
