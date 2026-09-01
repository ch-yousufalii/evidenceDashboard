# Orders

Search, filter, sort, and click any row to open its detailed view in the side panel.

```sql orders_list
select
  order_id,
  customer,
  items,
  total,
  date::date as date,
  created_at::date as created
from sales_records
order by created_at desc
```

{% html %}
<div id="orders-app">
  <style>
    #orders-app { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #fafafa; color-scheme: dark; }
    #orders-app .toolbar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
    #orders-app .toolbar input, #orders-app .toolbar select {
      padding: 8px 11px; font-size: 13px; color: #fafafa; background: #09090b;
      border: 1px solid #27272a; border-radius: 8px; outline: none;
    }
    #orders-app .toolbar input:focus, #orders-app .toolbar select:focus { border-color: #52525b; }
    #orders-app .toolbar input[type="date"] { color-scheme: dark; }
    #orders-app .clrbtn {
      padding: 8px 14px; font-size: 12px; color: #a1a1aa; background: transparent;
      border: 1px solid #3f3f46; border-radius: 8px; cursor: pointer;
    }
    #orders-app .clrbtn:hover { color: #fafafa; border-color: #52525b; }
    #orders-app table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; background: #101012; border: 1px solid #27272a; border-radius: 10px; overflow: hidden; }
    #orders-app thead th {
      background: #18181b; color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: .06em;
      font-weight: 500; padding: 9px 12px; border-bottom: 1px solid #27272a; text-align: left; cursor: pointer; user-select: none; white-space: nowrap;
    }
    #orders-app thead th:hover { color: #fafafa; }
    #orders-app thead th .arr { font-size: 9px; margin-left: 4px; }
    #orders-app td { padding: 9px 14px; border-bottom: 1px solid #1f1f23; color: #e4e4e7; }
    #orders-app tbody tr { cursor: pointer; transition: background .12s; }
    #orders-app tbody tr:hover { background: #1c1c1f; }
    #orders-app tbody tr.active { background: #27272a; box-shadow: inset 3px 0 0 #60a5fa; }
    #orders-app tbody tr.empty td { text-align: center; color: #71717a; padding: 28px 14px; cursor: default; }
    #orders-app .num { text-align: right; font-variant-numeric: tabular-nums; }
    #orders-app .pager { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 10px; font-size: 12px; color: #71717a; flex-wrap: wrap; }
    #orders-app .pgbtn {
      background: #18181b; border: 1px solid #27272a; color: #fafafa; padding: 5px 11px;
      border-radius: 7px; font-size: 12px; cursor: pointer; min-width: 30px;
    }
    #orders-app .pgbtn:disabled { opacity: .35; cursor: default; }
    #orders-app .pgbtn:hover:not(:disabled) { background: #27272a; }
    #orders-app .pgbtn.cur { background: #27272a; border-color: #52525b; font-weight: 600; }
    #orders-app .pgbtns { display: flex; gap: 4px; align-items: center; }
    #orders-app .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.55); z-index: 20; display: none; }
    #orders-app .drawer {
      position: absolute; top: 0; right: -480px; width: 440px; max-width: 90%; min-height: 100%;
      background: #101012; border-left: 1px solid #27272a; z-index: 30;
      padding: 24px; overflow-y: auto; transition: right .22s ease;
    }
    #orders-app .drawer.open { right: 0; }
    #orders-app .drow { display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; border-bottom: 1px solid #1f1f23; font-size: 13px; }
    #orders-app .drow .k { color: #a1a1aa; }
    #orders-app .drow .v { color: #fafafa; font-weight: 500; text-align: right; }
    #orders-app .tag { display: inline-block; padding: 2px 9px; font-size: 11px; border-radius: 999px; background: #1c1c1f; border: 1px solid #3f3f46; color: #d4d4d8; }
    #orders-app details { border: 1px solid #27272a; border-radius: 8px; margin-top: 14px; background: #0d0d0f; }
    #orders-app summary { padding: 9px 12px; font-size: 12px; color: #a1a1aa; cursor: pointer; text-transform: uppercase; letter-spacing: .06em; }
    #orders-app summary:hover { color: #fafafa; }
    #orders-app pre { margin: 0; padding: 12px; font-size: 11px; color: #a1a1aa; overflow-x: auto; border-top: 1px solid #1f1f23; }
    #orders-app .sect { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #71717a; margin: 18px 0 4px; }
  </style>

  <div class="toolbar">
    <input id="ord-search" type="text" placeholder="Search order or customer..." style="flex:1 1 200px;">
    <select id="ord-customer"></select>
    <input id="ord-from" type="date" title="From date">
    <input id="ord-to" type="date" title="To date">
    <button id="ord-clear" class="clrbtn" type="button">Clear Filters</button>
  </div>

  <div id="ord-stage" style="position:relative;">
    <div id="ord-list"></div>
    <div id="ord-backdrop" class="backdrop"></div>
    <div id="ord-drawer" class="drawer"></div>
  </div>
</div>
<script>
  var ORD = { rows: [], page: 1, perPage: 10, search: '', customer: 'all', from: '', to: '', sortKey: 'date', sortDir: 'desc', selected: null };

  var ORD_COLS = [
    { key: 'order_id', label: 'Order', num: false },
    { key: 'customer', label: 'Customer', num: false },
    { key: 'items', label: 'Items', num: true },
    { key: 'total', label: 'Total', num: true },
    { key: 'date', label: 'Date', num: true }
  ];

  function ordEsc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ordMoney(v) {
    return '$' + Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function ordDetailRow(label, value) {
    return '<div class="drow"><span class="k">' + ordEsc(label) + '</span><span class="v">' + ordEsc(value) + '</span></div>';
  }

  function ordOpen(r) {
    var d = document.getElementById('ord-drawer');
    if (!d || !r) return;
    ORD.selected = r.order_id;
    d.innerHTML =
      '<button id="ord-close" title="Close">&#10005;</button>' +
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#71717a;">Order Detail</div>' +
      '<div style="font-size:20px;font-weight:600;color:#fafafa;margin-top:8px;">' + ordEsc(r.order_id) + '</div>' +
      '<div style="margin-top:10px;"><span class="tag">' + ordEsc(r.customer) + '</span></div>' +
      '<div style="font-size:28px;font-weight:700;color:#fafafa;margin:18px 0 2px;font-variant-numeric:tabular-nums;">' + ordMoney(r.total) + '</div>' +
      '<div style="font-size:12px;color:#71717a;margin-bottom:14px;">' + ordEsc(r.items) + ' item(s) &#183; ordered ' + ordEsc(r.date) + '</div>' +
      '<div class="sect">Details</div>' +
      '<div style="border-top:1px solid #27272a;">' +
      ordDetailRow('Customer', r.customer) +
      ordDetailRow('Items', r.items) +
      ordDetailRow('Total', ordMoney(r.total)) +
      ordDetailRow('Order Date', r.date) +
      ordDetailRow('Created', r.created) +
      '</div>' +
      '<details><summary>Raw record (JSON)</summary><pre>' + ordEsc(JSON.stringify(r, null, 2)) + '</pre></details>';
    d.classList.add('open');
    var bd = document.getElementById('ord-backdrop');
    if (bd) bd.style.display = 'block';
    document.getElementById('ord-close').onclick = ordCloseDrawer;
    ordPaint();
  }
  function ordCloseDrawer() {
    var d = document.getElementById('ord-drawer');
    var bd = document.getElementById('ord-backdrop');
    ORD.selected = null;
    if (d) d.classList.remove('open');
    if (bd) bd.style.display = 'none';
    ordPaint();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') ordCloseDrawer(); });
  document.addEventListener('click', function (e) { if (e.target && e.target.id === 'ord-backdrop') ordCloseDrawer(); });

  function ordFiltered() {
    var q = ORD.search.trim().toLowerCase();
    var rows = ORD.rows.filter(function (r) {
      var matchQ = !q || String(r.order_id).toLowerCase().indexOf(q) !== -1 || String(r.customer).toLowerCase().indexOf(q) !== -1;
      var matchC = ORD.customer === 'all' || r.customer === ORD.customer;
      var matchF = !ORD.from || String(r.date) >= ORD.from;
      var matchT = !ORD.to || String(r.date) <= ORD.to;
      return matchQ && matchC && matchF && matchT;
    });
    var dir = ORD.sortDir === 'asc' ? 1 : -1;
    return rows.sort(function (a, b) {
      var av = a[ORD.sortKey], bv = b[ORD.sortKey];
      if (av == null) av = ''; if (bv == null) bv = '';
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  function ordPageWindow(pages) {
    var out = [], start = Math.max(1, ORD.page - 2), end = Math.min(pages, start + 4);
    start = Math.max(1, end - 4);
    for (var p = start; p <= end; p++) out.push(p);
    return out;
  }

  function ordPaint() {
    var filtered = ordFiltered();
    var pages = Math.max(1, Math.ceil(filtered.length / ORD.perPage));
    if (ORD.page > pages) ORD.page = pages;
    if (ORD.page < 1) ORD.page = 1;
    var startIdx = (ORD.page - 1) * ORD.perPage;
    var pageRows = filtered.slice(startIdx, ORD.page * ORD.perPage);
    var from = filtered.length ? startIdx + 1 : 0;
    var to = Math.min(ORD.page * ORD.perPage, filtered.length);

    var ths = ORD_COLS.map(function (c) {
      var arrow = ORD.sortKey === c.key ? '<span class="arr">' + (ORD.sortDir === 'asc' ? '&#9650;' : '&#9660;') + '</span>' : '';
      return '<th data-k="' + c.key + '"' + (c.num ? ' style="text-align:right;"' : '') + '>' + c.label + arrow + '</th>';
    }).join('');

    var trs = filtered.length
      ? pageRows.map(function (r, i) {
          var cls = r.order_id === ORD.selected ? ' class="active"' : '';
          return '<tr data-i="' + i + '"' + cls + '>' +
            '<td style="font-weight:600;color:#fafafa;">' + ordEsc(r.order_id) + '</td>' +
            '<td>' + ordEsc(r.customer) + '</td>' +
            '<td class="num">' + ordEsc(r.items) + '</td>' +
            '<td class="num" style="font-weight:600;">' + ordMoney(r.total) + '</td>' +
            '<td class="num" style="color:#a1a1aa;">' + ordEsc(r.date) + '</td>' +
            '</tr>';
        }).join('')
      : '<tr class="empty"><td colspan="5">No evidence records found matching your criteria</td></tr>';

    var pagesHtml = ordPageWindow(pages).map(function (p) {
      return '<button class="pgbtn' + (p === ORD.page ? ' cur' : '') + '" data-p="' + p + '">' + p + '</button>';
    }).join('');

    var list = document.getElementById('ord-list');
    list.innerHTML =
      '<table><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>' +
      '<div class="pager">' +
      '<span>Showing ' + from + '&#8211;' + to + ' of ' + filtered.length + ' item(s)</span>' +
      '<div style="display:flex;gap:12px;align-items:center;">' +
      '<label>Per page <select id="ord-per" style="background:#18181b;border:1px solid #27272a;color:#fafafa;border-radius:6px;padding:3px 6px;font-size:12px;">' +
      [10, 25, 50].map(function (n) { return '<option value="' + n + '"' + (n === ORD.perPage ? ' selected' : '') + '>' + n + '</option>'; }).join('') +
      '</label>' +
      '<div class="pgbtns" style="display:flex;gap:4px;">' +
      '<button id="ord-prev" class="pgbtn"' + (ORD.page <= 1 ? ' disabled' : '') + '>Prev</button>' +
      pagesHtml +
      '<button id="ord-next" class="pgbtn"' + (ORD.page >= pages ? ' disabled' : '') + '>Next</button>' +
      '</div></div></div>';

    list.querySelectorAll('th[data-k]').forEach(function (th) {
      th.onclick = function () {
        var k = th.getAttribute('data-k');
        if (ORD.sortKey === k) ORD.sortDir = ORD.sortDir === 'asc' ? 'desc' : 'asc';
        else { ORD.sortKey = k; ORD.sortDir = 'asc'; }
        ordPaint();
      };
    });
    var tbody = list.querySelector('tbody');
    tbody.addEventListener('click', function (e) {
      var tr = e.target.closest('tr');
      if (tr && tr.getAttribute('data-i') != null) ordOpen(pageRows[Number(tr.getAttribute('data-i'))]);
    });
    var prev = document.getElementById('ord-prev');
    var next = document.getElementById('ord-next');
    if (prev) prev.onclick = function () { if (ORD.page > 1) { ORD.page--; ordPaint(); } };
    if (next) next.onclick = function () { if (ORD.page < pages) { ORD.page++; ordPaint(); } };
    list.querySelectorAll('button[data-p]').forEach(function (b) {
      b.onclick = function () { ORD.page = Number(b.getAttribute('data-p')); ordPaint(); };
    });
    var pp = document.getElementById('ord-per');
    if (pp) pp.onchange = function (e) { ORD.perPage = Number(e.target.value); ORD.page = 1; ordPaint(); };
  }

  function ordClearFilters() {
    ORD.search = ''; ORD.customer = 'all'; ORD.from = ''; ORD.to = '';
    ORD.page = 1; ORD.selected = null;
    document.getElementById('ord-search').value = '';
    document.getElementById('ord-from').value = '';
    document.getElementById('ord-to').value = '';
    document.getElementById('ord-customer').value = 'all';
    ordCloseDrawer();
    ordPaint();
  }

  async function ordInit() {
    ORD.rows = await evidence.query('orders_list') || [];
    var customers = [];
    ORD.rows.forEach(function (r) { if (customers.indexOf(r.customer) === -1) customers.push(r.customer); });
    customers.sort();
    document.getElementById('ord-customer').innerHTML = '<option value="all">All customers</option>' +
      customers.map(function (c) { return '<option value="' + ordEsc(c) + '">' + ordEsc(c) + '</option>'; }).join('');
    ordPaint();
  }

  evidence.subscribe(function () { ordInit(); });
  (async function () {
    await ordInit();
    var si = document.getElementById('ord-search');
    si.oninput = function (e) { ORD.search = e.target.value; ORD.page = 1; ordPaint(); };
    var sel = document.getElementById('ord-customer');
    sel.onchange = function (e) { ORD.customer = e.target.value; ORD.page = 1; ordPaint(); };
    document.getElementById('ord-from').onchange = function (e) { ORD.from = e.target.value; ORD.page = 1; ordPaint(); };
    document.getElementById('ord-to').onchange = function (e) { ORD.to = e.target.value; ORD.page = 1; ordPaint(); };
    document.getElementById('ord-clear').onclick = ordClearFilters;
    evidence.ready();
  })();
</script>
{% /html %}
