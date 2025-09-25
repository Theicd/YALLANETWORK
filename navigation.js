// חלק ניווט ראשי (navigation.js) – ניהול מצב הניווט העליון באפליקציה
(function initNavigation(window) {
  const App = window.NostrApp || (window.NostrApp = {});

  // חלק ניווט ראשי (navigation.js) – מאחסן את מצב הלשונית הפעילה
  App.activeNav = App.activeNav || 'home';

  const navButtons = Array.from(document.querySelectorAll('[data-nav]'));

  function updateNavSelection(targetKey) {
    navButtons.forEach((button) => {
      const key = button.getAttribute('data-nav');
      const isActive = key === targetKey;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    App.activeNav = targetKey;
  }

  function handleNavClick(event) {
    const key = event.currentTarget.getAttribute('data-nav');
    if (!key) {
      return;
    }
    updateNavSelection(key);
  }

  navButtons.forEach((button) => {
    button.addEventListener('click', handleNavClick);
  });

  // חלק ניווט ראשי (navigation.js) – בעת טעינה מחדש, דואג שלשונית ברירת המחדל תוצג
  updateNavSelection(App.activeNav);
})(window);
