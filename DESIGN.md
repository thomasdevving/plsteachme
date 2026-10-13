---
name: plsteach.me
description: Patient practical coaching on warm paper, in ink and terracotta.
colors:
  paper: "#faf7f2"
  ink: "#22372c"
  accent: "#bb4827"
  accent-hover: "#97381e"
  soft: "#edeee5"
  surface: "#fffdf9"
  line: "#d9dcd1"
  muted: "#5e685e"
  tint: "#f0ded0"
  on-accent: "#fffaf4"
  focus: "#26392f"
  dark-paper: "#1e2621"
  dark-ink: "#f4f0e6"
  dark-accent: "#efa384"
  dark-accent-hover: "#f5b79f"
  dark-soft: "#29342c"
  dark-surface: "#243028"
  dark-line: "#48564b"
  dark-muted: "#bdc7ba"
  dark-tint: "#44362e"
  dark-on-accent: "#241f1a"
  dark-focus: "#e9a086"
  brand-green: "#22372c"
  brand-orange: "#bb4827"
  brand-text-green: "#22372c"
  brand-text-orange: "#bb4827"
  dark-brand-text-green: "#bdd1bd"
  dark-brand-text-orange: "#efa384"
  problem-bg: "#f5f0e7"
  illustration-ink: "#26392f"
  illustration-accent: "#a84228"
typography:
  display:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "clamp(2.85rem, 5.45vw, 5.4rem)"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Lora, Georgia, serif"
    fontSize: "clamp(2rem, 3.4vw, 3.3rem)"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  title:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 600
  small:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.82rem"
    lineHeight: 1.6
rounded:
  control: "7px"
  logo-tile: "8px"
  feedback: "12px"
  card: "14px"
  video: "16px"
  phone: "38px"
  pill: "50px"
spacing:
  logo-padding: "3px"
  tight: "8px"
  small: "12px"
  item: "16px"
  medium: "20px"
  card: "24px"
  large: "30px"
  stack: "35px"
  mobile-section: "60px"
  tablet-section: "75px"
  desktop-section: "100px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    padding: "13px 22px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "13px 22px"
  button-secondary-hover:
    backgroundColor: "{colors.soft}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "9px 14px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  card:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.card}"
    padding: "{spacing.card}"
  navigation:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    height: "94px"
  module-filter:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  module-filter-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  module-preview:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.card}"
    padding: "40px"
  coach-control:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  status-pill:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "5px 9px"
---

# Design System: plsteach.me

## Overview

**Creative North Star: "A calm lesson companion"**

Warm paper, deep green and orange give practical learning a patient, human setting. Lora carries the mission and larger headings; DM Sans keeps navigation, explanations and controls clear. Flat color bands, fine line illustrations and generous space retain the established handbook character.

The supplied two-hands mark anchors the current identity. Its compact optical lockup feels integrated with the contiguous green “plsteach” and orange “.me” wordmark; the second hero phrase repeats that orange. This is an English-only website with root-level canonical URLs. Its phone is a controllable coaching example, and the nine modules offer explicitly labelled text previews; neither implies a live camera or AI feedback session.

**Key Characteristics:**
- Supplied hands mark with a green/orange wordmark.
- A light cream public canvas, a warmer cream story band and quiet flat surfaces.
- Serif mission phrases paired with readable sans-serif interaction.
- Six hero module choices, seven-step sample coaching and nine filterable text-preview modules.
- Visible keyboard focus, reduced motion and a public canvas independent of OS theme.

## Colors

The frontmatter records the final active palette after the full CSS cascade. Unprefixed interface tokens describe the public light palette; `dark-` entries record explicitly scoped development-gallery variants. Public pages retain the light cream canvas regardless of the operating-system theme. `brand-green` and `brand-orange` remain fixed brand primitives in both themes. In CSS, light `ink`/`accent` and wordmark colors alias those brand primitives; the frontmatter resolves those aliases to their actual colors.

### Primary

Brand green carries the main wordmark and phone casing; it does not fill public page backgrounds. Brand orange carries “.me,” the second hero phrase and completed phone progress. `accent` marks primary actions and illustrations, with `accent-hover` and `on-accent` supplying action states. `brand-text-green`/`brand-text-orange` have brighter counterparts only within an explicitly dark development scope. `tint` supplies a warm supporting surface.

### Neutral

`paper` is the page canvas, `ink` the principal text, `surface` the lightest field/card surface, and `soft` the quiet section and footer background. `line` separates content; `muted` carries supporting copy. `focus` remains the independently defined keyboard-outline color rather than an alias of brand green.

The story band uses the warmer `problem-bg` cream without overriding the normal ink, muted, accent or line colors. The illustrative phone interior and demo poster retain fixed light colors, including the documented `illustration-ink` and `illustration-accent`; some inherited drawing strokes remain terracotta. These are contained examples. Automatic `prefers-color-scheme: dark` rules are absent. Scoped `data-theme="dark"` remains available for the development gallery; no public page applies it.

**The Semantic Surface Rule.** Keep public surfaces light cream through runtime palette variables; preserve the warmer cream story band and fixed light illustration interior. Dark tokens are development-gallery variants only.

## Typography

**Display Font:** self-hosted Lora, with Georgia/serif CSS fallbacks.
**Body Font:** self-hosted DM Sans, with sans-serif fallback.

Lora supplies balanced, tightly tracked mission headlines and personal notes. DM Sans supplies body text, the header wordmark, controls and section subheads. The frontmatter captures the default desktop hierarchy; individual surfaces and responsive rules provide local adjustments.

- The hero has a short mission eyebrow, two block-level phrases (“A little help.” / “A skill for life.”), and one support sentence. The second phrase uses the orange brand-text token. There is no narrow character limit on the final hero heading.
- The eyebrow is 0.84rem/1.6; the hero support is 1.22rem/1.6 with a 37ch measure.
- Card titles are semibold sans-serif. Preview module titles use regular Lora at 1.8rem, reducing to 1.5rem on phones; preview lesson copy is Lora at 1.4rem/1.45, reducing to 1.25rem.
- Default body copy is 17px, reducing to 16px on phones. Paragraph measures stop at 70ch; section support copy stops at 58ch.
- The header wordmark is sans-serif, with -0.035em tracking. The oversized footer retains a serif treatment on its two colored wordmark spans; those spans inherit a 1.3em local scale.

`next/font/local` exposes `--font-lora` and `--font-body`. Both use `display: optional`, avoiding a late swap. Only Lora is preloaded, with an adjusted Times New Roman fallback. DM Sans has separate regular and semibold resources without priority preload. A slow initial render can retain the fallback for that navigation.

**The Two Voices Rule.** Use Lora for mission, major headings and personal notes; use DM Sans for explanations and interaction.

## Layout

The desktop container is capped at 1180px with 80px total nominal gutters. At 1280px it is 1180px wide, inset 50px. The hero uses a 1.2fr/1fr grid with a 65px gap and minimum 660px row. Its headline computes to about 69.8px there. The 94px header presents the hands mark, wordmark, section links and compact signup action; there is no language switch.

Default sections use the desktop spacing token vertically. Story, demo, mentor, signup and FAQ use paired columns. Steps use four columns; the nine modules use three. A wrapping filter toolbar sits above the module grid. A selected text preview appears below that grid in a 0.75fr/1.25fr panel with a 60px gap and 40px padding. Alternating paper, soft, tint and the warmer cream story band establish page rhythm. The footer returns to soft fill.

At 1050px and below the container has 24px side gutters and major gaps reduce. At 800px and below the section links disappear, section rhythm uses the tablet token, and steps/modules become two columns. Preview padding reduces to 30px with a 30px gap; organization form rows stack.

At 375px the container is 335px wide with 20px gutters. The header is sticky with a 76px row, a compact 1.25em hands symbol (23px at the 1.15rem wordmark size) and visible compact signup. Hero, story, demo, mentor, waitlist, FAQ and module preview stack. The hero headline is 44.8px, with two explicit phrase blocks; the phone is 245px wide. Steps and module cards remain two columns. Filters wrap; the five coaching-loop positions remain one compact row. Preview padding is 25px/22px, its gap 28px. Form fields use 16px text and wrapped chips; ornamental waitlist art disappears. The demo explanation precedes its poster.

At 1500px and above the hero row grows to 700px and its visual scales to 1.08. The same content order remains intact.

## Elevation & Depth

Interface cards, module previews and section bands are flat. Borders, tonal shifts and spacing carry hierarchy. Only the phone and correction bubble use ambient shadows: `12px 24px 45px #26392f24` for the phone, `0 8px 30px #26392f1a` for the correction. The phone rests at 3 degrees; feedback rests at -6 degrees. Controls and caption counter-rotate to remain level.

The interactive figure reserves 93px below its phone for controls and caption. Six compact, border-separated skill buttons below the hero actions directly select its lesson; they use three columns on wide screens and two below 1050px. The hero retains the two headline phrases, cream canvas and supplied wordmark. The phone instruction has a fixed 181px height (177px below 800px), preventing lesson changes from shifting the surrounding layout. Its correction sits above the phone at top -24px/left -45px on desktop, changing to top -20px/left -25px at widths up to 800px, with bottom set to auto. Feedback uses a 275px maximum width, reducing to 245px on phones. This final placement keeps feedback clear of instructions and supersedes earlier bottom-based offsets.

**The Flat Interface Rule.** Keep controls, cards and content bands shadowless; reserve ambient lift for the coaching illustration.

## Shapes

Controls and module filters use gently rounded 7px corners, while cards and the expanded preview use 14px corners. Interest chips and status badges have pill silhouettes. The phone has pronounced 38px casing corners and a clipped screen. Fine one-pixel borders distinguish fields, secondary buttons, filters, cards and FAQ rows. Skill drawings remain fine inline SVG linework rather than filled pictograms.

The supplied `public/brand/hands.png` is the authoritative raster mark; do not redraw it. The shared header/404 lockup uses a 1.25em square symbol box, a 0.18em gap to the wordmark, and a -0.025em optical vertical adjustment. The original image scales to 1.22 inside that clipped box to remove optical whitespace. It has no tile, border radius, padding or separate background. At the desktop header size its symbol box is 35px; at 375px it is 23px. Green “plsteach” and orange “.me” form one contiguous name.

The separate footer mark remains 130px, then 90px at tablet width and 55px on phones. The same asset supplies browser/apple icons. Explicit development dark scopes retain the old warm-paper tile treatment for a standalone/footer logo (8px corners, 3px padding); the shared header/404 lockup overrides it to remain transparent. Public pages use neither automatic dark backgrounds nor a header logo tile.

## Components

### Buttons

Primary buttons use accent/on-accent; secondary buttons use transparent fill, ink text and a line border. Both use semibold text, a 52px minimum height and the control radius. Compact variants have a 44px minimum height with 10px/17px padding. The mobile header signup is a 43px exception; mobile hero actions use 50px. Disabled controls reduce opacity to 0.65.

Hover changes the primary fill to accent-hover and secondary fill to soft. Shared color/opacity transitions use 0.2s ease. Button arrows move 3px right on hover with the entrance easing; reduced motion removes that movement. Keyboard focus uses a 3px focus-token outline with 4px offset.

### Cards / Containers

Base cards use soft fill with the card padding token. Module cards use surface fill, line borders and clipped art; the tie module is featured with soft fill and warm tint art. Every third sequence's second card also uses tint art. Art is 140px high on desktop and 105px on phones. Content padding reduces from 25px to 16px/13px on phones. A category label sits in the art panel and uses ink, including on warm tint. Mentor-symbol text and the mentor closing note also use ink for readable contrast, while retaining their serif treatment. Hover moves its SVG up 4px and rotates it -4 degrees; reduced motion leaves it still.

### Inputs / Fields

Fields use surface fill, line border, control radius, a 51px minimum height and 12px/14px padding. Labels sit above with an 8px gap. The text caret and error messages use accent. Focus uses the shared outline. Native validation and semantic status/alert regions accompany submission. The signup form uses a 23px gap, reducing to 22px on phones; its submit action fills the column.

### Chips and module filters

Form interest chips are pill-shaped real buttons with `aria-pressed`; selected chips invert to ink/paper. They have a 44px minimum height and wrap. Unselected hover strengthens the border to ink. Module filters use the control radius instead of the pill silhouette, a 44px minimum height, and inline tabular counts. The four options are All skills, Everyday, Personal care, and Make & mend. Selecting one filters the nine modules, announces the result count and closes any open preview or age gate.

### Navigation

The shared `BrandMark` in the header and 404 page integrates the optically cropped hands symbol with one contiguous green “plsteach” / orange “.me” name. Its em-based dimensions follow the wordmark instead of presenting a separate large icon. Desktop links are quiet text with accent hover. Mobile retains the brand and signup action without a menu drawer or language control. The skip link appears on keyboard focus. Footer links sit on soft fill and use ink text; the footer repeats the original hands asset and colored wordmark.

### Interactive coaching phone

The phone presents seven manually controlled tie steps, initially step three. Back is disabled at the first step; Next advances, and Try again resets after the last. Instruction and illustrative feedback update together. A polite live region announces the instruction; the progress rail exposes its position through semantic progressbar values. The tie fabric morphs through a simplified wrap in a 4.6-second cycle; a stroke-dash guide draws alongside it. This is illustrative animation, without camera recognition. A pause/play button controls the loop, which also pauses offscreen and in a hidden document. Reduced motion uses the static fabric and guide, with the motion toggle hidden. The six hero choices switch this phone to their existing module text previews; upcoming skills explicitly say “Text preview · coming later” and “no camera or AI feedback.” Their three steps use the same controls and reset to the first step when selected from another module. The caption explicitly says example screen, no live camera and sample feedback. Controls have 44px minimum dimensions and surface fill, with tint hover.

Phone entrance takes 750ms, updated lesson copy 350ms, and feedback 500ms, using `cubic-bezier(.16,1,.3,1)`. Module artwork switches with a 450ms clipped entrance; progress fills over 350ms, controls acknowledge a press over 180ms. Step changes remain manual. These state-change animations do not automatically advance lessons.

### Module text previews

Nine modules cover tying a tie, shaving, beard trimming, ironing, sewing a button, drilling, laundry, cooking and bike care. Every card offers Explore preview. Selecting it opens a labelled, focusable three-step text region and scrolls it into view. The panel explicitly says “Text preview · no camera or AI feedback.” Back is disabled initially; the last next action becomes Start again. Close returns focus to the opening button. The available tie demo is a separate link; upcoming modules retain their status and interest vote.

Preview entrance uses a 400ms clipped reveal; preview lesson changes use 300ms entrance timing. Filtered cards use a 400ms clipped reveal with at most 90ms stagger, keeping text at full opacity throughout. There is no modal overlay. The panel uses soft fill, rounded card corners, a progress rail, a readable serif instruction and compact controls.

### Coaching loop and reduced motion

The five loop nodes have staggered six-second ease-out cycles, with 0.8s delay between nodes. Their animation is paused by default. An intersection observer and document-visibility listener add the active class only while the loop is in view and the tab is visible. The continuous animation therefore pauses offscreen or in a hidden tab. It communicates no essential information through motion alone.

Reduced motion removes all animations/transitions, cancels card/arrow hover transforms, uses automatic page scrolling, and opens module previews with instant scrolling. Loading indicators otherwise rotate once per second.

### FAQ

Native details/summary rows use line separators, generous clickable summaries and a plus mark rotated 45 degrees when open. The mark transitions over 220ms and the answer uses a finite 250ms clipped reveal. Navigation underlines grow on hover/focus; filtered module lists use a bounded 400ms reveal with at most 90ms sibling stagger. Expanded answers remain muted without elevation.

## Do's and Don'ts

### Do:
- **Do** preserve the supplied hands asset, compact optical lockup and contiguous green “plsteach” / orange “.me” relationship.
- **Do** keep the second hero phrase orange and the website interface English-only.
- **Do** keep public page backgrounds light cream, including the warmer cream story band, regardless of the OS theme.
- **Do** label text previews and sample coaching honestly, with visible focus and static reduced-motion content.
- **Do** retain the compact signup action, wrapping filters and readable preview controls at 375px.

### Don't:
- **Don't** redraw the supplied hands logo, add a tile to the header lockup or separate “plsteach” from “.me.”
- **Don't** add shadows to interface cards, fields or preview panels.
- **Don't** turn step progress, sample feedback or module previews into camera-analysis claims.
- **Don't** replace the established line drawings with stock photos, robots or purple gradients.
- **Don't** animate the continuous loop when it is offscreen or the document is hidden.

<!-- Evidence: refreshed only this file and .impeccable/design.json in plsteach-frontend. Scanned the full app/globals.css cascade, app/[locale]/layout.tsx, shell.tsx, landing.tsx, coach-preview.tsx, illustrations.tsx, utilities.tsx, skills.tsx, ui.tsx, forms.tsx, lib/config.ts, lib/modules.ts, lib/i18n.ts, messages/en.ts and proxy.ts. No browser/detector loop or screenshot changes. PRODUCT.md and .impeccable/direction.md now reflect the latest English-only/supplied-logo direction. The direction file's historical base palette is superseded by the final CSS brand overrides recorded here. The current refinement removes automatic dark-theme rules and the green story-band overrides; public cream surfaces and the transparent shared BrandMark supersede the earlier large/tiled header logo. Scanned components/brand.tsx, shell.tsx, app/[locale]/not-found.tsx, the final globals.css cascade and styleguide.tsx for this narrow handoff. Unrelated module, motion, form and responsive guidance is preserved. -->
