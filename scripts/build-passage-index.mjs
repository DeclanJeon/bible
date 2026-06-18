import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.join(ROOT, "data", "passage-index");
const VERSION = "seed-2026-06-18-doctrine";
const GENERATED_AT = "2026-06-18T21:15:00.000Z";

const SEED_PASSAGES = [
  {
    code: "2TI",
    chapter: 3,
    startVerse: 16,
    endVerse: 17,
    summary: {
      en: "Scripture is God-breathed and forms people for every good work.",
      ko: "성경은 하나님의 감동으로 주어져 사람을 온전하게 하며 선한 일을 준비시킨다.",
    },
    themes: ["scripture", "revelation", "formation", "teaching", "truth"],
    doctrines: ["inspiration", "scripture", "discipleship"],
    humanConcerns: ["learning", "correction", "formation"],
    questionsAnswered: ["What is Scripture for?", "성경은 무엇인가?", "How does the Bible form a person?"],
    entities: ["God", "Scripture", "person of God"],
    keywords: ["Bible", "Scripture", "inspired", "teaching", "correction", "training", "성경", "말씀", "교훈", "책망"],
    canonicalWeight: 1,
  },
  {
    code: "EXO",
    chapter: 3,
    startVerse: 14,
    endVerse: 15,
    summary: {
      en: "God names himself as I AM and identifies himself with the covenant God of Abraham, Isaac, and Jacob.",
      ko: "하나님은 스스로 있는 분으로 자신을 알리시며 언약의 하나님으로 자신을 밝히신다.",
    },
    themes: ["God", "name", "self-existence", "covenant", "revelation"],
    doctrines: ["theology proper", "divine aseity", "covenant"],
    humanConcerns: ["identity", "trust"],
    questionsAnswered: ["Who is God?", "하나님은 누구인가?", "What does God reveal about himself?"],
    entities: ["God", "Moses", "Abraham", "Isaac", "Jacob"],
    keywords: ["I AM", "Yahweh", "LORD", "God", "name", "스스로", "여호와", "하나님"],
    canonicalWeight: 1,
  },
  {
    code: "GEN",
    chapter: 1,
    startVerse: 1,
    endVerse: 1,
    summary: {
      en: "The Bible opens by naming God as creator of the heavens and the earth.",
      ko: "성경은 하나님이 하늘과 땅을 창조하신 분이라고 시작한다.",
    },
    themes: ["creation", "God", "origin", "world"],
    doctrines: ["creation", "God as creator"],
    humanConcerns: ["origin", "meaning"],
    questionsAnswered: ["Who made the world?", "하나님은 어떤 분인가?", "Where does the Bible begin?"],
    entities: ["God", "heavens", "earth"],
    keywords: ["created", "beginning", "heavens", "earth", "창조", "태초", "하늘", "땅"],
    canonicalWeight: 0.98,
  },
  {
    code: "GEN",
    chapter: 1,
    startVerse: 26,
    endVerse: 28,
    summary: {
      en: "Humanity is made in God's image and given a vocation within creation.",
      ko: "사람은 하나님의 형상으로 지음받고 창조 세계 안에서 맡겨진 소명을 받는다.",
    },
    themes: ["humanity", "image of God", "purpose", "creation", "vocation"],
    doctrines: ["imago Dei", "creation", "human vocation"],
    humanConcerns: ["identity", "worth", "purpose"],
    questionsAnswered: ["Why do humans matter?", "사람은 왜 사는가?", "What is humanity's calling?"],
    entities: ["God", "man", "woman", "creation"],
    keywords: ["image", "likeness", "dominion", "fruitful", "형상", "사람", "생육", "다스리라"],
    canonicalWeight: 1,
  },
  {
    code: "EPH",
    chapter: 2,
    startVerse: 8,
    endVerse: 10,
    summary: {
      en: "Salvation is by grace through faith, and God's people are created in Christ for good works.",
      ko: "구원은 은혜로 믿음을 통해 받으며, 하나님의 백성은 선한 일을 위해 그리스도 안에서 지음받았다.",
    },
    themes: ["faith", "grace", "salvation", "purpose", "good works"],
    doctrines: ["salvation by grace", "faith", "union with Christ", "vocation"],
    humanConcerns: ["guilt", "worth", "purpose"],
    questionsAnswered: ["What is faith?", "구원은 무엇인가?", "사람은 왜 사는가?"],
    entities: ["God", "Christ Jesus"],
    keywords: ["grace", "faith", "saved", "works", "workmanship", "은혜", "믿음", "구원", "선한 일"],
    canonicalWeight: 1,
  },
  {
    code: "JOH",
    chapter: 3,
    startVerse: 16,
    endVerse: 17,
    summary: {
      en: "God's love is shown in giving his Son so believers may have eternal life and the world may be saved through him.",
      ko: "하나님은 세상을 사랑하셔서 아들을 주셨고, 믿는 자에게 영생과 구원을 주신다.",
    },
    themes: ["salvation", "love", "Jesus", "faith", "eternal life"],
    doctrines: ["salvation", "incarnation", "faith", "God's love"],
    humanConcerns: ["guilt", "hope", "death", "belonging"],
    questionsAnswered: ["What is salvation?", "구원은 무엇인가?", "How is God's love shown?", "What is eternal life?"],
    entities: ["God", "Son", "world"],
    keywords: ["God so loved", "only Son", "believes", "eternal life", "saved", "하나님", "독생자", "믿는", "영생", "구원"],
    canonicalWeight: 1,
  },
  {
    code: "ISA",
    chapter: 53,
    startVerse: 4,
    endVerse: 6,
    summary: {
      en: "The servant bears our griefs and sins, and by his wounds many are healed and brought peace.",
      ko: "고난받는 종은 우리의 슬픔과 죄악을 담당하며, 그의 상함으로 우리가 평화와 나음을 얻는다.",
    },
    themes: ["atonement", "suffering servant", "sin", "peace", "healing"],
    doctrines: ["atonement", "substitution", "prophecy", "reconciliation"],
    humanConcerns: ["guilt", "shame", "peace", "hope"],
    questionsAnswered: ["Why did Jesus die?", "예수님은 왜 죽으셨는가?", "How does the cross deal with sin?"],
    entities: ["servant", "LORD", "many"],
    keywords: ["pierced", "iniquities", "peace", "healed", "찔림", "죄악", "평화", "나음", "십자가"],
    canonicalWeight: 0.98,
  },
  {
    code: "MAR",
    chapter: 10,
    startVerse: 45,
    endVerse: 45,
    summary: {
      en: "Jesus says the Son of Man came to serve and to give his life as a ransom for many.",
      ko: "예수님은 인자가 섬기러 왔고 많은 사람을 위한 대속물로 자기 목숨을 주려 왔다고 말씀하신다.",
    },
    themes: ["Jesus", "cross", "service", "ransom", "salvation"],
    doctrines: ["atonement", "discipleship", "Christology"],
    humanConcerns: ["guilt", "service", "hope"],
    questionsAnswered: ["Why did Jesus die?", "예수님은 왜 죽으셨는가?", "What did Jesus say about his death?"],
    entities: ["Jesus", "Son of Man", "many"],
    keywords: ["ransom", "life", "many", "serve", "대속물", "목숨", "섬기다", "십자가", "예수"],
    canonicalWeight: 1,
  },
  {
    code: "1PE",
    chapter: 3,
    startVerse: 18,
    endVerse: 18,
    summary: {
      en: "Christ suffered once for sins, the righteous for the unrighteous, to bring us to God.",
      ko: "그리스도께서는 죄를 위하여 단번에 죽으사 의인으로서 불의한 자를 대신하여 우리를 하나님께로 인도하셨다.",
    },
    themes: ["atonement", "Christ", "suffering", "reconciliation", "God"],
    doctrines: ["atonement", "substitution", "reconciliation"],
    humanConcerns: ["guilt", "hope", "belonging"],
    questionsAnswered: ["Why did Jesus die?", "예수님은 왜 죽으셨는가?", "How are we brought to God?"],
    entities: ["Christ", "God", "righteous", "unrighteous"],
    keywords: ["sins", "righteous", "unrighteous", "bring us to God", "죄", "의인", "불의한 자", "하나님께로", "예수"],
    canonicalWeight: 1,
  },
  {
    code: "MAT",
    chapter: 11,
    startVerse: 28,
    endVerse: 30,
    summary: {
      en: "Jesus invites the weary and burdened to come to him for rest under his gentle yoke.",
      ko: "예수님은 수고하고 무거운 짐 진 사람들을 쉬게 하시겠다고 부르신다.",
    },
    themes: ["rest", "Jesus", "weariness", "pastoral care", "gentleness"],
    doctrines: ["Christ's invitation", "discipleship", "comfort"],
    humanConcerns: ["weariness", "burden", "anxiety", "despair"],
    questionsAnswered: ["Where can the weary find rest?", "힘들 때 성경은 무엇을 말하는가?", "What does Jesus offer the burdened?"],
    entities: ["Jesus"],
    keywords: ["weary", "burdened", "rest", "gentle", "수고", "무거운 짐", "쉼", "온유"],
    canonicalWeight: 0.98,
  },
  {
    code: "JOH",
    chapter: 20,
    startVerse: 28,
    endVerse: 28,
    summary: {
      en: "Thomas addresses the risen Jesus as 'My Lord and my God.'",
      ko: "도마는 부활하신 예수님께 ‘나의 주시며 나의 하나님이시니이다’라고 고백한다.",
    },
    themes: ["Jesus", "deity of Christ", "resurrection", "worship", "faith"],
    doctrines: ["deity of Christ", "resurrection", "faith"],
    humanConcerns: ["doubt", "truth", "worship", "hope"],
    questionsAnswered: ["Is Jesus God?", "예수님은 하나님이신가?", "How does Scripture speak of Jesus' deity?"],
    entities: ["Thomas", "Jesus", "God"],
    keywords: ["my Lord and my God", "Thomas", "risen Jesus", "나의 주", "나의 하나님", "도마", "부활", "예수"],
    canonicalWeight: 1,
  },
  {
    code: "MAT",
    chapter: 22,
    startVerse: 37,
    endVerse: 40,
    summary: {
      en: "Jesus summarizes the Law and Prophets as love for God and love for neighbor.",
      ko: "예수님은 율법과 선지자의 핵심을 하나님 사랑과 이웃 사랑으로 요약하신다.",
    },
    themes: ["love", "God", "neighbor", "ethics", "commandment"],
    doctrines: ["great commandment", "love", "law"],
    humanConcerns: ["relationships", "ethics", "purpose"],
    questionsAnswered: ["What matters most?", "사람은 어떻게 살아야 하는가?", "What does love require?"],
    entities: ["Jesus", "God", "neighbor", "Law", "Prophets"],
    keywords: ["love", "heart", "soul", "mind", "neighbor", "사랑", "마음", "목숨", "뜻", "이웃"],
    canonicalWeight: 1,
  },
  {
    code: "JOH",
    chapter: 1,
    startVerse: 1,
    endVerse: 14,
    summary: {
      en: "Jesus is the eternal Word who is with God, is God, and becomes flesh to reveal divine glory and grace.",
      ko: "예수님은 하나님과 함께 계시며 하나님이신 영원한 말씀이시고, 육신이 되어 하나님의 영광과 은혜를 드러내신다.",
    },
    themes: ["Jesus", "Word", "incarnation", "God", "glory"],
    doctrines: ["Christology", "incarnation", "deity of Christ", "revelation"],
    humanConcerns: ["truth", "hope", "belonging", "salvation"],
    questionsAnswered: ["Who is Jesus?", "예수님은 누구인가?", "How does God reveal himself in Jesus?"],
    entities: ["Jesus", "Word", "God", "John"],
    keywords: ["Word", "became flesh", "glory", "grace", "truth", "말씀", "육신", "영광", "은혜", "진리", "예수"],
    canonicalWeight: 1,
  },
  {
    code: "COL",
    chapter: 1,
    startVerse: 15,
    endVerse: 20,
    summary: {
      en: "Jesus is the image of the invisible God, supreme over creation, and the one through whom all things hold together and peace is made.",
      ko: "예수님은 보이지 않는 하나님의 형상이시며, 만물보다 먼저 계시고 만물을 붙드시며 화평을 이루시는 분이시다.",
    },
    themes: ["Jesus", "creation", "reconciliation", "God", "supremacy of Christ"],
    doctrines: ["Christology", "deity of Christ", "creation", "reconciliation"],
    humanConcerns: ["meaning", "hope", "belonging", "peace"],
    questionsAnswered: ["Who is Jesus?", "예수님은 누구인가?", "Why does Jesus matter for all creation?"],
    entities: ["Son", "God", "creation", "church"],
    keywords: ["image", "invisible God", "firstborn", "all things", "reconcile", "형상", "보이지 않는 하나님", "만물", "화평", "예수"],
    canonicalWeight: 1,
  },
  {
    code: "MAT",
    chapter: 3,
    startVerse: 16,
    endVerse: 17,
    summary: {
      en: "At Jesus' baptism the Son is baptized, the Spirit descends like a dove, and the Father speaks from heaven.",
      ko: "예수님의 세례 장면에서 아들은 물에서 올라오시고, 성령은 비둘기같이 임하시며, 아버지는 하늘에서 말씀하신다.",
    },
    themes: ["Trinity", "Father", "Son", "Holy Spirit", "baptism"],
    doctrines: ["Trinity", "revelation", "baptism of Jesus"],
    humanConcerns: ["truth", "worship", "belonging"],
    questionsAnswered: ["What is the Trinity?", "삼위일체는 무엇인가?", "How are Father, Son, and Spirit seen together?"],
    entities: ["Father", "Son", "Holy Spirit", "Jesus", "John the Baptist"],
    keywords: ["baptism", "Spirit", "dove", "beloved Son", "세례", "성령", "비둘기", "사랑하는 아들", "삼위일체"],
    canonicalWeight: 0.98,
  },
  {
    code: "MAT",
    chapter: 28,
    startVerse: 19,
    endVerse: 19,
    summary: {
      en: "Jesus commands baptism in the singular name of the Father, the Son, and the Holy Spirit.",
      ko: "예수님은 아버지와 아들과 성령의 이름으로 세례를 베풀라고 명하신다.",
    },
    themes: ["Trinity", "Father", "Son", "Holy Spirit", "mission"],
    doctrines: ["Trinity", "baptism", "mission"],
    humanConcerns: ["belonging", "identity", "worship"],
    questionsAnswered: ["What is the Trinity?", "삼위일체는 무엇인가?", "How does Jesus name Father, Son, and Spirit together?"],
    entities: ["Jesus", "Father", "Son", "Holy Spirit", "disciples"],
    keywords: ["name", "Father", "Son", "Holy Spirit", "이름", "아버지", "아들", "성령", "삼위일체"],
    canonicalWeight: 1,
  },
  {
    code: "JOH",
    chapter: 14,
    startVerse: 16,
    endVerse: 17,
    summary: {
      en: "Jesus says he will ask the Father, and the Father will give another Helper, the Spirit of truth, to remain with believers.",
      ko: "예수님은 아버지께 구하겠다고 하시고, 아버지는 다른 보혜사 곧 진리의 성령을 보내어 성도와 함께 있게 하신다.",
    },
    themes: ["Trinity", "Father", "Son", "Holy Spirit", "presence of God"],
    doctrines: ["Trinity", "Holy Spirit", "revelation", "presence of God"],
    humanConcerns: ["belonging", "comfort", "truth", "hope"],
    questionsAnswered: ["What is the Trinity?", "삼위일체는 무엇인가?", "How do Father, Son, and Spirit work together?"],
    entities: ["Jesus", "Father", "Holy Spirit", "disciples"],
    keywords: ["Father", "Helper", "Spirit of truth", "abide", "아버지", "보혜사", "진리의 성령", "함께", "삼위일체"],
    canonicalWeight: 0.97,
  },
  {
    code: "HEB",
    chapter: 1,
    startVerse: 1,
    endVerse: 3,
    summary: {
      en: "The Son is the radiance of God's glory and exact imprint of his nature, sustaining all things and making purification for sins.",
      ko: "아들은 하나님의 영광의 광채요 본체의 형상이시며, 만물을 붙드시고 죄를 깨끗하게 하시는 분이시다.",
    },
    themes: ["Jesus", "Son of God", "glory", "revelation", "atonement"],
    doctrines: ["Christology", "Son of God", "revelation", "atonement"],
    humanConcerns: ["hope", "forgiveness", "trust", "worship"],
    questionsAnswered: ["Who is Jesus?", "예수님은 누구인가?", "How does the Son reveal God?"],
    entities: ["Son", "God", "angels"],
    keywords: ["Son", "glory", "exact imprint", "sustains", "purification", "아들", "영광", "본체", "만물", "죄", "예수"],
    canonicalWeight: 1,
  },
  {
    code: "JOH",
    chapter: 14,
    startVerse: 6,
    endVerse: 6,
    summary: {
      en: "Jesus identifies himself as the way, the truth, and the life, and the way to the Father.",
      ko: "예수님은 자신을 길과 진리와 생명이며 아버지께 가는 길이라고 말씀하신다.",
    },
    themes: ["truth", "Jesus", "life", "way", "God"],
    doctrines: ["Christology", "salvation", "truth"],
    humanConcerns: ["truth", "direction", "hope"],
    questionsAnswered: ["What is truth?", "예수님은 누구인가?", "How does one come to the Father?"],
    entities: ["Jesus", "Father"],
    keywords: ["way", "truth", "life", "Father", "길", "진리", "생명", "아버지"],
    canonicalWeight: 1,
  },
  {
    code: "1JO",
    chapter: 4,
    startVerse: 7,
    endVerse: 12,
    summary: {
      en: "God is love, shown in sending his Son, and God's love is made visible as believers love one another.",
      ko: "하나님은 사랑이시며 그 사랑은 아들을 보내심과 서로 사랑하는 삶에서 드러난다.",
    },
    themes: ["love", "God", "Jesus", "community", "atonement"],
    doctrines: ["God is love", "incarnation", "atonement", "love"],
    humanConcerns: ["belonging", "relationships", "worth"],
    questionsAnswered: ["What is God like?", "사랑은 무엇인가?", "How is God's love shown?"],
    entities: ["God", "Son"],
    keywords: ["God is love", "love one another", "Son", "atoning sacrifice", "사랑", "하나님은 사랑", "아들", "화목"],
    canonicalWeight: 0.96,
  },
  {
    code: "HEB",
    chapter: 11,
    startVerse: 1,
    endVerse: 3,
    summary: {
      en: "Faith is assurance and conviction that receives God's unseen word and creation's origin.",
      ko: "믿음은 바라는 것들의 실상이며 보이지 않는 것들의 증거로, 하나님의 말씀을 신뢰한다.",
    },
    themes: ["faith", "hope", "unseen", "creation", "trust"],
    doctrines: ["faith", "revelation", "creation"],
    humanConcerns: ["doubt", "hope", "trust"],
    questionsAnswered: ["What is faith?", "믿음은 무엇인가?", "How does faith relate to the unseen?"],
    entities: ["God", "worlds"],
    keywords: ["faith", "assurance", "conviction", "unseen", "믿음", "실상", "증거", "보이지"],
    canonicalWeight: 0.95,
  },
  {
    code: "MAT",
    chapter: 6,
    startVerse: 9,
    endVerse: 13,
    summary: {
      en: "Jesus teaches prayer as address to the Father for God's kingdom, daily provision, forgiveness, and deliverance.",
      ko: "예수님은 하나님 아버지께 나라와 일용할 양식과 용서와 보호를 구하라고 기도를 가르치신다.",
    },
    themes: ["prayer", "Father", "kingdom", "forgiveness", "dependence"],
    doctrines: ["prayer", "kingdom of God", "forgiveness"],
    humanConcerns: ["need", "guilt", "guidance", "temptation"],
    questionsAnswered: ["Why pray?", "기도는 왜 하는가?", "What should prayer include?"],
    entities: ["Father", "kingdom"],
    keywords: ["pray", "Father", "kingdom", "daily bread", "forgive", "기도", "아버지", "나라", "일용할 양식", "용서"],
    canonicalWeight: 0.95,
  },
  {
    code: "EPH",
    chapter: 4,
    startVerse: 31,
    endVerse: 32,
    summary: {
      en: "Bitterness and malice are put away as believers forgive one another as God forgave them in Christ.",
      ko: "성도는 악한 감정을 버리고 그리스도 안에서 받은 용서처럼 서로 용서한다.",
    },
    themes: ["forgiveness", "mercy", "relationships", "anger", "kindness"],
    doctrines: ["forgiveness", "union with Christ", "sanctification"],
    humanConcerns: ["hurt", "anger", "relationships"],
    questionsAnswered: ["Should I forgive?", "용서해야 하는가?", "How does God's forgiveness shape mine?"],
    entities: ["God", "Christ"],
    keywords: ["forgive", "kind", "tenderhearted", "bitterness", "용서", "친절", "불쌍히", "악독"],
    canonicalWeight: 0.92,
  },
  {
    code: "PSA",
    chapter: 34,
    startVerse: 18,
    endVerse: 18,
    summary: {
      en: "The LORD is near to the brokenhearted and saves the crushed in spirit.",
      ko: "여호와는 마음이 상한 자에게 가까이하시고 충심으로 통회하는 자를 구원하신다.",
    },
    themes: ["suffering", "comfort", "God's nearness", "despair", "help"],
    doctrines: ["divine compassion", "deliverance"],
    humanConcerns: ["despair", "grief", "shame", "safety"],
    questionsAnswered: ["Is God near when I am broken?", "절망할 때 하나님은 가까이 계신가?", "What comfort is there in suffering?"],
    entities: ["LORD"],
    keywords: ["brokenhearted", "crushed", "spirit", "near", "상한 마음", "통회", "가까이", "구원"],
    canonicalWeight: 0.94,
  },
  {
    code: "ROM",
    chapter: 15,
    startVerse: 4,
    endVerse: 4,
    summary: {
      en: "Scripture was written for instruction so that endurance and encouragement would give hope.",
      ko: "성경은 인내와 위로로 소망을 갖게 하려고 기록되었다.",
    },
    themes: ["scripture", "hope", "endurance", "encouragement", "learning"],
    doctrines: ["scripture", "hope", "perseverance"],
    humanConcerns: ["discouragement", "suffering", "learning"],
    questionsAnswered: ["How does Scripture give hope?", "성경은 왜 기록되었는가?", "Where does hope come from?"],
    entities: ["Scriptures"],
    keywords: ["written", "instruction", "endurance", "encouragement", "hope", "기록", "교훈", "인내", "위로", "소망"],
    canonicalWeight: 0.9,
  },
  {
    code: "PRO",
    chapter: 3,
    startVerse: 5,
    endVerse: 6,
    summary: {
      en: "Wisdom calls people to trust the LORD rather than their own understanding and to acknowledge him in their paths.",
      ko: "지혜는 자기 명철만 의지하지 말고 범사에 여호와를 인정하며 길을 맡기라고 말한다.",
    },
    themes: ["wisdom", "choice", "trust", "guidance", "everyday life"],
    doctrines: ["wisdom", "providence", "trust"],
    humanConcerns: ["decision", "uncertainty", "work", "future"],
    questionsAnswered: ["How should I make a decision?", "회사 그만둘까?", "What wisdom guides everyday choices?"],
    entities: ["LORD"],
    keywords: ["trust", "understanding", "paths", "direct", "지혜", "명철", "길", "인정", "의뢰"],
    canonicalWeight: 0.9,
  },
  {
    code: "JAM",
    chapter: 1,
    startVerse: 5,
    endVerse: 5,
    summary: {
      en: "Anyone lacking wisdom may ask God, who gives generously.",
      ko: "지혜가 부족하면 후히 주시는 하나님께 구하라고 권한다.",
    },
    themes: ["wisdom", "prayer", "choice", "God's generosity"],
    doctrines: ["wisdom", "prayer", "God's generosity"],
    humanConcerns: ["decision", "uncertainty", "need"],
    questionsAnswered: ["What should I do when I lack wisdom?", "결정 앞에서 어떻게 기도해야 하는가?", "Does God give wisdom?"],
    entities: ["God"],
    keywords: ["wisdom", "ask", "God", "generously", "지혜", "구하라", "하나님", "후히"],
    canonicalWeight: 0.88,
  },
  {
    code: "1CO",
    chapter: 13,
    startVerse: 4,
    endVerse: 7,
    summary: {
      en: "Love is described through patient, truthful, enduring action rather than mere sentiment.",
      ko: "사랑은 감정만이 아니라 오래 참고 진리와 함께 기뻐하며 견디는 행동으로 묘사된다.",
    },
    themes: ["love", "truth", "patience", "ethics", "relationship"],
    doctrines: ["love", "Christian ethics"],
    humanConcerns: ["relationships", "anger", "forgiveness"],
    questionsAnswered: ["What is love?", "사랑은 무엇인가?", "How should I treat another person?"],
    entities: ["love", "truth"],
    keywords: ["love", "patient", "kind", "truth", "endures", "사랑", "오래 참고", "진리", "견디느니라"],
    canonicalWeight: 0.9,
  },
];

function metadataPath(locale) {
  return path.join(ROOT, locale === "ko" ? "korean_bible" : "world_english_bible", "metadata.json");
}

function vplPath(locale) {
  return path.join(ROOT, locale === "ko" ? "korean_bible" : "world_english_bible", "canon_66_vpl.txt");
}

function normalizeText(value) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\p{Letter}\p{Number}\s'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadMetadata(locale) {
  const parsed = JSON.parse(await readFile(metadataPath(locale), "utf8"));
  return Object.fromEntries(parsed.books.map((book) => [book.code, book]));
}

async function loadVerseText(locale) {
  const raw = await readFile(vplPath(locale), "utf8");
  const verses = new Map();
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([0-9A-Z]{3})\s+(\d+):(\d+)\s+(.*)$/);
    if (match) verses.set(`${match[1]} ${match[2]}:${match[3]}`, match[4]);
  }
  return verses;
}

function verseKeys(seed) {
  const keys = [];
  for (let verse = seed.startVerse; verse <= seed.endVerse; verse += 1) {
    keys.push(`${seed.code} ${seed.chapter}:${verse}`);
  }
  return keys;
}

function referenceLabel(reference, books) {
  const book = books[reference.code];
  const name = book?.name ?? reference.code;
  const verse = reference.startVerse === reference.endVerse ? `${reference.startVerse}` : `${reference.startVerse}-${reference.endVerse}`;
  return `${name} ${reference.chapter}:${verse}`;
}

function parseCrossRefTargets(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(parseCrossRefTargets);
  if (typeof value === "string") return /^[1-3]?[A-Z]{2,3} \d+:\d+/.test(value) ? [value] : [];
  if (typeof value !== "object") return [];

  if (typeof value.toLabel === "string") return [value.toLabel];
  if (typeof value.targetLabel === "string") return [value.targetLabel];
  if (typeof value.displayReference === "string") return [value.displayReference];
  return Object.values(value).flatMap(parseCrossRefTargets);
}

async function loadCrossReferenceDegrees() {
  try {
    const parsed = JSON.parse(await readFile(path.join(ROOT, "data", "knowledge", "openbible-crossrefs.json"), "utf8"));
    const byVerse = parsed.byVerse && typeof parsed.byVerse === "object" ? parsed.byVerse : {};
    const degrees = new Map();
    const neighbors = new Map();
    for (const [source, value] of Object.entries(byVerse)) {
      const targets = [...new Set(parseCrossRefTargets(value))].sort();
      degrees.set(source, targets.length);
      neighbors.set(source, targets);
    }
    return { degrees, neighbors };
  } catch {
    return { degrees: new Map(), neighbors: new Map() };
  }
}

function passageCrossReferences(keys, neighbors) {
  const refs = new Set();
  for (const key of keys) {
    for (const target of neighbors.get(key) ?? []) refs.add(target);
  }
  return [...refs].sort().slice(0, 12);
}

function passageCrossReferenceDegree(keys, degrees) {
  let total = 0;
  for (const key of keys) total += degrees.get(key) ?? 0;
  return total;
}

function buildUnit(seed, locale, books, verses, degrees, neighbors) {
  const reference = {
    code: seed.code,
    chapter: seed.chapter,
    startVerse: seed.startVerse,
    endVerse: seed.endVerse,
  };
  const keys = verseKeys(seed);
  const lines = keys.map((key) => verses.get(key));
  const missing = lines.findIndex((line) => !line);
  if (missing !== -1) throw new Error(`Missing verse ${keys[missing]} in ${locale} corpus`);

  const text = lines.map((line, index) => `${seed.startVerse + index}. ${line}`).join(" ");
  const crossReferences = passageCrossReferences(keys, neighbors);
  const axes = [...new Set([...seed.themes, ...seed.doctrines, ...seed.humanConcerns])].sort();

  return {
    id: `${locale}:${seed.code}-${seed.chapter}-${seed.startVerse}-${seed.endVerse}`,
    reference,
    displayReference: referenceLabel(reference, books),
    locale,
    text,
    normalizedText: normalizeText(text),
    summary: seed.summary[locale],
    themes: seed.themes,
    doctrines: seed.doctrines,
    humanConcerns: seed.humanConcerns,
    questionsAnswered: seed.questionsAnswered,
    entities: seed.entities,
    keywords: seed.keywords,
    axes,
    canonicalWeight: seed.canonicalWeight,
    crossReferenceDegree: passageCrossReferenceDegree(keys, degrees),
    crossReferences,
  };
}

async function buildLocale(locale, crossReferences) {
  const [books, verses] = await Promise.all([loadMetadata(locale), loadVerseText(locale)]);
  const units = SEED_PASSAGES.map((seed) => buildUnit(seed, locale, books, verses, crossReferences.degrees, crossReferences.neighbors));
  units.sort((a, b) => a.id.localeCompare(b.id));

  return {
    version: VERSION,
    generatedAt: GENERATED_AT,
    locale,
    source: {
      translation: locale === "ko" ? "korean_bible" : "world_english_bible",
      corpus: path.relative(ROOT, vplPath(locale)),
      metadata: path.relative(ROOT, metadataPath(locale)),
    },
    units,
    stats: {
      unitCount: units.length,
      seedReferenceCount: SEED_PASSAGES.length,
      crossReferenceDegreeTotal: units.reduce((sum, unit) => sum + unit.crossReferenceDegree, 0),
    },
  };
}

async function main() {
  const crossReferences = await loadCrossReferenceDegrees();
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const locale of ["en", "ko"]) {
    const index = await buildLocale(locale, crossReferences);
    const outputPath = path.join(OUTPUT_DIR, `${locale}.json`);
    await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`);
    console.log(`wrote ${path.relative(ROOT, outputPath)} (${index.units.length} units)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
