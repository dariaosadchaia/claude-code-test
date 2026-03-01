/**
 * FinomAI AppContext — cross-page state via sessionStorage.
 * Each page scrapes its DOM into context; the AI screen reads the full picture.
 */
window.FinomAI = window.FinomAI || {};

window.FinomAI.AppContext = (function () {
  var STORAGE_KEY = 'finom_ai_context';

  function createEmpty() {
    return {
      currentScreen: '',
      companyName: '',
      userEmail: '',
      balance: null,
      cards: [],
      cashback: null,
      cashFlow: null,
      transactions: [],
      transactionFilters: { activeFilter: 'All', searchQuery: '' },
      invoices: [],
      invoiceSummary: null,
      invoiceTab: 'Invoices',
      pendingApprovals: 0,
      lastUpdated: null
    };
  }

  function save(ctx) {
    ctx.lastUpdated = Date.now();
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx)); } catch (e) { /* quota */ }
  }

  function load() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* parse error */ }
    return createEmpty();
  }

  function update(partial) {
    var ctx = load();
    for (var key in partial) {
      if (partial.hasOwnProperty(key)) ctx[key] = partial[key];
    }
    save(ctx);
    return ctx;
  }

  function get() { return load(); }

  return { get: get, update: update, createEmpty: createEmpty };
})();
