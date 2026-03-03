type DemoEndSceneProps = {
  onBackToMenu: () => void;
};

export function DemoEndScene({ onBackToMenu }: DemoEndSceneProps) {
  return (
    <div className="centerWrap">
      <div className="bgBasic" />
      <div className="centerCard panel demoEndCard">
        <h2 className="title" style={{ margin: 0 }}>
          {"B\u00f6l\u00fcm 1 Demo Bitti"}
        </h2>
        <div className="sub">
          {"Kap\u0131 mekanizmas\u0131 \u00e7\u00f6z\u00fcld\u00fc. Bir sonraki b\u00f6l\u00fcmde devam edecek."}
        </div>
        <button className="btn danger wide" type="button" onClick={onBackToMenu}>
          {"Ana Men\u00fc"}
        </button>
      </div>
    </div>
  );
}
