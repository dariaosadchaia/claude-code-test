/**
 * FinomAI ChatEngine — conversation state + simulated AI response pipeline.
 * Pattern-matches user input → plans tool calls → executes → generates rich response.
 */
window.FinomAI = window.FinomAI || {};

window.FinomAI.ChatEngine = (function () {
  var messages = [];
  var listeners = [];
  var isSending = false;

  function addMessage(msg) {
    msg.timestamp = Date.now();
    msg.id = 'msg_' + Math.random().toString(36).substr(2, 9);
    messages.push(msg);
    notify();
    return msg;
  }

  function getMessages() { return messages.slice(); }
  function getIsSending() { return isSending; }

  function notify() {
    listeners.forEach(function (fn) { fn(messages); });
  }

  function onMessagesChange(fn) { listeners.push(fn); }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  /* ── Mock answers for known prompts ────────────────────────── */

  var mockAnswers = {
    'how can i get a loan on favorable terms?':
      'To get better loan terms, focus on three levers:\n• predictable cash flow\n• clean financials and tax status\n• competing offers from multiple providers\n\nFor a quick start: prepare last 6–12 months of revenue, main expense categories, existing liabilities, and any collateral. Then compare APR, fees, early repayment rules, and guarantees.\n\nIf you tell me your monthly revenue range and legal form (sole trader / LTD), I\'ll suggest what lenders typically prioritize and what to improve first.',

    'how can i earn income from my savings?':
      'It depends on your horizon and risk comfort.\n\nLow risk:\n• high-yield savings / deposits\n• money market funds (where available)\n\nMedium risk:\n• bond ETFs or a diversified conservative portfolio\n\nRule of thumb: keep an emergency fund (3–6 months), and don\'t lock all cash long-term.\n\nTell me the currency, time horizon, and whether you can tolerate price swings, and I\'ll propose a simple allocation + what metrics to track.',

    'how can i accept payments via qr?':
      'There are two common QR approaches:\n• static QR (customer enters amount)\n• dynamic QR (amount + order details included)\n\nFor retail checkout, dynamic QR reduces mistakes and speeds up payment confirmation.\nIn a prototype you can simulate this flow:\n1) show QR modal\n2) "confirm payment" after a delay\n3) mark order as Paid\n\nDo you want the QR to behave like bank transfer QR (IBAN/SEPA) or wallet/card QR?'
  };

  function findMockAnswer(text) {
    var key = text.trim().toLowerCase().replace(/\.\s*$/, '');
    return mockAnswers[key] || null;
  }

  /* ── Send a user message and simulate AI response ──────────── */

  function sendUserMessage(text) {
    if (isSending) return Promise.resolve();
    isSending = true;

    addMessage({ role: 'user', content: text });

    var mock = findMockAnswer(text);
    if (mock) {
      return delay(700 + Math.floor(Math.random() * 500))
        .then(function () {
          addMessage({ role: 'assistant', content: mock });
        })
        .then(function () { isSending = false; });
    }

    var plan = planResponse(text.toLowerCase());

    return delay(500 + Math.random() * 400)
      .then(function () {
        var chain = Promise.resolve();
        var toolResults = {};

        plan.toolCalls.forEach(function (tc) {
          chain = chain.then(function () {
            addMessage({ role: 'tool_call', toolName: tc.name, toolArgs: tc.args });
            return delay(300 + Math.random() * 500);
          }).then(function () {
            return FinomAI.ToolRegistry.call(tc.name, tc.args);
          }).then(function (result) {
            toolResults[tc.name] = result;
            addMessage({ role: 'tool_result', toolName: tc.name, toolResult: result });
            return delay(200);
          }).catch(function (err) {
            addMessage({ role: 'error', content: 'Tool error: ' + err.message });
          });
        });

        return chain.then(function () { return toolResults; });
      })
      .then(function (toolResults) {
        return delay(300 + Math.random() * 400).then(function () {
          var response = generateResponse(plan, toolResults);
          addMessage({ role: 'assistant', content: response.content, richContent: response.richContent });
        });
      })
      .catch(function (err) {
        addMessage({ role: 'error', content: 'Something went wrong: ' + err.message });
      })
      .then(function () {
        isSending = false;
      });
  }

  /* ── Chart SVG generators ───────────────────────────────────── */

  function generateBudgetSVG() {
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var data = [8200, 7800, 9100, 8600, 7500, 8900, 9400, 8100, 8700, 9200, 8800, 9600];
    var w = 300, h = 200;
    var padL = 38, padR = 12, padT = 16, padB = 28;
    var chartW = w - padL - padR;
    var chartH = h - padT - padB;
    var minV = 6500, maxV = 10500;

    function xPos(i) { return padL + (i / (data.length - 1)) * chartW; }
    function yPos(v) { return padT + chartH - ((v - minV) / (maxV - minV)) * chartH; }

    var pts = data.map(function (v, i) {
      return xPos(i).toFixed(1) + ',' + yPos(v).toFixed(1);
    });
    var linePoints = pts.join(' ');
    var areaPoints = linePoints + ' ' + xPos(11).toFixed(1) + ',' + (padT + chartH) + ' ' + xPos(0).toFixed(1) + ',' + (padT + chartH);

    var gridVals = [7000, 8000, 9000, 10000];
    var grid = '';
    gridVals.forEach(function (v) {
      var yy = yPos(v);
      grid += '<line x1="' + padL + '" y1="' + yy.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + yy.toFixed(1) + '" stroke="#e0e3e6" stroke-width="0.5" stroke-dasharray="4 3"/>';
      grid += '<text x="' + (padL - 6) + '" y="' + (yy + 3).toFixed(1) + '" text-anchor="end" fill="#999" font-size="9" font-family="Poppins,sans-serif">' + (v / 1000) + 'k</text>';
    });

    var labels = months.map(function (m, i) {
      return '<text x="' + xPos(i).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle" fill="#999" font-size="7.5" font-family="Poppins,sans-serif">' + m + '</text>';
    }).join('');

    var dots = data.map(function (v, i) {
      return '<circle cx="' + xPos(i).toFixed(1) + '" cy="' + yPos(v).toFixed(1) + '" r="3" fill="#7c5cfc" stroke="#fff" stroke-width="1.5"/>';
    }).join('');

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="' + w + '" height="' + h + '" fill="#f8f8fa" rx="12"/>' +
      grid +
      '<defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#7c5cfc" stop-opacity="0.18"/>' +
      '<stop offset="100%" stop-color="#7c5cfc" stop-opacity="0.01"/>' +
      '</linearGradient></defs>' +
      '<polygon points="' + areaPoints + '" fill="url(#ag)"/>' +
      '<polyline points="' + linePoints + '" fill="none" stroke="#7c5cfc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      dots + labels +
      '</svg>';

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function generateInefficiencySVG() {
    var cats = [
      { name: 'Subscr.', current: 1240, savings: 380 },
      { name: 'Delivery', current: 890, savings: 320 },
      { name: 'Transport', current: 650, savings: 150 },
      { name: 'Bank Fees', current: 420, savings: 280 },
      { name: 'Office', current: 380, savings: 60 },
      { name: 'Other', current: 520, savings: 90 }
    ];
    var w = 300, h = 210;
    var padL = 42, padR = 12, padT = 16, padB = 46;
    var chartW = w - padL - padR;
    var chartH = h - padT - padB;
    var maxV = 1400;
    var gap = chartW / cats.length;
    var barW = gap * 0.55;

    function bx(i) { return padL + i * gap + (gap - barW) / 2; }
    function bh(v) { return (v / maxV) * chartH; }
    function by(v) { return padT + chartH - bh(v); }

    var grid = '';
    [400, 800, 1200].forEach(function (v) {
      var yy = by(v);
      grid += '<line x1="' + padL + '" y1="' + yy.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + yy.toFixed(1) + '" stroke="#e0e3e6" stroke-width="0.5" stroke-dasharray="4 3"/>';
      grid += '<text x="' + (padL - 6) + '" y="' + (yy + 3).toFixed(1) + '" text-anchor="end" fill="#999" font-size="9" font-family="Poppins,sans-serif">' + v + '</text>';
    });
    grid += '<line x1="' + padL + '" y1="' + (padT + chartH) + '" x2="' + (w - padR) + '" y2="' + (padT + chartH) + '" stroke="#e0e3e6" stroke-width="0.5"/>';

    var defs = '';
    var bars = '';
    cats.forEach(function (c, i) {
      var x = bx(i);
      var fullH = bh(c.current);
      var savH = bh(c.savings);
      var effH = fullH - savH;
      var fullY = by(c.current);

      defs += '<clipPath id="bp' + i + '"><rect x="' + x.toFixed(1) + '" y="' + fullY.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + fullH.toFixed(1) + '" rx="4"/></clipPath>';
      bars += '<g clip-path="url(#bp' + i + ')">';
      bars += '<rect x="' + x.toFixed(1) + '" y="' + fullY.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + savH.toFixed(1) + '" fill="#fe42b4" opacity="0.35"/>';
      bars += '<rect x="' + x.toFixed(1) + '" y="' + (fullY + savH).toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + effH.toFixed(1) + '" fill="#7c5cfc"/>';
      bars += '</g>';
      bars += '<text x="' + (x + barW / 2).toFixed(1) + '" y="' + (padT + chartH + 14) + '" text-anchor="middle" fill="#999" font-size="7.5" font-family="Poppins,sans-serif">' + c.name + '</text>';
    });

    var legendY = h - 10;
    var legend = '<rect x="' + padL + '" y="' + (legendY - 7) + '" width="8" height="8" fill="#7c5cfc" rx="1.5"/>';
    legend += '<text x="' + (padL + 12) + '" y="' + legendY + '" fill="#666" font-size="8" font-family="Poppins,sans-serif">Current spend</text>';
    legend += '<rect x="' + (padL + 95) + '" y="' + (legendY - 7) + '" width="8" height="8" fill="#fe42b4" rx="1.5" opacity="0.35"/>';
    legend += '<text x="' + (padL + 107) + '" y="' + legendY + '" fill="#666" font-size="8" font-family="Poppins,sans-serif">Potential savings</text>';

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">';
    svg += '<defs>' + defs + '</defs>';
    svg += '<rect width="' + w + '" height="' + h + '" fill="#f8f8fa" rx="12"/>';
    svg += grid + bars + legend;
    svg += '</svg>';

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ── Intent detection + tool planning ──────────────────────── */

  function planResponse(lower) {
    if (lower.match(/budget|plan.*expense|expense.*forecast|forecast.*expense|2026.*expense/))
      return { intent: 'chart_budget', toolCalls: [{ name: 'list_transactions', args: { limit: 12 } }, { name: 'get_spending_by_category', args: {} }] };
    if (lower.match(/inefficien|waste|optimiz.*spend/))
      return { intent: 'chart_inefficiency', toolCalls: [{ name: 'get_spending_by_category', args: {} }] };
    if (lower.match(/chart|graph|visuali[sz]/))
      return { intent: 'chart_budget', toolCalls: [{ name: 'list_transactions', args: { limit: 12 } }, { name: 'get_spending_by_category', args: {} }] };
    if (lower.match(/create.+invoice|new invoice/))
      return { intent: 'create_invoice', toolCalls: [{ name: 'create_invoice', args: { client: 'New Client GmbH', amount: '1 000,00 \u20ac', dueDate: '2026-04-01' } }] };
    if (lower.match(/remind|reminder|nudge/))
      return { intent: 'reminder', toolCalls: [{ name: 'list_invoices', args: { status: 'overdue' } }, { name: 'send_invoice_reminder', args: { invoiceId: 'INV-1038' } }] };
    if (lower.match(/balance|how much|money|account\b/))
      return { intent: 'balance', toolCalls: [{ name: 'get_balance', args: {} }] };
    if (lower.match(/transaction|spending|spent|payment|recent/))
      return { intent: 'transactions', toolCalls: [{ name: 'list_transactions', args: { limit: 5 } }] };
    if (lower.match(/invoice|invoices|outstanding|overdue|unpaid/))
      return { intent: 'invoices', toolCalls: [{ name: 'list_invoices', args: {} }] };
    if (lower.match(/cash.?flow|forecast/))
      return { intent: 'cashflow', toolCalls: [{ name: 'get_cashflow_forecast', args: { days: 7 } }] };
    if (lower.match(/card|cards/))
      return { intent: 'cards', toolCalls: [{ name: 'get_cards', args: {} }] };
    if (lower.match(/categor|breakdown|analy[sz]/))
      return { intent: 'categories', toolCalls: [{ name: 'get_spending_by_category', args: {} }] };
    return { intent: 'general', toolCalls: [] };
  }

  /* ── Response generation from tool results ─────────────────── */

  function generateResponse(plan, toolResults) {
    switch (plan.intent) {

      case 'balance': {
        var bal = toolResults.get_balance || {};
        var walletFields = (bal.wallets || []).map(function (w) {
          return { label: w.name, value: w.balance };
        });
        return {
          content: 'Here\u2019s your current balance:',
          richContent: [
            { type: 'text', value: 'Here\u2019s your current account overview:' },
            { type: 'card', title: 'Account Balance', fields: [{ label: 'Total balance', value: bal.total || 'N/A' }].concat(walletFields) },
            { type: 'action_suggestion', text: 'View dashboard', action: 'index.html' }
          ]
        };
      }

      case 'transactions': {
        var txResult = toolResults.list_transactions || {};
        var txs = txResult.transactions || [];
        return {
          content: 'Here are your recent transactions:',
          richContent: [
            { type: 'text', value: 'Your ' + txs.length + ' most recent transactions:' },
            { type: 'list', items: txs.map(function (t) {
              return { title: t.name, subtitle: t.category + ' \u00b7 ' + t.date, trailing: t.amount };
            }) },
            { type: 'action_suggestion', text: 'View all transactions', action: 'transactions.html' }
          ]
        };
      }

      case 'invoices': {
        var invResult = toolResults.list_invoices || {};
        var invs = invResult.invoices || [];
        return {
          content: 'Here are your invoices:',
          richContent: [
            { type: 'text', value: 'You have ' + invs.length + ' invoices:' },
            { type: 'list', items: invs.map(function (i) {
              return { title: i.id + ' \u00b7 ' + i.client, subtitle: i.detail, trailing: i.amount, badge: i.status };
            }) },
            { type: 'action_suggestion', text: 'Go to invoices', action: 'get-paid.html' }
          ]
        };
      }

      case 'create_invoice': {
        var created = toolResults.create_invoice || {};
        return {
          content: 'Invoice created!',
          richContent: [
            { type: 'text', value: 'I\u2019ve created a new invoice for you:' },
            { type: 'card', title: created.invoiceId || 'New Invoice', fields: [
              { label: 'Client', value: created.client || '' },
              { label: 'Amount', value: created.amount || '' },
              { label: 'Due date', value: created.dueDate || '' },
              { label: 'Status', value: created.status || 'Draft' }
            ] },
            { type: 'action_suggestion', text: 'Open Get Paid', action: 'get-paid.html' }
          ]
        };
      }

      case 'reminder': {
        var rem = toolResults.send_invoice_reminder || {};
        return {
          content: 'Reminder sent!',
          richContent: [
            { type: 'text', value: 'Done! I\u2019ve sent a payment reminder for the overdue invoice.' },
            { type: 'card', title: 'Reminder Sent', fields: [
              { label: 'Invoice', value: rem.invoiceId || '' },
              { label: 'Sent to', value: rem.sentTo || '' }
            ] }
          ]
        };
      }

      case 'cashflow': {
        var cf = toolResults.get_cashflow_forecast || {};
        return {
          content: 'Cash flow forecast:',
          richContent: [
            { type: 'text', value: 'Your cash flow forecast for the next ' + (cf.period || '7 days') + ':' },
            { type: 'card', title: 'Cash Flow Forecast', fields: [
              { label: 'Payables', value: cf.payables || '' },
              { label: 'Receivables', value: cf.receivables || '' },
              { label: 'Expected balance', value: cf.expectedBalance || '' }
            ] }
          ]
        };
      }

      case 'cards': {
        var cr = toolResults.get_cards || {};
        return {
          content: 'Your cards:',
          richContent: [
            { type: 'text', value: 'Here are your active cards:' },
            { type: 'list', items: (cr.cards || []).map(function (c) {
              return { title: c.type + ' card', subtitle: '~' + c.lastFour, trailing: (c.spent || c.detail || '') };
            }) }
          ]
        };
      }

      case 'categories': {
        var cat = toolResults.get_spending_by_category || {};
        return {
          content: 'Spending breakdown:',
          richContent: [
            { type: 'text', value: 'Your spending for ' + (cat.period || 'last 30 days') + ':' },
            { type: 'list', items: (cat.categories || []).map(function (c) {
              return { title: c.name, subtitle: c.percentage + '%', trailing: c.amount };
            }) }
          ]
        };
      }

      case 'chart_budget': {
        return {
          content: 'Here\u2019s your 2026 budget forecast:',
          richContent: [
            { type: 'text', value: 'Here\u2019s your 2026 expense forecast based on your spending patterns:' },
            { type: 'image', src: generateBudgetSVG(), alt: '2026 Budget Forecast Chart' },
            { type: 'markdown', value: 'Your projected 2026 monthly expenses average \u20ac8,742 with a total of \u20ac104,900.\n\u2022 Highest months: July (\u20ac9,400) and December (\u20ac9,600)\n\u2022 Lowest month: May (\u20ac7,500) \u2014 consider reallocating budget\n\u2022 Recommendation: set aside a 10% buffer (~\u20ac10,490) for unexpected costs' }
          ]
        };
      }

      case 'chart_inefficiency': {
        return {
          content: 'Here\u2019s your spending inefficiency analysis:',
          richContent: [
            { type: 'text', value: 'I found potential savings across 6 spending categories:' },
            { type: 'image', src: generateInefficiencySVG(), alt: 'Spending Inefficiency Chart' },
            { type: 'markdown', value: 'You could save up to \u20ac1,280/month by optimizing these areas.\n\u2022 Subscriptions: \u20ac380/mo \u2014 review unused SaaS tools and licenses\n\u2022 Delivery & Food: \u20ac320/mo \u2014 consolidate orders, consider bulk purchasing\n\u2022 Banking Fees: \u20ac280/mo \u2014 switch to fee-free alternatives for routine transfers' }
          ]
        };
      }

      default: {
        var ctx = FinomAI.AppContext.get();
        var greeting = ctx.companyName ? 'Hi, ' + ctx.companyName + '!' : 'Hello!';
        return {
          content: greeting + ' I\u2019m your Finom AI assistant.',
          richContent: [
            { type: 'text', value: greeting + ' I\u2019m your Finom AI assistant. I can help you with:' },
            { type: 'list', items: [
              { title: 'Check your balance', subtitle: 'Account and wallet overview' },
              { title: 'Review transactions', subtitle: 'Recent activity and filters' },
              { title: 'Manage invoices', subtitle: 'View, create, send reminders' },
              { title: 'Cash flow forecast', subtitle: 'Upcoming payables & receivables' },
              { title: 'Spending analysis', subtitle: 'Breakdown by category' }
            ] },
            { type: 'text', value: 'What would you like to know?' }
          ]
        };
      }
    }
  }

  function reset() {
    messages = [];
    isSending = false;
    notify();
  }

  /** Load saved messages silently (no notification per message). */
  function loadMessages(savedMsgs) {
    messages = [];
    savedMsgs.forEach(function (m) {
      messages.push(m);
    });
  }

  return {
    sendUserMessage: sendUserMessage,
    getMessages: getMessages,
    getIsSending: getIsSending,
    onMessagesChange: onMessagesChange,
    addMessage: addMessage,
    reset: reset,
    loadMessages: loadMessages
  };
})();
