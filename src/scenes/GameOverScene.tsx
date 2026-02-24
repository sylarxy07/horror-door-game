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
          Deneme Sonlandı
        </h2>
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
            Ana Menüye Dön
          </button>
        </div>
      </div>
    </div>
  );
}
