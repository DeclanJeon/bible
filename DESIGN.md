---
version: alpha
name: bible-hyperlink-companion-design
description: A warm, calm, reading-optimized dark design system for a Bible study companion. Inspired by Notion's warmth, Linear's precision, and Apple's premium white space. Dark canvas with warm gold accent, soft glass surfaces, and editorial typography.

colors:
  canvas: "#0a0a0f"
  surface-1: "#12121a"
  surface-2: "#1a1a25"
  surface-3: "#22222f"
  hairline: "rgba(255,255,255,0.08)"
  hairline-strong: "rgba(255,255,255,0.15)"
  ink: "#f0ece4"
  ink-muted: "#9a9490"
  ink-subtle: "#6b6560"
  primary: "#d4a853"
  primary-hover: "#e0bc6a"
  primary-deep: "#b8923f"
  on-primary: "#0a0a0f"
  accent: "#d4a853"
  accent-soft: "rgba(212,168,83,0.10)"
  accent-border: "rgba(212,168,83,0.25)"
  link: "#8ab4e8"
  link-hover: "#a8ccf0"
  semantic-success: "#4ade80"
  semantic-warning: "#fbbf24"
  semantic-error: "#f87171"

typography:
  display-lg:
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -1.5px
  display-md:
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: -1px
  heading-1:
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.5px
  heading-2:
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.3px
  heading-3:
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.35
  body-lg:
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.65
  body:
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
  caption:
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0.3px
  button:
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.2

rounded:
  xs: 6px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  xxl: 24px
  pill: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px

components:
  card:
    backgroundColor: "{colors.surface-1}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  card-accent:
    backgroundColor: "{colors.surface-1}"
    border: "1px solid {colors.accent-border}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    border: "1px solid {colors.hairline-strong}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  input:
    backgroundColor: "{colors.surface-1}"
    border: "1px solid {colors.hairline}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"

key-principles:
  - Dark canvas with warm undertones, never cold/blue-black
  - Gold accent used sparingly: primary CTA, active states, verse numbers
  - Glass surfaces are subtle: low-opacity borders, no heavy blur
  - Typography hierarchy through weight and size, not color explosion
  - Cards use surface-1 with hairline borders, not heavy shadows
  - Generous whitespace between sections
  - Reading-first: body text optimized for long-form Bible reading
  - Mobile-first responsive: sm/md/lg breakpoints, 44px touch targets
