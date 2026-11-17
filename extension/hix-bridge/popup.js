chrome.runtime.sendMessage({ type: 'CHECK_HIX_TAB' }, (resp) => {
  const el = document.getElementById('status');
  if (!el) return;
  if (resp && resp.hixTabOpen) {
    el.className = 'status ok';
    el.textContent = 'Đã tìm thấy tab hixbypass.com đang mở.';
  } else {
    el.className = 'status warn';
    el.textContent = 'Chưa thấy tab hixbypass.com. Hãy mở và đăng nhập trang HIX Bypass.';
  }
});
