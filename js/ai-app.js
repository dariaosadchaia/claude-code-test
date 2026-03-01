/**
 * FinomAI App Controller — wires ChatEngine + MessageRenderer on ai.html.
 */
(function () {
  var chatArea = document.getElementById('chat-area');
  var welcomeState = document.getElementById('welcome-state');
  var composer = document.getElementById('composer-input');
  var sendBtn = document.getElementById('send-btn');
  var backBtn = document.getElementById('back-btn');
  var chips = document.querySelectorAll('.suggestion-chip');

  var hasMessages = false;

  /* ── Save previous screen before overwriting ───────────────── */
  var ctx = FinomAI.AppContext.get();
  var previousScreen = ctx.currentScreen;

  /* ── Back button ───────────────────────────────────────────── */
  backBtn.addEventListener('click', function () {
    var map = { dashboard: 'index.html', transactions: 'transactions.html', 'get-paid': 'get-paid.html', more: 'more.html' };
    window.location.href = map[previousScreen] || 'index.html';
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

  /* ── Auto-scroll ───────────────────────────────────────────── */
  function scrollToBottom() {
    requestAnimationFrame(function () {
      chatArea.scrollTop = chatArea.scrollHeight;
    });
  }

  /* ── Personalize welcome ───────────────────────────────────── */
  var greetEl = document.getElementById('welcome-greeting');
  if (greetEl && ctx.companyName) {
    greetEl.textContent = 'Hi, ' + ctx.companyName + '!';
  }

  /* ── Update context for this screen (after reading previous) ─ */
  FinomAI.AppContext.update({ currentScreen: 'ai' });
})();
