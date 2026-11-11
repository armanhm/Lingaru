import { useCallback } from "react";
import { useToast } from "../contexts/ToastContext";

// Non-blocking notice when a mini-game score fails to save (no XP awarded).
export default function useScoreSubmitErrorToast() {
  const { showToast } = useToast();
  return useCallback(
    () => showToast("Couldn't save your score. No XP was awarded.", "error"),
    [showToast]
  );
}
