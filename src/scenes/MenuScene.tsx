import { useState, useEffect } from "react";

type MenuSceneProps = {
  onStart: () => void;
};

type SettingsTab = "VIDEO" | "AUDIO" | "LANG";

export function MenuScene({ onStart }: MenuSceneProps) {
  const [panel, setPanel] = useState<"MAIN" | "SETTINGS">("MAIN");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("VIDEO");
  const [mounted, setMounted] = useState(false);

  const [videoQuality, setVideoQuality] = useState<"LOW" | "MEDIUM" | "HIGH">("HIGH");
  const [brightness, setBrightness] = useState(50);

  const [masterVolume, setMasterVolume] = useState(70);
  const [ambienceVolume, setAmbienceVolume] = useState(80);
  const [sfxVolume, setSfxVolume] = useState(80);

  const [language, setLanguage] = useState<"tr" | "en">("tr");
  const [subtitlesOn, setSubtitlesOn] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const menuItems = [
    { label: "Yeni Oyun", id: "new-game", action: onStart, variant: "primary" },
    { label: "Devam", id: "continue", action: null, variant: "ghost", disabled: true },
    { label: "Ayarlar", id: "settings", action: () => setPanel("SETTINGS"), variant: "ghost" },
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

      {/* Gradient overlay — üst ve alt içerik alanlarını okunaklı kılar */}
      <div className="menuMobileOverlay" />

      {/* Top: Logo */}
      <div className="menuMobileTop">
        <div className="menuLogoEyebrow">— KAÇIŞ YOK —</div>
        <h1 className="menuLogo">
        <span className="menuLogoLine1">NOSCAPE</span>
          
          
        </h1>
        <div className="menuLogoDivider">
          <span className="menuLogoDividerLine" />
          <span className="menuLogoDividerDot" />
          <span className="menuLogoDividerLine" />
        </div>
        <p className="menuTagline">The Doors Never Forget</p>
      </div>

      {/* Bottom: Nav buttons + Footer */}
      <div className="menuMobileBottom">
        <nav className="menuNav" aria-label="Ana menü">
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
              {item.variant === "primary" && (
                <span className="menuNavBtnArrow">›</span>
              )}
            </button>
          ))}
        </nav>

        <div className="menuFooter">
          <span className="menuFooterBadge">v0.1 BETA</span>
          <span className="menuFooterSep">·</span>
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
          <span className="settingsBackArrow">←</span>
          <span>Ana Menü</span>
        </button>
        <div className="settingsTitle">
          <span className="settingsTitleAccent">—</span> AYARLAR{" "}
          <span className="settingsTitleAccent">—</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="settingsTabBar" role="tablist" aria-label="Ayarlar sekmeleri">
        {(["VIDEO", "AUDIO", "LANG"] as SettingsTab[]).map((tab) => {
          const labels: Record<SettingsTab, string> = {
            VIDEO: "Görüntü",
            AUDIO: "Ses",
            LANG: "Dil",
          };
          const icons: Record<SettingsTab, string> = {
            VIDEO: "◈",
            AUDIO: "◎",
            LANG: "◉",
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
                Görüntü Kalitesi
              </label>
              <select
                id="video-quality"
                className="settingsSelect"
                value={videoQuality}
                onChange={(e) => setVideoQuality(e.target.value as "LOW" | "MEDIUM" | "HIGH")}
              >
                <option value="LOW">Düşük</option>
                <option value="MEDIUM">Orta</option>
                <option value="HIGH">Yüksek</option>
              </select>
            </div>

            <div className="settingsRow settingsRow--slider">
              <div className="settingsRowTop">
                <label className="settingsRowLabel" htmlFor="brightness-slider">
                  Parlaklık
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
              { id: "master-vol", label: "Genel Ses", value: masterVolume, set: setMasterVolume },
              { id: "ambience-vol", label: "Ortam (Ambience)", value: ambienceVolume, set: setAmbienceVolume },
              { id: "sfx-vol", label: "Efektler (SFX)", value: sfxVolume, set: setSfxVolume },
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
                Dil / Language
              </label>
              <select
                id="lang-select"
                className="settingsSelect"
                value={language}
                onChange={(e) => setLanguage(e.target.value as "tr" | "en")}
              >
                <option value="tr">Türkçe</option>
                <option value="en">English (deneysel)</option>
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
                <span className="settingsRowLabel">Altyazıları göster</span>
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
