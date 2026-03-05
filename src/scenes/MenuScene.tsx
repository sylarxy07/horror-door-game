import { useState, useEffect } from "react";
import { useI18n } from "../i18n";

type MenuSceneProps = {
  onStart: () => void;
};

type SettingsTab = "VIDEO" | "AUDIO" | "LANG";

export function MenuScene({ onStart }: MenuSceneProps) {
  const { currentLang, setLang, t } = useI18n();
  const [panel, setPanel] = useState<"MAIN" | "SETTINGS">("MAIN");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("VIDEO");
  const [mounted, setMounted] = useState(false);

  const [videoQuality, setVideoQuality] = useState<"LOW" | "MEDIUM" | "HIGH">("HIGH");
  const [brightness, setBrightness] = useState(50);

  const [masterVolume, setMasterVolume] = useState(70);
  const [ambienceVolume, setAmbienceVolume] = useState(80);
  const [sfxVolume, setSfxVolume] = useState(80);

  const [subtitlesOn, setSubtitlesOn] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const menuItems = [
    { label: t("menu.newGame"), id: "new-game", action: onStart, variant: "primary" },
    { label: t("menu.continue"), id: "continue", action: null, variant: "ghost", disabled: true },
    { label: t("menu.settings"), id: "settings", action: () => setPanel("SETTINGS"), variant: "ghost" },
  ];

  const renderMainPanel = () => (
    <div className={`menuMobileLayout ${mounted ? "menuMounted" : ""}`}>
      {/* Full-screen atmospheric art background */}
      <div className="menuSceneArt" aria-hidden="true">
        <div className="menuSceneFog menuSceneFog1" />
        <div className="menuSceneFog menuSceneFog2" />
        <div className="menuSceneFog menuSceneFog3" />
        <div className="menuSceneScanlines" />
        <div className="menuSceneBeam" />

        <div className="menuSceneFloor" />
        <div className="menuSceneEyes">
          <div className="menuSceneEye menuSceneEye--l" />
          <div className="menuSceneEye menuSceneEye--r" />
        </div>
        <div className="menuSceneBottomFog" />
      </div>

      {/* Noise overlay */}
      <div className="menuNoise" />

      <div style={{ position: "fixed", top: 12, right: 12, zIndex: 8 }}>
        <select
          aria-label={t("menu.languageLabel")}
          value={currentLang}
          onChange={(e) => setLang(e.target.value as typeof currentLang)}
          style={{
            minHeight: 36,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.24)",
            background: "rgba(8,12,18,.84)",
            color: "#eef2fb",
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 10px",
          }}
        >
          <option value="tr">{t("menu.lang.tr")}</option>
          <option value="en">{t("menu.lang.en")}</option>
          <option value="de">{t("menu.lang.de")}</option>
          <option value="ru">{t("menu.lang.ru")}</option>
        </select>
      </div>

      {/* Gradient overlay: ust ve alt icerik alanlarini okunakli kilar */}
      <div className="menuMobileOverlay" />

      {/* Top: Logo */}
      <div className="menuMobileTop">
        <div className="menuLogoEyebrow">{t("menu.logoEyebrow")}</div>
        <h1 className="menuLogo">
          <span className="menuLogoLine1">NOSCAPE</span>
        </h1>
        <div className="menuLogoDivider">
          <span className="menuLogoDividerLine" />
          <span className="menuLogoDividerDot" />
          <span className="menuLogoDividerLine" />
        </div>
        <p className="menuTagline">{t("menu.tagline")}</p>
      </div>

      {/* Bottom: Nav buttons + Footer */}
      <div className="menuMobileBottom">
        <nav className="menuNav" aria-label={t("menu.mainNavAria")}>
          {menuItems.map((item, i) => (
            <button
              key={item.id}
              id={item.id}
              type="button"
              className={`menuNavBtn menuNavBtn--${item.variant} ${mounted ? "menuNavBtnVisible" : ""}`}
              style={{ animationDelay: `${i * 90 + 180}ms` }}
              onClick={item.action ?? undefined}
              disabled={item.disabled}
              aria-disabled={item.disabled}
            >
              <span className="menuNavBtnBar" />
              <span className="menuNavBtnLabel">{item.label}</span>
              {item.variant === "primary" && <span className="menuNavBtnArrow">{"\u203a"}</span>}
            </button>
          ))}
        </nav>

        <div className="menuFooter">
          <span className="menuFooterBadge">v0.1 BETA</span>
          <span className="menuFooterSep">{"\u00b7"}</span>
          <span className="menuFooterText">NOSCAPE</span>
        </div>
      </div>
    </div>
  );

  const renderSettingsPanel = () => (
    <div className={`menuSettingsLayout ${mounted ? "menuMounted" : ""}`}>
      <div className="menuNoise" />

      {/* Header */}
      <div className="settingsTopBar">
        <button
          id="settings-back"
          className="settingsBackBtn"
          type="button"
          onClick={() => setPanel("MAIN")}
        >
          <span className="settingsBackArrow">{"\u2190"}</span>
          <span>{t("menu.settingsBack")}</span>
        </button>
        <div className="settingsTitle">
          <span className="settingsTitleAccent">{"\u2014"}</span> {t("menu.settingsTitle")}{" "}
          <span className="settingsTitleAccent">{"\u2014"}</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="settingsTabBar" role="tablist" aria-label={t("menu.settingsTabs")}>
        {(["VIDEO", "AUDIO", "LANG"] as SettingsTab[]).map((tab) => {
          const labels: Record<SettingsTab, string> = {
            VIDEO: t("menu.tab.video"),
            AUDIO: t("menu.tab.audio"),
            LANG: t("menu.tab.lang"),
          };
          const icons: Record<SettingsTab, string> = {
            VIDEO: "\u25c8",
            AUDIO: "\u25ce",
            LANG: "\u25c9",
          };
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={settingsTab === tab}
              className={`settingsTabBtn ${settingsTab === tab ? "settingsTabBtn--active" : ""}`}
              onClick={() => setSettingsTab(tab)}
            >
              <span className="settingsTabIcon">{icons[tab]}</span>
              <span>{labels[tab]}</span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="settingsPanelBody">
        {settingsTab === "VIDEO" && (
          <div className="settingsGroup">
            <div className="settingsRow">
              <label className="settingsRowLabel" htmlFor="video-quality">
                {t("menu.videoQuality")}
              </label>
              <select
                id="video-quality"
                className="settingsSelect"
                value={videoQuality}
                onChange={(e) => setVideoQuality(e.target.value as "LOW" | "MEDIUM" | "HIGH")}
              >
                <option value="LOW">{t("menu.quality.low")}</option>
                <option value="MEDIUM">{t("menu.quality.medium")}</option>
                <option value="HIGH">{t("menu.quality.high")}</option>
              </select>
            </div>

            <div className="settingsRow settingsRow--slider">
              <div className="settingsRowTop">
                <label className="settingsRowLabel" htmlFor="brightness-slider">
                  {t("menu.brightness")}
                </label>
                <span className="settingsRowValue">{brightness}</span>
              </div>
              <div className="settingsSliderTrack">
                <input
                  id="brightness-slider"
                  type="range"
                  min={0}
                  max={100}
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="settingsSlider"
                  style={{ "--val": `${brightness}%` } as React.CSSProperties}
                />
              </div>
            </div>
          </div>
        )}

        {settingsTab === "AUDIO" && (
          <div className="settingsGroup">
            {[
              { id: "master-vol", label: t("menu.masterVolume"), value: masterVolume, set: setMasterVolume },
              { id: "ambience-vol", label: t("menu.ambienceVolume"), value: ambienceVolume, set: setAmbienceVolume },
              { id: "sfx-vol", label: t("menu.sfxVolume"), value: sfxVolume, set: setSfxVolume },
            ].map((s) => (
              <div key={s.id} className="settingsRow settingsRow--slider">
                <div className="settingsRowTop">
                  <label className="settingsRowLabel" htmlFor={s.id}>
                    {s.label}
                  </label>
                  <span className="settingsRowValue">{s.value}</span>
                </div>
                <div className="settingsSliderTrack">
                  <input
                    id={s.id}
                    type="range"
                    min={0}
                    max={100}
                    value={s.value}
                    onChange={(e) => s.set(Number(e.target.value))}
                    className="settingsSlider"
                    style={{ "--val": `${s.value}%` } as React.CSSProperties}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {settingsTab === "LANG" && (
          <div className="settingsGroup">
            <div className="settingsRow">
              <label className="settingsRowLabel" htmlFor="lang-select">
                {t("menu.languageLabel")}
              </label>
              <select
                id="lang-select"
                className="settingsSelect"
                value={currentLang}
                onChange={(e) => setLang(e.target.value as typeof currentLang)}
              >
                <option value="tr">{t("menu.lang.tr")}</option>
                <option value="en">{t("menu.lang.en")}</option>
                <option value="de">{t("menu.lang.de")}</option>
                <option value="ru">{t("menu.lang.ru")}</option>
              </select>
            </div>

            <div className="settingsRow">
              <label className="settingsCheckRow" htmlFor="subtitles-toggle">
                <input
                  id="subtitles-toggle"
                  type="checkbox"
                  className="settingsCheckbox"
                  checked={subtitlesOn}
                  onChange={(e) => setSubtitlesOn(e.target.checked)}
                />
                <span className="settingsCheckMark" />
                <span className="settingsRowLabel">{t("menu.subtitles")}</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="menuWrap">
      <div className="menuBg" />
      {panel === "MAIN" ? renderMainPanel() : renderSettingsPanel()}
    </div>
  );
}
