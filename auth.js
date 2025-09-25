(function initAuth(window) {
  const App = window.NostrApp || (window.NostrApp = {});

  const tabs = Array.from(document.querySelectorAll('.auth-tab'));
  const panels = Array.from(document.querySelectorAll('.auth-panel'));
  const generateButton = document.getElementById('authGenerateButton');
  const copyCreateButton = document.getElementById('authCopyCreateButton');
  const downloadCreateButton = document.getElementById('authDownloadCreateButton');
  const continueButton = document.getElementById('authContinueButton');
  const createTextarea = document.getElementById('authCreateKey');
  const createConfirm = document.getElementById('authCreateConfirm');
  const createStatus = document.getElementById('authCreateStatus');
  const importTextarea = document.getElementById('authImportInput');
  const importButton = document.getElementById('authImportButton');
  const importStatus = document.getElementById('authImportStatus');

  let generatedPrivateKey = '';

  function switchTab(target) {
    const tabName = target.dataset.tab;
    tabs.forEach((tab) => {
      const isActive = tab === target;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });
    panels.forEach((panel) => {
      const isActive = panel.id === `auth${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Panel`;
      panel.classList.toggle('is-active', isActive);
    });
  }

  function setCreateStatus(message = '', tone = 'info') {
    createStatus.textContent = message;
    createStatus.classList.toggle('is-error', tone === 'error');
  }

  function setImportStatus(message = '', tone = 'info') {
    importStatus.textContent = message;
    importStatus.classList.toggle('is-error', tone === 'error');
  }

  function ensureTools() {
    if (!window.NostrTools) {
      throw new Error('NostrTools missing');
    }
  }

  function generateKey() {
    try {
      ensureTools();
      if (typeof App.generateAndStoreKey !== 'function') {
        throw new Error('generateAndStoreKey unavailable');
      }
      generatedPrivateKey = App.generateAndStoreKey();
      const encoded = typeof App.encodePrivateKey === 'function'
        ? App.encodePrivateKey(generatedPrivateKey)
        : generatedPrivateKey;
      createTextarea.value = encoded;
      copyCreateButton.disabled = false;
      downloadCreateButton.disabled = false;
      setCreateStatus('מפתח חדש נוצר. שמרו אותו היטב.');
    } catch (err) {
      console.error('Generate key failed', err);
      setCreateStatus('שגיאה ביצירת המפתח. רענן ונסה שוב.', 'error');
    }
  }

  async function copyCreateKey() {
    try {
      await navigator.clipboard.writeText(createTextarea.value);
      setCreateStatus('המפתח הועתק ללוח הזיכרון.');
    } catch (err) {
      console.error('Copy create key failed', err);
      setCreateStatus('נכשלה ההעתקה ללוח.', 'error');
    }
  }

  function downloadCreateKey() {
    const value = createTextarea.value.trim();
    if (!value) {
      setCreateStatus('אין מפתח לשמור.', 'error');
      return;
    }
    const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'nostr-private-key.txt';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setCreateStatus('קובץ הגיבוי נשמר.');
  }

  function canContinue() {
    return Boolean(createTextarea.value.trim()) && createConfirm.checked;
  }

  function handleContinue() {
    if (!canContinue()) {
      setCreateStatus('יש לשמור את המפתח ולאשר שסימנת זאת.', 'error');
      return;
    }
    window.location.replace('index.html');
  }

  function decodeImportValue() {
    const value = importTextarea.value.trim();
    if (!value) return null;
    if (typeof App.decodePrivateKey === 'function') {
      return App.decodePrivateKey(value);
    }
    if (/^[0-9a-fA-F]{64}$/.test(value)) {
      return value.toLowerCase();
    }
    return null;
  }

  function handleImport() {
    const privateKey = decodeImportValue();
    if (!privateKey) {
      setImportStatus('לא זוהה מפתח פרטי חוקי.', 'error');
      return;
    }
    try {
      // חלק אימות משתמשים (auth.js) – שומר את המפתח החדש בלוקאל סטור ומעדכן את מצב היישום
      window.localStorage.setItem('nostr_private_key', privateKey);
      App.privateKey = privateKey;
      // חלק אימות משתמשים (auth.js) – מוודא שהמפתחות נטענים מחדש אחרי העדכון מהייבוא
      if (typeof App.ensureKeys === 'function') {
        App.ensureKeys();
      }
      setImportStatus('המפתח נטען בהצלחה. מעבירים ללוח הראשי...');
      setTimeout(() => window.location.replace('index.html'), 600);
    } catch (err) {
      console.error('Import failed', err);
      setImportStatus('שגיאה בשמירת המפתח.', 'error');
    }
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab));
  });

  if (generateButton) {
    generateButton.addEventListener('click', generateKey);
  }

  if (copyCreateButton) {
    copyCreateButton.addEventListener('click', copyCreateKey);
  }

  if (downloadCreateButton) {
    downloadCreateButton.addEventListener('click', downloadCreateKey);
  }

  if (createConfirm) {
    createConfirm.addEventListener('change', () => {
      continueButton.disabled = !canContinue();
    });
  }

  if (continueButton) {
    continueButton.addEventListener('click', handleContinue);
  }

  if (importButton) {
    importButton.addEventListener('click', handleImport);
  }

  Object.assign(App, {
    authGenerateKey: generateKey,
    authCopyCreateKey: copyCreateKey,
    authDownloadCreateKey: downloadCreateKey,
    authHandleContinue: handleContinue,
    authHandleImport: handleImport,
  });
})(window);
