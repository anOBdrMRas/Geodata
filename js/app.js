/* Flurstücks-Inventar – Hauptlogik */
(function () {
  'use strict';

  // ---------- Hilfsfunktionen ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (d) => (d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('de-DE') : '');
  const fmtArea = (m2) => {
    if (!m2) return '–';
    return m2 >= 10000 ? (m2 / 10000).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' ha' : Math.round(m2).toLocaleString('de-DE') + ' m²';
  };
  const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

  const statusOf = (p) => (CONFIG.statuses[p.kategorie] || []).find((s) => s.id === p.status) || { label: p.status || '–', color: '#6b7280' };
  const allStatuses = () => [...CONFIG.statuses.eigen.map((s) => ({ ...s, kat: 'eigen' })), ...CONFIG.statuses.fremd.map((s) => ({ ...s, kat: 'fremd' }))];
  const parcelTitle = (p) => `Flst. ${p.flurstueck || '?'}`;
  const mainContact = (p) => (p.contacts && p.contacts[0] ? p.contacts[0].name : '');

  // localStorage kann in manchen Umgebungen gesperrt sein
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* egal */ } },
  };

  // Eigener Bestätigungsdialog (Browser-Dialoge sind in eingebetteten Seiten oft blockiert)
  function ask(message, { ok = 'OK', cancel = 'Abbrechen', danger = false, title = 'Bitte bestätigen' } = {}) {
    return new Promise((resolve) => {
      const bd = $('#ask-backdrop');
      $('#ask-title').textContent = title;
      $('#ask-text').textContent = message;
      const okBtn = $('#ask-ok'), cancelBtn = $('#ask-cancel');
      okBtn.textContent = ok;
      cancelBtn.textContent = cancel;
      okBtn.classList.toggle('danger-fill', danger);
      bd.classList.remove('hidden');
      okBtn.focus();
      const done = (v) => { bd.classList.add('hidden'); okBtn.onclick = cancelBtn.onclick = bd.onclick = null; document.removeEventListener('keydown', onKey, true); resolve(v); };
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
      document.addEventListener('keydown', onKey, true);
      okBtn.onclick = () => done(true);
      cancelBtn.onclick = () => done(false);
      bd.onclick = (e) => { if (e.target === bd) done(null); };
    });
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('hidden'), 2800);
  }

  // Auf claude.ai laufen Downloads über die freigegebene Funktion „downloads“, sonst über einen normalen Link
  let claudeDownloads;
  async function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    if (window.claude && window.claude.use) {
      if (claudeDownloads === undefined) claudeDownloads = await window.claude.use('downloads').catch(() => null);
      if (claudeDownloads) {
        try { await claudeDownloads.save({ filename: name, data: blob }); }
        catch (err) {
          if (err && err.code === 'rejected_extension') toast('Dieser Dateityp kann hier nicht heruntergeladen werden.');
          else if (err && err.code !== 'declined') toast('Download nicht möglich.');
        }
        return;
      }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function centroid(geom) {
    const ring = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
    let x = 0, y = 0;
    const n = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.length - 1 : ring.length;
    for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
    return { lon: x / n, lat: y / n };
  }

  function bayernAtlasUrl(lat, lon) {
    const u = UTM.toUtm(lat, lon, 32);
    return `https://atlas.bayern.de/?c=${Math.round(u.e)},${Math.round(u.n)}&z=18&r=0&l=luftbild_parz&t=ba`;
  }

  // ---------- Zustand ----------
  const state = {
    parcels: [],
    comments: [],
    documents: [],
    selectedId: null,
    drawerTab: 'overview',
    view: 'map',
    sort: { key: 'flurstueck', dir: 1 },
  };
  const commentsOf = (id) => state.comments.filter((c) => c.parcelId === id).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const docsOf = (id) => state.documents.filter((d) => d.parcelId === id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const openFollowUp = (id) => commentsOf(id).filter((c) => c.followUp && !c.followUpDone).sort((a, b) => a.followUp.localeCompare(b.followUp))[0];
  const getParcel = (id) => state.parcels.find((p) => p.id === id);

  async function loadAll() {
    const [parcels, comments, documents] = await Promise.all([DB.getAll('parcels'), DB.getAll('comments'), DB.getAll('documents')]);
    state.parcels = parcels;
    state.comments = comments;
    state.documents = documents;
  }

  async function seedDemo() {
    const demo = buildDemoData();
    await DB.clearAll();
    await DB.putMany('parcels', demo.parcels);
    await DB.putMany('comments', demo.comments);
    await DB.putMany('documents', demo.documents.map(({ blob, ...meta }) => meta));
    await DB.putMany('blobs', demo.documents.map((d) => ({ id: d.id, blob: d.blob })));
    store.set('fi-seeded', '1');
  }

  async function saveParcel(p) {
    p.updatedAt = new Date().toISOString();
    await DB.put('parcels', p);
    const i = state.parcels.findIndex((x) => x.id === p.id);
    if (i >= 0) state.parcels[i] = p; else state.parcels.push(p);
  }

  // ---------- Karte ----------
  let map, parcelLayer, layerControl;
  const layerById = new Map();
  const wmsOverlays = [];

  function makeLayer(def) {
    if (def.type === 'wms') {
      return L.tileLayer.wms(def.url, {
        layers: def.layers, format: 'image/png', transparent: true, version: '1.3.0',
        attribution: def.attribution, maxZoom: 21, minZoom: def.minZoom || 0,
      });
    }
    return L.tileLayer(def.url, { attribution: def.attribution, maxZoom: 21, maxNativeZoom: def.maxNativeZoom || 19 });
  }

  function initMap() {
    map = L.map('map', { zoomControl: true, doubleClickZoom: true }).setView([CONFIG.start.lat, CONFIG.start.lon], CONFIG.start.zoom);
    const bases = {};
    CONFIG.baseLayers.forEach((def) => {
      const l = makeLayer(def);
      bases[def.name] = l;
      if (def.default) l.addTo(map);
    });
    const overlays = {};
    CONFIG.overlays.forEach((def) => {
      const l = makeLayer(def);
      overlays[def.name] = l;
      if (def.featureInfo) wmsOverlays.push({ def, layer: l });
      if (def.default) l.addTo(map);
    });
    // Hinweis, wenn Kartendienste nicht laden (z. B. offline oder gesperrt)
    let tileErrors = 0;
    Object.values({ ...bases, ...overlays }).forEach((l) => l.on('tileerror', () => {
      if (++tileErrors === 6) $('#tile-warning').classList.remove('hidden');
    }));
    parcelLayer = L.featureGroup().addTo(map);
    overlays['Erfasste Flurstücke'] = parcelLayer;
    layerControl = L.control.layers(bases, overlays, { collapsed: true, position: 'topright' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

    map.on('zoomend', updateLabelVisibility);
    map.on('click', onMapClick);
    map.on('dblclick', (e) => { if (draw.active) { L.DomEvent.stop(e); finishDraw(); } });
    updateLabelVisibility();
    renderLegend();
  }

  function updateLabelVisibility() {
    $('#map').classList.toggle('hide-labels', map.getZoom() < 16);
  }

  function styleFor(p) {
    const s = statusOf(p);
    const selected = p.id === state.selectedId;
    return {
      color: selected ? '#111827' : s.color,
      weight: selected ? 4 : 2,
      fillColor: s.color,
      fillOpacity: selected ? 0.45 : 0.3,
      dashArray: p.kategorie === 'fremd' ? '6 4' : null,
    };
  }

  function renderMapLayers() {
    parcelLayer.clearLayers();
    layerById.clear();
    state.parcels.forEach((p) => {
      if (!p.geometry) return;
      const layer = L.geoJSON(p.geometry, { style: () => styleFor(p) });
      layer.bindTooltip(esc(p.flurstueck || '?'), { permanent: true, direction: 'center', className: 'parcel-label' });
      layer.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (draw.active) { addDrawPoint(e.latlng); return; }
        selectParcel(p.id);
      });
      layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.5 }));
      layer.on('mouseout', () => layer.setStyle(styleFor(p)));
      layer.addTo(parcelLayer);
      layerById.set(p.id, layer);
    });
  }

  function renderLegend() {
    const row = (s, dashed) => `<div class="legend-row"><span class="swatch${dashed ? ' dashed' : ''}" style="--c:${s.color}"></span>${esc(s.label)}</div>`;
    $('#legend').innerHTML = `
      <div class="legend-title">Eigene Flurstücke</div>${CONFIG.statuses.eigen.map((s) => row(s)).join('')}
      <div class="legend-title">Fremde Flurstücke</div>${CONFIG.statuses.fremd.map((s) => row(s, true)).join('')}`;
  }

  function zoomToParcel(id) {
    const l = layerById.get(id);
    if (!l) { toast('Für dieses Flurstück ist noch keine Fläche eingezeichnet.'); return; }
    switchView('map');
    setTimeout(() => { map.invalidateSize(); map.fitBounds(l.getBounds(), { maxZoom: 18, padding: [40, 40] }); }, 50);
  }

  async function onMapClick(e) {
    if (draw.active) { addDrawPoint(e.latlng); return; }
    const { lat, lng } = e.latlng;
    const u = UTM.toUtm(lat, lng);
    const html = `<div class="popup">
        <div class="muted small">UTM32: ${Math.round(u.e)} / ${Math.round(u.n)}</div>
        <div id="gfi" class="gfi muted small"></div>
        <div class="popup-actions">
          <button class="btn small primary" data-popup="draw">Flurstück hier erfassen</button>
          <a class="btn small ghost" target="_blank" rel="noopener" href="${bayernAtlasUrl(lat, lng)}">Im BayernAtlas öffnen ↗</a>
        </div></div>`;
    const popup = L.popup({ maxWidth: 320 }).setLatLng(e.latlng).setContent(html).openOn(map);
    const el = popup.getElement();
    $('[data-popup="draw"]', el).addEventListener('click', () => { map.closePopup(); startDraw({ onDone: (geom) => openParcelForm(null, geom) }); });
    queryFeatureInfo(e, $('#gfi', el));
  }

  // Versucht die Flurstücksinfo per WMS GetFeatureInfo zu holen. Klappt nur, wenn der Dienst
  // die Abfrage erlaubt und CORS-Header setzt – sonst wird still darauf verzichtet.
  async function queryFeatureInfo(e, target) {
    const entry = wmsOverlays.find((w) => map.hasLayer(w.layer));
    if (!entry || !target) return;
    const size = map.getSize();
    const b = map.getBounds();
    const sw = map.options.crs.project(b.getSouthWest());
    const ne = map.options.crs.project(b.getNorthEast());
    const pt = map.latLngToContainerPoint(e.latlng).round();
    const params = new URLSearchParams({
      SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo', LAYERS: entry.def.layers, QUERY_LAYERS: entry.def.layers,
      STYLES: '', CRS: 'EPSG:3857', BBOX: [sw.x, sw.y, ne.x, ne.y].join(','), WIDTH: size.x, HEIGHT: size.y,
      I: pt.x, J: pt.y, INFO_FORMAT: 'text/html', FEATURE_COUNT: '1',
    });
    target.textContent = 'Frage Flurstücksdaten ab …';
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(entry.def.url + '?' + params, { signal: ctrl.signal });
      clearTimeout(timer);
      const text = await res.text();
      const plain = new DOMParser().parseFromString(text, 'text/html').body.textContent.replace(/\s+/g, ' ').trim();
      if (!res.ok || !plain || /exception/i.test(text.slice(0, 300))) throw new Error('keine Daten');
      target.innerHTML = `<b>Amtliche Info:</b> ${esc(plain.slice(0, 300))}`;
    } catch (_) {
      target.textContent = '';
    }
  }

  // ---------- Zeichnen ----------
  const draw = { active: false, pts: [], line: null, markers: null, onDone: null };

  function startDraw({ onDone }) {
    switchView('map');
    draw.active = true;
    draw.pts = [];
    draw.onDone = onDone;
    draw.markers = L.layerGroup().addTo(map);
    draw.line = L.polygon([], { color: '#111827', weight: 2, dashArray: '4 4', fillOpacity: 0.15, interactive: false }).addTo(map);
    map.doubleClickZoom.disable();
    $('#map').classList.add('drawing');
    $('#draw-bar').classList.remove('hidden');
    hideDrawer();
  }

  function addDrawPoint(latlng) {
    const last = draw.pts[draw.pts.length - 1];
    if (last && map.latLngToContainerPoint(last).distanceTo(map.latLngToContainerPoint(latlng)) < 4) return; // Doppelklick-Duplikat
    draw.pts.push(latlng);
    L.circleMarker(latlng, { radius: 4, color: '#111827', fillColor: '#fff', fillOpacity: 1, weight: 2, interactive: false }).addTo(draw.markers);
    draw.line.setLatLngs(draw.pts);
  }

  function endDraw() {
    draw.active = false;
    if (draw.line) map.removeLayer(draw.line);
    if (draw.markers) map.removeLayer(draw.markers);
    map.doubleClickZoom.enable();
    $('#map').classList.remove('drawing');
    $('#draw-bar').classList.add('hidden');
  }

  function finishDraw() {
    if (draw.pts.length < 3) { toast('Bitte mindestens 3 Eckpunkte setzen.'); return; }
    const ring = draw.pts.map((p) => [Number(p.lng.toFixed(7)), Number(p.lat.toFixed(7))]);
    ring.push(ring[0]);
    const cb = draw.onDone;
    endDraw();
    cb && cb({ type: 'Polygon', coordinates: [ring] });
  }

  // ---------- Ansichten ----------
  function switchView(view) {
    state.view = view;
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view));
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
    if (view === 'map' && map) setTimeout(() => map.invalidateSize(), 30);
  }

  function renderAll() {
    renderMapLayers();
    renderKpis();
    renderList();
    renderFollowups();
    if (state.selectedId) renderDrawer();
  }

  // ---------- Kennzahlen & Liste ----------
  function renderKpis() {
    const own = state.parcels.filter((p) => p.kategorie === 'eigen');
    const foreign = state.parcels.filter((p) => p.kategorie === 'fremd');
    const sum = (arr) => arr.reduce((s, p) => s + (Number(p.flaeche) || 0), 0);
    const nego = foreign.filter((p) => ['verhandlung', 'verkaufsbereit'].includes(p.status));
    const due = dueFollowups().filter((c) => c.followUp <= today()).length;
    $('#kpis').innerHTML = `
      <div class="kpi"><div class="kpi-label">Eigene Flurstücke</div><div class="kpi-value">${own.length}</div><div class="kpi-sub">${fmtArea(sum(own))}</div></div>
      <div class="kpi"><div class="kpi-label">Fremde Flurstücke (erfasst)</div><div class="kpi-value">${foreign.length}</div><div class="kpi-sub">${fmtArea(sum(foreign))}</div></div>
      <div class="kpi"><div class="kpi-label">Verkaufsbereit / in Verhandlung</div><div class="kpi-value">${nego.length}</div><div class="kpi-sub">${fmtArea(sum(nego))}</div></div>
      <div class="kpi ${due ? 'warn' : ''}"><div class="kpi-label">Fällige Wiedervorlagen</div><div class="kpi-value">${due}</div><div class="kpi-sub">bis heute</div></div>`;
  }

  function filteredParcels() {
    const q = $('#list-search').value.trim().toLowerCase();
    const cat = $('#list-cat').value;
    const st = $('#list-status').value;
    return state.parcels.filter((p) => {
      if (cat && p.kategorie !== cat) return false;
      if (st && `${p.kategorie}:${p.status}` !== st) return false;
      if (!q) return true;
      const hay = [p.flurstueck, p.gemarkung, p.lage, p.nutzung, p.notiz, p.grundbuch, statusOf(p).label,
        ...(p.contacts || []).flatMap((c) => [c.name, c.address, c.phone, c.email, c.note]),
        ...commentsOf(p.id).map((c) => c.text)].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  function sortValue(p, key) {
    switch (key) {
      case 'flaeche': return Number(p.flaeche) || 0;
      case 'status': return statusOf(p).label;
      case 'owner': return mainContact(p).toLowerCase();
      case 'docs': return docsOf(p.id).length;
      case 'last': return (commentsOf(p.id)[0] || {}).date || '';
      case 'followup': return (openFollowUp(p.id) || {}).followUp || '9999';
      case 'flurstueck': return (p.flurstueck || '').replace(/\d+/g, (n) => n.padStart(8, '0'));
      default: return String(p[key] || '').toLowerCase();
    }
  }

  function renderList() {
    const statusSel = $('#list-status');
    const cur = statusSel.value;
    const cat = $('#list-cat').value;
    statusSel.innerHTML = '<option value="">Alle Status</option>' + allStatuses().filter((s) => !cat || s.kat === cat)
      .map((s) => `<option value="${s.kat}:${s.id}">${esc((cat ? '' : CONFIG.categories[s.kat].short + ' · ') + s.label)}</option>`).join('');
    statusSel.value = [...statusSel.options].some((o) => o.value === cur) ? cur : '';

    const { key, dir } = state.sort;
    const rows = filteredParcels().sort((a, b) => {
      const x = sortValue(a, key), y = sortValue(b, key);
      return (x > y ? 1 : x < y ? -1 : 0) * dir;
    });
    $$('#parcel-table th').forEach((th) => {
      th.classList.toggle('sorted', th.dataset.sort === key);
      th.dataset.dir = th.dataset.sort === key ? (dir > 0 ? '▲' : '▼') : '';
    });
    $('#list-count').textContent = `${rows.length} von ${state.parcels.length} Flurstücken`;
    const t = today();
    $('#parcel-table tbody').innerHTML = rows.map((p) => {
      const s = statusOf(p);
      const last = commentsOf(p.id)[0];
      const fu = openFollowUp(p.id);
      return `<tr data-id="${esc(p.id)}" class="${p.id === state.selectedId ? 'selected' : ''}">
        <td><b>${esc(p.flurstueck)}</b>${p.lage ? `<div class="muted small">${esc(p.lage)}</div>` : ''}</td>
        <td>${esc(p.gemarkung)}</td>
        <td class="num">${fmtArea(p.flaeche)}</td>
        <td><span class="cat cat-${esc(p.kategorie)}">${esc(CONFIG.categories[p.kategorie]?.short || '')}</span></td>
        <td><span class="status" style="--c:${s.color}">${esc(s.label)}</span></td>
        <td>${esc(p.kategorie === 'eigen' && !mainContact(p) ? 'Kieswerk' : mainContact(p))}</td>
        <td class="num">${docsOf(p.id).length || ''}</td>
        <td>${last ? `${fmtDate(last.date)}<div class="muted small ellipsis">${esc(last.text)}</div>` : ''}</td>
        <td>${fu ? `<span class="${fu.followUp <= t ? 'overdue' : ''}">${fmtDate(fu.followUp)}</span>` : ''}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="9" class="empty">Keine Flurstücke gefunden.</td></tr>';
  }

  // ---------- Wiedervorlagen ----------
  function dueFollowups() {
    return state.comments.filter((c) => c.followUp && !c.followUpDone && getParcel(c.parcelId)).sort((a, b) => a.followUp.localeCompare(b.followUp));
  }

  function renderFollowups() {
    const list = dueFollowups();
    const t = today();
    const due = list.filter((c) => c.followUp <= t).length;
    const badge = $('#followup-badge');
    badge.textContent = due;
    badge.classList.toggle('hidden', !due);
    $('#followup-list').innerHTML = list.length ? list.map((c) => {
      const p = getParcel(c.parcelId);
      const overdue = c.followUp <= t;
      return `<div class="fu-card ${overdue ? 'overdue-card' : ''}">
        <div class="fu-date ${overdue ? 'overdue' : ''}">${fmtDate(c.followUp)}${overdue ? '<div class="small">fällig</div>' : ''}</div>
        <div class="fu-body">
          <div><b>${esc(parcelTitle(p))}</b> · ${esc(p.gemarkung)} · <span class="status" style="--c:${statusOf(p).color}">${esc(statusOf(p).label)}</span></div>
          <div class="muted small">${esc(mainContact(p))}${p.contacts?.[0]?.phone ? ' · ' + esc(p.contacts[0].phone) : ''}</div>
          <div class="fu-text">„${esc(c.text)}“ <span class="muted small">– ${esc(c.type)}, ${fmtDate(c.date)}, ${esc(c.author)}</span></div>
        </div>
        <div class="fu-actions">
          <button class="btn small" data-fu-open="${esc(p.id)}">Öffnen</button>
          <button class="btn small primary" data-fu-done="${esc(c.id)}">Erledigt</button>
        </div></div>`;
    }).join('') : '<p class="empty">Keine offenen Wiedervorlagen. 🎉</p>';
  }

  // ---------- Detailbereich ----------
  function selectParcel(id, tab) {
    state.selectedId = id;
    if (tab) state.drawerTab = tab;
    renderMapLayers();
    renderList();
    renderDrawer();
  }

  function setDrawerOpen(open) {
    const el = $('#drawer');
    const was = !el.classList.contains('hidden');
    el.classList.toggle('hidden', !open);
    $('main').classList.toggle('drawer-open', open);
    if (map && was !== open) setTimeout(() => map.invalidateSize(), 30);
  }

  function hideDrawer() {
    state.selectedId = null;
    setDrawerOpen(false);
    renderMapLayers();
    renderList();
  }

  function renderDrawer() {
    const p = getParcel(state.selectedId);
    const el = $('#drawer');
    if (!p) { setDrawerOpen(false); return; }
    setDrawerOpen(true);
    const s = statusOf(p);
    const isOwn = p.kategorie === 'eigen';
    const docs = docsOf(p.id);
    const comments = commentsOf(p.id);
    const tabs = [
      ['overview', 'Übersicht'],
      ['contacts', isOwn ? `Kontakte (${(p.contacts || []).length})` : `Eigentümer (${(p.contacts || []).length})`],
      ['docs', `Dokumente (${docs.length})`],
      ['history', `Verlauf (${comments.length})`],
    ];
    const c = p.geometry ? centroid(p.geometry) : null;

    el.innerHTML = `
      <div class="drawer-head" style="--c:${s.color}">
        <div class="drawer-title">
          <div class="muted small">Gemarkung ${esc(p.gemarkung || '–')}</div>
          <h2>${esc(parcelTitle(p))}</h2>
          <div class="chips">
            <span class="cat cat-${esc(p.kategorie)}">${esc(CONFIG.categories[p.kategorie]?.label || '')}</span>
            <span class="status" style="--c:${s.color}">${esc(s.label)}</span>
            <span class="muted small">${fmtArea(p.flaeche)}</span>
          </div>
        </div>
        <button class="icon-btn" data-act="close" aria-label="Schließen">✕</button>
      </div>
      <div class="drawer-actions">
        <button class="btn small" data-act="edit">Bearbeiten</button>
        <button class="btn small" data-act="zoom">Auf Karte</button>
        ${c ? `<a class="btn small" target="_blank" rel="noopener" href="${bayernAtlasUrl(c.lat, c.lon)}">BayernAtlas ↗</a>` : ''}
        <button class="btn small" data-act="redraw">${p.geometry ? 'Umriss neu zeichnen' : 'Umriss zeichnen'}</button>
        <button class="btn small danger-ghost" data-act="delete">Löschen</button>
      </div>
      <div class="drawer-tabs">${tabs.map(([id, label]) => `<button class="dtab ${state.drawerTab === id ? 'active' : ''}" data-dtab="${id}">${esc(label)}</button>`).join('')}</div>
      <div class="drawer-body">${renderDrawerTab(p, state.drawerTab, docs, comments)}</div>`;
  }

  function renderDrawerTab(p, tab, docs, comments) {
    const isOwn = p.kategorie === 'eigen';
    if (tab === 'overview') {
      const fu = openFollowUp(p.id);
      const last = comments[0];
      const field = (label, value) => `<div class="field"><div class="field-label">${label}</div><div class="field-value">${value || '<span class="muted">–</span>'}</div></div>`;
      return `
        <div class="fields">
          ${field('Flurstücksnummer', esc(p.flurstueck))}
          ${field('Gemarkung', esc(p.gemarkung))}
          ${field('Lage / Bezeichnung', esc(p.lage))}
          ${field('Fläche', fmtArea(p.flaeche))}
          ${field('Nutzung', esc(p.nutzung))}
          ${field('Grundbuch', esc(p.grundbuch))}
        </div>
        ${p.notiz ? `<div class="note-box">${esc(p.notiz).replace(/\n/g, '<br>')}</div>` : ''}
        ${!isOwn ? `<div class="info-box">
            <div><b>Eigentümer:</b> ${esc(mainContact(p)) || '<span class="muted">noch nicht erfasst</span>'}</div>
            <div><b>Letzter Kontakt:</b> ${last ? `${fmtDate(last.date)} – ${esc(last.type)}` : '<span class="muted">keiner</span>'}</div>
            <div><b>Wiedervorlage:</b> ${fu ? `<span class="${fu.followUp <= today() ? 'overdue' : ''}">${fmtDate(fu.followUp)}</span>` : '<span class="muted">keine</span>'}</div>
            <div class="row-actions">
              <button class="btn small primary" data-act="quick-contact">Kontakt protokollieren</button>
              <button class="btn small" data-act="acquired">Als erworben markieren</button>
            </div>
          </div>` : ''}
        <div class="muted small meta">Angelegt ${fmtDate(p.createdAt?.slice(0, 10))} · zuletzt geändert ${fmtDate(p.updatedAt?.slice(0, 10))}</div>`;
    }

    if (tab === 'contacts') {
      return `
        <p class="muted small">${isOwn ? 'Ansprechpartner zum eigenen Flurstück, z. B. Pächter, Behörden, Notar.' : 'Eigentümer und weitere Ansprechpartner. Mehrere Einträge möglich (z. B. Erbengemeinschaft).'}</p>
        ${(p.contacts || []).map((c) => `
          <div class="card">
            <div class="card-head"><div><span class="role">${esc(c.role)}</span><div class="card-title">${esc(c.name)}</div></div>
              <div><button class="icon-btn" data-contact-edit="${esc(c.id)}" title="Bearbeiten">✎</button><button class="icon-btn" data-contact-del="${esc(c.id)}" title="Löschen">🗑</button></div></div>
            ${c.address ? `<div>📍 ${esc(c.address)}</div>` : ''}
            ${c.phone ? `<div>📞 <a href="tel:${esc(c.phone.replace(/\s/g, ''))}">${esc(c.phone)}</a></div>` : ''}
            ${c.email ? `<div>✉️ <a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>` : ''}
            ${c.note ? `<div class="muted small">${esc(c.note)}</div>` : ''}
          </div>`).join('') || '<p class="empty">Noch keine Kontakte erfasst.</p>'}
        <button class="btn primary" data-act="contact-add">+ Kontakt hinzufügen</button>`;
    }

    if (tab === 'docs') {
      return `
        <div class="dropzone" id="dropzone">
          <div><b>Dateien hierher ziehen</b> oder</div>
          <label class="btn small primary">Dateien auswählen<input type="file" id="doc-input" multiple hidden></label>
          <div class="muted small">Pläne, Verträge, Urkunden, Grundbuchauszüge, Fotos … (PDF, Bilder, Office)</div>
        </div>
        ${docs.map((d) => `
          <div class="doc">
            <div class="doc-icon">${docIcon(d.mime, d.name)}</div>
            <div class="doc-main">
              <div class="doc-name">${esc(d.name)}</div>
              <div class="muted small">${esc(d.docType)} · ${fmtDate(d.date)} · ${fmtSize(d.size || 0)}</div>
              ${d.note ? `<div class="small">${esc(d.note)}</div>` : ''}
            </div>
            <div class="doc-actions">
              <button class="icon-btn" data-doc-open="${esc(d.id)}" title="Öffnen">👁</button>
              <button class="icon-btn" data-doc-dl="${esc(d.id)}" title="Herunterladen">⬇</button>
              <button class="icon-btn" data-doc-edit="${esc(d.id)}" title="Bearbeiten">✎</button>
              <button class="icon-btn" data-doc-del="${esc(d.id)}" title="Löschen">🗑</button>
            </div>
          </div>`).join('') || '<p class="empty">Noch keine Dokumente.</p>'}`;
    }

    // Verlauf
    const author = store.get('fi-author') || '';
    return `
      <form class="comment-form" id="comment-form">
        <div class="grid2">
          <label>Datum<input type="date" name="date" value="${today()}" required></label>
          <label>Art<select name="type">${CONFIG.commentTypes.map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>
        </div>
        <label>Eintrag<textarea name="text" rows="3" required placeholder="${isOwn ? 'z. B. Begehung, Genehmigungsstand, Hinweise …' : 'z. B. Gespräch mit Eigentümer, Preisvorstellung, Stimmung …'}"></textarea></label>
        <div class="grid2">
          <label>Erfasst von<input name="author" value="${esc(author)}" placeholder="Name"></label>
          <label>Wiedervorlage (optional)<input type="date" name="followUp"></label>
        </div>
        <div class="quick-fu muted small">Schnell: <a href="#" data-fu="3">in 3 Mon.</a> · <a href="#" data-fu="6">6 Mon.</a> · <a href="#" data-fu="12">1 Jahr</a></div>
        <button class="btn primary" type="submit">Eintrag speichern</button>
      </form>
      <div class="timeline">
        ${comments.map((c) => `
          <div class="tl-item">
            <div class="tl-dot"></div>
            <div class="tl-content">
              <div class="tl-head"><b>${fmtDate(c.date)}</b> · ${esc(c.type)} <span class="muted">· ${esc(c.author || '')}</span>
                <span class="tl-tools"><button class="icon-btn" data-comment-edit="${esc(c.id)}" title="Bearbeiten">✎</button><button class="icon-btn" data-comment-del="${esc(c.id)}" title="Löschen">🗑</button></span></div>
              <div class="tl-text">${esc(c.text).replace(/\n/g, '<br>')}</div>
              ${c.followUp ? `<div class="tl-fu ${c.followUpDone ? 'done' : c.followUp <= today() ? 'overdue' : ''}">
                  ⏰ Wiedervorlage ${fmtDate(c.followUp)} ${c.followUpDone ? '(erledigt)' : `<a href="#" data-fu-done="${esc(c.id)}">als erledigt markieren</a>`}</div>` : ''}
            </div>
          </div>`).join('') || '<p class="empty">Noch keine Einträge.</p>'}
      </div>`;
  }

  function docIcon(mime = '', name = '') {
    if (mime.startsWith('image/')) return '🖼';
    if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return '📕';
    if (/word|\.docx?$/i.test(mime + name)) return '📘';
    if (/sheet|excel|\.xlsx?$/i.test(mime + name)) return '📗';
    return '📄';
  }

  // ---------- Formulare (Dialog) ----------
  function openForm({ title, fields, submitLabel = 'Speichern', onSubmit, extraHtml = '' }) {
    $('#modal-title').textContent = title;
    const form = $('#modal-form');
    form.innerHTML = `<div class="form-grid">${fields.map((f) => {
      const v = f.value ?? '';
      const req = f.required ? 'required' : '';
      let input;
      if (f.type === 'select') {
        input = `<select name="${f.name}" ${req}>${(f.options || []).map((o) => {
          const [val, lab] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`;
        }).join('')}</select>`;
      } else if (f.type === 'textarea') {
        input = `<textarea name="${f.name}" rows="${f.rows || 3}" ${req}>${esc(v)}</textarea>`;
      } else if (f.type === 'checkbox') {
        input = `<input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}>`;
      } else {
        input = `<input type="${f.type || 'text'}" name="${f.name}" value="${esc(v)}" ${req} ${f.step ? `step="${f.step}"` : ''} placeholder="${esc(f.placeholder || '')}">`;
      }
      return `<label class="${f.full ? 'full' : ''} ${f.type === 'checkbox' ? 'check' : ''}">${esc(f.label)}${f.hint ? ` <span class="muted small">${esc(f.hint)}</span>` : ''}${input}</label>`;
    }).join('')}</div>${extraHtml}
      <div class="modal-actions"><button type="button" class="btn ghost" data-modal-cancel>Abbrechen</button><button type="submit" class="btn primary">${esc(submitLabel)}</button></div>`;
    fields.forEach((f) => { if (f.onChange) form.elements[f.name].addEventListener('change', () => f.onChange(form)); });
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const values = {};
      fields.forEach((f) => { values[f.name] = f.type === 'checkbox' ? form.elements[f.name].checked : form.elements[f.name].value.trim(); });
      const ok = await onSubmit(values, form);
      if (ok !== false) closeModal();
    };
    $('#modal-backdrop').classList.remove('hidden');
    setTimeout(() => form.querySelector('input:not([type=checkbox]), select, textarea')?.focus(), 30);
  }
  function closeModal() { $('#modal-backdrop').classList.add('hidden'); }

  function statusOptions(kat) { return CONFIG.statuses[kat].map((s) => [s.id, s.label]); }

  function openParcelForm(parcel, geometry) {
    const isNew = !parcel;
    const p = parcel || { kategorie: 'fremd', status: 'offen', gemarkung: store.get('fi-last-gemarkung') || (state.parcels[0] || {}).gemarkung || '', contacts: [] };
    const area = geometry ? Math.round(UTM.geometryArea(geometry)) : p.flaeche;
    openForm({
      title: isNew ? 'Neues Flurstück erfassen' : `${parcelTitle(p)} bearbeiten`,
      fields: [
        { name: 'flurstueck', label: 'Flurstücksnummer', value: p.flurstueck, required: true, placeholder: 'z. B. 1188/2' },
        { name: 'gemarkung', label: 'Gemarkung', value: p.gemarkung, required: true },
        {
          name: 'kategorie', label: 'Kategorie', type: 'select', value: p.kategorie,
          options: [['eigen', CONFIG.categories.eigen.label], ['fremd', CONFIG.categories.fremd.label]],
          onChange: (form) => {
            const sel = form.elements.status;
            sel.innerHTML = statusOptions(form.elements.kategorie.value).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
          },
        },
        { name: 'status', label: 'Status', type: 'select', value: p.status, options: statusOptions(p.kategorie) },
        { name: 'lage', label: 'Lage / Bezeichnung', value: p.lage, placeholder: 'z. B. Baggersee West' },
        { name: 'nutzung', label: 'Nutzung', type: 'select', value: p.nutzung, options: [['', '–'], ...CONFIG.nutzungen] },
        { name: 'flaeche', label: 'Fläche (m²)', type: 'number', value: area, step: '1', hint: geometry ? '(aus Umriss berechnet)' : '' },
        { name: 'grundbuch', label: 'Grundbuch (Blatt)', value: p.grundbuch },
        { name: 'notiz', label: 'Notiz', type: 'textarea', value: p.notiz, full: true },
      ],
      submitLabel: isNew ? 'Anlegen' : 'Speichern',
      onSubmit: async (v) => {
        const now = new Date().toISOString();
        const obj = { ...p, ...v, flaeche: Number(v.flaeche) || 0, id: p.id || uid(), createdAt: p.createdAt || now };
        if (geometry) obj.geometry = geometry;
        await saveParcel(obj);
        store.set('fi-last-gemarkung', v.gemarkung);
        state.selectedId = obj.id;
        state.drawerTab = isNew && obj.kategorie === 'fremd' ? 'contacts' : (state.drawerTab || 'overview');
        renderAll();
        toast(isNew ? 'Flurstück angelegt.' : 'Gespeichert.');
      },
    });
  }

  function openContactForm(p, contact) {
    const c = contact || { role: p.kategorie === 'eigen' ? 'Pächter' : 'Eigentümer' };
    openForm({
      title: contact ? 'Kontakt bearbeiten' : 'Kontakt hinzufügen',
      fields: [
        { name: 'role', label: 'Rolle', type: 'select', value: c.role, options: CONFIG.contactRoles },
        { name: 'name', label: 'Name / Firma', value: c.name, required: true },
        { name: 'address', label: 'Anschrift', value: c.address, full: true },
        { name: 'phone', label: 'Telefon', type: 'tel', value: c.phone },
        { name: 'email', label: 'E-Mail', type: 'email', value: c.email },
        { name: 'note', label: 'Bemerkung', type: 'textarea', value: c.note, full: true, rows: 2 },
      ],
      onSubmit: async (v) => {
        p.contacts = p.contacts || [];
        if (contact) Object.assign(contact, v); else p.contacts.push({ id: uid(), ...v });
        await saveParcel(p);
        renderAll();
      },
    });
  }

  function openCommentForm(p, comment, preset = {}) {
    const c = comment || { date: today(), type: 'Telefonat', author: store.get('fi-author') || '', ...preset };
    openForm({
      title: comment ? 'Eintrag bearbeiten' : `Kontakt protokollieren – ${parcelTitle(p)}`,
      fields: [
        { name: 'date', label: 'Datum', type: 'date', value: c.date, required: true },
        { name: 'type', label: 'Art', type: 'select', value: c.type, options: CONFIG.commentTypes },
        { name: 'text', label: 'Eintrag', type: 'textarea', value: c.text, required: true, full: true, rows: 4 },
        { name: 'author', label: 'Erfasst von', value: c.author },
        { name: 'followUp', label: 'Wiedervorlage', type: 'date', value: c.followUp },
        ...(comment && comment.followUp ? [{ name: 'followUpDone', label: 'Wiedervorlage erledigt', type: 'checkbox', value: c.followUpDone }] : []),
      ],
      onSubmit: async (v) => {
        if (!comment) {
          const obj = { id: uid(), parcelId: p.id, followUpDone: false, createdAt: new Date().toISOString(), ...v };
          await DB.put('comments', obj);
          state.comments.push(obj);
        } else {
          Object.assign(comment, v);
          await DB.put('comments', comment);
        }
        if (v.author) store.set('fi-author', v.author);
        renderAll();
      },
    });
  }

  function openDocMetaForm(files, p, existing) {
    const first = existing || { name: files[0].name, docType: guessDocType(files[0].name), date: today() };
    openForm({
      title: existing ? 'Dokument bearbeiten' : (files.length > 1 ? `${files.length} Dokumente hinzufügen` : 'Dokument hinzufügen'),
      fields: [
        ...(files && files.length > 1 ? [] : [{ name: 'name', label: 'Dateiname', value: first.name, required: true, full: true }]),
        { name: 'docType', label: 'Dokumentart', type: 'select', value: first.docType, options: CONFIG.documentTypes },
        { name: 'date', label: 'Datum des Dokuments', type: 'date', value: first.date },
        { name: 'note', label: 'Bemerkung (z. B. Ablageort Original)', type: 'textarea', value: first.note, full: true, rows: 2 },
      ],
      onSubmit: async (v) => {
        if (existing) {
          Object.assign(existing, v);
          await DB.put('documents', existing);
        } else {
          for (const f of files) {
            const id = uid();
            const meta = { id, parcelId: p.id, name: files.length > 1 ? f.name : v.name, docType: files.length > 1 ? (v.docType || guessDocType(f.name)) : v.docType,
              date: v.date, note: v.note, mime: f.type || 'application/octet-stream', size: f.size, addedAt: new Date().toISOString() };
            await DB.put('blobs', { id, blob: f });
            await DB.put('documents', meta);
            state.documents.push(meta);
          }
          toast(files.length > 1 ? `${files.length} Dokumente gespeichert.` : 'Dokument gespeichert.');
        }
        renderAll();
      },
    });
  }

  function guessDocType(name) {
    const n = name.toLowerCase();
    if (/kauf/.test(n)) return 'Kaufvertrag';
    if (/pacht/.test(n)) return 'Pachtvertrag';
    if (/urkunde|notar/.test(n)) return 'Notarurkunde';
    if (/grundbuch/.test(n)) return 'Grundbuchauszug';
    if (/plan|lage/.test(n)) return 'Plan / Lageplan';
    if (/bescheid|genehm/.test(n)) return 'Genehmigung / Bescheid';
    if (/gutacht/.test(n)) return 'Gutachten';
    if (/\.(jpe?g|png|heic|webp)$/.test(n)) return 'Foto';
    return 'Sonstiges';
  }

  async function openDoc(id, asDownload) {
    const meta = state.documents.find((d) => d.id === id);
    const rec = await DB.get('blobs', id);
    if (!rec) { toast('Dateiinhalt nicht gefunden.'); return; }
    if (asDownload) { download(meta.name, rec.blob); return; }
    showPreview(meta, rec.blob);
  }

  // Dokumentvorschau direkt in der App (Bilder, PDF, Text)
  let previewUrl = null;
  async function showPreview(meta, blob) {
    const bd = $('#preview-backdrop');
    const body = $('#preview-body');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(blob);
    $('#preview-title').textContent = meta.name;
    const mime = meta.mime || blob.type || '';
    if (mime.startsWith('image/')) body.innerHTML = `<img src="${previewUrl}" alt="${esc(meta.name)}">`;
    else if (mime === 'application/pdf') body.innerHTML = `<iframe src="${previewUrl}" title="${esc(meta.name)}"></iframe>`;
    else if (mime.startsWith('text/') || /json|xml|csv/.test(mime)) body.innerHTML = `<pre>${esc(await blob.text())}</pre>`;
    else body.innerHTML = `<p class="empty">Für diesen Dateityp gibt es keine Vorschau. Bitte über „Herunterladen“ öffnen.</p>`;
    $('#preview-dl').onclick = () => download(meta.name, blob);
    bd.classList.remove('hidden');
  }

  // ---------- Löschen / Erwerb ----------
  async function deleteParcel(p) {
    if (!(await ask(`${parcelTitle(p)} mit allen Kontakten, Dokumenten und Verlaufseinträgen löschen?`, { ok: 'Löschen', danger: true }))) return;
    for (const c of commentsOf(p.id)) await DB.del('comments', c.id);
    for (const d of docsOf(p.id)) { await DB.del('documents', d.id); await DB.del('blobs', d.id); }
    await DB.del('parcels', p.id);
    state.comments = state.comments.filter((c) => c.parcelId !== p.id);
    state.documents = state.documents.filter((d) => d.parcelId !== p.id);
    state.parcels = state.parcels.filter((x) => x.id !== p.id);
    state.selectedId = null;
    setDrawerOpen(false);
    renderAll();
    toast('Flurstück gelöscht.');
  }

  function markAcquired(p) {
    openForm({
      title: `${parcelTitle(p)} als erworben markieren`,
      fields: [
        { name: 'date', label: 'Datum (Beurkundung)', type: 'date', value: today(), required: true },
        { name: 'status', label: 'Neuer Status', type: 'select', value: 'reserve', options: statusOptions('eigen') },
        { name: 'text', label: 'Vermerk', type: 'textarea', full: true, value: `Flurstück erworben von ${mainContact(p) || '…'}.` },
      ],
      submitLabel: 'Übernehmen',
      onSubmit: async (v) => {
        const prev = p.contacts || [];
        p.kategorie = 'eigen';
        p.status = v.status;
        p.contacts = prev.map((c) => ({ ...c, role: c.role === 'Eigentümer' ? 'Voreigentümer' : c.role }));
        await saveParcel(p);
        const obj = { id: uid(), parcelId: p.id, date: v.date, type: 'Notiz', author: store.get('fi-author') || '', text: v.text, followUp: '', followUpDone: false, createdAt: new Date().toISOString() };
        await DB.put('comments', obj);
        state.comments.push(obj);
        // offene Wiedervorlagen schließen
        for (const c of commentsOf(p.id)) if (c.followUp && !c.followUpDone) { c.followUpDone = true; await DB.put('comments', c); }
        state.drawerTab = 'docs';
        renderAll();
        toast('Als eigenes Flurstück übernommen – jetzt Kaufvertrag/Urkunde hochladen.');
      },
    });
  }

  async function setFollowUpDone(id) {
    const c = state.comments.find((x) => x.id === id);
    if (!c) return;
    c.followUpDone = true;
    await DB.put('comments', c);
    renderAll();
    toast('Wiedervorlage erledigt.');
  }

  // ---------- Import / Export ----------
  const blobToDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  const dataUrlToBlob = async (u) => (await fetch(u)).blob();

  async function exportBackup() {
    const docs = [];
    for (const d of state.documents) {
      const rec = await DB.get('blobs', d.id);
      docs.push({ ...d, data: rec ? await blobToDataUrl(rec.blob) : null });
    }
    const data = { app: 'flurstueck-inventar', version: 1, exportedAt: new Date().toISOString(), parcels: state.parcels, comments: state.comments, documents: docs };
    download(`flurstueck-inventar-sicherung-${today()}.json`, JSON.stringify(data), 'application/json');
  }

  async function importBackup(file) {
    const data = JSON.parse(await file.text());
    if (data.app !== 'flurstueck-inventar') throw new Error('Keine gültige Sicherungsdatei.');
    if (!(await ask('Aktuelle Daten durch die Sicherung ersetzen?', { ok: 'Ersetzen', danger: true }))) return;
    await DB.clearAll();
    await DB.putMany('parcels', data.parcels || []);
    await DB.putMany('comments', data.comments || []);
    for (const d of data.documents || []) {
      const { data: du, ...meta } = d;
      await DB.put('documents', meta);
      if (du) await DB.put('blobs', { id: meta.id, blob: await dataUrlToBlob(du) });
    }
    await loadAll();
    state.selectedId = null;
    renderAll();
    fitAll();
    toast('Sicherung importiert.');
  }

  function exportGeoJSON() {
    const fc = {
      type: 'FeatureCollection',
      features: state.parcels.filter((p) => p.geometry).map((p) => ({
        type: 'Feature', geometry: p.geometry,
        properties: { flurstueck: p.flurstueck, gemarkung: p.gemarkung, kategorie: p.kategorie, status: statusOf(p).label, flaeche_m2: p.flaeche, lage: p.lage, nutzung: p.nutzung, eigentuemer: mainContact(p) },
      })),
    };
    download(`flurstuecke-${today()}.geo.json`, JSON.stringify(fc, null, 1), 'application/geo+json');
  }

  // Import z. B. aus QGIS (ALKIS-Daten als GeoJSON in WGS84 / EPSG:4326 exportiert)
  async function importGeoJSON(file) {
    const fc = JSON.parse(await file.text());
    const feats = (fc.type === 'FeatureCollection' ? fc.features : [fc]).filter((f) => f.geometry && /Polygon/.test(f.geometry.type));
    if (!feats.length) throw new Error('Keine Polygone gefunden.');
    const sample = feats[0].geometry.type === 'Polygon' ? feats[0].geometry.coordinates[0][0] : feats[0].geometry.coordinates[0][0][0];
    if (Math.abs(sample[0]) > 180) throw new Error('Koordinaten scheinen nicht in WGS84 (EPSG:4326) zu sein. Bitte in QGIS beim Export EPSG:4326 wählen.');
    const pick = (props, keys) => { for (const k of Object.keys(props || {})) if (keys.includes(k.toLowerCase())) return props[k]; return ''; };
    const now = new Date().toISOString();
    const existing = new Set(state.parcels.map((p) => `${p.gemarkung}|${p.flurstueck}`));
    let n = 0, skipped = 0;
    const toAdd = [];
    for (const f of feats) {
      const pr = f.properties || {};
      const flurstueck = String(pick(pr, ['flurstueck', 'flstnr', 'flstkennz', 'flurstuecksnummer', 'flstnrzae', 'label', 'name', 'nummer']) || '');
      const nenner = pick(pr, ['flstnrnen', 'nenner']);
      const gemarkung = String(pick(pr, ['gemarkung', 'gemarkungsname', 'gmkname', 'gemname']) || 'Unbekannt');
      const nr = nenner && !flurstueck.includes('/') ? `${flurstueck}/${nenner}` : flurstueck;
      if (existing.has(`${gemarkung}|${nr}`)) { skipped++; continue; }
      const kat = String(pick(pr, ['kategorie']) || '').toLowerCase() === 'eigen' ? 'eigen' : 'fremd';
      toAdd.push({
        id: uid(), flurstueck: nr || '?', gemarkung, kategorie: kat, status: kat === 'eigen' ? 'reserve' : 'offen',
        lage: String(pick(pr, ['lage', 'lagebezeichnung', 'bezeichnung']) || ''), nutzung: '', grundbuch: '', notiz: '', contacts: [],
        geometry: f.geometry, flaeche: Math.round(Number(pick(pr, ['flaeche', 'amtlflsfl', 'area', 'flaeche_m2'])) || UTM.geometryArea(f.geometry)),
        createdAt: now, updatedAt: now,
      });
      n++;
    }
    await DB.putMany('parcels', toAdd);
    state.parcels.push(...toAdd);
    renderAll();
    fitAll();
    toast(`${n} Flurstücke importiert${skipped ? `, ${skipped} bereits vorhanden` : ''}.`);
  }

  function exportCsv() {
    const head = ['Flurstück', 'Gemarkung', 'Lage', 'Fläche m²', 'Kategorie', 'Status', 'Nutzung', 'Grundbuch', 'Eigentümer/Kontakt', 'Telefon', 'E-Mail', 'Anschrift', 'Dokumente', 'Letzter Eintrag', 'Letzter Eintrag Text', 'Wiedervorlage', 'Notiz'];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filteredParcels().map((p) => {
      const c = (p.contacts || [])[0] || {};
      const last = commentsOf(p.id)[0] || {};
      const fu = openFollowUp(p.id) || {};
      return [p.flurstueck, p.gemarkung, p.lage, p.flaeche, CONFIG.categories[p.kategorie]?.short, statusOf(p).label, p.nutzung, p.grundbuch,
        c.name, c.phone, c.email, c.address, docsOf(p.id).length, fmtDate(last.date), last.text, fmtDate(fu.followUp), p.notiz].map(q).join(';');
    });
    download(`flurstuecke-${today()}.csv`, '﻿' + [head.map(q).join(';'), ...rows].join('\r\n'), 'text/csv;charset=utf-8');
  }

  function fitAll() {
    if (parcelLayer.getLayers().length) map.fitBounds(parcelLayer.getBounds(), { padding: [30, 30], maxZoom: 17 });
  }

  // ---------- Kartensuche ----------
  function renderSearchResults() {
    const q = $('#map-search-input').value.trim().toLowerCase();
    const box = $('#map-search-results');
    if (!q) { box.classList.add('hidden'); return; }
    const hits = state.parcels.filter((p) => [p.flurstueck, p.gemarkung, p.lage, ...(p.contacts || []).map((c) => c.name)].join(' ').toLowerCase().includes(q)).slice(0, 8);
    box.innerHTML = hits.map((p) => `<button data-hit="${esc(p.id)}"><span class="swatch" style="--c:${statusOf(p).color}"></span><b>${esc(p.flurstueck)}</b> <span class="muted">${esc(p.gemarkung)} · ${esc(mainContact(p) || statusOf(p).label)}</span></button>`).join('') || '<div class="muted small pad">Kein Treffer</div>';
    box.classList.remove('hidden');
  }

  // ---------- Ereignisse ----------
  function bindEvents() {
    $$('.tab').forEach((t) => t.addEventListener('click', () => switchView(t.dataset.view)));
    $('#btn-new').addEventListener('click', async () => {
      const r = await ask('Soll der Umriss des Flurstücks jetzt auf der Karte eingezeichnet werden?', { title: 'Neues Flurstück', ok: 'Umriss zeichnen', cancel: 'Nur Daten erfassen' });
      if (r === true) startDraw({ onDone: (geom) => openParcelForm(null, geom) });
      else if (r === false) openParcelForm(null, null);
    });

    // Daten-Menü
    $('#btn-menu').addEventListener('click', (e) => { e.stopPropagation(); $('#menu-panel').classList.toggle('hidden'); });
    document.addEventListener('click', () => $('#menu-panel').classList.add('hidden'));
    const fileInput = $('#file-import');
    $('#menu-panel').addEventListener('click', async (e) => {
      const act = e.target.dataset.action;
      if (!act) return;
      $('#menu-panel').classList.add('hidden');
      if (act === 'export-backup') exportBackup();
      if (act === 'export-geojson') exportGeoJSON();
      if (act === 'export-csv') exportCsv();
      if (act === 'import-backup' || act === 'import-geojson') {
        fileInput.accept = act === 'import-backup' ? '.json' : '.geojson,.json';
        fileInput.onchange = async () => {
          const f = fileInput.files[0];
          fileInput.value = '';
          if (!f) return;
          try { act === 'import-backup' ? await importBackup(f) : await importGeoJSON(f); } catch (err) { ask('Import fehlgeschlagen: ' + err.message, { title: 'Import', ok: 'OK', cancel: 'Schließen' }); }
        };
        fileInput.click();
      }
      if (act === 'reset-demo' && await ask('Alle Daten durch die Demo-Daten ersetzen?', { ok: 'Ersetzen', danger: true })) { await seedDemo(); await loadAll(); state.selectedId = null; setDrawerOpen(false); renderAll(); fitAll(); toast('Demo-Daten geladen.'); }
      if (act === 'clear-all' && await ask('Wirklich ALLE Flurstücke, Dokumente und Einträge löschen?', { ok: 'Alles löschen', danger: true })) { await DB.clearAll(); await loadAll(); state.selectedId = null; setDrawerOpen(false); renderAll(); toast('Alle Daten gelöscht.'); }
    });

    // Liste
    ['#list-search', '#list-cat', '#list-status'].forEach((s) => $(s).addEventListener('input', renderList));
    $$('#parcel-table th').forEach((th) => th.addEventListener('click', () => {
      const key = th.dataset.sort;
      state.sort = { key, dir: state.sort.key === key ? -state.sort.dir : 1 };
      renderList();
    }));
    $('#parcel-table tbody').addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr) selectParcel(tr.dataset.id);
    });

    // Wiedervorlagen
    $('#followup-list').addEventListener('click', (e) => {
      const open = e.target.closest('[data-fu-open]');
      const done = e.target.closest('[data-fu-done]');
      if (open) selectParcel(open.dataset.fuOpen, 'history');
      if (done) setFollowUpDone(done.dataset.fuDone);
    });

    // Kartensuche
    $('#map-search-input').addEventListener('input', renderSearchResults);
    $('#map-search-input').addEventListener('focus', renderSearchResults);
    $('#map-search-results').addEventListener('click', (e) => {
      const b = e.target.closest('[data-hit]');
      if (!b) return;
      $('#map-search-results').classList.add('hidden');
      selectParcel(b.dataset.hit);
      zoomToParcel(b.dataset.hit);
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('#map-search')) $('#map-search-results').classList.add('hidden'); });

    // Zeichnen
    $('#draw-done').addEventListener('click', finishDraw);
    $('#draw-cancel').addEventListener('click', endDraw);
    $('#draw-undo').addEventListener('click', () => {
      draw.pts.pop();
      const ms = draw.markers.getLayers();
      if (ms.length) draw.markers.removeLayer(ms[ms.length - 1]);
      draw.line.setLatLngs(draw.pts);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('#preview-backdrop').classList.contains('hidden')) $('#preview-backdrop').classList.add('hidden');
        else if (!$('#modal-backdrop').classList.contains('hidden')) closeModal();
        else if (draw.active) endDraw();
        else if (state.selectedId) hideDrawer();
      }
      if (e.key === 'Enter' && draw.active) finishDraw();
    });

    // Vorschau
    $('#preview-close').addEventListener('click', () => $('#preview-backdrop').classList.add('hidden'));
    $('#preview-backdrop').addEventListener('click', (e) => { if (e.target.id === 'preview-backdrop') e.target.classList.add('hidden'); });
    $('#tile-warning-close').addEventListener('click', () => $('#tile-warning').classList.add('hidden'));

    // Dialog
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-backdrop').addEventListener('click', (e) => { if (e.target.id === 'modal-backdrop' || e.target.closest('[data-modal-cancel]')) closeModal(); });

    // Detailbereich (Event-Delegation)
    const drawer = $('#drawer');
    drawer.addEventListener('click', async (e) => {
      const p = getParcel(state.selectedId);
      if (!p) return;
      const t = e.target.closest('button, a');
      if (!t) return;
      const d = t.dataset;
      if (d.dtab) { state.drawerTab = d.dtab; renderDrawer(); return; }
      if (d.act === 'close') hideDrawer();
      if (d.act === 'edit') openParcelForm(p);
      if (d.act === 'zoom') zoomToParcel(p.id);
      if (d.act === 'delete') deleteParcel(p);
      if (d.act === 'acquired') markAcquired(p);
      if (d.act === 'quick-contact') openCommentForm(p);
      if (d.act === 'contact-add') openContactForm(p);
      if (d.act === 'redraw') {
        startDraw({ onDone: async (geom) => {
          p.geometry = geom;
          const area = Math.round(UTM.geometryArea(geom));
          if (!p.flaeche || await ask(`Fläche aus dem neuen Umriss übernehmen? (${fmtArea(area)})`, { ok: 'Übernehmen', cancel: 'Alte Fläche behalten' })) p.flaeche = area;
          await saveParcel(p);
          state.selectedId = p.id;
          renderAll();
          toast('Umriss gespeichert.');
        } });
      }
      if (d.contactEdit) openContactForm(p, p.contacts.find((c) => c.id === d.contactEdit));
      if (d.contactDel && await ask('Kontakt löschen?', { ok: 'Löschen', danger: true })) { p.contacts = p.contacts.filter((c) => c.id !== d.contactDel); await saveParcel(p); renderAll(); }
      if (d.docOpen) openDoc(d.docOpen, false);
      if (d.docDl) openDoc(d.docDl, true);
      if (d.docEdit) openDocMetaForm(null, p, state.documents.find((x) => x.id === d.docEdit));
      if (d.docDel && await ask('Dokument löschen?', { ok: 'Löschen', danger: true })) {
        await DB.del('documents', d.docDel); await DB.del('blobs', d.docDel);
        state.documents = state.documents.filter((x) => x.id !== d.docDel); renderAll();
      }
      if (d.commentEdit) openCommentForm(p, state.comments.find((c) => c.id === d.commentEdit));
      if (d.commentDel && await ask('Eintrag löschen?', { ok: 'Löschen', danger: true })) { await DB.del('comments', d.commentDel); state.comments = state.comments.filter((c) => c.id !== d.commentDel); renderAll(); }
      if (d.fuDone) { e.preventDefault(); setFollowUpDone(d.fuDone); }
      if (d.fu) {
        e.preventDefault();
        const dt = new Date(); dt.setMonth(dt.getMonth() + Number(d.fu));
        $('#comment-form').elements.followUp.value = dt.toISOString().slice(0, 10);
      }
    });
    drawer.addEventListener('submit', async (e) => {
      if (e.target.id !== 'comment-form') return;
      e.preventDefault();
      const f = e.target.elements;
      const obj = { id: uid(), parcelId: state.selectedId, date: f.date.value, type: f.type.value, text: f.text.value.trim(), author: f.author.value.trim(),
        followUp: f.followUp.value, followUpDone: false, createdAt: new Date().toISOString() };
      if (!obj.text) return;
      await DB.put('comments', obj);
      state.comments.push(obj);
      if (obj.author) store.set('fi-author', obj.author);
      renderAll();
      toast('Eintrag gespeichert.');
    });
    drawer.addEventListener('change', (e) => {
      if (e.target.id === 'doc-input' && e.target.files.length) openDocMetaForm([...e.target.files], getParcel(state.selectedId));
    });
    drawer.addEventListener('dragover', (e) => { const z = e.target.closest('#dropzone'); if (z) { e.preventDefault(); z.classList.add('over'); } });
    drawer.addEventListener('dragleave', (e) => { const z = e.target.closest('#dropzone'); if (z) z.classList.remove('over'); });
    drawer.addEventListener('drop', (e) => {
      const z = e.target.closest('#dropzone');
      if (!z) return;
      e.preventDefault();
      z.classList.remove('over');
      if (e.dataTransfer.files.length) openDocMetaForm([...e.dataTransfer.files], getParcel(state.selectedId));
    });
  }

  // ---------- Start ----------
  async function init() {
    initMap();
    bindEvents();
    try {
      if (!store.get('fi-seeded') && !(await DB.getAll('parcels')).length) await seedDemo();
      await loadAll();
    } catch (err) {
      console.error(err);
      toast('Lokale Datenbank nicht verfügbar: ' + err.message);
    }
    renderAll();
    fitAll();
  }

  window.addEventListener('DOMContentLoaded', init);
  window.__app = { state }; // für Tests / Fehlersuche
})();
