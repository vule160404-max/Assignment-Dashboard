chrome.runtime.sendMessage({ type: 'CHECK_HIX_TAB' }, (resp) => {
  const el = document.getElementById('status');
  if (!el) return;
  const count = Array.isArray(resp?.hixTabs) ? resp.hixTabs.length : 0;
  if (resp && resp.hixTabOpen) {
    el.className = 'status ok';
    el.textContent =
      count > 1
        ? `Đã kết nối ${count} tab hixbypass.com (sẵn sàng chạy song song nhiều bài).`
        : 'Đã tìm thấy 1 tab hixbypass.com đang mở.';
  } else {
    el.className = 'status warn';
    el.textContent = 'Chưa thấy tab hixbypass.com. Hãy mở và đăng nhập trang HIX Bypass.';
  }
});
