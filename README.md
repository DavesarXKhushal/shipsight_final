# ShipSight Web Recorder

This is a React + Vite project for recording packing videos and associating them with barcodes typed or scanned. It uses Tailwind CSS and shadcn-ui components for a clean UI.

## Tech Stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Getting Started

Prerequisites: Node.js (v18+) and npm installed. Using `nvm` is recommended.

```sh
# Install dependencies
npm install

# Start the dev server
npm run dev

# Build for production
npm run build

# Preview the production build
npm run preview
```

## Project Structure

- `src/` contains all application code
- `public/` contains static assets
- `vite.config.ts` contains Vite configuration and path aliases

## Deployment

### Vercel (recommended)

This app is a static Vite build and deploys cleanly on Vercel.

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

Steps:
- Push this repo to GitHub (main branch).
- In Vercel, import the GitHub repo and select the `main` branch.
- Ensure the build command is `npm run build` and the output is `dist`.
- Deploy — Vercel will auto-build and serve static files from `dist`.

To verify locally before deploy:

```sh
npm run build
npm run preview
# open the provided localhost URL and test barcode recording
```

### Other hosts

Any static host that serves the `dist/` folder will work.

## License

Proprietary or your chosen license.
