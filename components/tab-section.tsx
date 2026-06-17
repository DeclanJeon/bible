"use client";

import { useState, useCallback, useId, useRef, memo } from "react";

interface Tab {
  key: string;
  label: string;
  count?: number;
  content: React.ReactNode;
}

export const TabSection = memo(function TabSection({
  tabs,
  defaultKey,
  className = "",
}: {
  tabs: Tab[];
  defaultKey?: string;
  className?: string;
}) {
  const baseId = useId();
  const [activeKey, setActiveKey] = useState(defaultKey ?? tabs[0]?.key ?? "");
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const activate = useCallback(
    (key: string) => {
      setActiveKey(key);
      tabRefs.current.get(key)?.focus();
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = tabs.findIndex((t) => t.key === activeKey);
      if (currentIndex === -1) return;

      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          nextIndex = (currentIndex + 1) % tabs.length;
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = tabs.length - 1;
          break;
      }

      if (nextIndex !== null) {
        activate(tabs[nextIndex].key);
      }
    },
    [activeKey, tabs, activate]
  );


  return (
    <div className={className}>
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto [scrollbar-width:none] border-b border-[var(--line)]"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          const tabId = `${baseId}-${tab.key}-tab`;
          const panelId = `${baseId}-${tab.key}-panel`;

          return (
            <button
              key={tab.key}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.key, el);
                else tabRefs.current.delete(tab.key);
              }}
              role="tab"
              id={tabId}
              aria-controls={panelId}
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => activate(tab.key)}
              className={`whitespace-nowrap px-4 py-3 text-sm font-semibold border-b-2 transition ${
                isActive
                  ? "text-[var(--text)] border-[var(--gold)] bg-[var(--tab-active-bg)]"
                  : "text-[var(--muted)] border-transparent hover:text-[var(--text)] hover:bg-[var(--tab-hover-bg)]"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 text-xs text-[var(--gold)]">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="glass rounded-b-[32px] p-6 lg:p-8">
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          const tabId = `${baseId}-${tab.key}-tab`;
          const panelId = `${baseId}-${tab.key}-panel`;

          return (
            <div
              key={tab.key}
              role="tabpanel"
              id={panelId}
              aria-labelledby={tabId}
              tabIndex={0}
              hidden={!isActive}
              className={isActive ? "" : "hidden"}
            >
              {tab.content}
            </div>
          );
        })}
      </div>
    </div>
  );
});
