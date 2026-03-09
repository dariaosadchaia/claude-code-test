/**
 * FinomAI.AIIcon
 *
 * Unified AI icon component — single source of truth for badge state.
 *
 * Usage
 * ─────
 *   Auto-init: add  data-ai-icon  attribute to any button element.
 *   Manual:    FinomAI.AIIcon.init(buttonEl)
 *   Refresh:   FinomAI.AIIcon.refresh()   ← call after writing unread keys
 *
 * Badge state is derived from sessionStorage.  All registered instances
 * are synced together; there is no per-instance badge state.
 */
(function () {
  'use strict';

  /* Keys that signal unread proactive messages */
  var UNREAD_KEYS = [
    'finom_prime_unread_chat_id',
    'finom_ads_unread_chat_id',
    'finom_boulanger_unread_chat_id'
  ];

  var BADGE_CLASS = 'ai-icon__badge';

  /* All registered AI icon button elements on the current page */
  var instances = [];

  /* ── Badge count ─────────────────────────────────────── */
  function getUnreadCount() {
    var count = 0;
    for (var i = 0; i < UNREAD_KEYS.length; i++) {
      if (sessionStorage.getItem(UNREAD_KEYS[i])) count++;
    }
    return count;
  }

  /* ── Sync one element's badge to the given count ──────── */
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

  /* ── Refresh all registered instances ────────────────── */
  function refresh() {
    var count = getUnreadCount();
    for (var i = 0; i < instances.length; i++) {
      syncBadge(instances[i], count);
    }
  }

  /* ── Register a button element as an AI icon ──────────── */
  function init(el) {
    if (!el) return;
    if (instances.indexOf(el) === -1) {
      instances.push(el);
    }
    refresh();
  }

  /* ── Auto-discover data-ai-icon elements ─────────────── */
  function autoInit() {
    var els = document.querySelectorAll('[data-ai-icon]');
    for (var i = 0; i < els.length; i++) {
      init(els[i]);
    }
  }

  /* ── Cross-tab badge sync via storage event ──────────── */
  window.addEventListener('storage', function (e) {
    if (UNREAD_KEYS.indexOf(e.key) !== -1) refresh();
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
