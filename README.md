# LLM-Driven Target Trial Emulation — Project Page

Project website for **"LLM-Driven Target Trial Emulation with Human-in-the-Loop Validation for Randomized Trial: Automated Protocol Extraction and Real-World Outcome Evaluation"**
Samrat Kumar Dey, Adnan I. Qureshi, Chi-Ren Shyu · University of Missouri

- **AMIA 2026 Annual Symposium — Podium Presentation**
- **medRxiv preprint:** https://www.medrxiv.org/content/10.64898/2026.04.09.26350523v1.full (DOI 10.64898/2026.04.09.26350523)

## Repository layout

```
index.html                     # the page (plain HTML, no build step)
static/css/style.css           # styles, light + dark theme tokens
static/js/main.js              # interactive parts: pipeline stepper, DP tabs, HITL diff,
                               # forest plot, sortable outcomes table, BibTeX copy, lightbox
static/images/*.png            # Figures 1, 2, 3A, 3B, 3C, 4 + Kaplan–Meier Figures S1, S2
static/pdf/Dey_LLM-TTE_AMIA2026.pdf   # camera-ready manuscript
.nojekyll                      # tells GitHub Pages to serve files as-is
```

## Publish on GitHub Pages

1. Create a new public repository (e.g. `LLM-TTE`) and push these files to the `main` branch:
   ```bash
   git init && git add . && git commit -m "Project page"
   git branch -M main
   git remote add origin https://github.com/<user-or-org>/LLM-TTE.git
   git push -u origin main
   ```
2. In the repository: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `(root)`**.
3. The site appears at `https://<user-or-org>.github.io/LLM-TTE/` within a minute or two.

The **GitHub** button in the "Data & Code Availability" card fills in its own link from the Pages URL, so it points at this repository automatically (it is hidden when the page is opened locally).

## Common edits

| What | Where |
|---|---|
| Add the AMIA proceedings citation once published | `bibs.amia` in `static/js/main.js` |
| Link a public code repository | the **Code** button in `index.html` (currently jumps to the availability note, since code is available on request) |
| Add author homepages | wrap names in `.authors` in `index.html` with `<a href="…">` |
| Add slides or a talk video after the podium session | add another `<a class="btn ghost">` inside `.btns` in the hero |
| Remove the hosted PDF (e.g. for copyright) | delete `static/pdf/…` and point the **Paper** button to medRxiv |

Preview locally: `python3 -m http.server` in this folder, then open http://localhost:8000.

Page layout adapted from the [Bangla MedConv](https://cimilab.github.io/Bangla_MedConv) project page.
