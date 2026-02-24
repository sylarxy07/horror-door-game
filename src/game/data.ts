import type { ClueKey, PathObject } from "./types";

export const introLines = [
  "Tamay, yoğun bir iş gününün ardından evde bilgisayar başında freelance aldığı işi yetiştirmeye çalışıyordu.",
  "Bir anda monitör titredi; ekran karardı ve bozuk semboller ekranda göründü.",
  "Sonra, ekranda insan gözüne benzemeyen soğuk bir çift göz belirdi; korkudan nefesi kesildi.",
  "Gözlerini açtığında soğuk kumdaydı; sis içinde yanıp sönen kırmızı ışık onu sahile çağırıyordu.",
];

export const pathObjects: PathObject[] = [
  {
    key: "band",
    pos: 58,
    lane: -1,
    label: "Bileklik",
    shortHint: "Kuma gömülü bir denek bilekliği.",
    loreTitle: "Eski Denek Bilekliği",
    loreText:
      "Plastiğin altından silik bir kod beliriyor: D-05. Kenarda çizilmiş tek cümle: 'Beşinci kat kayıt tutuyor.'",
    icon: "◉",
  },
  {
    key: "recorder",
    pos: 124,
    lane: 1,
    label: "Kayıt Cihazı",
    shortHint: "Cızırtılı bir ses kayıt cihazı.",
    loreTitle: "Kırık Ses Kaydı",
    loreText:
      "Ses birkaç saniyeliğine netleşiyor: 'Kapılar aynı görünür ama aynı değildir... korkunu ölçüyorlar.'",
    icon: "◈",
  },
  {
    key: "note",
    pos: 194,
    lane: -2,
    label: "Parçalı Not",
    shortHint: "Rüzgârda dağılmış kağıt parçaları.",
    loreTitle: "Birleştirilmiş Not",
    loreText:
      "Parçalar birleşince tek satır net kalıyor: 'Sis bir perde değil; neyi göreceğini seçen filtredir.'",
    icon: "✦",
  },
  {
    key: "phone",
    pos: 264,
    lane: 2,
    label: "Çatlak Telefon",
    shortHint: "Ekranı kırık bir telefon titreşmeden bekliyor.",
    loreTitle: "Kilidi Açılmış Telefon",
    loreText:
      "Son mesaj taslağı: 'Çatı çıkış değil. Işık çağrı işareti. Sakın aynı kapıyı iki kez güvenli sanma.'",
    icon: "▣",
  },
  {
    key: "tag",
    pos: 308,
    lane: 0,
    label: "Tesis Etiketi",
    shortHint: "Metal etikette kurum ve tuz lekeleri var.",
    loreTitle: "UV Altında Etiket",
    loreText:
      "UV altında yazı beliriyor: 'KORFER BLOKLARI / DENEY KAYDI'. Alt satırda: 'Çatı: yeni giriş eşiği.'",
    icon: "⬡",
  },
];

export const objectByKey = Object.fromEntries(pathObjects.map((o) => [o.key, o])) as Record<ClueKey, PathObject>;

export const sidePosts = Array.from({ length: 18 }).map((_, i) => ({
  pos: 24 + i * 18 + (i % 3 === 0 ? 3 : 0),
  lane: (i % 2 === 0 ? -2 : 2) as -2 | 2,
  heightBias: i % 4,
}));
