# Entgendern

Chrome-Erweiterung, die gegenderte Formulierungen auf Webseiten durch das generische Maskulinum ersetzt.

| Vorher | Nachher |
|---|---|
| Lehrer\*innen, Lehrer:innen, Lehrer_innen, Lehrer/-innen, LehrerInnen, Lehrer(innen) | Lehrer |
| Kolleg\*innen, Ärzt\*innen, Psycholog\*in | Kollegen, Ärzte, Psychologe |
| mit den Mitarbeiter\*innen | mit den Mitarbeitern |
| der\*die, er/sie, jede\*r, ein\*e, eine\*n | der, er, jeder, ein, einen |
| Fußgängerinnen und Fußgänger / Fußgänger und Fußgängerinnen | Fußgänger |
| die Lehrerin oder der Lehrer | der Lehrer |
| Schülerinnen- und Schülervertretung | Schülervertretung |
| Kund\*innenservice | Kundenservice |
| Mitarbeitende, Studierende, zu Fuß Gehende, Geflüchtete | Mitarbeiter, Studenten, Fußgänger, Flüchtlinge |
| Lehrkräfte, Lehrperson | Lehrer |
| Studierendenwerk | Studentenwerk |

Partizipformen werden über ein Wörterbuch (`PARTICIPLES` in `rules.js`) ersetzt, damit Wörter wie „Kalender“ oder „Wochenende“ unberührt bleiben. Etablierte Wörter wie „Auszubildende“, „Vorsitzende“ und „Alleinerziehende“ bleiben stehen.

Nicht ersetzt werden außerdem Text in Eingabefeldern, editierbaren Bereichen und Code-Blöcken sowie Singular-Paare mit „und“ („Die Präsidentin und der Präsident trafen sich“), weil damit meist zwei konkrete Personen gemeint sind.

## Installation

1. In Chrome `chrome://extensions` öffnen.
2. Oben rechts den **Entwicklermodus** einschalten.
3. **Entpackte Erweiterung laden** klicken und diesen Ordner auswählen.

Über das Icon in der Symbolleiste lässt sich die Erweiterung global oder pro Website abschalten. Dann wird der Originaltext wiederhergestellt. Die Zahl am Icon zeigt, wie viele Stellen auf der Seite angepasst wurden.

## Entwicklung

- `rules.js`: alle Ersetzungsregeln, unabhängig vom Browser
- `content.js`: wendet die Regeln auf die Seite an und beobachtet nachgeladene Inhalte
- `test/rules.test.js`: Tests, ausführen mit `node --test test/rules.test.js`
- `test/testseite.html`: Demoseite zum Ausprobieren im Browser. Damit die Erweiterung auf `file://`-Seiten läuft, muss in den Erweiterungsdetails „Zugriff auf Datei-URLs zulassen“ eingeschaltet sein.

Unregelmäßige Formen (Ärzt\*in → Arzt, Kolleg\*in → Kollege …) stehen in `IRREGULAR` in `rules.js` und lassen sich dort ergänzen.
