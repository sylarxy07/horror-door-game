import React, { useEffect, useMemo, useRef, useState } from "react";

const DOOR_COUNT = 5;
const MAX_LIVES = 5;
const CHECKPOINT_LEVEL = 5;
const MAX_LEVEL = 10;

type Phase = "PLAYING" | "OUT";
type Screen = "MENU" | "SETTINGS" | "CREDITS" | "GAME";
type Lang = "tr" | "en" | "de" | "ru" | "fr";
type Difficulty = "easy" | "normal" | "hard";

const rand = (max: number) => Math.floor(Math.random() * max);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const clamp01 = (n: number) => clamp(n, 0, 1);

// --- heartbeat wav (dosyasız) ---
function makeHeartbeatWavDataUri() {
  const sr = 44100;
  const dur = 0.42;
  const n = Math.floor(sr * dur);
  const data = new Int16Array(n);

  const addThump = (startSec: number, baseHz: number, amp: number, decaySec: number) => {
    const start = Math.floor(startSec * sr);
    const len = Math.floor(decaySec * sr);
    for (let i = 0; i < len; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= n) continue;
      const t = i / sr;
      const env = Math.exp(-t / decaySec);
      const s = Math.sin(2 * Math.PI * baseHz * t) * env;
      const v = s * amp;
      const cur = data[idx] / 32768;
      const mix = clamp(cur + v, -0.98, 0.98);
      data[idx] = Math.floor(mix * 32767);
    }
  };

  const addClick = (startSec: number, amp: number, clickMs: number) => {
    const start = Math.floor(startSec * sr);
    const len = Math.floor((clickMs / 1000) * sr);
    for (let i = 0; i < len; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= n) continue;
      const env = Math.exp(-i / (len * 0.35));
      const noise = (Math.random() * 2 - 1) * env * amp;
      const cur = data[idx] / 32768;
      const mix = clamp(cur + noise, -0.98, 0.98);
      data[idx] = Math.floor(mix * 32767);
    }
  };

  addClick(0.0, 0.16, 18);
  addThump(0.0, 72, 0.55, 0.16);
  addClick(0.18, 0.12, 16);
  addThump(0.18, 90, 0.42, 0.13);

  const bytesPerSample = 2;
  const blockAlign = 1 * bytesPerSample;
  const byteRate = sr * blockAlign;
  const dataSize = n * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < n; i++, off += 2) view.setInt16(off, data[i], true);

  const u8 = new Uint8Array(buffer);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  const b64 = btoa(bin);
  return `data:audio/wav;base64,${b64}`;
}

async function warmUpAudioDevice() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    await ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.00001;

    osc.frequency.value = 200;
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    await new Promise((r) => setTimeout(r, 30));
    osc.stop();

    await new Promise((r) => setTimeout(r, 30));
    await ctx.close();
  } catch {}
}

// ---------- i18n ----------
type Dict = Record<string, string>;
const translations: Record<Lang, Dict> = {
  tr: {
    menuHint: "Ne yapmak istersin?",
    newGame: "Yeni Oyun",
    continue: "Devam Et",
    settings: "Ayarlar",
    back: "Geri",
    credits: "Credits",

    settingsTitle: "Ayarlar",
    langTitle: "DİL",
    audioTitle: "SES",
    difficultyTitle: "ZORLUK",
    difficulty_easy: "Kolay",
    difficulty_normal: "Normal",
    difficulty_hard: "Zor",
    criticalTitle: "KRİTİK KORKU",
    criticalOn: "Açık",
    criticalOff: "Kapalı",

    master: "Genel",
    sfxDoor: "Kapı",
    sfxMonster: "Canavar",
    sfxHeartbeat: "Nabız",
    test: "Test",

    creditsTitle: "Credits",
    developer: "Developer",
    story: "Hikaye Emektarı",

    diedTitle: "Öldün",
    adText:
      "Reklam izlersen +2 hak alıp aynı elde devam edersin. Reklam istemiyorsan checkpoint varsa oradan dönersin.",
    watchAd: "Reklam İzle (+2 Hak)",
    adLoading: "Reklam yükleniyor...",
    startLevel1: "Seviye 1'den Başla",
    continueCheckpoint: "Devam Et (Checkpoint)",

    levelTitle: "Seviye {level}",
    subtitleNeedAudio: "İlk dokunuşta ses açılacak.",
    subtitleFindDoor: "Güvenli kapıyı bul.",
    pulseLabel: "Nabız",
    survived: "Hayatta Kaldın",

    hudLives: "Hak",
    hudCheckpoint: "Checkpoint",
    hudLevel: "Seviye",
    hudWard: "Tılsım",
    menuButton: "Menü",

    continueDisabled: "Kayıt yok",

    listenHint: "Basılı tut: 0.45sn dinle • 1.0sn işaret",
    mark: "İŞARET",
  },
  en: {
    menuHint: "What do you want to do?",
    newGame: "New Game",
    continue: "Continue",
    settings: "Settings",
    back: "Back",
    credits: "Credits",

    settingsTitle: "Settings",
    langTitle: "LANGUAGE",
    audioTitle: "AUDIO",
    difficultyTitle: "DIFFICULTY",
    difficulty_easy: "Easy",
    difficulty_normal: "Normal",
    difficulty_hard: "Hard",
    criticalTitle: "CRITICAL SCARE",
    criticalOn: "On",
    criticalOff: "Off",

    master: "Master",
    sfxDoor: "Door",
    sfxMonster: "Monster",
    sfxHeartbeat: "Heartbeat",
    test: "Test",

    creditsTitle: "Credits",
    developer: "Developer",
    story: "Story",

    diedTitle: "You Died",
    adText: "Watch an ad to get +2 lives and continue. Or return to checkpoint if available.",
    watchAd: "Watch Ad (+2 Lives)",
    adLoading: "Loading ad...",
    startLevel1: "Start from Level 1",
    continueCheckpoint: "Continue (Checkpoint)",

    levelTitle: "Level {level}",
    subtitleNeedAudio: "Sound enables on first touch.",
    subtitleFindDoor: "Find the safe door.",
    pulseLabel: "Pulse",
    survived: "You Survived",

    hudLives: "Lives",
    hudCheckpoint: "Checkpoint",
    hudLevel: "Level",
    hudWard: "Ward",
    menuButton: "Menu",

    continueDisabled: "No save",

    listenHint: "Hold: 0.45s listen • 1.0s mark",
    mark: "MARK",
  },
  de: {
    menuHint: "Was möchtest du tun?",
    newGame: "Neues Spiel",
    continue: "Fortsetzen",
    settings: "Einstellungen",
    back: "Zurück",
    credits: "Credits",

    settingsTitle: "Einstellungen",
    langTitle: "SPRACHE",
    audioTitle: "AUDIO",
    difficultyTitle: "SCHWIERIGKEIT",
    difficulty_easy: "Leicht",
    difficulty_normal: "Normal",
    difficulty_hard: "Schwer",
    criticalTitle: "KRITISCHER SCHRECK",
    criticalOn: "An",
    criticalOff: "Aus",

    master: "Master",
    sfxDoor: "Tür",
    sfxMonster: "Monster",
    sfxHeartbeat: "Puls",
    test: "Test",

    creditsTitle: "Credits",
    developer: "Developer",
    story: "Story",

    diedTitle: "Du bist gestorben",
    adText: "Werbung ansehen: +2 Leben und weitermachen. Oder zum Checkpoint zurück.",
    watchAd: "Werbung ansehen (+2 Leben)",
    adLoading: "Werbung lädt...",
    startLevel1: "Ab Level 1 starten",
    continueCheckpoint: "Weiter (Checkpoint)",

    levelTitle: "Level {level}",
    subtitleNeedAudio: "Sound beim ersten Tip aktiv.",
    subtitleFindDoor: "Finde die sichere Tür.",
    pulseLabel: "Puls",
    survived: "Du hast überlebt",

    hudLives: "Leben",
    hudCheckpoint: "Checkpoint",
    hudLevel: "Level",
    hudWard: "Ward",
    menuButton: "Menü",

    continueDisabled: "Kein Save",

    listenHint: "Halten: hören/markieren",
    mark: "MARK",
  },
  ru: {
    menuHint: "Что хочешь сделать?",
    newGame: "Новая игра",
    continue: "Продолжить",
    settings: "Настройки",
    back: "Назад",
    credits: "Credits",

    settingsTitle: "Настройки",
    langTitle: "ЯЗЫК",
    audioTitle: "ЗВУК",
    difficultyTitle: "СЛОЖНОСТЬ",
    difficulty_easy: "Легко",
    difficulty_normal: "Нормально",
    difficulty_hard: "Сложно",
    criticalTitle: "КРИТИЧЕСКИЙ СКРИМЕР",
    criticalOn: "Вкл",
    criticalOff: "Выкл",

    master: "Общий",
    sfxDoor: "Дверь",
    sfxMonster: "Монстр",
    sfxHeartbeat: "Пульс",
    test: "Тест",

    creditsTitle: "Credits",
    developer: "Developer",
    story: "Сюжет",

    diedTitle: "Ты погиб",
    adText: "Смотри рекламу: +2 жизни и продолжай. Или вернись к чекпоинту.",
    watchAd: "Смотреть рекламу (+2 жизни)",
    adLoading: "Загрузка рекламы...",
    startLevel1: "Начать с уровня 1",
    continueCheckpoint: "Продолжить (Checkpoint)",

    levelTitle: "Уровень {level}",
    subtitleNeedAudio: "Звук включится при первом касании.",
    subtitleFindDoor: "Найди безопасную дверь.",
    pulseLabel: "Пульс",
    survived: "Ты выжил",

    hudLives: "Жизни",
    hudCheckpoint: "Checkpoint",
    hudLevel: "Уровень",
    hudWard: "Ward",
    menuButton: "Меню",

    continueDisabled: "Нет сохранения",

    listenHint: "Удерживай: слушать/пометить",
    mark: "MARK",
  },
  fr: {
    menuHint: "Que veux-tu faire ?",
    newGame: "Nouvelle partie",
    continue: "Continuer",
    settings: "Paramètres",
    back: "Retour",
    credits: "Crédits",

    settingsTitle: "Paramètres",
    langTitle: "LANGUE",
    audioTitle: "SON",
    difficultyTitle: "DIFFICULTÉ",
    difficulty_easy: "Facile",
    difficulty_normal: "Normal",
    difficulty_hard: "Difficile",
    criticalTitle: "FRAYEUR CRITIQUE",
    criticalOn: "On",
    criticalOff: "Off",

    master: "Global",
    sfxDoor: "Porte",
    sfxMonster: "Monstre",
    sfxHeartbeat: "Pouls",
    test: "Test",

    creditsTitle: "Crédits",
    developer: "Developer",
    story: "Histoire",

    diedTitle: "Tu es mort",
    adText: "Regarde une pub : +2 vies et continue. Ou retourne au checkpoint.",
    watchAd: "Regarder la pub (+2 vies)",
    adLoading: "Chargement...",
    startLevel1: "Recommencer au niveau 1",
    continueCheckpoint: "Continuer (Checkpoint)",

    levelTitle: "Niveau {level}",
    subtitleNeedAudio: "Le son s'activera au premier toucher.",
    subtitleFindDoor: "Trouve la porte sûre.",
    pulseLabel: "Pouls",
    survived: "Tu as survécu",

    hudLives: "Vies",
    hudCheckpoint: "Checkpoint",
    hudLevel: "Niveau",
    hudWard: "Ward",
    menuButton: "Menu",

    continueDisabled: "Pas de sauvegarde",

    listenHint: "Maintiens : écouter/marquer",
    mark: "MARK",
  },
};

const langLabel: Record<Lang, string> = { tr: "TR", en: "EN", de: "DE", ru: "RU", fr: "FR" };
function format(str: string, vars: Record<string, string | number>) {
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

// ---------- storage ----------
const LS_SETTINGS = "kapi_settings_v4";
const LS_PROGRESS = "kapi_progress_v4";

type SavedSettings = {
  lang: Lang;
  difficulty: Difficulty;
  criticalScare: boolean;
  vol: { master: number; door: number; monster: number; heartbeat: number };
};

type SavedProgress = {
  hasSave: true;
  level: number;
  lives: number;
  maxReachedLevel: number;
  phase: Phase;
  ward: number;
  streak: number;
};

function safeJsonParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("MENU");

  // settings
  const [lang, setLang] = useState<Lang>("tr");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [criticalScare, setCriticalScare] = useState(true);
  const [vol, setVol] = useState({ master: 0.9, door: 0.35, monster: 0.95, heartbeat: 0.46 });

  const dict = translations[lang];
  const t = (key: string, vars?: Record<string, string | number>) => {
    const base = dict[key] ?? translations.tr[key] ?? key;
    return vars ? format(base, vars) : base;
  };

  // progress/game
  const [audioReady, setAudioReady] = useState(false);
  const audioReadyRef = useRef(false);
  const unlockingRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("PLAYING");
  const [level, setLevel] = useState(1);
  const [maxReachedLevel, setMaxReachedLevel] = useState(1);
  const [lives, setLives] = useState(MAX_LIVES);
  const [hasSave, setHasSave] = useState(false);

  // mechanics
  const [streak, setStreak] = useState(0);
  const [ward, setWard] = useState(0);

  const [marks, setMarks] = useState<boolean[]>(() => Array.from({ length: DOOR_COUNT }).map(() => false));
  const [listenText, setListenText] = useState<string | null>(null);
  const listenTimerRef = useRef<number | null>(null);

  const suppressClickRef = useRef(false);
  const holdListenRef = useRef<number | null>(null);
  const holdMarkRef = useRef<number | null>(null);

  const levelRef = useRef(1);
  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  const [safeDoor, setSafeDoor] = useState(() => rand(DOOR_COUNT));
  const [cursedDoor, setCursedDoor] = useState<number | null>(null);

  const [openedDoor, setOpenedDoor] = useState<number | null>(null);
  const [hoverDoor, setHoverDoor] = useState<number | null>(null);

  const [closingDoor, setClosingDoor] = useState<number | null>(null);
  const closingTimer = useRef<number | null>(null);

  const [scare, setScare] = useState(false);
  const scareTimer = useRef<number | null>(null);

  const [pulse, setPulse] = useState(false);
  const pulseTimer = useRef<number | null>(null);

  const [critical, setCritical] = useState(false);
  const criticalTimer = useRef<number | null>(null);

  const [winFlash, setWinFlash] = useState(false);
  const [winDoor, setWinDoor] = useState<number | null>(null);
  const winTimer = useRef<number | null>(null);

  const [adLoading, setAdLoading] = useState(false);

  // timer
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const roundTotalMsRef = useRef(15000);
  const timerInterval = useRef<number | null>(null);
  const timeoutLockRef = useRef(false);
  const [roundId, setRoundId] = useState(0);

  // NEW ASSETS (GitHub public/images/*)
  const assets = useMemo(
    () => ({
      doorImgs: [
        "/images/doors/door_wood_01.png",
        "/images/doors/door_wood_chain_02.png",
        "/images/doors/door_wood_broken_03.png",
        "/images/doors/door_wood_plate_blank_04.png",
        "/images/doors/door_wood_cursed_05.png",
      ],
      creak: "/door.mp3",
      monster: "/monster.mp3",
    }),
    []
  );

  // audio refs (HTMLAudio)
  const monsterRef = useRef<HTMLAudioElement | null>(null);
  const hbUriRef = useRef<string | null>(null);
  const hbARef = useRef<HTMLAudioElement | null>(null);
  const hbBRef = useRef<HTMLAudioElement | null>(null);
  const hbToggleRef = useRef(false);

  // tiny ambient via AudioContext (for listening)
  const ambientCtxRef = useRef<AudioContext | null>(null);
  const ambientMasterRef = useRef<GainNode | null>(null);

  // heartbeat scheduler
  const beatMsRef = useRef(1200);
  const hbTimerRef = useRef<number | null>(null);
  const hbRunningRef = useRef(false);

  const phaseRef = useRef<Phase>("PLAYING");
  const scareRef = useRef(false);
  const timeLeftMsRef = useRef(0);
  const screenRef = useRef<Screen>("MENU");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    scareRef.current = scare;
  }, [scare]);
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);
  useEffect(() => {
    timeLeftMsRef.current = timeLeftMs;

    const total = roundTotalMsRef.current || 1;
    const ratio = clamp(timeLeftMs / total, 0, 1);
    const base = difficulty === "easy" ? 1300 : difficulty === "hard" ? 1050 : 1200;
    beatMsRef.current = ratio > 0.66 ? base : ratio > 0.33 ? base * 0.75 : base * 0.54;
  }, [timeLeftMs, difficulty]);

  // load settings + progress
  useEffect(() => {
    const s = safeJsonParse<SavedSettings>(localStorage.getItem(LS_SETTINGS));
    if (s) {
      if (s.lang) setLang(s.lang);
      if (s.difficulty) setDifficulty(s.difficulty);
      if (typeof s.criticalScare === "boolean") setCriticalScare(s.criticalScare);
      if (s.vol) {
        setVol({
          master: clamp01(s.vol.master ?? 0.9),
          door: clamp01(s.vol.door ?? 0.35),
          monster: clamp01(s.vol.monster ?? 0.95),
          heartbeat: clamp01(s.vol.heartbeat ?? 0.46),
        });
      }
    }

    const p = safeJsonParse<SavedProgress>(localStorage.getItem(LS_PROGRESS));
    if (p?.hasSave) {
      setHasSave(true);
      setLevel(clamp(p.level ?? 1, 1, MAX_LEVEL));
      setLives(clamp(p.lives ?? MAX_LIVES, 0, MAX_LIVES));
      setMaxReachedLevel(clamp(p.maxReachedLevel ?? 1, 1, MAX_LEVEL));
      setPhase((p.phase ?? "PLAYING") as Phase);
      setWard(clamp(p.ward ?? 0, 0, 1));
      setStreak(clamp(p.streak ?? 0, 0, 999));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // save settings
  useEffect(() => {
    const payload: SavedSettings = {
      lang,
      difficulty,
      criticalScare,
      vol: {
        master: clamp01(vol.master),
        door: clamp01(vol.door),
        monster: clamp01(vol.monster),
        heartbeat: clamp01(vol.heartbeat),
      },
    };
    try {
      localStorage.setItem(LS_SETTINGS, JSON.stringify(payload));
    } catch {}
  }, [lang, difficulty, criticalScare, vol.master, vol.door, vol.monster, vol.heartbeat]);

  // save progress
  useEffect(() => {
    if (!hasSave) return;
    const payload: SavedProgress = {
      hasSave: true,
      level,
      lives,
      maxReachedLevel,
      phase,
      ward,
      streak,
    };
    try {
      localStorage.setItem(LS_PROGRESS, JSON.stringify(payload));
    } catch {}
  }, [hasSave, level, lives, maxReachedLevel, phase, ward, streak]);

  const ensureSaveEnabled = () => {
    if (!hasSave) setHasSave(true);
  };

  const clearSave = () => {
    setHasSave(false);
    try {
      localStorage.removeItem(LS_PROGRESS);
    } catch {}
  };

  // ---------- AUDIO ----------
  const effectiveMaster = clamp01(vol.master);

  const safePlay = async (el: HTMLAudioElement | null, volume01: number) => {
    if (!audioReadyRef.current || !el) return;
    const v = clamp01(volume01) * effectiveMaster;
    if (v <= 0.0001) return;
    try {
      el.pause();
      el.currentTime = 0;
      el.volume = v;
      await el.play();
    } catch {}
  };

  const playCreak = async (mult = 1) => {
    if (!audioReadyRef.current) return;
    const v = clamp01(vol.door * mult) * effectiveMaster;
    if (v <= 0.0001) return;
    try {
      const a = new Audio(assets.creak);
      a.volume = v;
      a.currentTime = 0;
      await a.play();
    } catch {}
  };

  const playMonster = (boost = 1) => void safePlay(monsterRef.current, clamp01(vol.monster * boost));

  const playHeartbeat = () => {
    if (!audioReadyRef.current) return;
    const pick = hbToggleRef.current ? hbBRef.current : hbARef.current;
    hbToggleRef.current = !hbToggleRef.current;
    if (!pick) return;
    void safePlay(pick, vol.heartbeat);
  };

  const startHeartbeatLoop = (initialDelayMs?: number) => {
    if (hbRunningRef.current) return;
    hbRunningRef.current = true;

    const tick = () => {
      if (!hbRunningRef.current) return;

      const ok =
        audioReadyRef.current &&
        phaseRef.current === "PLAYING" &&
        !scareRef.current &&
        timeLeftMsRef.current > 0 &&
        screenRef.current === "GAME";

      if (ok) playHeartbeat();
      hbTimerRef.current = window.setTimeout(tick, beatMsRef.current);
    };

    const firstDelay = initialDelayMs ?? beatMsRef.current;
    hbTimerRef.current = window.setTimeout(tick, firstDelay);
  };

  const stopHeartbeatLoop = () => {
    hbRunningRef.current = false;
    if (hbTimerRef.current) {
      window.clearTimeout(hbTimerRef.current);
      hbTimerRef.current = null;
    }
  };

  const ensureAmbientCtx = async () => {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Ctx) return;
    if (!ambientCtxRef.current) {
      ambientCtxRef.current = new Ctx();
      ambientMasterRef.current = ambientCtxRef.current.createGain();
      ambientMasterRef.current.gain.value = 0.22;
      ambientMasterRef.current.connect(ambientCtxRef.current.destination);
    }
    try {
      await ambientCtxRef.current.resume();
    } catch {}
  };

  const playListenAmbient = async (ms = 520) => {
    if (!audioReadyRef.current) return;
    await ensureAmbientCtx();
    const ctx = ambientCtxRef.current;
    const master = ambientMasterRef.current;
    if (!ctx || !master) return;

    const dur = clamp(ms, 120, 1400) / 1000;

    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.92 + white * 0.08;
      data[i] = last * 0.6;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 140;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200;

    const gain = ctx.createGain();
    const baseVol = clamp01(vol.door * 0.55) * effectiveMaster;
    gain.gain.value = Math.max(0.0001, baseVol * 0.28);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gain.gain.value, now + 0.06);
    gain.gain.linearRampToValueAtTime(0.0001, now + dur);

    src.connect(hp);
    hp.connect(lp);
    lp.connect(gain);
    gain.connect(master);

    try {
      src.start();
      src.stop(now + dur + 0.02);
    } catch {}
  };

  const unlockAudio = async () => {
    if (audioReadyRef.current) return;
    if (unlockingRef.current) return;

    unlockingRef.current = true;
    try {
      audioReadyRef.current = true;
      setAudioReady(true);

      if (!monsterRef.current) monsterRef.current = new Audio(assets.monster);
      if (!hbUriRef.current) hbUriRef.current = makeHeartbeatWavDataUri();
      if (!hbARef.current) hbARef.current = new Audio(hbUriRef.current);
      if (!hbBRef.current) hbBRef.current = new Audio(hbUriRef.current);

      await warmUpAudioDevice();
      await ensureAmbientCtx();

      try {
        const h = hbARef.current!;
        const old = h.volume;
        h.volume = 0.0001;
        await h.play();
        h.pause();
        h.currentTime = 0;
        h.volume = old;
      } catch {}

      startHeartbeatLoop(900);
    } finally {
      unlockingRef.current = false;
    }
  };

  const ensureAudioNoPopupSync = () => {
    if (audioReadyRef.current) return;
    void unlockAudio();
  };

  // ---------- FX ----------
  const triggerPulse = (ms = 220) => {
    setPulse(true);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setPulse(false), ms);
  };

  const triggerScare = (ms = 420) => {
    setScare(true);
    if (scareTimer.current) window.clearTimeout(scareTimer.current);
    scareTimer.current = window.setTimeout(() => setScare(false), ms);
  };

  const triggerCritical = () => {
    setCritical(true);
    if (criticalTimer.current) window.clearTimeout(criticalTimer.current);
    criticalTimer.current = window.setTimeout(() => setCritical(false), 520);
  };

  const triggerWin = (doorIndex: number) => {
    setWinDoor(doorIndex);
    setWinFlash(true);
    if (winTimer.current) window.clearTimeout(winTimer.current);
    winTimer.current = window.setTimeout(() => {
      setWinFlash(false);
      setWinDoor(null);
    }, 700);
  };

  const startClosingSlow = (doorIndex: number | null) => {
    if (doorIndex === null) return;
    setClosingDoor(doorIndex);
    if (closingTimer.current) window.clearTimeout(closingTimer.current);
    closingTimer.current = window.setTimeout(() => setClosingDoor(null), 980);
  };

  // ---------- timer/difficulty ----------
  const calcRoundMs = (lvl: number) => {
    const baseSec = clamp(17 - Math.floor(lvl * 0.6), 11, 17);
    const mult = difficulty === "easy" ? 1.12 : difficulty === "hard" ? 0.86 : 1.0;
    const sec = clamp(Math.round(baseSec * mult), 9, 20);
    return sec * 1000;
  };

  const clearTimer = () => {
    if (timerInterval.current) {
      window.clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
  };

  const rollCursedDoor = (safe: number) => {
    let d = rand(DOOR_COUNT);
    if (d === safe) d = (d + 1) % DOOR_COUNT;
    return d;
  };

  const resetRoundVisuals = () => {
    setMarks(Array.from({ length: DOOR_COUNT }).map(() => false));
  };

  const startNewRoundTimer = (lvl: number, nextSafeDoor?: number) => {
    const total = calcRoundMs(lvl);
    roundTotalMsRef.current = total;
    timeoutLockRef.current = false;
    setTimeLeftMs(total);
    setRoundId((r) => r + 1);

    const safe = typeof nextSafeDoor === "number" ? nextSafeDoor : safeDoor;
    setCursedDoor(rollCursedDoor(safe));

    resetRoundVisuals();
  };

  const getStartLevelFromCheckpoint = () => (maxReachedLevel >= CHECKPOINT_LEVEL ? CHECKPOINT_LEVEL : 1);

  const restartFromCheckpoint = () => {
    ensureAudioNoPopupSync();
    ensureSaveEnabled();

    const startLevel = getStartLevelFromCheckpoint();

    setPhase("PLAYING");
    setLives(MAX_LIVES);

    setLevel(startLevel);
    setMaxReachedLevel((prev) => Math.max(prev, startLevel));

    setStreak(0);
    setWard(0);

    startClosingSlow(openedDoor);
    setOpenedDoor(null);

    const ns = rand(DOOR_COUNT);
    setSafeDoor(ns);
    startNewRoundTimer(startLevel, ns);

    setScreen("GAME");
  };

  const restartFromLevel1 = () => {
    ensureAudioNoPopupSync();
    ensureSaveEnabled();

    setPhase("PLAYING");
    setLives(MAX_LIVES);

    setLevel(1);
    setMaxReachedLevel(1);

    setStreak(0);
    setWard(0);

    startClosingSlow(openedDoor);
    setOpenedDoor(null);

    const ns = rand(DOOR_COUNT);
    setSafeDoor(ns);
    startNewRoundTimer(1, ns);

    setScreen("GAME");
  };

  // init
  useEffect(() => {
    const ns = rand(DOOR_COUNT);
    setSafeDoor(ns);
    startNewRoundTimer(1, ns);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!audioReady) return;
    if (phase === "PLAYING" && screen === "GAME") startHeartbeatLoop();
    else stopHeartbeatLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioReady, phase, screen]);

  // ---------- mechanics ----------
  const applyDamage = (damage: number, isCritical: boolean) => {
    if (ward > 0) {
      setWard(0);
      setStreak(0);
      triggerPulse(isCritical ? 320 : 220);

      window.setTimeout(() => {
        startClosingSlow(openedDoor);
        setOpenedDoor(null);

        const ns = rand(DOOR_COUNT);
        setSafeDoor(ns);
        startNewRoundTimer(levelRef.current, ns);
      }, 680);

      return;
    }

    const extraLose = isCritical && Math.random() < 0.22 ? 1 : 0;
    const totalLose = damage + extraLose;

    setLives((prev) => {
      const next = Math.max(0, prev - totalLose);
      if (next <= 0) {
        window.setTimeout(() => setPhase("OUT"), 260);
      } else {
        window.setTimeout(() => {
          startClosingSlow(openedDoor);
          setOpenedDoor(null);

          const ns = rand(DOOR_COUNT);
          setSafeDoor(ns);
          startNewRoundTimer(levelRef.current, ns);

          ensureSaveEnabled();
        }, isCritical ? 1080 : 900);
      }
      return next;
    });
  };

  // ---------- listen/mark helpers ----------
  const clearHoldTimers = () => {
    if (holdListenRef.current) window.clearTimeout(holdListenRef.current);
    if (holdMarkRef.current) window.clearTimeout(holdMarkRef.current);
    holdListenRef.current = null;
    holdMarkRef.current = null;
  };

  const showListenText = (msg: string) => {
    setListenText(msg);
    if (listenTimerRef.current) window.clearTimeout(listenTimerRef.current);
    listenTimerRef.current = window.setTimeout(() => setListenText(null), 1000);
  };

  const computeListenHint = (doorIndex: number) => {
    const isSafe = doorIndex === safeDoor;
    const isCursed = cursedDoor === doorIndex;

    const truthy = Math.random() < (isSafe ? 0.55 : 0.45);

    const goodTR = ["İçerisi… fazla sessiz.", "Nefes sesi yok.", "Boşluk hissi."];
    const badTR = ["Tırnak… sürtünmesi.", "Islak bir hırıltı.", "Ahşap… inliyor."];
    const cursedTR = ["Bir şey… seni çağırıyor.", "Soğuk bir fısıltı.", "Yakın… çok yakın."];

    const goodEN = ["Too quiet…", "No breathing.", "A hollow stillness."];
    const badEN = ["Scratching…", "A wet growl.", "Wood… groaning."];
    const cursedEN = ["Something… calls you.", "A cold whisper.", "Close… too close."];

    const pick = (arr: string[]) => arr[rand(arr.length)];

    const good = lang === "tr" ? goodTR : goodEN;
    const bad = lang === "tr" ? badTR : badEN;
    const cursed = lang === "tr" ? cursedTR : cursedEN;

    const poolBad = isCursed ? cursed : bad;

    if (truthy) {
      if (isSafe) return pick(good);
      return pick(poolBad);
    } else {
      if (isSafe) return pick(poolBad);
      return pick(good);
    }
  };

  const doListen = (doorIndex: number) => {
    if (phase !== "PLAYING" || screen !== "GAME") return;
    if (openedDoor !== null) return;

    ensureAudioNoPopupSync();
    window.setTimeout(() => void playCreak(0.45), 0);
    window.setTimeout(() => void playListenAmbient(520), 0);

    showListenText(computeListenHint(doorIndex));
  };

  const toggleMark = (doorIndex: number) => {
    if (phase !== "PLAYING" || screen !== "GAME") return;
    if (openedDoor !== null) return;

    setMarks((prev) => {
      const next = [...prev];
      next[doorIndex] = !next[doorIndex];
      return next;
    });

    suppressClickRef.current = true;
    triggerPulse(140);
  };

  // ---------- door handlers ----------
  const onDoorEnter = (i: number) => {
    if (phase !== "PLAYING" || screen !== "GAME") return;
    setHoverDoor(i);

    ensureAudioNoPopupSync();
    window.setTimeout(() => void playCreak(1), 0);
  };

  const onDoorLeave = (i: number) => {
    if (hoverDoor === i) setHoverDoor(null);
  };

  const onDoorPointerDown = (i: number, e: React.PointerEvent) => {
    e.stopPropagation();

    if (phase !== "PLAYING" || screen !== "GAME") return;
    if (openedDoor !== null) return;

    ensureAudioNoPopupSync();

    suppressClickRef.current = false;
    clearHoldTimers();

    holdListenRef.current = window.setTimeout(() => {
      suppressClickRef.current = true;
      doListen(i);
    }, 450);

    holdMarkRef.current = window.setTimeout(() => {
      toggleMark(i);
    }, 1000);
  };

  const onDoorPointerUp = (_i: number, e: React.PointerEvent) => {
    e.stopPropagation();
    clearHoldTimers();
  };

  const onPickDoor = (i: number) => {
    if (phase !== "PLAYING" || screen !== "GAME") return;
    if (openedDoor !== null) return;

    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    ensureAudioNoPopupSync();
    setOpenedDoor(i);

    window.setTimeout(() => {
      const isSafe = i === safeDoor;
      const isCursed = cursedDoor === i;

      if (isSafe) {
        triggerWin(i);

        setStreak((prev) => {
          const next = prev + 1;
          if (next >= 3) {
            setWard(1);
            return 0;
          }
          return next;
        });

        window.setTimeout(() => {
          const cur = levelRef.current;
          if (cur >= MAX_LEVEL) {
            restartFromCheckpoint();
            return;
          }

          const nl = Math.min(cur + 1, MAX_LEVEL);
          setLevel(nl);
          setMaxReachedLevel((prev) => Math.max(prev, nl));

          startClosingSlow(i);
          setOpenedDoor(null);

          const ns = rand(DOOR_COUNT);
          setSafeDoor(ns);
          startNewRoundTimer(nl, ns);

          ensureSaveEnabled();
        }, 820);

        return;
      }

      setStreak(0);

      const canCritical = difficulty === "hard" && criticalScare;
      const critChance = canCritical ? 0.28 : 0;
      const isCritical = Math.random() < critChance;

      const damage = isCursed ? 2 : 1;

      // Monster görseli yok, ama ses/efekt var
      if (isCritical) {
        playMonster(1.08);
        triggerPulse(340);
        triggerScare(620);
        triggerCritical();
      } else {
        playMonster(1.0);
        triggerPulse(220);
        triggerScare(420);
      }

      applyDamage(damage, isCritical);
    }, 220);
  };

  // ---------- timer tick ----------
  useEffect(() => {
    const clearTimer = () => {
      if (timerInterval.current) {
        window.clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    };

    clearTimer();

    const shouldRun = phase === "PLAYING" && screen === "GAME" && !scare;
    if (!shouldRun) return;

    const step = 100;
    timerInterval.current = window.setInterval(() => {
      setTimeLeftMs((prev) => {
        if (prev <= 0) return 0;

        const next = prev - step;
        if (next <= 0) {
          if (timeoutLockRef.current) return 0;
          timeoutLockRef.current = true;

          clearTimer();
          triggerPulse(240);

          if (ward > 0) {
            setWard(0);
            window.setTimeout(() => {
              startClosingSlow(openedDoor);
              setOpenedDoor(null);

              const ns = rand(DOOR_COUNT);
              setSafeDoor(ns);
              startNewRoundTimer(levelRef.current, ns);
            }, 650);
            return 0;
          }

          setLives((lprev) => {
            const lnext = Math.max(0, lprev - 1);
            if (lnext <= 0) {
              window.setTimeout(() => setPhase("OUT"), 260);
            } else {
              window.setTimeout(() => {
                startClosingSlow(openedDoor);
                setOpenedDoor(null);

                const ns = rand(DOOR_COUNT);
                setSafeDoor(ns);
                startNewRoundTimer(levelRef.current, ns);

                ensureSaveEnabled();
              }, 700);
            }
            return lnext;
          });

          return 0;
        }

        return next;
      });
    }, step);

    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, screen, scare, roundId, difficulty, ward]);

  // cleanup
  useEffect(() => {
    return () => {
      if (listenTimerRef.current) window.clearTimeout(listenTimerRef.current);
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
      if (scareTimer.current) window.clearTimeout(scareTimer.current);
      if (winTimer.current) window.clearTimeout(winTimer.current);
      if (closingTimer.current) window.clearTimeout(closingTimer.current);
      if (criticalTimer.current) window.clearTimeout(criticalTimer.current);

      try {
        monsterRef.current?.pause();
        hbARef.current?.pause();
        hbBRef.current?.pause();
      } catch {}

      try {
        ambientCtxRef.current?.close();
      } catch {}
    };
  }, []);

  // ---------- UI helpers ----------
  const total = roundTotalMsRef.current || 1;
  const ratio = clamp(timeLeftMs / total, 0, 1);
  const beatMs = beatMsRef.current;

  const goNewGame = () => {
    ensureAudioNoPopupSync();
    clearSave();
    restartFromLevel1();
  };

  const goContinue = () => {
    ensureAudioNoPopupSync();
    if (!hasSave) return;
    const ns = rand(DOOR_COUNT);
    setSafeDoor(ns);
    startNewRoundTimer(levelRef.current, ns);
    setOpenedDoor(null);
    setHoverDoor(null);
    setScreen("GAME");
  };

  const onWatchAdGainLives = async () => {
    if (adLoading) return;
    ensureAudioNoPopupSync();

    setAdLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setAdLoading(false);

    setPhase("PLAYING");
    setLives(2);

    startClosingSlow(openedDoor);
    setOpenedDoor(null);

    const ns = rand(DOOR_COUNT);
    setSafeDoor(ns);
    startNewRoundTimer(levelRef.current, ns);

    setScreen("GAME");
    ensureSaveEnabled();
  };

  const langList = ["tr", "en", "de", "ru", "fr"] as Lang[];
  const diffList = ["easy", "normal", "hard"] as Difficulty[];

  const doorSrcForIndex = (i: number) => assets.doorImgs[i % assets.doorImgs.length];

  // ---------- render ----------
  return (
    <div
      className={`app ${pulse ? "pulse" : ""} ${scare ? "scare" : ""} ${winFlash ? "win" : ""} ${
        critical ? "critical" : ""
      }`}
      onPointerDown={() => ensureAudioNoPopupSync()}
      style={
        {
          ["--beat" as any]: `${beatMs}ms`,
          ["--t" as any]: `${ratio}`,
        } as React.CSSProperties
      }
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Creepster&family=Rubik+Wet+Paint&family=UnifrakturCook:wght@700&display=swap');
        :root{ --bg:#07070c; --text:#f0f0f5; --gold:#b08d24; --goldGlow: rgba(176,141,36,.45); }
        *{box-sizing:border-box}
        body{margin:0;background:var(--bg);color:var(--text);font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial}
        .app{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:22px;position:relative;overflow:hidden;}
        .wrap{width:min(980px, 100%); position:relative; z-index:2;}

        .centerCard{width:min(680px, 100%);border-radius:22px;border:1px solid rgba(255,255,255,.10);background:rgba(10,10,16,.92);
          box-shadow:0 30px 140px rgba(0,0,0,.70);padding:22px;backdrop-filter: blur(12px);}
        .brand{display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 0 2px;}
        .brandTitle{font-family:"Rubik Wet Paint",system-ui;font-size:min(56px, 10vw);letter-spacing:2px;color:var(--gold);
          text-shadow:0 0 18px rgba(176,141,36,.35), 0 18px 90px rgba(0,0,0,.9);margin:0;line-height:0.95;text-align:center;}
        .brandSub{font-family:"UnifrakturCook",system-ui;opacity:.85;letter-spacing:1px;margin:0;text-align:center;}
        .menuBtns{display:flex; flex-direction:column; gap:10px; margin-top:14px;}
        .btn{width:100%;border:none;border-radius:14px;padding:13px 14px;font-weight:900;cursor:pointer;background:rgba(176,141,36,.92);color:#0b0b10;}
        .btnGhost{width:100%;border-radius:14px;padding:13px 14px;font-weight:900;cursor:pointer;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.92);}
        .btnDisabled{opacity:.45;cursor:not-allowed;}

        .hud{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;}
        .title{margin:0;font-family:"Rubik Wet Paint",system-ui;font-size:34px;letter-spacing:.5px;line-height:1;opacity:.95;text-shadow:0 10px 40px rgba(0,0,0,.45);}
        .sub{margin:6px 0 0;color:rgba(255,255,255,.82);font-size:13px;font-family:"UnifrakturCook",system-ui;letter-spacing:.6px;opacity:.92;}
        .hudRight{display:flex;gap:10px;align-items:center;font-size:13px;flex-wrap:wrap;justify-content:flex-end;}
        .pill{padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(6px);
          color:rgba(255,255,255,.9);font-family:"Creepster",system-ui;letter-spacing:.8px;}
        .pill b{font-family:ui-sans-serif,system-ui;letter-spacing:0;}

        .logoBtn{border:none;background:transparent;padding:0;cursor:pointer;text-align:left;}
        .logoSmall{display:flex;flex-direction:column;}
        .logoSmall .logoMark{font-family:"Rubik Wet Paint",system-ui;font-size:18px;letter-spacing:1px;color:var(--gold);
          text-shadow:0 0 14px rgba(176,141,36,.35), 0 18px 60px rgba(0,0,0,.7);}
        .logoSmall .logoSub{margin-top:2px;font-family:"UnifrakturCook",system-ui;font-size:12px;letter-spacing:.7px;opacity:.8;}

        .pulseWrap{margin:6px 0 14px;display:flex;gap:10px;align-items:center;}
        .pulseLabel{font-family:"Creepster",system-ui;letter-spacing:.9px;color:rgba(255,255,255,.78);font-size:14px;opacity:.95;transform:translateY(1px);user-select:none;}
        .ecgBar{flex:1;height:18px;border-radius:999px;background:linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.04));
          border:1px solid rgba(255,255,255,.12);overflow:hidden;position:relative;box-shadow:0 10px 40px rgba(0,0,0,.35);}
        .ecgDim{position:absolute;top:0;right:0;bottom:0;width:calc((1 - var(--t)) * 100%);background:rgba(0,0,0,.52);pointer-events:none;}
        .ecgViewport{position:absolute;inset:0;overflow:hidden;}
        .ecgMove{position:absolute;inset:0;width:200%;display:flex;animation:scroll var(--beat) linear infinite;opacity:1;filter:drop-shadow(0 0 10px var(--goldGlow));}
        .ecgSvg{width:50%;height:100%;}
        @keyframes scroll{0%{transform:translateX(0%)}100%{transform:translateX(-50%)}}

        .corridor{position:relative; width:100%; padding:10px 0 0; user-select:none; touch-action:pan-y;}
        .track{display:grid; grid-template-columns:repeat(5, 1fr); gap:14px;}
        @media (max-width: 860px){ .track{grid-template-columns: repeat(3, 1fr)} }
        @media (max-width: 520px){ .track{grid-template-columns: repeat(2, 1fr)} }

        .doorBtn{border:none;background:transparent;padding:0;cursor:pointer;}
        .doorBtn:disabled{cursor:not-allowed;opacity:.65;}

        .doorStage{
          position:relative;width:100%;height:220px;border-radius:16px;overflow:hidden;
          box-shadow:0 18px 70px rgba(0,0,0,.45);
          background:rgba(0,0,0,.25);
          border:1px solid rgba(255,255,255,.10);
        }
        .doorImg{
          width:100%;height:100%;object-fit:cover;display:block;
          filter:contrast(1.05) brightness(.92);
          transform:scale(1.02);
          transition:transform 200ms ease, filter 200ms ease;
        }
        .doorStage.hover .doorImg{transform:scale(1.06);filter:contrast(1.08) brightness(.98);}
        .doorStage.open .doorImg{transform:scale(1.03);filter:contrast(1.12) brightness(.86);}

        .markBadge{
          position:absolute; right:10px; top:10px; z-index:7;
          padding:6px 8px; border-radius:999px;
          background:rgba(176,141,36,.18);
          border:1px solid rgba(176,141,36,.45);
          font-weight:900; font-size:11px; letter-spacing:.6px;
        }

        .pulse::after{content:"";position:fixed;inset:-20px;background:rgba(0,0,0,.65);animation:pulsefx .22s ease-out forwards;z-index:70;pointer-events:none;}
        @keyframes pulsefx{0%{opacity:0;transform:scale(1.02)}60%{opacity:1;transform:scale(1.0)}100%{opacity:0;transform:scale(1.0)}}

        .overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(0,0,0,.72);z-index:80;}
        .modal{width:min(520px, 100%);background:rgba(10,10,16,.92);border:1px solid rgba(255,255,255,.10);border-radius:22px;padding:18px;
          box-shadow:0 30px 140px rgba(0,0,0,.70);backdrop-filter:blur(12px);}
        .modalTitle{margin:0;font-family:"Creepster",system-ui;font-size:26px;letter-spacing:1px;}
        .modalInfo{margin:10px 0 14px;color:rgba(255,255,255,.82);font-size:14px;line-height:1.45;}
        .btnRow{display:flex;flex-direction:column;gap:10px;}
      `}</style>

      {screen === "MENU" && (
        <div className="centerCard">
          <div className="brand">
            <h1 className="brandTitle">KAPI</h1>
            <p className="brandSub">{t("menuHint")}</p>
          </div>

          <div className="menuBtns">
            <button className="btn" onClick={goNewGame}>
              {t("newGame")}
            </button>

            <button
              className={`btnGhost ${!hasSave ? "btnDisabled" : ""}`}
              onClick={goContinue}
              disabled={!hasSave}
              title={!hasSave ? t("continueDisabled") : ""}
            >
              {t("continue")}
            </button>

            <button className="btnGhost" onClick={() => setScreen("SETTINGS")}>
              {t("settings")}
            </button>
          </div>
        </div>
      )}

      {screen === "SETTINGS" && (
        <div className="centerCard">
          <div style={{ fontFamily: "Creepster, system-ui", letterSpacing: 1, textAlign: "center", marginTop: 6 }}>
            {t("settingsTitle")}
          </div>

          <div style={{ marginTop: 12, padding: 12, borderRadius: 16, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.10)" }}>
            <div style={{ fontFamily: "Creepster, system-ui", letterSpacing: 1, textAlign: "center", marginBottom: 10 }}>
              {t("langTitle")}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              {langList.map((l) => (
                <button
                  key={l}
                  style={{
                    minWidth: 72,
                    borderRadius: 14,
                    padding: "10px 14px",
                    border: "1px solid rgba(255,255,255,.16)",
                    background: lang === l ? "rgba(176,141,36,.92)" : "rgba(0,0,0,.28)",
                    color: lang === l ? "#0b0b10" : "rgba(255,255,255,.92)",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                  onClick={() => setLang(l)}
                  type="button"
                >
                  {langLabel[l]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="btnGhost" onClick={() => setScreen("MENU")}>
              {t("back")}
            </button>
          </div>
        </div>
      )}

      {screen === "GAME" && (
        <div className="wrap">
          <div className="hud">
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <button className="logoBtn" onClick={() => setScreen("MENU")} title="Menü">
                <div className="logoSmall">
                  <div className="logoMark">KAPI</div>
                  <div className="logoSub">{t("menuButton")}</div>
                </div>
              </button>

              <div>
                <h1 className="title">{t("levelTitle", { level })}</h1>
                <p className="sub">{!audioReady ? t("subtitleNeedAudio") : t("subtitleFindDoor")}</p>
                <p className="sub" style={{ marginTop: 6, opacity: 0.82 }}>
                  {t("listenHint")}
                </p>
              </div>
            </div>

            <div className="hudRight">
              <span className="pill">
                {t("hudLives")}: <b>{lives}/{MAX_LIVES}</b>
              </span>
              <span className="pill">
                {t("hudWard")}: <b>{ward}</b>
              </span>
              <span className="pill">
                {t("hudCheckpoint")}: <b>{CHECKPOINT_LEVEL}</b>
              </span>
              <span className="pill">
                {t("hudLevel")}: <b>{level}</b>
              </span>
            </div>
          </div>

          {phase === "PLAYING" && audioReady && (
            <div className="pulseWrap" aria-label="timer">
              <div className="pulseLabel">{t("pulseLabel")}</div>
              <div className="ecgBar">
                <div className="ecgViewport">
                  <div className="ecgMove">
                    <svg className="ecgSvg" viewBox="0 0 200 40" preserveAspectRatio="none">
                      <path
                        d="M0 22 L18 22 L24 22 L30 8 L36 36 L42 22 L70 22 L78 22 L86 12 L92 30 L98 22 L126 22 L140 22 L148 6 L156 36 L164 22 L200 22"
                        fill="none"
                        stroke="var(--gold)"
                        strokeWidth="3.2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </svg>
                    <svg className="ecgSvg" viewBox="0 0 200 40" preserveAspectRatio="none">
                      <path
                        d="M0 22 L18 22 L24 22 L30 8 L36 36 L42 22 L70 22 L78 22 L86 12 L92 30 L98 22 L126 22 L140 22 L148 6 L156 36 L164 22 L200 22"
                        fill="none"
                        stroke="var(--gold)"
                        strokeWidth="3.2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ecgDim" />
              </div>
            </div>
          )}

          <div className="corridor">
            <div className="track">
              {Array.from({ length: DOOR_COUNT }).map((_, i) => {
                const disabled = phase !== "PLAYING";
                const isHover = hoverDoor === i && openedDoor === null;
                const isOpen = openedDoor === i;
                const markOn = marks[i];

                return (
                  <button
                    key={i}
                    className="doorBtn"
                    disabled={disabled}
                    onMouseEnter={() => onDoorEnter(i)}
                    onMouseLeave={() => onDoorLeave(i)}
                    onPointerDown={(e) => onDoorPointerDown(i, e)}
                    onPointerUp={(e) => onDoorPointerUp(i, e)}
                    onPointerCancel={(e) => onDoorPointerUp(i, e)}
                    onClick={() => onPickDoor(i)}
                    title="Kapıyı seç"
                  >
                    <div className={`doorStage ${isHover ? "hover" : ""} ${isOpen ? "open" : ""}`}>
                      {markOn && <div className="markBadge">{t("mark")}</div>}
                      <img className="doorImg" src={doorSrcForIndex(i)} alt={`Door ${i + 1}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {listenText && <div style={{
        position:"fixed", left:"50%", bottom:22, transform:"translateX(-50%)",
        zIndex:95, pointerEvents:"none", padding:"10px 12px", borderRadius:14,
        background:"rgba(0,0,0,.55)", border:"1px solid rgba(255,255,255,.14)",
        backdropFilter:"blur(8px)", fontFamily:"UnifrakturCook, system-ui",
        letterSpacing:".8px", color:"rgba(255,255,255,.92)",
        boxShadow:"0 18px 70px rgba(0,0,0,.55)",
        maxWidth:"min(720px, 92vw)", textAlign:"center"
      }}>{listenText}</div>}

      {phase === "OUT" && screen === "GAME" && (
        <div className="overlay">
          <div className="modal">
            <h2 className="modalTitle">{t("diedTitle")}</h2>
            <p className="modalInfo">{t("adText")}</p>
            <div className="btnRow">
              <button className="btn" onClick={() => void onWatchAdGainLives()} disabled={adLoading}>
                {adLoading ? t("adLoading") : t("watchAd")}
              </button>

              <button className="btnGhost" onClick={restartFromLevel1} disabled={adLoading}>
                {t("startLevel1")}
              </button>

              <button className="btnGhost" onClick={restartFromCheckpoint} disabled={adLoading}>
                {t("continueCheckpoint")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
