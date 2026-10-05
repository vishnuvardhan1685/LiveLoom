---
name: Loom Console
colors:
  surface: '#121315'
  surface-dim: '#121315'
  surface-bright: '#38393b'
  surface-container-lowest: '#0d0e10'
  surface-container-low: '#1b1c1e'
  surface-container: '#1f2022'
  surface-container-high: '#292a2c'
  surface-container-highest: '#343537'
  on-surface: '#e3e2e4'
  on-surface-variant: '#e3bdbf'
  inverse-surface: '#e3e2e4'
  inverse-on-surface: '#303032'
  outline: '#aa888a'
  outline-variant: '#5b4041'
  surface-tint: '#ffb2b7'
  primary: '#ffb2b7'
  on-primary: '#67001b'
  primary-container: '#ff516a'
  on-primary-container: '#5b0017'
  inverse-primary: '#bc0b3b'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00a572'
  on-tertiary-container: '#00311f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdadb'
  primary-fixed-dim: '#ffb2b7'
  on-primary-fixed: '#40000d'
  on-primary-fixed-variant: '#92002a'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#121315'
  on-background: '#e3e2e4'
  surface-variant: '#343537'
typography:
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0em
  body-lg:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-md:
    fontFamily: Space Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  code-editor:
    fontFamily: Space Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  label-md:
    fontFamily: Space Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
  label-sm:
    fontFamily: Space Mono
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
    letterSpacing: 0.08em
  metric-tabular:
    fontFamily: Space Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0em
spacing:
  gutter: 1px
  gutter-loose: 8px
  margin: 0px
  margin-panel: 12px
  space-xs: 2px
  space-sm: 4px
  space-md: 8px
  space-lg: 12px
  space-xl: 16px
  space-2xl: 24px
---

## Brand & Style

This design system establishes an unapologetically brutalist, ultra-dense developer workstation tailored for concurrent multiplayer engineering. Rejecting generic consumer SaaS tropes—such as amorphous ambient blurs, gradient fills, and pill-shaped controls—it embraces strict 0px geometry, tactile technical gridlines, and intense mechanical clarity. 

The aesthetic references vintage automated textile looms translated into digital tele-type consoles: warp and weft coordinates, hairline guide paths, sharp status displays, and zero-latency collaborative presence. The emotional resonance is focused, rigorous, and surgical. Interfaces prioritize information density, rapid scanning, and sub-millisecond precision over decorative soft padding.

## Colors

The palette operates on a disciplined charcoal and graphite chassis, punctured by high-contrast collaborator presence lanes and operational state indicators.

### Base Structural Surfaces
- Surface Canvas: `#121315` (Deepest terminal base)
- Surface Panel: `#18191C` (Tooling sidebars, explorer, and inspector shells)
- Surface Tab/Input: `#1E2024` (Editor buffers, input troughs, tab strips)
- Surface Active/Overlay: `#26282E` (Active row highlight, modal command palettes)
- Border Hairline: `#2E3238` (Structural borders, split pane separators)
- Grid Trace Line: `rgba(244, 63, 94, 0.15)` (Subtle warp-and-weft SVG loom overlays)

### Multiplayer Presence Matrix
Color is functional, never decorative. It denotes ownership of locks, active text selections, caret flags, and stream channels:
- Presence Crimson / Sora K. (Primary): `#F43F5E` (Caret, tag `#FB7185`, selection fill `rgba(244, 63, 94, 0.18)`)
- Presence Cyan / Local Operator (Secondary): `#06B6D4` (Local caret, tag `#22D3EE`, selection fill `rgba(6, 182, 212, 0.20)`)
- Presence Mint / Elena V. (Tertiary): `#10B981` (Caret, tag `#34D399`, selection fill `rgba(16, 185, 129, 0.18)`)
- Presence Amber / Marcus T.: `#F59E0B` (Caret, tag `#FBBF24`, selection fill `rgba(245, 158, 11, 0.18)`)

### Text & Metrics
- Text Bright: `#F4F5F6` (Identifiers, primary commands, active tokens)
- Text Muted: `#8B909A` (Code comments, line numbers, inactive controls)
- Text Ghost: `#4B515D` (Guides, indent thread tracks, column rulers)

## Typography

The typography system maintains an explicit bifurcation between system chrome and operational code buffers.

1. **Space Grotesk (Navigation & Workspace Hierarchy)**: Deployed across panel titles, modal command banners, active file tree roots, and module headers. Its condensed industrial quirks bring structural personality without wasting horizontal real estate.
2. **Space Mono (Buffer, Terminal, Labels, and Metrics)**: Applied to all line-level code, status bar readouts, git branch references, latency counters, and collaborator cursor badges. All numbers must render with tabular tracking to prevent layout twitching during high-frequency real-time updates. Labels are predominantly uppercase with tracked out letter spacing for mechanical readability at micro sizes.

## Layout & Spacing

The layout is structured around an impenetrable modular docking system. 

### Grid & Spatial Model
- **Hairline Tiling**: Main IDE regions (Explorer, Code Canvas, Terminal Dock, Collaboration Inspector) are separated by fixed `1px` structural borders (`#2E3238`) rather than padded gutters. The gutter distance variable is set strictly to `1px` for panel separation.
- **Rhythm & Compaction**: Internal element spacing is built upon a dense 4px base scale (`2px`, `4px`, `8px`, `12px`, `16px`). Line-height in editor panes is fixed to 20px intervals to synchronize code lines, gutter numbering, and collaborator avatar pips along an identical vertical scanline.
- **Loom Trace Weft**: Multi-pane intersections use dashed 1px SVG connector traces (`stroke-dasharray: 2 2`) evoking automated textile machinery guiding parallel warp threads.

### Breakpoints & Adaptations
- **Desktop (>1024px)**: Full multi-pane workflow. Persistent sidebar (240px fixed), fluid editor viewports (single or split-column), persistent status bar (24px fixed height), and bottom collapsible execution terminal.
- **Compact / Tablet (640px - 1023px)**: Sidebars collapse to icon-only vertical strips (40px). Editor panels stack in single view with tabbed access.
- **Mobile (<640px)**: Read-only inspection and emergency patch console. Dock panels convert into full-screen tabbed overlays with an anchored mobile bottom bar.

## Elevation & Depth

This design system avoids all diffuse, soft drop shadows. Visual depth is established purely through surface value progression, hairline borders, and hard-edged technical layering.

- **Level 0 (Recessed Base)**: `#121315` — Canvas backing, gutters, line number rails.
- **Level 1 (Working Surface)**: `#18191C` — Side panels, explorer trees, terminal buffers. Separated by `1px solid #2E3238`.
- **Level 2 (Active Document / Focus)**: `#1E2024` — The currently focused file pane, selected row, active tab container.
- **Level 3 (Command Overlay & Menus)**: `#26282E` — Palette popups, autocomplete suggestions, context menus. Bordered by `1px solid #F43F5E` (or current presence highlight), with a hard, zero-blur technical drop: `box-shadow: 4px 4px 0px 0px #000000`.
- **Weave Guide Depth**: Active focus does not illuminate surfaces with blur; instead, a solid `1px` high-contrast thread runs directly along the top border of the active document tab and along the active line gutter.

## Shapes

The geometry is defined by absolute corner sharpness. Every edge, button, container, input field, and collaborator cursor flag is locked to `0px` radius.

Angles are strict 90-degree intersections. Diagonal lines are restricted solely to vector status indicators (e.g., git branch merge icons, caret drop wedges, and corner resize gripper notches rendered with clean 45-degree pixel strokes). This uncompromising sharpness preserves dense information packing and reinforces the precision instrument narrative.

## Components

### Buttons & Interactive Triggers
- **Geometry**: Sharp 0px edges, height standard of 24px (compact) or 28px (default).
- **Primary Action**: Solid `#F43F5E` background, `#121315` text, bold `Space Mono` typography. Hover: invert to `#FB7185`. Active: scale inset `1px`.
- **Ghost Action**: Background transparent, `1px solid #2E3238`, `#F4F5F6` text. Hover: `1px solid #F43F5E` with text `#F43F5E`.
- **Icon Buttons**: Fixed 24x24px bounds with 1px hairline stroke icons. Hover triggers a `#26282E` background tile.

### Multi-Cursor Presence Indicators
- **Caret**: A crisp 2px solid vertical line matching collaborator color (e.g., `#F43F5E` for Sora, `#06B6D4` for Alex).
- **Flag Label**: Positioned directly atop the caret line. Height 14px, 0px radius, solid presence background, `#121315` text, `Space Mono` 9px uppercase.
- **Selection Box**: Transparent color block (`alpha: 0.18`) bounded by a 1px dashed perimeter matching collaborator identity.

### Active Tab & Thread Accents
- **Tab Header**: Height 30px, background `#18191C`, inactive text `#8B909A`, border-right `1px solid #2E3238`.
- **Active State**: Background `#1E2024`, text `#F4F5F6`, accompanied by an uninterrupted 2px horizontal top stripe in `#F43F5E`. 
- **Loom Weft Trace**: Active tab border extends seamlessly into the active editor pane's left rule, simulating a continuous strand running down the active code file.

### Input Fields & Command Palettes
- **Command Palette (Cmd+P / Cmd+K)**: Centered overlay, 560px width. Background `#18191C`, bordered by `1px solid #F43F5E`. Hard offset shadow `4px 4px 0px #000000`. 
- **Input Line**: Fixed 32px height, 0px border, font `Space Mono` 13px, caret `#F43F5E`, no default OS focus rings.

### Editor Gutter & Line Numbers
- **Width**: Fixed 48px width, right-aligned numbers with `space-md` (8px) right inset.
- **Coloration**: Inactive `#4B515D`. Current execution line number illuminates in `#F4F5F6` with a solid 2px left border strip in `#F43F5E`.

### Telemetry Status Bar
- **Dimensions**: Anchored to bottom edge, height 22px, background `#121315`, border-top `1px solid #2E3238`.
- **Segments**: Modular hairline blocks containing tabular metrics:
  - Branch: `git:(main* ↑2)`
  - Cursor Coordinates: `Ln 142, Col 18`
  - Encoding: `UTF-8`
  - Telemetry: `RTT: 18ms [SYNCED]` in `#10B981`
- **Typography**: Strictly `Space Mono` 10px uppercase with `0.08em` tracking.

### Checkboxes, Radios, & Toggles
- **Checkbox**: 12x12px square box, 0px radius, `1px solid #4B515D`. Checked: Solid `#F43F5E` background with black inner check mark or cross.
- **Radio**: 12x12px diamond or square with inner filled square (no circular primitives).