import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'Đã xảy ra lỗi không mong muốn.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error) {
        readable = `Lỗi truy cập dữ liệu (${parsed.operationType || 'read/write'}): ${parsed.error}`;
      }
    } catch {
      // Keep plain message
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#DC2626]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-base font-semibold">Không thể tải dữ liệu</h2>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#0F172A] text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
