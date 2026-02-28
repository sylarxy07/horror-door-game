import { useEffect, useState } from "react";

const checkImagePath = (src: string) =>
  new Promise<boolean>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });

export function usePreferredAssetPath(candidates: readonly string[]) {
  const [resolvedPath, setResolvedPath] = useState<string | null>(null);
  const candidateKey = candidates.join("|");

  useEffect(() => {
    let cancelled = false;

    const tryCandidates = async () => {
      setResolvedPath(null);
      const candidateList = candidateKey ? candidateKey.split("|") : [];

      for (const candidate of candidateList) {
        const exists = await checkImagePath(candidate);
        if (!exists) continue;

        if (!cancelled) setResolvedPath(candidate);
        return;
      }

      if (!cancelled) setResolvedPath(null);
    };

    void tryCandidates();

    return () => {
      cancelled = true;
    };
  }, [candidateKey]);

  return resolvedPath;
}
