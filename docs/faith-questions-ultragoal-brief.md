Implement docs/faith-questions-ai-design.md for bible.ponslink.com. Keep the service lightweight: no external article body ingestion, no full GotQuestions mirroring, no long-lived external-source text storage. Use existing project conventions, localized routes, internal Bible links, and external links with safe attributes. Verify with focused lint/build or targeted checks before checkpointing. Do not deploy unless explicitly requested.

@goal: Build the static faith questions hub
Create `/ko/faith-questions` and `/en/faith-questions` as a localized static route using the design document. Include hero copy, core question cards, reading paths, GotQuestions category links, selected external resources, internal Bible passage links, and a link to the existing spirit-soul-body page. Add navigation and sitemap integration consistent with existing app patterns.

@goal: Add lightweight question routing data and API
Add static resource/question metadata and a lightweight rules-based router for user questions. Add an API route that returns a readable answer scaffold with matched topics, passages, and external resources without fetching or storing external article bodies. If AI provider integration is safely available through existing Hermes conventions, use it only as an optional enhancement bounded by the supplied metadata; otherwise return deterministic grounded output.

@goal: Integrate client interaction and verify behavior
Wire the faith questions page to the API with an accessible question form and result cards. Verify Korean and English page rendering, sample question routing, external link behavior, and focused lint/build checks. Record evidence for the completed implementation.