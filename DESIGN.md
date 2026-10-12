---
name: plsteach.me
description: A calm, illustrated companion for learning practical skills.
colors:
  paper: "#f7f5ee"
  ink: "#26392f"
  accent: "#a84228"
  accent-hover: "#90381f"
  muted: "#5d675e"
  line: "#d9ddd1"
  soft: "#eceee3"
  card: "#fffdf8"
  on-accent: "#fffaf3"
  control-border: "#c8cfc1"
  secondary-hover: "#e7eadf"
  selected: "#f4e7dc"
  disabled-bg: "#e0d8cb"
  disabled-text: "#697064"
  badge-bg: "#e9ebdf"
  badge-text: "#4d594a"
  trail-remaining: "#d6dace"
  trail-visited: "#75856b"
  wide-end: "#b74f32"
  narrow-end: "#ded5c3"
  diagram-outline: "#333c35"
  diagram-context: "#a5ab9b"
  diagram-arrow: "#7b442f"
typography:
  display:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "clamp(2.6rem, 5vw, 4.4rem)"
    fontWeight: 400
    lineHeight: 1.13
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "21px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  title:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "25px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  instruction:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.45
rounded:
  control: "10px"
  surface: "16px"
  badge: "30px"
  trail: "3px"
spacing:
  compact: "12px"
  small: "16px"
  medium: "24px"
  large: "32px"
  section: "48px"
  page: "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 22px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.disabled-bg}"
    textColor: "{colors.disabled-text}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 22px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  skill-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  answer-option:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "17px 20px"
  answer-option-selected:
    backgroundColor: "{colors.selected}"
  badge:
    backgroundColor: "{colors.badge-bg}"
    textColor: "{colors.badge-text}"
    rounded: "{rounded.badge}"
    padding: "5px 10px"
---

# Design System: plsteach.me

## Overview

**Creative North Star: "An illustrated beginner's handbook"**

A patient, calm visual coach. Warm paper, deep green ink and a restrained warm accent frame simple tie illustrations. Open spacing and readable instructions make each next action easy to find.

**Key Characteristics:**

- Self-hosted serif headings paired with a clear sans serif interface.
- Flat, softly rounded surfaces and visible keyboard focus.
- A consistent terracotta wide end across all seven tie diagrams.

Implementation references: [styles](app/globals.css), [font setup](app/layout.tsx), [components](components/) and [tie illustrations](public/skills/tie/).

## Colors

### Primary

The warm accent identifies primary actions, current lesson position and selected answers. Its darker hover state signals interaction. Terracotta identifies the tie's wide end; it is a separate illustration color from the interface accent.

### Neutral

Paper is the page background; ink carries primary text. Muted ink supports notes and metadata. Soft sage holds illustrations, cream holds the skill card, and pale borders separate content without heavy framing. Selected answers use a warm wash. Badges and visited trail segments use subdued sage tones.

**The Wide-End Rule.** Keep the wide end terracotta and the narrow end pale in every instructional SVG; color identifies the same physical part throughout the lesson.

## Typography

Lora is self-hosted for major headings and intake questions; DM Sans is self-hosted for interface text. Loaded weights are Lora 400/500 and DM Sans 400/500/600/700.

The frontmatter records the shared display, heading, title, body, instruction and button-label roles. Page-specific headings use smaller fixed sizes: lesson headings are 38px on desktop and 33px on phones; intro and intake headings are 42px and 35px respectively. The home heading becomes 45px on phones. Instructions keep their 22px size, with line height reduced to 1.55 on phones. Supporting metadata uses 12–17px; keep it secondary to the instruction.

## Layout

Main content is centered, capped at 1120px with 40px desktop side gutters. The header caps at 1280px. Intake uses a 620px column. Desktop home, introduction and coaching screens use two columns; at 800px and below, they stack into one column with 20px side gutters. The diagram precedes the instruction on phones. Completion actions also stack.

The spacing tokens describe the recurring rhythm; individual compositions use their existing gaps. Illustration areas contain the full SVG rather than cropping it. Coaching illustrations are 380px tall on desktop and 270px on phones.

## Elevation & Depth

No shadows. Tonal surfaces, thin borders and whitespace create separation. Keep focus outlines distinct from surface borders.

## Shapes

Surfaces use softly curved corners, with tighter rounding on controls. Radio indicators, step numbers and the completion symbol are circular. Progress segments are slim rounded bars. Icons and instructional diagrams use simple SVG line art; avoid photographic substitutes for the lesson diagrams.

## Components

### Buttons and navigation

Primary buttons use the warm accent with cream text; secondary buttons are transparent with a thin neutral border. Buttons have a minimum height of 56px; quiet navigation controls have a minimum height of 48px. Primary hover darkens the fill, secondary hover adds a pale wash, and quiet-link hover uses the accent. Disabled primary buttons use muted colors; disabled secondary buttons use half opacity.

Visible focus uses a 3px ink outline with a 4px offset. Button background transitions last 180ms with ease-out. Reduced-motion preference removes transitions and animations and restores automatic scrolling.

### Cards and answer choices

The skill card has a thin border, a sage illustration area and cream content. Content padding is 25px 28px 28px on desktop and 22px on phones. Answer choices are full-width radio labels with a minimum height of 68px. Selection adds a warm wash, accent border and filled circular check indicator. Focus on the radio outlines the whole choice.

### Lesson trail and diagrams

The seven-segment trail uses accent for the current step, sage for earlier positions and pale sage for remaining positions. It describes position, without implying verified correctness. Each segment exposes its step title to assistive technology.

Tie diagrams share an unmirrored front view, light contextual outlines and the terracotta wide-end signature. Keep the explanatory legend and caption with the diagram.

## Do's and Don'ts

- **Do** retain the off-white, deep-ink and warm-accent palette.
- **Do** keep the 18px body and 22px instruction sizes, generous controls and visible keyboard focus.
- **Do** use the existing SVG language and consistent tie-part colors.
- **Don't** add shadows or decorative motion to the flat surface system.
- **Don't** present lesson position or the completion symbol as evidence of verified skill.
