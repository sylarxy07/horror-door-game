type TunnelSceneProps = {
  worldShakeClass: string;
  onEnterDoorGame: () => void;
};

export function TunnelScene({ worldShakeClass, onEnterDoorGame }: TunnelSceneProps) {
  return (
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

            <button className="metalDoor" type="button" onClick={onEnterDoorGame}>
              <div className="pill" style={{ background: "rgba(8,11,16,.45)" }}>
                Metal Kapı
              </div>
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
  );
}
