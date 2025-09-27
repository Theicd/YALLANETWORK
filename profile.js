(function initProfile(window) {
  const App = window.NostrApp || (window.NostrApp = {});

  function renderProfile() {
    // חלק פרופיל (profile.js) – מעדכן את פרטי הפרופיל בפיד הראשי
    App.profile.avatarInitials = App.getInitials(App.profile.name || '');

    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl) {
      profileNameEl.textContent = App.profile.name;
    }
    const profileBioEl = document.getElementById('profileBio');
    if (profileBioEl) {
      profileBioEl.textContent = App.profile.bio;
    }

    const avatar = document.getElementById('profileAvatar');
    if (avatar) {
      avatar.innerHTML = '';
      if (App.profile.picture) {
        const img = document.createElement('img');
        img.src = App.profile.picture;
        img.alt = App.profile.name;
        avatar.appendChild(img);
      } else {
        avatar.textContent = App.profile.avatarInitials;
      }
    }

    const navAvatar = document.getElementById('navProfileAvatar');
    if (navAvatar) {
      navAvatar.innerHTML = '';
      if (App.profile.picture) {
        const img = document.createElement('img');
        img.src = App.profile.picture;
        img.alt = App.profile.name;
        navAvatar.appendChild(img);
      } else {
        navAvatar.textContent = App.profile.avatarInitials;
      }
    }

    const composeNameEl = document.getElementById('composeProfileName');
    if (composeNameEl) {
      composeNameEl.textContent = App.profile.name;
    }
    const composeBioEl = document.getElementById('composeProfileBio');
    if (composeBioEl) {
      composeBioEl.textContent = App.profile.bio;
    }
    const composeAvatarEl = document.getElementById('composeProfileAvatar');
    if (composeAvatarEl) {
      composeAvatarEl.innerHTML = '';
      if (App.profile.picture) {
        const img = document.createElement('img');
        img.src = App.profile.picture;
        img.alt = App.profile.name;
        composeAvatarEl.appendChild(img);
      } else {
        composeAvatarEl.textContent = App.profile.avatarInitials;
      }
    }
  }

  function applyMetadataToProfile(metadata, sourceLabel = 'metadata') {
    if (!metadata || typeof metadata !== 'object') {
      return false;
    }

    const name = typeof metadata.name === 'string' ? metadata.name.trim() : '';
    const about = typeof metadata.about === 'string' ? metadata.about.trim() : '';
    const picture = typeof metadata.picture === 'string' ? metadata.picture.trim() : '';

    if (!name && !about && !picture) {
      console.log(`Profile metadata: ${sourceLabel} missing relevant fields`, metadata);
      return false;
    }

    if (name) {
      App.profile.name = name;
    }
    if (about) {
      App.profile.bio = about;
    }
    if (picture) {
      App.profile.picture = picture;
    }
    App.profile.avatarInitials = App.getInitials(App.profile.name || '');

    try {
      window.localStorage.setItem('nostr_profile', JSON.stringify(App.profile));
    } catch (err) {
      console.warn('Profile metadata: failed caching profile locally', err);
    }

    if (App.profileCache instanceof Map && typeof App.publicKey === 'string' && App.publicKey) {
      App.profileCache.set(App.publicKey.toLowerCase(), {
        name: App.profile.name,
        bio: App.profile.bio,
        picture: App.profile.picture,
        initials: App.profile.avatarInitials,
      });
    }

    renderProfile();
    return true;
  }

  async function publishProfileMetadata() {
    if (!App.pool || !App.publicKey) {
      App.metadataPublishQueued = true;
      return;
    }
    App.metadataPublishQueued = false;

    const metadata = {
      name: App.profile.name,
      about: App.profile.bio,
      picture: App.profile.picture,
    };

    const content = JSON.stringify(metadata);
    if (content.length > App.MAX_METADATA_CONTENT_LENGTH) {
      console.warn('Metadata content too large, skipping publish');
      return;
    }

    const draft = {
      kind: 0,
      pubkey: App.publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['t', App.NETWORK_TAG]],
      content,
    };

    const event = App.finalizeEvent(draft, App.privateKey);

    try {
      await App.pool.publish(App.relayUrls, event);
      console.log('Profile metadata published');
    } catch (err) {
      App.metadataPublishQueued = true;
      console.error('Failed to publish profile metadata', err);
    }
  }

  function openProfileSettings() {
    document.getElementById('profileNameInput').value = App.profile.name;
    document.getElementById('profileBioInput').value = App.profile.bio;
    document.getElementById('profileImageUrlInput').value = App.profile.picture;
    document.getElementById('profileStatus').textContent = '';
    document.getElementById('profileModal').style.display = 'flex';
  }

  function closeProfileSettings() {
    document.getElementById('profileModal').style.display = 'none';
  }

  async function saveProfileSettings() {
    const name = document.getElementById('profileNameInput').value.trim() || 'משתמש אנונימי';
    const bio = document.getElementById('profileBioInput').value.trim();
    let picture = document.getElementById('profileImageUrlInput').value.trim();

    const fileInput = document.getElementById('profileImageFileInput');
    const status = document.getElementById('profileStatus');

    const applyProfile = (finalPicture) => {
      App.profile.name = name;
      App.profile.bio = bio || 'יוצר מבוזר Nostr';
      const resolvedPicture = finalPicture || picture;
      if (
        resolvedPicture &&
        resolvedPicture.startsWith('data:') &&
        resolvedPicture.length > App.MAX_INLINE_PICTURE_LENGTH
      ) {
        status.textContent = 'תמונת הפרופיל גדולה מדי. העלה קישור חיצוני קצר.';
        return;
      }

      App.profile.picture = resolvedPicture;
      App.profile.avatarInitials = App.getInitials(name);

      try {
      } catch (e) {
        console.error('Failed to save profile to local storage', e);
      }
      renderProfile();
      closeProfileSettings();
      if (App.profileCache instanceof Map && typeof App.publicKey === 'string' && App.publicKey) {
        App.profileCache.set(App.publicKey.toLowerCase(), {
          name: App.profile.name,
          bio: App.profile.bio,
          picture: App.profile.picture,
          initials: App.profile.avatarInitials,
        });
      }
      publishProfileMetadata();
    };

    if (fileInput.files && fileInput.files[0]) {
      try {
        const resized = await App.resizeImageToDataUrl(fileInput.files[0]);
        picture = resized;
        applyProfile(picture);
      } catch (e) {
        console.error('Failed to resize profile image', e);
        status.textContent = 'שגיאה בעיבוד התמונה. נסה קובץ אחר.';
      }
    } else {
      applyProfile(picture);
    }
  }

  async function loadOwnProfileMetadata() {
    if (!App.publicKey || !App.pool) {
      // חלק פרופיל (profile.js) – אם החיבור או המפתח עוד לא מוכנים אין מה לטעון
      return;
    }

    try {
      // חלק פרופיל (profile.js) – מושך נתוני פרופיל מהריליים עבור המשתמש הנוכחי
      console.log('Profile metadata: requesting own metadata for pubkey', App.publicKey);
      const event = await App.pool.get(App.relayUrls, { kinds: [0], authors: [App.publicKey] });
      if (!event?.content) {
        console.log('Profile metadata: no metadata event received for', App.publicKey);
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(event.content);
      } catch (err) {
        console.warn('Failed to parse own profile metadata', err);
        return;
      }
      if (applyMetadataToProfile(parsed, 'initial load')) {
        console.log('Profile metadata: updated local profile for', App.publicKey, App.profile);
      }
    } catch (err) {
      console.warn('Failed to load own profile metadata', err);
    }
  }

  function subscribeOwnProfileMetadata() {
    if (!App.pool || !App.publicKey || typeof App.pool.subscribeMany !== 'function') {
      return;
    }

    if (App.ownProfileMetadataSub?.close) {
      App.ownProfileMetadataSub.close();
    }

    // חלק פרופיל (profile.js) – מאזין לכל עדכון מטא-דאטה עבור המשתמש ומרענן את הממשק
    const sub = App.pool.subscribeMany(App.relayUrls, [{ kinds: [0], authors: [App.publicKey] }], {
      onevent(event) {
        if (!event?.content) {
          return;
        }
        try {
          const parsed = JSON.parse(event.content);
          if (applyMetadataToProfile(parsed, 'subscription')) {
            console.log('Profile metadata: subscription update applied', parsed);
          }
        } catch (err) {
          console.warn('Profile metadata: failed parsing subscription event', err);
        }
      },
    });

    App.ownProfileMetadataSub = sub;
  }

  App.renderProfile = renderProfile;
  App.publishProfileMetadata = publishProfileMetadata;
  App.openProfileSettings = openProfileSettings;
  App.closeProfileSettings = closeProfileSettings;
  App.saveProfileSettings = saveProfileSettings;
  App.loadOwnProfileMetadata = loadOwnProfileMetadata;
  App.subscribeOwnProfileMetadata = subscribeOwnProfileMetadata;
})(window);
