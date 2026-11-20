# ARENA frontend

Vue 3 + TypeScript, built with Vite. Start the complete application from the repository root with `npm run dev`.

See the [project README](../README.md) for installation, MongoDB configuration, API documentation, deployment and GitHub instructions. The [interview guide](../docs/INTERVIEW_GUIDE.md) explains each development step.

The frontend uses `/api` by default. Vite proxies `/api` and `/about` to Express during development; Express serves the built frontend in production. For a separately hosted API, set `VITE_API_URL` at build time.
