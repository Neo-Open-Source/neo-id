"use client";

import { useCallback, useState } from "react";

interface UseModalResult {
  open: boolean;
  show: () => void;
  hide: () => void;
  toggle: () => void;
}

export function useModal(initialOpen = false): UseModalResult {
  const [open, setOpen] = useState(initialOpen);

  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  return { open, show, hide, toggle };
}
