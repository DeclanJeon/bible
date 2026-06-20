import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.join(ROOT, "data", "passage-index");
const VERSION = "passage-unit-2026-06-20-v1";
const GENERATED_AT = "2026-06-20T00:00:00.000Z";
const KO_FALLBACK_ALLOWLIST_PATH = path.join(ROOT, "data", "passage-index", "ko-fallback-allowlist.json");

async function loadKoFallbackAllowlist() {
  const parsed = JSON.parse(await readFile(KO_FALLBACK_ALLOWLIST_PATH, "utf8"));
  return new Set(parsed.allowedMissingVerseKeys ?? []);
}

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

const POETRY_BOOKS = new Set(["JOB", "PSA", "PRO", "ECC", "SOL", "LAM"]);
const EPISTLE_BOOKS = new Set(["ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAM", "1PE", "2PE", "1JO", "2JO", "3JO", "JUD"]);
const GOSPEL_BOOKS = new Set(["MAT", "MAR", "LUK", "JOH"]);
const APOCALYPTIC_BOOKS = new Set(["DAN", "REV"]);
const PROPHETIC_BOOKS = new Set(["ISA", "JER", "EZE", "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL"]);
const LAW_BOOKS = new Set(["GEN", "EXO", "LEV", "NUM", "DEU"]);

const ENGLISH_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "because", "been", "before", "being", "but", "by", "for", "from", "had", "has", "have", "he", "her", "his", "i", "if", "in", "into", "is", "it", "its", "let", "me", "my", "no", "not", "of", "on", "or", "our", "so", "than", "that", "the", "their", "them", "there", "they", "this", "those", "to", "us", "was", "we", "were", "what", "when", "which", "who", "will", "with", "you", "your"
]);

const KOREAN_STOP_WORDS = new Set([
  "그", "그가", "그는", "그를", "그의", "그들에게", "그들에게로", "그때", "그리하여", "너", "너희", "너희는", "나", "나는", "나를", "나의", "너를", "너의", "너희의", "우리", "우리는", "우리의", "내", "내가", "내게", "또", "또한", "및", "와", "과", "은", "는", "이", "가", "을", "를", "에", "에서", "에게", "에게서", "으로", "로", "도", "만", "이나", "나", "하며", "하고", "하니", "하라", "하시니", "하시고", "하셨으니", "이라", "이라도", "이는", "있는", "있고", "있으니", "있으라", "있다", "되니", "되어", "되며", "되었고", "된다", "하여", "하여금", "하되", "한", "할", "하는", "하며", "더", "즉", "저", "저희", "것", "수", "때", "모든"
]);

const LOCALIZED_LABELS = {
  God: { en: "God", ko: "하나님" },
  Jesus: { en: "Jesus", ko: "예수" },
  Christ: { en: "Christ", ko: "그리스도" },
  church: { en: "church", ko: "교회" },
  community: { en: "community", ko: "공동체" },
  covenant: { en: "covenant", ko: "언약" },
  creation: { en: "creation", ko: "창조" },
  deliverance: { en: "deliverance", ko: "구원" },
  discipleship: { en: "discipleship", ko: "제자도" },
  exile: { en: "exile", ko: "포로" },
  faith: { en: "faith", ko: "믿음" },
  forgiveness: { en: "forgiveness", ko: "용서" },
  grace: { en: "grace", ko: "은혜" },
  guidance: { en: "guidance", ko: "인도" },
  grief: { en: "grief", ko: "슬픔" },
  healing: { en: "healing", ko: "치유" },
  holiness: { en: "holiness", ko: "거룩" },
  hope: { en: "hope", ko: "소망" },
  identity: { en: "identity", ko: "정체성" },
  justice: { en: "justice", ko: "정의" },
  judgment: { en: "judgment", ko: "심판" },
  kingdom: { en: "kingdom", ko: "하나님 나라" },
  law: { en: "law", ko: "율법" },
  love: { en: "love", ko: "사랑" },
  mercy: { en: "mercy", ko: "긍휼" },
  mission: { en: "mission", ko: "사명" },
  obedience: { en: "obedience", ko: "순종" },
  prayer: { en: "prayer", ko: "기도" },
  prophecy: { en: "prophecy", ko: "예언" },
  promise: { en: "promise", ko: "약속" },
  repentance: { en: "repentance", ko: "회개" },
  resurrection: { en: "resurrection", ko: "부활" },
  salvation: { en: "salvation", ko: "구원" },
  scripture: { en: "scripture", ko: "성경" },
  suffering: { en: "suffering", ko: "고난" },
  trust: { en: "trust", ko: "신뢰" },
  truth: { en: "truth", ko: "진리" },
  wisdom: { en: "wisdom", ko: "지혜" },
  worship: { en: "worship", ko: "예배" },
  anxiety: { en: "anxiety", ko: "불안" },
  belonging: { en: "belonging", ko: "소속" },
  comfort: { en: "comfort", ko: "위로" },
  conflict: { en: "conflict", ko: "갈등" },
  despair: { en: "despair", ko: "절망" },
  fear: { en: "fear", ko: "두려움" },
  guilt: { en: "guilt", ko: "죄책감" },
  meaning: { en: "meaning", ko: "의미" },
  peace: { en: "peace", ko: "평안" },
  purpose: { en: "purpose", ko: "목적" },
  relationships: { en: "relationships", ko: "관계" },
  weariness: { en: "weariness", ko: "피곤" },
  worth: { en: "worth", ko: "존귀" },
};

const ENTITY_RULES = [
  { canonical: "God", needles: { en: [" god ", " lord ", " yahweh ", " father ", " almighty "], ko: [" 하나님", " 여호와", " 주", " 아버지"] } },
  { canonical: "Jesus", needles: { en: [" jesus ", " son of man ", " son of god "], ko: [" 예수", " 인자", " 하나님의 아들"] } },
  { canonical: "Christ", needles: { en: [" christ ", " messiah "], ko: [" 그리스도", " 메시야", " 메시아"] } },
  { canonical: "Holy Spirit", needles: { en: [" holy spirit ", " spirit of god ", " spirit of truth "], ko: [" 성령", " 하나님의 신", " 진리의 영", " 보혜사"] } },
  { canonical: "Israel", needles: { en: [" israel ", " jacob "], ko: [" 이스라엘", " 야곱"] } },
  { canonical: "Moses", needles: { en: [" moses "], ko: [" 모세"] } },
  { canonical: "David", needles: { en: [" david "], ko: [" 다윗"] } },
  { canonical: "Abraham", needles: { en: [" abraham "], ko: [" 아브라함"] } },
  { canonical: "Jerusalem", needles: { en: [" jerusalem ", " zion "], ko: [" 예루살렘", " 시온"] } },
  { canonical: "Paul", needles: { en: [" paul "], ko: [" 바울"] } },
  { canonical: "Peter", needles: { en: [" peter "], ko: [" 베드로"] } },
  { canonical: "church", needles: { en: [" church ", " churches ", " saints ", " brothers "], ko: [" 교회", " 성도", " 형제", " 자매"] } },
  { canonical: "nations", needles: { en: [" nations ", " gentiles ", " peoples "], ko: [" 열방", " 이방", " 민족"] } },
];

const CONCEPT_RULES = [
  {
    key: "creation",
    themes: ["creation", "God"],
    doctrines: ["creation"],
    humanConcerns: ["meaning", "identity"],
    questionsAnswered: {
      en: "How does this passage speak about creation and origin?",
      ko: "이 본문은 창조와 기원에 대해 무엇을 말하는가?",
    },
    needles: { en: ["create", "created", "beginning", "heavens", "earth", "light"], ko: ["창조", "태초", "천지", "하늘", "땅", "빛"] },
  },
  {
    key: "covenant",
    themes: ["covenant", "promise"],
    doctrines: ["covenant"],
    humanConcerns: ["trust", "hope"],
    questionsAnswered: {
      en: "What promise or covenant does this passage highlight?",
      ko: "이 본문은 어떤 약속과 언약을 강조하는가?",
    },
    needles: { en: ["covenant", "swore", "promise", "promised", "oath"], ko: ["언약", "맹세", "약속"] },
  },
  {
    key: "deliverance",
    themes: ["salvation", "deliverance"],
    doctrines: ["salvation"],
    humanConcerns: ["fear", "hope"],
    questionsAnswered: {
      en: "How does this passage describe God's rescue?",
      ko: "이 본문은 하나님의 구원을 어떻게 보여 주는가?",
    },
    needles: { en: ["save", "saved", "deliver", "delivered", "redeem", "redeemed", "ransom", "rescue"], ko: ["구원", "구원하", "건지", "속량", "대속"] },
  },
  {
    key: "law",
    themes: ["law", "obedience"],
    doctrines: ["law"],
    humanConcerns: ["guidance", "purpose"],
    questionsAnswered: {
      en: "What obedience or command does this passage press?",
      ko: "이 본문은 어떤 순종과 명령을 촉구하는가?",
    },
    needles: { en: ["command", "commandments", "statute", "law", "decree", "ordinance"], ko: ["계명", "율법", "명령", "규례", "법도"] },
  },
  {
    key: "wisdom",
    themes: ["wisdom", "instruction"],
    doctrines: ["wisdom"],
    humanConcerns: ["guidance", "trust"],
    questionsAnswered: {
      en: "What wisdom for life does this passage offer?",
      ko: "이 본문은 삶의 지혜를 어떻게 제시하는가?",
    },
    needles: { en: ["wise", "wisdom", "understanding", "fool", "instruction"], ko: ["지혜", "슬기", "명철", "훈계", "미련"] },
  },
  {
    key: "prayer",
    themes: ["prayer", "worship"],
    doctrines: ["prayer"],
    humanConcerns: ["anxiety", "grief", "hope"],
    questionsAnswered: {
      en: "How does this passage teach prayer or worship?",
      ko: "이 본문은 기도와 예배를 어떻게 가르치는가?",
    },
    needles: { en: ["pray", "prayer", "praise", "sing", "worship", "call upon"], ko: ["기도", "부르짖", "찬양", "예배", "노래"] },
  },
  {
    key: "justice",
    themes: ["justice", "mercy"],
    doctrines: ["justice"],
    humanConcerns: ["conflict", "peace", "relationships"],
    questionsAnswered: {
      en: "What does this passage say about justice and mercy?",
      ko: "이 본문은 정의와 긍휼에 대해 무엇을 말하는가?",
    },
    needles: { en: ["justice", "righteous", "righteousness", "oppress", "widow", "poor", "mercy"], ko: ["정의", "공의", "긍휼", "가난", "압제", "고아", "과부"] },
  },
  {
    key: "repentance",
    themes: ["repentance", "holiness"],
    doctrines: ["repentance"],
    humanConcerns: ["guilt", "hope"],
    questionsAnswered: {
      en: "How does this passage call people to repent?",
      ko: "이 본문은 어떻게 회개를 촉구하는가?",
    },
    needles: { en: ["repent", "turn", "return", "cleanse", "holy"], ko: ["회개", "돌이키", "정결", "거룩"] },
  },
  {
    key: "suffering",
    themes: ["suffering", "hope"],
    doctrines: ["perseverance"],
    humanConcerns: ["grief", "despair", "hope"],
    questionsAnswered: {
      en: "How does this passage address suffering?",
      ko: "이 본문은 고난을 어떻게 다루는가?",
    },
    needles: { en: ["suffer", "suffering", "affliction", "tears", "trouble", "tribulation"], ko: ["고난", "환난", "고통", "눈물", "괴로움"] },
  },
  {
    key: "faith",
    themes: ["faith", "trust"],
    doctrines: ["faith"],
    humanConcerns: ["fear", "trust", "hope"],
    questionsAnswered: {
      en: "What does this passage say about faith and trust?",
      ko: "이 본문은 믿음과 신뢰에 대해 무엇을 말하는가?",
    },
    needles: { en: ["faith", "believe", "believes", "trusted", "trust", "hope in"], ko: ["믿음", "믿는", "믿으", "신뢰", "의지"] },
  },
  {
    key: "grace",
    themes: ["grace", "salvation"],
    doctrines: ["grace"],
    humanConcerns: ["guilt", "worth", "hope"],
    questionsAnswered: {
      en: "How does this passage speak about grace?",
      ko: "이 본문은 은혜를 어떻게 말하는가?",
    },
    needles: { en: ["grace", "gift", "mercy", "justified"], ko: ["은혜", "선물", "자비", "의롭다"] },
  },
  {
    key: "love",
    themes: ["love", "community"],
    doctrines: ["love"],
    humanConcerns: ["relationships", "belonging"],
    questionsAnswered: {
      en: "How does this passage define faithful love?",
      ko: "이 본문은 신실한 사랑을 어떻게 보여 주는가?",
    },
    needles: { en: ["love", "beloved", "neighbor", "one another"], ko: ["사랑", "이웃", "서로"] },
  },
  {
    key: "kingdom",
    themes: ["kingdom", "mission"],
    doctrines: ["kingdom"],
    humanConcerns: ["purpose", "hope"],
    questionsAnswered: {
      en: "How does this passage speak about God's kingdom?",
      ko: "이 본문은 하나님의 나라를 어떻게 말하는가?",
    },
    needles: { en: ["kingdom", "gospel", "disciple", "disciples", "nations"], ko: ["천국", "하나님 나라", "복음", "제자", "열방"] },
  },
  {
    key: "prophecy",
    themes: ["prophecy", "hope"],
    doctrines: ["prophecy"],
    humanConcerns: ["hope", "fear"],
    questionsAnswered: {
      en: "What future hope or warning does this passage carry?",
      ko: "이 본문은 어떤 미래의 경고와 소망을 전하는가?",
    },
    needles: { en: ["vision", "oracle", "day of the lord", "behold", "coming"], ko: ["묵시", "이상", "여호와의 날", "보라", "오시리라"] },
  },
  {
    key: "resurrection",
    themes: ["resurrection", "hope"],
    doctrines: ["resurrection"],
    humanConcerns: ["grief", "hope", "weariness"],
    questionsAnswered: {
      en: "How does this passage speak about life, death, or resurrection?",
      ko: "이 본문은 생명과 죽음과 부활을 어떻게 말하는가?",
    },
    needles: { en: ["rise", "risen", "raised", "alive", "life eternal", "resurrection"], ko: ["부활", "살아나", "일으키", "생명", "영생"] },
  },
  {
    key: "spirit",
    themes: ["Holy Spirit", "presence of God"],
    doctrines: ["Holy Spirit"],
    humanConcerns: ["guidance", "comfort", "hope"],
    questionsAnswered: {
      en: "How does this passage speak about the Spirit or God's presence?",
      ko: "이 본문은 성령과 하나님의 임재를 어떻게 말하는가?",
    },
    needles: { en: ["spirit", "helper", "comforter", "presence"], ko: ["성령", "보혜사", "영", "임재"] },
  },
  {
    key: "scripture",
    themes: ["scripture", "truth"],
    doctrines: ["scripture"],
    humanConcerns: ["guidance", "truth"],
    questionsAnswered: {
      en: "How does this passage frame God's word or truth?",
      ko: "이 본문은 하나님의 말씀과 진리를 어떻게 보여 주는가?",
    },
    needles: { en: ["word", "scripture", "truth", "law of the lord"], ko: ["말씀", "성경", "진리", "율법"] },
  },
];

function normalizeText(value) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{Letter}\p{Number}\s'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function localizeLabel(locale, value) {
  return LOCALIZED_LABELS[value]?.[locale] ?? value;
}

function genreForBook(code) {
  if (POETRY_BOOKS.has(code)) return code === "PRO" ? "wisdom" : "poetry";
  if (EPISTLE_BOOKS.has(code)) return "epistle";
  if (GOSPEL_BOOKS.has(code)) return "gospel";
  if (APOCALYPTIC_BOOKS.has(code)) return "apocalyptic";
  if (PROPHETIC_BOOKS.has(code)) return "prophetic";
  if (LAW_BOOKS.has(code)) return "law";
  return "narrative";
}

function segmentationRulesForGenre(genre) {
  switch (genre) {
    case "wisdom":
    case "poetry":
      return { min: 1, target: 3, max: 4 };
    case "apocalyptic":
      return { min: 2, target: 4, max: 6 };
    case "epistle":
      return { min: 3, target: 5, max: 8 };
    case "gospel":
      return { min: 3, target: 5, max: 7 };
    case "prophetic":
      return { min: 3, target: 6, max: 9 };
    case "law":
      return { min: 3, target: 6, max: 9 };
    default:
      return { min: 3, target: 6, max: 10 };
  }
}

function tokenList(normalizedText) {
  return normalizedText.split(/\s+/).filter(Boolean);
}

function shouldKeepToken(locale, token) {
  if (!token || /^\d+$/.test(token)) return false;
  if (locale === "ko") return token.length >= 2 && !KOREAN_STOP_WORDS.has(token);
  return token.length >= 2 && !ENGLISH_STOP_WORDS.has(token);
}

function topKeywords(locale, normalizedText, limit = 8) {
  const counts = new Map();
  const firstSeen = new Map();
  const tokens = tokenList(normalizedText);
  tokens.forEach((token, index) => {
    if (!shouldKeepToken(locale, token)) return;
    counts.set(token, (counts.get(token) ?? 0) + 1);
    if (!firstSeen.has(token)) firstSeen.set(token, index);
  });
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || (firstSeen.get(left[0]) ?? 0) - (firstSeen.get(right[0]) ?? 0) || right[0].length - left[0].length)
    .slice(0, limit)
    .map(([token]) => token);
}

async function loadMetadata(locale) {
  const parsed = JSON.parse(await readFile(metadataPath(locale), "utf8"));
  return {
    raw: parsed,
    books: Object.fromEntries(parsed.books.map((book) => [book.code, book])),
  };
}

async function loadVerseText(locale) {
  const raw = await readFile(vplPath(locale), "utf8");
  const verses = new Map();
  const chapters = new Map();
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([0-9A-Z]{3})\s+(\d+):(\d+)\s+(.*)$/);
    if (!match) continue;
    const code = match[1];
    const chapter = Number.parseInt(match[2], 10);
    const verse = Number.parseInt(match[3], 10);
    const text = match[4].trim();
    const key = `${code} ${chapter}:${verse}`;
    verses.set(key, { text, sourceLocale: locale });
    const chapterKey = `${code} ${chapter}`;
    const items = chapters.get(chapterKey) ?? [];
    items.push({ verse, text, sourceLocale: locale });
    chapters.set(chapterKey, items);
  }
  for (const items of chapters.values()) items.sort((left, right) => left.verse - right.verse);
  const primary = { verses, chapters };
  if (locale !== "ko") return primary;
  const fallback = await loadVerseText("en");
  const allowlist = await loadKoFallbackAllowlist();
  return mergeFallbackChapters(primary, fallback, allowlist);
}

function mergeFallbackChapters(primary, fallback, allowlist) {
  const mergedVerses = new Map(primary.verses);
  for (const [key, verse] of fallback.verses.entries()) {
    if (!mergedVerses.has(key) && allowlist.has(key)) mergedVerses.set(key, verse);
  }

  const mergedChapters = new Map(primary.chapters);
  for (const [chapterKey, fallbackEntries] of fallback.chapters.entries()) {
    const existing = mergedChapters.get(chapterKey) ?? [];
    const seen = new Set(existing.map((entry) => entry.verse));
    const combined = [...existing];
    for (const entry of fallbackEntries) {
      const verseKey = `${chapterKey}:${entry.verse}`;
      if (!seen.has(entry.verse) && allowlist.has(verseKey)) {
        combined.push(entry);
        seen.add(entry.verse);
      }
    }
    combined.sort((left, right) => left.verse - right.verse);
    mergedChapters.set(chapterKey, combined);
  }

  return { verses: mergedVerses, chapters: mergedChapters };
}


function verseEntriesForReference(reference, chapterVerses) {
  return chapterVerses.filter((entry) => entry.verse >= reference.startVerse && entry.verse <= reference.endVerse);
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

function makeSeedMap() {
  const bySpan = new Map();
  const byChapter = new Map();
  for (const seed of SEED_PASSAGES) {
    const spanKey = `${seed.code}:${seed.chapter}:${seed.startVerse}-${seed.endVerse}`;
    bySpan.set(spanKey, seed);
    const chapterKey = `${seed.code}:${seed.chapter}`;
    const current = byChapter.get(chapterKey) ?? [];
    current.push(seed);
    byChapter.set(chapterKey, current);
  }
  for (const seeds of byChapter.values()) seeds.sort((left, right) => left.startVerse - right.startVerse || left.endVerse - right.endVerse);
  return { bySpan, byChapter };
}

function chooseUnitSize(remaining, rules) {
  if (remaining <= rules.max) return remaining;
  let size = Math.min(rules.target, rules.max, remaining);
  const remainder = remaining - size;
  if (remainder > 0 && remainder < rules.min) size = Math.max(rules.min, size - (rules.min - remainder));
  return Math.max(1, Math.min(size, remaining));
}

function splitIntoContiguousGroups(verseEntries) {
  const groups = [];
  let current = [];
  for (const entry of verseEntries) {
    const previous = current.at(-1);
    if (previous && entry.verse !== previous.verse + 1) {
      groups.push(current);
      current = [];
    }
    current.push(entry);
  }
  if (current.length) groups.push(current);
  return groups;
}

function segmentGap(code, chapter, verseEntries, rules) {
  const spans = [];
  let cursor = 0;
  while (cursor < verseEntries.length) {
    const remaining = verseEntries.length - cursor;
    const size = chooseUnitSize(remaining, rules);
    const slice = verseEntries.slice(cursor, cursor + size);
    spans.push({ code, chapter, startVerse: slice[0].verse, endVerse: slice[slice.length - 1].verse });
    cursor += size;
  }
  return spans;
}

function buildChapterReferences(code, chapter, verseEntries, seedRanges, rules) {
  if (!verseEntries.length) return [];
  const spans = [];
  for (const group of splitIntoContiguousGroups(verseEntries)) {
    let cursor = 0;
    const groupStart = group[0].verse;
    const groupEnd = group[group.length - 1].verse;
    const groupSeeds = seedRanges.filter((seed) => seed.startVerse >= groupStart && seed.endVerse <= groupEnd);
    for (const seed of groupSeeds) {
      const seedStartIndex = group.findIndex((entry) => entry.verse === seed.startVerse);
      const seedEndIndex = group.findIndex((entry) => entry.verse === seed.endVerse);
      if (seedStartIndex === -1 || seedEndIndex === -1) continue;
      if (seedStartIndex > cursor) spans.push(...segmentGap(code, chapter, group.slice(cursor, seedStartIndex), rules));
      spans.push({ code, chapter, startVerse: seed.startVerse, endVerse: seed.endVerse });
      cursor = seedEndIndex + 1;
    }
    if (cursor < group.length) spans.push(...segmentGap(code, chapter, group.slice(cursor), rules));
  }
  return spans;
}


function matchesNeedle(locale, normalizedText, needle) {
  const normalizedNeedle = normalizeText(needle).trim();
  if (!normalizedNeedle) return false;
  if (locale === "ko") {
    if (normalizedNeedle.length < 2) return false;
    return tokenList(normalizedText).some((token) => token === normalizedNeedle || token.includes(normalizedNeedle));
  }
  const haystack = ` ${normalizedText} `;
  return haystack.includes(` ${normalizedNeedle} `) || normalizedText.includes(normalizedNeedle);
}

function matchesConcept(rule, locale, normalizedText) {
  return rule.needles[locale].some((needle) => matchesNeedle(locale, normalizedText, needle));
}

function detectEntities(locale, normalizedText) {
  return ENTITY_RULES.filter((rule) => rule.needles[locale].some((needle) => matchesNeedle(locale, normalizedText, needle))).map((rule) => rule.canonical);
}

function baseMetadataForGenre(genre) {
  switch (genre) {
    case "wisdom":
      return { themes: ["wisdom"], doctrines: ["wisdom"], humanConcerns: ["guidance", "trust"] };
    case "poetry":
      return { themes: ["worship", "prayer"], doctrines: ["worship"], humanConcerns: ["grief", "hope"] };
    case "epistle":
      return { themes: ["church", "discipleship"], doctrines: ["discipleship"], humanConcerns: ["belonging", "growth"] };
    case "gospel":
      return { themes: ["Jesus", "kingdom"], doctrines: ["Christology"], humanConcerns: ["faith", "hope"] };
    case "prophetic":
      return { themes: ["prophecy", "justice"], doctrines: ["prophecy"], humanConcerns: ["repentance", "hope"] };
    case "apocalyptic":
      return { themes: ["hope", "kingdom"], doctrines: ["future hope"], humanConcerns: ["fear", "hope"] };
    case "law":
      return { themes: ["covenant", "obedience"], doctrines: ["law"], humanConcerns: ["identity", "purpose"] };
    default:
      return { themes: ["God", "covenant"], doctrines: ["providence"], humanConcerns: ["trust", "guidance"] };
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function composeSummary(locale, displayReference, themes, entities) {
  const themeLabels = themes.slice(0, 3).map((theme) => localizeLabel(locale, theme));
  const entityLabels = entities.slice(0, 2).map((entity) => localizeLabel(locale, entity));
  if (locale === "ko") {
    if (themeLabels.length && entityLabels.length) return `${displayReference}는 ${entityLabels.join("과 ")} 및 ${themeLabels.join(", ")}에 초점을 둔다.`;
    if (themeLabels.length) return `${displayReference}는 ${themeLabels.join(", ")}에 초점을 둔다.`;
    return `${displayReference}는 이 장의 핵심 흐름을 묶는 본문 단위이다.`;
  }
  if (themeLabels.length && entityLabels.length) return `${displayReference} focuses on ${entityLabels.join(" and ")} and themes of ${themeLabels.join(", ")}.`;
  if (themeLabels.length) return `${displayReference} focuses on ${themeLabels.join(", ")}.`;
  return `${displayReference} is a chapter-bound passage unit for retrieval.`;
}

function fallbackQuestion(locale, theme) {
  const label = localizeLabel(locale, theme);
  return locale === "ko" ? `이 본문은 ${label}에 대해 무엇을 말하는가?` : `What does this passage say about ${label}?`;
}

function canonicalWeightFor(genre, crossReferenceDegree, themes, hasSeedOverride) {
  let weight = 0.56;
  switch (genre) {
    case "gospel":
      weight += 0.16;
      break;
    case "epistle":
      weight += 0.14;
      break;
    case "apocalyptic":
      weight += 0.11;
      break;
    case "prophetic":
      weight += 0.1;
      break;
    case "law":
      weight += 0.09;
      break;
    case "wisdom":
      weight += 0.08;
      break;
    case "poetry":
      weight += 0.06;
      break;
    default:
      weight += 0.07;
      break;
  }
  const highSignalThemes = new Set(["creation", "salvation", "love", "faith", "resurrection", "grace", "Jesus", "God", "Holy Spirit", "kingdom"]);
  weight += themes.filter((theme) => highSignalThemes.has(theme)).length * 0.02;
  weight += Math.min(crossReferenceDegree / 240, 0.16);
  if (hasSeedOverride) weight = Math.max(weight, 0.95);
  return Number(clamp(weight, 0.45, 1).toFixed(3));
}

function buildMetadata({ locale, displayReference, normalizedText, genre, crossReferenceDegree, seed }) {
  if (seed) {
    const themes = seed.themes;
    const doctrines = seed.doctrines;
    const humanConcerns = seed.humanConcerns;
    const entities = seed.entities;
    const keywords = unique([...seed.keywords, ...topKeywords(locale, normalizedText, 6)]).slice(0, 14);
    const axes = unique([...themes, ...doctrines, ...humanConcerns, ...themes.map((theme) => localizeLabel(locale, theme)), ...humanConcerns.map((concern) => localizeLabel(locale, concern))]).slice(0, 18);
    return {
      summary: seed.summary[locale],
      themes,
      doctrines,
      humanConcerns,
      questionsAnswered: seed.questionsAnswered,
      entities,
      keywords,
      axes,
      canonicalWeight: Number(Math.max(seed.canonicalWeight, canonicalWeightFor(genre, crossReferenceDegree, themes, true)).toFixed(3)),
      seedOverlay: true,
    };
  }

  const matchedConcepts = CONCEPT_RULES.filter((rule) => matchesConcept(rule, locale, normalizedText));
  const base = baseMetadataForGenre(genre);
  const themes = unique([...matchedConcepts.flatMap((rule) => rule.themes), ...base.themes]).slice(0, 6);
  const doctrines = unique([...matchedConcepts.flatMap((rule) => rule.doctrines), ...base.doctrines]).slice(0, 6);
  const humanConcerns = unique([...matchedConcepts.flatMap((rule) => rule.humanConcerns), ...base.humanConcerns]).slice(0, 6);
  const entities = unique(detectEntities(locale, normalizedText)).slice(0, 6);
  const keywords = unique([
    ...topKeywords(locale, normalizedText, 8),
    ...themes.map((theme) => localizeLabel(locale, theme)),
    ...entities.map((entity) => localizeLabel(locale, entity)),
  ]).slice(0, 14);
  const questionsAnswered = unique([
    ...matchedConcepts.map((rule) => rule.questionsAnswered[locale]),
    fallbackQuestion(locale, themes[0] ?? genre),
    fallbackQuestion(locale, themes[1] ?? genre),
  ]).slice(0, 4);
  const axes = unique([
    ...themes,
    ...doctrines,
    ...humanConcerns,
    ...themes.map((theme) => localizeLabel(locale, theme)),
    ...humanConcerns.map((concern) => localizeLabel(locale, concern)),
  ]).slice(0, 18);
  return {
    summary: composeSummary(locale, displayReference, themes, entities),
    themes,
    doctrines,
    humanConcerns,
    questionsAnswered,
    entities,
    keywords,
    axes,
    canonicalWeight: canonicalWeightFor(genre, crossReferenceDegree, themes, false),
    seedOverlay: false,
  };
}

function buildUnit(reference, chapterVerses, locale, books, degrees, neighbors, seed) {
  const entries = verseEntriesForReference(reference, chapterVerses);
  if (!entries.length) throw new Error(`Missing verses for ${reference.code} ${reference.chapter}:${reference.startVerse}-${reference.endVerse} in ${locale} corpus`);

  const keys = entries.map((entry) => `${reference.code} ${reference.chapter}:${entry.verse}`);
  const text = entries.map((entry) => `${entry.verse}. ${entry.text}`).join(" ");
  const normalizedText = normalizeText(text);
  const crossReferences = passageCrossReferences(keys, neighbors);
  const crossReferenceDegree = passageCrossReferenceDegree(keys, degrees);
  const genre = genreForBook(reference.code);
  const displayReference = referenceLabel(reference, books);
  const metadata = buildMetadata({ locale, displayReference, normalizedText, genre, crossReferenceDegree, seed });
  const sourceLocale = [...new Set(entries.map((entry) => entry.sourceLocale))];

  return {
    id: `${locale}:${reference.code}-${reference.chapter}-${reference.startVerse}-${reference.endVerse}`,
    reference,
    displayReference,
    locale,
    text,
    normalizedText,
    summary: metadata.summary,
    themes: metadata.themes,
    doctrines: metadata.doctrines,
    humanConcerns: metadata.humanConcerns,
    questionsAnswered: metadata.questionsAnswered,
    entities: metadata.entities,
    keywords: metadata.keywords,
    axes: metadata.axes,
    canonicalWeight: metadata.canonicalWeight,
    crossReferenceDegree,
    crossReferences,
    genre,
    verseCount: entries.length,
    indexVersion: VERSION,
    provenance: {
      method: metadata.seedOverlay ? "seed-overlay+deterministic" : "deterministic",
      genre,
      seedOverlay: metadata.seedOverlay,
      sourceLocale: sourceLocale.length === 1 ? sourceLocale[0] : "mixed",
    },
  };
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildRuntimeUnit(unit) {
  const axisValues = uniqueStrings([
    ...(unit.axes ?? []),
    ...(unit.themes ?? []),
    ...(unit.doctrines ?? []),
    ...(unit.humanConcerns ?? []),
    ...(unit.entities ?? []),
  ]);
  const searchCorpus = uniqueStrings([
    unit.normalizedText,
    unit.summary,
    ...(unit.themes ?? []),
    ...(unit.doctrines ?? []),
    ...(unit.humanConcerns ?? []),
    ...(unit.questionsAnswered ?? []),
    ...(unit.entities ?? []),
    ...(unit.keywords ?? []),
    ...(unit.axes ?? []),
  ]).join(" ");

  return {
    id: unit.id,
    reference: unit.reference,
    displayReference: unit.displayReference,
    locale: unit.locale,
    excerpt: unit.text.length > 320 ? `${unit.text.slice(0, 320)}…` : unit.text,
    summary: unit.summary,
    searchCorpus,
    axisValues,
    canonicalWeight: unit.canonicalWeight,
    crossReferenceDegree: unit.crossReferenceDegree,
    genre: unit.genre,
    verseCount: unit.verseCount,
    indexVersion: unit.indexVersion,
    provenance: unit.provenance,
  };
}

function buildRuntimeIndex(index) {
  return {
    ...index,
    source: {
      ...index.source,
      runtimeProjection: "compact-search-v1",
    },
    units: index.units.map(buildRuntimeUnit),
  };
}

async function buildLocale(locale, crossReferences, seedMaps) {
  const [{ raw: metadata, books }, { chapters }] = await Promise.all([loadMetadata(locale), loadVerseText(locale)]);
  const units = [];
  for (const book of metadata.books) {
    const genre = genreForBook(book.code);
    const rules = segmentationRulesForGenre(genre);
    const availableChapters = [...new Set(
      [...chapters.keys()]
        .filter((chapterKey) => chapterKey.startsWith(`${book.code} `))
        .map((chapterKey) => Number.parseInt(chapterKey.split(" ")[1], 10))
        .filter(Number.isInteger),
    )].sort((left, right) => left - right);

    for (const chapter of availableChapters) {
      const chapterKey = `${book.code} ${chapter}`;
      const chapterVerses = chapters.get(chapterKey) ?? [];
      if (!chapterVerses.length) continue;
      const seedRanges = seedMaps.byChapter.get(`${book.code}:${chapter}`) ?? [];
      const references = buildChapterReferences(book.code, chapter, chapterVerses, seedRanges, rules);
      for (const reference of references) {
        const seed = seedMaps.bySpan.get(`${reference.code}:${reference.chapter}:${reference.startVerse}-${reference.endVerse}`);
        units.push(buildUnit(reference, chapterVerses, locale, books, crossReferences.degrees, crossReferences.neighbors, seed));
      }
    }
  }

  units.sort((left, right) => left.id.localeCompare(right.id));
  const genreCounts = units.reduce((accumulator, unit) => {
    accumulator[unit.genre] = (accumulator[unit.genre] ?? 0) + 1;
    return accumulator;
  }, {});
  const seedUnitCount = units.filter((unit) => unit.provenance.seedOverlay).length;
  const totalVerseCount = units.reduce((sum, unit) => sum + unit.verseCount, 0);

  return {
    version: VERSION,
    generatedAt: GENERATED_AT,
    locale,
    source: {
      translation: metadata.translation,
      corpus: path.relative(ROOT, vplPath(locale)),
      metadata: path.relative(ROOT, metadataPath(locale)),
    },
    units,
    stats: {
      unitCount: units.length,
      seedReferenceCount: SEED_PASSAGES.length,
      seedUnitCount,
      bookCount: metadata.books.length,
      chapterCount: chapters.size,
      totalVerseCount,
      averageUnitVerseCount: Number((totalVerseCount / Math.max(units.length, 1)).toFixed(3)),
      crossReferenceDegreeTotal: units.reduce((sum, unit) => sum + unit.crossReferenceDegree, 0),
      genreCounts,
    },
  };
}

async function main() {
  const crossReferences = await loadCrossReferenceDegrees();
  const seedMaps = makeSeedMap();
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const locale of ["en", "ko"]) {
    const index = await buildLocale(locale, crossReferences, seedMaps);
    const outputPath = path.join(OUTPUT_DIR, `${locale}.json`);
    const runtimePath = path.join(OUTPUT_DIR, `${locale}-runtime.json`);
    await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`);
    await writeFile(runtimePath, `${JSON.stringify(buildRuntimeIndex(index), null, 2)}\n`);
    console.log(`wrote ${path.relative(ROOT, outputPath)} (${index.units.length} units)`);
    console.log(`wrote ${path.relative(ROOT, runtimePath)} (${index.units.length} units, compact runtime)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
