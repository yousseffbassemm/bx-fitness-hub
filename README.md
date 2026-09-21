# BX Fitness Hub

Website for BX Fitness Hub, built with Next.js (App Router), TypeScript and
Tailwind CSS.

## Setup on a fresh Mac

You need [Homebrew](https://brew.sh) first. Then:

```bash
brew install node          # installs Node and npm
git clone https://github.com/yousseffbassemm/bx-fitness-hub.git
cd bx-fitness-hub
npm install                # installs project dependencies
npm run dev                # starts the dev server
```

Open <http://localhost:3000>. The page reloads as you edit files.

Other scripts:

```bash
npm run build   # production build - run this before pushing
npm run lint    # ESLint
```

## Daily Git routine

**Before you start working:**

```bash
git pull
```

**After you finish a piece of work:**

```bash
git add .
git commit -m "describe what you changed"
git push
```

Pull first, every time. It keeps the two of us from ending up with conflicting
copies of `main`.

Two rules:

- **Never force-push and never rewrite history** (no `git push --force`, no
  `git rebase` on pushed commits). It deletes the other person's work.
- If `git push` is rejected, run `git pull` and resolve any conflict, then push
  again. Do not reach for `--force`.

## Who owns what

| Area | Owner |
| --- | --- |
| Layout, shared components (`src/components/`), theme | Youssef |
| Home (`/`) | Youssef |
| Classes (`/classes`) | Youssef |
| Trainers (`/trainers`) | Karma |
| Pricing (`/pricing`) | Karma |
| Contact (`/contact`) | Karma |

Stick to your own files where you can. If you need a change in a shared file
(`src/app/layout.tsx`, `src/components/`, `src/app/globals.css`), tell the
other person before you push it.

## Project structure

```
src/
  app/
    layout.tsx        root layout - Navbar + Footer wrap every page
    globals.css       Tailwind import + brand design tokens
    page.tsx          Home
    classes/page.tsx
    trainers/page.tsx
    pricing/page.tsx
    contact/page.tsx
  components/
    Navbar.tsx
    Footer.tsx
public/               static files (images, icons)
```

## Brand colors and fonts

All brand values are **placeholders** right now and live in two files:

- `src/app/globals.css` - colors, as CSS variables on `:root`
- `src/app/layout.tsx` - the two fonts, loaded through `next/font`

The colors are exposed to Tailwind, so use them as normal utility classes
rather than hardcoding hex values:

```tsx
<p className="text-brand-muted">...</p>
<button className="bg-brand-primary hover:bg-brand-primary-dark">...</button>
<h2 className="font-heading">...</h2>
```

Available: `brand-primary`, `brand-primary-dark`, `brand-accent`, `brand-ink`,
`brand-muted`, `brand-surface`, `brand-surface-alt`, `brand-border`, plus the
`font-heading` and `font-body` families.

Swap the placeholder values in those two files and the whole site updates.

## Content placeholders

Pages currently contain a heading and `TODO` comments only. Real gym details -
prices, class schedules, trainer names, the address - are **not** in the repo
yet. Confirm each one before adding it; do not guess.

## Style notes

- Mobile-first: write the small-screen styles first, then add `sm:` / `md:`
  variants for larger screens.
- Keep components simple. A component is a Server Component by default; only
  add `"use client"` when you need state or browser events (as `Navbar.tsx`
  does).
- Run `npm run build` before pushing so you do not push code that fails to
  compile.
