import { useI18n } from "../i18n";

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
  const { t } = useI18n();
  return (
    <div className="centerWrap">
      <div className="bgBasic" />
      <div className="centerCard panel">
        <h2 className="title" style={{ margin: 0 }}>
          {t("gameover.title")}
        </h2>
        <div className="sub">
          {t("gameover.body")}
        </div>
        <div className="stats">
          <div className="stat">
            <div className="k">{t("gameover.reachedFloor")}</div>
            <div className="v">{level}</div>
          </div>
          <div className="stat">
            <div className="k">{t("gameover.checkpoint")}</div>
            <div className="v">
              {checkpointUnlocked
                ? t("gameover.checkpointFloor", { level: checkpointLevel })
                : t("gameover.none")}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {checkpointUnlocked && (
            <button className="btn danger wide" onClick={onRetryFromCheckpoint} type="button">
              {t("gameover.resumeCheckpoint")}
            </button>
          )}
          <button className="btn wide" onClick={onRetryToMenu} type="button">
            {t("gameover.backToMenu")}
          </button>
        </div>
      </div>
    </div>
  );
}
