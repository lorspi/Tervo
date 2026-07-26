import { useEffect, useCallback, useState } from 'react';

/**
 * Hook that handles modal dismissal via overlay click and ESC key.
 * If the modal has unsaved changes (isDirty), dismissal is blocked
 * and a shake animation is triggered instead.
 */
export function useModalDismiss(
  isOpen: boolean,
  onClose: () => void,
  isDirty: boolean
) {
  const [shaking, setShaking] = useState(false);

  const triggerShake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
  }, []);

  const attemptClose = useCallback(() => {
    if (isDirty) {
      triggerShake();
    } else {
      onClose();
    }
  }, [isDirty, onClose, triggerShake]);

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        attemptClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, attemptClose]);

  return { shaking, attemptClose };
}
