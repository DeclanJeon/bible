"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

type AutoCloseDetailsProps = {
  className?: string;
  summary: ReactNode;
  summaryClassName?: string;
  panelClassName?: string;
  children: ReactNode;
};

export function AutoCloseDetails({
  className,
  summary,
  summaryClassName,
  panelClassName,
  children,
}: AutoCloseDetailsProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details
      ref={detailsRef}
      className={className}
      onClickCapture={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (!target.closest("a[href]")) return;
        window.requestAnimationFrame(() => {
          if (detailsRef.current) {
            detailsRef.current.open = false;
          }
        });
      }}
    >
      <summary className={summaryClassName}>{summary}</summary>
      <div className={panelClassName}>{children}</div>
    </details>
  );
}
