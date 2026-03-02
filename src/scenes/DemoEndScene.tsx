type DemoEndSceneProps = {
  onBackToMenu: () => void;
};

export function DemoEndScene({ onBackToMenu }: DemoEndSceneProps) {
  return (
    <div className="centerWrap">
      <div className="bgBasic" />
      <div className="centerCard panel demoEndCard">
        <h2 className="title" style={{ margin: 0 }}>
          Bölüm 1 Demo Bitti
        </h2>
        <div className="sub">Kapı mekanizması çözüldü. Bir sonraki bölümde devam edecek.</div>
        <button className="btn danger wide" type="button" onClick={onBackToMenu}>
          Ana Menü
        </button>
      </div>
    </div>
  );
}
