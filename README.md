# Flurstücks-Inventar (Prototyp)

Web-App für ein Kieswerk zur Verwaltung eigener und fremder Flurstücke – mit Karte, Liste,
Dokumentenablage, Kontaktverlauf und Wiedervorlagen.

## Starten

Es ist kein Server und keine Installation nötig:

- **Einfach:** `index.html` im Browser (Chrome, Edge, Firefox) öffnen.
- **Empfohlen:** lokal über einen Webserver starten, z. B. `python3 -m http.server 8000`, dann
  <http://localhost:8000> öffnen.

Beim ersten Start werden fiktive Demo-Daten (Region Straubing, „Gemarkung Musterau“) geladen.
Über **Daten ▾ → Alle Daten löschen** startet man mit einem leeren Bestand.

## Online ansehen

- **Mit voller Karte (GitHub Pages):** Im Repository unter *Settings → Pages* bei „Build and deployment“
  *Deploy from a branch* wählen, Branch `claude/optimistic-dijkstra-2gegxu`, Ordner `/ (root)`, speichern.
  Nach 1–2 Minuten läuft die App unter <https://anobdrmras.github.io/Geodata/>.
- **Vorschau auf claude.ai:** Dort funktionieren alle Funktionen außer dem Kartenhintergrund (Luftbild und
  Flurstücksgrenzen), weil die Seite keine Kacheln von fremden Servern laden darf.

## Funktionen

| Bereich | Was geht |
|---|---|
| **Karte** | Luftbild Bayern (DOP40) und gelbe Flurstücksgrenzen (ALKIS-Parzellarkarte) als Open-Data-Dienste der Bayerischen Vermessungsverwaltung; alternativ OpenStreetMap. Erfasste Flurstücke farbig nach Status (eigene durchgezogen, fremde gestrichelt). Klick auf ein Flurstück öffnet die Details. Suche nach Nummer, Gemarkung oder Eigentümer. |
| **Flurstück erfassen** | „+ Flurstück“ oder Klick in die Karte → Umriss entlang der gelben Grenzen einzeichnen → Fläche wird automatisch berechnet. Link „BayernAtlas ↗“ springt zur gleichen Stelle im BayernAtlas. |
| **Eigene Flurstücke** | Status (Abbau aktiv, geplant, Reserve, rekultiviert, verpachtet), Grundbuch, Nutzung, Notiz. Dokumente (Pläne, Verträge, Urkunden, Grundbuchauszüge, Bescheide, Fotos …) per Drag & Drop hochladen, öffnen, herunterladen. Kontakte wie Pächter oder Behörden. |
| **Fremde Flurstücke** | Eigentümer mit Anschrift, Telefon, E-Mail (mehrere je Flurstück, z. B. Erbengemeinschaft). Akquise-Status (nicht angefragt, angefragt, verkaufsbereit, in Verhandlung, kein Interesse). „Als erworben markieren“ macht daraus ein eigenes Flurstück. |
| **Verlauf / Kommentare** | Datierte Einträge (Notiz, Telefonat, Besuch, Brief, Angebot …) mit Autor. Optional Wiedervorlage-Datum („in 3/6/12 Monaten“). |
| **Wiedervorlagen** | Alle offenen Nachfass-Termine, fällige rot markiert, mit Zähler in der Kopfzeile. |
| **Liste** | Kennzahlen (Anzahl/Fläche eigen, fremd, in Verhandlung, fällige Wiedervorlagen), Suche, Filter, Sortierung. |
| **Daten** | Sicherung als JSON (inkl. Dokumente) exportieren/importieren, CSV für Excel, GeoJSON-Export, **GeoJSON-Import** von Flurstücksgeometrien. |

## Amtliche Flurstücksgeometrien übernehmen

Die gelben Grenzen in der Karte sind ein Bild (WMS) – die App kann daraus keine Flächen „anklicken“.
Für eine saubere Übernahme gibt es zwei Wege:

1. **Einzeln nachzeichnen** (eingebaut): Umriss entlang der gelben Linien anklicken.
2. **Massenimport** (eingebaut): Flurstücke als GeoJSON importieren. Quellen:
   - ALKIS-Daten des eigenen Bestands beim Amt für Digitalisierung, Breitband und Vermessung (ADBV) anfragen
     bzw. über <https://geodaten.bayern.de/opengeodata/> beziehen,
   - in QGIS öffnen, gewünschte Flurstücke auswählen, „Exportieren → GeoJSON“ mit **KBS EPSG:4326**.
   - Erkannte Spalten: `flurstueck`/`flstnrzae`(+`flstnrnen`), `gemarkung`, `flaeche`/`amtlflsfl`, `lage`, `kategorie` (`eigen`/`fremd`).

## Technik

- Reines HTML/CSS/JavaScript, Kartenbibliothek [Leaflet 1.9.4](https://leafletjs.com) liegt in `vendor/`.
- Daten liegen **nur lokal im Browser** (IndexedDB). Anderer Browser/PC = anderer Datenbestand.
  Deshalb regelmäßig **Daten ▾ → Sicherung exportieren**.
- Kartendienste und Auswahllisten (Status, Dokumentarten …) stehen in `js/config.js`.

```
index.html        Oberfläche
css/style.css     Gestaltung
js/config.js      Kartendienste, Status, Auswahllisten
js/app.js         Logik (Karte, Liste, Details, Import/Export)
js/db.js          lokale Datenbank (IndexedDB)
js/utm.js         Koordinaten UTM32 / Flächenberechnung
js/demo-data.js   fiktive Beispieldaten
```

## Grenzen des Prototyps / nächste Schritte

- **Mehrbenutzerbetrieb:** Für mehrere Mitarbeiter braucht es einen Server mit Datenbank
  (z. B. PostgreSQL/PostGIS) und Dateispeicher, Benutzeranmeldung und Rechte.
- **Datenschutz:** Eigentümerdaten sind personenbezogen (DSGVO). Im Echtbetrieb: Zugriffsschutz,
  Löschkonzept, Verzeichnis der Verarbeitungstätigkeiten. Grundbuchdaten nur im Rahmen des berechtigten Interesses nutzen.
- **Amtliche Daten:** Abgleich mit ALKIS (Flurstückskennzeichen, amtliche Fläche) statt manueller Eingabe.
- **Kartendienste:** Die Layernamen in `js/config.js` (`by_dop40c`, `by_alkis_parzellarkarte_umr_gelb`)
  konnten in der Entwicklungsumgebung nicht online geprüft werden. Falls Karte oder Grenzen grau bleiben:
  `https://geoservices.bayern.de/od/wms/alkis/v1/parzellarkarte?SERVICE=WMS&REQUEST=GetCapabilities` im Browser
  öffnen und den Layernamen anpassen. Daten der Bayerischen Vermessungsverwaltung: Lizenz CC BY 4.0.
