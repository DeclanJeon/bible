"use client";

import { ChevronDown } from "lucide-react";
import { useState, useCallback, useId, memo } from "react";

interface AccordionItem {
  key: string;
  header: React.ReactNode;
  body: React.ReactNode;
  defaultOpen?: boolean;
}

export const AccordionGroup = memo(function AccordionGroup({
  items,
  className = "",
}: {
  items: AccordionItem[];
  className?: string;
}) {
  const baseId = useId();
  const [openKeys, setOpenKeys] = useState<Set<string>>(
    new Set(items.filter((item) => item.defaultOpen).map((item) => item.key))
  );

  const toggle = useCallback((key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  return (
    <div className={className}>
      {items.map((item, index) => {
        const isOpen = openKeys.has(item.key);
        const headerId = `${baseId}-${item.key}-header`;
        const bodyId = `${baseId}-${item.key}-body`;
        const isLast = index === items.length - 1;

        return (
          <div
            key={item.key}
            className={`${isLast ? "" : "border-b border-[var(--hairline)]"}`}
          >
            <button
              type="button"
              id={headerId}
              aria-expanded={isOpen}
              aria-controls={bodyId}
              onClick={() => toggle(item.key)}
              className="flex items-center justify-between w-full cursor-pointer py-4 text-left"
            >
              <span className="flex-1">{item.header}</span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-[var(--muted)] transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              id={bodyId}
              role="region"
              aria-labelledby={headerId}
              className="overflow-hidden transition-all duration-200 ease-in-out"
              style={{ maxHeight: isOpen ? "2000px" : "0px" }}
              hidden={!isOpen}
            >
              <div className="pb-4">{item.body}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
});
