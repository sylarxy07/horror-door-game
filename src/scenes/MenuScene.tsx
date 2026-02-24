type MenuSceneProps = {
  onStart: () => void;
};

export function MenuScene({ onStart }: MenuSceneProps) {
  return (
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

        <button className="btn danger wide" onClick={onStart} type="button">
          Yeni Oyun
        </button>

        <div className="muted">
          Bu sürüm: kamera lag + güçlü yürüme hissi + foreground akış (yol değil Tamay yürüyor hissi için)
        </div>
      </div>
    </div>
  );
}
