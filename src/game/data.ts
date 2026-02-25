import type { ClueKey, PathObject } from "./types";

export const introLines = [
  "Tamay, yoÄŸun bir iÅŸ gÃ¼nÃ¼nÃ¼n ardÄ±ndan evde bilgisayar baÅŸÄ±nda freelance aldÄ±ÄŸÄ± iÅŸi yetiÅŸtirmeye Ã§alÄ±ÅŸÄ±yordu.",
  "Bir anda monitÃ¶r titredi; ekran karardÄ± ve bozuk semboller ekranda gÃ¶rÃ¼ndÃ¼.",
  "Sonra, ekranda insan gÃ¶zÃ¼ne benzemeyen soÄŸuk bir Ã§ift gÃ¶z belirdi; korkudan nefesi kesildi.",
  "GÃ¶zlerini aÃ§tÄ±ÄŸÄ±nda soÄŸuk kumdaydÄ±; sis iÃ§inde yanÄ±p sÃ¶nen kÄ±rmÄ±zÄ± Ä±ÅŸÄ±k onu sahile Ã§aÄŸÄ±rÄ±yordu.",
];

export const pathObjects: PathObject[] = [
  {
    key: "band",
    pos: 56,
    lane: -1,
    label: "Kirik Bileklik",
    artifactType: "Deney ekipmani kalintisi",
    shortHint: "Kuma yarim gomulu plastik bileklik tuzdan sertlesmis.",
    loreTitle: "Denek Kaydi / B-17",
    loreText:
      "Icindeki kagitta su satiri kalmis: 'Bize catisi acik dediler, ama asansor hep asagi indi.'",
    cluePiece: "3",
    clueHint: "Bilekligin ic halkasina tirnakla kazinmis tek rakam var.",
    icon: "O",
  },
  {
    key: "recorder",
    pos: 124,
    lane: 1,
    label: "Ses Kayit Cihazi",
    artifactType: "Manyetik ses kaydi",
    shortHint: "Islak hoparlorden sadece kesik nefes sesleri geliyor.",
    loreTitle: "Kayit 04 / Son 12 Saniye",
    loreText:
      "Cizirti arasindan bir cumle seciliyor: 'Ayni kapiyi iki kez secme, duvarlar izliyor.'",
    cluePiece: "1",
    clueHint: "Kasetin etiketinde yalniz bir rakam okunuyor.",
    icon: "R",
  },
  {
    key: "note",
    pos: 192,
    lane: -2,
    label: "Islak Not Parcasi",
    artifactType: "El yazisi not",
    shortHint: "Dagilmis kagitlar ruzgarda ayni cizgiye diziliyor.",
    loreTitle: "Parca Defter / Sayfa 9",
    loreText:
      "Murekkep dagilmis ama su satir seciliyor: 'Iceri degil disari kaciyorduk, sonra isik geri cagirdi.'",
    cluePiece: "4",
    clueHint: "Notun kenarina daire icinde bir rakam cizilmis.",
    icon: "N",
  },
  {
    key: "phone",
    pos: 258,
    lane: 2,
    label: "Donmus Cep Saati",
    artifactType: "Kisisel esya",
    shortHint: "Cam catlak, akrep ve yelkovan ayni dakikada kilitli.",
    loreTitle: "Saat Kapagi Icine Not",
    loreText:
      "Kapagin icinde su cizik duruyor: 'Asansor durdugunda zaman degil sadece ses kesildi.'",
    cluePiece: "2",
    clueHint: "Yelkovanin altinda minik bir rakam damgalanmis.",
    icon: "S",
  },
  {
    key: "tag",
    pos: 312,
    lane: 0,
    label: "Pasli Tesis Etiketi",
    artifactType: "Kimlik etiketi",
    shortHint: "Metal etikette kurum ve deniz tuzu birikmis.",
    loreTitle: "Servis Bloku Etiketi",
    loreText:
      "Arka yuzde kazinmis satir: 'Kuleye cikan yol sadece sahte cikislari hatirlayanlara acilir.'",
    cluePiece: "5",
    clueHint: "UV izinin ucunda tek rakam parlak kaliyor.",
    icon: "T",
  },
];

export const objectByKey = Object.fromEntries(pathObjects.map((o) => [o.key, o])) as Record<ClueKey, PathObject>;

export const BEACH_PUZZLE_CODE = [...pathObjects]
  .sort((a, b) => a.pos - b.pos)
  .map((obj) => obj.cluePiece)
  .join("");

export const sidePosts = Array.from({ length: 18 }).map((_, i) => ({
  pos: 24 + i * 18 + (i % 3 === 0 ? 3 : 0),
  lane: (i % 2 === 0 ? -2 : 2) as -2 | 2,
  heightBias: i % 4,
}));
