/* Konfiguration: Kartendienste, Status-Kategorien und Auswahllisten. */
window.CONFIG = {
  // Startansicht (Region Straubing, Ausschnitt aus dem BayernAtlas-Screenshot)
  start: { lat: 48.9375, lon: 12.5650, zoom: 16 },

  // Kartendienste. Die Dienste der Bayerischen Vermessungsverwaltung sind Open Data
  // (Lizenz CC BY 4.0, Quellenangabe „Bayerische Vermessungsverwaltung – www.geodaten.bayern.de“).
  // Falls ein Layername geändert wurde: GetCapabilities der URL im Browser aufrufen und hier anpassen.
  baseLayers: [
    {
      name: 'Luftbild Bayern (DOP40)',
      type: 'wms',
      url: 'https://geoservices.bayern.de/od/wms/dop/v1/dop40',
      layers: 'by_dop40c',
      attribution: '© Bayerische Vermessungsverwaltung – <a href="https://www.geodaten.bayern.de" target="_blank">geodaten.bayern.de</a> (CC BY 4.0)',
      default: true,
    },
    {
      name: 'OpenStreetMap',
      type: 'xyz',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      maxNativeZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>-Mitwirkende',
    },
    {
      name: 'Esri Luftbild (Ersatz)',
      type: 'xyz',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      maxNativeZoom: 19,
      attribution: 'Tiles © Esri',
    },
  ],
  overlays: [
    {
      name: 'Flurstücksgrenzen Bayern (Parzellarkarte)',
      type: 'wms',
      url: 'https://geoservices.bayern.de/od/wms/alkis/v1/parzellarkarte',
      layers: 'by_alkis_parzellarkarte_umr_gelb',
      attribution: 'ALKIS® © Bayerische Vermessungsverwaltung (CC BY 4.0)',
      minZoom: 14,
      default: true,
      featureInfo: true, // Versuch, beim Klick Infos zum Flurstück abzufragen (WMS GetFeatureInfo)
    },
  ],

  categories: {
    eigen: { label: 'Eigenes Flurstück', short: 'Eigen' },
    fremd: { label: 'Fremdes Flurstück', short: 'Fremd' },
  },

  // Status je Kategorie mit Kartenfarbe
  statuses: {
    eigen: [
      { id: 'abbau', label: 'Abbau aktiv', color: '#15803d' },
      { id: 'geplant', label: 'Abbau geplant', color: '#65a30d' },
      { id: 'reserve', label: 'Reservefläche', color: '#84cc16' },
      { id: 'rekultiviert', label: 'Rekultiviert', color: '#0d9488' },
      { id: 'verpachtet', label: 'Verpachtet', color: '#0891b2' },
    ],
    fremd: [
      { id: 'offen', label: 'Noch nicht angefragt', color: '#9ca3af' },
      { id: 'angefragt', label: 'Angefragt', color: '#3b82f6' },
      { id: 'verkaufsbereit', label: 'Verkaufsbereit', color: '#f59e0b' },
      { id: 'verhandlung', label: 'In Verhandlung', color: '#ef4444' },
      { id: 'abgelehnt', label: 'Kein Verkaufsinteresse', color: '#7c3aed' },
    ],
  },

  nutzungen: ['Ackerland', 'Grünland', 'Wald', 'Gewässer / Baggersee', 'Abbaufläche', 'Betriebsfläche', 'Weg', 'Sonstiges'],
  documentTypes: ['Plan / Lageplan', 'Kaufvertrag', 'Pachtvertrag', 'Notarurkunde', 'Grundbuchauszug', 'Genehmigung / Bescheid', 'Gutachten', 'Foto', 'Korrespondenz', 'Sonstiges'],
  commentTypes: ['Notiz', 'Telefonat', 'Besuch / Gespräch', 'Brief / E-Mail', 'Angebot', 'Termin'],
  contactRoles: ['Eigentümer', 'Miteigentümer', 'Erbe / Erbengemeinschaft', 'Bevollmächtigter', 'Pächter', 'Behörde', 'Notar', 'Sonstiges'],
};
