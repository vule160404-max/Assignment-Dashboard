# TÀI LIỆU ĐẶC TẢ Ý TƯỞNG SẢN PHẨM (PRD)

**Tên dự án (Gợi ý):** Academic Assignment
**Mô hình:** Web App (Responsive – chạy mượt trên cả máy tính và điện thoại, tối ưu chi phí vận hành hơn Mobile App thuần túy).

\---

## 1\. Mục tiêu \& Giá trị cốt lõi

Ứng dụng đóng vai trò là trung tâm điều hành (Dashboard) giúp bạn thoát khỏi sự lộn xộn khi quản lý đơn hàng qua tin nhắn (Zalo, Messenger, Instagram), đồng thời tạo sự chuyên nghiệp, minh bạch để khách hàng yên tâm xuống tiền và theo dõi tiến độ mà không cần nhắn tin hỏi thăm liên tục.

* **Dành cho bạn (Admin/Writer):** Quản lý tập trung tất cả bài làm, deadline, dòng tiền, tài liệu và tránh tình trạng quên/trễ hạn.
* **Dành cho Khách hàng (Client):** Tự theo dõi tiến độ bài làm theo thời gian thực (real-time), tải tài liệu, thanh toán và phản hồi chỉnh sửa dễ dàng chỉ qua một đường link cá nhân hóa (không cần đăng ký tài khoản rườm rà).

\---

## 2\. Phân quyền \& Đối tượng sử dụng

Hệ thống chia làm 2 giao diện chính với quyền hạn tách biệt:

1. **Admin Portal (Dành riêng cho bạn):** Toàn quyền thêm/sửa/xóa đơn hàng, cập nhật tiến độ, quản lý tài chính, lưu trữ thông tin khách hàng và cấu hình hệ thống.

**Client Tracking Portal (Dành cho khách hàng):** Giao diện chỉ xem và tương tác cơ bản. Khách hàng truy cập thông qua **Mã đơn hàng**

3\. Chi tiết các tính năng cốt lõi

### A. Phân hệ Quản lý Bài làm \& Tiến độ (Order \& Task Management)

Đây là trái tim của ứng dụng. Mỗi bài assignment được tạo sẽ là một **Ticket (Đơn hàng)** chứa đầy đủ thông tin:

* **Thông tin cơ bản:** Tên môn học, Chủ đề (Topic), Số lượng từ/trang (Word count), Định dạng trích dẫn (APA, Harvard, IEEE...), Yêu cầu đặc biệt (Rubric).
* **Quản lý thời gian (Deadline Tracking):**

  * Hiển thị đồng hồ đếm ngược (Countdown) theo giờ/ngày.
  * Hệ thống cảnh báo màu sắc tự động: **Xanh** (Còn trên 3 ngày), **Vàng** (Còn 24h - 72h), **Đỏ nhấp nháy** (Dưới 24h hoặc quá hạn).
* **Thanh trạng thái tiến độ (Progress Pipeline):** Cập nhật theo từng nấc để khách hàng nắm bắt:

  1. *Đã nhận yêu cầu \& Báo giá*
  2. *Đã cọc / Đang nghiên cứu tài liệu (Research)*
  3. *Đang viết bản nháp (Drafting - VD: 50%)*
  4. *Đang kiểm tra đạo văn \& AI (Turnitin/AI Check)*
  5. *Hoàn thành - Chờ thanh toán nốt*
  6. *Đã bàn giao \& Bảo hành chỉnh sửa (Revision)*
* **Quản lý File đính kèm:** Upload đề bài, tài liệu tham khảo của khách; upload file bản nháp (có thể khóa tải xuống và chỉ cho khách xem 1 phần ngắn 1-2 trang cho đến khi khách thanh toán đủ (phần còn lại sẽ bị làm mờ) và file hoàn chỉnh.

### B. Phân hệ Khách hàng (Client Portal \& CRM)

* **Trang theo dõi tiến độ công khai (Tracking Page):**

  * Khách nhập mã đơn (VD: `#ASG-2026-089`) để xem ngay % hoàn thành, ghi chú mới nhất từ bạn (VD: *"Đã xong phần Literature Review, đang chuyển sang phân tích số liệu"*).
  * Khung chat: Cho phép khách trao đổi trực tiếp trên web, tránh trôi tin nhắn ở Zalo/Messenger (Đoạn chat sẽ được lưu trong vòng 48 tiếng).
* **Hồ sơ khách hàng (CRM mini):** Lưu tên/nickname, số zalo, trường học/chuyên ngành, lịch sử các bài đã đặt. Phân loại khách hàng (Khách mới, Khách quen/VIP, Khách hay nợ/khó tính) để có chính sách giá hoặc yêu cầu cọc phù hợp.

### C. Phân hệ Quản lý Tài chính (Finance \& Billing)

* **Theo dõi công nợ từng bài:** Tổng giá trị đơn hàng, Số tiền đã cọc (Deposit), Số tiền còn lại (Balance), Trạng thái (Chưa cọc / Đã cọc bao nhiêu (VNĐ) / Đã thanh toán đủ).
* **Tích hợp QR thanh toán và số tài khoản ngân hàng của tôi kèm tên: Tôi có phần để có thể tải lên ảnh mã QR**
* **Báo cáo doanh thu:** Thống kê tổng thu nhập theo tuần/tháng, số bài hoàn thành, tỷ lệ đơn hủy/thành công để bạn nắm rõ hiệu suất làm việc.

### D. Lịch làm việc \& Nhắc nhở thông minh (Calendar \& Notifications)

* **Giao diện Lịch (Calendar View):** Nhìn tổng quan các deadline trong tháng dưới dạng lịch để biết ngày nào đang quá tải, tránh nhận chồng chéo bài dẫn đến kiệt sức.
* **Thông báo tự động (Tùy chọn nâng cao):** Gửi thông báo qua Email hoặc Telegram Bot cho bạn khi sắp đến deadline, hoặc khi khách hàng gửi yêu cầu chỉnh sửa trên web.

\---

## 4\. Luồng hoạt động thực tế (User Flow)

1. **Tiếp nhận:** Khách nhắn tin gửi đề bài -> Bạn vào App tạo đơn hàng mới, nhập giá tiền, deadline -> App sinh ra một **Mã đơn hàng**.
2. **Chốt đơn:** Bạn gửi mã đơn này cho khách -> Khách vào web nhập mã đơn hàng, kiểm tra lại thông tin đề bài, thông tin bài làm (dàn ý, hướng dẫn v..v) xem đã khớp chưa và quét mã chuyển khoản cọc -> Bạn bấm xác nhận "Đã nhận cọc" trên App.
3. **Thực hiện:** Trong quá trình làm, mỗi ngày bạn vào cập nhật thanh tiến độ (là thanh kéo từ 10-100%) và tải file báo cáo check Turnitin lên (File check đạo văn và check AI chỉ được hiển thị cho khách từ đầu cho tới trang có tỉ lệ phần trăm đạo văn hoặc dính AI + thêm 2 trang tiếp theo). Khách tự vào  xem mà không cần hỏi *"Bài em tới đâu rồi anh/chị?"*.
4. **Bàn giao:** Bạn chuyển trạng thái sang "Hoàn thành", tải file bài làm lên (chế độ khóa tải và xem trước 1 phần) -> Khách vào link quét mã thanh toán phần còn lại -> Bạn mở khóa file để khách tải về.
5. **Hậu mãi:** Nếu giảng viên yêu cầu sửa nhẹ, khách bấm nút "Yêu cầu sửa" trên trang cũ của đơn hàng -> Bạn nhận thông báo, sửa xong và up lại file Final v2.

\---

## 5\. Gợi ý Công nghệ \& Kiến trúc (Tech Stack)

Để tối ưu chi phí (thậm chí miễn phí vận hành giai đoạn đầu) và dễ triển khai nhanh:

* **Frontend (Giao diện):** Next.js hoặc React (kết hợp Tailwind CSS + Shadcn UI để giao diện sạch sẽ, hiện đại như Notion/Linear).
* **Backend \& Database:** Firebase \& Cloudflare R2.
* **Thanh toán:** Sử dụng hãy thiết kế tạo mã từ Vietqr nhưng giờ tôi chưa cần. Hãy để đó sau này tôi sử dụng sau. tạm thời dùng mã QR mặc định
**Hosting (Triển khai):** Vercel

