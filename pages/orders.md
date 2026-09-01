# Orders

Search, filter, and click any row to open its detailed view in the side panel.

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
<div id="orders-app" style="position:relative;">
  <style>
    #orders-app { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #fafafa; }
    #orders-app .toolbar { display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
    #orders-app .toolbar input {
      flex: 1 1 220px; padding: 9px 12px; font-size: 13px; color: #fafafa;
      background: #09090b; border: 1px solid #27272a; border-radius: 8px; outline: none;
    }
    #orders-app .toolbar input:focus { border-color: #52525b; }
    #orders-app .toolbar select {
      padding: 9px 12px; font-size: 13px; color: #fafafa; background: #09090b;
      border: 1px solid #27272a; border-radius: 8px; outline: none; cursor: pointer;
    }
    #orders-app table { width: 100%; border-collapse: collapse; font-size: 13px; background: #101012; border: 1px solid #27272a; border-radius: 10px; overflow: hidden; }
    #orders-app thead th { background: #18181b; color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; font-weight: 500; padding: 10px 14px; border-bottom: 1px solid #27272a; text-align: left; }
    #orders-app td { padding: 11px 14px; border-bottom: 1px solid #1f1f23; color: #e4e4e7; }
    #orders-app tbody tr { cursor: pointer; transition: background .12s; }
    #orders-app tbody tr:hover { background: #1c1c1f; }
    #orders-app .num { text-align: right; font-variant-numeric: tabular-nums; }
    #orders-app .pager { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; color: #71717a; }
    #orders-app .pgbtn { background: #18181b; border: 1px solid #27272a; color: #fafafa; padding: 6px 14px; border-radius: 7px; font-size: 12px; cursor: pointer; }
    #orders-app .pgbtn:disabled { opacity: .35; cursor: default; }
    #orders-app .pgbtn:hover:not(:disabled) { background: #27272a; }
    #orders-app .ord-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.55); z-index: 20; display: none; }
    #orders-app .ord-drawer {
      position: absolute; top: 0; right: -460px; width: 420px; max-width: 85%; min-height: 100%;
      background: #101012; border-left: 1px solid #27272a; z-index: 30;
      padding: 24px; overflow-y: auto; transition: right .22s ease;
      font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    }
    #orders-app .ord-drawer.open { right: 0; }
    #orders-app .ord-close { position: absolute; top: 14px; right: 14px; width: 28px; height: 28px;
      background: transparent; border: 1px solid #27272a; border-radius: 8px; color: #fafafa;
      cursor: pointer; font-size: 13px; line-height: 1; }
    #orders-app .ord-close:hover { background: #27272a; }
    #orders-app .drow { display: flex; justify-content: space-between; gap: 16px; padding: 10px 0; border-bottom: 1px solid #1f1f23; font-size: 13px; }
    #orders-app .drow .k { color: #a1a1aa; }
    #orders-app .drow .v { color: #fafafa; font-weight: 500; text-align: right; }
  </style>

  <div class="toolbar">
    <input id="ord-search" type="text" placeholder="Search order or customer..."
      style="flex:1 1 220px;padding:9px 12px;font-size:13px;color:#fafafa;background:#09090b;border:1px solid #27272a;border-radius:8px;outline:none;">
    <select id="ord-customer" style="padding:9px 12px;font-size:13px;color:#fafafa;background:#09090b;border:1px solid #27272a;border-radius:8px;outline:none;cursor:pointer;">
      <option value="all">All customers</option>
    </select>
  </div>

  <div id="ord-stage" style="position:relative;">
    <div id="ord-list"></div>
    <div id="ord-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,.55);z-index:20;display:none;"></div>
    <div id="ord-drawer" style="position:absolute;top:0;right:-460px;width:420px;max-width:85%;min-height:100%;background:#101012;border-left:1px solid #27272a;z-index:30;padding:22px;overflow-y:auto;transition:right .22s ease;"></div>
  </div>
</div>
<script>
  var ORD = { rows: [], page: 1, perPage: 5, search: '', customer: 'all' };

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
    var bd = document.getElementById('ord-backdrop');
    if (!d || !r) return;
    d.innerHTML =
      '<button id="ord-close" style="position:absolute;top:14px;right:14px;width:28px;height:28px;background:transparent;border:1px solid #27272a;border-radius:8px;color:#fafafa;cursor:pointer;font-size:13px;line-height:1;">x</button>' +
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#71717a;">Order Detail</div>' +
      '<div style="font-size:20px;font-weight:600;color:#fafafa;margin-top:8px;">' + ordEsc(r.order_id) + '</div>' +
      '<div style="font-size:28px;font-weight:700;color:#fafafa;margin:20px 0 2px;font-variant-numeric:tabular-nums;">' + ordMoney(r.total) + '</div>' +
      '<div style="font-size:12px;color:#71717a;margin-bottom:16px;">' + ordEsc(r.items) + ' items &#183; ordered ' + ordEsc(r.date) + '</div>' +
      '<div style="border-top:1px solid #27272a;padding-top:6px;">' +
      ordDetailRow('Customer', r.customer) +
      ordDetailRow('Items', r.items) +
      ordDetailRow('Total', ordMoney(r.total)) +
      ordDetailRow('Order Date', r.date) +
      ordDetailRow('Created', r.created) +
      '</div>';
    d.classList.add('open');
    d.style.right = '0';
    var bd = document.getElementById('ord-backdrop');
    if (bd) bd.style.display = 'block';
    document.getElementById('ord-close').onclick = ordCloseDrawer;
  }
  function ordCloseDrawer() {
    var d = document.getElementById('ord-drawer');
    var bd = document.getElementById('ord-backdrop');
    if (d) d.classList.remove('open');
    if (bd) bd.style.display = 'none';
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') ordCloseDrawer(); });
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'ord-backdrop') ordCloseDrawer();
  });

  function ordFiltered() {
    var q = ORD.search.trim().toLowerCase();
    return ORD.rows.filter(function (r) {
      var matchQ = !q || String(r.order_id).toLowerCase().indexOf(q) !== -1 || String(r.customer).toLowerCase().indexOf(q) !== -1;
      var matchC = ORD.customer === 'all' || r.customer === ORD.customer;
      return matchQ && matchC;
    });
  }

  function ordPaint() {
    var filtered = ordFiltered();
    var pages = Math.max(1, Math.ceil(filtered.length / ORD.perPage));
    if (ORD.page > pages) ORD.page = pages;
    var pageRows = filtered.slice((ORD.page - 1) * ORD.perPage, ORD.page * ORD.perPage);

    var trs = pageRows.map(function (r, i) {
      return '<tr data-i="' + i + '">' +
        '<td style="padding:11px 14px;border-bottom:1px solid #1f1f23;font-weight:600;color:#fafafa;">' + ordEsc(r.order_id) + '</td>' +
        '<td style="padding:11px 14px;border-bottom:1px solid #1f1f23;">' + ordEsc(r.customer) + '</td>' +
        '<td class="num" style="padding:11px 14px;border-bottom:1px solid #1f1f23;">' + ordEsc(r.items) + '</td>' +
        '<td class="num" style="padding:11px 14px;border-bottom:1px solid #1f1f23;font-weight:600;">' + ordMoney(r.total) + '</td>' +
        '<td class="num" style="padding:11px 14px;color:#a1a1aa;">' + ordEsc(r.date) + '</td>' +
        '</tr>';
    }).join('');

    var list = document.getElementById('ord-list');
    list.innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:13px;background:#101012;border:1px solid #27272a;border-radius:10px;overflow:hidden;">' +
      '<thead><tr>' +
      '<th style="text-align:left;padding:10px 14px;background:#18181b;color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:500;border-bottom:1px solid #27272a;">Order</th>' +
      '<th style="text-align:left;padding:10px 14px;background:#18181b;color:#a1a1aa;font-size:11px;text-transform:uppercase;font-weight:500;">Customer</th>' +
      '<th style="text-align:right;padding:10px 14px;background:#18181b;color:#a1a1aa;font-size:11px;text-transform:uppercase;font-weight:500;">Items</th>' +
      '<th style="text-align:right;padding:10px 14px;background:#18181b;color:#71717a;font-size:11px;text-transform:uppercase;font-weight:500;">Total</th>' +
      '<th style="text-align:right;padding:10px 14px;background:#18181b;color:#71717a;font-size:11px;text-transform:uppercase;font-weight:500;">Date</th>' +
      '</tr></thead><tbody>' + trs + '</tbody></table>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px;color:#71717a;">' +
      '<span>Page ' + ORD.page + ' of ' + pages + ' &#183; ' + filtered.length + ' order(s)</span>' +
      '<div>' +
      '<button id="ord-prev" style="background:#18181b;border:1px solid #27272a;color:#fafafa;padding:6px 14px;border-radius:7px;font-size:12px;cursor:pointer;' + (ORD.page <= 1 ? 'opacity:.35;' : '') + '">Prev</button>' +
      ' <button id="ord-next" style="background:#18181b;border:1px solid #27272a;color:#fafafa;padding:6px 14px;border-radius:7px;font-size:12px;cursor:pointer;' + (ORD.page >= pages ? 'opacity:.35;' : '') + '">Next</button>' +
      '</div></div>';

    document.getElementById('ord-prev').onclick = function () { if (ORD.page > 1) { ORD.page--; ordPaint(); } };
    document.getElementById('ord-next').onclick = function () { if (ORD.page < pages) { ORD.page++; ordPaint(); } };
    list.querySelector('tbody').addEventListener('click', function (e) {
      var tr = e.target.closest('tr');
      if (tr && tr.getAttribute('data-i') != null) ordOpen(pageRows[Number(tr.getAttribute('data-i'))]);
    });
  }

  async function ordInit() {
    const rows = await evidence.query('orders_list');
    ORD.rows = rows || [];
    ORD.page = 1;
    var customers = [];
    ORD.rows.forEach(function (r) { if (customers.indexOf(r.customer) === -1) customers.push(r.customer); });
    customers.sort();
    var sel = document.getElementById('ord-customer');
    sel.innerHTML = '<option value="all">All customers</option>' +
      customers.map(function (c) { return '<option value="' + ordEsc(c) + '">' + ordEsc(c) + '</option>'; }).join('');
    sel.onchange = function (e) { ORD.customer = e.target.value; ORD.page = 1; ordPaint(); };
    var si = document.getElementById('ord-search');
    si.oninput = function (e) { ORD.search = e.target.value; ORD.page = 1; ordPaint(); };
    ordPaint();
  }
  evidence.subscribe(ordInit);
</script>
{% /html %}
