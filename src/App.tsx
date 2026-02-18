import React, { useEffect, useMemo, useRef, useState } from "react";

const DOOR_COUNT = 5;
const MAX_LIVES = 5;
const CHECKPOINT_LEVEL = 5;
const MAX_LEVEL = 10;

type Phase = "PLAYING" | "OUT";
const rand = (max: number) => Math.floor(Math.random() * max);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

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

export default function App() {
  const [audioReady, setAudioReady] = useState(false);
  const audioReadyRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("PLAYING");
  const [level, setLevel] = useState(1);
  const [maxReachedLevel, setMaxReachedLevel] = useState(1);
  const [lives, setLives] = useState(MAX_LIVES);

  const [safeDoor, setSafeDoor] = useState(() => rand(DOOR_COUNT));
  const [openedDoor, setOpenedDoor] = useState<number | null>(null);

  const [hoverDoor, setHoverDoor] = useState<number | null>(null);
  const [openingDoor, setOpeningDoor] = useState<number | null>(null);

  const [closingDoor, setClosingDoor] = useState<number | null>(null);
  const closingTimer = useRef<number | null>(null);

  const [scare, setScare] = useState(false);
  const scareTimer = useRef<number | null>(null);

  const [pulse, setPulse] = useState(false);
  const pulseTimer = useRef<number | null>(null);

  const [winFlash, setWinFlash] = useState(false);
  const [winDoor, setWinDoor] = useState<number | null>(null);
  const winTimer = useRef<number | null>(null);

  const [adLoading, setAdLoading] = useState(false);

  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const roundTotalMsRef = useRef(15000);
  const timerInterval = useRef<number | null>(null);
  const timeoutLockRef = useRef(false);

  // ✅ yeni: her elde timer’ı yeniden başlatmak için round sayacı
  const [roundId, setRoundId] = useState(0);

 const assets = useMemo(() => {
  const base = import.meta.env.BASE_URL; // örn: "/horror-door-game/"
  return {
    doorFrame: `${base}door_frame.png`,
    doorLeaf: `${base}door_leaf.png`,
    monsterImg: `${base}monster.png`,
    creak: `${base}door.mp3`,
    monster: `${base}monster.mp3`,
  };
}, []);


  // Audio
  const creakRef = useRef<HTMLAudioElement | null>(null);
  const monsterRef = useRef<HTMLAudioElement | null>(null);

  const hbUriRef = useRef<string | null>(null);
  const hbARef = useRef<HTMLAudioElement | null>(null);
  const hbBRef = useRef<HTMLAudioElement | null>(null);
  const hbToggleRef = useRef(false);

  // Heartbeat scheduler
  const beatMsRef = useRef(1200);
  const hbTimerRef = useRef<number | null>(null);
  const hbRunningRef = useRef(false);

  // Refs
  const phaseRef = useRef<Phase>("PLAYING");
  const scareRef = useRef(false);
  const timeLeftMsRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    scareRef.current = scare;
  }, [scare]);

  useEffect(() => {
    timeLeftMsRef.current = timeLeftMs;

    const total = roundTotalMsRef.current || 1;
    const ratio = clamp(timeLeftMs / total, 0, 1);
    beatMsRef.current = ratio > 0.66 ? 1200 : ratio > 0.33 ? 900 : 650;
  }, [timeLeftMs]);

  const safePlay = async (el: HTMLAudioElement | null, volume: number) => {
    if (!audioReadyRef.current || !el) return;
    try {
      el.volume = volume;
      el.currentTime = 0;
      await el.play();
    } catch {}
  };

  const playCreak = () => void safePlay(creakRef.current, 0.3);
  const playMonster = () => void safePlay(monsterRef.current, 0.95);

  const playHeartbeat = (vol = 0.46) => {
    if (!audioReadyRef.current) return;
    const pick = hbToggleRef.current ? hbBRef.current : hbARef.current;
    hbToggleRef.current = !hbToggleRef.current;
    if (!pick) return;
    void safePlay(pick, vol);
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
        timeLeftMsRef.current > 0;

      if (ok) playHeartbeat(0.46);

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

  const triggerPulse = () => {
    setPulse(true);
    if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    pulseTimer.current = window.setTimeout(() => setPulse(false), 220);
  };

  const triggerScare = () => {
    setScare(true);
    if (scareTimer.current) window.clearTimeout(scareTimer.current);
    scareTimer.current = window.setTimeout(() => setScare(false), 420);
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

  const calcRoundMs = (lvl: number) => {
    const sec = clamp(17 - Math.floor(lvl * 0.6), 11, 17);
    return sec * 1000;
  };

  const clearTimer = () => {
    if (timerInterval.current) {
      window.clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
  };

  const startNewRoundTimer = (lvl: number) => {
    const total = calcRoundMs(lvl);
    roundTotalMsRef.current = total;
    beatMsRef.current = 1200;
    timeoutLockRef.current = false;
    setTimeLeftMs(total);

    // ✅ kritik: round değişsin ki timer effect yeniden başlasın
    setRoundId((r) => r + 1);
  };

  const newHandSameLevel = () => {
    startClosingSlow(openedDoor);
    setOpenedDoor(null);
    setOpeningDoor(null);
    setHoverDoor(null);

    setSafeDoor(rand(DOOR_COUNT));
    startNewRoundTimer(level);
  };

  const newHandNextLevel = () => {
    startClosingSlow(openedDoor);
    const nl = Math.min(level + 1, MAX_LEVEL);

    setLevel(nl);
    setMaxReachedLevel((prev) => Math.max(prev, nl));

    setOpenedDoor(null);
    setOpeningDoor(null);
    setHoverDoor(null);

    setSafeDoor(rand(DOOR_COUNT));
    startNewRoundTimer(nl);
  };

  const getStartLevelFromCheckpoint = () =>
    maxReachedLevel >= CHECKPOINT_LEVEL ? CHECKPOINT_LEVEL : 1;

  const restartFromCheckpoint = () => {
    const startLevel = getStartLevelFromCheckpoint();

    setPhase("PLAYING");
    setLives(MAX_LIVES);
    setLevel(startLevel);
    setMaxReachedLevel((prev) => Math.max(prev, startLevel));

    startClosingSlow(openedDoor);
    setOpenedDoor(null);
    setOpeningDoor(null);
    setHoverDoor(null);

    setSafeDoor(rand(DOOR_COUNT));
    startNewRoundTimer(startLevel);
  };

  const unlockAudio = async () => {
    audioReadyRef.current = true;
    setAudioReady(true);

    if (!creakRef.current) creakRef.current = new Audio(assets.creak);
    if (!monsterRef.current) monsterRef.current = new Audio(assets.monster);

    if (!hbUriRef.current) hbUriRef.current = makeHeartbeatWavDataUri();
    if (!hbARef.current) hbARef.current = new Audio(hbUriRef.current);
    if (!hbBRef.current) hbBRef.current = new Audio(hbUriRef.current);

    await warmUpAudioDevice();

    try {
      const a = creakRef.current!;
      a.volume = 0;
      await a.play();
      a.pause();
      a.currentTime = 0;
      a.volume = 1;
    } catch {}

    try {
      const h = hbARef.current!;
      h.volume = 0;
      await h.play();
      await new Promise((r) => setTimeout(r, 80));
      h.pause();
      h.currentTime = 0;
      h.volume = 1;
    } catch {}

    window.setTimeout(() => playHeartbeat(0.62), 180);
    startHeartbeatLoop(1200);
  };

  const onDoorEnter = (i: number) => {
    if (phase !== "PLAYING") return;
    setHoverDoor(i);
    playCreak();
  };

  const onDoorLeave = (i: number) => {
    if (hoverDoor === i) setHoverDoor(null);
  };

  const onPickDoor = (i: number) => {
    if (phase !== "PLAYING") return;
    if (openedDoor !== null || openingDoor !== null) return;

    setOpenedDoor(i);
    setOpeningDoor(i);

    window.setTimeout(() => {
      const isSafe = i === safeDoor;

      if (isSafe) {
        triggerWin(i);
        window.setTimeout(() => {
          if (level >= MAX_LEVEL) restartFromCheckpoint();
          else newHandNextLevel();
        }, 820);
        return;
      }

      playMonster();
      triggerPulse();
      triggerScare();

      setLives((prev) => {
        const next = Math.max(0, prev - 1);
        if (next <= 0) {
          window.setTimeout(() => setPhase("OUT"), 260);
        } else {
          window.setTimeout(() => newHandSameLevel(), 900);
        }
        return next;
      });
    }, 220);
  };

  // ✅ Timer tick (roundId eklendi)
  useEffect(() => {
    clearTimer();

    const shouldRun = phase === "PLAYING" && audioReady && !scare;
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
          triggerPulse();

          setLives((lprev) => {
            const lnext = Math.max(0, lprev - 1);
            if (lnext <= 0) {
              window.setTimeout(() => setPhase("OUT"), 260);
            } else {
              window.setTimeout(() => newHandSameLevel(), 700);
            }
            return lnext;
          });

          return 0;
        }

        return next;
      });
    }, step);

    return clearTimer;
  }, [phase, audioReady, scare, level, roundId]);

  useEffect(() => {
    startNewRoundTimer(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!audioReady) return;
    if (phase === "PLAYING") startHeartbeatLoop();
    else stopHeartbeatLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioReady, phase]);

  const onWatchAdGainLives = async () => {
    if (adLoading) return;
    setAdLoading(true);

    await new Promise((r) => setTimeout(r, 1200));
    setAdLoading(false);

    setPhase("PLAYING");
    setLives(2);

    startClosingSlow(openedDoor);
    setOpenedDoor(null);
    setOpeningDoor(null);
    setHoverDoor(null);

    // aynı level / aynı elde: safeDoor değişmez
    startNewRoundTimer(level);
  };

  useEffect(() => {
    return () => {
      clearTimer();
      stopHeartbeatLoop();
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
      if (scareTimer.current) window.clearTimeout(scareTimer.current);
      if (winTimer.current) window.clearTimeout(winTimer.current);
      if (closingTimer.current) window.clearTimeout(closingTimer.current);
      try {
        creakRef.current?.pause();
        monsterRef.current?.pause();
        hbARef.current?.pause();
        hbBRef.current?.pause();
      } catch {}
    };
  }, []);

  const total = roundTotalMsRef.current || 1;
  const ratio = clamp(timeLeftMs / total, 0, 1);
  const beatMs = beatMsRef.current;

  return (
    <div
      className={`app ${pulse ? "pulse" : ""} ${scare ? "scare" : ""} ${winFlash ? "win" : ""}`}
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

        .app.win .wrap{animation:winshake 420ms ease-out;}
        @keyframes winshake{
          0%{transform:translate(0,0)}
          15%{transform:translate(-6px,3px)}
          30%{transform:translate(7px,-4px)}
          45%{transform:translate(-5px,-2px)}
          60%{transform:translate(4px,2px)}
          100%{transform:translate(0,0)}
        }
        .app.win::before{
          content:"";
          position:fixed; inset:-40px;
          background:radial-gradient(650px 420px at 50% 45%, rgba(176,141,36,.22), rgba(0,0,0,0) 65%);
          opacity:.95;
          pointer-events:none;
          z-index:60;
          animation:flashfade 700ms ease-out forwards;
        }
        @keyframes flashfade{0%{opacity:.95}100%{opacity:0}}

        .hud{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;}
        .title{margin:0;font-family:"Rubik Wet Paint",system-ui;font-size:34px;letter-spacing:.5px;line-height:1;opacity:.95;text-shadow:0 10px 40px rgba(0,0,0,.45);}
        .sub{margin:6px 0 0;color:rgba(255,255,255,.82);font-size:13px;font-family:"UnifrakturCook",system-ui;letter-spacing:.6px;opacity:.92;}
        .hudRight{display:flex;gap:10px;align-items:center;font-size:13px;flex-wrap:wrap;justify-content:flex-end;}
        .pill{padding:8px 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);backdrop-filter:blur(6px);color:rgba(255,255,255,.9);font-family:"Creepster",system-ui;letter-spacing:.8px;}
        .pill b{font-family:ui-sans-serif,system-ui;letter-spacing:0;}

        .pulseWrap{margin:6px 0 14px;display:flex;gap:10px;align-items:center;}
        .pulseLabel{font-family:"Creepster",system-ui;letter-spacing:.9px;color:rgba(255,255,255,.78);font-size:14px;opacity:.95;transform:translateY(1px);user-select:none;}
        .ecgBar{flex:1;height:18px;border-radius:999px;background:linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.04));
          border:1px solid rgba(255,255,255,.12);overflow:hidden;position:relative;box-shadow:0 10px 40px rgba(0,0,0,.35);
        }
        .ecgDim{position:absolute;top:0;right:0;bottom:0;width:calc((1 - var(--t)) * 100%);background:rgba(0,0,0,.52);pointer-events:none;}
        .ecgViewport{position:absolute;inset:0;overflow:hidden;}
        .ecgMove{position:absolute;inset:0;width:200%;display:flex;animation:scroll var(--beat) linear infinite;opacity:1;filter:drop-shadow(0 0 10px var(--goldGlow));}
        .ecgSvg{width:50%;height:100%;}
        @keyframes scroll{0%{transform:translateX(0%)}100%{transform:translateX(-50%)}}

        .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;}
        @media (max-width: 860px){ .grid{grid-template-columns: repeat(3, 1fr)} }
        @media (max-width: 520px){ .grid{grid-template-columns: repeat(2, 1fr)} }

        .doorBtn{border:none;background:transparent;padding:0;cursor:pointer;}
        .doorBtn:disabled{cursor:not-allowed;opacity:.65;}

        .doorStage{position:relative;width:100%;height:196px;border-radius:16px;overflow:hidden;box-shadow:0 18px 70px rgba(0,0,0,.45);background:rgba(0,0,0,.25);}
        .inside{position:absolute;inset:0;background:radial-gradient(260px 180px at 50% 45%, rgba(0,0,0,.05), rgba(0,0,0,.94) 74%);}
        .frame{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;filter:contrast(1.02) brightness(.92);}

        .leaf{position:absolute;inset:0;width:100%;object-fit:cover;pointer-events:none;transform-origin:22% 38%;
          transform:perspective(900px) rotateY(0deg);
          transition:transform 520ms ease;
          filter:contrast(1.06) brightness(.98);
          top:-2px;height:calc(100% + 4px);
        }
        .ajarHover{transform:perspective(900px) rotateY(-16deg);}
        .ajarFull{transform:perspective(900px) rotateY(-78deg);}

        .closingSlow{transition-duration: 980ms !important; transition-timing-function: ease-out !important;}
        .winGlow{filter: drop-shadow(0 0 18px rgba(176,141,36,.55)) drop-shadow(0 0 40px rgba(176,141,36,.25));}

        .monsterInside{position:absolute;inset:0;opacity:0;transform:scale(.85);transition:opacity 100ms ease, transform 100ms ease;pointer-events:none;filter:brightness(.9) contrast(1.08);}
        .monsterInside img{width:100%;height:100%;object-fit:cover;}
        .monsterShow{opacity:1;transform:scale(1.05);}

        .scareOverlay{position:fixed;inset:0;z-index:90;pointer-events:none;opacity:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);}
        .app.scare .scareOverlay{opacity:1;}
        .scareImg{width:min(720px, 92vw);height:min(520px, 72vh);object-fit:cover;border-radius:18px;filter:contrast(1.15) brightness(.85);
          transform:scale(.65);animation:zoompop 420ms ease-out forwards;box-shadow:0 40px 160px rgba(0,0,0,.70);
        }
        @keyframes zoompop{0%{transform:scale(.60)}70%{transform:scale(1.12)}100%{transform:scale(1.02)}}

        .pulse::after{content:"";position:fixed;inset:-20px;background:rgba(0,0,0,.65);animation:pulsefx .22s ease-out forwards;z-index:70;pointer-events:none;}
        @keyframes pulsefx{0%{opacity:0;transform:scale(1.02)}60%{opacity:1;transform:scale(1.0)}100%{opacity:0;transform:scale(1.0)}}

        .overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(0,0,0,.72);z-index:80;}
        .modal{width:min(520px, 100%);background:rgba(10,10,16,.92);border:1px solid rgba(255,255,255,.10);border-radius:22px;padding:18px;
          box-shadow:0 30px 140px rgba(0,0,0,.70);backdrop-filter:blur(12px);
        }
        .modalTitle{margin:0;font-family:"Creepster",system-ui;font-size:26px;letter-spacing:1px;}
        .modalInfo{margin:10px 0 14px;color:rgba(255,255,255,.82);font-size:14px;line-height:1.45;}
        .btn{width:100%;border:none;border-radius:14px;padding:13px 14px;font-weight:900;cursor:pointer;background:rgba(176,141,36,.92);color:#0b0b10;}
        .btnGhost{width:100%;border-radius:14px;padding:13px 14px;font-weight:900;cursor:pointer;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.92);}
        .btnRow{display:flex;flex-direction:column;gap:10px;}

        .winToast{
          position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
          pointer-events:none; z-index:85;
          background: radial-gradient(700px 380px at 50% 45%, rgba(0,0,0,.10), rgba(0,0,0,.62));
          opacity:0; transform:scale(.98);
          transition:opacity 160ms ease, transform 160ms ease;
        }
        .winToast.show{opacity:1; transform:scale(1);}
        .winText{
          font-family:"Creepster", system-ui;
          font-size:min(82px, 12vw);
          letter-spacing:2px;
          color:var(--gold);
          text-shadow: 0 0 18px rgba(176,141,36,.55), 0 20px 80px rgba(0,0,0,.75);
          text-align:center;
          line-height:0.95;
        }
        .winSmall{
          display:block;
          margin-top:10px;
          font-family:"UnifrakturCook", system-ui;
          font-size:min(28px, 5vw);
          letter-spacing:1.5px;
          color:rgba(255,255,255,.85);
          text-shadow:0 14px 60px rgba(0,0,0,.75);
        }
      `}</style>

      <div className="wrap">
        <div className="hud">
          <div>
            <h1 className="title">Seviye {level}</h1>
            <p className="sub">{!audioReady ? "Sesleri aç." : "Güvenli kapıyı bul."}</p>
          </div>

          <div className="hudRight">
            <span className="pill">Hak: <b>{lives}/{MAX_LIVES}</b></span>
            <span className="pill">Checkpoint: <b>{CHECKPOINT_LEVEL}</b></span>
            <span className="pill">Başlangıç: <b>{maxReachedLevel >= CHECKPOINT_LEVEL ? CHECKPOINT_LEVEL : 1}</b></span>

          </div>
        </div>

        {phase === "PLAYING" && audioReady && (
          <div className="pulseWrap" aria-label="timer">
            <div className="pulseLabel">Nabız</div>
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

        <div className="grid">
          {Array.from({ length: DOOR_COUNT }).map((_, i) => {
            const disabled = phase !== "PLAYING";
            const isHover = hoverDoor === i && openedDoor === null && openingDoor === null;
            const isFullOpen = openedDoor === i || openingDoor === i;
            const leafClass = isFullOpen ? "ajarFull" : isHover ? "ajarHover" : "";
            const slowClose = closingDoor === i && !isFullOpen;
            const glow = winFlash && winDoor === i;

            return (
              <button
                key={i}
                className="doorBtn"
                disabled={disabled}
                onMouseEnter={() => onDoorEnter(i)}
                onMouseLeave={() => onDoorLeave(i)}
                onClick={() => onPickDoor(i)}
                title="Kapıyı seç"
              >
                <div className="doorStage">
                  <div className="inside" />
                  <div className={`monsterInside ${scare && openedDoor === i ? "monsterShow" : ""}`}>
                    <img src={assets.monsterImg} alt="Monster" />
                  </div>

                  <img className="frame" src={assets.doorFrame} alt="Door frame" />
                  <img
                    className={`leaf ${leafClass} ${slowClose ? "closingSlow" : ""} ${glow ? "winGlow" : ""}`}
                    src={assets.doorLeaf}
                    alt="Door leaf"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`winToast ${winFlash ? "show" : ""}`}>
        <div className="winText">
          YIRTTIN
          <span className="winSmall">(ŞİMDİLİK)</span>
        </div>
      </div>

      {!audioReady && phase === "PLAYING" && (
        <div className="overlay" style={{ background: "rgba(0,0,0,.55)" }}>
          <div className="modal">
            <h2 className="modalTitle">Ses Kilidi</h2>
            <p className="modalInfo">Tarayıcı sesleri kullanıcı etkileşimi olmadan açmıyor. Bir kere “Sesi Aç” bas.</p>
            <div className="btnRow">
              <button className="btn" onClick={() => void unlockAudio()}>Sesi Aç</button>
            </div>
          </div>
        </div>
      )}

      {phase === "OUT" && (
        <div className="overlay">
          <div className="modal">
            <h2 className="modalTitle">Öldün</h2>
            <p className="modalInfo">
              Reklam izlersen <b>+2 hak</b> alıp <b>aynı elde</b> devam edersin.  
              Reklam istemiyorsan <b>checkpoint</b> varsa oradan dönersin.
            </p>
            <div className="btnRow">
              <button className="btn" onClick={() => void onWatchAdGainLives()} disabled={adLoading}>
                {adLoading ? "Reklam yükleniyor..." : "Reklam İzle (+2 Hak)"}
              </button>
              <button className="btnGhost" onClick={restartFromCheckpoint} disabled={adLoading}>
                Başa Dön
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="scareOverlay">
        <img className="scareImg" src={assets.monsterImg} alt="Jumpscare" />
      </div>
    </div>
  );
}
