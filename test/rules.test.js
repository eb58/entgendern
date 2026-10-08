// Ausführen mit: node --test test/rules.test.js
const test = require('node:test');
const assert = require('node:assert');
const { entgendern } = require('../rules.js');

const cases = [
  // Gendersternchen, Doppelpunkt, Unterstrich, Schrägstrich, Klammern, Binnen-I
  ['Liebe Kolleg*innen', 'Liebe Kollegen'],
  ['Die Lehrer:innen und Schüler_innen', 'Die Lehrer und Schüler'],
  ['die Ärzt*innen', 'die Ärzte'],
  ['Hausärzt*innen', 'Hausärzte'],
  ['eine*n Ärzt*in', 'einen Arzt'],
  ['Der*die Nutzer*in', 'Der Nutzer'],
  ['die*der Nutzer:in', 'der Nutzer'],
  ['dem*der Nutzer*in', 'dem Nutzer'],
  ['er*sie hat', 'er hat'],
  ['sie/er hat', 'er hat'],
  ['jede*r Studierende', 'jeder Student'],
  ['Jede:r kann', 'Jeder kann'],
  ['jede(r) kann', 'jeder kann'],
  ['ein*e gute*r Lehrer*in', 'ein guter Lehrer'],
  ['StudentInnen', 'Studenten'],
  ['die StudentIn', 'die Student'],
  ['Bürger(innen)', 'Bürger'],
  ['Lehrer/-innen', 'Lehrer'],
  ['Lehrer/innen', 'Lehrer'],
  ['Lehrer·innen', 'Lehrer'],
  ['Psycholog*innen', 'Psychologen'],
  ['Psycholog*in', 'Psychologe'],
  ['Ingenieur*innen', 'Ingenieure'],
  ['Journalist*innen', 'Journalisten'],
  ['Kund*innenservice', 'Kundenservice'],
  ['Bürger*innenmeister', 'Bürgermeister'],
  ['Ärzt*innen-Verband', 'Ärzte-Verband'],
  ['EU-Bürger*innen', 'EU-Bürger'],
  ['der oder die Lehrer/in', 'der Lehrer'],
  // Dativ
  ['mit den Mitarbeiter*innen', 'mit den Mitarbeitern'],
  ['mit den neuen Lehrer*innen', 'mit den neuen Lehrern'],
  ['von Expert*innen', 'von Experten'],
  ['für Lehrer*innen', 'für Lehrer'],
  // Doppelnennungen
  ['Fußgängerinnen und Fußgänger', 'Fußgänger'],
  ['Fußgänger und Fußgängerinnen', 'Fußgänger'],
  ['Lehrerinnen und Lehrer', 'Lehrer'],
  ['Liebe Kolleginnen und Kollegen', 'Liebe Kollegen'],
  ['Ärztinnen und Ärzte', 'Ärzte'],
  ['Bäuerinnen und Bauern', 'Bauern'],
  ['Jüdinnen und Juden', 'Juden'],
  ['Studentinnen und Studenten', 'Studenten'],
  ['Bürgerinnen und Bürgern', 'Bürgern'],
  ['Schülerinnen bzw. Schüler', 'Schüler'],
  ['Lehrerinnen/Lehrer', 'Lehrer'],
  ['die Lehrerin oder der Lehrer', 'der Lehrer'],
  ['Die Lehrerin oder der Lehrer', 'Der Lehrer'],
  ['der Lehrer oder die Lehrerin', 'der Lehrer'],
  ['Ärztin oder Arzt', 'Arzt'],
  ['Schülerinnen- und Schülervertretung', 'Schülervertretung'],
  ['Schüler- und Schülerinnenvertretung', 'Schülervertretung'],
  // Muss unverändert bleiben
  ['Die Präsidentin und der Präsident trafen sich.', null],
  ['Medizin und Mediziner', null],
  ['Termin und Termine', null],
  ['Berlin und Berliner', null],
  ['Achtung:In der Nacht', null],
  ['Folge uns auf LinkedIn', null],
  ['das PlugIn installieren', null],
  ['Sie und er', null],
  ['und/oder', null],
  ['Uhrzeit 12:30', null],
  ['innen und außen', null],
  // Partizipien und andere Ersatzwörter
  ['Liebe Mitarbeitende', 'Liebe Mitarbeiter'],
  ['Die Studierenden', 'Die Studenten'],
  ['die Mitarbeitenden', 'die Mitarbeiter'],
  ['mit den Mitarbeitenden', 'mit den Mitarbeitern'],
  ['Studierende', 'Studenten'],
  ['die Studierende', 'der Student'],
  ['Eine Studierende', 'Ein Student'],
  ['ein Studierender', 'ein Student'],
  ['Studierende*r', 'Student'],
  ['des Mitarbeitenden', 'des Mitarbeiters'],
  ['dem Studierenden', 'dem Studenten'],
  ['Studierendenwerk', 'Studentenwerk'],
  ['Teilnehmendenliste', 'Teilnehmerliste'],
  ['Projektmitarbeitende', 'Projektmitarbeiter'],
  ['Radfahrende und zu Fuß Gehende', 'Radfahrer und Fußgänger'],
  ['Zuschauende', 'Zuschauer'],
  ['Anwohnende', 'Anwohner'],
  ['Geflüchtete', 'Flüchtlinge'],
  ['den Geflüchteten', 'den Flüchtlingen'],
  ['Geflüchtetenunterkunft', 'Flüchtlingsunterkunft'],
  ['Lehrkräfte', 'Lehrer'],
  ['den Lehrkräften', 'den Lehrern'],
  ['eine Lehrkraft', 'ein Lehrer'],
  ['Grundschullehrkräfte', 'Grundschullehrer'],
  ['Alleinerziehende', null],
  ['Teilnehmende Länder', null],
  ['pflegende Angehörige', null],
  ['Auszubildende und Vorsitzende', null],
  ['Kalender, Legenden, Absender, Wochenende', null],
];

for (const [input, expected] of cases) {
  test(input, () => {
    assert.strictEqual(entgendern(input).text, expected === null ? input : expected);
  });
}

test('zählt Ersetzungen', () => {
  assert.strictEqual(entgendern('Lehrer*innen und Schüler*innen').count, 2);
  assert.strictEqual(entgendern('Nichts zu tun').count, 0);
});
