import { useEffect, useRef, useCallback } from 'react';

const isEditableTarget = (target) => {
  if (!target) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
};

export const useHardwareScanner = (onScanSuccess) => {
  const bufferRef = useRef([]);
  const lastKeyTimeRef = useRef(Date.now());

  const handleKeyDown = useCallback((event) => {
    // Ignore keystrokes typed into real form fields (Qty input, etc.)
    if (isEditableTarget(event.target)) {
      bufferRef.current = [];
      return;
    }

    const currentTime = Date.now();
    const timeDiff = currentTime - lastKeyTimeRef.current;
    lastKeyTimeRef.current = currentTime;

    if (timeDiff > 40 && event.key !== 'Enter') {
      bufferRef.current = [];
    }

    if (event.key === 'Enter') {
      if (bufferRef.current.length > 0) {
        const scannedCode = bufferRef.current.join('');
        onScanSuccess(scannedCode);
        bufferRef.current = [];
      }
      return;
    }

    if (event.key.length === 1) {
      bufferRef.current.push(event.key);
    }
  }, [onScanSuccess]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};