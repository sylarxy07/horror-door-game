import type { ReactNode } from "react";
import { useI18n } from "../i18n";

type PuzzleModalProps = {
  clueLabel: string;
  puzzleFeedback: string;
  onClose: () => void;
  children: ReactNode;
};

export function PuzzleModal({ clueLabel, puzzleFeedback, onClose, children }: PuzzleModalProps) {
  const { t } = useI18n();
  return (
    <div className="modalBack" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHead">
          <div style={{ fontWeight: 800 }}>{clueLabel}</div>
          <button className="btn" onClick={onClose} type="button">
            {t("common.close")}
          </button>
        </div>
        <div className="modalBody">
          {children}
          {puzzleFeedback && <div className="feedback">{puzzleFeedback}</div>}
        </div>
      </div>
    </div>
  );
}
