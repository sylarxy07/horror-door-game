import { useEffect, useState } from "react";
import { useI18n } from "../i18n";

type WinSceneProps = {
  maxLevel: number;
  lives: number;
  onStartNewRun: () => void;
  onRetryToMenu: () => void;
};

type EndingPhase = "ELEVATOR" | "GIRL" | "CARD";

export function WinScene({ maxLevel, lives, onStartNewRun, onRetryToMenu }: WinSceneProps) {
  const { t } = useI18n();
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
            {t("win.cardTitle")}
          </h2>
          <div className="sub">{t("win.cardSub")}</div>
          <div className="stats">
            <div className="stat">
              <div className="k">{t("win.completedFloor")}</div>
              <div className="v">{maxLevel}</div>
            </div>
            <div className="stat">
              <div className="k">{t("win.remainingLives")}</div>
              <div className="v">{lives}</div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <button className="btn wide" onClick={onRetryToMenu} type="button">
              {t("win.backToMenu")}
            </button>
            <button className="btn danger wide" onClick={onStartNewRun} type="button">
              {t("win.retryEpisode")}
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
        <div className="hudSub">{t("win.elevatorLine")}</div>
        <div className="hudTitle">{t("win.elevatorTitle")}</div>

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
          {phase === "GIRL" ? t("win.hintGirl") : t("win.hintSilent")}
        </div>
      </div>
    </div>
  );
}
