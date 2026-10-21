/* Fiktive Demo-Daten. Die Umrisse sind grob aus dem BayernAtlas-Ausschnitt nachgezeichnet;
   Nummern, Namen und Kontaktdaten sind frei erfunden. */
window.buildDemoData = function () {
  const G = {
    A: [[12.5586585, 48.9394579], [12.5628178, 48.9396329], [12.5628762, 48.9392499], [12.5586523, 48.9390698]],
    B: [[12.5586523, 48.9390698], [12.5628762, 48.9392499], [12.5628919, 48.9388682], [12.5586247, 48.9386824]],
    C: [[12.5586009, 48.9380479], [12.5629001, 48.9382326], [12.5629362, 48.9367844], [12.558478, 48.9369222]],
    D: [[12.5630226, 48.9394995], [12.5668978, 48.9397466], [12.5669968, 48.9388823], [12.5630818, 48.938827]],
    E: [[12.5631353, 48.9388254], [12.5670503, 48.9388807], [12.567066, 48.9383508], [12.5631511, 48.9382955]],
    F: [[12.5710137, 48.9400638], [12.5721559, 48.9398519], [12.5726413, 48.9376486], [12.5711854, 48.9375172]],
    G: [[12.5583248, 48.935974], [12.5628175, 48.9358704], [12.5626775, 48.9349571], [12.55823, 48.9350945]],
    H: [[12.5647329, 48.9371877], [12.5668253, 48.9372288], [12.566836, 48.9366284], [12.5647472, 48.9366366]],
    I: [[12.5672838, 48.9368969], [12.5693736, 48.9369028], [12.5692202, 48.9347545], [12.567133, 48.9347839]],
    J: [[12.5584359, 48.9367823], [12.5629048, 48.9366442], [12.5628251, 48.9359761], [12.5583619, 48.9360434]],
    K: [[12.567122, 48.9383843], [12.5679874, 48.9384987], [12.5680824, 48.9375781], [12.5671737, 48.9376062]],
  };
  const poly = (k) => ({ type: 'Polygon', coordinates: [[...G[k], G[k][0]]] });
  const now = new Date().toISOString();
  const gem = 'Musterau (Demo)';

  const p = (key, o) => ({
    id: 'demo-' + key,
    gemarkung: gem,
    lage: '',
    grundbuch: '',
    nutzung: '',
    notiz: '',
    contacts: [],
    geometry: poly(key),
    flaeche: Math.round(UTM.geometryArea(poly(key))),
    createdAt: now,
    updatedAt: now,
    ...o,
  });
  const c = (id, role, name, extra = {}) => ({ id, role, name, address: '', phone: '', email: '', note: '', ...extra });

  const parcels = [
    p('A', { flurstueck: '1203', kategorie: 'eigen', status: 'reserve', nutzung: 'Ackerland', lage: 'Am Kiesweiher Nord', grundbuch: 'Blatt 2211', notiz: 'Reservefläche für Erweiterung Abbauabschnitt III. Kiesmächtigkeit lt. Bohrung ca. 9 m.' }),
    p('B', {
      flurstueck: '1204', kategorie: 'fremd', status: 'offen', nutzung: 'Ackerland', lage: 'Am Kiesweiher Nord',
      contacts: [c('c1', 'Eigentümer', 'Josef Huber', { address: 'Dorfstraße 4, 94300 Musterau', phone: '09421 000111' })],
      notiz: 'Liegt zwischen eigenen Flächen – strategisch wichtig.',
    }),
    p('C', {
      flurstueck: '1210', kategorie: 'fremd', status: 'verhandlung', nutzung: 'Ackerland', lage: 'Große Breite',
      contacts: [
        c('c2', 'Erbe / Erbengemeinschaft', 'Erbengemeinschaft Maier – Ansprechpartnerin Maria Maier', { address: 'Lindenweg 12, 94315 Straubing', phone: '0170 0000222', email: 'maria.maier@example.org' }),
        c('c3', 'Miteigentümer', 'Thomas Maier', { address: 'München', phone: '0160 0000333', note: 'Entscheidet zusammen mit der Schwester.' }),
      ],
      notiz: 'Gute Kieslage. Kaufpreisvorstellung der Erben liegt über Gutachten.',
    }),
    p('D', { flurstueck: '1188/2', kategorie: 'eigen', status: 'abbau', nutzung: 'Gewässer / Baggersee', lage: 'Baggersee West', grundbuch: 'Blatt 1987', notiz: 'Nassabbau aktiv, Genehmigung bis 2031.' }),
    p('E', { flurstueck: '1188/3', kategorie: 'eigen', status: 'abbau', nutzung: 'Gewässer / Baggersee', lage: 'Baggersee West', grundbuch: 'Blatt 1987' }),
    p('F', {
      flurstueck: '1240', kategorie: 'fremd', status: 'angefragt', nutzung: 'Ackerland', lage: 'Ostfeld',
      contacts: [c('c4', 'Eigentümer', 'Landwirtschaft Gruber GbR – Herr Franz Gruber', { address: 'Hofweg 1, 94300 Musterau', phone: '09421 000444' })],
    }),
    p('G', {
      flurstueck: '1172', kategorie: 'fremd', status: 'verkaufsbereit', nutzung: 'Ackerland', lage: 'Südfeld',
      contacts: [c('c5', 'Eigentümer', 'Anna Schmid', { address: 'Bahnhofstr. 7, 94315 Straubing', email: 'a.schmid@example.org' })],
    }),
    p('H', { flurstueck: '1190', kategorie: 'eigen', status: 'rekultiviert', nutzung: 'Gewässer / Baggersee', lage: 'Biotopweiher', notiz: 'Als Ausgleichsfläche rekultiviert (Bescheid LRA 2019).' }),
    p('I', {
      flurstueck: '1195', kategorie: 'eigen', status: 'verpachtet', nutzung: 'Gewässer / Baggersee', lage: 'Fischweiher Süd',
      contacts: [c('c6', 'Pächter', 'Fischereiverein Musterau e. V. – 1. Vorstand K. Weber', { phone: '0151 0000555' })],
      notiz: 'Pachtvertrag läuft bis 31.12.2028.',
    }),
    p('J', {
      flurstueck: '1171', kategorie: 'fremd', status: 'abgelehnt', nutzung: 'Grünland', lage: 'Südfeld',
      contacts: [c('c7', 'Eigentümer', 'Stefan Bauer', { address: 'Am Anger 3, 94300 Musterau', phone: '09421 000666' })],
    }),
    p('K', { flurstueck: '1189/1', kategorie: 'eigen', status: 'geplant', nutzung: 'Grünland', lage: 'Ostufer', notiz: 'Abbauantrag in Vorbereitung.' }),
  ];

  const cm = (id, parcelKey, date, type, author, text, followUp = '', followUpDone = false) =>
    ({ id, parcelId: 'demo-' + parcelKey, date, type, author, text, followUp, followUpDone, createdAt: now });

  const comments = [
    cm('k1', 'C', '2025-03-12', 'Besuch / Gespräch', 'M. Schuster', 'Erstgespräch mit Frau Maier. Grundsätzlich verkaufsbereit, Bruder muss zustimmen.'),
    cm('k2', 'C', '2025-09-30', 'Angebot', 'M. Schuster', 'Schriftliches Angebot übermittelt (Preis lt. Gutachten).'),
    cm('k3', 'C', '2026-09-15', 'Telefonat', 'M. Schuster', 'Erben wünschen Nachbesserung. Rücksprache mit GF zum Preisrahmen.', '2026-10-15'),
    cm('k4', 'F', '2026-05-04', 'Telefonat', 'M. Schuster', 'Herr Gruber will die Fläche aktuell noch selbst bewirtschaften. In ca. 1 Jahr erneut anfragen.', '2027-05-01'),
    cm('k5', 'G', '2026-08-20', 'Brief / E-Mail', 'M. Schuster', 'Frau Schmid meldet sich: möchte verkaufen, wünscht Angebot bis Jahresende.', '2026-11-10'),
    cm('k6', 'J', '2024-11-02', 'Besuch / Gespräch', 'M. Schuster', 'Kein Verkaufsinteresse. Tausch gegen Ersatzfläche evtl. denkbar.', '2026-10-01'),
    cm('k7', 'B', '2026-10-01', 'Notiz', 'M. Schuster', 'Kontakt über Nachbar Gruber möglich, der kennt Herrn Huber gut.', '2026-10-28'),
    cm('k8', 'D', '2026-02-11', 'Notiz', 'Werkleitung', 'Jährliche Peilung durchgeführt, Abbaugrenze Nord erreicht.'),
    cm('k9', 'I', '2025-01-20', 'Notiz', 'Werkleitung', 'Pachtzins für 2025 eingegangen.'),
  ];

  const svgPlan = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
<rect width="600" height="400" fill="#f8fafc"/><text x="20" y="34" font-family="sans-serif" font-size="20">Lageplan Flst. 1188/2 (Demo)</text>
<polygon points="60,80 520,60 540,300 80,330" fill="#bae6fd" stroke="#0369a1" stroke-width="3"/>
<text x="230" y="200" font-family="sans-serif" font-size="18" fill="#0c4a6e">Baggersee West</text>
<line x1="60" y1="360" x2="160" y2="360" stroke="#000" stroke-width="3"/><text x="60" y="385" font-family="sans-serif" font-size="12">100 m</text></svg>`;
  const txtVertrag = 'KAUFVERTRAG (Demo-Dokument)\n\nUrkundenrolle Nr. 1234/2015\nVerkäufer: ...\nKäufer: Kieswerk ...\nKaufgegenstand: Flst. 1188/2, Gemarkung Musterau\n';

  const documents = [
    { id: 'd1', parcelId: 'demo-D', name: 'Lageplan_1188-2.svg', docType: 'Plan / Lageplan', date: '2021-06-01', mime: 'image/svg+xml', note: 'Übersicht Abbaugrenzen', blob: new Blob([svgPlan], { type: 'image/svg+xml' }) },
    { id: 'd2', parcelId: 'demo-D', name: 'Kaufvertrag_2015.txt', docType: 'Kaufvertrag', date: '2015-04-17', mime: 'text/plain', note: 'Original im Tresor, Ordner 3', blob: new Blob([txtVertrag], { type: 'text/plain' }) },
    { id: 'd3', parcelId: 'demo-I', name: 'Pachtvertrag_Fischereiverein.txt', docType: 'Pachtvertrag', date: '2018-12-01', mime: 'text/plain', note: 'Laufzeit 10 Jahre', blob: new Blob(['PACHTVERTRAG (Demo)\nPächter: Fischereiverein Musterau e. V.\nLaufzeit: 01.01.2019 – 31.12.2028\n'], { type: 'text/plain' }) },
  ].map((d) => ({ ...d, size: d.blob.size, addedAt: now }));

  return { parcels, comments, documents };
};
