import { useEffect, useState } from "react";

type WinSceneProps = {
  maxLevel: number;
  lives: number;
  onStartNewRun: () => void;
  onRetryToMenu: () => void;
};

type EndingPhase = "ELEVATOR" | "GIRL" | "CARD";

export function WinScene({ maxLevel, lives, onStartNewRun, onRetryToMenu }: WinSceneProps) {
  const [phase, setPhase] = useState<EndingPhase>("ELEVATOR");

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("GIRL"), 1800);
    const t2 = window.setTimeout(() => setPhase("CARD"), 4300);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (phase === "CARD") {
    return (
      <div className="episodeEndWrap">
        <div className="episodeEndBlack" />
        <div className="centerCard panel episodeEndCard">
          <h2 className="title" style={{ margin: 0 }}>
            {"B\u00f6l\u00fcm 1 Bitti"}
          </h2>
          <div className="sub">{"Sistem tamamlanmad\u0131. Deneme 01 kaydedildi."}</div>
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
            <button className="btn wide" onClick={onRetryToMenu} type="button">
              {"Ana Men\u00fc"}
            </button>
            <button className="btn danger wide" onClick={onStartNewRun} type="button">
              {"B\u00f6l\u00fcm 1'i Tekrarla"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="episodeEndWrap">
      <div className="episodeEndBg" />
      <div className="centerCard panel episodeEndStage">
        <div className="hudSub">{"Asans\u00f6r Hatt\u0131"}</div>
        <div className="hudTitle">{"Kap\u0131 a\u00e7\u0131ld\u0131. Koridor devam ediyor."}</div>

        <div className="episodeElevatorFrame" aria-hidden="true">
          <div className="episodeElevatorDoor episodeElevatorDoor--left" />
          <div className="episodeElevatorDoor episodeElevatorDoor--right" />
          <div className="episodeElevatorHall" />
          {phase === "GIRL" && (
            <div className="episodeGirl">
              <div className="episodeGirlHead" />
              <div className="episodeGirlBody" />
            </div>
          )}
        </div>

        <div className="hintText">
          {phase === "GIRL" ? "Bu sefer daha uzun s\u00fcrd\u00fc." : "Tamay k\u0131sa bir sessizlik duyuyor."}
        </div>
      </div>
    </div>
  );
}
