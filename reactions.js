;(function initReactions(window) {
  const App = window.NostrApp || (window.NostrApp = {});

  // חלק ריאקציות (reactions.js) – מאגר נתונים בזיכרון עבור ריאקציות לכל פוסט
  const reactionStore = App.reactionStore instanceof Map ? App.reactionStore : new Map();
  // חלק ריאקציות (reactions.js) – מפה לשמירת רכיבי DOM עבור עדכון ספירה מהיר
  const reactionDom = new Map();
  // חלק ריאקציות (reactions.js) – מאזין פעיל לריאקציות מהריליים
  let reactionSubscription = App.reactionSubscription || null;

  const VALID_REACTIONS = new Set(['+', '👍']);

  function getEntry(eventId) {
    if (!reactionStore.has(eventId)) {
      reactionStore.set(eventId, {
        reactors: new Set(),
      });
    }
    return reactionStore.get(eventId);
  }

  function getCount(eventId) {
    const entry = reactionStore.get(eventId);
    if (!entry) {
      return 0;
    }
    return entry.reactors.size;
  }

  function updateDisplay(eventId) {
    const container = reactionDom.get(eventId);
    if (!container) {
      return;
    }
    const countSpan = container.querySelector('.feed-post__reactions-count');
    if (!countSpan) {
      return;
    }
    const count = getCount(eventId);
    countSpan.textContent = count > 0 ? `${count} אהבו` : 'היה הראשון שאהב';
  }

  function extractTargetEventId(event) {
    if (!event || !Array.isArray(event.tags)) {
      return null;
    }
    for (const tag of event.tags) {
      if (Array.isArray(tag) && tag[0] === 'e' && typeof tag[1] === 'string' && tag[1]) {
        return tag[1];
      }
    }
    return null;
  }

  function registerReactionEvent(event) {
    const eventId = extractTargetEventId(event);
    if (!eventId || !event?.pubkey) {
      return;
    }
    const reactionContent = typeof event.content === 'string' && event.content.trim() ? event.content.trim() : '+';
    if (!VALID_REACTIONS.has(reactionContent)) {
      return;
    }
    const entry = getEntry(eventId);
    entry.reactors.add(event.pubkey);
    updateDisplay(eventId);
  }

  async function loadReactionsForPosts(targets) {
    if (!Array.isArray(targets) || targets.length === 0 || !App.pool) {
      return;
    }
    const eventIds = targets.map((target) => target?.id).filter((id) => typeof id === 'string' && id);
    if (!eventIds.length) {
      return;
    }

    try {
      const listFilters = [{ kinds: [7], '#e': eventIds, limit: 500 }];
      if (App.NETWORK_TAG) {
        listFilters[0]['#t'] = [App.NETWORK_TAG];
      }
      const events = await App.pool.list(App.relayUrls, listFilters);
      events.forEach(registerReactionEvent);
    } catch (err) {
      console.warn('Reaction list fetch failed', err);
    }

    if (reactionSubscription?.close) {
      reactionSubscription.close();
    }

    const subFilters = [{ kinds: [7], '#e': eventIds }];
    if (App.NETWORK_TAG) {
      subFilters[0]['#t'] = [App.NETWORK_TAG];
    }

    reactionSubscription = App.pool.subscribeMany(App.relayUrls, subFilters, {
      onevent(event) {
        registerReactionEvent(event);
      },
    });

    App.reactionSubscription = reactionSubscription;
  }

  function mountReactions(article, metadata) {
    const eventId = metadata?.eventId;
    if (!eventId || !article) {
      return;
    }
    const container = article.querySelector(`[data-reaction-target="${eventId}"]`);
    if (!container) {
      return;
    }
    reactionDom.set(eventId, container);
    updateDisplay(eventId);
  }

  function recordLocalReaction(eventId, pubkey, content = '+') {
    if (!eventId || !pubkey || !VALID_REACTIONS.has(content)) {
      return;
    }
    const entry = getEntry(eventId);
    entry.reactors.add(pubkey);
    updateDisplay(eventId);
  }

  App.reactionStore = reactionStore;
  App.mountReactions = mountReactions;
  App.loadReactionsForPosts = loadReactionsForPosts;
  App.recordLocalReaction = recordLocalReaction;
})(window);
