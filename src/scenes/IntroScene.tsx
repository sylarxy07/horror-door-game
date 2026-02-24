type IntroSceneProps = {
  worldShakeClass: string;
  introStep: number;
  introLines: string[];
  onAdvance: () => void;
  onSkip: () => void;
};

export function IntroScene({ worldShakeClass, introStep, introLines, onAdvance, onSkip }: IntroSceneProps) {
  const isLastStep = introStep >= introLines.length - 1;

  return (
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
            <div className="hintText" style={{ minHeight: 40 }}>
              {introLines[introStep]}
            </div>
            <div className="rowEnd">
              <button className="btn" type="button" onClick={onAdvance}>
                {isLastStep ? "Sahile Geç" : "Devam"}
              </button>
              {!isLastStep && (
                <button className="btn" type="button" onClick={onSkip}>
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
  );
}
