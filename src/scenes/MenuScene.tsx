import { useState } from "react";

type MenuSceneProps = {
  onStart: () => void;
};

type SettingsTab = "VIDEO" | "AUDIO" | "LANG";

export function MenuScene({ onStart }: MenuSceneProps) {
  const [panel, setPanel] = useState<"MAIN" | "SETTINGS">("MAIN");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("VIDEO");

  const [videoQuality, setVideoQuality] = useState<"LOW" | "MEDIUM" | "HIGH">("HIGH");
  const [brightness, setBrightness] = useState(50);

  const [masterVolume, setMasterVolume] = useState(70);
  const [ambienceVolume, setAmbienceVolume] = useState(80);
  const [sfxVolume, setSfxVolume] = useState(80);

  const [language, setLanguage] = useState<"tr" | "en">("tr");
  const [subtitlesOn, setSubtitlesOn] = useState(true);

  const renderMainPanel = () => (
    <div className="menuContent">
      <div className="menuHero">
        <h1 className="menuLogo">KAÇAMAZSIN</h1>
      </div>

      <div className="menuSections">
        <div className="menuSectionBody menuMainButtons">
          <button className="btn danger wide menuMainButton" onClick={onStart} type="button">
            Yeni Oyun
          </button>
          <button className="btn wide menuMainButton" type="button" disabled>
            Devam
          </button>
          <button className="btn wide menuMainButton" type="button" onClick={() => setPanel("SETTINGS")}>
            Ayarlar
          </button>
        </div>
      </div>
    </div>
  );

  const renderSettingsPanel = () => (
    <div className="menuContent">
      <div className="settingsHeader">
        <button className="btn ghost" type="button" onClick={() => setPanel("MAIN")}>
          ← Ana Menü
        </button>
        <div className="hintLabel">Ayarlar</div>
      </div>

      <div className="settingsTabs">
        <button
          type="button"
          className={`settingsTab ${settingsTab === "VIDEO" ? "active" : ""}`}
          onClick={() => setSettingsTab("VIDEO")}
        >
          Görüntü Ayarları
        </button>
        <button
          type="button"
          className={`settingsTab ${settingsTab === "AUDIO" ? "active" : ""}`}
          onClick={() => setSettingsTab("AUDIO")}
        >
          Ses Ayarları
        </button>
        <button
          type="button"
          className={`settingsTab ${settingsTab === "LANG" ? "active" : ""}`}
          onClick={() => setSettingsTab("LANG")}
        >
          Dil Ayarları
        </button>
      </div>

      <div className="settingsBody">
        {settingsTab === "VIDEO" && (
          <div className="settingsGroup">
            <div className="settingsField">
              <div className="settingsLabel">Görüntü kalitesi</div>
              <select className="settingsSelect" value={videoQuality} onChange={(e) => setVideoQuality(e.target.value as "LOW" | "MEDIUM" | "HIGH")}>
                <option value="LOW">Düşük</option>
                <option value="MEDIUM">Orta</option>
                <option value="HIGH">Yüksek</option>
              </select>
            </div>

            <div className="settingsField">
              <div className="settingsLabel">Parlaklık</div>
              <input type="range" min={0} max={100} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
            </div>
          </div>
        )}

        {settingsTab === "AUDIO" && (
          <div className="settingsGroup">
            <div className="settingsField">
              <div className="settingsLabel">Genel ses seviyesi</div>
              <input
                type="range"
                min={0}
                max={100}
                value={masterVolume}
                onChange={(e) => setMasterVolume(Number(e.target.value))}
              />
            </div>

            <div className="settingsField">
              <div className="settingsLabel">Ortam (ambience)</div>
              <input
                type="range"
                min={0}
                max={100}
                value={ambienceVolume}
                onChange={(e) => setAmbienceVolume(Number(e.target.value))}
              />
            </div>

            <div className="settingsField">
              <div className="settingsLabel">Efektler (SFX)</div>
              <input
                type="range"
                min={0}
                max={100}
                value={sfxVolume}
                onChange={(e) => setSfxVolume(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        {settingsTab === "LANG" && (
          <div className="settingsGroup">
            <div className="settingsField">
              <div className="settingsLabel">Dil</div>
              <select className="settingsSelect" value={language} onChange={(e) => setLanguage(e.target.value as "tr" | "en")}>
                <option value="tr">Türkçe</option>
                <option value="en">English (deneysel)</option>
              </select>
            </div>

            <div className="settingsField">
              <label className="settingsCheckboxRow">
                <input type="checkbox" checked={subtitlesOn} onChange={(e) => setSubtitlesOn(e.target.checked)} />
                Altyazıları göster
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="settingsFooter muted" />
    </div>
  );

  return (
    <div className="menuWrap">
      <div className="menuBg" />
      <div className="menuCard panel">{panel === "MAIN" ? renderMainPanel() : renderSettingsPanel()}</div>
    </div>
  );
}
