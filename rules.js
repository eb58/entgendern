/*
 * Entgendern – Ersetzungsregeln.
 * Läuft als Content Script im Browser und unter Node (für die Tests).
 */
(function (root) {
  'use strict';

  // Kein Buchstabe/keine Ziffer davor bzw. danach (\b ist in JS nicht Unicode-fähig).
  const NB = '(?<![\\p{L}\\p{N}])';
  const NA = '(?![\\p{L}\\p{N}])';
  // Großgeschriebener Wortstamm (Substantiv), darf Bindestriche enthalten ("EU-Bürger").
  const STEM = '(?<stem>\\p{Lu}[\\p{L}-]*?\\p{L})';

  // Stämme, deren Formen sich nicht aus einer Endungsregel ergeben.
  // Schlüssel: Ende des Stamms vor "in"/"innen" → [Singular, Plural]
  const IRREGULAR = {
    'ärzt': ['arzt', 'ärzte'],
    'köch': ['koch', 'köche'],
    'anwält': ['anwalt', 'anwälte'],
    'bäuer': ['bauer', 'bauern'],
    'bauer': ['bauer', 'bauern'],
    'gäst': ['gast', 'gäste'],
    'rät': ['rat', 'räte'],
    'jüd': ['jude', 'juden'],
    'gött': ['gott', 'götter'],
    'bischöf': ['bischof', 'bischöfe'],
    'herzög': ['herzog', 'herzöge'],
    'gräf': ['graf', 'grafen'],
    'schwäger': ['schwager', 'schwager'],
    'französ': ['franzose', 'franzosen'],
    'beamt': ['beamter', 'beamte'],
    'freund': ['freund', 'freunde'],
    'feind': ['feind', 'feinde'],
    'könig': ['könig', 'könige'],
    'wirt': ['wirt', 'wirte'],
    'muslim': ['muslim', 'muslime'],
    'spion': ['spion', 'spione'],
    'diakon': ['diakon', 'diakone'],
    'nachbar': ['nachbar', 'nachbarn'],
    'ungar': ['ungar', 'ungarn'],
    'bayer': ['bayer', 'bayern'],
    'schwäb': ['schwabe', 'schwaben'],
    'offizier': ['offizier', 'offiziere'],
    'passagier': ['passagier', 'passagiere'],
    'kurier': ['kurier', 'kuriere'],
    'pionier': ['pionier', 'pioniere'],
    // Maskulinum auf -e
    'kolleg': ['kollege', 'kollegen'],
    'kund': ['kunde', 'kunden'],
    'expert': ['experte', 'experten'],
    'zeug': ['zeuge', 'zeugen'],
    'erb': ['erbe', 'erben'],
    'genoss': ['genosse', 'genossen'],
    'gefährt': ['gefährte', 'gefährten'],
    'bot': ['bote', 'boten'],
    'lots': ['lotse', 'lotsen'],
    'sklav': ['sklave', 'sklaven'],
    'hirt': ['hirte', 'hirten'],
    'vorfahr': ['vorfahre', 'vorfahren'],
    'russ': ['russe', 'russen'],
    'türk': ['türke', 'türken'],
    'griech': ['grieche', 'griechen'],
    'schwed': ['schwede', 'schweden'],
    'dän': ['däne', 'dänen'],
    'chines': ['chinese', 'chinesen'],
    'kurd': ['kurde', 'kurden'],
  };
  const IRREGULAR_KEYS = Object.keys(IRREGULAR).sort((a, b) => b.length - a.length);

  // Wörter, vor denen ein Plural im Dativ steht ("mit den Lehrer*innen" → "Lehrern").
  const DATIVE_CUES = new Set([
    'den', 'allen', 'vielen', 'diesen', 'jenen', 'unseren', 'euren', 'ihren', 'seinen',
    'deinen', 'meinen', 'keinen', 'mehreren', 'einigen', 'wenigen', 'beiden', 'anderen',
    'solchen', 'welchen', 'zahlreichen', 'mit', 'von', 'zu', 'bei', 'aus', 'nach', 'seit',
    'gegenüber', 'samt', 'nebst',
  ]);

  // Englische Binnenmajuskel-Wörter, die keine Gender-Formen sind ("LinkedIn", "PlugIn").
  const BINNEN_I_IGNORE = new Set([
    'linked', 'plug', 'log', 'sign', 'check', 'built', 'add', 'opt', 'walk', 'drive',
    'stand', 'sit', 'teach', 'love', 'fade', 'zoom', 'roll', 'break', 'cash', 'dial',
    'drop', 'fly', 'lock', 'phase', 'punch', 'tune', 'weigh', 'work', 'join', 'run',
    'step', 'slip', 'pop', 'kick', 'fill', 'print', 'pull', 'put', 'cut', 'tie', 'stay',
    'sleep', 'burn', 'dig', 'buy', 'spin', 'tap', 'all', 'mail', 'swipe', 'login',
  ]);

  // Artikel/Pronomen für Paarformen wie "der*die", "er/sie", "dem:der".
  // 2 = eindeutig maskulin, 1 = maskulin, aber auch feminin möglich, 0 = feminin
  const FUNCTION_WORDS = {
    dem: 2, den: 2, des: 2, er: 2, ihm: 2, ihn: 2,
    sein: 2, seine: 2, seiner: 2, seinem: 2, seinen: 2, seines: 2,
    ein: 2, einen: 2, einem: 2, eines: 2,
    jedem: 2, jeden: 2, jedes: 2, diesem: 2, diesen: 2, dieses: 2,
    keinem: 2, keinen: 2, keines: 2,
    der: 1, jeder: 1, dieser: 1, keiner: 1, einer: 1,
    die: 0, sie: 0, ihr: 0, ihre: 0, ihrer: 0, ihrem: 0, ihren: 0, ihres: 0,
    eine: 0, jede: 0, diese: 0, keine: 0,
  };

  const FEM_TO_MASC_ARTICLE = { die: 'der', eine: 'ein', keine: 'kein', jede: 'jeder', diese: 'dieser' };
  const FEM_ART = '[Dd]ie|[Ee]ine|[Kk]eine|[Jj]ede|[Dd]iese';

  // Substantivierte Partizipien → maskuline Form. Schlüssel: Partizipstamm (ohne Endung),
  // passt auch am Wortende ("Projektmitarbeitende"). Werte: [Singular, Plural, Kompositionsform]
  const PARTICIPLES = {
    mitarbeitend: ['mitarbeiter', 'mitarbeiter'],
    teilnehmend: ['teilnehmer', 'teilnehmer'],
    studierend: ['student', 'studenten'],
    dozierend: ['dozent', 'dozenten'],
    promovierend: ['doktorand', 'doktoranden'],
    lehrend: ['lehrer', 'lehrer'],
    unterrichtend: ['lehrer', 'lehrer'],
    forschend: ['forscher', 'forscher'],
    lesend: ['leser', 'leser'],
    nutzend: ['nutzer', 'nutzer'],
    wählend: ['wähler', 'wähler'],
    besuchend: ['besucher', 'besucher'],
    schauend: ['schauer', 'schauer'],
    hörend: ['hörer', 'hörer'],
    radfahrend: ['radfahrer', 'radfahrer'],
    autofahrend: ['autofahrer', 'autofahrer'],
    radelnd: ['radfahrer', 'radfahrer'],
    fußgehend: ['fußgänger', 'fußgänger'],
    zufußgehend: ['fußgänger', 'fußgänger'],
    arbeitnehmend: ['arbeitnehmer', 'arbeitnehmer'],
    arbeitgebend: ['arbeitgeber', 'arbeitgeber'],
    zahlend: ['zahler', 'zahler'],
    kunstschaffend: ['künstler', 'künstler'],
    pflegend: ['pfleger', 'pfleger'],
    helfend: ['helfer', 'helfer'],
    spendend: ['spender', 'spender'],
    wandernd: ['wanderer', 'wanderer'],
    erziehend: ['erzieher', 'erzieher'],
    wohnend: ['wohner', 'wohner'],
    beratend: ['berater', 'berater'],
    kaufend: ['käufer', 'käufer'],
    sprechend: ['sprecher', 'sprecher'],
    leitend: ['leiter', 'leiter'],
    musizierend: ['musiker', 'musiker'],
    programmierend: ['programmierer', 'programmierer'],
    entwickelnd: ['entwickler', 'entwickler'],
    gestaltend: ['gestalter', 'gestalter'],
    verbrauchend: ['verbraucher', 'verbraucher'],
    anbietend: ['anbieter', 'anbieter'],
    bewerbend: ['bewerber', 'bewerber'],
    mietend: ['mieter', 'mieter'],
    pendelnd: ['pendler', 'pendler'],
    schreibend: ['autor', 'autoren'],
    demonstrierend: ['demonstrant', 'demonstranten'],
    protestierend: ['demonstrant', 'demonstranten'],
    geflüchtet: ['flüchtling', 'flüchtlinge', 'flüchtlings'],
  };
  // Etablierte Wörter, die bleiben ("Alleinerziehende" ist kein Ersatzwort).
  const PARTICIPLE_KEEP = new Set(['alleinerziehend']);
  // Andere Ersatzwörter: [maskuline Form, Numerus]
  const NEUTRAL_WORDS = {
    lehrkraft: ['lehrer', 'sg'],
    lehrkräfte: ['lehrer', 'pl'],
    lehrkräften: ['lehrer', 'pl'],
    lehrperson: ['lehrer', 'sg'],
    lehrpersonen: ['lehrer', 'pl'],
    ansprechperson: ['ansprechpartner', 'sg'],
    ansprechpersonen: ['ansprechpartner', 'pl'],
  };
  // Nach diesen Wörtern ist "-e" Singular ("die Studierende") und "-en" Singular ("dem Studierenden").
  const SG_BEFORE_E = new Set(['der', 'die', 'jede', 'jeder', 'diese', 'dieser', 'jene', 'jener', 'eine', 'keine', 'welche', 'welcher']);
  const SG_BEFORE_EN = new Set(['des', 'dem', 'einem', 'einen', 'eines', 'jedem', 'jedes', 'diesem', 'dieses', 'keinem', 'keines', 'jenem']);
  const GENITIVE_SG = new Set(['des', 'eines', 'jedes', 'dieses', 'keines']);

  function keyPattern(keys) {
    return keys
      .sort((a, b) => b.length - a.length)
      .map((k) => `[${k[0].toUpperCase()}${k[0]}]${k.slice(1)}`)
      .join('|');
  }

  // Artikel/Begleiter vor Doppelnennungen ("Liebe Kolleginnen und Kollegen").
  const ART_WORDS = [
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
    'jede', 'jeder', 'jeden', 'jedem', 'alle', 'allen', 'viele', 'vielen', 'liebe', 'lieber',
    'lieben', 'geehrte', 'geehrter', 'geehrten', 'unsere', 'unser', 'unseren', 'unserer',
    'unserem', 'ihre', 'ihren', 'ihrer', 'ihrem', 'seine', 'seinen', 'seiner', 'seinem',
    'diese', 'dieser', 'diesen', 'diesem', 'keine', 'keiner', 'keinen',
  ];
  const ART = ART_WORDS
    .sort((a, b) => b.length - a.length)
    .map((w) => `[${w[0].toUpperCase()}${w[0]}]${w.slice(1)}`)
    .join('|');
  const SEP = '(?<sep>\\s+(?:und|oder|bzw\\.|beziehungsweise|sowie)\\s+|\\s*[&/]\\s*)';

  // ---------- Hilfsfunktionen ----------

  function deumlaut(s) {
    return s.replace(/[äöüÄÖÜ]/g, (c) => ({ ä: 'a', ö: 'o', ü: 'u', Ä: 'A', Ö: 'O', Ü: 'U' })[c]);
  }
  function norm(s) {
    return deumlaut(s.toLowerCase());
  }
  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function isUpper(s) {
    return /^\p{Lu}/u.test(s);
  }

  /** Maskuline Singular- und Pluralform zum Stamm vor "*in"/"*innen". */
  function maskForms(stem) {
    const lower = stem.toLowerCase();
    for (const key of IRREGULAR_KEYS) {
      if (lower.endsWith(key)) {
        const prefix = stem.slice(0, stem.length - key.length);
        const fix = (w) => (prefix && !prefix.endsWith('-') ? prefix + w : prefix + capitalize(w));
        const [sg, pl] = IRREGULAR[key];
        return { sg: fix(sg), pl: fix(pl) };
      }
    }
    if (/(er|el|en)$/.test(lower)) return { sg: stem, pl: stem }; // Lehrer, Mitarbeiter
    if (/og$/.test(lower)) return { sg: stem + 'e', pl: stem + 'en' }; // Psychologe
    if (/(eur|är|ar|ör)$/.test(lower)) return { sg: stem, pl: stem + 'e' }; // Ingenieure, Funktionäre
    if (/e$/.test(lower)) return { sg: stem, pl: stem + 'n' };
    return { sg: stem, pl: stem + 'en' }; // Studenten, Journalisten, Autoren
  }

  /** Steht vor der Fundstelle ein Wort, das Dativ Plural verlangt? */
  function isDativeContext(str, offset) {
    const before = str.slice(Math.max(0, offset - 80), offset);
    if (!/\s$/.test(before)) return false;
    const words = before.match(/\p{L}+/gu) || [];
    for (let i = words.length - 1, steps = 0; i >= 0 && steps < 3; i--, steps++) {
      if (DATIVE_CUES.has(words[i].toLowerCase())) return true;
      // Dazwischen nur Adjektive auf -en ("den neuen Lehrer*innen")
      if (!/^\p{Ll}+en$/u.test(words[i])) return false;
    }
    return false;
  }

  /** Ist `word` die maskuline Form zum femininen Stamm `stem`? (Ärzt → Arzt, Ärzte) */
  function related(stem, word) {
    const s = norm(stem);
    const w = norm(word);
    return s.length >= 3 && w.startsWith(s) && w.length - s.length <= 2;
  }

  function nounReplacement(g, match, offset, str) {
    if (g.stem.replace(/-/g, '').length < 3) return null;
    const forms = maskForms(g.stem);
    if (g.sg) return forms.sg;
    if (g.rest) return forms.pl + g.rest; // Kompositum: Kund*innenservice → Kundenservice
    let pl = forms.pl;
    const nextChar = str.charAt(offset + match.length);
    if (nextChar !== '-' && !/[ns]$/.test(pl) && isDativeContext(str, offset)) pl += 'n';
    return pl;
  }

  /** Wort direkt vor `offset` (nur durch Leerraum getrennt), klein geschrieben. */
  function prevWord(str, offset) {
    const m = str.slice(Math.max(0, offset - 40), offset).match(/(\p{L}+)\s+$/u);
    return m ? m[1].toLowerCase() : '';
  }

  /** Präfix + Wörterbuchform, groß geschrieben, wenn sie am Wortanfang steht. */
  function withPrefix(prefix, word) {
    return prefix && !prefix.endsWith('-') ? prefix + word : (prefix || '') + capitalize(word);
  }

  function mascArticle(art) {
    const masc = FEM_TO_MASC_ARTICLE[art.toLowerCase()];
    return isUpper(art) ? capitalize(masc) : masc;
  }

  /** Ersatz für substantivierte Partizipien: Mitarbeitende, Studierenden, Geflüchteter … */
  function participleReplacement(g, match, offset, str) {
    if (!g.prefix && !isUpper(g.key)) return null; // Adjektiv: "pflegende Angehörige"
    const full = (g.prefix || '') + g.key;
    if (PARTICIPLE_KEEP.has(full.toLowerCase())) return null;
    // Längsten passenden Eintrag nehmen ("Zufußgehende" nicht als "Zu" + "fußgehend")
    const key = Object.keys(PARTICIPLES)
      .filter((k) => full.toLowerCase().endsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    const prefix = full.slice(0, full.length - key.length);
    // Adjektivisch vor einem Substantiv: "Teilnehmende Länder"
    if (/^\s+\p{Lu}/u.test(str.slice(offset + match.length))) return null;
    if (g.rest && g.infl !== 'en') return null;

    const [sgBase, plBase, compBase] = PARTICIPLES[key];
    const sg = withPrefix(prefix, sgBase);
    const pl = withPrefix(prefix, plBase);
    if (g.rest) return withPrefix(prefix, compBase || plBase) + g.rest; // Studierendenwerk

    const prev = g.art ? g.art.toLowerCase() : prevWord(str, offset);
    let singular;
    let oblique = false;
    if (g.infl === 'er') singular = true;
    else if (g.infl === 'em' || g.infl === 'es') singular = oblique = true;
    else if (g.infl === 'e') singular = SG_BEFORE_E.has(prev);
    else singular = oblique = SG_BEFORE_EN.has(prev);

    if (singular) {
      let word = sg;
      if (oblique) {
        const weak = pl === sg + 'en' || pl === sg + 'n'; // dem Studenten
        if (weak) word = pl;
        else if (g.infl === 'es' || GENITIVE_SG.has(prev)) word = sg + 's'; // des Mitarbeiters
      }
      return g.art ? `${mascArticle(g.art)} ${word}` : word;
    }
    let word = pl;
    if (!/[ns]$/.test(word) && isDativeContext(str, offset)) word += 'n';
    return g.art ? `${g.art} ${word}` : word;
  }

  // ---------- Regeln (Reihenfolge ist wichtig) ----------

  const RULES = [
    // der*die, er/sie, dem:der, ihr*sein …
    {
      re: new RegExp(`${NB}(?<a>\\p{L}+)(?:[*_·•:]|\\/-?)(?<b>\\p{L}+)${NA}`, 'gu'),
      fn(g) {
        const sa = FUNCTION_WORDS[g.a.toLowerCase()];
        const sb = FUNCTION_WORDS[g.b.toLowerCase()];
        if (sa === undefined || sb === undefined || sa === sb) return null;
        const pick = sa > sb ? g.a : g.b;
        return isUpper(g.a) ? capitalize(pick) : pick;
      },
    },
    // "der oder die", "ein bzw. eine"
    {
      re: new RegExp(`${NB}(?<a>[Dd]er|[Dd]ie|[Dd]em|[Dd]en|[Dd]es|[Ee]ine?[mnrs]?|[Ee]r|[Ss]ie)\\s+(?:oder|bzw\\.)\\s+(?<b>der|die|dem|den|des|eine?[mnrs]?|er|sie)${NA}`, 'gu'),
      fn(g) {
        const sa = FUNCTION_WORDS[g.a.toLowerCase()];
        const sb = FUNCTION_WORDS[g.b.toLowerCase()];
        if (sa === undefined || sb === undefined || sa === sb) return null;
        const pick = sa > sb ? g.a : g.b;
        return isUpper(g.a) ? capitalize(pick) : pick;
      },
    },
    // jede*r, eine:n, Studierende*r, jede(r), jede/r
    {
      re: new RegExp(`${NB}(?<w>\\p{L}*\\p{Ll}e)(?:[*_·•:]|\\/-?|\\()(?<e>[rn])\\)?${NA}`, 'gu'),
      fn: (g) => g.w + g.e,
    },
    // ein*e, kein:e, ihr(e)
    {
      re: new RegExp(`${NB}(?<w>[EeKkMmDdSs]?ein|[Ii]hr|[Uu]nser|[Ee]uer)(?:[*_·•:]|\\/-?|\\()e\\)?${NA}`, 'gu'),
      fn: (g) => g.w,
    },
    // Lehrer*innen, Lehrer_innen, Lehrer/-innen, Lehrer·in, Lehrer*innenzimmer
    {
      re: new RegExp(`${NB}${STEM}(?:[*_·•]|\\/-?)(?:innen(?<rest>\\p{Ll}*)|Innen|(?<sg>[Ii]n))${NA}`, 'gu'),
      fn: nounReplacement,
    },
    // Lehrer:innen (nur klein, damit "Achtung:In der Nacht" unberührt bleibt)
    {
      re: new RegExp(`${NB}${STEM}:(?:innen(?<rest>\\p{Ll}*)|(?<sg>in))${NA}`, 'gu'),
      fn: nounReplacement,
    },
    // Lehrer(innen), Lehrer(in), Lehrer(-innen)
    {
      re: new RegExp(`${NB}${STEM}\\(-?(?:innen\\)(?<rest>\\p{Ll}*)|(?<sg>in)\\))`, 'gu'),
      fn: nounReplacement,
    },
    // Binnen-I: LehrerInnen, StudentIn
    {
      re: new RegExp(`${NB}(?<stem>\\p{Lu}[\\p{L}-]*?\\p{Ll})(?:Innen(?<rest>\\p{Ll}*)|(?<sg>In))${NA}`, 'gu'),
      fn(g, match, offset, str) {
        if (BINNEN_I_IGNORE.has(g.stem.toLowerCase())) return null;
        return nounReplacement(g, match, offset, str);
      },
    },
    // Schülerinnen- und Schülervertretung → Schülervertretung
    {
      re: new RegExp(`${NB}${STEM}innen-${SEP}(?<word>\\p{Lu}[\\p{L}-]*\\p{L})${NA}`, 'gu'),
      fn: (g) => (norm(g.word).startsWith(norm(g.stem)) && norm(g.stem).length >= 3 ? g.word : null),
    },
    // Schüler- und Schülerinnenvertretung → Schülervertretung
    {
      re: new RegExp(`${NB}(?<word>\\p{Lu}\\p{L}*\\p{L})-${SEP}${STEM}innen(?<rest>\\p{Ll}+)${NA}`, 'gu'),
      fn: (g) => (related(g.stem, g.word) ? g.word + g.rest : null),
    },
    // Mitarbeitende, Studierenden, Geflüchtete, Studierendenwerk
    {
      re: new RegExp(`${NB}(?:(?<art>${FEM_ART})\\s+)?(?<prefix>\\p{Lu}[\\p{L}-]*?)?(?<key>${keyPattern(Object.keys(PARTICIPLES))})(?<infl>en|er|em|es|e)(?<rest>\\p{Ll}*)${NA}`, 'gu'),
      fn: participleReplacement,
    },
    // Lehrkräfte, Lehrperson, Ansprechpersonen
    {
      re: new RegExp(`${NB}(?:(?<art>${FEM_ART})\\s+)?(?<prefix>\\p{Lu}[\\p{L}-]*?)?(?<key>${keyPattern(Object.keys(NEUTRAL_WORDS))})${NA}`, 'gu'),
      fn(g, match, offset, str) {
        if (!g.prefix && !isUpper(g.key)) return null;
        const [base, number] = NEUTRAL_WORDS[g.key.toLowerCase()];
        let word = withPrefix(g.prefix || '', base);
        if (number === 'sg') return g.art ? `${mascArticle(g.art)} ${word}` : word;
        if (isDativeContext(str, offset)) word += 'n';
        return g.art ? `${g.art} ${word}` : word;
      },
    },
    // Fußgängerinnen und Fußgänger, die Lehrerin oder der Lehrer
    {
      re: new RegExp(`${NB}(?:(?<a1>${ART})\\s+)?${STEM}(?:(?<pl>innen)|in)${SEP}(?:(?<a2>${ART})\\s+)?(?<word>\\p{Lu}[\\p{L}-]*\\p{L})${NA}`, 'gu'),
      fn(g) {
        const singular = !g.pl;
        // "Die Präsidentin und der Präsident" sind meist zwei konkrete Personen.
        if (singular && /^(und|sowie|&)$/.test(g.sep.trim())) return null;
        if (!related(g.stem, g.word)) return null;
        let art = g.a2 || g.a1;
        if (g.a1 && g.a2 && isUpper(g.a1)) art = capitalize(g.a2);
        if (singular && g.a1 && !g.a2) {
          const masc = FEM_TO_MASC_ARTICLE[g.a1.toLowerCase()];
          if (masc) art = isUpper(g.a1) ? capitalize(masc) : masc;
        }
        return art ? `${art} ${g.word}` : g.word;
      },
    },
    // Fußgänger und Fußgängerinnen, der Lehrer oder die Lehrerin
    {
      re: new RegExp(`${NB}(?:(?<a1>${ART})\\s+)?(?<word>\\p{Lu}[\\p{L}-]*\\p{L})${SEP}(?:(?<a2>${ART})\\s+)?${STEM}(?:(?<pl>innen)|in)${NA}`, 'gu'),
      fn(g) {
        if (!g.pl && /^(und|sowie|&)$/.test(g.sep.trim())) return null;
        if (!related(g.stem, g.word)) return null;
        return g.a1 ? `${g.a1} ${g.word}` : g.word;
      },
    },
  ];

  // Schneller Vorfilter: Texte ohne diese Zeichen können nichts Gegendertes enthalten.
  const QUICK_CHECK = /[*_·•:/(]|in|oder|bzw|nd|flüchtet|lehrkr|person/i;

  /**
   * Entgendert einen Text.
   * @returns {{text: string, count: number}}
   */
  function entgendern(text) {
    if (!text || !QUICK_CHECK.test(text)) return { text, count: 0 };
    let count = 0;
    // "zu Fuß Gehende" → "Zufußgehende", wird dann von der Partizipregel zu "Fußgänger"
    text = text.replace(/(?<![\p{L}\p{N}])[Zz]u\s+Fuß\s+Gehend(?=e)/gu, 'Zufußgehend');
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      text = text.replace(rule.re, (...args) => {
        const groups = args[args.length - 1];
        const str = args[args.length - 2];
        const offset = args[args.length - 3];
        const match = args[0];
        const out = rule.fn(groups, match, offset, str);
        if (out == null || out === match) return match;
        count++;
        return out;
      });
    }
    return { text, count };
  }

  const api = { entgendern, maskForms };
  root.Entgendern = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
