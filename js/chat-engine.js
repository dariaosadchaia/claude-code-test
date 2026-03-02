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

  /* ── Widget responses for known prompts ─────────────────────── */

  var widgetAnswers = {
    'how can i get a loan on favorable terms?': {
      content: 'Here are loan options matching your business profile.',
      richContent: [
        { type: 'text', value: 'Based on your avg. monthly revenue of €42,300 (last 6 mo.).' },
        { type: 'card', title: 'Best Match — Finom Business Loan', fields: [
          { label: 'Amount available', value: 'up to €75,000' },
          { label: 'APR', value: '4.9%' },
          { label: 'Term', value: '12–36 months' },
          { label: 'Approval time', value: '~2 business days' }
        ]},
        { type: 'list', items: [
          { title: 'KfW SME Loan', subtitle: 'Via partner bank · lower rate', trailing: '3.8% APR' },
          { title: 'Iwoca Flexi-Loan', subtitle: 'Instant decision · flexible', trailing: '6.2% APR' },
          { title: 'Finom Revenue Advance', subtitle: 'Repaid from card receipts', trailing: '7.1% APR' }
        ]},
        { type: 'button_group', buttons: [
          { label: 'Apply now', action: { type: 'navigate', payload: { screen: 'loan_application' } } },
          { label: 'Compare all rates', action: { type: 'send_message', payload: { text: 'Compare all loan rates for my business' } } },
          { label: 'Check eligibility', action: { type: 'send_message', payload: { text: 'What are the loan eligibility requirements?' } } }
        ]}
      ]
    },

    'how can i earn income from my savings?': {
      content: 'Your idle cash can earn up to €1,410/year at current rates.',
      richContent: [
        { type: 'text', value: 'You have ~€18,400 in your current account earning 0%.' },
        { type: 'card', title: 'Savings Options — Jun 2025 Rates', fields: [
          { label: 'Finom Savings Account', value: '3.25% p.a. (instant access)' },
          { label: 'Money Market Fund', value: '3.8% p.a. (T+1 liquidity)' },
          { label: '12-mo Fixed Deposit', value: '4.1% p.a. (locked 12 mo.)' }
        ]},
        { type: 'markdown', value: 'Moving €18,400 to a 12-mo deposit earns ~€754/year.\nFinom Savings gives €599/year with instant access.\nRecommendation: split €10K into fixed deposit, keep €8.4K liquid.' },
        { type: 'button_group', buttons: [
          { label: 'Open Savings Account', action: { type: 'navigate', payload: { screen: 'savings_open' } } },
          { label: 'Set up fixed deposit', action: { type: 'navigate', payload: { screen: 'deposit_setup' } } },
          { label: 'View projections', action: { type: 'send_message', payload: { text: 'Show me savings projections for 12 months' } } }
        ]}
      ]
    },

    'how can i accept payments via qr?': {
      content: 'QR payments are ready to activate on your account.',
      richContent: [
        { type: 'card', title: 'QR Payment Status', fields: [
          { label: 'Type', value: 'Dynamic SEPA QR' },
          { label: 'Max per transaction', value: '€9,999' },
          { label: 'Settlement', value: 'Same business day' },
          { label: 'Status', value: 'Not activated' }
        ]},
        { type: 'list', items: [
          { title: '1 · Enable QR in Settings', subtitle: 'Takes ~30 sec', trailing: '' },
          { title: '2 · Generate QR per invoice', subtitle: 'Amount is pre-filled automatically', trailing: '' },
          { title: '3 · Share or display QR', subtitle: 'Customer scans → instant SEPA transfer', trailing: '' }
        ]},
        { type: 'button_group', buttons: [
          { label: 'Activate QR payments', action: { type: 'navigate', payload: { screen: 'qr_settings' } } },
          { label: 'Create invoice with QR', action: { type: 'navigate', payload: { screen: 'get-paid' } } },
          { label: 'See fee comparison', action: { type: 'send_message', payload: { text: 'Compare QR payment fees vs card terminal' } } }
        ]}
      ]
    }
  };

  function findWidgetAnswer(text) {
    var key = text.trim().toLowerCase().replace(/\.\s*$/, '');
    return widgetAnswers[key] || null;
  }

  /* ── Send a user message and simulate AI response ──────────── */

  function sendUserMessage(text) {
    if (isSending) return Promise.resolve();
    isSending = true;

    addMessage({ role: 'user', content: text });

    var widget = findWidgetAnswer(text);
    if (widget) {
      return delay(700 + Math.floor(Math.random() * 500))
        .then(function () {
          addMessage({ role: 'assistant', content: widget.content, richContent: widget.richContent });
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

    var pts = data.map(function (v, i) { return xPos(i).toFixed(1) + ',' + yPos(v).toFixed(1); });
    var linePoints = pts.join(' ');
    var areaPoints = linePoints + ' ' + xPos(11).toFixed(1) + ',' + (padT + chartH) + ' ' + xPos(0).toFixed(1) + ',' + (padT + chartH);

    var grid = '';
    [7000, 8000, 9000, 10000].forEach(function (v) {
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
      dots + labels + '</svg>';

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
    svg += grid + bars + legend + '</svg>';

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function generateCardsSVG() {
    var months = ['Jan','Feb','Mar','Apr','May','Jun'];
    var fees   = [310, 295, 340, 280, 330, 420];
    var capped = [190, 190, 190, 190, 190, 190];
    var w = 300, h = 180;
    var padL = 36, padR = 12, padT = 16, padB = 28;
    var chartW = w - padL - padR;
    var chartH = h - padT - padB;
    var maxV = 500;

    function xPos(i) { return padL + (i / (months.length - 1)) * chartW; }
    function yPos(v) { return padT + chartH - (v / maxV) * chartH; }

    var feesPts = fees.map(function (v, i) { return xPos(i).toFixed(1) + ',' + yPos(v).toFixed(1); }).join(' ');
    var cappedPts = capped.map(function (v, i) { return xPos(i).toFixed(1) + ',' + yPos(v).toFixed(1); }).join(' ');
    var areaFees = feesPts + ' ' + xPos(5).toFixed(1) + ',' + (padT + chartH) + ' ' + xPos(0).toFixed(1) + ',' + (padT + chartH);

    var grid = '';
    [100, 200, 300, 400].forEach(function (v) {
      var yy = yPos(v);
      grid += '<line x1="' + padL + '" y1="' + yy.toFixed(1) + '" x2="' + (w - padR) + '" y2="' + yy.toFixed(1) + '" stroke="#e0e3e6" stroke-width="0.5" stroke-dasharray="4 3"/>';
      grid += '<text x="' + (padL - 6) + '" y="' + (yy + 3).toFixed(1) + '" text-anchor="end" fill="#999" font-size="9" font-family="Poppins,sans-serif">' + v + '</text>';
    });

    var labels = months.map(function (m, i) {
      return '<text x="' + xPos(i).toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle" fill="#999" font-size="9" font-family="Poppins,sans-serif">' + m + '</text>';
    }).join('');

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">';
    svg += '<rect width="' + w + '" height="' + h + '" fill="#f8f8fa" rx="12"/>';
    svg += '<defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fe42b4" stop-opacity="0.15"/><stop offset="100%" stop-color="#fe42b4" stop-opacity="0.01"/></linearGradient></defs>';
    svg += grid;
    svg += '<polygon points="' + areaFees + '" fill="url(#fg)"/>';
    svg += '<polyline points="' + feesPts + '" fill="none" stroke="#fe42b4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    svg += '<polyline points="' + cappedPts + '" fill="none" stroke="#7c5cfc" stroke-width="1.5" stroke-dasharray="5 3" stroke-linecap="round"/>';
    fees.forEach(function (v, i) {
      svg += '<circle cx="' + xPos(i).toFixed(1) + '" cy="' + yPos(v).toFixed(1) + '" r="3" fill="#fe42b4" stroke="#fff" stroke-width="1.5"/>';
    });
    var legendY = h - 28;
    svg += '<rect x="' + padL + '" y="' + legendY + '" width="8" height="2" fill="#fe42b4" rx="1"/>';
    svg += '<text x="' + (padL + 12) + '" y="' + (legendY + 4) + '" fill="#666" font-size="8" font-family="Poppins,sans-serif">Current card fees</text>';
    svg += '<line x1="' + (padL + 95) + '" y1="' + (legendY + 1) + '" x2="' + (padL + 103) + '" y2="' + (legendY + 1) + '" stroke="#7c5cfc" stroke-width="1.5" stroke-dasharray="3 2"/>';
    svg += '<text x="' + (padL + 107) + '" y="' + (legendY + 4) + '" fill="#666" font-size="8" font-family="Poppins,sans-serif">Finom cap (€190/mo)</text>';
    svg += labels + '</svg>';

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ── Intent detection + tool planning ──────────────────────── */

  function planResponse(lower) {
    if (lower.match(/budget|plan.*expense|expense.*forecast|forecast.*expense|2026.*expense/))
      return { intent: 'chart_budget', toolCalls: [{ name: 'list_transactions', args: { limit: 12 } }, { name: 'get_spending_by_category', args: {} }] };
    if (lower.match(/inefficien|waste|optimiz.*spend/))
      return { intent: 'chart_inefficiency', toolCalls: [{ name: 'get_spending_by_category', args: {} }] };
    if (lower.match(/save.*card|card.*sav/))
      return { intent: 'chart_cards', toolCalls: [{ name: 'get_cards', args: {} }] };
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
          content: 'Current balance: ' + (bal.total || 'N/A'),
          richContent: [
            { type: 'card', title: 'Account Balance', fields: [{ label: 'Total balance', value: bal.total || 'N/A' }].concat(walletFields) },
            { type: 'button_group', buttons: [
              { label: 'View dashboard', action: { type: 'navigate', payload: { screen: 'dashboard' } } },
              { label: 'Cash flow forecast', action: { type: 'send_message', payload: { text: 'Show my cash flow forecast' } } },
              { label: 'Move to savings', action: { type: 'send_message', payload: { text: 'How can I earn income from my savings?' } } }
            ]}
          ]
        };
      }

      case 'transactions': {
        var txResult = toolResults.list_transactions || {};
        var txs = txResult.transactions || [];
        return {
          content: txs.length + ' recent transactions found.',
          richContent: [
            { type: 'text', value: 'Last ' + txs.length + ' transactions:' },
            { type: 'list', items: txs.map(function (t) {
              return { title: t.name, subtitle: t.category + ' \u00b7 ' + t.date, trailing: t.amount };
            }) },
            { type: 'button_group', buttons: [
              { label: 'All transactions', action: { type: 'navigate', payload: { screen: 'transactions' } } },
              { label: 'Spending breakdown', action: { type: 'send_message', payload: { text: 'Show spending breakdown by category' } } },
              { label: 'Export CSV', action: { type: 'navigate', payload: { screen: 'export' } } }
            ]}
          ]
        };
      }

      case 'invoices': {
        var invResult = toolResults.list_invoices || {};
        var invs = invResult.invoices || [];
        var overdueCount = invs.filter(function (i) { return i.status === 'Overdue'; }).length;
        return {
          content: invs.length + ' invoices, ' + overdueCount + ' overdue.',
          richContent: [
            { type: 'text', value: invs.length + ' invoices total · ' + overdueCount + ' overdue' },
            { type: 'list', items: invs.map(function (i) {
              return { title: i.id + ' · ' + i.client, subtitle: i.detail, trailing: i.amount, badge: i.status };
            }) },
            { type: 'button_group', buttons: [
              { label: 'Go to Invoices', action: { type: 'navigate', payload: { screen: 'get-paid' } } },
              { label: 'Send reminders', action: { type: 'send_message', payload: { text: 'Send reminder for overdue invoices' } } },
              { label: 'New invoice', action: { type: 'send_message', payload: { text: 'Create a new invoice' } } }
            ]}
          ]
        };
      }

      case 'create_invoice': {
        var created = toolResults.create_invoice || {};
        return {
          content: 'Invoice ' + (created.invoiceId || '') + ' created.',
          richContent: [
            { type: 'card', title: created.invoiceId || 'New Invoice', fields: [
              { label: 'Client', value: created.client || '' },
              { label: 'Amount', value: created.amount || '' },
              { label: 'Due date', value: created.dueDate || '' },
              { label: 'Status', value: created.status || 'Draft' }
            ]},
            { type: 'button_group', buttons: [
              { label: 'Send invoice', action: { type: 'navigate', payload: { screen: 'get-paid' } } },
              { label: 'Add QR code', action: { type: 'send_message', payload: { text: 'How can I accept payments via QR?' } } },
              { label: 'View all invoices', action: { type: 'navigate', payload: { screen: 'get-paid' } } }
            ]}
          ]
        };
      }

      case 'reminder': {
        var rem = toolResults.send_invoice_reminder || {};
        return {
          content: 'Reminder sent for invoice ' + (rem.invoiceId || ''),
          richContent: [
            { type: 'card', title: 'Reminder Sent', fields: [
              { label: 'Invoice', value: rem.invoiceId || '' },
              { label: 'Sent to', value: rem.sentTo || '' }
            ]},
            { type: 'button_group', buttons: [
              { label: 'View invoice', action: { type: 'navigate', payload: { screen: 'get-paid' } } },
              { label: 'Send another reminder', action: { type: 'send_message', payload: { text: 'Send reminders for all overdue invoices' } } }
            ]}
          ]
        };
      }

      case 'cashflow': {
        var cf = toolResults.get_cashflow_forecast || {};
        return {
          content: 'Expected balance in ' + (cf.period || '7 days') + ': ' + (cf.expectedBalance || 'N/A'),
          richContent: [
            { type: 'card', title: 'Cash Flow · Next ' + (cf.period || '7 days'), fields: [
              { label: 'Payables due', value: cf.payables || '' },
              { label: 'Receivables expected', value: cf.receivables || '' },
              { label: 'Projected balance', value: cf.expectedBalance || '' }
            ]},
            { type: 'button_group', buttons: [
              { label: '30-day forecast', action: { type: 'send_message', payload: { text: 'Show 30-day cash flow forecast' } } },
              { label: 'Collect overdue', action: { type: 'send_message', payload: { text: 'Send reminder for overdue invoices' } } },
              { label: 'View transactions', action: { type: 'navigate', payload: { screen: 'transactions' } } }
            ]}
          ]
        };
      }

      case 'cards': {
        var cr = toolResults.get_cards || {};
        return {
          content: (cr.cards || []).length + ' cards found.',
          richContent: [
            { type: 'text', value: 'Your active cards:' },
            { type: 'list', items: (cr.cards || []).map(function (c) {
              return { title: c.type + ' card', subtitle: '···· ' + c.lastFour, trailing: (c.spent || c.detail || '') };
            }) },
            { type: 'button_group', buttons: [
              { label: 'Save on card fees', action: { type: 'send_message', payload: { text: 'How can I save money on cards?' } } },
              { label: 'Request new card', action: { type: 'navigate', payload: { screen: 'more' } } },
              { label: 'Spending breakdown', action: { type: 'send_message', payload: { text: 'Show spending breakdown by category' } } }
            ]}
          ]
        };
      }

      case 'categories': {
        var cat = toolResults.get_spending_by_category || {};
        return {
          content: 'Spending breakdown for ' + (cat.period || 'last 30 days'),
          richContent: [
            { type: 'text', value: 'Spending for ' + (cat.period || 'last 30 days') + ':' },
            { type: 'list', items: (cat.categories || []).map(function (c) {
              return { title: c.name, subtitle: c.percentage + '% of total', trailing: c.amount };
            }) },
            { type: 'button_group', buttons: [
              { label: 'Find inefficiencies', action: { type: 'send_message', payload: { text: 'Where am I spending inefficiently?' } } },
              { label: 'Set spending limit', action: { type: 'navigate', payload: { screen: 'more' } } },
              { label: 'Export report', action: { type: 'navigate', payload: { screen: 'export' } } }
            ]}
          ]
        };
      }

      case 'chart_budget': {
        return {
          content: '2026 projected expenses: avg. €8,742/mo · total €104,900',
          richContent: [
            { type: 'text', value: '2026 expense forecast — based on your last 12 months:' },
            { type: 'image', src: generateBudgetSVG(), alt: '2026 Budget Forecast' },
            { type: 'markdown', value: 'Avg. €8,742/mo · Total €104,900 projected\n• Peak: Dec (€9,600) and Jul (€9,400)\n• Low: May (€7,500) — opportunity to reallocate\n• Suggested buffer: €10,490 (10%)' },
            { type: 'button_group', buttons: [
              { label: 'Adjust forecast', action: { type: 'send_message', payload: { text: 'How do I reduce my monthly expenses?' } } },
              { label: 'Set monthly limit', action: { type: 'navigate', payload: { screen: 'more' } } },
              { label: 'Export to PDF', action: { type: 'navigate', payload: { screen: 'export' } } }
            ]}
          ]
        };
      }

      case 'chart_inefficiency': {
        return {
          content: 'Potential savings: €1,280/month across 6 categories.',
          richContent: [
            { type: 'text', value: '6 categories with optimization potential (last 6 mo.):' },
            { type: 'image', src: generateInefficiencySVG(), alt: 'Spending Inefficiency' },
            { type: 'markdown', value: 'Total potential savings: €1,280/month\n• Subscriptions €380 — audit unused SaaS licenses\n• Delivery €320 — consolidate orders\n• Bank Fees €280 — switch to fee-free transfers' },
            { type: 'button_group', buttons: [
              { label: 'Fix subscriptions', action: { type: 'send_message', payload: { text: 'Show all active subscriptions' } } },
              { label: 'Reduce bank fees', action: { type: 'send_message', payload: { text: 'How can I save money on cards?' } } },
              { label: 'Set spending alerts', action: { type: 'navigate', payload: { screen: 'more' } } }
            ]}
          ]
        };
      }

      case 'chart_cards': {
        return {
          content: 'You overpaid €581 in card fees vs. Finom cap over 6 months.',
          richContent: [
            { type: 'text', value: 'Card fee comparison — Jan to Jun 2025:' },
            { type: 'image', src: generateCardsSVG(), alt: 'Card Fees Chart' },
            { type: 'markdown', value: 'You spent €1,975 in fees — €581 above the Finom cap.\n• Jun spike: €420 (€230 above cap)\n• Switch 2 team cards to Finom Business plan\n• Estimated savings: €116/mo going forward' },
            { type: 'button_group', buttons: [
              { label: 'Upgrade plan', action: { type: 'navigate', payload: { screen: 'more' } } },
              { label: 'Review all cards', action: { type: 'send_message', payload: { text: 'Show all my cards' } } },
              { label: 'Compare plans', action: { type: 'navigate', payload: { screen: 'more' } } }
            ]}
          ]
        };
      }

      default: {
        var ctx = FinomAI.AppContext.get();
        var greeting = ctx.companyName ? 'Hi, ' + ctx.companyName + '!' : 'Hello!';
        return {
          content: greeting,
          richContent: [
            { type: 'text', value: greeting + ' Here\'s what I can help with:' },
            { type: 'list', items: [
              { title: 'Balance & accounts', subtitle: 'Current balance, wallets', trailing: '' },
              { title: 'Transactions', subtitle: 'Recent activity, categories', trailing: '' },
              { title: 'Invoices', subtitle: 'View, create, send reminders', trailing: '' },
              { title: 'Cash flow forecast', subtitle: 'Payables & receivables', trailing: '' },
              { title: 'Spending analysis', subtitle: 'Breakdown, charts, savings', trailing: '' }
            ]},
            { type: 'button_group', buttons: [
              { label: 'Check balance', action: { type: 'send_message', payload: { text: 'What\'s my balance?' } } },
              { label: 'Recent transactions', action: { type: 'send_message', payload: { text: 'Show recent transactions' } } },
              { label: 'Any overdue invoices?', action: { type: 'send_message', payload: { text: 'Show overdue invoices' } } }
            ]}
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

  function loadMessages(savedMsgs) {
    messages = [];
    savedMsgs.forEach(function (m) { messages.push(m); });
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
