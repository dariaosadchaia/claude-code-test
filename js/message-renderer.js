/**
 * FinomAI MessageRenderer — pure DOM construction for chat messages.
 * No innerHTML — all createElement/textContent for safety.
 */
window.FinomAI = window.FinomAI || {};

window.FinomAI.MessageRenderer = (function () {

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function text(tag, cls, txt) {
    var e = el(tag, cls);
    e.textContent = txt;
    return e;
  }

  function formatToolName(name) {
    return name.replace(/_/g, ' ').replace(/\b\w/g, function (l) { return l.toUpperCase(); });
  }

  /* ── Screen name → URL map ─────────────────────────────────── */
  var screenUrls = {
    dashboard: 'index.html',
    transactions: 'transactions.html',
    invoices: 'get-paid.html',
    'get-paid': 'get-paid.html',
    more: 'more.html'
  };

  /* ── Public: render a message object ───────────────────────── */

  function render(msg) {
    switch (msg.role) {
      case 'user': return renderUser(msg);
      case 'assistant': return renderAssistant(msg);
      case 'tool_call': return renderToolCall(msg);
      case 'tool_result': return renderToolResult(msg);
      case 'error': return renderError(msg);
      default: return el('div');
    }
  }

  /* ── User bubble ───────────────────────────────────────────── */

  function renderUser(msg) {
    var wrap = el('div', 'chat-msg chat-msg--user');
    var bubble = el('div', 'chat-bubble chat-bubble--user');
    bubble.textContent = msg.content;
    wrap.appendChild(bubble);
    return wrap;
  }

  /* ── Assistant bubble ──────────────────────────────────────── */

  function renderAssistant(msg) {
    var wrap = el('div', 'chat-msg chat-msg--assistant');
    var bubble = el('div', 'chat-bubble chat-bubble--assistant');

    if (msg.richContent && msg.richContent.length) {
      msg.richContent.forEach(function (block) {
        bubble.appendChild(renderRichBlock(block));
      });
    } else {
      bubble.textContent = msg.content || '';
    }

    wrap.appendChild(bubble);
    return wrap;
  }

  /* ── Tool call indicator ───────────────────────────────────── */

  function renderToolCall(msg) {
    var wrap = el('div', 'chat-msg chat-msg--tool');
    var pill = el('div', 'tool-indicator');
    var spinner = el('span', 'tool-indicator__spinner');
    pill.appendChild(spinner);
    pill.appendChild(text('span', 'tool-indicator__label', 'Calling ' + formatToolName(msg.toolName) + '\u2026'));
    wrap.appendChild(pill);
    return wrap;
  }

  /* ── Tool result pill ──────────────────────────────────────── */

  function renderToolResult(msg) {
    var wrap = el('div', 'chat-msg chat-msg--tool');
    var pill = el('div', 'tool-result-pill');
    pill.appendChild(text('span', '', '\u2713 '));
    pill.appendChild(text('span', '', formatToolName(msg.toolName)));
    wrap.appendChild(pill);
    return wrap;
  }

  /* ── Error bubble ──────────────────────────────────────────── */

  function renderError(msg) {
    var wrap = el('div', 'chat-msg chat-msg--assistant');
    var bubble = el('div', 'chat-bubble chat-bubble--error');
    bubble.textContent = msg.content || 'Something went wrong. Please try again.';
    return wrap.appendChild(bubble), wrap;
  }

  /* ── Rich content blocks ───────────────────────────────────── */

  function renderRichBlock(block) {
    switch (block.type) {
      case 'text': return renderTextBlock(block);
      case 'card': return renderCard(block);
      case 'list': return renderList(block);
      case 'link': return renderLink(block);
      case 'action_suggestion': return renderActionLegacy(block);
      case 'button_group': return renderButtonGroup(block);
      case 'image': return renderImage(block);
      case 'markdown': return renderMarkdown(block);
      default:
        var d = el('div');
        d.textContent = block.value || '';
        return d;
    }
  }

  function renderTextBlock(block) {
    var p = el('p', 'rich-text');
    p.textContent = block.value || '';
    return p;
  }

  function renderCard(block) {
    var card = el('div', 'rich-card');
    if (block.title) card.appendChild(text('div', 'rich-card__title', block.title));
    if (block.subtitle) card.appendChild(text('div', 'rich-card__subtitle', block.subtitle));
    (block.fields || []).forEach(function (f) {
      var row = el('div', 'rich-card__field');
      row.appendChild(text('span', 'rich-card__field-label', f.label));
      row.appendChild(text('span', 'rich-card__field-value', f.value));
      card.appendChild(row);
    });
    return card;
  }

  function renderList(block) {
    var list = el('div', 'rich-list');
    (block.items || []).forEach(function (item) {
      var row = el('div', 'rich-list__item');
      var info = el('div', 'rich-list__info');
      info.appendChild(text('div', 'rich-list__title', item.title || ''));
      if (item.subtitle) info.appendChild(text('div', 'rich-list__sub', item.subtitle));
      row.appendChild(info);
      if (item.trailing) row.appendChild(text('span', 'rich-list__trailing', item.trailing));
      if (item.badge) {
        var b = text('span', 'rich-list__badge', item.badge);
        var status = item.badge.toLowerCase();
        if (status === 'overdue') b.style.color = '#e74c3c';
        else if (status === 'pending') b.style.color = '#f5a623';
        else if (status === 'paid') b.style.color = '#2fa84f';
        else b.style.color = 'rgba(36,47,51,0.45)';
        row.appendChild(b);
      }
      list.appendChild(row);
    });
    return list;
  }

  function renderLink(block) {
    var a = el('a', 'rich-link');
    a.textContent = block.text || block.href || '';
    a.href = block.href || '#';
    a.target = '_blank';
    return a;
  }

  /* Legacy single action button (kept for backward compat) */
  function renderActionLegacy(block) {
    var btn = el('button', 'rich-action');
    btn.textContent = block.text || '';
    if (block.action) {
      btn.addEventListener('click', function () {
        window.location.href = block.action;
      });
    }
    return btn;
  }

  /* ── Button group block ────────────────────────────────────── */

  function renderButtonGroup(block) {
    var group = el('div', 'rich-action-group');
    (block.buttons || []).forEach(function (btn) {
      var b = el('button', 'rich-action');
      b.textContent = btn.label || '';
      var action = btn.action || {};
      b.addEventListener('click', function () {
        if (action.type === 'navigate') {
          var screen = action.payload && action.payload.screen;
          var url = screenUrls[screen];
          if (url) {
            window.location.href = url;
          }
        } else if (action.type === 'send_message') {
          var msgText = action.payload && action.payload.text;
          if (msgText) {
            document.dispatchEvent(new CustomEvent('finom:send_message', { detail: { text: msgText } }));
          }
        }
      });
      group.appendChild(b);
    });
    return group;
  }

  /* ── Image block ──────────────────────────────────────────── */

  function renderImage(block) {
    var wrapper = el('div', 'rich-image');
    var img = document.createElement('img');
    img.src = block.src || '';
    img.alt = block.alt || 'Chart';
    wrapper.appendChild(img);
    return wrapper;
  }

  /* ── Markdown block ─────────────────────────────────────────── */

  function renderMarkdown(block) {
    var wrapper = el('div', 'rich-markdown');
    var lines = (block.value || '').split('\n');
    lines.forEach(function (line) {
      line = line.trim();
      if (!line) return;
      if (line.match(/^[\u2022\-\*]\s/)) {
        var li = el('div', 'rich-markdown__bullet');
        var dot = el('span', 'rich-markdown__dot');
        dot.textContent = '\u2022';
        var txt = el('span', '');
        txt.textContent = line.replace(/^[\u2022\-\*]\s*/, '');
        li.appendChild(dot);
        li.appendChild(txt);
        wrapper.appendChild(li);
      } else {
        var p = el('p', 'rich-markdown__text');
        p.textContent = line;
        wrapper.appendChild(p);
      }
    });
    return wrapper;
  }

  /* ── Typing indicator ──────────────────────────────────────── */

  function renderTypingIndicator() {
    var wrap = el('div', 'chat-msg chat-msg--assistant');
    wrap.id = 'typing-indicator';
    var bubble = el('div', 'chat-bubble chat-bubble--assistant chat-bubble--typing');
    for (var i = 0; i < 3; i++) bubble.appendChild(el('span', 'typing-dot'));
    wrap.appendChild(bubble);
    return wrap;
  }

  return { render: render, renderTypingIndicator: renderTypingIndicator };
})();
