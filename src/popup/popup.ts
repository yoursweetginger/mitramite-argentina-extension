document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('toggle-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY' });
      }
      window.close();
    });
  });
});
