type WinSceneProps = {
  maxLevel: number;
  lives: number;
  onStartNewRun: () => void;
  onRetryToMenu: () => void;
};

export function WinScene({ maxLevel, lives, onStartNewRun, onRetryToMenu }: WinSceneProps) {
  return (
    <div className="centerWrap">
      <div className="bgBasic" />
      <div className="centerCard panel">
        <h2 className="title" style={{ margin: 0 }}>
          Hayatta Kaldın
        </h2>
        <div className="sub">
          Onuncu katın kapısı açıldı. Ama koridorun sesi kesilmedi. Bu çıkış mı, yeni bir giriş mi henüz belli değil.
        </div>
        <div className="stats">
          <div className="stat">
            <div className="k">Tamamlanan Kat</div>
            <div className="v">{maxLevel}</div>
          </div>
          <div className="stat">
            <div className="k">Kalan Can</div>
            <div className="v">{lives}</div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <button className="btn danger wide" onClick={onStartNewRun} type="button">
            Yeniden Oyna
          </button>
          <button className="btn wide" onClick={onRetryToMenu} type="button">
            Ana Menü
          </button>
        </div>
      </div>
    </div>
  );
}
