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

  /* ── Send a user message and simulate AI response ──────────── */

  function sendUserMessage(text) {
    if (isSending) return Promise.resolve();
    isSending = true;

    addMessage({ role: 'user', content: text });

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

  return {
    sendUserMessage: sendUserMessage,
    getMessages: getMessages,
    getIsSending: getIsSending,
    onMessagesChange: onMessagesChange,
    addMessage: addMessage
  };
})();
