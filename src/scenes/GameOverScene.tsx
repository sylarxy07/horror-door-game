type GameOverSceneProps = {
  level: number;
  checkpointUnlocked: boolean;
  checkpointLevel: number;
  onRetryFromCheckpoint: () => void;
  onRetryToMenu: () => void;
};

export function GameOverScene({
  level,
  checkpointUnlocked,
  checkpointLevel,
  onRetryFromCheckpoint,
  onRetryToMenu,
}: GameOverSceneProps) {
  return (
    <div className="centerWrap">
      <div className="bgBasic" />
      <div className="centerCard panel">
        <h2 className="title" style={{ margin: 0 }}>
          {"Deneme Sonland\u0131"}
        </h2>
        <div className="sub">
          {"Tamay kap\u0131 d\u00fczenini \u00e7\u00f6zemedi. Sis geri \u00e7ekilmiyor. I\u015f\u0131k h\u00e2l\u00e2 \u00e7a\u011f\u0131r\u0131yor."}
        </div>
        <div className="stats">
          <div className="stat">
            <div className="k">{"Ula\u015f\u0131lan Kat"}</div>
            <div className="v">{level}</div>
          </div>
          <div className="stat">
            <div className="k">Checkpoint</div>
            <div className="v">{checkpointUnlocked ? `Kat ${checkpointLevel}` : "Yok"}</div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {checkpointUnlocked && (
            <button className="btn danger wide" onClick={onRetryFromCheckpoint} type="button">
              Checkpointten Devam Et
            </button>
          )}
          <button className="btn wide" onClick={onRetryToMenu} type="button">
            {"Ana Men\u00fcye D\u00f6n"}
          </button>
        </div>
      </div>
    </div>
  );
}
