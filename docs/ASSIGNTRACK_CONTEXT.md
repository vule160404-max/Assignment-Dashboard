# AssignTrack — Living Architecture & Product Context Handbook

> **Mục đích:** Tài liệu tham chiếu chuẩn xác duy nhất (Single Source of Truth) đóng gói toàn bộ quy trình nghiệp vụ, quyết định thiết kế, bảng màu thương hiệu, cấu trúc hạ tầng và các bẫy kỹ thuật của **AssignTrack**. Mọi phiên làm việc mới (kể cả workflow Spec Kit hoặc Elephant-Goldfish Model) phải đọc và tuân thủ tài liệu này trước khi sửa mã nguồn.
>
> **Cập nhật lần cuối:** 2026-11-20 (bắt buộc đăng nhập Khách hàng + màn hình "Bạn muốn làm gì?" `ClientIntentHubView.tsx`).

---

## 1. Tổng quan sản phẩm & Quy tắc nghiệp vụ

### 1.1. Hai cổng truy cập & Phân quyền (RBAC)
- **Role Gate (`src/components/shared/RoleSelectionGate.tsx`)** và **Root Router (`src/App.tsx`)**:
  - Hỗ trợ 2 cổng chính: **Khách hàng (`client`)** và **Quản trị / Nhân sự (`admin`)**.
  - Lưu trạng thái chuyển tab/cổng qua `F5` (reload persistence) bằng URL query (`?portal=`, `?tab=`, `?code=`) kết hợp `localStorage` (`assigntrack_portal_mode_v1` trong `App.tsx`, tab admin trong `AdminPortalView.tsx`, session & tab đang mở trong `AiWriterStudioView.tsx`).
  - Vai trò trong Firestore `users/{uid}`: `owner`, `admin`, `staff`, `client`.
  - Chủ hệ thống bootstrap mặc định (`isBootstrappedOwner()` trong `firestore.rules`): `vule160404@gmail.com`.
  - Mọi thao tác Admin/Staff đều yêu cầu Firebase Auth đã xác thực email (`email_verified === true`).

### 1.2. Cổng Khách hàng (`ClientPortalView.tsx` + `ClientIntentHubView.tsx` + `ClientLandingSections.tsx`)
- **Cổng đăng nhập bắt buộc (Mandatory Client Auth Gate):**
  - Khách hàng **BẮT BUỘC đăng nhập / đăng ký tài khoản** trước khi truy cập BẤT KỲ tính năng nào (kể cả tra cứu tiến độ đơn hàng, link `?code=`, tab Check Đạo văn & AI, hay nhắn tin/yêu cầu sửa bài).
  - Giao diện chặn tải trước toàn bộ tab và không subscribe Firestore khi `!user`; ở tầng backend `firestore.rules`, mọi quyền `get`/`list`/`create` trên `trackingPortals/{orderCode}` cùng subcollections `messages` và `revisions` đều yêu cầu `isSignedIn()` (không ép `isVerifiedEmail()` để tài khoản khách vừa đăng ký dùng được ngay).
  - Sau khi đăng nhập xong, khách mặc định vào trang **`"Bạn muốn làm gì?"`** (`homeTab = 'hub'` — trừ trường hợp mở sẵn link `?code=` thì mở thẳng đơn đó).
- **Trang lựa chọn `"Bạn muốn làm gì?"` (`ClientIntentHubView.tsx` — Mặc định sau khi đăng nhập):**
  - Hiển thị lời chào theo tên khách + tiêu đề **"Bạn muốn làm gì?"** + 3 thẻ dịch vụ chính:
    1. **Nhận tư vấn hỗ trợ làm luận văn - báo cáo** (`Chỉ từ 299K`) — Nút **`Nhận tư vấn qua Zalo`** → `https://zalo.me/0916045202`.
    2. **Kiểm tra tiến độ bài làm** *(Đối với khách đã tạo đơn thành công)* (thẻ trung tâm nổi bật, hiển thị số đơn đã lưu) — Nút **`Kiểm tra tiến độ ngay`** → mở tab tra cứu mã đơn (`lookup`).
    3. **Nhận tư vấn hỗ trợ giảm tỉ lệ đạo văn - AI** (`Báo giá theo số trang`) — Nút **`Nhận tư vấn qua Zalo`** → `https://zalo.me/0916045202`.
  - Hàng dưới cùng gồm thanh truy cập nhanh **Check Đạo văn & AI sơ bộ (`Free`)** và dải 4 chỉ số uy tín (`Top 2 Việt Nam` · `5.202+` · `100%` · `70%`).
- **Thanh điều hướng Header khi đã đăng nhập (3 vùng cố định, không lặp lại thanh tab trong thân trang):**
  - **Trái:** `<BrandLogo />` bấm quay về trang `"Bạn muốn làm gì?"` (`hub`).
  - **Giữa (Desktop `md+` & mobile bar):** 1 pill chuyển đổi 3 mục: `Trang chủ` (`hub`), `Tra cứu tiến độ` (`lookup`) và `Check Đạo văn & AI` (`checker`).
  - **Phải:** Cụm tài khoản hợp nhất (Avatar + tên hiển thị bấm mở trang tài khoản `auth` + nút đăng xuất) và nút phụ `Quản trị`.
- **Tab Tra cứu đơn hàng (`lookup` — Bento 1 màn hình desktop `max-w-6xl`):**
  - **Hàng 1:** Ô nhập mã đơn + nút **Xem tiến độ** (trái) đặt ngang hàng với `<ClientValuePropCard />` (phải).
  - **Hàng 2 & 3:** `<ClientLandingSections />` hiển thị dải 4 chỉ số + 3 thẻ dịch vụ (`299K`, `Free`, `Báo giá theo số trang`).
- **Chi tiết đơn hàng (khi tra cứu mã hợp lệ):**
  - Đọc từ collection `trackingPortals/{orderCode}` (`allow get: if isSignedIn() && isValidOrderCode(orderCode)`, `allow list: if false` trong `firestore.rules`, không chứa PII).
  - Khóa tải các tệp gắn cờ `isPaymentLocked` cho tới khi `paymentStatus === 'fully_paid'`; trình xem PDF chỉ mở trang `1..2` (mờ trang `3+`), riêng báo cáo `turnitin` mở đến `turnitinScorePage + 2`.
  - Hỗ trợ QR thanh toán (`PaymentQrCard.tsx`), chat 48 giờ tự hủy (`OrderChatPanel.tsx`), và gửi yêu cầu sửa bài (`revisions`).

### 1.3. Trang Check Đạo văn & Nhận diện AI (`ClientIntegrityCheckerView.tsx`)
- **Quy tắc nhập liệu nghiêm ngặt:** **Chỉ chấp nhận tải tệp, kéo thả hoặc dán tệp (`Ctrl + V`)** định dạng `.docx`, `.txt`, `.md` (tối đa 150.000 ký tự). Không mở ô nhập tiêu đề/văn bản thủ công và không có nút bài mẫu.
- **Thông báo bắt buộc & liên kết Admin:**
  - Luôn hiển thị cảnh báo nổi bật: kết quả **chỉ mang tính chất tham khảo** (có độ sai lệch so với Turnitin bản quyền của trường).
  - Dòng mô tả dưới tiêu đề ghi rõ: `Lưu ý đây không phải là check Turnitin. Nếu bạn cần check Turnitin vui lòng liên hệ Admin` kèm nút **`tại đây`** trỏ tới `https://zalo.me/0916045202`.
- **Nguồn đối chiếu & Fallback:**
  - Gọi endpoint `/api/check/analyze` (`api/check/analyze.ts`) truy vấn **Crossref**, **OpenAlex**, **Wikipedia** kết hợp phân tích AI forensics theo từng câu.
  - Có cơ chế **browser-side fallback** trực tiếp trên trình duyệt trong `src/lib/integrityCheckerClient.ts` (`&origin=*` với Wikipedia, `&mailto=...` với Crossref/OpenAlex) nếu API server gặp lỗi mạng.

---

## 2. Nhận diện thương hiệu & Hệ thống thiết kế (Design System)

### 2.1. Tài nguyên Logo (`public/assets/` & `index.html` & `BrandLogo.tsx`)
- `public/assets/assigntrack-logo.png` (`512×512` PNG nền trong suốt — dùng cho `<BrandLogo />`).
- `public/assets/assigntrack-favicon.png` (`192×192` PNG nền trong suốt — favicon tab trình duyệt).
- `public/assets/assigntrack-og.png` (`512×512` PNG nền trắng — `apple-touch-icon` và `og:image` khi chia sẻ link).
- `<BrandLogo />` dùng `text-[#0B2559]` cho **Assign** và `text-[#D97706]` cho **Track**.

### 2.2. Bảng màu chính thức (Bắt buộc đồng bộ với Logo)
| Vai trò | Mã màu / Token Tailwind | Ghi chú sử dụng |
| :--- | :--- | :--- |
| **Deep Academic Navy** | `#0B2559` (đậm `#07183B`, hover `#081B42`) | Nền khối Cam kết cốt lõi, chữ tiêu đề phụ, nút hover tối |
| **Royal Academic Blue (Primary)** | `#12489B` (hover `#0E3A7D`, sáng `#1D5CC0`) | Màu chủ đạo nút CTA, link, tab active, progress bar, border focus |
| **Warm Scholar Gold (Accent)** | `#F5B700`, `#D97706`, `#B45309`, trên nền tối `#FDE047` | Điểm nhấn huy hiệu, thanh viền trên, số liệu nổi bật |
| **Soft Surface Tints** | `blue-50` (`#EFF6FF`), `blue-100`, `blue-200`, `blue-300` | Nền badge, ô đang chọn, focus ring |
| **Semantic Status Colors** | `emerald-*` / `#16A34A` (đạt/đã thanh toán), `amber-*` (cảnh báo), `rose-*` / `#DC2626` (lỗi/trùng nguồn cao) | Không trộn lẫn ý nghĩa trạng thái |

> **Cấm tái sử dụng bảng màu tím/indigo cũ (`#4338CA`, `#3730A3`, `#4F46E5`, `#6366F1`, `#EEF2FF`, `#F5F3FF`, `indigo-*`).**
> **Ngoại lệ ngữ nghĩa duy nhất được giữ lại:** 3 class `violet-*` đánh dấu câu pha trộn AI trong `ClientIntegrityCheckerView.tsx` (huy hiệu `mixed`, chú giải `Pha trộn (38–64%)`, tô sáng câu trong bài) cùng `#7C3AED` / `#ede9fe` trong báo cáo in HTML (`src/lib/integrityCheckerClient.ts`) để phân biệt trực quan với highlight đỏ (`rose`) và vàng (`amber`).

### 2.3. Typography & Motion (`index.html`, `src/index.css`)
- **Fonts:** Headings `Plus Jakarta Sans`, Body `DM Sans`, Code/Mã đơn/Tiền tệ `JetBrains Mono` kết hợp `.tabular-nums`.
- **Ambient Surface:** `.client-ambient-bg` tạo nền `#f8fafc` với quầng Royal Blue + Scholar Gold + lưới chấm Navy `24px`.
- **Motion Classes:** `.btn-press` (`scale(0.97)` on `:active`), `.card-interactive` (nhấc `-2px` và bóng đổ Navy khi hover chuột), `.surface-enter`, `.popover-enter`, `.tab-panel-enter`, `.progress-fill` (`scaleX`), tôn trọng `prefers-reduced-motion: reduce`.
- **Quy tắc cứng:** Tuyệt đối không dùng `transition: all` / `transition-all` hay `scale(0)`.

---

## 3. Hạ tầng, Lưu trữ & Phân tách dữ liệu

### 3.1. Git & Vercel Hosting
- **GitHub Repository:** `https://github.com/vule160404-max/Assignment-Dashboard.git` (nhánh `main` tự động deploy lên Vercel).
- **Server Entrypoints:**
  - `server.ts` / `server/createApp.ts` — Express server chạy cổng `3000` (local dev) và catch-all `api/[...path].ts` trên Vercel.
  - `api/ai/generate.ts` — Serverless proxy cho AI Writer Studio.
  - `api/check/analyze.ts` — Serverless analyzer cho Kiểm tra Đạo văn & AI.

### 3.2. Firebase & Cloud Firestore (`firebase-applet-config.json`, `firebase.json`, `firestore.rules`)
- **Firebase Project ID:** `gen-lang-client-0888688386`.
- **Target Firestore Database (KHÓA CỨNG):** **`ai-studio-39ecaf2f-943a-4559-8128-4524e07fb377`** (chế độ Enterprise / Native).
- **Cảnh báo hạ tầng:** Cùng Google Project có database khác (`ai-studio-nordicsound-...`). **KHÔNG BAO GIỜ** deploy hoặc ghi dữ liệu sang database khác ngoài `ai-studio-39ecaf2f-943a-4559-8128-4524e07fb377` đã khai báo trong `firebase.json` và `firebase-applet-config.json`.
- **Các Collection trong Firestore:**
  - `orders/{orderId}`, `clients/{clientId}`, `users/{uid}`, `teamInvites/{inviteCode}`, `admins/{uid}`
  - `trackingPortals/{orderCode}` + subcollections `messages/{msgId}` (hết hạn sau 48h) & `revisions/{reqId}`
  - `settings/{settingId}`:
    - `bankConfig` & `notifications`: chỉ `isAdmin()` đọc/ghi.
    - `aiWriterSettings` & `aiWriterSkills`: `isTeamMember()` đọc/tạo/cập nhật để đồng bộ AI Writer giữa các trình duyệt (`isAdmin()` có quyền xóa).
  - `aiWriterSessions/{sessionId}`: `isTeamMember()` đọc/tạo/cập nhật/xóa các tab bài viết AI Writer.
- **Quy trình sửa `firestore.rules`:** Luôn ủy quyền cho subagent `firestore-rules-author`, kiểm tra bằng `eslint firestore.rules`, và deploy bằng:
  `npx -y firebase-tools@latest deploy --only firestore:rules --project gen-lang-client-0888688386`

### 3.3. Cloudflare R2 (`server/createApp.ts`)
Cloudflare R2 lưu các **tệp nhị phân nặng và metadata gắn với file**:
1. **Tệp đính kèm & ảnh QR thanh toán:** `files/{storedName}` (upload qua server hoặc presigned URL trực tiếp cho file `> 4 MB`).
2. **Metadata phân quyền & khóa tải tệp:** `meta/{fileId}.json`.
3. **Cấu hình thông báo Telegram phía server:** `meta/_notification-prefs.json`.
*(Local dev tự động fallback về thư mục đĩa cục bộ khi chưa cấu hình biến môi trường R2.)*

---

## 4. Bản đồ Module chính trong Codebase

- **App & Auth:** `src/App.tsx`, `src/lib/firebase.ts`, `src/types/domain.ts`, `src/lib/utils.ts`
- **Services (Firestore + API):** `src/services/firestoreService.ts`, `ordersService.ts`, `teamService.ts`, `crmSettingsService.ts`, `apiClient.ts`, `writerSyncService.ts`
- **Client Portal:** `src/components/client/ClientPortalView.tsx`, `ClientIntentHubView.tsx`, `ClientLandingSections.tsx`, `ClientIntegrityCheckerView.tsx`, `PaymentQrCard.tsx`, `src/lib/integrityCheckerClient.ts`
- **Admin Portal & CRM:** `src/components/admin/AdminPortalView.tsx`, `AdminAuthGate.tsx`, `OrderWorkspaceModal.tsx`, `ClientsCrmView.tsx`, `CalendarView.tsx`, `RevenueDashboardView.tsx`, `TeamManagementView.tsx`, `BankSettingsView.tsx`
- **AI Writer Studio:** `src/components/admin/AiWriterStudioView.tsx`, `src/components/admin/writer/*`, `src/lib/aiWriterClient.ts`, `src/lib/docxBuilder.ts`
  - Hỗ trợ đa tab viết song song nhiều bài, ưu tiên Perplexity Academic + các AI Provider khác (Gemini, OpenAI, Claude, Custom OpenAI/NVIDIA NIM).
  - Skill tích hợp `skill_citation_mastery` ép AI chỉ trích dẫn nguồn học thuật thực sự xuất hiện trong bài ở mục References (không trích dẫn Rubric/đề bài), và `skill_toc_hierarchy` chuẩn hóa hệ thống tiêu đề đa cấp (`H1` / `H2` / `H3`: `1.`, `1.1`, `1.2`...).
  - Hỗ trợ **Mục lục tự động chuẩn luận văn (Table of Contents)**: nút bật/tắt `Mục lục` trên `WriterWordRibbon`, hiển thị mục lục tương tác kèm chấm dẫn (dot leader) & số trang ước tính trên trang A4 (`WriterPaperCanvas`), và xuất `.docx` kèm trường OpenXML `<w:sdt>` (`TOC \o "1-3" \h \z \u`), `<w:outlineLvl>` cho `Heading1..3`, số trang footer và `<w:updateFields w:val="true"/>` trong `word/settings.xml`.
  - `writerSyncService.ts` đồng bộ thời gian thực qua Firestore (`aiWriterSettings`, `aiWriterSkills`, `aiWriterSessions`) kèm Smart Merge lần đầu (gộp API key từ Chrome + Skills từ Edge mà không mất dữ liệu hai bên).
- **Word Document Tooling (`WordHumanizerView.tsx` + `src/components/admin/humanizer/*`):**
  - Xử lý định dạng/checkpoint tài liệu `.docx` (hỗ trợ xóa từng checkpoint hoặc xóa tất cả checkpoint đã lưu tự động).

---

## 5. Các bẫy kỹ thuật sống còn & Checklist bàn giao

1. **Vercel Serverless ESM Rule (`package.json` có `"type": "module"`):**
   - Mọi Serverless Function trong `api/**/*.ts` (cụ thể `api/ai/generate.ts` và `api/check/analyze.ts`) **KHÔNG ĐƯỢC** import tương đối không có đuôi `.js`/`.ts` từ `../../server/...`, nếu không Vercel sẽ crash HTTP 500 (`ERR_MODULE_NOT_FOUND` / `FUNCTION_INVOCATION_FAILED`). Cả hai endpoint phải giữ trạng thái tự chứa (self-contained).
2. **Bẫy `position: fixed` Modal bên trong `.surface-enter`:**
   - `.surface-enter` đặt `transform: translateY(0)`, tạo containing block mới làm modal `position: fixed` bị lệch/cắt khung. Mọi modal mở bên trong `.surface-enter` (như `WriterSkillLibraryModal`, `WriterApiSettingsModal`) bắt buộc render bằng `createPortal(..., document.body)`.
3. **Cài đặt gói npm (`vite@8.3.8` / `esbuild`):**
   - Khi cài mới/cập nhật dependencies cần dùng `npm install --legacy-peer-deps` nếu gặp xung đột peer dependency.
4. **Môi trường Windows PowerShell 5.1:**
   - Dùng dấu `;` để nối lệnh tuần tự, không dùng `&&`.
5. **Cổng kiểm tra bắt buộc trước mọi commit/push lên `origin/main`:**
   - Chạy `npm run lint` (`tsc --noEmit && eslint firestore.rules`) và `npm run build` (`vite build`) phải thoát mã `0`.
   - Nếu có thay đổi `firestore.rules`, phải deploy lên project `gen-lang-client-0888688386` (database `ai-studio-39ecaf2f-943a-4559-8128-4524e07fb377`).
6. **Quy tắc duy trì ngữ cảnh sống (Living Doc Rule):**
   - Bất kỳ khi nào thay đổi bảng giá, link Zalo/liên hệ, schema Firestore, hạ tầng R2/Vercel, hoặc bảng màu/quy tắc UI cốt lõi, **bắt buộc cập nhật lại file `docs/ASSIGNTRACK_CONTEXT.md` ngay trong cùng commit đó**.
