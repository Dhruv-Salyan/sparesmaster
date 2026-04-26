"use strict";
// ═══════════════════════════════════════════════════════════════════════════
//  SparesMaster — Frontend Application
//  Stack: Vanilla TypeScript (compiled to JS)
//  API: connects to Node/Express/SQLite backend on /api/items
// ═══════════════════════════════════════════════════════════════════════════
// ── Config ───────────────────────────────────────────────────────────────────
const API_BASE = 'https://sparesmaster.onrender.com/api';
// ── State ────────────────────────────────────────────────────────────────────
let allItems = [];
let filteredItems = [];
let currentPage = 'dashboard';
let sortField = 'name';
let sortOrder = 'asc';
let editingId = null;
// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
    const res = await fetch(`${API_BASE}${path}`, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
    const json = await res.json();
    if (!res.ok)
        throw new Error(json.message || `HTTP ${res.status}`);
    return json;
}
// ── Data loading ──────────────────────────────────────────────────────────────
async function loadAll() {
    var _a, _b;
    try {
        const [itemsRes, summaryRes] = await Promise.all([
            apiFetch('/items'),
            apiFetch('/items/summary'),
        ]);
        allItems = (_a = itemsRes.data) !== null && _a !== void 0 ? _a : [];
        filteredItems = [...allItems];
        setApiStatus(true);
        renderStats(summaryRes.data);
        renderInventoryTable();
        renderDashboard();
        renderReports();
        populateFilters((_b = itemsRes.categories) !== null && _b !== void 0 ? _b : []);
        updateNavBadge();
    }
    catch (e) {
        setApiStatus(false);
        toast('Cannot reach backend. Make sure the server is running.', 'error');
        renderStatsError();
    }
}
// ── Render: Stats Cards ───────────────────────────────────────────────────────
function renderStats(s) {
    if (!s) {
        renderStatsError();
        return;
    }
    animateNumber('stat-total', s.total);
    animateNumber('stat-instock', s.inStock);
    animateNumber('stat-lowstock', s.lowStock);
    animateNumber('stat-out', s.outOfStock);
    setText('stat-value', `₹${s.totalValue.toLocaleString('en-IN')}`);
}
function renderStatsError() {
    ['stat-total', 'stat-instock', 'stat-lowstock', 'stat-out'].forEach(id => setText(id, '—'));
    setText('stat-value', '₹—');
}
// ── Render: Dashboard ─────────────────────────────────────────────────────────
function renderDashboard() {
    const alertItems = allItems
        .filter(i => i.quantity < i.minLevel)
        .sort((a, b) => a.quantity - b.quantity);
    const alertsEl = $('alerts-list');
    if (!alertItems.length) {
        alertsEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon('check-circle', 24, '#10b981')}</div>
        <p class="empty-title" style="color:var(--green)">All stocked up!</p>
        <p class="empty-sub">No items are below minimum level.</p>
      </div>`;
    }
    else {
        alertsEl.innerHTML = alertItems.map(i => `
      <div class="alert-row">
        <div>
          <p class="alert-name">${esc(i.name)}</p>
          <p class="alert-meta">${esc(i.category)} · ${esc(i.location || '—')}</p>
        </div>
        <div style="text-align:right">
          <div class="alert-qty" style="color:${i.quantity === 0 ? 'var(--red)' : 'var(--amber)'}">${i.quantity}</div>
          <div class="alert-qty-sub">min ${i.minLevel} ${esc(i.unit)}</div>
        </div>
      </div>`).join('');
    }
    // Category chart
    const cats = {};
    allItems.forEach(i => { cats[i.category] = (cats[i.category] || 0) + i.quantity; });
    const maxQ = Math.max(...Object.values(cats), 1);
    const catEl = $('category-chart');
    catEl.innerHTML = Object.entries(cats)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, qty]) => `
      <div class="cat-bar-row">
        <div class="cat-bar-label">
          <span>${esc(cat)}</span>
          <span>${qty} units</span>
        </div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${Math.round(qty / maxQ * 100)}%"></div>
        </div>
      </div>`).join('');
    // Recent items
    const recent = [...allItems]
        .sort((a, b) => { var _a, _b; return ((_a = b.updatedAt) !== null && _a !== void 0 ? _a : '').localeCompare((_b = a.updatedAt) !== null && _b !== void 0 ? _b : ''); })
        .slice(0, 6);
    const recentEl = $('recent-tbody');
    recentEl.innerHTML = recent.map(i => `
    <tr>
      <td>
        <div class="td-name">${esc(i.name)}</div>
        <div class="td-sub">${esc(i.partNumber || '—')}</div>
      </td>
      <td><span style="font-size:12px;color:var(--text-muted)">${esc(i.category)}</span></td>
      <td class="td-mono" style="color:${qtyColor(i)}">${i.quantity} <span style="font-size:10px;opacity:.6">${esc(i.unit)}</span></td>
      <td>${statusBadge(i.status)}</td>
      <td class="td-mono" style="font-size:11px;color:var(--text-muted)">${formatDate(i.updatedAt)}</td>
    </tr>`).join('');
}
// ── Render: Inventory Table ───────────────────────────────────────────────────
function renderInventoryTable() {
    applyFiltersAndSort();
    const tbody = $('inv-tbody');
    setText('inv-count', `${filteredItems.length} items`);
    if (!filteredItems.length) {
        tbody.innerHTML = `
      <tr><td colspan="10">
        <div class="empty-state">
          <div class="empty-icon">${icon('package', 28)}</div>
          <p class="empty-title">No items found</p>
          <p class="empty-sub">Try adjusting your search or filters.</p>
        </div>
      </td></tr>`;
        return;
    }
    tbody.innerHTML = filteredItems.map((item, idx) => `
    <tr data-id="${item.id}">
      <td class="td-mono" style="color:var(--text-muted);font-size:11px">${String(idx + 1).padStart(2, '0')}</td>
      <td>
        <div class="td-name">${esc(item.name)}</div>
        <div class="td-sub">${esc(item.partNumber || '—')}</div>
      </td>
      <td><span style="font-size:12px;color:var(--text-secondary);font-family:var(--font-mono)">${esc(item.category)}</span></td>
      <td class="td-mono" style="font-size:11px;color:var(--text-muted)">${esc(item.location || '—')}</td>
      <td>
        <span class="td-qty" style="color:${qtyColor(item)}">${item.quantity}</span>
        <span style="font-size:11px;color:var(--text-muted);margin-left:3px">${esc(item.unit)}</span>
      </td>
      <td class="td-mono" style="font-size:12px;color:var(--text-muted)">${item.minLevel}</td>
      <td class="td-mono" style="font-size:12px;color:var(--text-secondary)">₹${item.unitCost.toLocaleString('en-IN')}</td>
      <td class="td-mono" style="font-size:11px;color:var(--text-muted)">${esc(item.supplier || '—')}</td>
      <td>${statusBadge(item.status)}</td>
      <td>
        <div class="action-cell">
          <button class="action-btn edit"   data-action="open-edit" data-id="${item.id}" title="Edit">${icon('edit-2', 13)}</button>
          <button class="action-btn delete" data-action="delete-item" data-id="${item.id}" data-name="${esc(item.name)}" title="Delete">${icon('trash-2', 13)}</button>
        </div>
      </td>
    </tr>`).join('');
}
function applyFiltersAndSort() {
    var _a, _b, _c;
    const q = (((_a = $('inv-search')) === null || _a === void 0 ? void 0 : _a.value) || '').toLowerCase();
    const cat = ((_b = $('inv-category')) === null || _b === void 0 ? void 0 : _b.value) || '';
    const status = ((_c = $('inv-status')) === null || _c === void 0 ? void 0 : _c.value) || '';
    filteredItems = allItems.filter(i => {
        const matchQ = !q || i.name.toLowerCase().includes(q) || (i.partNumber || '').toLowerCase().includes(q) || (i.location || '').toLowerCase().includes(q) || (i.supplier || '').toLowerCase().includes(q);
        const matchCat = !cat || i.category === cat;
        const matchSt = !status || i.status === status;
        return matchQ && matchCat && matchSt;
    });
    filteredItems.sort((a, b) => {
        var _a, _b;
        let va = (_a = a[sortField]) !== null && _a !== void 0 ? _a : '';
        let vb = (_b = b[sortField]) !== null && _b !== void 0 ? _b : '';
        if (typeof va === 'string')
            va = va.toLowerCase();
        if (typeof vb === 'string')
            vb = vb.toLowerCase();
        const dir = sortOrder === 'asc' ? 1 : -1;
        return va < vb ? -dir : va > vb ? dir : 0;
    });
    // Update sort headers
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sort-active');
        th.querySelector('.sort-icon').textContent = '↕';
    });
    const activeHeader = document.querySelector(`th[data-sort="${sortField}"]`);
    if (activeHeader) {
        activeHeader.classList.add('sort-active');
        activeHeader.querySelector('.sort-icon').textContent = sortOrder === 'asc' ? '↑' : '↓';
    }
}
function setSort(field) {
    if (sortField === field) {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }
    else {
        sortField = field;
        sortOrder = 'asc';
    }
    renderInventoryTable();
}
function filterInventory() { renderInventoryTable(); }
function clearFilters() {
    $('inv-search').value = '';
    $('inv-category').value = '';
    $('inv-status').value = '';
    renderInventoryTable();
}
function populateFilters(categories) {
    const sel = $('inv-category');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All Categories</option>' +
        categories.map(c => `<option value="${esc(c)}"${c === cur ? ' selected' : ''}>${esc(c)}</option>`).join('');
}
// ── Render: Reports ───────────────────────────────────────────────────────────
function renderReports() {
    const items = allItems;
    if (!items.length)
        return;
    const totalVal = items.reduce((s, i) => s + i.quantity * (i.unitCost || 0), 0);
    const reorder = items.filter(i => i.quantity < i.minLevel).length;
    const cats = new Set(items.map(i => i.category)).size;
    const inS = items.filter(i => i.status === 'in_stock').length;
    const low = items.filter(i => i.status === 'low_stock').length;
    const out = items.filter(i => i.status === 'out_of_stock').length;
    const total = items.length;
    setText('rpt-value', `₹${totalVal.toLocaleString('en-IN')}`);
    setText('rpt-reorder', String(reorder));
    setText('rpt-categories', String(cats));
    const pI = Math.round(inS / total * 100);
    const pL = Math.round(low / total * 100);
    const pO = 100 - pI - pL;
    setText('bar-label-in', `${pI}%`);
    setText('bar-label-low', `${pL}%`);
    setText('bar-label-out', `${pO}%`);
    const hb = $('health-bar');
    hb.innerHTML = `
    <div class="health-seg" style="width:${pI}%;background:var(--green)">${pI > 10 ? pI + '%' : ''}</div>
    <div class="health-seg" style="width:${pL}%;background:var(--amber)">${pL > 10 ? pL + '%' : ''}</div>
    <div class="health-seg" style="width:${pO}%;background:var(--red)">${pO > 10 ? pO + '%' : ''}</div>`;
    // Category value table
    const catMap = {};
    items.forEach(i => {
        if (!catMap[i.category])
            catMap[i.category] = { n: 0, qty: 0, val: 0, alert: false };
        catMap[i.category].n++;
        catMap[i.category].qty += i.quantity;
        catMap[i.category].val += i.quantity * (i.unitCost || 0);
        if (i.status !== 'in_stock')
            catMap[i.category].alert = true;
    });
    const rptTbody = $('rpt-tbody');
    rptTbody.innerHTML = Object.entries(catMap)
        .sort((a, b) => b[1].val - a[1].val)
        .map(([cat, d]) => `
      <tr>
        <td><span style="font-weight:600;font-size:13px">${esc(cat)}</span></td>
        <td class="td-mono" style="font-size:12px;color:var(--text-muted)">${d.n}</td>
        <td class="td-mono" style="font-size:12px;color:var(--text-muted)">${d.qty}</td>
        <td class="td-mono" style="font-size:12px;color:var(--amber)">₹${d.val.toLocaleString('en-IN')}</td>
        <td>${d.alert
        ? '<span class="badge badge-amber">⚠ Action Needed</span>'
        : '<span class="badge badge-green">✓ OK</span>'}</td>
      </tr>`).join('');
    // Reorder list
    const ri = items.filter(i => i.quantity < i.minLevel);
    const reorderTbody = $('reorder-tbody');
    reorderTbody.innerHTML = ri.length
        ? ri.map(i => `
        <tr>
          <td>
            <div style="font-weight:600;font-size:13px">${esc(i.name)}</div>
            <div class="td-sub">${esc(i.partNumber || '—')}</div>
          </td>
          <td class="td-mono" style="color:${i.quantity === 0 ? 'var(--red)' : 'var(--amber)'}">${i.quantity} ${esc(i.unit)}</td>
          <td class="td-mono" style="font-size:12px;color:var(--text-muted)">${i.minLevel}</td>
          <td class="td-mono" style="color:var(--amber)">${i.reorderQty || 10}</td>
          <td style="font-size:12px;color:var(--text-muted)">${esc(i.supplier || '—')}</td>
          <td class="td-mono" style="font-size:12px">₹${((i.reorderQty || 10) * (i.unitCost || 0)).toLocaleString('en-IN')}</td>
        </tr>`).join('')
        : `<tr><td colspan="6">
        <div class="empty-state">
          <div class="empty-icon">${icon('check-circle', 24, '#10b981')}</div>
          <p class="empty-title" style="color:var(--green)">No reorders needed</p>
        </div>
       </td></tr>`;
}
// ── CRUD: Add Item ────────────────────────────────────────────────────────────
async function submitAddForm(e) {
    e.preventDefault();
    hideError('add-error');
    const payload = buildFormPayload('f');
    if (!payload)
        return;
    const btn = $('add-submit-btn');
    setLoading(btn, true, 'Adding...');
    try {
        await apiFetch('/items', { method: 'POST', body: JSON.stringify(payload) });
        $('add-form').reset();
        await loadAll();
        toast(`"${payload.name}" added to inventory`, 'success');
        _navigateInternal('inventory');
    }
    catch (err) {
        showError('add-error', err.message);
        toast('Failed to add item', 'error');
    }
    finally {
        setLoading(btn, false, 'Add to Inventory');
    }
}
// ── CRUD: Edit Item ───────────────────────────────────────────────────────────
function openEditModal(id) {
    const item = allItems.find(i => i.id === id);
    if (!item)
        return;
    editingId = id;
    const fields = ['name', 'partNumber', 'category', 'quantity', 'minLevel', 'reorderQty', 'unit', 'unitCost', 'location', 'supplier'];
    fields.forEach(f => {
        var _a;
        const el = $(`e-${f}`);
        if (el)
            el.value = String((_a = item[f]) !== null && _a !== void 0 ? _a : '');
    });
    hideError('edit-error');
    $('edit-modal').classList.add('open');
}
function closeEditModal() {
    $('edit-modal').classList.remove('open');
    editingId = null;
}
async function submitEditForm(e) {
    e.preventDefault();
    if (!editingId)
        return;
    hideError('edit-error');
    const payload = buildFormPayload('e');
    if (!payload)
        return;
    const btn = $('edit-submit-btn');
    setLoading(btn, true, 'Saving...');
    try {
        await apiFetch(`/items/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        closeEditModal();
        await loadAll();
        toast(`"${payload.name}" updated`, 'success');
    }
    catch (err) {
        showError('edit-error', err.message);
    }
    finally {
        setLoading(btn, false, 'Save Changes');
    }
}
// ── CRUD: Delete ─────────────────────────────────────────────────────────────
async function deleteItem(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`))
        return;
    try {
        await apiFetch(`/items/${id}`, { method: 'DELETE' });
        await loadAll();
        toast(`"${name}" deleted`, 'warning');
    }
    catch (err) {
        toast(`Delete failed: ${err.message}`, 'error');
    }
}
// ── Form payload builder ──────────────────────────────────────────────────────
function buildFormPayload(prefix) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const name = (_a = $(prefix + '-name')) === null || _a === void 0 ? void 0 : _a.value.trim();
    const qty = (_b = $(prefix + '-quantity')) === null || _b === void 0 ? void 0 : _b.value;
    const minLvl = (_c = $(prefix + '-minLevel')) === null || _c === void 0 ? void 0 : _c.value;
    if (!name) {
        toast('Part name is required', 'warning');
        return null;
    }
    if (isNaN(Number(qty)) || Number(qty) < 0) {
        toast('Quantity must be 0 or greater', 'warning');
        return null;
    }
    if (isNaN(Number(minLvl)) || Number(minLvl) < 0) {
        toast('Min level must be 0 or greater', 'warning');
        return null;
    }
    return {
        name,
        partNumber: ((_d = $(prefix + '-partNumber')) === null || _d === void 0 ? void 0 : _d.value.trim()) || '',
        category: ((_e = $(prefix + '-category')) === null || _e === void 0 ? void 0 : _e.value.trim()) || 'General',
        quantity: Number(qty),
        minLevel: Number(minLvl),
        reorderQty: Number((_f = $(prefix + '-reorderQty')) === null || _f === void 0 ? void 0 : _f.value) || 10,
        unit: ((_g = $(prefix + '-unit')) === null || _g === void 0 ? void 0 : _g.value.trim()) || 'pcs',
        unitCost: Number((_h = $(prefix + '-unitCost')) === null || _h === void 0 ? void 0 : _h.value) || 0,
        location: ((_j = $(prefix + '-location')) === null || _j === void 0 ? void 0 : _j.value.trim()) || '',
        supplier: ((_k = $(prefix + '-supplier')) === null || _k === void 0 ? void 0 : _k.value.trim()) || '',
    };
}
// ── Navigation ────────────────────────────────────────────────────────────────
const PAGE_META = {
    'dashboard': { title: 'Dashboard', sub: 'Inventory overview & alerts' },
    'inventory': { title: 'Inventory', sub: 'Full register with search & filter' },
    'add-item': { title: 'Add Item', sub: 'Register a new spare part' },
    'reports': { title: 'Reports', sub: 'Analytics, value & reorder list' },
    'optimize': { title: 'Optimization', sub: 'Reorder suggestions, criticality ranking & demand' },
};
function _navigateInternal(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const page = $('page-' + pageId);
    if (page)
        page.classList.add('active');
    const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (navItem)
        navItem.classList.add('active');
    const meta = PAGE_META[pageId];
    setText('topbar-title', (meta === null || meta === void 0 ? void 0 : meta.title) || pageId);
    setText('topbar-sub', (meta === null || meta === void 0 ? void 0 : meta.sub) || '');
    currentPage = pageId;
    if (pageId === 'reports')
        renderReports();
    if (pageId === 'inventory')
        renderInventoryTable();
}
// ── Refresh ───────────────────────────────────────────────────────────────────
async function refreshAll() {
    const btn = $('refresh-btn');
    btn.classList.add('spinning');
    await loadAll();
    setTimeout(() => btn.classList.remove('spinning'), 700);
    toast('Data refreshed', 'info');
}
// ── Settings: test connection ─────────────────────────────────────────────────
async function testConnection() {
    const urlEl = $('settings-url');
    const resEl = $('conn-result');
    const url = urlEl.value.trim();
    resEl.style.display = 'block';
    resEl.style.color = 'var(--text-muted)';
    resEl.textContent = 'Testing connection...';
    try {
        const r = await fetch(`${url}/health`);
        const d = await r.json();
        resEl.style.color = 'var(--green)';
        resEl.textContent = `✓ Connected — ${d.message || 'API is running'}`;
    }
    catch (_a) {
        resEl.style.color = 'var(--red)';
        resEl.textContent = '✕ Connection failed — is the backend running?';
    }
}
// ── API Status ────────────────────────────────────────────────────────────────
function setApiStatus(ok) {
    const dot = $('api-dot');
    const text = $('api-status-text');
    dot.className = `status-dot ${ok ? 'online' : 'offline'}`;
    text.textContent = ok ? 'API Connected' : 'API Offline';
}
function updateNavBadge() {
    const count = allItems.filter(i => i.quantity < i.minLevel).length;
    const badge = $('nav-badge');
    badge.style.display = count > 0 ? 'inline' : 'none';
    badge.textContent = String(count);
}
// ── Toast Notifications ───────────────────────────────────────────────────────
function toast(message, type = 'info') {
    const container = $('toast-container');
    const icons = {
        success: icon('check-circle', 16),
        error: icon('x-circle', 16),
        warning: icon('alert-triangle', 16),
        info: icon('info', 16),
    };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <span class="toast-msg">${esc(message)}</span>
    <span class="toast-dismiss" data-action="dismiss-toast">${icon('x', 14)}</span>`;
    container.appendChild(el);
    setTimeout(() => {
        el.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => el.remove(), 300);
    }, 3500);
}
// ── UI Utilities ──────────────────────────────────────────────────────────────
function $(id) {
    return document.getElementById(id);
}
function setText(id, val) {
    const el = $(id);
    if (el)
        el.textContent = val;
}
function esc(s) {
    return String(s !== null && s !== void 0 ? s : '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function qtyColor(i) {
    if (i.quantity === 0)
        return 'var(--red)';
    if (i.quantity < i.minLevel)
        return 'var(--amber)';
    return 'var(--green)';
}
function formatDate(iso) {
    if (!iso)
        return '—';
    return iso.substring(0, 10);
}
function showError(id, msg) {
    const el = $(id);
    if (el) {
        el.textContent = msg;
        el.classList.add('visible');
    }
}
function hideError(id) {
    const el = $(id);
    if (el)
        el.classList.remove('visible');
}
function setLoading(btn, loading, label) {
    btn.disabled = loading;
    btn.textContent = label;
}
function animateNumber(id, target) {
    const el = $(id);
    if (!el)
        return;
    const start = 0;
    const duration = 600;
    const startTime = performance.now();
    function step(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
        el.textContent = String(Math.round(start + (target - start) * ease));
        if (progress < 1)
            requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}
// ── SVG Icon helper ───────────────────────────────────────────────────────────
// Inline Lucide-style icons (no dependency needed)
function icon(name, size = 16, color = 'currentColor') {
    const paths = {
        'package': '<path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/>',
        'home': '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
        'list': '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
        'plus-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
        'bar-chart': '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
        'settings': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        'refresh-cw': '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
        'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
        'x-circle': '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
        'info': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
        'edit-2': '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
        'trash-2': '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
        'x': '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
        'grid': '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
        'truck': '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
        'database': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    };
    const d = paths[name] || paths['package'];
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}
// ── Status Badge ──────────────────────────────────────────────────────────────
function statusBadge(status) {
    const cfg = {
        in_stock: { cls: 'badge-green', dot: 'var(--green)', label: 'In Stock' },
        low_stock: { cls: 'badge-amber', dot: 'var(--amber)', label: 'Low Stock' },
        out_of_stock: { cls: 'badge-red', dot: 'var(--red)', label: 'Out of Stock' },
    };
    const c = cfg[status] || cfg.in_stock;
    return `<span class="badge ${c.cls}"><span class="badge-dot" style="background:${c.dot}"></span>${c.label}</span>`;
}
// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    _navigateInternal('dashboard');
    loadAll().then(() => loadWarningsBanner());
});
// Expose to HTML event handlers
window.navigate = function (pageId) {
    _navigateInternal(pageId);
    if (pageId === 'optimize')
        loadOptimization();
};
window.refreshAll = async function () {
    const btn = $('refresh-btn');
    if (btn)
        btn.classList.add('spinning');
    await loadAll();
    await loadWarningsBanner();
    if (btn)
        setTimeout(() => btn.classList.remove('spinning'), 700);
    toast('Data refreshed', 'info');
};
window.filterInventory = filterInventory;
window.clearFilters = clearFilters;
window.setSort = setSort;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.deleteItem = deleteItem;
window.submitAddForm = submitAddForm;
window.submitEditForm = submitEditForm;
window.testConnection = testConnection;
// ── Load & render full optimization report ────────────────────────────────
async function loadOptimization() {
    try {
        const res = await apiFetch('/optimize');
        const report = res.data;
        // Summary cards
        setText('opt-reorder-count', String(report.summary.itemsNeedingReorder));
        setText('opt-critical-count', String(report.summary.criticalItems));
        setText('opt-cost', `₹${report.summary.estimatedReorderCost.toLocaleString('en-IN')}`);
        setText('opt-warn-count', String(report.summary.totalWarnings));
        // Update nav badge
        const badge = $('opt-badge');
        if (report.summary.criticalItems > 0) {
            badge.style.display = 'inline';
            badge.textContent = String(report.summary.criticalItems);
        }
        else {
            badge.style.display = 'none';
        }
        renderReorderSuggestions(report.reorderSuggestions);
        renderCriticalityRanking(report.criticalityRanking);
        renderDemandEstimates(report.demandEstimates);
        renderWarningsDetail(report.dashboardWarnings);
        renderDashboardWarningsBanner(report.dashboardWarnings);
    }
    catch (e) {
        toast('Could not load optimization data', 'error');
    }
}
// ── Feature 1+2: Reorder Suggestions table ────────────────────────────────
function renderReorderSuggestions(suggestions) {
    const tbody = $('reorder-suggestions-tbody');
    if (!suggestions.length) {
        tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <div class="empty-icon">${icon('check-circle', 24, '#10b981')}</div>
        <p class="empty-title" style="color:var(--green)">All items above minimum level</p>
        <p class="empty-sub">No reorders needed right now.</p>
      </div></td></tr>`;
        return;
    }
    const urgencyStyle = {
        critical: 'background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.3)',
        high: 'background:rgba(220,20,60,.12);color:#DC143C;border:1px solid rgba(220,20,60,.3)',
        medium: 'background:rgba(99,102,241,.12);color:#1d4ed8;border:1px solid rgba(99,102,241,.3)',
    };
    tbody.innerHTML = suggestions.map(s => `
    <tr>
      <td>
        <div class="td-name">${esc(s.name)}</div>
        <div class="td-sub">${esc(s.partNumber)} · ${esc(s.supplier || '—')}</div>
      </td>
      <td class="td-mono" style="color:${s.currentQty === 0 ? 'var(--red)' : 'var(--amber)'}; font-weight:700">
        ${s.currentQty} <span style="font-size:10px;opacity:.7">${esc(s.unit)}</span>
      </td>
      <td class="td-mono" style="color:var(--text-muted)">${s.minLevel}</td>
      <td class="td-mono" style="color:var(--red);font-weight:700">−${s.deficit}</td>
      <td>
        <span style="font-family:var(--font-mono);font-weight:800;font-size:16px;color:var(--green)">
          ${s.suggestedQty}
        </span>
        <span style="font-size:11px;color:var(--text-muted);margin-left:3px">${esc(s.unit)}</span>
      </td>
      <td class="td-mono" style="color:#8b5cf6;font-weight:600">
        ₹${s.estimatedCost.toLocaleString('en-IN')}
      </td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:5px;font-size:11px;font-weight:700;${urgencyStyle[s.urgency]}">
          ${s.urgency.toUpperCase()}
        </span>
      </td>
      <td style="font-size:11px;color:var(--text-muted);max-width:200px;white-space:normal">${esc(s.reason)}</td>
    </tr>`).join('');
}
// ── Feature 3: Status labels are already in statusBadge() ────────────────
// (already defined above — in_stock / low_stock / out_of_stock)
// ── Feature 4: Criticality Ranking ───────────────────────────────────────
function renderCriticalityRanking(ranking) {
    const tbody = $('ranking-tbody');
    if (!ranking.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--text-muted)">No data</td></tr>';
        return;
    }
    const labelStyle = {
        Critical: 'color:#ef4444;background:rgba(239,68,68,.1)',
        High: 'color:#DC143C;background:rgba(220,20,60,.1)',
        Medium: 'color:#1d4ed8;background:rgba(99,102,241,.1)',
        Low: 'color:var(--green);background:var(--green-dim)',
    };
    tbody.innerHTML = ranking.map(r => {
        const bar = Math.round((r.score / 100) * 100);
        const col = r.score >= 70 ? '#ef4444' : r.score >= 40 ? '#DC143C' : r.score >= 15 ? '#1d4ed8' : '#10b981';
        return `
      <tr>
        <td class="td-mono" style="font-size:14px;font-weight:700;color:${col}">#${r.rank}</td>
        <td>
          <div class="td-name">${esc(r.name)}</div>
          <div class="td-sub">${esc(r.category)}</div>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;height:6px;background:var(--border);border-radius:99px;overflow:hidden">
              <div style="height:6px;width:${bar}%;background:${col};border-radius:99px;transition:width .6s"></div>
            </div>
            <span class="td-mono" style="font-size:12px;font-weight:700;color:${col}">${r.score}</span>
          </div>
        </td>
        <td>
          <span style="display:inline-flex;padding:3px 10px;border-radius:5px;font-size:11px;font-weight:700;${labelStyle[r.label] || ''}">
            ${r.label}
          </span>
        </td>
        <td>${statusBadge(r.status)}</td>
      </tr>`;
    }).join('');
}
// ── Feature 5: Demand Estimation ─────────────────────────────────────────
function renderDemandEstimates(estimates) {
    const tbody = $('demand-tbody');
    if (!estimates.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;text-align:center;color:var(--text-muted)">No data</td></tr>';
        return;
    }
    const trendIcon = {
        fast: '🔴 Fast',
        moderate: '🟡 Moderate',
        slow: '🟢 Slow',
    };
    tbody.innerHTML = estimates.map(e => {
        const daysCol = e.daysToStockout === null
            ? '<span style="color:var(--text-muted)">—</span>'
            : e.daysToStockout <= 7
                ? `<span style="color:var(--red);font-weight:700">${e.daysToStockout}d ⚠</span>`
                : e.daysToStockout <= 30
                    ? `<span style="color:var(--amber);font-weight:600">${e.daysToStockout}d</span>`
                    : `<span style="color:var(--green)">${e.daysToStockout}d</span>`;
        const orderCol = e.orderByDate
            ? (new Date(e.orderByDate) <= new Date()
                ? `<span style="color:var(--red);font-weight:700">${e.orderByDate} !</span>`
                : `<span style="color:var(--text-secondary);font-size:11px">${e.orderByDate}</span>`)
            : '<span style="color:var(--text-muted)">—</span>';
        return `
      <tr title="${esc(e.note)}">
        <td>
          <div class="td-name">${esc(e.name)}</div>
          <div class="td-sub">${esc(e.category)}</div>
        </td>
        <td class="td-mono" style="font-size:12px;color:var(--text-secondary)">${e.avgDailyUsage}</td>
        <td class="td-mono" style="font-size:12px;color:var(--text-secondary)">${e.avgMonthlyUsage} <span style="font-size:10px;opacity:.6">${esc(e.unit)}</span></td>
        <td>${daysCol}</td>
        <td>${orderCol}</td>
        <td style="font-size:11px">${trendIcon[e.trend] || e.trend}</td>
      </tr>`;
    }).join('');
}
// ── Feature 6a: Warnings — dashboard banner (shown on Dashboard page) ─────
function renderDashboardWarningsBanner(warnings) {
    const banner = $('warnings-banner');
    if (!banner)
        return;
    const { critical, warning } = warnings;
    const all = [...critical, ...warning];
    if (!all.length) {
        banner.style.display = 'none';
        return;
    }
    banner.style.display = 'block';
    const isCritical = critical.length > 0;
    banner.innerHTML = `
    <div style="background:${isCritical ? 'rgba(239,68,68,.06)' : 'rgba(220,20,60,.06)'};
                border:1px solid ${isCritical ? 'rgba(239,68,68,.25)' : 'rgba(220,20,60,.25)'};
                border-left:4px solid ${isCritical ? '#ef4444' : '#DC143C'};
                border-radius:var(--radius-lg);padding:16px 20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${all.length > 1 ? '12px' : '0'}">
        <div style="display:flex;align-items:center;gap:10px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${isCritical ? '#ef4444' : '#DC143C'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <strong style="font-size:13px;color:var(--text-primary)">
            ${critical.length > 0 ? `${critical.length} critical alert${critical.length > 1 ? 's' : ''}` : ''}
            ${critical.length > 0 && warning.length > 0 ? ' + ' : ''}
            ${warning.length > 0 ? `${warning.length} warning${warning.length > 1 ? 's' : ''}` : ''}
          </strong>
        </div>
        <button class="btn btn-ghost btn-sm" data-action="navigate" data-page="optimize">
          View Optimization →
        </button>
      </div>
      ${all.slice(0, 3).map(w => `
        <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-top:1px solid ${isCritical ? 'rgba(239,68,68,.1)' : 'rgba(220,20,60,.1)'}">
          <span style="font-size:12px;font-weight:600;color:${critical.includes(w) ? '#ef4444' : '#DC143C'};flex-shrink:0;padding-top:1px">
            ${critical.includes(w) ? '●' : '◐'}
          </span>
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${esc(w.title)}</div>
            <div style="font-size:11px;color:var(--text-muted)">${esc(w.action)}</div>
          </div>
        </div>`).join('')}
      ${all.length > 3 ? `<div style="font-size:11px;color:var(--text-muted);padding-top:8px;border-top:1px solid rgba(0,0,0,.06)">
        +${all.length - 3} more — <a href="#" data-action="navigate" data-page="optimize" style="color:#1d4ed8">view all on Optimize page</a>
      </div>` : ''}
    </div>`;
}
// ── Feature 6b: Warnings — full detail on Optimize page ──────────────────
function renderWarningsDetail(warnings) {
    const container = $('warnings-detail');
    if (!container)
        return;
    const { critical, warning, info } = warnings;
    if (!critical.length && !warning.length && !info.length) {
        container.innerHTML = `
      <div class="empty-state" style="padding:32px">
        <div class="empty-icon">${icon('check-circle', 28, '#10b981')}</div>
        <p class="empty-title" style="color:var(--green)">No warnings — inventory is healthy</p>
      </div>`;
        return;
    }
    const renderGroup = (items, severity, color, bg) => {
        if (!items.length)
            return '';
        return `
      <div style="margin-bottom:16px;padding:0 20px">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:${color};margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid ${bg}">
          ${severity} (${items.length})
        </div>
        ${items.map(w => `
          <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="width:6px;flex-shrink:0;border-radius:99px;background:${color};align-self:stretch;min-height:40px"></div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${esc(w.title)}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${esc(w.detail)}</div>
              <div style="font-size:11px;color:${color};margin-top:4px;font-weight:500">→ ${esc(w.action)}</div>
            </div>
            ${w.itemId ? `<button class="btn btn-ghost btn-sm" style="flex-shrink:0;align-self:flex-start" data-action="open-edit" data-id="${w.itemId}">Edit</button>` : ''}
          </div>`).join('')}
      </div>`;
    };
    container.innerHTML =
        renderGroup(critical, '🔴 Critical', '#ef4444', 'rgba(239,68,68,.08)') +
            renderGroup(warning, '🟡 Warning', '#DC143C', 'rgba(220,20,60,.08)') +
            renderGroup(info, 'ℹ️ Info', '#1d4ed8', 'rgba(99,102,241,.08)');
}
// ── Optimization wiring ──────────────────────────────────────────────────────
// Expose loadOptimization so the Optimize nav item can call it
window.loadOptimization = loadOptimization;
// Load warnings banner every time all items are refreshed
async function loadWarningsBanner() {
    try {
        const res = await apiFetch('/optimize/warnings');
        renderDashboardWarningsBanner(res.data);
        const badge = $('opt-badge');
        const critCount = res.data.counts.critical;
        if (critCount > 0) {
            badge.style.display = 'inline';
            badge.textContent = String(critCount);
        }
        else
            badge.style.display = 'none';
    }
    catch ( /* non-critical — silently ignore */_a) { /* non-critical — silently ignore */ }
}

// ── CSP-safe: Replace all inline HTML event handlers with addEventListener ───
// This block wires up every data-action attribute used in index.html.
// It runs after DOMContentLoaded so all elements exist.
document.addEventListener('DOMContentLoaded', () => {
    // ── Navigation items (data-action="navigate") ────────────────────────────
    document.querySelectorAll('[data-action="navigate"]').forEach(el => {
        el.addEventListener('click', () => {
            const page = el.getAttribute('data-page');
            if (page) window.navigate(page);
        });
    });

    // ── Refresh button ───────────────────────────────────────────────────────
    document.querySelectorAll('[data-action="refresh"]').forEach(el => {
        el.addEventListener('click', () => window.refreshAll && window.refreshAll());
    });

    // ── Clear filters button ─────────────────────────────────────────────────
    document.querySelectorAll('[data-action="clear-filters"]').forEach(el => {
        el.addEventListener('click', () => window.clearFilters && window.clearFilters());
    });

    // ── Filter dropdowns / search ────────────────────────────────────────────
    document.querySelectorAll('[data-action="filter"]').forEach(el => {
        el.addEventListener('change', () => window.filterInventory && window.filterInventory());
    });
    document.querySelectorAll('[data-action="search"]').forEach(el => {
        el.addEventListener('input', () => window.filterInventory && window.filterInventory());
    });

    // ── Sort column headers ──────────────────────────────────────────────────
    document.querySelectorAll('[data-action="sort"]').forEach(el => {
        el.addEventListener('click', () => {
            const field = el.getAttribute('data-field');
            if (field) window.setSort && window.setSort(field);
        });
    });

    // ── Add item form ────────────────────────────────────────────────────────
    const addForm = document.getElementById('add-form');
    if (addForm) {
        addForm.addEventListener('submit', e => {
            e.preventDefault();
            window.submitAddForm && window.submitAddForm(e);
        });
    }

    // ── Edit item form ───────────────────────────────────────────────────────
    const editForm = document.getElementById('edit-form');
    if (editForm) {
        editForm.addEventListener('submit', e => {
            e.preventDefault();
            window.submitEditForm && window.submitEditForm(e);
        });
    }

    // ── Edit modal overlay (click outside to close) ──────────────────────────
    const modalOverlay = document.getElementById('edit-modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', e => {
            if (e.target === modalOverlay) window.closeEditModal && window.closeEditModal();
        });
    }

    // ── Close modal button ───────────────────────────────────────────────────
    document.querySelectorAll('[data-action="close-modal"]').forEach(el => {
        el.addEventListener('click', () => window.closeEditModal && window.closeEditModal());
    });

    // ── Load optimization ────────────────────────────────────────────────────
    document.querySelectorAll('[data-action="load-optimize"]').forEach(el => {
        el.addEventListener('click', () => window.loadOptimization && window.loadOptimization());
    });

    // ── View low stock shortcut ──────────────────────────────────────────────
    document.querySelectorAll('[data-action="view-low-stock"]').forEach(el => {
        el.addEventListener('click', () => {
            window.navigate && window.navigate('inventory');
            const sel = document.getElementById('inv-status');
            if (sel) { sel.value = 'low_stock'; }
            window.filterInventory && window.filterInventory();
        });
    });
});

// ── Event delegation for dynamically-rendered elements ───────────────────────
// These handle onclick-equivalent events for elements created via innerHTML.
document.addEventListener('click', function(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    const action = el.getAttribute('data-action');

    if (action === 'open-edit') {
        e.preventDefault();
        const id = el.getAttribute('data-id');
        if (id) window.openEditModal && window.openEditModal(id);
    }

    if (action === 'delete-item') {
        e.preventDefault();
        const id = el.getAttribute('data-id');
        const name = el.getAttribute('data-name');
        if (id) window.deleteItem && window.deleteItem(id, name);
    }

    if (action === 'dismiss-toast') {
        const toast = el.closest('.toast');
        if (toast) toast.remove();
        else if (el.parentElement) el.parentElement.remove();
    }

    if (action === 'navigate') {
        e.preventDefault();
        const page = el.getAttribute('data-page');
        if (page) window.navigate && window.navigate(page);
    }
});
