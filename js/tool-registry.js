/**
 * FinomAI ToolRegistry — register tools with mock handlers.
 * Handlers receive (params, appContext) and return data.
 */
window.FinomAI = window.FinomAI || {};

window.FinomAI.ToolRegistry = (function () {
  var tools = {};

  function register(name, def) {
    tools[name] = {
      name: name,
      description: def.description,
      parameters: def.parameters || {},
      handler: def.handler
    };
  }

  function call(name, params) {
    var tool = tools[name];
    if (!tool) return Promise.reject(new Error('Unknown tool: ' + name));
    var ctx = FinomAI.AppContext.get();
    try {
      return Promise.resolve(tool.handler(params || {}, ctx));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function list() {
    return Object.keys(tools).map(function (n) {
      return { name: n, description: tools[n].description, parameters: tools[n].parameters };
    });
  }

  function getDefinitions() {
    return Object.keys(tools).map(function (n) {
      var t = tools[n];
      return { type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } };
    });
  }

  return { register: register, call: call, list: list, getDefinitions: getDefinitions };
})();

/* ─── Tool definitions ────────────────────────────────────────────── */

FinomAI.ToolRegistry.register('get_balance', {
  description: 'Get current account balance and wallet breakdown',
  parameters: { type: 'object', properties: {} },
  handler: function (params, ctx) {
    if (ctx.balance) return { total: ctx.balance.total, currency: ctx.balance.currency, wallets: ctx.balance.wallets };
    return { total: '5 000,00 \u20ac', currency: 'EUR', wallets: [{ name: 'Main', balance: '5 000,00 \u20ac' }] };
  }
});

FinomAI.ToolRegistry.register('list_transactions', {
  description: 'List recent transactions, optionally filtered',
  parameters: { type: 'object', properties: { filter: { type: 'string' }, limit: { type: 'number' } } },
  handler: function (params, ctx) {
    var txs = ctx.transactions && ctx.transactions.length ? ctx.transactions : [
      { name: 'Larnaca Airport Business Lounge', category: 'Travel', amount: '\u2013 30,00 \u20ac', date: 'Today', status: 'Completed' },
      { name: 'Spotify AB', category: 'Subscriptions', amount: '\u2013 14,99 \u20ac', date: 'Today', status: 'Completed' },
      { name: 'AWS Services', category: 'Software', amount: '\u2013 248,00 \u20ac', date: 'Today', status: 'Completed' },
      { name: 'Martin Schmidt', category: 'Invoice #1042', amount: '+ 3 200,00 \u20ac', date: 'Yesterday', status: 'Completed' },
      { name: 'WeWork', category: 'Office rent', amount: '\u2013 890,00 \u20ac', date: 'Yesterday', status: 'Completed' },
      { name: 'Figma Inc.', category: 'Software', amount: '\u2013 45,00 \u20ac', date: 'Yesterday', status: 'Completed' },
      { name: 'Tax payment', category: 'Taxes & fees', amount: '\u2013 1 450,00 \u20ac', date: 'Feb 27', status: 'Completed' },
      { name: 'Luisa Meyer GmbH', category: 'Invoice #1041', amount: '+ 1 750,00 \u20ac', date: 'Feb 27', status: 'Completed' },
      { name: 'Google Ads', category: 'Marketing', amount: '\u2013 320,46 \u20ac', date: 'Feb 25', status: 'Completed' }
    ];
    if (params.filter) {
      var f = params.filter.toLowerCase();
      txs = txs.filter(function (t) {
        if (f === 'income') return t.amount.indexOf('+') === 0;
        if (f === 'expenses') return t.amount.indexOf('+') !== 0;
        return true;
      });
    }
    var limit = params.limit || 5;
    return { transactions: txs.slice(0, limit), total: txs.length };
  }
});

FinomAI.ToolRegistry.register('get_transaction', {
  description: 'Get details of a specific transaction by name',
  parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  handler: function (params, ctx) {
    var txs = ctx.transactions && ctx.transactions.length ? ctx.transactions : [];
    var found = txs.find(function (t) { return t.name.toLowerCase().indexOf(params.name.toLowerCase()) >= 0; });
    if (found) return found;
    return { name: params.name, category: 'Unknown', amount: 'N/A', date: 'N/A', status: 'Not found' };
  }
});

FinomAI.ToolRegistry.register('list_invoices', {
  description: 'List invoices, optionally filtered by status',
  parameters: { type: 'object', properties: { status: { type: 'string' } } },
  handler: function (params, ctx) {
    var invs = ctx.invoices && ctx.invoices.length ? ctx.invoices : [
      { id: 'INV-1043', client: 'TechCorp GmbH', amount: '2 400,00 \u20ac', status: 'Pending', detail: 'Due Mar 15' },
      { id: 'INV-1038', client: 'Berlin Digital AG', amount: '1 200,00 \u20ac', status: 'Overdue', detail: 'Due Feb 20 \u00b7 9 days late' },
      { id: 'INV-1042', client: 'Martin Schmidt', amount: '1 250,00 \u20ac', status: 'Pending', detail: 'Due Mar 8' },
      { id: 'INV-1037', client: 'Luisa Meyer GmbH', amount: '1 750,00 \u20ac', status: 'Paid', detail: 'Paid Feb 27' },
      { id: 'INV-1044', client: 'Draft', amount: '580,00 \u20ac', status: 'Draft', detail: 'Created today' }
    ];
    if (params.status) {
      invs = invs.filter(function (i) { return i.status.toLowerCase() === params.status.toLowerCase(); });
    }
    return { invoices: invs, summary: ctx.invoiceSummary || { outstanding: '4 850 \u20ac', overdue: '1 200 \u20ac' } };
  }
});

FinomAI.ToolRegistry.register('create_invoice', {
  description: 'Create a new invoice for a client',
  parameters: { type: 'object', properties: { client: { type: 'string' }, amount: { type: 'string' }, dueDate: { type: 'string' } }, required: ['client', 'amount'] },
  handler: function (params) {
    return { success: true, invoiceId: 'INV-1045', client: params.client, amount: params.amount, dueDate: params.dueDate || '2026-04-01', status: 'Draft' };
  }
});

FinomAI.ToolRegistry.register('send_invoice_reminder', {
  description: 'Send a payment reminder for an overdue invoice',
  parameters: { type: 'object', properties: { invoiceId: { type: 'string' } }, required: ['invoiceId'] },
  handler: function (params) {
    return { success: true, invoiceId: params.invoiceId, sentTo: 'client@berlin-digital.de', sentAt: new Date().toISOString() };
  }
});

FinomAI.ToolRegistry.register('get_cashflow_forecast', {
  description: 'Get cash flow forecast for a given period',
  parameters: { type: 'object', properties: { days: { type: 'number' } } },
  handler: function (params, ctx) {
    if (ctx.cashFlow) return ctx.cashFlow;
    return { period: (params.days || 7) + ' days', payables: '3 981,45 \u20ac', receivables: '4 850,00 \u20ac', expectedBalance: '5 868,55 \u20ac' };
  }
});

FinomAI.ToolRegistry.register('get_cards', {
  description: 'Get card information',
  parameters: { type: 'object', properties: {} },
  handler: function (params, ctx) {
    if (ctx.cards && ctx.cards.length) return { cards: ctx.cards };
    return { cards: [
      { type: 'Physical', lastFour: '3255', spent: '200 \u20ac', limit: '1 000 \u20ac' },
      { type: 'Virtual', lastFour: '3255', spent: '200 \u20ac', limit: '1 000 \u20ac' }
    ] };
  }
});

FinomAI.ToolRegistry.register('get_spending_by_category', {
  description: 'Get spending breakdown by category',
  parameters: { type: 'object', properties: { period: { type: 'string' } } },
  handler: function () {
    return { period: 'Last 30 days', categories: [
      { name: 'Taxes & fees', amount: '1 450,00 \u20ac', percentage: 48 },
      { name: 'Office rent', amount: '890,00 \u20ac', percentage: 30 },
      { name: 'Marketing', amount: '320,46 \u20ac', percentage: 11 },
      { name: 'Software', amount: '293,00 \u20ac', percentage: 10 },
      { name: 'Subscriptions', amount: '14,99 \u20ac', percentage: 1 }
    ] };
  }
});
