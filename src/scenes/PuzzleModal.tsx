import type { ReactNode } from "react";

type PuzzleModalProps = {
  clueLabel: string;
  puzzleFeedback: string;
  onClose: () => void;
  children: ReactNode;
};

export function PuzzleModal({ clueLabel, puzzleFeedback, onClose, children }: PuzzleModalProps) {
  return (
    <div className="modalBack" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalHead">
          <div style={{ fontWeight: 800 }}>{clueLabel}</div>
          <button className="btn" onClick={onClose} type="button">
            Kapat
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
