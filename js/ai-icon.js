/**
 * FinomAI.AIIcon
 *
 * Unified AI icon component — single source of truth for badge state.
 *
 * Badge count is derived from FinomAI.ChatHistory.getUnreadCount(), which
 * counts assistant messages with isRead === false across all sessions.
 * There is no separate badge store; the count always reflects real message state.
 *
 * Usage
 * ─────
 *   Auto-init: add  data-ai-icon  attribute to any button element.
 *   Manual:    FinomAI.AIIcon.init(buttonEl)
 *   Refresh:   FinomAI.AIIcon.refresh()   ← call after any unread state change
 *
 * Requires js/chat-history.js to be loaded on the same page for real counts.
 * If ChatHistory is unavailable, the badge silently shows nothing.
 */
(function () {
  'use strict';

  var BADGE_CLASS  = 'ai-icon__badge';
  var HISTORY_KEY  = 'finom_ai_chat_history';

  /* All registered AI icon button elements on the current page */
  var instances = [];

  /* ── Badge count (delegated to ChatHistory) ─────────────── */
  function getUnreadCount() {
    if (window.FinomAI &&
        window.FinomAI.ChatHistory &&
        typeof window.FinomAI.ChatHistory.getUnreadCount === 'function') {
      return window.FinomAI.ChatHistory.getUnreadCount();
    }
    return 0;
  }

  /* ── Sync one element's badge to the given count ──────────── */
  function syncBadge(el, count) {
    var existing = el.querySelector('.' + BADGE_CLASS);
    if (count > 0) {
      if (!existing) {
        var badge = document.createElement('span');
        badge.className = BADGE_CLASS;
        el.appendChild(badge);
        existing = badge;
      }
      existing.textContent = String(count);
    } else {
      if (existing) existing.remove();
    }
  }

  /* ── Refresh all registered instances ────────────────────── */
  function refresh() {
    var count = getUnreadCount();
    for (var i = 0; i < instances.length; i++) {
      syncBadge(instances[i], count);
    }
  }

  /* ── Register a button element as an AI icon ──────────────── */
  function init(el) {
    if (!el) return;
    if (instances.indexOf(el) === -1) {
      instances.push(el);
    }
    refresh();
  }

  /* ── Auto-discover data-ai-icon elements ─────────────────── */
  function autoInit() {
    var els = document.querySelectorAll('[data-ai-icon]');
    for (var i = 0; i < els.length; i++) {
      init(els[i]);
    }
  }

  /* ── Cross-tab badge sync via storage event ──────────────── */
  /* Fires when another tab modifies localStorage (e.g. marks messages read). */
  window.addEventListener('storage', function (e) {
    if (e.key === HISTORY_KEY) refresh();
  });

  /* Auto-init on DOM ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  /* Public API */
  window.FinomAI = window.FinomAI || {};
  window.FinomAI.AIIcon = {
    init: init,
    refresh: refresh,
    getUnreadCount: getUnreadCount
  };
}());
