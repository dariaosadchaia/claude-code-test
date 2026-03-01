/**
 * FinomAI ChatHistory — persists chat sessions to localStorage.
 * Each session: { id, title, createdAt, messages[] }
 */
window.FinomAI = window.FinomAI || {};

window.FinomAI.ChatHistory = (function () {
  var STORAGE_KEY = 'finom_ai_chat_history';
  var ACTIVE_KEY  = 'finom_ai_active_chat';

  /* ── Helpers ─────────────────────────────────────────────── */

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) { return []; }
  }

  function save(sessions) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }

  function getActiveId() {
    return localStorage.getItem(ACTIVE_KEY) || null;
  }

  function setActiveId(id) {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  }

  /* ── Public API ──────────────────────────────────────────── */

  /** Get all saved sessions (newest first). */
  function getAll() {
    return load().sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  /** Get a single session by id. */
  function getById(id) {
    var sessions = load();
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].id === id) return sessions[i];
    }
    return null;
  }

  /** Create a new session and return it. */
  function create() {
    var session = {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: 'New chat',
      createdAt: Date.now(),
      messages: []
    };
    var sessions = load();
    sessions.push(session);
    save(sessions);
    setActiveId(session.id);
    return session;
  }

  /** Update a session's messages and auto-set the title from first user msg. */
  function updateMessages(id, messages) {
    var sessions = load();
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].id === id) {
        sessions[i].messages = messages;
        // Title = first user message, truncated
        for (var j = 0; j < messages.length; j++) {
          if (messages[j].role === 'user') {
            var text = messages[j].content || '';
            sessions[i].title = text.length > 40 ? text.substring(0, 40) + '...' : text;
            break;
          }
        }
        save(sessions);
        return sessions[i];
      }
    }
    return null;
  }

  /** Delete a session by id. */
  function remove(id) {
    var sessions = load();
    sessions = sessions.filter(function (s) { return s.id !== id; });
    save(sessions);
    if (getActiveId() === id) setActiveId(null);
  }

  /** Format a timestamp for display (e.g. "10 Dec" or "Today"). */
  function formatDate(ts) {
    var d = new Date(ts);
    var now = new Date();
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Today
    if (d.toDateString() === now.toDateString()) return 'Today';

    // Yesterday
    var yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return d.getDate() + ' ' + months[d.getMonth()];
  }

  return {
    getAll: getAll,
    getById: getById,
    create: create,
    updateMessages: updateMessages,
    remove: remove,
    getActiveId: getActiveId,
    setActiveId: setActiveId,
    formatDate: formatDate
  };
})();
