/**
 * FinomAI App Controller — wires ChatEngine + MessageRenderer + ChatHistory on ai.html.
 */
(function () {
  var chatArea = document.getElementById('chat-area');
  var welcomeState = document.getElementById('welcome-state');
  var composer = document.getElementById('composer-input');
  var sendBtn = document.getElementById('send-btn');
  var backBtn = document.getElementById('back-btn');
  var chips = document.querySelectorAll('.suggestion-chip');
  var newChatBtn = document.getElementById('new-chat-btn');
  var historyBtn = document.getElementById('history-btn');

  /* ── History overlay elements ────────────────────────────── */
  var historyOverlay = document.getElementById('history-overlay');
  var historyList = document.getElementById('history-list');
  var historyEmpty = document.getElementById('history-empty');
  var historyBackBtn = document.getElementById('history-back-btn');
  var historyCloseBtn = document.getElementById('history-close-btn');
  var historyNewChatBtn = document.getElementById('history-new-chat-btn');

  var hasMessages = false;
  var activeChatId = null;

  /* ── History badge helpers ─────────────────────────────────── */
  function showHistoryBadge(count) {
    var existing = document.getElementById('history-badge');
    if (existing) existing.remove();
    if (!count) return;
    var badge = document.createElement('span');
    badge.id = 'history-badge';
    badge.className = 'chat-menu-badge';
    badge.textContent = count;
    historyBtn.style.position = 'relative';
    historyBtn.appendChild(badge);
  }

  function hideHistoryBadge() {
    var b = document.getElementById('history-badge');
    if (b) b.remove();
  }

  function clearUnreadState() {
    sessionStorage.removeItem('finom_prime_unread_chat_id');
    hideHistoryBadge();
  }

  /* ── Save previous screen before overwriting ───────────────── */
  var ctx = FinomAI.AppContext.get();
  var previousScreen = ctx.currentScreen;

  /* ── Back button ───────────────────────────────────────────── */
  backBtn.addEventListener('click', function () {
    var map = { dashboard: 'index.html', transactions: 'transactions.html', 'get-paid': 'get-paid.html', more: 'more.html' };
    window.location.href = map[previousScreen] || 'index.html';
  });

  /* ── Clear chat UI ───────────────────────────────────────── */
  function clearChatUI() {
    var msgEls = chatArea.querySelectorAll('.chat-msg, .chat-bubble--typing');
    msgEls.forEach(function (el) { el.remove(); });
    var typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();
    welcomeState.style.display = '';
    hasMessages = false;
    composer.value = '';
    updateSendState();
    chatArea.scrollTop = 0;
  }

  /* ── Save current chat to history ────────────────────────── */
  function saveCurrentChat() {
    if (!activeChatId) return;
    var msgs = FinomAI.ChatEngine.getMessages();
    if (msgs.length > 0) {
      FinomAI.ChatHistory.updateMessages(activeChatId, msgs);
    }
  }

  /* ── Start a brand-new chat ──────────────────────────────── */
  function startNewChat() {
    saveCurrentChat();
    FinomAI.ChatEngine.reset();
    clearChatUI();
    var session = FinomAI.ChatHistory.create();
    activeChatId = session.id;
  }

  /* ── Load a chat from history ────────────────────────────── */
  function loadChat(chatId) {
    saveCurrentChat();

    // Clear UI without triggering engine notification
    var msgEls = chatArea.querySelectorAll('.chat-msg, .chat-bubble--typing');
    msgEls.forEach(function (el) { el.remove(); });
    var typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();

    var session = FinomAI.ChatHistory.getById(chatId);
    if (!session) return;

    activeChatId = session.id;
    FinomAI.ChatHistory.setActiveId(activeChatId);

    if (session.messages.length > 0) {
      hasMessages = true;
      welcomeState.style.display = 'none';

      // Load messages into engine silently, then render
      FinomAI.ChatEngine.loadMessages(session.messages);
      session.messages.forEach(function (msg) {
        var el = FinomAI.MessageRenderer.render(msg);
        el.id = 'm-' + msg.id;
        chatArea.appendChild(el);
      });
      scrollToBottom();
    } else {
      FinomAI.ChatEngine.loadMessages([]);
      welcomeState.style.display = '';
      hasMessages = false;
    }

    composer.value = '';
    updateSendState();
  }

  /* ── New chat (pencil icon on main chat) ─────────────────── */
  newChatBtn.addEventListener('click', function () {
    startNewChat();
    composer.focus();
  });

  /* ── History overlay ─────────────────────────────────────── */

  function renderHistoryList() {
    var sessions = FinomAI.ChatHistory.getAll();
    // Remove old items (keep empty state element)
    var oldItems = historyList.querySelectorAll('.history-item, .history-section-divider, .history-section-label');
    oldItems.forEach(function (el) { el.remove(); });

    if (sessions.length === 0) {
      historyEmpty.style.display = '';
      return;
    }
    historyEmpty.style.display = 'none';

    // Group by: Today, Yesterday, Older
    var today = [];
    var yesterday = [];
    var older = [];
    var now = new Date();
    var yest = new Date(now);
    yest.setDate(yest.getDate() - 1);

    sessions.forEach(function (s) {
      // Only show chats that have messages
      if (!s.messages || s.messages.length === 0) return;
      var d = new Date(s.createdAt);
      if (d.toDateString() === now.toDateString()) today.push(s);
      else if (d.toDateString() === yest.toDateString()) yesterday.push(s);
      else older.push(s);
    });

    function renderGroup(items) {
      items.forEach(function (s) {
        var item = document.createElement('div');
        item.className = 'history-item';
        item.setAttribute('data-chat-id', s.id);

        var isActive = s.id === activeChatId;
        var dateStr = FinomAI.ChatHistory.formatDate(s.createdAt);

        item.innerHTML =
          '<div class="history-item__info">' +
            '<span class="history-item__name' + (isActive ? ' history-item__name--active' : '') + '">' + escapeHtml(s.title) + '</span>' +
            '<span class="history-item__tag">' + dateStr + '</span>' +
          '</div>' +
          '<div class="history-item__right">' +
            (isActive ? '<div class="history-item__badge"></div>' : '') +
            '<div class="history-item__more">' +
              '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">' +
                '<circle cx="5.5" cy="12" r="1.5" fill="#242424"/>' +
                '<circle cx="12" cy="12" r="1.5" fill="#242424"/>' +
                '<circle cx="18.5" cy="12" r="1.5" fill="#242424"/>' +
              '</svg>' +
            '</div>' +
          '</div>';

        item.addEventListener('click', function () {
          var id = item.getAttribute('data-chat-id');
          loadChat(id);
          hideHistory();
        });

        historyList.appendChild(item);
      });
    }

    if (today.length > 0) {
      renderGroup(today);
    }
    if (yesterday.length > 0) {
      if (today.length > 0) {
        var div1 = document.createElement('div');
        div1.className = 'history-section-divider';
        historyList.appendChild(div1);
      }
      renderGroup(yesterday);
    }
    if (older.length > 0) {
      if (today.length > 0 || yesterday.length > 0) {
        var div2 = document.createElement('div');
        div2.className = 'history-section-divider';
        historyList.appendChild(div2);
      }
      renderGroup(older);
    }

    // If all sessions were empty, show empty state
    if (today.length === 0 && yesterday.length === 0 && older.length === 0) {
      historyEmpty.style.display = '';
    }
  }

  function showHistory() {
    saveCurrentChat();
    renderHistoryList();
    historyOverlay.classList.add('is-visible');
  }

  function hideHistory() {
    historyOverlay.classList.remove('is-visible');
  }

  historyBtn.addEventListener('click', showHistory);
  historyBackBtn.addEventListener('click', hideHistory);
  historyCloseBtn.addEventListener('click', function () {
    hideHistory();
    var map = { dashboard: 'index.html', transactions: 'transactions.html', 'get-paid': 'get-paid.html', more: 'more.html' };
    window.location.href = map[previousScreen] || 'index.html';
  });

  // Pencil icon inside history → new chat + close overlay
  historyNewChatBtn.addEventListener('click', function () {
    hideHistory();
    startNewChat();
    composer.focus();
  });

  /* ── Message rendering ─────────────────────────────────────── */
  FinomAI.ChatEngine.onMessagesChange(function (msgs) {
    if (!hasMessages && msgs.length > 0) {
      hasMessages = true;
      welcomeState.style.display = 'none';
    }

    // Remove typing indicator if present
    var existingTyping = document.getElementById('typing-indicator');
    if (existingTyping) existingTyping.remove();

    // Only render the latest message (incremental)
    var last = msgs[msgs.length - 1];
    if (last && !document.getElementById('m-' + last.id)) {
      var el = FinomAI.MessageRenderer.render(last);
      el.id = 'm-' + last.id;
      chatArea.appendChild(el);
    }

    // Show typing indicator if still sending
    if (FinomAI.ChatEngine.getIsSending() && last && last.role !== 'assistant' && last.role !== 'error') {
      chatArea.appendChild(FinomAI.MessageRenderer.renderTypingIndicator());
    }

    scrollToBottom();

    // Auto-save to history
    if (activeChatId && msgs.length > 0) {
      FinomAI.ChatHistory.updateMessages(activeChatId, msgs);
    }
  });

  /* ── Send message ──────────────────────────────────────────── */
  function send() {
    var text = composer.value.trim();
    if (!text || FinomAI.ChatEngine.getIsSending()) return;

    composer.value = '';
    updateSendState();

    // Show typing indicator immediately
    chatArea.appendChild(FinomAI.MessageRenderer.renderTypingIndicator());
    scrollToBottom();

    FinomAI.ChatEngine.sendUserMessage(text);
  }

  sendBtn.addEventListener('click', send);
  composer.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  /* ── Composer state ────────────────────────────────────────── */
  function updateSendState() {
    sendBtn.disabled = !composer.value.trim() || FinomAI.ChatEngine.getIsSending();
  }
  composer.addEventListener('input', updateSendState);
  updateSendState();

  /* ── Suggestion chips ──────────────────────────────────────── */
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      composer.value = chip.getAttribute('data-query');
      updateSendState();
      send();
    });
  });

  /* ── Button group action: send_message ─────────────────────── */
  document.addEventListener('finom:send_message', function (e) {
    if (e.detail && e.detail.text) {
      composer.value = e.detail.text;
      updateSendState();
      send();
    }
  });

  /* ── Prime CTA action handlers ───────────────────────────── */
  document.addEventListener('finom:prime_action', function (e) {
    if (!e.detail || !e.detail.action) return;
    var action = e.detail.action;

    if (action === 'learn_prime') {
      // Add user message
      FinomAI.ChatEngine.addMessage({ role: 'user', content: 'Learn more about Prime' });
      // Show typing
      chatArea.appendChild(FinomAI.MessageRenderer.renderTypingIndicator());
      scrollToBottom();
      // After delay, add assistant response
      setTimeout(function () {
        var typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
        FinomAI.ChatEngine.addMessage({
          role: 'assistant',
          content: 'Here\u2019s what Prime includes:',
          richContent: [
            { type: 'text', value: 'Here\u2019s what Prime includes:' },
            { type: 'markdown', value: '\u2022 1% cashback on all card payments, with a monthly cap of \u20ac1,000 per company\n\u2022 Zero foreign exchange fees on non-EUR transactions up to \u20ac20,000 per month\n\u2022 Two complimentary business lounge visits per quarter\n\u2022 Monthly eSIM data package (1 GB)' },
            { type: 'prime_buttons', buttons: [
              { label: 'Upgrade to Prime', style: 'primary', action: 'upgrade_prime' }
            ]}
          ]
        });
      }, 900);
    }

    if (action === 'upgrade_prime') {
      // Add user message
      FinomAI.ChatEngine.addMessage({ role: 'user', content: 'Upgrade to Prime' });
      // Show typing
      chatArea.appendChild(FinomAI.MessageRenderer.renderTypingIndicator());
      scrollToBottom();
      // After delay, add confirmation
      setTimeout(function () {
        var typing = document.getElementById('typing-indicator');
        if (typing) typing.remove();
        FinomAI.ChatEngine.addMessage({
          role: 'assistant',
          content: 'Done \u2014 your card has been upgraded to Prime.',
          richContent: [
            { type: 'text', value: 'Done \u2014 your card has been upgraded to Prime. Enjoy your traveller benefits starting today.' },
            { type: 'button_group', buttons: [
              { label: 'View your Prime card', action: { type: 'navigate', payload: { screen: 'card' } } }
            ]}
          ]
        });
        sessionStorage.setItem('finom_prime_upgraded', 'true');
      }, 900);
    }
  });

  /* ── Auto-scroll ───────────────────────────────────────────── */
  function scrollToBottom() {
    requestAnimationFrame(function () {
      chatArea.scrollTop = chatArea.scrollHeight;
    });
  }

  /* ── Util ───────────────────────────────────────────────────── */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ── Personalize welcome ───────────────────────────────────── */
  var greetEl = document.getElementById('welcome-greeting');
  if (greetEl && ctx.companyName) {
    greetEl.textContent = 'Hi, ' + ctx.companyName + '!';
  }

  /* ── Initialize: create first chat session ─────────────────── */
  var existingActiveId = FinomAI.ChatHistory.getActiveId();
  var existingSession = existingActiveId ? FinomAI.ChatHistory.getById(existingActiveId) : null;

  if (existingSession && existingSession.messages && existingSession.messages.length > 0) {
    // Restore the active session
    activeChatId = existingSession.id;
    loadChat(activeChatId);
  } else {
    // Start fresh
    var session = FinomAI.ChatHistory.create();
    activeChatId = session.id;
  }

  /* ── Update context for this screen (after reading previous) ─ */
  FinomAI.AppContext.update({ currentScreen: 'ai' });
})();
