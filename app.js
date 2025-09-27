;(function bootstrapApp(window) {
  const App = window.NostrApp || (window.NostrApp = {});
  const tools = window.NostrTools;
  if (!tools) {
    console.error('NostrTools not available for bootstrap');
    return;
  }

  const { SimplePool } = tools;

  if (typeof App.ensureKeys === 'function') {
    App.ensureKeys();
  }

  App.profile = App.profile || {
    name: 'משתמש אנונימי',
    bio: 'יצירת תוכן מבוזר, בלי שוטר באמצע',
    avatarInitials: 'AN',
    picture: '',
  };

  if (!App.getInitials) {
    console.warn('getInitials missing on App. Defaulting to first letters only.');
    App.getInitials = (value = '') => value.trim().slice(0, 2).toUpperCase() || 'AN';
  }
  App.profile.avatarInitials = App.getInitials(App.profile.name || '');

  if (!App.profileCache) {
    App.profileCache = new Map();
  }
  if (typeof App.publicKey === 'string' && App.publicKey) {
    App.profileCache.set(App.publicKey.toLowerCase(), {
      name: App.profile.name,
      bio: App.profile.bio,
      picture: App.profile.picture,
      initials: App.profile.avatarInitials,
    });
  } else {
    App.profileCache.set('self', {
      name: App.profile.name,
      bio: App.profile.bio,
      picture: App.profile.picture,
      initials: App.profile.avatarInitials,
    });
  }

  App.pool = new SimplePool();
  document.getElementById('connection-status').textContent = 'Pool initialized. Connecting to relays...';
  console.log('Pool initialized');
  if (App.metadataPublishQueued && typeof App.publishProfileMetadata === 'function') {
    App.publishProfileMetadata();
  }

  if (typeof App.renderProfile === 'function') {
    // חלק Bootstrap (app.js) – דואג שהפרופיל הנוכחי יוצג מיד עם העלייה של האפליקציה
    App.renderProfile();
  }

  if (typeof App.loadOwnProfileMetadata === 'function') {
    // חלק Bootstrap (app.js) – מושך נתוני פרופיל מעודכנים מהריליים אם קיימים
    App.loadOwnProfileMetadata();
  }

  if (typeof App.subscribeOwnProfileMetadata === 'function') {
    // חלק Bootstrap (app.js) – מאזין לעדכונים שוטפים של פרטי הפרופיל מהריליים
    App.subscribeOwnProfileMetadata();
  }

  if (typeof App.loadFeed === 'function') {
    App.loadFeed();
  }

  window.openCompose = function openCompose() {
    document.getElementById('composeModal').style.display = 'flex';
  };

  window.closeCompose = function closeCompose() {
    document.getElementById('composeModal').style.display = 'none';
  };

  window.publishPost = App.publishPost || (() => {});
  window.openProfileSettings = App.openProfileSettings || (() => {});
  window.closeProfileSettings = App.closeProfileSettings || (() => {});
  window.saveProfileSettings = App.saveProfileSettings || (() => {});
  window.likePost = App.likePost || (() => {});
  window.sharePost = App.sharePost || (() => {});
})(window);
