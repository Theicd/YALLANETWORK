(function initConfig(window) {
  if (!window.NostrTools) {
    console.error('NostrTools not loaded before config.js');
    return;
  }

  const { utils } = window.NostrTools;

  const bytesToHex =
    utils?.bytesToHex ||
    ((arr) => Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join(''));

  const hexToBytes =
    utils?.hexToBytes ||
    ((hex) => {
      const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
      if (clean.length % 2 !== 0) throw new Error('Invalid hex length');
      const out = new Uint8Array(clean.length / 2);
      for (let i = 0; i < clean.length; i += 2) {
        out[i / 2] = parseInt(clean.slice(i, i + 2), 16);
      }
      return out;
    });

  const defaultProfile = {
    name: 'משתמש אנונימי',
    bio: 'יצירת תוכן מבוזר, בלי שוטר באמצע',
    avatarInitials: 'AN',
    picture: '',
  };

  const storedProfile = window.localStorage.getItem('nostr_profile');
  let profile;
  try {
    profile = storedProfile ? JSON.parse(storedProfile) : defaultProfile;
  } catch (err) {
    console.warn('Failed to parse stored profile, using default', err);
    profile = defaultProfile;
  }

  const App = window.NostrApp || {};
  App.relayUrls = [
    // חלק קונפיגורציה (config.js) – ריליי ברירת מחדל של Damus
    'wss://relay.damus.io',
    // חלק קונפיגורציה (config.js) – ריליי מרכזי של Snort
    'wss://relay.snort.social',
    // חלק קונפיגורציה (config.js) – ריליי Nos.lol לתמיכה נוספת
    'wss://nos.lol',
    // חלק קונפיגורציה (config.js) – ריליי קהילתי נרחב
    'wss://nostr.wine',
    // חלק קונפיגורציה (config.js) – ריליי Nostr Band עם אינדוקס רחב
    'wss://relay.nostr.band',
    // חלק קונפיגורציה (config.js) – ריליי Primal לשיפור זמינות
    'wss://relay.primal.net',
    // חלק קונפיגורציה (config.js) – ריליי Eden כדור גיבוי נוסף
    'wss://eden.nostr.land',
  ];
  App.NETWORK_TAG = 'israel-network';
  App.MAX_INLINE_PICTURE_LENGTH = 8000;
  App.MAX_METADATA_CONTENT_LENGTH = 60000;
  App.MAX_INLINE_MEDIA_LENGTH = 150000;
  // חלק קונפיגורציה (config.js) – ברירת מחדל: לא מפרסמים מטא-דאטה עד שהמשתמש יעדכן פרופיל
  App.metadataPublishQueued = false;
  App.profile = profile;
  App.profileCache = App.profileCache || new Map();
  App.privateKey = window.localStorage.getItem('nostr_private_key');
  App.communityKeyBase64 = window.localStorage.getItem('nostr_community_key') || '';
  App.communityPassphrase =
    window.localStorage.getItem('nostr_community_passphrase') || App.COMMUNITY_CONTEXT;
  App.pool = null;
  App.bytesToHex = bytesToHex;
  App.hexToBytes = hexToBytes;
  App.finalizeEvent = window.NostrTools?.finalizeEvent;
  App.generateSecretKey = window.NostrTools?.generateSecretKey;
  App.getPublicKey = window.NostrTools?.getPublicKey;
  App.ENCRYPTED_CHANNEL_KIND = 4;
  App.COMMUNITY_CONTEXT = 'yalacommunity';

  window.NostrApp = App;
})(window);
