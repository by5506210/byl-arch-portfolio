# Implementation Plan — Bryan Youn Portfolio

## Phase 1: Project Scaffolding (~5 min)
1. Set up folder structure: `src/`, `assets/images/`, `assets/fonts/`
2. Create `index.html` (landing + slideshow), `projects.html`, `about.html`, `contact.html`, and individual project pages
3. Install dependencies: GSAP (+ ScrollTrigger), Lenis, Barba.js via CDN links
4. Copy and organize project images into `assets/images/` with clean filenames
5. Add Google Fonts link for Space Mono (Helvetica Neue via system font stack)

## Phase 2: Landing Page (~15 min)
1. Build HTML structure: full-viewport black container, hidden text lines, bold final link
2. CSS: black background, monospace typography, cursor blink animation, no-scroll lockout
3. JS: Typed animation sequence using GSAP timeline
   - Sequential "click here" lines with accelerating timing
   - Final bold line reveal
   - Cursor blink effect
4. Hover state on bold link (shift to white)
5. Click handler: trigger transition to slideshow

## Phase 3: Landing-to-Slideshow Transition (~10 min)
1. Build the dissolve/crack-upward animation (GSAP)
2. Black overlay lifts to reveal concrete gray beneath
3. Navigation bar fades in (top-right)
4. First hero image fades/slides into view
5. "Scroll to explore" hint appears with arrow animation

## Phase 4: Stacking Image Slideshow (~20 min)
1. HTML: Pinned container with all 10 hero images stacked (absolute positioned)
2. CSS: Images sized to ~85% viewport width, centered, with project title overlays
3. Lenis smooth scroll initialization
4. GSAP ScrollTrigger setup:
   - Pin the slideshow container for the full scroll duration
   - Map scroll progress to image transitions
   - Each scroll step: next image slides up with `power2.inOut`, stops at 80% coverage
   - Reverse on scroll-up
5. Project title fade-in on each image
6. "Scroll to explore" hint: show on load, hide after first scroll event
7. Coming Soon cards: styled text cards matching the image dimensions
8. Click detection on each image (not Coming Soon)

## Phase 5: Page Transition System (~10 min)
1. Initialize Barba.js with page containers
2. Define transitions:
   - Slideshow -> Project page: zoom-in (GSAP scales clicked image to fullscreen, then loads project page)
   - Project page -> Slideshow: reverse zoom or fade-back, restore scroll position
   - Nav link transitions: fade-through with brief concrete flash
3. Custom cursor: crosshair on image hover
4. Ensure Lenis and ScrollTrigger reinitialize on each page transition

## Phase 6: Project Pages (~15 min)
1. Create template structure for each project type:
   - Architecture: hero + vertical image gallery with scroll-triggered fade-rise
   - Interior & Furniture: hero + gallery (same structure, fewer images)
   - Design: hero only, centered with generous whitespace
   - Coming Soon: title + "Coming Soon" centered
2. Build individual pages:
   - `the-triad.html` (4 images)
   - `eden-museum.html` (7 images + video embed)
   - `osterio-novo.html` (coming soon)
   - `tolman.html` (1 image)
   - `maple-xi.html` (1 image)
   - `aphelion.html` (3 images)
   - `morphic-vector.html` (coming soon)
   - `modulor.html` (1 image)
   - `act-before-it-burns.html` (1 image)
   - `marty-supreme.html` (1 image)
3. Shared components: back arrow, nav bar, hero gradient overlay
4. GSAP ScrollTrigger for image reveal animations

## Phase 7: Projects Index Page (~10 min)
1. HTML: Three category sections with project text links
2. CSS: Clean typographic layout, category headers in Space Mono
3. Hover thumbnail interaction: image appears on hover, positioned near cursor or slides from right
4. Coming Soon items: grayed out, no hover effect
5. Click links to individual project pages via Barba.js

## Phase 8: About Me Page (~10 min)
1. HTML: Two-column layout (photo left, text right)
2. Profile photo (B&W film grain)
3. Bio, Education, Resume sections with proper typographic hierarchy
4. Responsive: collapse to single column on mobile

## Phase 9: Contact Me Page (~5 min)
1. Centered layout: "GET IN TOUCH" label + large email link
2. `mailto:` href
3. Minimal styling

## Phase 10: Responsive & Polish (~15 min)
1. Mobile breakpoints: nav hamburger, single-column layouts
2. Touch support: swipe gestures for slideshow on mobile
3. Performance: lazy-load images, optimize image sizes
4. Favicon
5. Meta tags (title, description, og:image for social sharing)
6. Cross-browser testing
7. Deploy to hosting platform
