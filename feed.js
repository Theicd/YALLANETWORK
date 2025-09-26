;(function initFeed(window) {
  const App = window.NostrApp || (window.NostrApp = {});
  App.deletedEventIds = App.deletedEventIds || new Set();
  App.profileCache = App.profileCache || new Map();
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
    event.tags.forEach((tag) => {
      if (!Array.isArray(tag)) return;
      const [type, value] = tag;
      if ((type === 'e' || type === 'a') && value) {
        App.deletedEventIds.add(value);
        removePostElement(value);
      }
    });
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

    for (const event of visibleEvents) {
      const profileData = await fetchProfile(event.pubkey);
      const safeName = App.escapeHtml(profileData.name);
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

      const ownPost = event.pubkey === App.publicKey;
      const deleteButtonHtml = ownPost
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
          <button class="feed-post__action" type="button" onclick="NostrApp.likePost('${event.id}')">
            <i class="fa-regular fa-thumbs-up"></i>
            <span>אהבתי</span>
          </button>
          <button class="feed-post__action" type="button" onclick="NostrApp.sharePost('${event.id}')">
            <i class="fa-solid fa-share"></i>
            <span>שתף</span>
          </button>
          ${deleteButtonHtml}
        </div>
      `;

      feed.appendChild(article);
    }
  }

  async function loadFeed() {
    if (!App.pool) return;
    document.getElementById('connection-status').textContent = 'Loading feed...';
    App.deletedEventIds = new Set();
    const filters = [{ kinds: [1], '#t': [App.NETWORK_TAG], limit: 50 }];
    if (App.publicKey) {
      filters.push({ kinds: [5], authors: [App.publicKey], limit: 200 });
    } else {
      filters.push({ kinds: [5], '#t': [App.NETWORK_TAG], limit: 200 });
    }
    const events = [];

    const sub = App.pool.subscribeMany(App.relayUrls, filters, {
      onevent: (event) => {
        if (event.kind === 5) {
          registerDeletion(event);
          return;
        }
        events.push(event);
        console.log('Received event:', event);
        document.getElementById('connection-status').textContent = `Loading feed... Received ${events.length} posts`;
      },
      oneose: () => {
        displayPosts(events);
        document.getElementById('connection-status').textContent = `Connected! ${events.length} posts loaded.`;
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
    removePostElement,
  });
})(window);
