# TÀI LIỆU ĐẶC TẢ Ý TƯỞNG SẢN PHẨM (PRD)
**Tên dự án (Gợi ý):** AssignTrack / TaskFlow Academic / EduDesk  
**Mô hình:** Web App (Responsive – chạy mượt trên cả máy tính và điện thoại, tối ưu chi phí vận hành hơn Mobile App thuần túy).

---

## 1. Mục tiêu & Giá trị cốt lõi
Ứng dụng đóng vai trò là trung tâm điều hành (Dashboard) giúp bạn thoát khỏi sự lộn xộn khi quản lý đơn hàng qua tin nhắn (Zalo, Messenger, Instagram), đồng thời tạo sự chuyên nghiệp, minh bạch để khách hàng yên tâm xuống tiền và theo dõi tiến độ mà không cần nhắn tin hỏi thăm liên tục.

* **Dành cho bạn (Admin/Writer):** Quản lý tập trung tất cả bài làm, deadline, dòng tiền, tài liệu và tránh tình trạng quên/trễ hạn.
* **Dành cho Khách hàng (Client):** Tự theo dõi tiến độ bài làm theo thời gian thực (real-time), tải tài liệu, thanh toán và phản hồi chỉnh sửa dễ dàng chỉ qua một đường link cá nhân hóa (không cần đăng ký tài khoản rườm rà).

---

## 2. Phân quyền & Đối tượng sử dụng
Hệ thống chia làm 2 giao diện chính với quyền hạn tách biệt:

1. **Admin Portal (Dành riêng cho bạn):** Toàn quyền thêm/sửa/xóa đơn hàng, cập nhật tiến độ, quản lý tài chính, lưu trữ thông tin khách hàng và cấu hình hệ thống.
2. **Client Tracking Portal (Dành cho khách hàng):** Giao diện chỉ xem và tương tác cơ bản. Khách hàng truy cập thông qua **Mã đơn hàng + Mật khẩu ngắn** hoặc **Magic Link** (đường link bảo mật gửi riêng cho từng bài).

---

## 3. Chi tiết các tính năng cốt lõi

### A. Phân hệ Quản lý Bài làm & Tiến độ (Order & Task Management)
Đây là trái tim của ứng dụng. Mỗi bài assignment được tạo sẽ là một **Ticket (Đơn hàng)** chứa đầy đủ thông tin:
* **Thông tin cơ bản:** Tên môn học, Chủ đề (Topic), Số lượng từ/trang (Word count), Định dạng trích dẫn (APA, Harvard, IEEE...), Yêu cầu đặc biệt (Rubric).
* **Quản lý thời gian (Deadline Tracking):** 
  * Hiển thị đồng hồ đếm ngược (Countdown) theo giờ/ngày.
  * Hệ thống cảnh báo màu sắc tự động: **Xanh** (Còn trên 3 ngày), **Vàng** (Còn 24h - 72h), **Đỏ nhấp nháy** (Dưới 24h hoặc quá hạn).
* **Thanh trạng thái tiến độ (Progress Pipeline):** Cập nhật theo từng nấc để khách hàng nắm bắt:
  1. *Đã nhận yêu cầu & Báo giá*
  2. *Đã cọc / Đang nghiên cứu tài liệu (Research)*
  3. *Đang viết bản nháp (Drafting - VD: 50%)*
  4. *Đang kiểm tra đạo văn & AI (Turnitin/AI Check)*
  5. *Hoàn thành - Chờ thanh toán nốt*
  6. *Đã bàn giao & Bảo hành chỉnh sửa (Revision)*
* **Quản lý File đính kèm:** Upload đề bài, tài liệu tham khảo của khách; upload file bản nháp (có thể khóa tải xuống hoặc đóng dấu watermark cho đến khi khách thanh toán đủ) và file hoàn chỉnh.

### B. Phân hệ Khách hàng (Client Portal & CRM)
* **Trang theo dõi tiến độ công khai (Tracking Page):** 
  * Khách nhập mã đơn (VD: `#ASG-2026-089`) để xem ngay % hoàn thành, ghi chú mới nhất từ bạn (VD: *"Đã xong phần Literature Review, đang chuyển sang phân tích số liệu"*).
  * Nút **"Yêu cầu chỉnh sửa (Request Revision)"**: Cho phép khách điền nội dung cần sửa trực tiếp trên web, tránh trôi tin nhắn ở Zalo/Messenger.
* **Hồ sơ khách hàng (CRM mini):** Lưu tên/nickname, link MXH/SĐT, trường học/chuyên ngành, lịch sử các bài đã đặt. Phân loại khách hàng (Khách mới, Khách quen/VIP, Khách hay nợ/khó tính) để có chính sách giá hoặc yêu cầu cọc phù hợp.

### C. Phân hệ Quản lý Tài chính (Finance & Billing)
* **Theo dõi công nợ từng bài:** Tổng giá trị đơn hàng, Số tiền đã cọc (Deposit), Số tiền còn lại (Balance), Trạng thái (Chưa cọc / Đã cọc 50% / Đã thanh toán đủ).
* **Tích hợp QR Thanh toán tự động:** Tự động sinh mã VietQR kèm số tiền còn thiếu và nội dung chuyển khoản chuẩn (VD: `THANH TOAN ASG089`) ngay trên trang của khách hàng.
* **Báo cáo doanh thu:** Thống kê tổng thu nhập theo tuần/tháng, số bài hoàn thành, tỷ lệ đơn hủy để bạn nắm rõ hiệu suất làm việc.

### D. Lịch làm việc & Nhắc nhở thông minh (Calendar & Notifications)
* **Giao diện Lịch (Calendar View):** Nhìn tổng quan các deadline trong tháng dưới dạng lịch để biết ngày nào đang quá tải, tránh nhận chồng chéo bài dẫn đến kiệt sức.
* **Thông báo tự động (Tùy chọn nâng cao):** Gửi thông báo qua Email hoặc Telegram Bot cho bạn khi sắp đến deadline, hoặc khi khách hàng gửi yêu cầu chỉnh sửa trên web.

---

## 4. Luồng hoạt động thực tế (User Flow)

1. **Tiếp nhận:** Khách nhắn tin gửi đề bài -> Bạn vào App tạo đơn hàng mới, nhập giá tiền, deadline -> App sinh ra một **Link theo dõi** kèm mã QR tiền cọc.
2. **Chốt đơn:** Bạn gửi link này cho khách -> Khách mở link, kiểm tra lại thông tin đề bài xem đã khớp chưa và quét mã chuyển khoản cọc -> Bạn bấm xác nhận "Đã nhận cọc" trên App.
3. **Thực hiện:** Trong quá trình làm, mỗi ngày bạn vào cập nhật thanh tiến độ (30% -> 60% -> 90%) và tải file báo cáo check Turnitin lên. Khách tự vào link xem mà không cần hỏi *"Bài em tới đâu rồi anh/chị?"*.
4. **Bàn giao:** Bạn chuyển trạng thái sang "Hoàn thành", tải file bài làm lên (chế độ khóa tải hoặc xem trước) -> Khách vào link quét mã thanh toán phần còn lại -> Bạn mở khóa file để khách tải về.
5. **Hậu mãi:** Nếu giảng viên yêu cầu sửa nhẹ, khách bấm nút "Yêu cầu sửa" trên link cũ -> Bạn nhận thông báo, sửa xong và up lại file Final v2.

---

## 5. Gợi ý Công nghệ & Kiến trúc (Tech Stack)
Để tối ưu chi phí (thậm chí miễn phí vận hành giai đoạn đầu) và dễ triển khai nhanh:

* **Frontend (Giao diện):** Next.js hoặc React (kết hợp Tailwind CSS + Shadcn UI để giao diện sạch sẽ, hiện đại như Notion/Linear).
* **Backend & Database:** Supabase hoặc Firebase (Cung cấp sẵn cơ sở dữ liệu, hệ thống đăng nhập cho Admin và kho lưu trữ file đề bài/bài làm miễn phí dung lượng ban đầu).
* **Thanh toán:** Sử dụng API miễn phí của **VietQR.io** để tạo mã QR động theo từng đơn hàng.
* **Hosting (Triển khai):** Vercel hoặc Netlify (Miễn phí, tốc độ cao, tự động cập nhật khi sửa code).

---

## 6. Lộ trình phát triển (MVP -> Hoàn thiện)

* **Giai đoạn 1 (MVP - Dùng được ngay trong 1-2 tuần):** 
  * Tạo/Sửa/Xóa bài làm và quản lý trạng thái tiến độ.
  * Trang xem tiến độ cho khách hàng qua Link/Mã đơn.
  * Quản lý thông tin khách hàng cơ bản và ghi chú công nợ.
* **Giai đoạn 2 (Nâng cấp trải nghiệm):** 
  * Tích hợp upload/download file trực tiếp trên hệ thống.
  * Tích hợp mã VietQR tự động theo số tiền còn thiếu.
  * Giao diện Lịch (Calendar) trực quan hóa deadline.
* **Giai đoạn 3 (Tự động hóa):** 
  * Tích hợp Bot Telegram nhắc deadline tự động mỗi sáng.
  * Bảng thống kê doanh thu chi tiết và xuất hóa đơn PDF cho khách cần.