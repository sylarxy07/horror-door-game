import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHECKPOINT_LEVEL,
  DOOR_COUNT,
  INITIAL_CLUES,
  INITIAL_PUZZLES,
  INTERACT_RADIUS,
  MAX_LEVEL,
  MAX_LIVES,
  PATH_LEN,
  PATH_VIEW,
  START_POS,
  TUNNEL_ENTER_RADIUS,
  TUNNEL_POS,
} from "./game/constants";
import { introLines, objectByKey, pathObjects, sidePosts } from "./game/data";
import type { ClueKey, CluesState, DoorOutcome, PathObject, PuzzleState, RoundLayout, Scene } from "./game/types";
import { clamp, createRoundLayout, getDoorOutcome } from "./game/utils";
import { BeachScene } from "./scenes/BeachScene";
import { DoorGameScene } from "./scenes/DoorGameScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { IntroScene } from "./scenes/IntroScene";
import { MenuScene } from "./scenes/MenuScene";
import { PuzzleModal } from "./scenes/PuzzleModal";
import { TunnelScene } from "./scenes/TunnelScene";
import { WinScene } from "./scenes/WinScene";
import "./game/game.css";

export default function App() {
  const [scene, setScene] = useState<Scene>("MENU");

  const [introStep, setIntroStep] = useState(0);

  const [fadeOn, setFadeOn] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hitPulse, setHitPulse] = useState<0 | 1 | 2>(0);
  const [shake, setShake] = useState<0 | 1 | 2>(0);

  // BEACH
  const [clues, setClues] = useState<CluesState>(INITIAL_CLUES);
  const [selectedClue, setSelectedClue] = useState<ClueKey | null>(null);
  const [beachHint, setBeachHint] = useState(
    "Tamay ayağa kalktı. Sisli yürüyüş yolunda eski deneklere ait izler var gibi..."
  );
  const [redLightUnlocked, setRedLightUnlocked] = useState(false);
  const [redLightPhase, setRedLightPhase] = useState<"IDLE" | "SHOW_TEXT" | "READY">("IDLE");
  const [tamayPos, setTamayPos] = useState(START_POS);
  const [cameraPos, setCameraPos] = useState(clamp(START_POS - 18, 0, PATH_LEN - PATH_VIEW));
  const [moveDir, setMoveDir] = useState<-1 | 0 | 1>(0);
  const [journalOpen, setJournalOpen] = useState(false);

  // movement feel
  const [walkClock, setWalkClock] = useState(0);
  const [walkBlend, setWalkBlend] = useState(0);

  // puzzles
  const [puzzles, setPuzzles] = useState<PuzzleState>(INITIAL_PUZZLES);
  const [puzzleFeedback, setPuzzleFeedback] = useState("");

  // TUNNEL / DOOR GAME
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(MAX_LIVES);
  const [checkpointUnlocked, setCheckpointUnlocked] = useState(false);

  const [roundLayout, setRoundLayout] = useState<RoundLayout>(createRoundLayout());
  const [selectedDoor, setSelectedDoor] = useState<number | null>(null);
  const [doorsRevealed, setDoorsRevealed] = useState(false);
  const [doorInputLocked, setDoorInputLocked] = useState(false);
  const [doorHint, setDoorHint] = useState("Doğru kapıyı seç.");
  const [lastOutcome, setLastOutcome] = useState<DoorOutcome | null>(null);

  const timeoutRefs = useRef<number[]>([]);
  const touchYRef = useRef<number | null>(null);

  // refs for smooth camera loop
  const tamayPosRef = useRef(tamayPos);
  const moveDirRef = useRef(moveDir);
  const selectedClueRef = useRef<ClueKey | null>(selectedClue);

  useEffect(() => {
    tamayPosRef.current = tamayPos;
  }, [tamayPos]);
  useEffect(() => {
    moveDirRef.current = moveDir;
  }, [moveDir]);
  useEffect(() => {
    selectedClueRef.current = selectedClue;
  }, [selectedClue]);

  const inspectedCount = useMemo(() => Object.values(clues).filter(Boolean).length, [clues]);
  const allCluesFound = useMemo(() => Object.values(clues).every(Boolean), [clues]);

  const nearestObject = useMemo(() => {
    let best: { obj: PathObject; dist: number } | null = null;
    for (const obj of pathObjects) {
      const dist = Math.abs(tamayPos - obj.pos);
      if (!best || dist < best.dist) best = { obj, dist };
    }
    return best;
  }, [tamayPos]);

  const interactableObject = useMemo(() => {
    if (!nearestObject) return null;
    if (nearestObject.dist > INTERACT_RADIUS) return null;
    return nearestObject.obj;
  }, [nearestObject]);

  const nextUnsolvedObject = useMemo(() => {
    const unsolved = pathObjects.filter((o) => !clues[o.key]);
    if (!unsolved.length) return null;
    let best: { obj: PathObject; dist: number } | null = null;
    for (const obj of unsolved) {
      const dist = Math.abs(tamayPos - obj.pos);
      if (!best || dist < best.dist) best = { obj, dist };
    }
    return best;
  }, [clues, tamayPos]);

  const canInspect =
    scene === "BEACH" &&
    !!interactableObject &&
    !selectedClue &&
    !clues[interactableObject.key] &&
    !isTransitioning;

  const canEnterTunnel =
    scene === "BEACH" &&
    redLightPhase === "READY" &&
    !selectedClue &&
    !isTransitioning &&
    tamayPos >= TUNNEL_POS - TUNNEL_ENTER_RADIUS;

  const pathProgressPercentRaw = Math.round((Math.min(tamayPos, TUNNEL_POS) / TUNNEL_POS) * 100);
  const pathProgressPercent = canEnterTunnel ? 100 : pathProgressPercentRaw;

  const targetHint = useMemo(() => {
    if (scene !== "BEACH") return "";
    if (canEnterTunnel) return "Hedef: Tünel girişi hazır (E)";
    if (!allCluesFound) {
      if (interactableObject && !clues[interactableObject.key]) return `Yakın: ${interactableObject.label} (E)`;
      if (nextUnsolvedObject) {
        const dir = nextUnsolvedObject.obj.pos > tamayPos ? "ileride" : "geride";
        return `Sonraki hedef: ${nextUnsolvedObject.obj.label} (${Math.round(nextUnsolvedObject.dist)}m, ${dir})`;
      }
      return "Hedef aranıyor...";
    }
    const distToTunnel = Math.max(0, Math.round(TUNNEL_POS - tamayPos));
    return `Kırmızı ışık aktif. Tünel ${distToTunnel}m`;
  }, [scene, canEnterTunnel, allCluesFound, interactableObject, clues, nextUnsolvedObject, tamayPos]);

  const addTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timeoutRefs.current.push(id);
    return id;
  }, []);

  const clearAllTimeouts = useCallback(() => {
    timeoutRefs.current.forEach((id) => window.clearTimeout(id));
    timeoutRefs.current = [];
  }, []);

  useEffect(() => {
    return () => clearAllTimeouts();
  }, [clearAllTimeouts]);

  const triggerHitPulse = useCallback((strength: 1 | 2) => {
    setHitPulse(strength);
    addTimeout(() => setHitPulse(0), strength === 2 ? 360 : 240);
  }, [addTimeout]);

  const triggerShake = useCallback((strength: 1 | 2) => {
    setShake(strength);
    addTimeout(() => setShake(0), strength === 2 ? 320 : 180);
  }, [addTimeout]);

  const goWithFade = useCallback((nextScene: Scene) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setFadeOn(true);
    setMoveDir(0);

    addTimeout(() => setScene(nextScene), 520);
    addTimeout(() => {
      setFadeOn(false);
      setIsTransitioning(false);
    }, 980);
  }, [addTimeout, isTransitioning]);

  const resetFullGameState = () => {
    clearAllTimeouts();

    setScene("MENU");
    setIntroStep(0);

    setFadeOn(false);
    setIsTransitioning(false);
    setHitPulse(0);
    setShake(0);

    setClues(INITIAL_CLUES);
    setSelectedClue(null);
    setBeachHint("Tamay ayağa kalktı. Sisli yürüyüş yolunda eski deneklere ait izler var gibi...");
    setRedLightUnlocked(false);
    setRedLightPhase("IDLE");
    setTamayPos(START_POS);
    setCameraPos(clamp(START_POS - 18, 0, PATH_LEN - PATH_VIEW));
    setMoveDir(0);
    setJournalOpen(false);
    setWalkClock(0);
    setWalkBlend(0);

    setPuzzles(INITIAL_PUZZLES);
    setPuzzleFeedback("");

    setLevel(1);
    setLives(MAX_LIVES);
    setCheckpointUnlocked(false);
    setRoundLayout(createRoundLayout());
    setSelectedDoor(null);
    setDoorsRevealed(false);
    setDoorInputLocked(false);
    setDoorHint("Doğru kapıyı seç.");
    setLastOutcome(null);
  };

  const startNewRun = () => {
    resetFullGameState();
    setScene("INTRO");
  };

  // when BEACH opens, snap camera near player start (only once on entry)
  useEffect(() => {
    if (scene === "BEACH") {
      setCameraPos(clamp(tamayPosRef.current - 18, 0, PATH_LEN - PATH_VIEW));
      setWalkBlend(0);
    }
  }, [scene]);

  // BEACH movement loop (player position)
  useEffect(() => {
    if (scene !== "BEACH") return;
    if (moveDir === 0) return;
    if (selectedClue) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(34, now - last);
      last = now;

      const speed = moveDir === 1 ? 0.034 : 0.03; // ileri biraz daha güçlü
      setTamayPos((p) => clamp(p + moveDir * dt * speed, 5, PATH_LEN - 4));

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [scene, moveDir, selectedClue]);

  // BEACH camera lag + gait feeling loop
  useEffect(() => {
    if (scene !== "BEACH") return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(40, now - last);
      last = now;

      const moving = moveDirRef.current !== 0 && !selectedClueRef.current;
      const dir = moveDirRef.current;

      setWalkBlend((prev) => {
        const target = moving ? 1 : 0;
        const k = moving ? 0.18 : 0.11;
        return prev + (target - prev) * (1 - Math.exp(-dt * k));
      });

      setWalkClock((prev) => prev + dt * (moving ? (dir === 1 ? 0.024 : 0.018) : 0.006));

      setCameraPos((prev) => {
        const tPos = tamayPosRef.current;
        // hafif ileri bakış + gecikmeli takip
        const forwardLook = dir === 1 ? 6 : dir === -1 ? -1.5 : 2;
        const target = clamp(tPos - 18 + forwardLook, 0, PATH_LEN - PATH_VIEW);
        const lerp = 1 - Math.exp(-dt * 0.08);
        return prev + (target - prev) * lerp;
      });

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [scene]);

  // all clues -> red light unlock
  useEffect(() => {
    if (scene !== "BEACH") return;
    if (!allCluesFound) return;
    if (redLightUnlocked) return;

    setRedLightUnlocked(true);
    setRedLightPhase("SHOW_TEXT");
    setBeachHint("Yolun sonunda kırmızı ışık güçleniyor. Sanki bir çağrı sinyali...");
    triggerShake(1);

    addTimeout(() => setBeachHint("Tamay içinden mırıldanır: 'Bu işaret beni oraya çekiyor.'"), 1100);
    addTimeout(() => {
      setRedLightPhase("READY");
      setBeachHint("5/5 hikâye parçası toplandı. İleri git ve tünel girişine gir.");
      triggerShake(1);
    }, 2300);
  }, [scene, allCluesFound, redLightUnlocked, triggerShake, addTimeout]);

  const openClue = useCallback((key: ClueKey) => {
    if (scene !== "BEACH" || isTransitioning) return;
    setMoveDir(0);
    setPuzzleFeedback("");
    setSelectedClue(key);
  }, [isTransitioning, scene]);

  const closeClueModal = () => {
    setSelectedClue(null);
    setPuzzleFeedback("");
  };

  const markClueSolved = (key: ClueKey) => {
    if (clues[key]) {
      closeClueModal();
      return;
    }

    setClues((prev) => ({ ...prev, [key]: true }));
    setSelectedClue(null);
    setPuzzleFeedback("");

    const obj = objectByKey[key];
    const nextCount = inspectedCount + 1;
    setBeachHint(`${obj.label} çözüldü (${nextCount}/5). ${obj.shortHint}`);
  };

  const startBeachToTunnel = useCallback(() => {
    if (!canEnterTunnel) return;
    setBeachHint("Tamay kırmızı ışığın altındaki servis geçidine giriyor...");
    goWithFade("TUNNEL");
  }, [canEnterTunnel, goWithFade]);

  // keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (scene !== "BEACH") return;

      const key = e.key.toLowerCase();
      if ((e.key === "ArrowUp" || key === "w") && !selectedClue) setMoveDir(1);
      if ((e.key === "ArrowDown" || key === "s") && !selectedClue) setMoveDir(-1);

      if (key === "e") {
        if (canInspect && interactableObject) {
          openClue(interactableObject.key);
        } else if (canEnterTunnel) {
          startBeachToTunnel();
        }
      }

      if (e.key === "Escape" && selectedClue) closeClueModal();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (scene !== "BEACH") return;
      const key = e.key.toLowerCase();
      if (e.key === "ArrowUp" || key === "w" || e.key === "ArrowDown" || key === "s") setMoveDir(0);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [scene, selectedClue, canInspect, interactableObject, canEnterTunnel, openClue, startBeachToTunnel]);

  const startDoorGameFromTunnel = () => {
    if (scene !== "TUNNEL" || isTransitioning) return;

    setRoundLayout(createRoundLayout());
    setSelectedDoor(null);
    setDoorsRevealed(false);
    setDoorInputLocked(false);
    setLastOutcome(null);
    setDoorHint("Kat 1 — Doğru kapıyı seç.");

    goWithFade("DOOR_GAME");
  };

  const prepareNextRound = (message: string) => {
    setRoundLayout(createRoundLayout());
    setSelectedDoor(null);
    setDoorsRevealed(false);
    setDoorInputLocked(false);
    setLastOutcome(null);
    setDoorHint(message);
  };

  const handleDoorPick = (doorIndex: number) => {
    if (scene !== "DOOR_GAME") return;
    if (doorInputLocked || doorsRevealed) return;

    setDoorInputLocked(true);
    setSelectedDoor(doorIndex);
    setDoorsRevealed(true);

    const outcome = getDoorOutcome(doorIndex, roundLayout);
    setLastOutcome(outcome);

    if (outcome === "SAFE") {
      setDoorHint("Doğru kapı bulundu.");
      addTimeout(() => {
        if (level >= MAX_LEVEL) {
          setScene("WIN");
          setDoorInputLocked(false);
          return;
        }

        const nextLevel = level + 1;
        setLevel(nextLevel);
        if (nextLevel >= CHECKPOINT_LEVEL) setCheckpointUnlocked(true);
        prepareNextRound(`Kat ${nextLevel} — Doğru kapıyı seç.`);
      }, 850);
      return;
    }

    const damage = outcome === "CURSE" ? 2 : 1;
    const nextLives = clamp(lives - damage, 0, MAX_LIVES);
    setLives(nextLives);

    triggerHitPulse(outcome === "CURSE" ? 2 : 1);
    triggerShake(outcome === "CURSE" ? 2 : 1);

    setDoorHint(outcome === "CURSE" ? "Lanet kapısı. İki can kaybettin." : "Yanlış kapı. İçeride bir şey vardı.");

    addTimeout(() => {
      if (nextLives <= 0) {
        setScene("GAME_OVER");
        setDoorInputLocked(false);
        return;
      }
      prepareNextRound(`Kat ${level} — Yeniden dene.`);
    }, 950);
  };

  const retryToMenu = () => {
    resetFullGameState();
    setScene("MENU");
  };

  const retryFromCheckpoint = () => {
    clearAllTimeouts();
    setFadeOn(false);
    setIsTransitioning(false);
    setMoveDir(0);
    setHitPulse(0);
    setShake(0);

    setScene("DOOR_GAME");
    setLevel(CHECKPOINT_LEVEL);
    setLives(MAX_LIVES);
    setCheckpointUnlocked(true);
    prepareNextRound(`Kat ${CHECKPOINT_LEVEL} — Doğru kapıyı seç.`);
  };

  const getDoorClassName = (index: number) => {
    let cls = "door";
    if (selectedDoor === index) cls += " selected";
    if (doorsRevealed) {
      const outcome = getDoorOutcome(index, roundLayout);
      if (outcome === "SAFE") cls += " safe";
      else if (outcome === "CURSE") cls += " curse";
      else cls += " monster";
    }
    return cls;
  };

  const getDoorVisualLabel = (index: number) => {
    if (!doorsRevealed) return `KAPI ${index + 1}`;
    const outcome = getDoorOutcome(index, roundLayout);
    if (outcome === "SAFE") return "DOĞRU";
    if (outcome === "CURSE") return "LANET";
    return "YANLIŞ";
  };

  // ===== BEACH projection (now uses cameraPos, not tamayPos) =====
  const relToScreen = (worldPos: number, lane: number) => {
    const rel = worldPos - cameraPos; // camera-based => lag feel
    const nearBack = -14;
    const farMax = 150;
    const normalized = clamp((rel - nearBack) / (farMax - nearBack), 0, 1); // 0 near, 1 far? actually nearBack..far
    const dist = normalized; // 0 near-ish, 1 far
    const t = 1 - dist; // near strength
    const y = 17 + dist * 64; // far => top-ish, near => lower
    const baseHalfRoad = 6 + dist * 24; // far road wider in projection space (because y mapping inverted visually)
    const x = 50 + lane * baseHalfRoad * 0.62;
    const scale = 0.54 + t * 1.2;
    const opacity = rel < -20 || rel > 158 ? 0 : 0.2 + t * 0.8;
    const visible = rel > -22 && rel < 158;
    return { rel, x, y, scale, opacity, visible, dist, t };
  };

  const tunnelProj = relToScreen(TUNNEL_POS, 0);
  const redLampProj = relToScreen(TUNNEL_POS + 6, 0);

  // movement feel values
  const moveStrength = walkBlend;
  const bob = Math.sin(walkClock) * 3.4 * moveStrength;
  const stride = Math.cos(walkClock * 0.5) * 1.8 * moveStrength;
  const tamayLift = (moveDir === 1 ? -10 : moveDir === -1 ? 2 : 0) * moveStrength;
  const tamayScale = 1 + (moveDir === 1 ? -0.02 : 0.008) * moveStrength;
  const tamayX = stride * 0.8;
  const camSwayX = Math.sin(walkClock * 0.45) * 1.2 * moveStrength;
  const camSwayY = Math.cos(walkClock * 0.9) * 0.8 * moveStrength;

  const canSolveNote =
    puzzles.noteSeq.length === 4 &&
    [2, 4, 1, 3].every((n, i) => puzzles.noteSeq[i] === n);

  const beachObjectsSolvedList = pathObjects.filter((o) => clues[o.key]).map((o) => o.label);
  const worldShakeClass = shake === 2 ? "shake2" : shake === 1 ? "shake1" : "";

  const NOTE_TARGET = [2, 4, 1, 3];

  const renderPuzzleContent = () => {
    if (!selectedClue) return null;
    const meta = objectByKey[selectedClue];
    const solved = clues[selectedClue];

    if (solved) {
      return (
        <div className="puzzleWrap">
          <div className="puzzleLore">
            <div className="puzzleLoreTitle">{meta.loreTitle}</div>
            <div className="puzzleLoreText">{meta.loreText}</div>
          </div>
          <div className="rowEnd">
            <button className="btn" onClick={closeClueModal} type="button">
              Kapat
            </button>
          </div>
        </div>
      );
    }

    switch (selectedClue) {
      case "band": {
        const canSolve = puzzles.bandScrub >= 85;
        return (
          <div className="puzzleWrap">
            <div className="smallText">Tuz ve kiri temizle. Kod görünür hale gelsin.</div>
            <div className="box">
              <div className="smallText">Temizlik: %{Math.round(puzzles.bandScrub)}</div>
              <input
                type="range"
                min={0}
                max={100}
                value={puzzles.bandScrub}
                onChange={(e) => setPuzzles((p) => ({ ...p, bandScrub: Number(e.target.value) }))}
              />
            </div>
            <div className="smallText">
              {puzzles.bandScrub < 40 ? "Kirli" : puzzles.bandScrub < 85 ? "Kod seçiliyor..." : "Kod netleşti: D-05"}
            </div>
            <div className="rowEnd">
              <button className="btn" onClick={closeClueModal} type="button">
                Geri
              </button>
              <button className="btn danger" onClick={() => markClueSolved("band")} disabled={!canSolve} type="button">
                Kaydı Al
              </button>
            </div>
          </div>
        );
      }

      case "recorder": {
        const tuned = Math.abs(puzzles.recorderTune - 73) <= 3;
        const canSolve = tuned && puzzles.recorderChecked;
        return (
          <div className="puzzleWrap">
            <div className="smallText">Frekansı ayarla, sonra Dinle.</div>
            <div className="box">
              <div className="smallText">Frekans: {Math.round(puzzles.recorderTune)}</div>
              <input
                type="range"
                min={0}
                max={100}
                value={puzzles.recorderTune}
                onChange={(e) =>
                  setPuzzles((p) => ({
                    ...p,
                    recorderTune: Number(e.target.value),
                    recorderChecked: false,
                  }))
                }
              />
            </div>
            <div className="rowEnd">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setPuzzles((p) => ({ ...p, recorderChecked: true }));
                  setPuzzleFeedback(tuned ? "Ses kısa süreliğine netleşti." : "Hâlâ cızırtı var.");
                }}
              >
                Dinle
              </button>
              <button className="btn" onClick={closeClueModal} type="button">
                Geri
              </button>
              <button className="btn danger" onClick={() => markClueSolved("recorder")} disabled={!canSolve} type="button">
                Kaydı Al
              </button>
            </div>
          </div>
        );
      }

      case "note": {
        const push = (n: number) => {
          setPuzzles((p) => {
            const next = [...p.noteSeq, n];
            const prefixOk = NOTE_TARGET.slice(0, next.length).every((v, i) => v === next[i]);
            if (!prefixOk) {
              setPuzzleFeedback("Yanlış sıra. Parçalar dağıldı.");
              return { ...p, noteSeq: [] };
            }
            setPuzzleFeedback("");
            return { ...p, noteSeq: next };
          });
        };

        return (
          <div className="puzzleWrap">
            <div className="smallText">Parçaları doğru sırayla hizala. (Yanlışta sıfırlanır)</div>
            <div className="box smallText">Sıra: {puzzles.noteSeq.length ? puzzles.noteSeq.join(" - ") : "boş"}</div>
            <div className="grid2">
              {[1, 2, 3, 4].map((n) => (
                <button className="btn" key={n} type="button" onClick={() => push(n)} disabled={canSolveNote}>
                  Parça {n}
                </button>
              ))}
            </div>
            <div className="smallText">İpucu: Köşedeki rüzgâr izi, 2. parçayı öne itiyor.</div>
            <div className="rowEnd">
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setPuzzles((p) => ({ ...p, noteSeq: [] }));
                  setPuzzleFeedback("");
                }}
              >
                Sıfırla
              </button>
              <button className="btn" onClick={closeClueModal} type="button">
                Geri
              </button>
              <button className="btn danger" onClick={() => markClueSolved("note")} disabled={!canSolveNote} type="button">
                Kaydı Al
              </button>
            </div>
          </div>
        );
      }

      case "phone": {
        const canSolve = puzzles.phonePin === "0510";

        const addDigit = (d: string) => {
          setPuzzles((p) => (p.phonePin.length >= 4 ? p : { ...p, phonePin: p.phonePin + d }));
          setPuzzleFeedback("");
        };

        const backspace = () => setPuzzles((p) => ({ ...p, phonePin: p.phonePin.slice(0, -1) }));

        return (
          <div className="puzzleWrap">
            <div className="smallText">4 haneli kodu gir. (İpucu: 5. kat + 10 döngü)</div>
            <div className="pinRow">
              {(puzzles.phonePin + "____")
                .slice(0, 4)
                .split("")
                .map((ch, i) => (
                  <div className="pinCell" key={i}>
                    {ch === "_" ? "•" : ch}
                  </div>
                ))}
            </div>
            <div className="grid3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "⌫"].map((k) => (
                <button
                  className="btn"
                  key={String(k)}
                  type="button"
                  onClick={() => {
                    if (k === "C") {
                      setPuzzles((p) => ({ ...p, phonePin: "" }));
                      setPuzzleFeedback("");
                      return;
                    }
                    if (k === "⌫") {
                      backspace();
                      return;
                    }
                    addDigit(String(k));
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
            <div className="rowEnd">
              <button
                className="btn"
                type="button"
                onClick={() => setPuzzleFeedback(canSolve ? "Kilit açıldı." : "Kod yanlış.")}
              >
                Kontrol Et
              </button>
              <button className="btn" onClick={closeClueModal} type="button">
                Geri
              </button>
              <button className="btn danger" onClick={() => markClueSolved("phone")} disabled={!canSolve} type="button">
                Kaydı Al
              </button>
            </div>
          </div>
        );
      }

      case "tag": {
        const canSolve = puzzles.tagUv && puzzles.tagDial === 5;
        return (
          <div className="puzzleWrap">
            <div className="smallText">Kadranı 5’e getir ve UV aç.</div>
            <div className="box">
              <div style={{ fontSize: 26, fontWeight: 800, textAlign: "center" }}>{puzzles.tagDial}</div>
              <div className="grid3">
                <button
                  className="btn"
                  type="button"
                  onClick={() => setPuzzles((p) => ({ ...p, tagDial: (p.tagDial + 9) % 10 }))}
                >
                  -1
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => setPuzzles((p) => ({ ...p, tagDial: (p.tagDial + 1) % 10 }))}
                >
                  +1
                </button>
                <button
                  className={`btn ${puzzles.tagUv ? "danger" : ""}`}
                  type="button"
                  onClick={() => setPuzzles((p) => ({ ...p, tagUv: !p.tagUv }))}
                >
                  UV {puzzles.tagUv ? "Açık" : "Kapalı"}
                </button>
              </div>
            </div>
            <div className="smallText">
              {puzzles.tagUv ? (puzzles.tagDial === 5 ? "Yazı beliriyor..." : "UV var ama hizalama yanlış.") : "UV kapalı"}
            </div>
            <div className="rowEnd">
              <button className="btn" onClick={closeClueModal} type="button">
                Geri
              </button>
              <button className="btn danger" onClick={() => markClueSolved("tag")} disabled={!canSolve} type="button">
                Kaydı Al
              </button>
            </div>
          </div>
        );
      }
    }
  };

  // Mobile swipe
  const handleBeachTouchStart = (e: React.TouchEvent) => {
    if (selectedClue) return;
    if ((e.target as HTMLElement).closest("button")) return;
    touchYRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleBeachTouchMove = (e: React.TouchEvent) => {
    if (selectedClue) return;
    if (touchYRef.current == null) return;
    const y = e.touches[0]?.clientY ?? touchYRef.current;
    const delta = y - touchYRef.current;
    if (Math.abs(delta) < 8) return;
    setMoveDir(delta < 0 ? 1 : -1); // yukarı kaydır = ileri
    touchYRef.current = y;
  };

  const handleBeachTouchEnd = () => {
    touchYRef.current = null;
    setMoveDir(0);
  };

  return (
    <div className="app">
      {scene === "MENU" && <MenuScene onStart={startNewRun} />}

      {scene === "INTRO" && (
        <IntroScene
          worldShakeClass={worldShakeClass}
          introStep={introStep}
          introLines={introLines}
          onAdvance={() => {
            if (introStep < introLines.length - 1) setIntroStep((s) => s + 1);
            else setScene("BEACH");
          }}
          onSkip={() => setScene("BEACH")}
        />
      )}

      {scene === "BEACH" && (
        <BeachScene
          worldShakeClass={worldShakeClass}
          inspectedCount={inspectedCount}
          pathProgressPercent={pathProgressPercent}
          redLightPhase={redLightPhase}
          onTouchStart={handleBeachTouchStart}
          onTouchMove={handleBeachTouchMove}
          onTouchEnd={handleBeachTouchEnd}
          camSwayX={camSwayX}
          camSwayY={camSwayY}
          cameraPos={cameraPos}
          moveStrength={moveStrength}
          redLightUnlocked={redLightUnlocked}
          sidePosts={sidePosts}
          relToScreen={relToScreen}
          tunnelProj={tunnelProj}
          redLampProj={redLampProj}
          clues={clues}
          interactableObject={interactableObject}
          targetHint={targetHint}
          canInspect={canInspect}
          canEnterTunnel={canEnterTunnel}
          selectedClue={selectedClue}
          moveDir={moveDir}
          tamayX={tamayX}
          tamayLift={tamayLift}
          bob={bob}
          tamayScale={tamayScale}
          stride={stride}
          onMoveDir={setMoveDir}
          onOpenClue={openClue}
          onEnterTunnel={startBeachToTunnel}
          beachHint={beachHint}
          beachObjectsSolvedList={beachObjectsSolvedList}
          journalOpen={journalOpen}
          onToggleJournal={() => setJournalOpen((v) => !v)}
        />
      )}

      {scene === "TUNNEL" && <TunnelScene worldShakeClass={worldShakeClass} onEnterDoorGame={startDoorGameFromTunnel} />}

      {scene === "DOOR_GAME" && (
        <DoorGameScene
          worldShakeClass={worldShakeClass}
          level={level}
          maxLevel={MAX_LEVEL}
          lives={lives}
          maxLives={MAX_LIVES}
          checkpointUnlocked={checkpointUnlocked}
          checkpointLevel={CHECKPOINT_LEVEL}
          doorCount={DOOR_COUNT}
          doorInputLocked={doorInputLocked}
          getDoorClassName={getDoorClassName}
          getDoorVisualLabel={getDoorVisualLabel}
          onDoorPick={handleDoorPick}
          doorHint={doorHint}
          lastOutcome={lastOutcome}
        />
      )}

      {scene === "GAME_OVER" && (
        <GameOverScene
          level={level}
          checkpointUnlocked={checkpointUnlocked}
          checkpointLevel={CHECKPOINT_LEVEL}
          onRetryFromCheckpoint={retryFromCheckpoint}
          onRetryToMenu={retryToMenu}
        />
      )}

      {scene === "WIN" && (
        <WinScene maxLevel={MAX_LEVEL} lives={lives} onStartNewRun={startNewRun} onRetryToMenu={retryToMenu} />
      )}

      {selectedClue && (
        <PuzzleModal clueLabel={objectByKey[selectedClue].label} puzzleFeedback={puzzleFeedback} onClose={closeClueModal}>
          {renderPuzzleContent()}
        </PuzzleModal>
      )}

      <div className={`fade ${fadeOn ? "on" : ""}`} />
      <div className={`hit ${hitPulse === 1 ? "on1" : hitPulse === 2 ? "on2" : ""}`} />
    </div>
  );
}
