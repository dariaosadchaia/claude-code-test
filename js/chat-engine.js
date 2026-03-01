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
      'There are two common QR approaches:\n• static QR (customer enters amount)\n• dynamic QR (amount + order details included)\n\nFor retail checkout, dynamic QR reduces mistakes and speeds up payment confirmation.\nIn a prototype you can simulate this flow:\n1) show QR modal\n2) "confirm payment" after a delay\n3) mark order as Paid\n\nDo you want the QR to behave like bank transfer QR (IBAN/SEPA) or wallet/card QR?',

    'plan my 2026 budget by analyzing my expenses and making forecasts':
      'I can build a 2026 budget forecast like this:\n1) group 2025 spend into categories\n2) find recurring bills + seasonality\n3) estimate baseline monthly spend\n4) forecast 2026 with assumptions (inflation, planned changes, savings goal)\n\nFor the prototype, I can output:\n• average monthly spend\n• top categories\n• forecasted 2026 total\n• 2–3 recommendations to stay on track\n\nIf you have mocked transaction data (even 20–30 rows), I can shape the response around it.',

    'where am i spending inefficiently?':
      'I usually spot inefficiency in four places:\n• unused subscriptions\n• duplicated services\n• high-frequency small spends (delivery, taxis, coffee)\n• fees (banking, FX, late fees)\n\nFor a prototype, I\'d highlight 3 quick wins with estimated monthly savings and one "structural" recommendation.\n\nIf you share what mocked categories you have, I\'ll tailor the "inefficiency" findings to them.'
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

  /* ── Intent detection + tool planning ──────────────────────── */

  function planResponse(lower) {
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

  return {
    sendUserMessage: sendUserMessage,
    getMessages: getMessages,
    getIsSending: getIsSending,
    onMessagesChange: onMessagesChange,
    addMessage: addMessage,
    reset: reset
  };
})();
