"use client";

import { ChevronDown } from "lucide-react";
import { useState, useId, memo } from "react";

export const Collapsible = memo(function Collapsible({
  trigger,
  children,
  defaultOpen = false,
  className = "",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="inline-flex items-center gap-1.5 min-h-[44px] cursor-pointer text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition"
      >
        {trigger}
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div
        id={contentId}
        role="region"
        hidden={!isOpen}
        aria-hidden={!isOpen}
        className="overflow-hidden transition-all duration-200 ease-in-out"
        style={{ maxHeight: isOpen ? "2000px" : "0px" }}
      >
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
});
