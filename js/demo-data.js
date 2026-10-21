/* Fiktive Demo-Daten. Die Umrisse sind entlang der amtlichen Flurstücksgrenzen (Parzellarkarte) nachgezeichnet;
   Nummern, Namen und Kontaktdaten sind frei erfunden. */
window.DEMO_VERSION = 2; // erhöhen, wenn sich die Demo-Umrisse ändern
window.buildDemoData = function () {
  const G = {
    A: [[12.5649975,48.9414372], [12.568467,48.9416183], [12.5685066,48.9411532], [12.5650583,48.9409581]],
    B: [[12.5650583,48.9409581], [12.5685066,48.9411532], [12.5685681,48.9407586], [12.5650984,48.9405635]],
    C: [[12.560884,48.9348874], [12.565273,48.9348988], [12.5649833,48.9332644], [12.5606156,48.9332389]],
    D: [[12.565343,48.938802], [12.569412,48.9389685], [12.5695151,48.9384048], [12.5654892,48.9382664]],
    E: [[12.565551,48.9379282], [12.5695555,48.9380666], [12.5696178,48.9377847], [12.5656344,48.937604]],
    F: [[12.5734884,48.940206], [12.5744503,48.939994], [12.5749706,48.9378519], [12.5740709,48.937782]],
    G: [[12.560869,48.9358034], [12.5653222,48.9358147], [12.5652944,48.9348988], [12.560884,48.9348874]],
    H: [[12.5698051,48.9370096], [12.5718605,48.9370365], [12.5718506,48.9356133], [12.5697947,48.93553]],
    I: [[12.5722891,48.9370926], [12.5730816,48.9371344], [12.5730663,48.9349503], [12.572274,48.9349226]],
    J: [[12.5744503,48.939994], [12.5749203,48.9398528], [12.5753463,48.9395426], [12.5757719,48.9391618], [12.5759354,48.9380485], [12.5749706,48.9378519]],
    K: [[12.5686579,48.9413645], [12.5725127,48.9415171], [12.5725954,48.9410943], [12.5686548,48.9409136]],
    L: [[12.5686548,48.9409136], [12.5725954,48.9410943], [12.5726361,48.9407984], [12.568674,48.9406036]],
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
    p('A', { flurstueck: '1203', kategorie: 'eigen', status: 'reserve', nutzung: 'Ackerland', lage: 'Nordfeld', grundbuch: 'Blatt 2211', notiz: 'Reservefläche für Erweiterung Abbauabschnitt III. Kiesmächtigkeit lt. Bohrung ca. 9 m.' }),
    p('B', {
      flurstueck: '1204', kategorie: 'fremd', status: 'offen', nutzung: 'Ackerland', lage: 'Nordfeld',
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
    p('D', { flurstueck: '1188/2', kategorie: 'eigen', status: 'abbau', nutzung: 'Gewässer / Baggersee', lage: 'Baggersee Mitte', grundbuch: 'Blatt 1987', notiz: 'Nassabbau aktiv, Genehmigung bis 2031.' }),
    p('E', { flurstueck: '1188/3', kategorie: 'eigen', status: 'abbau', nutzung: 'Gewässer / Baggersee', lage: 'Baggersee Mitte', grundbuch: 'Blatt 1987' }),
    p('F', {
      flurstueck: '1240', kategorie: 'fremd', status: 'angefragt', nutzung: 'Ackerland', lage: 'Ostfeld',
      contacts: [c('c4', 'Eigentümer', 'Landwirtschaft Gruber GbR – Herr Franz Gruber', { address: 'Hofweg 1, 94300 Musterau', phone: '09421 000444' })],
    }),
    p('G', {
      flurstueck: '1172', kategorie: 'fremd', status: 'verkaufsbereit', nutzung: 'Ackerland', lage: 'Südfeld',
      contacts: [c('c5', 'Eigentümer', 'Anna Schmid', { address: 'Bahnhofstr. 7, 94315 Straubing', email: 'a.schmid@example.org' })],
    }),
    p('H', { flurstueck: '1190', kategorie: 'eigen', status: 'rekultiviert', nutzung: 'Gewässer / Baggersee', lage: 'Biotopweiher Ost', notiz: 'Als Ausgleichsfläche rekultiviert (Bescheid LRA 2019).' }),
    p('I', {
      flurstueck: '1195', kategorie: 'eigen', status: 'verpachtet', nutzung: 'Gewässer / Baggersee', lage: 'Fischweiher Ost',
      contacts: [c('c6', 'Pächter', 'Fischereiverein Musterau e. V. – 1. Vorstand K. Weber', { phone: '0151 0000555' })],
      notiz: 'Pachtvertrag läuft bis 31.12.2028.',
    }),
    p('J', {
      flurstueck: '1241', kategorie: 'fremd', status: 'abgelehnt', nutzung: 'Ackerland', lage: 'Ostfeld',
      contacts: [c('c7', 'Eigentümer', 'Stefan Bauer', { address: 'Am Anger 3, 94300 Musterau', phone: '09421 000666' })],
    }),
    p('K', { flurstueck: '1205', kategorie: 'eigen', status: 'geplant', nutzung: 'Ackerland', lage: 'Nordfeld', notiz: 'Abbauantrag in Vorbereitung.' }),
    p('L', { flurstueck: '1206', kategorie: 'eigen', status: 'abbau', nutzung: 'Betriebsfläche', lage: 'Betriebsgelände Kieswerk', grundbuch: 'Blatt 1987', notiz: 'Aufbereitungsanlage, Kieslager und Waage.' }),
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
