(function initKeyUtils(window) {
  const App = window.NostrApp || (window.NostrApp = {});

  function getNip19() {
    return App.nip19 || window.NostrTools?.nip19 || null;
  }

  function encodePrivateKey(privateKey) {
    const trimmed = (privateKey || '').trim();
    if (!trimmed) return '';
    const nip19 = getNip19();
    if (!nip19) return trimmed;
    try {
      return nip19.nsecEncode(trimmed);
    } catch (err) {
      console.warn('Failed to encode nsec', err);
      return trimmed;
    }
  }

  function decodePrivateKey(value) {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const nip19 = getNip19();

    if (trimmed.startsWith('nsec') && nip19) {
      try {
        const decoded = nip19.decode(trimmed);
        if (decoded?.type === 'nsec') {
          return typeof decoded.data === 'string' ? decoded.data : null;
        }
      } catch (err) {
        console.warn('nsec decode failed', err);
      }
    }

    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    return null;
  }

  function encodePublicKey(pubkey) {
    const trimmed = (pubkey || '').trim();
    if (!trimmed) return '';
    const nip19 = getNip19();
    if (!nip19) return trimmed;
    try {
      return nip19.npubEncode(trimmed);
    } catch (err) {
      console.warn('Failed to encode npub', err);
      return trimmed;
    }
  }

  function decodePublicKey(value) {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const nip19 = getNip19();

    if (trimmed.startsWith('npub') && nip19) {
      try {
        const decoded = nip19.decode(trimmed);
        if (decoded?.type === 'npub') {
          return typeof decoded.data === 'string' ? decoded.data : null;
        }
      } catch (err) {
        console.warn('npub decode failed', err);
      }
    }

    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return trimmed.toLowerCase();
    }

    return null;
  }

  Object.assign(App, {
    encodePrivateKey,
    decodePrivateKey,
    encodePublicKey,
    decodePublicKey,
  });
})(window);
