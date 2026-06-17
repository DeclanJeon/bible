import type { SafetyAssessment } from "@/lib/safety";

const LEVEL_STYLES: Record<SafetyAssessment["level"], string> = {
  none: "hidden",
  caution: "border-amber-400/30 bg-amber-400/10 text-amber-50",
  crisis: "border-rose-500/40 bg-rose-500/12 text-rose-50",
};

export function SafetyBanner({ safety }: { safety: SafetyAssessment }) {
  if (safety.level === "none") {
    return null;
  }

  return (
    <div className={`rounded-[28px] border p-5 ${LEVEL_STYLES[safety.level]}`}>
      <div className="section-title text-current">{safety.title}</div>
      <p className="mt-3 text-sm leading-7 text-current/90">{safety.summary}</p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-current/85">
        {safety.guidance.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {safety.flagLabels.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {safety.flagLabels.map((flag) => (
            <span key={flag} className="chip border-current/20 bg-black/10 text-current">
              {flag}
            </span>
          ))}
        </div>
      ) : null}
      {safety.resources.length ? (
        <div className="mt-5 rounded-[20px] border border-current/15 bg-black/10 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-current/70">{safety.resourcesTitle}</div>
          <div className="mt-3 space-y-3 text-sm leading-6 text-current/90">
            {safety.resources.map((resource) => (
              <div key={`${resource.label}-${resource.value}`}>
                <div className="font-semibold text-current">{resource.label}</div>
                {resource.href ? (
                  <a href={resource.href} target="_blank" rel="noreferrer" className="text-current underline decoration-current/40 underline-offset-4">
                    {resource.value}
                  </a>
                ) : (
                  <div>{resource.value}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
