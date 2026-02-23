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
      {/* MENU */}
      {scene === "MENU" && (
        <div className="menuWrap">
          <div className="menuBg" />
          <div className="menuCard panel">
            <div>
              <h1 className="title">KORFER: Kapılar</h1>
              <div className="sub">
                Tamay sahilde uyanır. Sis, kırmızı ışık ve kapılar onu aynı yere çağırır.
                Önce denek izlerini topla, sonra 10 katlık kapı düzenini çöz.
              </div>
            </div>

            <div className="preview">
              <div className="red" />
              <div className="door" />
            </div>

            <button className="btn danger wide" onClick={startNewRun} type="button">
              Yeni Oyun
            </button>

            <div className="muted">
              Bu sürüm: kamera lag + güçlü yürüme hissi + foreground akış (yol değil Tamay yürüyor hissi için)
            </div>
          </div>
        </div>
      )}

      {/* INTRO */}
      {scene === "INTRO" && (
        <div className="screen">
          <main className={`world introStage ${worldShakeClass}`}>
            <div className="worldSurface">
              <div className="introArt" />
              <div className="introFog" />
              <div
                style={{
                  position: "absolute",
                  top: "20%",
                  right: "14%",
                  width: 11,
                  height: 11,
                  borderRadius: "50%",
                  background: "#ff2a2a",
                  zIndex: 2,
                  boxShadow: "0 0 12px rgba(255,42,42,.45)",
                  animation: "blink 1.1s infinite",
                }}
              />
              <div className="introBox">
                <div className="hintLabel">Giriş</div>
                <div className="hintText" style={{ minHeight: 40 }}>{introLines[introStep]}</div>
                <div className="rowEnd">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      if (introStep < introLines.length - 1) setIntroStep((s) => s + 1);
                      else setScene("BEACH");
                    }}
                  >
                    {introStep < introLines.length - 1 ? "Devam" : "Sahile Geç"}
                  </button>
                  {introStep < introLines.length - 1 && (
                    <button className="btn" type="button" onClick={() => setScene("BEACH")}>
                      Atla
                    </button>
                  )}
                </div>
              </div>
            </div>
          </main>

          <footer className="panel hint">
            <div className="hintLabel">Not</div>
            <div className="hintText">
              Bu versiyonda sahil hareketi “kamera kayması”ndan çıkıp “Tamay yürüyüşü” gibi hissettirmesi için düzenlendi.
            </div>
          </footer>
        </div>
      )}

      {/* BEACH */}
      {scene === "BEACH" && (
        <div className="screen">
          <header className="panel hud">
            <div>
              <div className="hudSub">Sahil Yolu</div>
              <div className="hudTitle">Arkadan Kamera Keşif</div>
            </div>
            <div className="pills">
              <div className="pill">{inspectedCount}/5 İpucu</div>
              <div className={`pill ${pathProgressPercent >= 100 ? "good" : ""}`}>Yol %{pathProgressPercent}</div>
              <div className={`pill ${redLightPhase === "READY" ? "red" : ""}`}>
                {redLightPhase === "READY" ? "Kırmızı Işık Aktif" : "Işık Pasif"}
              </div>
            </div>
          </header>

          <main
            className={`world ${worldShakeClass}`}
            aria-label="Arkadan kamera sahil yürüyüş yolu"
            onTouchStart={handleBeachTouchStart}
            onTouchMove={handleBeachTouchMove}
            onTouchEnd={handleBeachTouchEnd}
            onTouchCancel={handleBeachTouchEnd}
          >
            <div
              className="worldSurface"
              style={{
                transform: `translate(${camSwayX}px, ${camSwayY}px)`,
              }}
            >
              <div
                className="beachSky"
                style={{ transform: `translateY(${cameraPos * 0.02}px)` }}
              />
              <div
                className="beachHorizonGlow"
                style={{ transform: `translateY(${cameraPos * 0.015}px)` }}
              />
              <div
                className="seaBands"
                style={{ transform: `translateY(${cameraPos * 0.06}px)` }}
              />

              <div className="beachPerspective">
                <div
                  className="walkway"
                  style={{ transform: `translateX(-50%) rotateX(63deg) translateY(${moveStrength * 2}px)` }}
                />
                <div className="walkwayEdgeL" />
                <div className="walkwayEdgeR" />

                <div
                  className="horizonRedDot"
                  style={{
                    opacity: redLightUnlocked ? 1 : 0.45,
                    transform: `translateX(-50%) scale(${redLightUnlocked ? 1.1 : 0.9})`,
                  }}
                />

                {/* foreground side posts => strong forward motion cue */}
                {sidePosts.map((post, idx) => {
                  const p = relToScreen(post.pos, post.lane);
                  if (!p.visible) return null;
                  if (p.t < 0.1) return null; // çok uzaksa çizme
                  const w = Math.max(3, 5 * p.scale);
                  const h = Math.max(8, (18 + post.heightBias * 5) * p.scale);
                  const shadowW = Math.max(10, 18 * p.scale);

                  return (
                    <React.Fragment key={`post-${idx}`}>
                      <div
                        className="sidePostShadow"
                        style={{
                          left: `${p.x}%`,
                          top: `${p.y + 2.2}%`,
                          width: `${shadowW}px`,
                          height: `${Math.max(4, 7 * p.scale)}px`,
                          transform: "translate(-50%,-50%)",
                          opacity: p.opacity * 0.6,
                        }}
                      />
                      <div
                        className="sidePost"
                        style={{
                          left: `${p.x}%`,
                          top: `${p.y}%`,
                          width: `${w}px`,
                          height: `${h}px`,
                          transform: "translate(-50%,-100%)",
                          opacity: p.opacity * 0.85,
                        }}
                      >
                        <div
                          className="sidePostCap"
                          style={{
                            top: `${Math.max(-2, -1 * p.scale)}px`,
                            width: `${Math.max(5, w * 1.8)}px`,
                            height: `${Math.max(2, 2.2 * p.scale)}px`,
                            opacity: 0.6,
                          }}
                        />
                      </div>
                    </React.Fragment>
                  );
                })}

                {/* tunnel portal */}
                {tunnelProj.visible && (
                  <div
                    className={`tunnelPortalWorld ${redLightUnlocked ? "active" : ""}`}
                    style={{
                      left: `${tunnelProj.x}%`,
                      top: `${tunnelProj.y}%`,
                      width: `${32 * tunnelProj.scale}px`,
                      height: `${42 * tunnelProj.scale}px`,
                      transform: "translate(-50%,-50%)",
                      opacity: tunnelProj.opacity,
                    }}
                  />
                )}

                {redLampProj.visible && redLightUnlocked && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${redLampProj.x}%`,
                      top: `${Math.max(12, redLampProj.y - 4)}%`,
                      width: `${8 * redLampProj.scale}px`,
                      height: `${8 * redLampProj.scale}px`,
                      borderRadius: "50%",
                      background: "#ff2a2a",
                      boxShadow: "0 0 14px rgba(255,42,42,.45)",
                      transform: "translate(-50%,-50%)",
                      zIndex: 9,
                      opacity: redLampProj.opacity,
                      animation: "blink 1.1s infinite",
                    }}
                  />
                )}

                {/* path objects */}
                {pathObjects.map((obj) => {
                  const p = relToScreen(obj.pos, obj.lane);
                  if (!p.visible) return null;

                  const isSolved = clues[obj.key];
                  const isCurrent = interactableObject?.key === obj.key;
                  const size = 18 * p.scale;

                  return (
                    <React.Fragment key={obj.key}>
                      <div
                        className={`worldMarker ${isSolved ? "solved" : ""} ${isCurrent ? "current" : ""}`}
                        style={{
                          left: `${p.x}%`,
                          top: `${p.y}%`,
                          width: `${size}px`,
                          height: `${size}px`,
                          transform: "translate(-50%,-50%)",
                          opacity: p.opacity,
                          fontSize: `${Math.max(9, 9 * p.scale)}px`,
                        }}
                      >
                        {isSolved ? "✓" : obj.icon}
                      </div>
                      <div
                        className="worldMarkerLabel"
                        style={{
                          left: `${p.x}%`,
                          top: `${p.y - 1.2}%`,
                          opacity: p.opacity,
                          fontSize: `${Math.max(9, 9.5 * p.scale)}px`,
                        }}
                      >
                        {obj.label}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              <div
                className="fogLayer"
                style={{ transform: `translateX(${cameraPos * 0.03}px)` }}
              />

              <div className="beachOverlay">
                <div className="goalBeacon">
                  <span className="goalDot" />
                  <span className="goalArrow">↑</span>
                  <span>{targetHint}</span>
                </div>

                {canInspect && interactableObject && (
                  <div className="interactPop">
                    {interactableObject.label} yakınında — <b>E</b> / İncele
                  </div>
                )}

                {canEnterTunnel && (
                  <div
                    className="interactPop"
                    style={{ bottom: 138, borderColor: "rgba(255,60,70,.20)" }}
                  >
                    Kırmızı ışık aktif — <b>E</b> / Tünele Gir
                  </div>
                )}
              </div>

              {/* Tamay */}
              <div
                className={`tamayRig ${moveDir !== 0 && !selectedClue ? "walking" : ""}`}
                style={{
                  transform: `translate(calc(-50% + ${tamayX.toFixed(2)}px), calc(${tamayLift + bob}px)) scale(${tamayScale})`,
                }}
              >
                <div
                  className="shadow"
                  style={{
                    width: `${92 + Math.abs(stride) * 4}px`,
                    opacity: 0.65 - moveStrength * 0.08,
                  }}
                />
                <div className="legL" />
                <div className="legR" />
                <div className="torso" />
                <div className="shoulderL" />
                <div className="shoulderR" />
                <div className="armL" />
                <div className="armR" />
                <div className="hood" />
                <div className="hair" />
              </div>

              <div className="beachControls">
                <div className="pad">
                  <button
                    className="moveBtn"
                    type="button"
                    title="İleri"
                    onPointerDown={() => !selectedClue && setMoveDir(1)}
                    onPointerUp={() => setMoveDir(0)}
                    onPointerLeave={() => setMoveDir(0)}
                    onPointerCancel={() => setMoveDir(0)}
                  >
                    ↑
                  </button>
                  <button
                    className="moveBtn"
                    type="button"
                    title="Geri"
                    onPointerDown={() => !selectedClue && setMoveDir(-1)}
                    onPointerUp={() => setMoveDir(0)}
                    onPointerLeave={() => setMoveDir(0)}
                    onPointerCancel={() => setMoveDir(0)}
                  >
                    ↓
                  </button>
                </div>

                <div className="beachActionCol">
                  <div className="miniBadge">Klavye: W/S veya ↑/↓ • E: İncele / Tünel</div>
                  <div className="miniBadge">Mobil: ↑↓ tuşları veya yukarı/aşağı kaydır</div>

                  {canInspect && interactableObject && (
                    <button className="btn" type="button" onClick={() => openClue(interactableObject.key)}>
                      İncele ({interactableObject.label})
                    </button>
                  )}

                  {canEnterTunnel && (
                    <button className="btn danger" type="button" onClick={startBeachToTunnel}>
                      Tünele Gir
                    </button>
                  )}
                </div>
              </div>
            </div>
          </main>

          <footer className="panel hint">
            <div className="hintLabel">İç Ses</div>
            <div className="hintText">{beachHint}</div>

            <div className="journalBtnRow">
              <div className="muted">
                Toplanan kayıtlar: {beachObjectsSolvedList.length ? beachObjectsSolvedList.join(" • ") : "Henüz yok"}
              </div>
              <button className="btn ghost" type="button" onClick={() => setJournalOpen((v) => !v)}>
                {journalOpen ? "Günlüğü Gizle" : "Günlüğü Aç"}
              </button>
            </div>

            {journalOpen && (
              <>
                <div className="divider" />
                <div className="journalGrid">
                  {pathObjects.map((o) => (
                    <div className={`journalItem ${clues[o.key] ? "done" : ""}`} key={o.key}>
                      <div className="journalLabel">{o.icon} {o.label}</div>
                      <div className="journalState">{clues[o.key] ? "Çözüldü" : "Bulunmadı / Çözülmedi"}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </footer>
        </div>
      )}

      {/* TUNNEL */}
      {scene === "TUNNEL" && (
        <div className="screen">
          <header className="panel hud">
            <div>
              <div className="hudSub">Geçiş</div>
              <div className="hudTitle">Servis Tüneli</div>
            </div>
            <div className="pills">
              <div className="pill red">Kırmızı Işık</div>
              <div className="pill">Tek Kapı</div>
            </div>
          </header>

          <main className={`world ${worldShakeClass}`} aria-label="Tünel">
            <div className="worldSurface">
              <div className="tunnelBg" />
              <div className="tunnelPerspective">
                <div className="wallL" />
                <div className="wallR" />
                <div className="tunnelCeil" />
                <div className="tunnelFloor" />
                <div className="redLamp" />

                <button className="metalDoor" type="button" onClick={startDoorGameFromTunnel}>
                  <div className="pill" style={{ background: "rgba(8,11,16,.45)" }}>Metal Kapı</div>
                </button>

                <div className="tunnelPlayer">
                  <div className="shoulders" />
                  <div className="hood" />
                  <div className="hair" />
                </div>
              </div>

              <div className="fogLayer" />
            </div>
          </main>

          <footer className="panel hint">
            <div className="hintLabel">İç Ses</div>
            <div className="hintText">
              Beton servis geçidi. Kırmızı ışık burada çağrı işaretinden çok bir göz gibi.
            </div>
          </footer>
        </div>
      )}

      {/* DOOR GAME */}
      {scene === "DOOR_GAME" && (
        <div className="screen">
          <header className="panel hud">
            <div>
              <div className="hudSub">Deneme</div>
              <div className="hudTitle">Kat {level} / {MAX_LEVEL}</div>
            </div>
            <div className="pills">
              <div className="pill">Can {lives}/{MAX_LIVES}</div>
              <div className="pill">{checkpointUnlocked ? `Checkpoint: ${CHECKPOINT_LEVEL}` : "Checkpoint Kapalı"}</div>
            </div>
          </header>

          <main className={`world ${worldShakeClass}`}>
            <div className="worldSurface">
              <div className="gameBg" />
              <div className="roomPerspective">
                <div className="roomWallL" />
                <div className="roomWallR" />
                <div className="roomBackWall" />
                <div className="roomFloor" />
                <div className="fogLayer" />

                <div className="doorsWall">
                  {Array.from({ length: DOOR_COUNT }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={getDoorClassName(i)}
                      onClick={() => handleDoorPick(i)}
                      disabled={doorInputLocked}
                    >
                      <div className="doorLabel">{getDoorVisualLabel(i)}</div>
                    </button>
                  ))}
                </div>

                <div className="playerShoulderOverlay" />
              </div>
            </div>
          </main>

          <footer className="panel hint">
            <div className="hintLabel">Durum</div>
            <div className="hintText">{doorHint}</div>
            <div className="muted">
              1 doğru kapı • 1 lanet kapı (-2 can) • 3 yanlış kapı (-1 can)
              {lastOutcome && (
                <>
                  {" "}• Son seçim:{" "}
                  {lastOutcome === "SAFE" ? "Doğru" : lastOutcome === "CURSE" ? "Lanet" : "Yanlış"}
                </>
              )}
            </div>
          </footer>
        </div>
      )}

      {/* GAME OVER */}
      {scene === "GAME_OVER" && (
        <div className="centerWrap">
          <div className="bgBasic" />
          <div className="centerCard panel">
            <h2 className="title" style={{ margin: 0 }}>Deneme Sonlandı</h2>
            <div className="sub">
              Tamay kapı düzenini çözemedi. Sis geri çekilmiyor. Işık hâlâ çağırıyor.
            </div>
            <div className="stats">
              <div className="stat">
                <div className="k">Ulaşılan Kat</div>
                <div className="v">{level}</div>
              </div>
              <div className="stat">
                <div className="k">Checkpoint</div>
                <div className="v">{checkpointUnlocked ? `Kat ${CHECKPOINT_LEVEL}` : "Yok"}</div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {checkpointUnlocked && (
                <button className="btn danger wide" onClick={retryFromCheckpoint} type="button">
                  Checkpointten Devam Et
                </button>
              )}
              <button className="btn wide" onClick={retryToMenu} type="button">
                Ana Menüye Dön
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WIN */}
      {scene === "WIN" && (
        <div className="centerWrap">
          <div className="bgBasic" />
          <div className="centerCard panel">
            <h2 className="title" style={{ margin: 0 }}>Hayatta Kaldın</h2>
            <div className="sub">
              Onuncu katın kapısı açıldı. Ama koridorun sesi kesilmedi. Bu çıkış mı, yeni bir giriş mi henüz belli değil.
            </div>
            <div className="stats">
              <div className="stat">
                <div className="k">Tamamlanan Kat</div>
                <div className="v">{MAX_LEVEL}</div>
              </div>
              <div className="stat">
                <div className="k">Kalan Can</div>
                <div className="v">{lives}</div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <button className="btn danger wide" onClick={startNewRun} type="button">
                Yeniden Oyna
              </button>
              <button className="btn wide" onClick={retryToMenu} type="button">
                Ana Menü
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Puzzle Modal */}
      {selectedClue && (
        <div className="modalBack" onClick={closeClueModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div style={{ fontWeight: 800 }}>{objectByKey[selectedClue].label}</div>
              <button className="btn" onClick={closeClueModal} type="button">
                Kapat
              </button>
            </div>
            <div className="modalBody">
              {renderPuzzleContent()}
              {puzzleFeedback && <div className="feedback">{puzzleFeedback}</div>}
            </div>
          </div>
        </div>
      )}

      <div className={`fade ${fadeOn ? "on" : ""}`} />
      <div className={`hit ${hitPulse === 1 ? "on1" : hitPulse === 2 ? "on2" : ""}`} />
    </div>
  );
}
