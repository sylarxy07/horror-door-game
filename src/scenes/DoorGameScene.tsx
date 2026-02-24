type DoorGameSceneProps = {
  worldShakeClass: string;
  level: number;
  maxLevel: number;
  lives: number;
  maxLives: number;
  checkpointUnlocked: boolean;
  checkpointLevel: number;
  doorCount: number;
  doorInputLocked: boolean;
  getDoorClassName: (index: number) => string;
  getDoorVisualLabel: (index: number) => string;
  onDoorPick: (index: number) => void;
  doorHint: string;
  lastOutcome: "SAFE" | "MONSTER" | "CURSE" | null;
};

export function DoorGameScene({
  worldShakeClass,
  level,
  maxLevel,
  lives,
  maxLives,
  checkpointUnlocked,
  checkpointLevel,
  doorCount,
  doorInputLocked,
  getDoorClassName,
  getDoorVisualLabel,
  onDoorPick,
  doorHint,
  lastOutcome,
}: DoorGameSceneProps) {
  return (
    <div className="screen">
      <header className="panel hud">
        <div>
          <div className="hudSub">Deneme</div>
          <div className="hudTitle">
            Kat {level} / {maxLevel}
          </div>
        </div>
        <div className="pills">
          <div className="pill">
            Can {lives}/{maxLives}
          </div>
          <div className="pill">{checkpointUnlocked ? `Checkpoint: ${checkpointLevel}` : "Checkpoint Kapalı"}</div>
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
              {Array.from({ length: doorCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={getDoorClassName(i)}
                  onClick={() => onDoorPick(i)}
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
              {" "}
              • Son seçim: {lastOutcome === "SAFE" ? "Doğru" : lastOutcome === "CURSE" ? "Lanet" : "Yanlış"}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
