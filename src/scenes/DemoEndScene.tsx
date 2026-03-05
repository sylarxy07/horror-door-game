import { useI18n } from "../i18n";

type DemoEndSceneProps = {
  onBackToMenu: () => void;
};

export function DemoEndScene({ onBackToMenu }: DemoEndSceneProps) {
  const { t } = useI18n();
  return (
    <div className="centerWrap">
      <div className="bgBasic" />
      <div className="centerCard panel demoEndCard">
        <h2 className="title" style={{ margin: 0 }}>
          {t("demo.endTitle")}
        </h2>
        <div className="sub">
          {t("demo.endBody")}
        </div>
        <button className="btn danger wide" type="button" onClick={onBackToMenu}>
          {t("demo.backToMenu")}
        </button>
      </div>
    </div>
  );
}
