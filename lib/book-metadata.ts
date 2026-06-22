import type { ContextNote, SourceLink } from "@/lib/app-data";
import { resolveAppLocale } from "@/lib/content";


export type BookMetadata = {
  code: string;
  title: string;
  genre: string;
  notes: {
    authorship: ContextNote;
    date: ContextNote;
    place: ContextNote;
    audience: ContextNote;
  };
};

type GroupProfile = {
  genre: string;
  authorship: Omit<ContextNote, "title" | "sources">;
  date: Omit<ContextNote, "title" | "sources">;
  place: Omit<ContextNote, "title" | "sources">;
  audience: Omit<ContextNote, "title" | "sources">;
};

const COMMON_SOURCES = {
  metadata: [
    { label: "STEPBible data", url: "https://github.com/STEPBible/STEPBible-Data" },
    { label: "Bible Cross References project", url: "https://crossreferences.org/project/" },
  ],
  place: [
    { label: "OpenBible geocoding", url: "https://www.openbible.info/geo/" },
    { label: "STEPBible places", url: "https://www.stepbible.org/html/places.html" },
  ],
};

// Wikipedia article names for each book (English Wikipedia)
const WIKI_ARTICLES: Record<string, string> = {
  GEN: "Book_of_Genesis", EXO: "Book_of_Exodus", LEV: "Book_of_Leviticus",
  NUM: "Book_of_Numbers", DEU: "Book_of_Deuteronomy", JOS: "Book_of_Joshua",
  JDG: "Book_of_Judges", RUT: "Book_of_Ruth", "1SA": "Books_of_Samuel",
  "2SA": "Books_of_Samuel", "1KI": "Books_of_Kings", "2KI": "Books_of_Kings",
  "1CH": "Books_of_Chronicles", "2CH": "Books_of_Chronicles",
  EZR: "Book_of_Ezra", NEH: "Book_of_Nehemiah", EST: "Book_of_Esther",
  JOB: "Book_of_Job", PSA: "Psalms", PRO: "Book_of_Proverbs",
  ECC: "Ecclesiastes", SOL: "Song_of_Songs",
  ISA: "Book_of_Isaiah", JER: "Book_of_Jeremiah", LAM: "Book_of_Lamentations",
  EZE: "Book_of_Ezekiel", DAN: "Book_of_Daniel",
  HOS: "Book_of_Hosea", JOE: "Book_of_Joel", AMO: "Book_of_Amos",
  OBA: "Book_of_Obadiah", JON: "Book_of_Jonah", MIC: "Book_of_Micah",
  NAH: "Book_of_Nahum", HAB: "Book_of_Habakkuk", ZEP: "Book_of_Zephaniah",
  HAG: "Book_of_Haggai", ZEC: "Book_of_Zechariah", MAL: "Book_of_Malachi",
  MAT: "Gospel_of_Matthew", MAR: "Gospel_of_Mark", LUK: "Gospel_of_Luke",
  JOH: "Gospel_of_John", ACT: "Acts_of_the_Apostles",
  ROM: "Epistle_to_the_Romans", "1CO": "First_Epistle_to_the_Corinthians",
  "2CO": "Second_Epistle_to_the_Corinthians", GAL: "Epistle_to_the_Galatians",
  EPH: "Epistle_to_the_Ephesians", PHI: "Epistle_to_the_Philippians",
  COL: "Epistle_to_the_Colossians", "1TH": "First_Epistle_to_the_Thessalonians",
  "2TH": "Second_Epistle_to_the_Thessalonians", "1TI": "First_Epistle_to_Timothy",
  "2TI": "Second_Epistle_to_Timothy", TIT: "Epistle_to_Titus",
  PHM: "Epistle_to_Philemon", HEB: "Epistle_to_the_Hebrews",
  JAM: "Epistle_of_James", "1PE": "First_Epistle_of_Peter",
  "2PE": "Second_Epistle_of_Peter", "1JO": "First_Epistle_of_John",
  "2JO": "Second_Epistle_of_John", "3JO": "Third_Epistle_of_John",
  JUD: "Epistle_of_Jude", REV: "Book_of_Revelation",
};

// Namuwiki article names (Korean)
const NAMU_WIKI_ARTICLES: Record<string, string> = {
  GEN: "창세기", EXO: "출애굽기", LEV: "레위기", NUM: "민수기", DEU: "신명기",
  JOS: "여호수아", JDG: "사사기", RUT: "룻기", "1SA": "사무엘상", "2SA": "사무엘하",
  "1KI": "열왕기상", "2KI": "열왕기하", "1CH": "역대상", "2CH": "역대하",
  EZR: "에스라", NEH: "느헤미야", EST: "에스더",
  JOB: "욥기", PSA: "시편", PRO: "잠언", ECC: "전도서", SOL: "아가",
  ISA: "이사야", JER: "예레미야", LAM: "예레미야 애가", EZE: "에스겔", DAN: "다니엘",
  HOS: "호세아", JOF: "요엘", AMO: "아모스", OBA: "오바댜", JON: "요나",
  MIC: "미가", NAH: "나훔", HAB: "하박국", ZEP: "스바냐", HAG: "학개",
  ZEC: "스가랴", MAL: "말라기",
  MAT: "마태복음", MAR: "마가복음", LUK: "누가복음", JOH: "요한복음",
  ACT: "사도행전", ROM: "로마서",
  "1CO": "고린도전서", "2CO": "고린도후서", GAL: "갈라디아서", EPH: "에베소서",
  PHI: "빌립보서", COL: "골로새서", "1TH": "데살로니가전서", "2TH": "데살로니가후서",
  "1TI": "디모데전서", "2TI": "디모데후서", TIT: "디도서", PHM: "빌레몬서",
  HEB: "히브리서", JAM: "야고보서", "1PE": "베드로전서", "2PE": "베드로후서",
  "1JO": "요한1서", "2JO": "요한2서", "3JO": "요한3서", JUD: "유다서", REV: "요한계시록",
};

function bookReferenceSources(code: string): SourceLink[] {
  const sources: SourceLink[] = [];
  const enArticle = WIKI_ARTICLES[code];
  if (enArticle) {
    sources.push({ label: "Wikipedia", url: `https://en.wikipedia.org/wiki/${enArticle}` });
  }
  const koTitle = KO_BOOK_TITLES[code] ?? BOOK_TITLES[code];
  if (koTitle) {
    sources.push({ label: "한국어 위키피디아", url: `https://ko.wikipedia.org/wiki/${koTitle}` });
  }
  const namuArticle = NAMU_WIKI_ARTICLES[code];
  if (namuArticle) {
    sources.push({ label: "나무위키", url: `https://namu.wiki/w/${encodeURIComponent(namuArticle)}` });
  }
  return sources;
}

function note(title: string, body: string, confidence: ContextNote["confidence"], sources: ContextNote["sources"]): ContextNote {
  return { title, body, confidence, sources };
}

const BOOK_TITLES: Record<string, string> = {
  GEN: "Genesis",
  EXO: "Exodus",
  LEV: "Leviticus",
  NUM: "Numbers",
  DEU: "Deuteronomy",
  JOS: "Joshua",
  JDG: "Judges",
  RUT: "Ruth",
  "1SA": "1 Samuel",
  "2SA": "2 Samuel",
  "1KI": "1 Kings",
  "2KI": "2 Kings",
  "1CH": "1 Chronicles",
  "2CH": "2 Chronicles",
  EZR: "Ezra",
  NEH: "Nehemiah",
  EST: "Esther",
  JOB: "Job",
  PSA: "Psalms",
  PRO: "Proverbs",
  ECC: "Ecclesiastes",
  SOL: "Song of Solomon",
  ISA: "Isaiah",
  JER: "Jeremiah",
  LAM: "Lamentations",
  EZE: "Ezekiel",
  DAN: "Daniel",
  HOS: "Hosea",
  JOE: "Joel",
  AMO: "Amos",
  OBA: "Obadiah",
  JON: "Jonah",
  MIC: "Micah",
  NAH: "Nahum",
  HAB: "Habakkuk",
  ZEP: "Zephaniah",
  HAG: "Haggai",
  ZEC: "Zechariah",
  MAL: "Malachi",
  MAT: "Matthew",
  MAR: "Mark",
  LUK: "Luke",
  JOH: "John",
  ACT: "Acts",
  ROM: "Romans",
  "1CO": "1 Corinthians",
  "2CO": "2 Corinthians",
  GAL: "Galatians",
  EPH: "Ephesians",
  PHI: "Philippians",
  COL: "Colossians",
  "1TH": "1 Thessalonians",
  "2TH": "2 Thessalonians",
  "1TI": "1 Timothy",
  "2TI": "2 Timothy",
  TIT: "Titus",
  PHM: "Philemon",
  HEB: "Hebrews",
  JAM: "James",
  "1PE": "1 Peter",
  "2PE": "2 Peter",
  "1JO": "1 John",
  "2JO": "2 John",
  "3JO": "3 John",
  JUD: "Jude",
  REV: "Revelation",
};

const GROUPS: Array<{ codes: string[]; profile: GroupProfile }> = [
  {
    codes: ["GEN", "EXO", "LEV", "NUM", "DEU"],
    profile: {
      genre: "Torah · origins, covenant story, and law",
      authorship: {
        body: "These books are traditionally associated with Moses, while many modern readers describe their final form as the result of long transmission, preservation, and editorial shaping.",
        confidence: "disputed",
      },
      date: {
        body: "The narratives remember Israel's foundational origins and exodus traditions, while the final literary form is usually understood to have developed across a long span rather than at a single moment.",
        confidence: "disputed",
      },
      place: {
        body: "The settings move through Mesopotamia, Canaan, Egypt, and the wilderness; the place of final composition remains debated, but the geography serves covenant memory rather than modern historiographic precision.",
        confidence: "medium",
      },
      audience: {
        body: "The Torah teaches God's people who their God is, how covenant identity begins, and why worship, holiness, and obedience belong together.",
        confidence: "high",
      },
    },
  },
  {
    codes: ["JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST"],
    profile: {
      genre: "Historical narrative · covenant memory and national transition",
      authorship: {
        body: "These books are traditionally linked to prophetic or scribal historians, while many scholars describe them as preserved and shaped over time through larger historical collections.",
        confidence: "disputed",
      },
      date: {
        body: "The books recount events from conquest, judges, monarchy, exile, and restoration, while the present literary forms often reflect later reflection on those events.",
        confidence: "disputed",
      },
      place: {
        body: "Their geography centers on the land of Israel and Judah, with repeated attention to covenant sites, royal centers, exile locations, and return routes.",
        confidence: "high",
      },
      audience: {
        body: "These narratives teach later generations how covenant faithfulness, idolatry, leadership, judgment, and restoration shape the life of God's people in public history.",
        confidence: "high",
      },
    },
  },
  {
    codes: ["JOB", "PSA", "PRO", "ECC", "SOL"],
    profile: {
      genre: "Poetry and wisdom · worship, suffering, reflection, and love",
      authorship: {
        body: "These books gather poetic and wisdom materials associated with figures such as David or Solomon, yet the collections themselves reflect longer literary growth than single-author production.",
        confidence: "medium",
      },
      date: {
        body: "Individual materials may preserve early traditions, while the books in their final form likely came together across multiple periods of Israel's literary and worship life.",
        confidence: "disputed",
      },
      place: {
        body: "The most reliable setting is Israel's worshiping and wisdom-forming life, especially its royal, temple, and teaching traditions rather than one precise drafting location.",
        confidence: "medium",
      },
      audience: {
        body: "These books train God's people in prayer, suffering, prudence, joy, love, and reverent speech before God and neighbor.",
        confidence: "high",
      },
    },
  },
  {
    codes: ["ISA", "JER", "LAM", "EZE", "DAN", "HOS", "JOE", "AMO", "OBA", "JON", "MIC", "NAH", "HAB", "ZEP", "HAG", "ZEC", "MAL"],
    profile: {
      genre: "Prophetic literature · judgment, hope, and covenant summons",
      authorship: {
        body: "These books are traditionally tied to named prophets, though many also show signs of collected oracles, transmission, and later literary arrangement within prophetic communities.",
        confidence: "medium",
      },
      date: {
        body: "Their message belongs to the eras of Assyrian, Babylonian, exilic, and post-exilic crisis; precise dating varies by book and often remains debated in its final literary form.",
        confidence: "medium",
      },
      place: {
        body: "The horizon usually centers on Israel, Judah, Jerusalem, exile, and the surrounding nations, with prophetic geography serving covenant warning and hope.",
        confidence: "medium",
      },
      audience: {
        body: "Prophetic books address people who must hear both God's exposure of sin and God's promise to preserve, restore, and judge with righteousness.",
        confidence: "high",
      },
    },
  },
  {
    codes: ["MAT", "MAR", "LUK", "JOH"],
    profile: {
      genre: "Gospel narrative · Jesus' life, teaching, death, and resurrection",
      authorship: {
        body: "The Gospels carry traditional apostolic or apostolic-circle attributions, while modern discussions often distinguish those associations from the final literary shaping of each book.",
        confidence: "disputed",
      },
      date: {
        body: "The Gospels are commonly placed in the first century CE, with exact dating varying by book and by how readers reconstruct their sources and publication context.",
        confidence: "disputed",
      },
      place: {
        body: "Their stories unfold in Galilee, Judea, and Jerusalem, while the exact locations of final composition are usually reconstructed rather than directly stated by the texts.",
        confidence: "disputed",
      },
      audience: {
        body: "The Gospels are written so readers can understand Jesus in continuity with Israel's scriptures and respond in faith, discipleship, and witness.",
        confidence: "high",
      },
    },
  },
  {
    codes: ["ACT"],
    profile: {
      genre: "Narrative history · apostolic mission and church expansion",
      authorship: {
        body: "Acts is traditionally linked to Luke and is commonly read as the second volume paired with the Gospel of Luke, though the text does not name the author directly.",
        confidence: "medium",
      },
      date: {
        body: "Acts is generally placed in the later first century CE, though proposals vary alongside broader debates about Luke-Acts.",
        confidence: "disputed",
      },
      place: {
        body: "The story moves from Jerusalem through Judea, Samaria, and the wider Mediterranean world, foregrounding the gospel's geographic expansion.",
        confidence: "high",
      },
      audience: {
        body: "Acts teaches the church how the risen Christ continues his work through the Spirit, witness, suffering, and mission across ethnic and geographic boundaries.",
        confidence: "high",
      },
    },
  },
  {
    codes: ["ROM", "1CO", "2CO", "GAL", "EPH", "PHI", "COL", "1TH", "2TH", "PHM"],
    profile: {
      genre: "Pauline letter · gospel instruction and church formation",
      authorship: {
        body: "These letters are traditionally attributed to Paul, though modern scholarship differentiates more and less disputed Pauline attributions across the collection.",
        confidence: "medium",
      },
      date: {
        body: "They belong to the middle decades of the first century CE in the setting of the early churches and Paul's missionary labor.",
        confidence: "medium",
      },
      place: {
        body: "The letters arise from the eastern Mediterranean mission field and move between cities, house churches, prisons, and travel networks of the Roman world.",
        confidence: "medium",
      },
      audience: {
        body: "These letters address churches or coworkers who need the gospel applied to doctrine, worship, ethics, suffering, and communal life.",
        confidence: "high",
      },
    },
  },
  {
    codes: ["1TI", "2TI", "TIT"],
    profile: {
      genre: "Pastoral letter · leadership, endurance, and church order",
      authorship: {
        body: "These letters are traditionally attributed to Paul, while their date, authorship, and compositional setting are debated across scholarship more than several other Pauline letters.",
        confidence: "disputed",
      },
      date: {
        body: "On the traditional reading they belong near the later period of Paul's ministry; wider scholarship often proposes a later compositional horizon.",
        confidence: "disputed",
      },
      place: {
        body: "Their world is the network of early Christian mission, local congregations, and ministerial oversight rather than one uncontested drafting site.",
        confidence: "disputed",
      },
      audience: {
        body: "They address ministry workers and churches that need durable teaching, ordered leadership, and courage under pressure.",
        confidence: "high",
      },
    },
  },
  {
    codes: ["HEB", "JAM", "1PE", "2PE", "1JO", "2JO", "3JO", "JUD"],
    profile: {
      genre: "General epistle · exhortation, endurance, and faithful witness",
      authorship: {
        body: "These writings carry diverse traditional attributions, and several involve major authorship debates, especially where the text does not identify the author with modern expectations of certainty.",
        confidence: "disputed",
      },
      date: {
        body: "They are usually placed in the first-century church, though exact dates vary considerably from book to book.",
        confidence: "disputed",
      },
      place: {
        body: "The settings belong to dispersed early Christian communities facing pressure, false teaching, moral testing, or endurance challenges across the wider Roman world.",
        confidence: "medium",
      },
      audience: {
        body: "These books strengthen scattered believers to remain faithful in doctrine, holiness, endurance, and mutual love.",
        confidence: "high",
      },
    },
  },
  {
    codes: ["REV"],
    profile: {
      genre: "Apocalypse · prophecy and circular church letter",
      authorship: {
        body: "Revelation presents itself through John, while Christian tradition and scholarship continue to debate the precise relation of this John to other Johannine writings.",
        confidence: "disputed",
      },
      date: {
        body: "The book is usually placed in the late first century CE, often in relation to imperial pressure and the testing of the churches in Asia.",
        confidence: "medium",
      },
      place: {
        body: "The visions are received on Patmos and sent to churches in Asia Minor, placing the book inside a concrete network of pressured congregations.",
        confidence: "high",
      },
      audience: {
        body: "Revelation calls suffering churches to patient endurance, worshipful allegiance to God and the Lamb, and resistance to idolatrous empire.",
        confidence: "high",
      },
    },
  },
];

function buildFallbackMetadata(code: string): BookMetadata | undefined {
  const title = BOOK_TITLES[code];
  const group = GROUPS.find((entry) => entry.codes.includes(code));

  if (!title || !group) {
    return undefined;
  }

  const { profile } = group;

  return {
    code,
    title,
    genre: profile.genre,
    notes: {
      authorship: note("Traditional authorship", profile.authorship.body, profile.authorship.confidence, COMMON_SOURCES.metadata),
      date: note("Date range", profile.date.body, profile.date.confidence, COMMON_SOURCES.metadata),
      place: note("Place", profile.place.body, profile.place.confidence, COMMON_SOURCES.place),
      audience: note("Audience", profile.audience.body, profile.audience.confidence, COMMON_SOURCES.metadata),
    },
  };
}

export const BOOK_METADATA: Record<string, BookMetadata> = {
  PSA: {
    code: "PSA",
    title: "Psalms",
    genre: "Poetry · worship anthology · lament and praise",
    notes: {
      authorship: note("Traditional authorship", "Many psalms are traditionally tied to David, but the Psalter is a collected anthology shaped across generations rather than a single-author book.", "medium", COMMON_SOURCES.metadata),
      date: note("Date range", "Individual psalms may preserve early monarchy material, while the final Psalter was likely compiled and ordered over a long span ending in the post-exilic period.", "disputed", COMMON_SOURCES.metadata),
      place: note("Place", "The most reliable location layer is Israel's worship life, especially the temple-centered memory associated with Jerusalem.", "medium", COMMON_SOURCES.place),
      audience: note("Audience", "The Psalter became the prayerbook of God's people, teaching worshipers how to lament, trust, confess, and praise together.", "high", COMMON_SOURCES.metadata),
    },
  },
  HAB: {
    code: "HAB",
    title: "Habakkuk",
    genre: "Prophetic dialogue and woe oracle",
    notes: {
      authorship: note("Traditional authorship", "The book is traditionally attributed to the prophet Habakkuk, though little is known about him beyond the book itself.", "medium", COMMON_SOURCES.metadata),
      date: note("Date range", "Most readers place Habakkuk near the late seventh century BCE, when Babylonian power was rising and Judah faced looming judgment.", "medium", COMMON_SOURCES.metadata),
      place: note("Place", "The prophecy is best read from Judah's perspective, likely with Jerusalem in view as the threatened covenant center.", "medium", COMMON_SOURCES.place),
      audience: note("Audience", "Habakkuk addresses people struggling to understand why God seems slow while violence and injustice intensify.", "high", COMMON_SOURCES.metadata),
    },
  },
  ROM: {
    code: "ROM",
    title: "Romans",
    genre: "Apostolic letter · theological exposition",
    notes: {
      authorship: note("Traditional authorship", "Romans is traditionally and widely attributed to Paul the apostle.", "high", COMMON_SOURCES.metadata),
      date: note("Date range", "Romans is commonly dated to the mid-first century CE, near the close of Paul's eastern Mediterranean ministry before his hoped-for journey to Rome.", "medium", COMMON_SOURCES.metadata),
      place: note("Place", "The letter is often associated with Corinth or nearby Greece during Paul's travel period, though the exact drafting spot is still an informed reconstruction.", "disputed", COMMON_SOURCES.place),
      audience: note("Audience", "Romans addresses the mixed Jewish-Gentile house churches in Rome and explains the gospel's implications for the whole people of God.", "high", COMMON_SOURCES.metadata),
    },
  },
  MAT: {
    code: "MAT",
    title: "Matthew",
    genre: "Gospel narrative · teaching collection",
    notes: {
      authorship: note("Traditional authorship", "The Gospel is traditionally attributed to Matthew, though modern discussions often separate apostolic association from the final literary shaping of the text.", "disputed", COMMON_SOURCES.metadata),
      date: note("Date range", "Matthew is often placed in the later first century CE, though precise dating remains debated.", "disputed", COMMON_SOURCES.metadata),
      place: note("Place", "A Syrian or eastern Mediterranean church setting is frequently suggested, but the exact location is uncertain.", "disputed", COMMON_SOURCES.place),
      audience: note("Audience", "Matthew speaks to a community deeply formed by Israel's scriptures and shows Jesus as the fulfillment of the law, prophets, and kingdom hope.", "high", COMMON_SOURCES.metadata),
    },
  },
  LUK: {
    code: "LUK",
    title: "Luke",
    genre: "Gospel narrative · orderly account",
    notes: {
      authorship: note("Traditional authorship", "Luke is traditionally linked to Luke the physician and companion of Paul, though the text itself does not name the author directly.", "medium", COMMON_SOURCES.metadata),
      date: note("Date range", "Luke is generally placed in the later first century CE, though proposals vary depending on how Acts is dated.", "disputed", COMMON_SOURCES.metadata),
      place: note("Place", "The drafting location remains uncertain; what is clearer is Luke's wider Greco-Roman horizon and concern for orderly historical narration.", "disputed", COMMON_SOURCES.place),
      audience: note("Audience", "Luke addresses Theophilus and a wider audience that needs confidence in the truth of the gospel story and its implications for all peoples.", "high", COMMON_SOURCES.metadata),
    },
  },
  JOH: {
    code: "JOH",
    title: "John",
    genre: "Gospel narrative · theological witness",
    notes: {
      authorship: note("Traditional authorship", "The Gospel is traditionally associated with John the son of Zebedee, though many readers distinguish Johannine witness from the final editorial form.", "disputed", COMMON_SOURCES.metadata),
      date: note("Date range", "John is usually placed near the end of the first century CE, though proposals vary across scholarship.", "disputed", COMMON_SOURCES.metadata),
      place: note("Place", "An Asia Minor setting is often suggested for the Gospel's circulation, but the exact place of final composition is uncertain.", "disputed", COMMON_SOURCES.place),
      audience: note("Audience", "John writes so readers may believe Jesus is the Messiah, the Son of God, and have life in his name.", "high", COMMON_SOURCES.metadata),
    },
  },
  EXO: {
    code: "EXO",
    title: "Exodus",
    genre: "Narrative · covenant memory · law",
    notes: {
      authorship: note("Traditional authorship", "Exodus is traditionally tied to Moses, while many modern readers describe the book in its final form as shaped through longer transmission and editorial work.", "disputed", COMMON_SOURCES.metadata),
      date: note("Date range", "The events belong to Israel's foundational liberation memory, while the final literary shaping likely reflects a long process that extended beyond the events themselves.", "disputed", COMMON_SOURCES.metadata),
      place: note("Place", "The story moves from Egypt into the wilderness near Sinai/Horeb, the place of covenant encounter and communal identity formation.", "high", COMMON_SOURCES.place),
      audience: note("Audience", "Exodus teaches God's people who their Deliverer is, how covenant identity is formed, and why liberation leads toward worship and obedience.", "high", COMMON_SOURCES.metadata),
    },
  },
  JOS: {
    code: "JOS",
    title: "Joshua",
    genre: "Narrative · conquest and covenant transition",
    notes: {
      authorship: note("Traditional authorship", "Joshua is traditionally associated with Joshua and later covenant historians, while the final book shows signs of extended literary shaping.", "disputed", COMMON_SOURCES.metadata),
      date: note("Date range", "The book remembers Israel's entry into the land but likely reached its present form through later editorial preservation.", "disputed", COMMON_SOURCES.metadata),
      place: note("Place", "The setting is Canaan, with repeated focus on crossings, battles, inheritances, and covenant renewal sites such as Shechem.", "high", COMMON_SOURCES.place),
      audience: note("Audience", "Joshua teaches later Israelites that courage, inheritance, and success are inseparable from God's presence and covenant faithfulness.", "high", COMMON_SOURCES.metadata),
    },
  },
  MAR: {
    code: "MAR",
    title: "Mark",
    genre: "Gospel narrative · fast-paced witness",
    notes: {
      authorship: note("Traditional authorship", "Mark is traditionally linked to John Mark and often associated with Petrine testimony behind the Gospel.", "medium", COMMON_SOURCES.metadata),
      date: note("Date range", "Mark is often considered the earliest written Gospel, usually placed in the mid-to-late first century CE.", "medium", COMMON_SOURCES.metadata),
      place: note("Place", "Rome is frequently proposed as a setting for the Gospel's audience or final shaping, though this remains an informed tradition rather than a certainty.", "disputed", COMMON_SOURCES.place),
      audience: note("Audience", "Mark presents Jesus in urgent action for readers who need to see the suffering Son of God and the cost of discipleship clearly.", "high", COMMON_SOURCES.metadata),
    },
  },
  "2TI": {
    code: "2TI",
    title: "2 Timothy",
    genre: "Pastoral letter · endurance and ministry charge",
    notes: {
      authorship: note("Traditional authorship", "2 Timothy is traditionally attributed to Paul, though the Pastoral Epistles are widely discussed and dated differently across scholarship.", "disputed", COMMON_SOURCES.metadata),
      date: note("Date range", "On the traditional reading the letter belongs near the end of Paul's life; broader scholarship debates both date and compositional setting.", "disputed", COMMON_SOURCES.metadata),
      place: note("Place", "The traditional setting places Paul under imprisonment, often in Rome, writing to Timothy at some remove from him.", "disputed", COMMON_SOURCES.place),
      audience: note("Audience", "2 Timothy addresses a younger ministry worker who needs courage, endurance, and fidelity under pressure.", "high", COMMON_SOURCES.metadata),
    },
  },
};

type LocalizedBookNoteCopy = {
  title: string;
  body: string;
};

type LocalizedBookMetadataCopy = {
  title: string;
  genre: string;
  notes: Record<keyof BookMetadata["notes"], LocalizedBookNoteCopy>;
};

const KO_BOOK_TITLES: Record<string, string> = {
  GEN: "창세기",
  EXO: "출애굽기",
  LEV: "레위기",
  NUM: "민수기",
  DEU: "신명기",
  JOS: "여호수아",
  JDG: "사사기",
  RUT: "룻기",
  "1SA": "사무엘상",
  "2SA": "사무엘하",
  "1KI": "열왕기상",
  "2KI": "열왕기하",
  "1CH": "역대상",
  "2CH": "역대하",
  EZR: "에스라",
  NEH: "느헤미야",
  EST: "에스더",
  JOB: "욥기",
  PSA: "시편",
  PRO: "잠언",
  ECC: "전도서",
  SOL: "아가",
  ISA: "이사야",
  JER: "예레미야",
  LAM: "예레미야애가",
  EZE: "에스겔",
  DAN: "다니엘",
  HOS: "호세아",
  JOE: "요엘",
  AMO: "아모스",
  OBA: "오바댜",
  JON: "요나",
  MIC: "미가",
  NAH: "나훔",
  HAB: "하박국",
  ZEP: "스바냐",
  HAG: "학개",
  ZEC: "스가랴",
  MAL: "말라기",
  MAT: "마태복음",
  MAR: "마가복음",
  LUK: "누가복음",
  JOH: "요한복음",
  ACT: "사도행전",
  ROM: "로마서",
  "1CO": "고린도전서",
  "2CO": "고린도후서",
  GAL: "갈라디아서",
  EPH: "에베소서",
  PHI: "빌립보서",
  COL: "골로새서",
  "1TH": "데살로니가전서",
  "2TH": "데살로니가후서",
  "1TI": "디모데전서",
  "2TI": "디모데후서",
  TIT: "디도서",
  PHM: "빌레몬서",
  HEB: "히브리서",
  JAM: "야고보서",
  "1PE": "베드로전서",
  "2PE": "베드로후서",
  "1JO": "요한일서",
  "2JO": "요한이서",
  "3JO": "요한삼서",
  JUD: "유다서",
  REV: "요한계시록",
};

const KO_BOOK_GROUPS: Array<{ codes: string[]; copy: LocalizedBookMetadataCopy }> = [
  {
    codes: ["GEN", "EXO", "LEV", "NUM", "DEU"],
    copy: {
      title: "",
      genre: "토라 · 기원 · 언약 이야기와 율법",
      notes: {
        authorship: {
          title: "전통적 저자 이해",
          body: "이 책들은 전통적으로 모세와 연결되지만, 많은 현대 독자들은 현재의 최종 형태가 긴 전승과 보존과 편집 과정을 거쳐 형성되었다고 이해합니다.",
        },
        date: {
          title: "시대 범위",
          body: "본문은 이스라엘의 기원과 출애굽의 기초 기억을 담고 있지만, 지금의 문학적 형태는 한 시점이 아니라 오랜 기간에 걸쳐 발전한 것으로 이해되는 경우가 많습니다.",
        },
        place: {
          title: "장소",
          body: "배경은 메소포타미아, 가나안, 애굽, 광야를 지나 이동합니다. 최종 형성 장소는 논의되지만, 이 지리는 현대적 정밀 연대기보다 언약의 기억을 섬깁니다.",
        },
        audience: {
          title: "청중",
          body: "토라는 하나님의 백성에게 그들의 하나님이 누구신지, 언약 정체성이 어떻게 시작되는지, 왜 예배와 거룩과 순종이 함께 가야 하는지를 가르칩니다.",
        },
      },
    },
  },
  {
    codes: ["JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST"],
    copy: {
      title: "",
      genre: "역사 서사 · 언약 기억과 국가적 전환",
      notes: {
        authorship: {
          title: "전통적 저자 이해",
          body: "이 책들은 전통적으로 예언자적 혹은 서기관적 역사 기록과 연결되지만, 현재의 책 형태는 더 큰 역사 모음집 안에서 오랜 시간 보존되고 다듬어진 결과로 보는 견해가 많습니다.",
        },
        date: {
          title: "시대 범위",
          body: "정복, 사사 시대, 왕정, 포로, 회복에 걸친 사건들을 담고 있으며, 현재의 문학적 형태는 그 사건들에 대한 후대의 반성과 해석을 함께 반영합니다.",
        },
        place: {
          title: "장소",
          body: "지리는 이스라엘과 유다 땅을 중심으로 움직이며, 언약의 장소, 왕권의 중심지, 포로의 땅, 귀환의 길이 반복해서 주목됩니다.",
        },
        audience: {
          title: "청중",
          body: "이 서사들은 후대 공동체에게 언약 신실함과 우상숭배와 지도력과 심판과 회복이 공적 역사 속에서 어떻게 하나님의 백성을 빚는지 가르칩니다.",
        },
      },
    },
  },
  {
    codes: ["JOB", "PSA", "PRO", "ECC", "SOL"],
    copy: {
      title: "",
      genre: "시와 지혜 · 예배 · 고난 · 성찰 · 사랑",
      notes: {
        authorship: {
          title: "전통적 저자 이해",
          body: "이 책들은 다윗이나 솔로몬 같은 인물들과 연결되지만, 현재의 모음집 형태는 한 저자의 단일 저작이라기보다 더 긴 문학적 축적과 배열의 결과를 보여 줍니다.",
        },
        date: {
          title: "시대 범위",
          body: "개별 자료는 이른 전승을 보존할 수 있지만, 지금의 책 형태는 이스라엘의 문학과 예배 삶 속 여러 시기를 거쳐 형성된 것으로 이해됩니다.",
        },
        place: {
          title: "장소",
          body: "가장 신뢰할 만한 배경은 이스라엘의 예배와 지혜 교육의 삶입니다. 왕권, 성전, 교훈의 전통이 이 책들의 정서를 빚습니다.",
        },
        audience: {
          title: "청중",
          body: "이 책들은 하나님의 백성이 기도하고, 고난을 견디고, 분별하며, 기뻐하고, 사랑하고, 하나님과 이웃 앞에서 경외로 말하는 법을 훈련합니다.",
        },
      },
    },
  },
  {
    codes: ["ISA", "JER", "LAM", "EZE", "DAN", "HOS", "JOE", "AMO", "OBA", "JON", "MIC", "NAH", "HAB", "ZEP", "HAG", "ZEC", "MAL"],
    copy: {
      title: "",
      genre: "예언 문학 · 심판 · 소망 · 언약의 부르심",
      notes: {
        authorship: {
          title: "전통적 저자 이해",
          body: "이 책들은 전통적으로 이름 붙은 예언자들과 연결되지만, 예언 공동체 안에서 모인 신탁과 전승과 후대의 문학적 배열 흔적도 함께 보입니다.",
        },
        date: {
          title: "시대 범위",
          body: "메시지는 앗수르, 바벨론, 포로, 포로 이후의 위기와 맞닿아 있으며, 최종 문학 형태의 정확한 시점은 책마다 다르고 종종 논의됩니다.",
        },
        place: {
          title: "장소",
          body: "시야는 이스라엘, 유다, 예루살렘, 포로의 땅, 주변 민족들을 중심으로 움직이며, 예언의 지리는 경고와 소망을 위한 언약적 무대가 됩니다.",
        },
        audience: {
          title: "청중",
          body: "예언서는 죄를 드러내시는 하나님의 말씀과 동시에 보존과 회복과 의로운 심판의 약속을 들어야 하는 공동체를 향합니다.",
        },
      },
    },
  },
  {
    codes: ["MAT", "MAR", "LUK", "JOH"],
    copy: {
      title: "",
      genre: "복음서 · 예수님의 삶 · 가르침 · 죽음 · 부활",
      notes: {
        authorship: {
          title: "전통적 저자 이해",
          body: "복음서들은 전통적으로 사도나 사도적 원과 연결되지만, 현대 논의에서는 그 전승과 현재의 최종 문학적 형태를 구분해서 보기도 합니다.",
        },
        date: {
          title: "시대 범위",
          body: "복음서들은 대체로 1세기 안에 놓이지만, 정확한 연대는 각 책의 자료 사용과 형성 맥락을 어떻게 보느냐에 따라 달라집니다.",
        },
        place: {
          title: "장소",
          body: "이야기는 갈릴리와 유대와 예루살렘에서 펼쳐지며, 최종 작성 장소는 본문이 직접 밝히지 않아 대체로 후대의 재구성에 의존합니다.",
        },
        audience: {
          title: "청중",
          body: "복음서는 독자들이 이스라엘의 성경과 연속선상에서 예수님을 이해하고, 믿음과 제자도와 증언으로 응답하도록 쓰였습니다.",
        },
      },
    },
  },
  {
    codes: ["ACT"],
    copy: {
      title: "",
      genre: "서사 역사 · 사도적 선교와 교회의 확장",
      notes: {
        authorship: {
          title: "전통적 저자 이해",
          body: "사도행전은 전통적으로 누가와 연결되며 누가복음의 두 번째 권으로 읽히지만, 본문 자체는 저자를 직접 밝히지 않습니다.",
        },
        date: {
          title: "시대 범위",
          body: "대체로 1세기 후반에 놓이지만, 누가-행전의 형성 시기를 어떻게 보느냐에 따라 제안은 달라집니다.",
        },
        place: {
          title: "장소",
          body: "이 이야기는 예루살렘에서 시작해 유대와 사마리아와 더 넓은 지중해 세계로 나아가며, 복음의 지리적 확장을 전면에 둡니다.",
        },
        audience: {
          title: "청중",
          body: "사도행전은 부활하신 그리스도께서 성령과 증언과 고난과 선교를 통해 계속 일하신다는 사실을 교회에 가르칩니다.",
        },
      },
    },
  },
  {
    codes: ["ROM", "1CO", "2CO", "GAL", "EPH", "PHI", "COL", "1TH", "2TH", "PHM"],
    copy: {
      title: "",
      genre: "바울 서신 · 복음의 가르침과 교회 형성",
      notes: {
        authorship: {
          title: "전통적 저자 이해",
          body: "이 편지들은 전통적으로 바울에게 돌려지지만, 현대 학계는 그 안에서 더 확실한 바울 서신과 더 논의되는 바울 서신을 구분해 보기도 합니다.",
        },
        date: {
          title: "시대 범위",
          body: "이 서신들은 대체로 1세기 중반 초기 교회와 바울의 선교 사역 한가운데 놓입니다.",
        },
        place: {
          title: "장소",
          body: "편지들은 동지중해의 도시들과 가정교회들과 감금과 여행의 네트워크 속에서 오가며 형성됩니다.",
        },
        audience: {
          title: "청중",
          body: "이 서신들은 교회와 동역자들이 교리와 예배와 윤리와 고난과 공동체 생활 속에 복음을 어떻게 적용해야 하는지 가르칩니다.",
        },
      },
    },
  },
  {
    codes: ["1TI", "2TI", "TIT"],
    copy: {
      title: "",
      genre: "목회 서신 · 지도력 · 인내 · 교회 질서",
      notes: {
        authorship: {
          title: "전통적 저자 이해",
          body: "이 편지들은 전통적으로 바울에게 돌려지지만, 다른 바울 서신보다 저자와 연대와 형성 상황에 대해 더 큰 논의가 이어집니다.",
        },
        date: {
          title: "시대 범위",
          body: "전통적 이해에서는 바울 사역 후기와 연결되지만, 더 넓은 학계는 후기의 형성 지평을 제안하기도 합니다.",
        },
        place: {
          title: "장소",
          body: "배경은 초기 기독교 선교의 네트워크와 지역 교회들의 돌봄과 감독의 현장이지, 모두가 동의하는 하나의 작성 장소는 아닙니다.",
        },
        audience: {
          title: "청중",
          body: "이 서신들은 지속 가능한 가르침과 질서 있는 지도력과 압박 속의 용기가 필요한 사역자들과 교회들을 향합니다.",
        },
      },
    },
  },
  {
    codes: ["HEB", "JAM", "1PE", "2PE", "1JO", "2JO", "3JO", "JUD"],
    copy: {
      title: "",
      genre: "공동 서신 · 권면 · 인내 · 신실한 증언",
      notes: {
        authorship: {
          title: "전통적 저자 이해",
          body: "이 글들은 각기 다른 전통적 저자 이해를 지니며, 특히 저자가 현대적 확실성 방식으로 직접 드러나지 않는 책들에서는 저자 논의가 크게 이어집니다.",
        },
        date: {
          title: "시대 범위",
          body: "대체로 1세기 교회 안에 놓이지만, 정확한 시점은 책마다 상당한 차이가 있습니다.",
        },
        place: {
          title: "장소",
          body: "배경은 로마 세계 전역에 흩어진 초기 기독교 공동체들입니다. 그들은 압박과 거짓 가르침과 도덕적 시험과 인내의 도전을 함께 겪습니다.",
        },
        audience: {
          title: "청중",
          body: "이 책들은 흩어진 성도들이 교리와 거룩과 인내와 상호 사랑 안에서 신실하게 남도록 붙듭니다.",
        },
      },
    },
  },
  {
    codes: ["REV"],
    copy: {
      title: "",
      genre: "묵시 · 예언 · 순환 서신",
      notes: {
        authorship: {
          title: "전통적 저자 이해",
          body: "요한계시록은 자신을 요한의 증언으로 제시하지만, 이 요한이 다른 요한 문헌들과 어떤 정확한 관계에 있는지는 전통과 학계 모두에서 계속 논의됩니다.",
        },
        date: {
          title: "시대 범위",
          body: "보통 1세기 후반에 놓이며, 제국의 압박과 아시아의 교회들이 겪는 시험과 관련지어 읽히는 경우가 많습니다.",
        },
        place: {
          title: "장소",
          body: "환상은 밧모섬에서 주어지고 소아시아의 여러 교회로 보내집니다. 따라서 책 전체가 실제 압박 속 공동체들의 네트워크 안에 놓입니다.",
        },
        audience: {
          title: "청중",
          body: "요한계시록은 고난받는 교회들에게 인내하며 하나님과 어린양께 충성하고, 우상적 제국에 저항하라고 부릅니다.",
        },
      },
    },
  },
];

const KO_BOOK_METADATA_OVERRIDES: Partial<Record<string, LocalizedBookMetadataCopy>> = {
  PSA: {
    title: "시편",
    genre: "시가 · 예배 모음집 · 탄식과 찬양",
    notes: {
      authorship: {
        title: "전통적 저자 이해",
        body: "많은 시편이 전통적으로 다윗과 연결되지만, 시편집 전체는 한 저자의 책이라기보다 여러 세대를 거쳐 모아지고 다듬어진 모음집입니다.",
      },
      date: {
        title: "시대 범위",
        body: "개별 시편 가운데는 초기 왕정 시대의 재료를 보존한 것도 있을 수 있지만, 현재의 시편집은 포로기 이후까지 이어진 오랜 편집과 배열의 결과로 보는 경우가 많습니다.",
      },
      place: {
        title: "장소",
        body: "가장 신뢰할 만한 장소 층위는 이스라엘의 예배 삶, 특히 예루살렘과 연결된 성전 중심의 기억입니다.",
      },
      audience: {
        title: "청중",
        body: "시편집은 하나님의 백성이 함께 탄식하고, 신뢰하고, 고백하고, 찬양하는 법을 배우는 기도서가 되었습니다.",
      },
    },
  },
  EXO: {
    title: "출애굽기",
    genre: "서사 · 언약 기억 · 율법",
    notes: {
      authorship: {
        title: "전통적 저자 이해",
        body: "출애굽기는 전통적으로 모세와 연결되지만, 많은 현대 독자들은 현재의 책 형태가 더 긴 전승과 편집 과정을 거쳐 형성되었다고 봅니다.",
      },
      date: {
        title: "시대 범위",
        body: "사건 자체는 이스라엘의 기초적인 해방 기억에 속하지만, 현재의 문학적 형태는 그 사건 이후에도 오랜 형성 과정을 거쳤을 가능성이 큽니다.",
      },
      place: {
        title: "장소",
        body: "이 이야기는 애굽에서 시작해 시내/호렙 인근 광야로 이동합니다. 그곳은 언약의 만남과 공동체 정체성 형성의 자리입니다.",
      },
      audience: {
        title: "청중",
        body: "출애굽기는 하나님의 백성에게 그들을 구원하신 분이 누구인지, 언약 정체성이 어떻게 형성되는지, 왜 해방이 예배와 순종으로 이어지는지를 가르칩니다.",
      },
    },
  },
  LAM: {
    title: "예레미야애가",
    genre: "애가 · 심판의 기억 · 소망의 탄식",
    notes: {
      authorship: {
        title: "전통적 저자 이해",
        body: "예레미야애가는 전통적으로 예레미야와 연결되지만, 책 자체는 저자를 명시하지 않으며 최종 문학적 형성에 대해서는 여전히 논의가 있습니다.",
      },
      date: {
        title: "시대 범위",
        body: "이 책의 메시지는 예루살렘 함락과 그 여파라는 역사적 위기 속에 놓여 있습니다. 다만 최종 문학 형태의 정확한 형성 시점은 여전히 논의됩니다.",
      },
      place: {
        title: "장소",
        body: "이 애가는 예루살렘과 유다 땅의 파괴를 배경으로 합니다. 성전과 도시의 기억이 슬픔의 지리적 중심입니다.",
      },
      audience: {
        title: "청중",
        body: "예레미야애가는 국가적 붕괴 이후 슬픔과 죄책감과 희미한 소망을 하나님 앞에서 말할 언어가 필요했던 공동체를 향합니다.",
      },
    },
  },
  GEN: {
    title: "창세기",
    genre: "토라 · 기원 · 언약 이야기",
    notes: {
      authorship: {
        title: "전통적 저자 이해",
        body: "창세기는 전통적으로 모세와 연결되지만, 많은 현대 독자들은 현재의 책 형태가 긴 전승, 보존, 편집 과정을 거쳐 형성되었다고 봅니다.",
      },
      date: {
        title: "시대 범위",
        body: "이 이야기들은 이스라엘의 기원과 조상 기억을 담고 있지만, 현재의 문학적 형태는 한 시점이 아니라 오랜 시간에 걸쳐 발전한 것으로 이해되는 경우가 많습니다.",
      },
      place: {
        title: "장소",
        body: "배경은 메소포타미아, 가나안, 애굽으로 이동합니다. 최종 편집 장소는 논의되지만, 이 지리는 현대적 정밀 연대기보다 언약의 기억을 섬깁니다.",
      },
      audience: {
        title: "청중",
        body: "토라는 하나님의 백성에게 그들의 하나님이 누구신지, 언약 정체성이 어떻게 시작되는지, 왜 예배와 거룩과 순종이 함께 가야 하는지를 가르칩니다.",
      },
    },
  },
};

function localizeBookMetadata(metadata: BookMetadata, locale?: string): BookMetadata {
  if (resolveAppLocale(locale) !== "ko") {
    return metadata;
  }

  const copy =
    KO_BOOK_METADATA_OVERRIDES[metadata.code] ?? KO_BOOK_GROUPS.find((group) => group.codes.includes(metadata.code))?.copy;

  if (!copy) {
    return {
      ...metadata,
      title: KO_BOOK_TITLES[metadata.code] ?? metadata.title,
      notes: {
        authorship: { ...metadata.notes.authorship, title: "전통적 저자 이해" },
        date: { ...metadata.notes.date, title: "시대 범위" },
        place: { ...metadata.notes.place, title: "장소" },
        audience: { ...metadata.notes.audience, title: "청중" },
      },
    };
  }

  return {
    ...metadata,
    title: copy.title || KO_BOOK_TITLES[metadata.code] || metadata.title,
    genre: copy.genre,
    notes: {
      authorship: { ...metadata.notes.authorship, ...copy.notes.authorship },
      date: { ...metadata.notes.date, ...copy.notes.date },
      place: { ...metadata.notes.place, ...copy.notes.place },
      audience: { ...metadata.notes.audience, ...copy.notes.audience },
    },
  };
}

export function getBookMetadata(code: string, locale?: string) {
  const metadata = BOOK_METADATA[code] ?? buildFallbackMetadata(code);
  if (!metadata) return undefined;
  const localized = localizeBookMetadata(metadata, locale);
  const refSources = bookReferenceSources(code);
  if (!refSources.length) return localized;
  return {
    ...localized,
    notes: {
      authorship: { ...localized.notes.authorship, sources: [...localized.notes.authorship.sources, ...refSources] },
      date: { ...localized.notes.date, sources: [...localized.notes.date.sources, ...refSources] },
      place: { ...localized.notes.place, sources: [...localized.notes.place.sources, ...refSources] },
      audience: { ...localized.notes.audience, sources: [...localized.notes.audience.sources, ...refSources] },
    },
  };
}
