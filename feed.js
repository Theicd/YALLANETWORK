;(function initFeed(window) {
  const App = window.NostrApp || (window.NostrApp = {});
  App.deletedEventIds = App.deletedEventIds || new Set();
  App.profileCache = App.profileCache || new Map();
  App.eventAuthorById = App.eventAuthorById || new Map();
  App.likesByEventId = App.likesByEventId || new Map();
  async function fetchProfile(pubkey) {
    if (!pubkey || pubkey.trim() === '') {
      return {
        name: 'משתמש אנונימי',
        bio: '',
        picture: '',
        initials: 'AN',
      };
    }

    if (App.profileCache.has(pubkey)) {
      return App.profileCache.get(pubkey);
    }

    const fallback = {
      name: `משתמש ${pubkey.slice(0, 8)}`,
      bio: '',
      picture: '',
      initials: App.getInitials(pubkey),
    };
    App.profileCache.set(pubkey, fallback);

    if (!App.pool) {
      return fallback;
    }

    try {
      const metadataEvent = await App.pool.get(App.relayUrls, { kinds: [0], authors: [pubkey] });
      if (metadataEvent?.content) {
        const parsed = JSON.parse(metadataEvent.content);
        const name = parsed.name ? parsed.name.toString().trim() : fallback.name;
        const bio = parsed.about ? parsed.about.toString().trim() : '';
        const picture = parsed.picture ? parsed.picture.toString().trim() : '';
        const enriched = {
          name: name || fallback.name,
          bio,
          picture,
          initials: App.getInitials(name || pubkey),
        };
        App.profileCache.set(pubkey, enriched);
        return enriched;
      }
    } catch (err) {
      console.warn('Failed to fetch profile metadata for', pubkey, err);
    }

    return fallback;
  }

  function removePostElement(eventId) {
    if (!eventId) return;
    const element = document.querySelector(`[data-post-id="${eventId}"]`);
    if (element?.parentElement) {
      element.parentElement.removeChild(element);
    }
  }

  function registerDeletion(event) {
    if (!event || !Array.isArray(event.tags)) {
      return;
    }
    const adminKeys = App.adminPublicKeys || new Set();
    const eventPubkey = typeof event.pubkey === 'string' ? event.pubkey.toLowerCase() : '';
    const isAdmin = eventPubkey && adminKeys.has(eventPubkey);
    event.tags.forEach((tag) => {
      if (!Array.isArray(tag)) return;
      const [type, value] = tag;
      if ((type === 'e' || type === 'a') && value) {
        const author = App.eventAuthorById?.get(value)?.toLowerCase?.();
        if (!isAdmin) {
          // חלק פיד (feed.js) – מאפשר מחיקה רק למפרסם המקורי או למנהל מורשה
          if (!author || author !== eventPubkey) {
            return;
          }
        }
        App.deletedEventIds.add(value);
        removePostElement(value);
      }
    });
  }

  function registerLike(event) {
    if (!event || event.kind !== 7 || !Array.isArray(event.tags)) {
      return;
    }

    const liker = typeof event.pubkey === 'string' ? event.pubkey.toLowerCase() : null;
    const isUnlike = typeof event.content === 'string' && event.content.trim() === '-';
    const targetIds = new Set();

    event.tags.forEach((tag) => {
      if (!Array.isArray(tag)) return;
      const [type, value] = tag;
      if ((type === 'e' || type === 'a') && value) {
        targetIds.add(value);
      }
    });

    if (!targetIds.size) {
      return;
    }

    targetIds.forEach((eventId) => {
      if (!App.likesByEventId.has(eventId)) {
        App.likesByEventId.set(eventId, new Set());
      }
      const likeSet = App.likesByEventId.get(eventId);
      if (liker) {
        if (isUnlike) {
          likeSet.delete(liker);
        } else {
          likeSet.add(liker);
        }
      }
      updateLikeIndicator(eventId);
    });
  }

  function updateLikeIndicator(eventId) {
    if (!eventId) return;
    const button = document.querySelector(`button[data-like-button][data-event-id="${eventId}"]`);
    if (!button) return;

    const likeSet = App.likesByEventId.get(eventId);
    const count = likeSet ? likeSet.size : 0;
    const counterEl = button.querySelector('.feed-post__like-count');
    if (counterEl) {
      if (count > 0) {
        counterEl.textContent = String(count);
        counterEl.style.display = '';
      } else {
        counterEl.textContent = '';
        counterEl.style.display = 'none';
      }
    }

    const currentUser = typeof App.publicKey === 'string' ? App.publicKey.toLowerCase() : '';
    if (currentUser && likeSet && likeSet.has(currentUser)) {
      button.classList.add('feed-post__action--liked');
    } else {
      button.classList.remove('feed-post__action--liked');
    }
  }

  function renderDemoPosts(feed) {
    if (!feed) return;
    const demo = [
      {
        content: 'ברוכים הבאים לפיד המבוזר. זהו פוסט הדגמה בלבד.',
        name: 'משתמש הדגמה',
        created_at: Math.floor(Date.now() / 1000) - 3600,
      },
      {
        content: 'שלחו את הרשת הזו לשני מחשבים שונים ותראו את הקסם של Nostr.',
        name: 'קהילת Nostr',
        created_at: Math.floor(Date.now() / 1000) - 7200,
      },
    ];

    demo.forEach((item) => {
      const article = document.createElement('article');
      article.className = 'feed-post';
      article.innerHTML = `
        <header class="feed-post__header">
          <div class="feed-post__avatar">${App.getInitials(item.name)}</div>
          <div class="feed-post__info">
            <span class="feed-post__name">${App.escapeHtml(item.name)}</span>
            <span class="feed-post__meta">${formatTimestamp(item.created_at)}</span>
          </div>
        </header>
        <div class="feed-post__content">${App.escapeHtml(item.content)}</div>
        <div class="feed-post__actions">
          <button class="feed-post__action" type="button">
            <i class="fa-regular fa-thumbs-up"></i>
            <span>אהבתי</span>
          </button>
          <button class="feed-post__action" type="button">
            <i class="fa-solid fa-share"></i>
            <span>שתף</span>
          </button>
        </div>
      `;
      feed.appendChild(article);
    });
  }

  function formatTimestamp(seconds) {
    if (!seconds) return '';
    const date = new Date(seconds * 1000);
    try {
      return date.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
    } catch (err) {
      return date.toLocaleString();
    }
  }

  function parseYouTube(link) {
    if (!link) return null;
    const shortMatch = link.match(/^https?:\/\/youtu\.be\/([\w-]{11})(?:\?.*)?$/i);
    if (shortMatch) {
      return shortMatch[1];
    }
    const longMatch = link.match(/^https?:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})(?:&.*)?$/i);
    if (longMatch) {
      return longMatch[1];
    }
    const embedMatch = link.match(/^https?:\/\/www\.youtube\.com\/embed\/([\w-]{11})(?:\?.*)?$/i);
    if (embedMatch) {
      return embedMatch[1];
    }
    return null;
  }

  function createMediaHtml(links = []) {
    if (!Array.isArray(links) || links.length === 0) {
      return '';
    }

    return links
      .map((link) => {
        if (!link) return '';

        const youtubeId = parseYouTube(link);
        if (youtubeId) {
          const thumbUrl = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
          return `
            <div class="feed-media feed-media--youtube" data-youtube-id="${youtubeId}">
              <img class="feed-media__thumb" src="${thumbUrl}" alt="תצוגה מקדימה של YouTube">
              <span class="feed-media__play"><i class="fa-solid fa-play"></i></span>
            </div>
          `;
        }

        if (link.startsWith('data:image') || /\.(png|jpe?g|gif|webp|avif)$/i.test(link)) {
          return `<div class="feed-media"><img src="${link}" alt="תמונה מצורפת"></div>`;
        }

        if (link.startsWith('data:video') || /\.(mp4|webm|ogg)$/i.test(link)) {
          return `<div class="feed-media"><video src="${link}" controls playsinline></video></div>`;
        }

        if (/^https?:\/\//i.test(link)) {
          if (link.match(/\.(mp4|webm|ogg)$/i)) {
            return `<div class="feed-media"><video src="${link}" controls playsinline></video></div>`;
          }
          return `<div class="feed-media"><img src="${link}" alt="תמונה מצורפת"></div>`;
        }

        return '';
      })
      .filter(Boolean)
      .join('');
  }

  async function displayPosts(events) {
    const feed = document.getElementById('feed');
    if (!feed) return;

    const emptyStateTemplate = document.getElementById('empty-state');
    const emptyStateClone = emptyStateTemplate ? emptyStateTemplate.cloneNode(true) : null;

    feed.innerHTML = '';

    events.sort((a, b) => b.created_at - a.created_at);

    const deletions = App.deletedEventIds || new Set();
    const visibleEvents = events.filter((event) => !deletions.has(event.id));

    if (!visibleEvents.length) {
      if (emptyStateClone) {
        feed.appendChild(emptyStateClone);
      } else {
        renderDemoPosts(feed);
      }
      return;
    }

    const isAdminUser =
      App.adminPublicKeys instanceof Set && typeof App.publicKey === 'string'
        ? App.adminPublicKeys.has(App.publicKey.toLowerCase())
        : false;

    for (const event of visibleEvents) {
      const profileData = await fetchProfile(event.pubkey);
      if (event?.id && event?.pubkey) {
        App.eventAuthorById.set(event.id, event.pubkey.toLowerCase());
      }
      const safeName = App.escapeHtml(profileData.name || '');
      const safeBio = profileData.bio ? App.escapeHtml(profileData.bio) : '';
      const article = document.createElement('article');
      article.className = 'feed-post';
      article.dataset.postId = event.id;
      const lines = event.content.split('\n');
      const mediaLinks = [];
      const textLines = [];

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:image') || trimmed.startsWith('data:video')) {
          mediaLinks.push(trimmed);
        } else {
          textLines.push(trimmed);
        }
      });

      const safeContent = App.escapeHtml(textLines.join('\n')).replace(/\n/g, '<br>');
      const mediaHtml = createMediaHtml(mediaLinks);
      const metaParts = [];
      if (safeBio) {
        metaParts.push(safeBio);
      }
      if (event.created_at) {
        metaParts.push(formatTimestamp(event.created_at));
      }
      const metaHtml = metaParts.join(' • ');

      const likeCount = App.likesByEventId.get(event.id)?.size || 0;
      const ownPost = event.pubkey === App.publicKey;
      const canDelete = ownPost || isAdminUser;
      const deleteButtonHtml = canDelete
        ? `
          <button class="feed-post__action feed-post__action--delete" type="button" onclick="NostrApp.deletePost('${event.id}')">
            <i class="fa-solid fa-trash"></i>
            <span>מחק</span>
          </button>
        `
        : '';

      const avatar = profileData.picture
        ? `<div class="feed-post__avatar"><img src="${profileData.picture}" alt="${safeName}"></div>`
        : `<div class="feed-post__avatar">${profileData.initials}</div>`;

      article.innerHTML = `
        <header class="feed-post__header">
          ${avatar}
          <div class="feed-post__info">
            <span class="feed-post__name">${safeName}</span>
            ${metaHtml ? `<span class="feed-post__meta">${metaHtml}</span>` : ''}
          </div>
        </header>
        ${safeContent ? `<div class="feed-post__content">${safeContent}</div>` : ''}
        ${mediaHtml ? `<div class="feed-post__media">${mediaHtml}</div>` : ''}
        <div class="feed-post__actions">
          <button class="feed-post__action" type="button" data-like-button data-event-id="${event.id}" onclick="NostrApp.likePost('${event.id}')">
            <i class="fa-regular fa-thumbs-up"></i>
            <span>אהבתי</span>
            <span class="feed-post__like-count" ${likeCount ? '' : 'style="display:none;"'}>${likeCount || ''}</span>
          </button>
          <button class="feed-post__action" type="button" onclick="NostrApp.sharePost('${event.id}')">
            <i class="fa-solid fa-share"></i>
            <span>שתף</span>
          </button>
          ${deleteButtonHtml}
        </div>
      `;

      feed.appendChild(article);
      updateLikeIndicator(event.id);
    }
  }

  async function loadFeed() {
    if (!App.pool) return;
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      // חלק פיד (feed.js) – מציג למשתמש שהפיד נטען
      statusEl.textContent = 'Loading feed...';
      statusEl.style.opacity = '1';
    }
    App.deletedEventIds = new Set();
    App.likesByEventId = new Map();
    const filters = [{ kinds: [1], '#t': [App.NETWORK_TAG], limit: 50 }];
    const deletionAuthors = new Set();
    if (typeof App.publicKey === 'string' && App.publicKey) {
      deletionAuthors.add(App.publicKey.toLowerCase());
    }
    if (App.adminPublicKeys instanceof Set) {
      App.adminPublicKeys.forEach((key) => {
        if (typeof key === 'string' && key) {
          deletionAuthors.add(key.toLowerCase());
        }
      });
    }
    if (deletionAuthors.size > 0) {
      filters.push({ kinds: [5], authors: Array.from(deletionAuthors), limit: 200 });
    } else {
      filters.push({ kinds: [5], '#t': [App.NETWORK_TAG], limit: 200 });
    }
    filters.push({ kinds: [7], '#t': [App.NETWORK_TAG], limit: 500 });
    const events = [];

    const sub = App.pool.subscribeMany(App.relayUrls, filters, {
      onevent: (event) => {
        if (event.kind === 5) {
          registerDeletion(event);
          return;
        }
        if (event.kind === 7) {
          registerLike(event);
          return;
        }
        events.push(event);
        console.log('Received event:', event);
        if (statusEl) {
          statusEl.textContent = `Loading feed... Received ${events.length} posts`;
        }
      },
      oneose: () => {
        displayPosts(events);
        if (statusEl) {
          // חלק פיד (feed.js) – לאחר השלמת הטעינה מציג הודעה קצרה ולאחר מכן מסתיר אותה
          statusEl.textContent = `Connected! ${events.length} posts loaded.`;
          setTimeout(() => {
            statusEl.textContent = '';
            statusEl.style.opacity = '0';
          }, 2500);
        }
      },
    });

    setTimeout(() => sub.close(), 5000);
  }

  async function publishPost() {
    if (typeof App.getComposePayload !== 'function') {
      console.warn('Compose payload helper missing');
      return;
    }

    const payload = App.getComposePayload();
    if (!payload) {
      return;
    }

    document.getElementById('connection-status').textContent = 'מפרסם פוסט...';
    App.setComposeStatus?.('מפרסם את הפוסט...');

    const draft = {
      kind: 1,
      pubkey: App.publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['t', App.NETWORK_TAG]],
      content: payload.content,
    };
    const event = App.finalizeEvent(draft, App.privateKey);

    try {
      await App.pool.publish(App.relayUrls, event);
      console.log('Published event');
      document.getElementById('connection-status').textContent = 'הפוסט פורסם!';
      App.setComposeStatus?.('הפוסט פורסם בהצלחה.');
    } catch (e) {
      console.error('Publish error', e);
      document.getElementById('connection-status').textContent = 'הפרסום נכשל. נסה שוב.';
      App.setComposeStatus?.('שגיאה בפרסום. נסה שוב מאוחר יותר.', 'error');
      return;
    }

    App.resetCompose?.();
    App.closeCompose?.();
    loadFeed();
  }

  async function likePost(eventId) {
    const draft = {
      kind: 7,
      pubkey: App.publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['e', eventId], ['t', App.NETWORK_TAG]],
      content: '+',
    };
    const event = App.finalizeEvent(draft, App.privateKey);

    try {
      await App.pool.publish(App.relayUrls, event);
      console.log('Liked event');
      registerLike(event);
    } catch (e) {
      console.error('Like publish error', e);
    }
  }

  async function sharePost(eventId) {
    const draft = {
      kind: 6,
      pubkey: App.publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['e', eventId], ['t', App.NETWORK_TAG]],
      content: '',
    };
    const event = App.finalizeEvent(draft, App.privateKey);

    try {
      await App.pool.publish(App.relayUrls, event);
      console.log('Shared event');
    } catch (e) {
      console.error('Share publish error', e);
    }
  }

  async function deletePost(eventId) {
    if (!eventId) {
      return;
    }
    if (!App.pool || typeof App.finalizeEvent !== 'function') {
      console.warn('Pool or finalizeEvent unavailable for deletion');
      return;
    }

    const confirmed = window.confirm('למחוק את הפוסט? פעולה זו אינה ניתנת לשחזור.');
    if (!confirmed) {
      return;
    }

    const draft = {
      kind: 5,
      pubkey: App.publicKey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', eventId],
        ['t', App.NETWORK_TAG],
      ],
      content: '',
    };
    const event = App.finalizeEvent(draft, App.privateKey);

    try {
      await App.pool.publish(App.relayUrls, event);
      console.log('Deleted event');
      App.deletedEventIds.add(eventId);
      removePostElement(eventId);
    } catch (e) {
      console.error('Delete publish error', e);
    }
  }

  window.NostrApp = Object.assign(App, {
    fetchProfile,
    renderDemoPosts,
    displayPosts,
    loadFeed,
    publishPost,
    likePost,
    sharePost,
    deletePost,
    parseYouTube,
    createMediaHtml,
    registerDeletion,
    registerLike,
    updateLikeIndicator,
    removePostElement,
  });
})(window);
