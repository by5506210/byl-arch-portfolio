# BYL Architecture Portfolio — Session Context

## Project Overview
Portfolio website for **Bryan Youn**, a sophomore at UW-Madison studying Design Innovation and Society, Biochemistry, and Architecture. The site showcases architecture, interior design, and graphic design work.

## Design Decisions

### Aesthetic
- **Swiss minimalism + brutalist rawness** — Clean grids with bold, unapologetic typography
- Two-tone color: **black landing page** → **concrete gray (`#e8e4df`) portfolio**
- Typography mix: **Space Mono** (monospace for landing/UI) + **Helvetica Neue** (sans-serif for headings/body)

### Tech Stack
- Vanilla HTML/CSS/JS (no framework)
- GSAP (animation, used for zoom transitions)
- Lenis (smooth scroll)
- No Barba.js yet (planned for seamless page transitions)

### Landing Page
- Typed "click here" animation: 10 lines, character-by-character with acceleration
- Total animation time: ~1.5 seconds
- Non-bold lines in dark gray (`#333`), final bold line in concrete color (`#e8e4df`)
- Bold line has blinking cursor
- On click: horizontal line draws across, then black landing slides up revealing portfolio
- BYL monogram loading screen before animation
- Skip animation when returning via `#portfolio` hash

### Stacking Image Slideshow
- Scroll-driven (wheel, touch, keyboard)
- New images slide up ON TOP of previous ones
- ~20% peek of previous images (stacking effect)
- Each slide has solid concrete background, z-index = index + 1
- Uses pure CSS transitions (not GSAP) for slide movement
- Progress dots on the right side
- Title clip-mask reveal animation on slide entry
- Image hover zoom (scale 1.05 → 1.03)
- Click triggers zoom-in transition to project page

### Project Sequence (slideshow order)
1. The Triad (Architecture)
2. Osterio Novo (Coming Soon)
3. Eden Museum of Modern Art (Architecture)
4. Tolman Apartment Living Space (Interior)
5. Maple Xi Apartment Interior (Interior)
6. Aphelion Lamp (Interior & Furniture)
7. Morphic Vector System (Coming Soon)
8. Modulor Book Cover (Design)
9. ACT BEFORE IT BURNS Poster (Design)
10. MARTY SUPREME Poster (Design)

### Project Pages
- **Architecture** (The Triad, Eden Museum): Multi-image vertical gallery with clip-path wipe-reveal on scroll
- **Interior & Furniture** (Tolman, Maple Xi, Aphelion): Same gallery format
- **Design** (Modulor, ACT BEFORE IT BURNS, MARTY SUPREME): Single hero image centered
- **Coming Soon** (Osterio Novo, Morphic Vector): Title + "Coming Soon" centered
- Hero text animations: category and title slide up with mask

### Navigation
- Top-right nav: Projects | About Me | Contact Me
- Back arrow (← Back) on every subpage, links to `index.html#portfolio`
- Magnetic nav links (pull toward cursor on hover)

### Visual Polish
- **Grain/noise texture overlay** on all pages (opacity 0.04, animated shift)
- **iPad-style custom cursor**: 12px semi-transparent dot, snaps to link bounds, grows on image hover
  - Light cursor on dark landing page
  - Dark cursor on light portfolio pages
  - z-index: 10000 (above grain overlay)
- **Project list hover**: items shift right 8px
- **About page**: photo slow-zoom on hover
- Gallery images: clip-path wipe-reveal from bottom

## File Structure
```
byl-arch/
  index.html                    — Landing + slideshow (main entry)
  src/css/style.css             — All styles
  src/js/landing.js             — Typed animation + transition
  src/js/slideshow.js           — Stacking scroll behavior + progress dots
  src/js/project-page.js        — Gallery clip-reveal on scroll
  src/js/cursor.js              — iPad-style cursor + magnetic nav
  pages/
    projects.html               — Categorized project index
    about.html                  — Profile photo + bio + resume
    contact.html                — Email centered
    the-triad.html              — 4 images (gallery)
    eden-museum.html            — 7 images + 1 video (gallery)
    tolman.html                 — 1 image (hero only)
    maple-xi.html               — 1 image (hero only)
    aphelion.html               — 3 images (gallery)
    modulor.html                — Single image centered
    act-before-it-burns.html    — Single image centered
    marty-supreme.html          — Single image centered
    osterio-novo.html           — Coming soon
    morphic-vector.html         — Coming soon
  assets/images/
    the-triad/                  — hero.jpg, interior-1.jpg, interior-2.jpg, axonometric.jpg
    eden-museum/                — hero.jpg, waterfall-2.jpg, interior-reception.jpg, interior-reception-alt.png, section-cut.png, aerial-plan.png, perspective.jpg, walkthrough.mp4
    tolman/                     — hero.png
    maple-xi/                   — hero.png
    aphelion/                   — hero.jpg, top-view.jpg, lit-below.jpg
    modulor/                    — hero.png, alt.png
    act-before-it-burns/        — hero.png
    marty-supreme/              — hero.jpg
    profile/                    — bryan.jpg (B&W film grain portrait)
  docs/plans/
    2026-03-30-portfolio-website-design.md
    2026-03-30-portfolio-implementation-plan.md
```

## About Bryan
- Sophomore at University of Wisconsin - Madison
- Studies: Design Innovation and Society, Biochemistry, Architecture
- "I love exploring spatial designs that convey narrative and experiences."
- Education: UW-Madison
- Resume:
  - TAAL Architects: Intern (2024/07–2024/08, 2025/01)
  - Interdisciplinary Researcher: UW-Madison Dept of Landscape Architecture, Dept of Chemistry, Sasaki (2025/08–)
  - BYL Architecture (Content Creation) (2024/06–)
- Contact: blyoun@wisc.edu

## GitHub
- Remote: https://github.com/by5506210/byl-arch-portfolio.git
- Branch: main

## Known Issues / TODO
- Barba.js page transitions not yet implemented (currently hard page navigations)
- No project descriptions yet (purely visual)
- Sound design (optional subtle click/type sounds) not implemented
- Image optimization / lazy loading not implemented
- Favicon not added
- Meta tags / og:image for social sharing not added
- Mobile hamburger menu not implemented (nav links are small but visible)

## Git History
1. `f906a09` — Initial build
2. `f6aa6f0` — Sync from dev environment
3. `adcf232` — Fix slide stacking, speed up landing, skip landing on back nav
4. `a912dc4` — Restore typing animation, fix slide stacking with pure CSS transitions
5. `363f9a7` — Major design upgrade: grain, cursor, animations, progress dots
6. `fec0a00` — Redesign cursor: iPad-style
7. `5981c2f` — Fix cursor visibility: light/dark based on background
8. `d7e6745` — Fix cursor z-index above grain overlay
