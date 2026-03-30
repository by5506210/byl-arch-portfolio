# Bryan Youn — Portfolio Website Design

## Overview

A portfolio website for Bryan Youn, a sophomore studying Design Innovation and Society, Biochemistry, and Architecture at UW-Madison. The site opens with a deliberately raw, anti-design landing page that leads into a visually rich, animation-driven portfolio experience.

The design philosophy merges Swiss minimalism (clean grids, restrained typography) with brutalist rawness (exposed structure, bold type, unapologetic layouts). The website itself becomes a spatial experience — mirroring Bryan's interest in "spatial designs that convey narrative and experiences."

## Tech Stack

- **Vanilla HTML/CSS/JS** — No framework overhead. Maximum animation control.
- **GSAP (GreenSock)** — Core animation engine. ScrollTrigger plugin for scroll-driven stacking slideshow.
- **Lenis** — Smooth scroll library for premium scroll feel.
- **Barba.js** — Seamless page transitions without full page reloads.

## Color Palette

| Context | Color | Hex |
|---------|-------|-----|
| Landing page background | Black | `#0a0a0a` |
| Landing page "click here" text | Dark gray | `#333333` |
| Landing page bold link | Concrete | `#e8e4df` |
| Portfolio background | Concrete gray | `#e8e4df` |
| Primary text | Near-black | `#1a1a1a` |
| Nav / UI labels | Dark gray | `#333333` |

## Typography

| Role | Font | Style |
|------|------|-------|
| Landing page text | Space Mono | Monospace, regular |
| UI labels, category tags | Space Mono | Monospace, uppercase, small |
| Headings | Helvetica Neue | Sans-serif, bold |
| Body text | Helvetica Neue | Sans-serif, regular |

## Site Architecture

```
BLACK LANDING PAGE (typed animation)
    |
    v  (click bold link -> black-to-concrete transition)
    |
STACKING IMAGE SLIDESHOW (concrete gray bg)
    |   - click image -> zoom-in to PROJECT PAGE
    |   - nav bar (top-right): Projects | About Me | Contact Me
    |
    +-- PROJECT PAGES (layout varies by type)
    |     +-- Architecture: multi-image vertical gallery
    |     +-- Interior & Furniture: image gallery
    |     +-- Design: single hero image, generous whitespace
    |
    +-- PROJECTS INDEX (categorized text list, hover thumbnails)
    |
    +-- ABOUT ME (profile photo + bio + resume)
    |
    +-- CONTACT ME (centered email)
```

---

## Page Designs

### 1. Landing Page

Full viewport, solid black. No navigation visible.

**Typed animation sequence:**
1. Monospace cursor blinks alone for 1 second
2. "click here" types out in dark gray (`#333`) — barely visible against black
3. Pause 0.3s. Another "click here" types below it, same dark gray
4. Repeats with acceleration — each line types faster than the last
5. ~15-20 lines stack up vertically, filling the screen
6. Brief pause (0.5s)
7. Final line: **"click here."** — bold, `#e8e4df` (concrete color), immediately visible
8. All previous gray lines fade slightly darker
9. Bold link has a blinking monospace cursor at the end
10. On hover: bold text shifts to white
11. On click: black background dissolves/cracks upward, revealing concrete gray slideshow

**Constraints:**
- No scroll allowed — single viewport moment
- Left-aligned text, tight line spacing (terminal log aesthetic)

### 2. Stacking Image Slideshow

Concrete gray background. Navigation fades in (top-right). Full-viewport experience.

**Layout:**
- Hero images fill ~85% viewport width, centered
- Project title in bottom-left corner of each image (Helvetica Neue, white, text-shadow)
- "Scroll to explore" hint with animated arrow on first load, disappears after first scroll

**Scroll behavior:**
- Scrolling does NOT move the page — triggers next image to slide up from below
- Each image slides up with `power2.inOut` ease, covering ~80% of previous image
- Previous images stay pinned — top ~20% peeks above
- Stack accumulates like geological strata
- Scrolling back up reverses the animation

**Project sequence (scroll order):**
1. The Triad — `ai-render-6263601.jpg`
2. Osterio Novo — Coming Soon card
3. Eden Museum of Modern Art — `Generated Image March 18, 2026 - 9_18PM.jpg` + "Coming Soon" badge
4. Tolman Apartment Living Space — `Image1_000.png`
5. Maple Xi Apartment Interior — `Render Concept 3.png`
6. Aphelion Lamp — `YOUN_BRYAN_Project2_Image 1.jpg`
7. Morphic Vector System — Coming Soon card
8. Modulor Book Cover — `bookcover final.png`
9. ACT BEFORE IT BURNS Poster — `YOUN_DS140_Illustrator_4_Poster-1.png`
10. MARTY SUPREME Poster — `Youn_DS140_Photoshop_4_Composition.jpg`

**Click interaction:**
- Cursor changes to custom crosshair/enter icon on hover
- Click triggers zoom-in transition to project page (~0.6s GSAP)
- Coming Soon items: not clickable, default cursor, subtle tooltip

### 3. Project Pages

**Transition in:** Clicked hero image scales up to fill viewport (~0.6s), content fades in below.

**Shared elements:**
- Hero image pinned at top, full-width
- Project title (Helvetica Neue, large) + category tag (Space Mono, small, uppercase)
- Subtle dark gradient overlay at bottom of hero for text legibility
- Back arrow (top-left) returns to slideshow at same scroll position
- Nav bar remains visible (top-right)

**Architecture projects (The Triad, Eden Museum):**
- Vertical scroll of full-width images
- Generous concrete-gray gaps between images
- Images fade-and-rise into view on scroll (GSAP ScrollTrigger)
- The Triad: exterior render -> interior 1 -> interior 2 -> exploded axonometric
- Eden Museum: waterfall render 1 -> waterfall render 2 -> interior reception -> section cut -> aerial plan -> SketchUp perspective -> video embed

**Interior & Furniture (Tolman, Maple Xi, Aphelion):**
- Same vertical image gallery format
- Aphelion: front view -> top view -> lit from below (3 images)
- Tolman / Maple Xi: single image each (expandable later)

**Design (Modulor, ACT BEFORE IT BURNS, MARTY SUPREME):**
- Single hero image, large and centered
- Generous whitespace — the image IS the project

**Coming Soon (Osterio Novo, Morphic Vector System):**
- Minimal page: title + "Coming Soon" in Space Mono, centered
- No images

### 4. Projects Index Page

Accessed via "Projects" in nav.

- Clean layout on concrete gray
- Three sections with category headers (Space Mono, uppercase, small)
- Project names as text links (Helvetica Neue)
- Hover: thumbnail slides in from right or fades beside cursor
- Coming Soon items: listed but grayed out, no hover thumbnail

```
ARCHITECTURE
  The Triad
  Osterio Novo (Coming Soon)
  Eden Museum of Modern Art (Coming Soon)

INTERIOR & FURNITURE
  Tolman Apartment Living Space
  Maple Xi Apartment Interior
  Aphelion Lamp
  Morphic Vector System (Coming Soon)

DESIGN
  Modulor Book Cover
  ACT BEFORE IT BURNS Poster
  MARTY SUPREME Poster
```

### 5. About Me Page

- Two-column layout (wide screens), stacked on mobile
- Left: Profile photo (B&W film grain), displayed large
- Right: Bio text in Helvetica Neue

Bio:
> Bryan, a sophomore studying Design Innovation and Society, Biochemistry, and Architecture.
> I love exploring spatial designs that convey narrative and experiences.

Education:
> University of Wisconsin - Madison
> Design Innovation and Society, Biochemistry, and Architecture

Resume:
> TAAL Architects: Intern (2024/07~2024/08, 2025/01)
> Interdisciplinary Researcher: UW-Madison Department of Landscape Architecture, Department of Chemistry, Sasaki (2025/08~)
> BYL Architecture (Content Creation) (2024/06~)

- Section headers in Space Mono (uppercase)
- Content in Helvetica Neue
- Minimal — no decorative elements

### 6. Contact Me Page

- Centered, nearly empty page
- `GET IN TOUCH` in Space Mono (small, uppercase) above
- `blyoun@wisc.edu` in Helvetica Neue (large), centered
- `mailto:` link on click

---

## Assets

### Profile Photo
- `Projects/KakaoTalk_20260330_032829718.jpg` — B&W film grain portrait

### Project Images

**The Triad (4 images):**
- `Architecture/The Triad/ai-render-6263601.jpg` (hero — exterior)
- `Architecture/The Triad/Generated Image March 30, 2026 - 3_01AM.jpg` (interior 1)
- `Architecture/The Triad/Generated Image March 30, 2026 - 2_58AM.jpg` (interior 2)
- `Architecture/The Triad/final render.jpg` (exploded axonometric)

**Eden Museum of Modern Art (7 images + 1 video):**
- `Architecture/Eden Art Museum/Generated Image March 18, 2026 - 9_18PM.jpg` (hero — waterfall 1)
- `Architecture/Eden Art Museum/Generated Image March 18, 2026 - 10_05PM.jpg` (waterfall 2)
- `Architecture/Eden Art Museum/Generated Image March 19, 2026 - 2_51AM.jpg` (interior reception)
- `Architecture/Eden Art Museum/Image63.png` (interior reception alt)
- `Architecture/Eden Art Museum/Image10_000.png` (aerial plan)
- `Architecture/Eden Art Museum/Image18.png` (section cut)
- `Architecture/Eden Art Museum/Untitled.jpg` (SketchUp perspective)
- `Architecture/Eden Art Museum/KakaoTalk_20260325_015253307.mp4` (video)

**Tolman Apartment Living Space (1 image):**
- `Interior & Furniture/Tolman Apartment Living Space/Image1_000.png`

**Maple Xi Apartment Interior (1 image):**
- `Interior & Furniture/Maple Xi Apartment Interior/Render Concept 3.png`

**Aphelion Lamp (3 images):**
- `Interior & Furniture/Aphelion/YOUN_BRYAN_Project2_Image 1.jpg` (hero — front)
- `Interior & Furniture/Aphelion/YOUN_BRYAN_Project2_Image 2.jpg` (top view)
- `Interior & Furniture/Aphelion/YOUN_BRYAN_Project2_Image 3.jpg` (lit from below)

**Modulor Book Cover (2 images):**
- `Design/Modulor/bookcover final.png` (hero)
- `Design/Modulor/Youn_Bryan_Project_III_No.3_BookJacket_FA25-1.png`

**ACT BEFORE IT BURNS Poster (1 image):**
- `Design/ACT BEFORE IT BURNS Poster/YOUN_DS140_Illustrator_4_Poster-1.png`

**MARTY SUPREME Poster (1 image):**
- `Design/MARTY SUPREME Poster/Youn_DS140_Photoshop_4_Composition.jpg`

---

## Responsive Considerations

- Landing page: works identically on mobile (typed text scales with viewport)
- Slideshow: images scale to viewport width, stacking behavior unchanged
- Project pages: single column on all screens
- About Me: two-column -> single column on mobile
- Nav: collapses to hamburger menu on mobile
- Touch: swipe up/down replaces scroll wheel for slideshow on mobile

## Hosting

Static files — deployable to GitHub Pages, Netlify, or Vercel (free tier).
