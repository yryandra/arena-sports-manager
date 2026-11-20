# ARENA · Sports Operations

[Open the live application](https://arena-sports-manager.vercel.app) · [Interview guide](docs/INTERVIEW_GUIDE.md) · [Deployment guide](docs/DEPLOYMENT.md)

A sports competition management portfolio project, built with **Vue 3, TypeScript, Node.js, Express and MongoDB**. An original navy-and-lime interface brings athlete registration, competition entries, schedules and results into one workspace.

The visual direction takes inspiration from the bold sports presentation of [BORNAN](https://bornan.sport/) and [FIFA](https://www.fifa.com/en/). ARENA is an independent learning project, with fictional people and competitions, and is not affiliated with either organisation.

## Run locally

Requires **Node.js 24 LTS**, with npm. MongoDB is optional for the demo.

```bash
npm ci
npm --prefix client ci
npm run dev
```

Open **http://127.0.0.1:5173**. The API runs at **http://localhost:5000**. On Windows, use `npm.cmd` instead of `npm` if PowerShell blocks npm scripts.

The default demo runs without an `.env` file. It creates `data/demo.json` with 28 fictional athletes, eight competitions and 12 results. Changes are saved on the server and survive restarts. This runtime file is excluded from Git. Example competition dates are relative to the first run, then stay saved as normal records; edit them when demonstrating on a later day.

Use `.env.example` as a starting point if you need custom configuration. Never commit your real `.env`.

Browsing is public. To enable editing, run `npm run admin:setup` in an interactive terminal, choose your password, restart the server and use **Admin sign in**. The default username is `yryandra`. Only a salted scrypt password hash is saved in the ignored `.env` file. Without an administrator password, the local demo remains read-only.

## What you can do

- **Overview:** inspect actual record counts, featured competitions, today's schedule, published results and nation participation.
- **Athletes:** register, edit and delete athletes; search and filter by sport, country and status; sort, paginate and export the directory.
- **Competitions:** create and edit events, select athlete entries, manage capacity and set Scheduled, Live or Completed status. Open a card to inspect its start list and results.
- **Results:** record, edit, publish or remove individual performances. Places use the competition's scoring direction. Ties share a place, and provisional marks are ranked separately.
- **Schedule:** view competitions by date or across all dates, with sport filtering. Competition times use Arabia Standard Time (UTC+3).
- **Reports:** inspect sport and nation participation and download CSV reports for athletes, competitions and results.
- **Search:** use the search button or `Ctrl+K` / `Cmd+K` to find athletes and competitions.
- **Server-rendered page:** visit `/about` for a Pug page with current record counts and architecture information.

Football, basketball and tennis examples use individual skills performances; this project does not implement team match scoring or knockout brackets. Live is an operator-controlled competition status, rather than a connection to an official timing feed. Refresh the page to see changes made by another browser.

## Technologies and architecture

The browser renders Vue single-file components. TypeScript describes athletes, competitions and results. Axios sends JSON requests to Express. The routes validate allowed fields and relationships, while Mongoose schemas validate record shapes. A storage adapter saves records to either the demo JSON file or MongoDB.

```text
Vue 3 + TypeScript + Sass + Bootstrap Reboot
                    │ Axios / JSON / HTTP
                    ▼
           Express REST API + Pug
                    │
       Validation + relationship rules
                    │
          Mongoose schema validation
                    │
       Demo JSON file OR MongoDB adapter
```

Bootstrap Reboot provides the CSS foundation. Sass implements ARENA's visual system, responsive layouts and component styles. Photographs, country flags and the Manrope font are stored locally, so the interface does not make third-party asset requests. See [asset credits](docs/ASSETS.md).

```text
client/src/
  App.vue                 View navigation, filters, reporting and page composition
  components/             Reusable icons, cards, tables and record forms
  lib/api.ts              Axios client and reactive data loading
  lib/format.ts           Dates, ranking, performance formatting and CSV export
  types.ts                Shared frontend record types
  assets/main.scss        Design system and responsive styles
config/                   Database connection, sports and countries
models/                   Athlete, Event and Result schemas
routes/                   Resource endpoints and relationship rules
services/store.js         Demo and MongoDB storage adapters
data/seed.js              Fictional demonstration records
views/about.pug           Server-rendered information page
scripts/                  Development launcher and safe seed command
tests/                    HTTP integration tests and ranking tests
docs/                     Interview guide and asset credits
```

## MongoDB mode

Create a root `.env` from `.env.example` and set:

```dotenv
PORT=5000
STORAGE_MODE=mongodb
MONGODB_URI=mongodb://127.0.0.1:27017/arena
MONGODB_DB=arena
CLIENT_ORIGIN=http://localhost:5173
```

Start your local MongoDB instance or provide a MongoDB Atlas connection string, then run:

```bash
npm run seed
npm run dev
```

The seed command only inserts MongoDB demo data when all three collections are empty. It preserves existing records and refuses to seed a populated database. Demo mode's seed command creates data if missing and otherwise preserves it. An unavailable MongoDB connection stops startup with an error; the application never silently falls back to demo storage.

The default integration suite uses isolated temporary files and never touches your configured database. `npm run test:mongodb` separately checks Atlas CRUD, relationship protection, persistence and sessions shared between application instances. It uses disposable records and removes them afterward; run it against a dedicated development database.

## API

All resource endpoints return JSON. Successful reads return `{ success: true, data }`, with `count` for lists. Failures return `{ success: false, message }` and an appropriate HTTP status.

Reads are public. Creating, editing and deleting require an authenticated administrator session, a matching CSRF token and an allowed request origin. Sign-in uses `POST /api/auth/login`; session restoration uses `GET /api/auth/session`; `POST /api/auth/logout` revokes the session. The Vue client supplies the required cookie and headers automatically.

- `GET /api/health`: API availability and active storage mode.
- `GET /api/meta`: supported sports, countries and storage mode.
- `GET /api/athletes`, `POST /api/athletes`: list or register athletes.
- `GET /api/athletes/:id`, `PATCH /api/athletes/:id`, `DELETE /api/athletes/:id`.
- `GET /api/events`, `POST /api/events`: list or create competitions.
- `GET /api/events/:id`, `PATCH /api/events/:id`, `DELETE /api/events/:id`.
- `GET /api/results`, `POST /api/results`: list or record performances.
- `GET /api/results/:id`, `PATCH /api/results/:id`, `DELETE /api/results/:id`.
- `GET /about`: Pug-rendered HTML.

List endpoints support `search`, `sport` and `status` parameters where applicable. For example: `/api/athletes?sport=Swimming&status=Active&search=martin`.

Register an athlete after signing in (the session cookie, `Origin`, `X-Arena-Request: 1` and `X-CSRF-Token` headers are required):

```http
POST /api/athletes
Content-Type: application/json

{
  "name": "Demo Athlete",
  "country": "Saudi Arabia",
  "sport": "Athletics",
  "age": 24,
  "status": "Active"
}
```

Competition payloads include `name`, `sport`, `discipline`, `location`, `date` (`YYYY-MM-DD`), `time` (`HH:mm`, AST), `status`, `capacity`, `unit`, `ranking` and an array of athlete IDs in `participants`. `unit` is `s`, `min`, `m` or `pts`; `ranking` is `asc` or `desc`.

Result payloads include `eventId`, `athleteId`, positive numeric `performance` and `status` (`Published` or `Provisional`). A competition must be Live or Completed, and the athlete must appear on its start list.

The API rejects invalid IDs, unsupported fields, impossible dates, duplicate entries, capacity overflow, inactive entrants, sport mismatches and duplicate event/athlete results. It protects athletes and competitions that have linked records. Remove results first, then competition entries, before deleting an athlete. Scoring rules cannot change after results have been recorded.

## Verification

```bash
npm run check
```

This runs 15 tests, TypeScript checking and the Vite production build. Tests cover the complete CRUD workflow, entry constraints, duplicate concurrent submissions, persisted demo records, Pug rendering, ranking and ties, password hashing, public read access, protected writes, CSRF checks, logout and login rate limiting.

GitHub Actions runs the same checks on Ubuntu for pushes and pull requests. Browser visual and interaction verification remains a manual check: desktop browser access was unavailable during implementation.

Deployment verification on 20 November 2026 passed for the public homepage and compiled assets, MongoDB-backed resource endpoints (28 athletes, eight competitions and 12 results), session configuration, the Pug page and rejection of unauthenticated edits. Atlas integration checks also passed for CRUD, protected relationships and sessions shared across application instances. The project runs on Vercel Hobby, with GitHub's `main` branch connected for automatic deployments.

Before an interview, use this quick manual demonstration:

1. Open Overview, then show Athletes filtering and pagination.
2. Sign in as administrator and register a fictional athlete in Athletics.
3. Create a competition and select that athlete for its start list.
4. Change the competition status to Live.
5. Record a provisional performance, edit it and publish it.
6. Inspect its calculated place and export the results.
7. Open `/about` and explain how server rendering differs from Vue.
8. Reload the application to show that the records persist.

Read the [step-by-step interview guide](docs/INTERVIEW_GUIDE.md) for the explanations, example answers and practice exercises.

## Production build

```bash
npm ci
npm --prefix client ci
npm run build
npm start
```

Open **http://localhost:5000**. Express serves `client/dist`, the API and the Pug information page from one origin. On a Node host, set its build command to install both dependency sets and run `npm run build`, and its start command to `npm start`. Configure `PORT`, `STORAGE_MODE`, `MONGODB_URI` and `CLIENT_ORIGIN` through the host's environment settings. Demo file storage requires a persistent writable filesystem.

GitHub stores the source. GitHub Pages alone cannot run the Express backend. For Vercel with MongoDB Atlas, follow [deployment instructions](docs/DEPLOYMENT.md). The repository includes a Vercel Function entry point and serves the compiled Vue app as static files.

This is a **portfolio demo with public browsing and one administrator account**. Authentication uses salted scrypt hashes, eight-hour HttpOnly sessions, CSRF protection and a shared limit of 20 login attempts per 15-minute window. Hosted sessions persist in MongoDB. CORS only controls browser access; it is not authentication. Granular staff roles, audit history, official timing integrations and transactional guarantees across multiple instances remain future work. The demo adapter serializes writes inside one Node process; MongoDB enforces unique results, but relationship checks across documents still require transactions for stronger concurrent-write guarantees. Use fictional data for a public demonstration.

## Push to GitHub

Create an empty repository on GitHub, then run these commands in the project root. Replace the URL with your own repository URL:

```bash
git status
git add .
git commit -m "Build ARENA sports operations platform"
git branch -M main
git remote add origin https://github.com/yryandra/arena-sports-manager.git
git push -u origin main
```

If you already have an `origin` remote, inspect it using `git remote -v` and use its URL. Review `git status` before committing. The ignore rules exclude credentials, dependency folders, generated builds and runtime demo data; both lockfiles and `.env.example` files should be committed.

## License

Application code is MIT licensed. Third-party assets and packages retain their original licenses; see [LICENSE](LICENSE) and [asset credits](docs/ASSETS.md).
