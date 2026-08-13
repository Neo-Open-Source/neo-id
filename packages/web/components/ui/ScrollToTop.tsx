"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { getScrollY, onScrollRoot, scrollRootTo } from "@/lib/scroll-root";

const SHOW_AFTER = 360;

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(getScrollY() > SHOW_AFTER);

    // Re-bind when crossing the mobile/desktop breakpoint (scroll root switches)
    let unsubscribe = onScrollRoot(update);
    const onResize = () => {
      unsubscribe();
      unsubscribe = onScrollRoot(update);
      update();
    };
    window.addEventListener("resize", onResize);

    update();
    return () => {
      unsubscribe();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="scroll-top"
      aria-label="Scroll to top"
      onClick={() => scrollRootTo(0, "smooth")}
    >
      <Icon name="arrow-up" size={18} />
    </button>
  );
}
