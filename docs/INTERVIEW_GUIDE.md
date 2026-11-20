# Explain ARENA confidently

Use this guide to understand the project, trace its code and practise explaining your decisions. Describe it accurately as a portfolio project built with assistance, and be ready to demonstrate the parts you understand.

## Your opening explanation

> “ARENA is a full-stack sports operations application. It manages athletes, competition entries and results. I used Vue 3 and TypeScript for the interface, Express for the REST API, and Mongoose for validation and MongoDB access. It also has a persistent local demo mode so I can demonstrate it without a database. I focused on a consistent sports interface and the relationships between athletes, competitions and their results.”

Then open the application and explain a workflow, rather than listing every library.

## Step 1: Establish the project and development environment

Start with `package.json`, `client/package.json`, `.gitignore` and `.env.example`.

Node.js runs JavaScript outside the browser. npm installs packages and runs commands defined in `package.json`. The application has two package manifests: one for the backend and one for the Vue frontend. Their lockfiles record exact resolved package versions so a fresh checkout can reproduce the installation with `npm ci`.

`npm run dev` calls `scripts/dev.js`. That launcher starts the Node server with file watching and starts Vite for the frontend. Vite updates the browser when frontend source changes. Production uses a different workflow: `npm run build` compiles and optimises the frontend, then `npm start` runs Express to serve it.

An environment variable configures the running application without changing its source. Database credentials belong in `.env` or a hosting platform's settings, and `.gitignore` keeps those secrets out of Git. `.env.example` contains safe placeholder values for another developer.

Be able to answer: **“What is the difference between Node, npm and Git?”** Node is a runtime, npm is a package manager, and Git is version control.

## Step 2: Build the Express API

Read `server.js`, then `routes/athleteRoutes.js` and `routes/resourceRoutes.js`.

Express maps HTTP methods and paths to functions. `GET` reads records, `POST` creates them, `PATCH` updates selected fields, and `DELETE` removes them. `express.json()` parses a JSON request body. The API returns JSON with consistent success and error shapes so the frontend can handle responses predictably.

For example, `POST /api/athletes` accepts the form fields, validates them and saves a record. A successful creation returns HTTP `201`. Invalid inputs return `400`, a missing record returns `404`, a conflicting linked record returns `409`, and an unexpected server failure returns `500` without exposing internal details to the browser.

The original server connected to MongoDB twice. Startup now creates the storage adapter once, waits for it, and only then starts listening. The athlete model import also matches the exact filename `Athlete.js`, which matters on Linux even if a casing mismatch appears to work on Windows.

Express 5 forwards rejected async route promises to the error middleware. Resource routes share a factory to keep their common CRUD behaviour consistent; relationship rules remain explicit within that module.

Be able to answer: **“Why use PATCH rather than POST for editing?”** PATCH identifies an existing resource and applies a partial update. POST creates a new resource in the collection.

## Step 3: Model the data and its relationships

Read the three files in `models/` and the lists in `config/constants.js`.

- An **athlete** has a name, country, sport, age and active status.
- A **competition** has a sport, discipline, venue, date, time, capacity, scoring rules and athlete IDs in its start list.
- A **result** references one athlete and one competition and stores a performance and publication status.

MongoDB stores documents. Mongoose adds schemas, validation and a convenient query API. An ObjectId identifies a record. A reference stores another document's ID, so a result can point to an athlete without duplicating their name and country in every result document.

Schema validation checks the shape of an individual document. Relationship validation checks its meaning across documents: an entrant must be active and compete in the event's sport; a result must belong to an entered athlete; capacity must not be exceeded. Both layers are necessary.

The result schema also defines a unique compound index on `eventId` and `athleteId`. This prevents two marks for the same athlete in the same event. The application checks for duplicates to give a readable error, and the database index supplies an additional guard in MongoDB mode.

Deleting an athlete with entries or results is blocked. This preserves referential integrity: the application must not leave results pointing to a record that no longer exists.

Be able to answer: **“Why validate on the server when the form already has validation?”** A caller can bypass the browser form and send HTTP directly. The API must protect the data independently.

## Step 4: Separate persistence from application behaviour

Read `services/store.js`, `config/db.js`, `data/seed.js` and `scripts/seed.js`.

The storage adapter exposes the same `all`, `get`, `save` and `remove` methods in both modes. The routes call these methods without needing to know whether the records live in a local file or MongoDB. This is a small example of separating concerns.

Demo mode uses the same Mongoose schemas for record validation, then writes JSON to disk. It writes a temporary file and replaces the saved file when the write succeeds. A promise queue serializes writes, and route mutations serialize relationship checks with writes within one process. This makes an interview demo convenient and repeatable. It is not a substitute for a production database or transactions across multiple server instances.

MongoDB mode connects using `MONGODB_URI` and uses Mongoose queries. It never silently switches to local storage if the database connection fails. The seed command refuses to insert examples into a populated MongoDB database.

The default HTTP tests exercise demo mode. The separate `npm run test:mongodb` check connects to the configured Atlas database, verifies CRUD and sessions shared across app instances, and removes the temporary records it created.

Be able to answer: **“Why include demo mode?”** It makes the project easy to run from GitHub and demonstrate without credentials, while preserving the API and the validation rules used by the MongoDB adapter.

## Step 5: Build the Vue interface

Read `client/src/main.ts`, `types.ts`, `App.vue`, and the components folder.

`main.ts` mounts the root Vue component into the HTML element with ID `app`. A Vue single-file component brings together a template and its component logic. Here, `<script setup lang="ts">` uses the Composition API with TypeScript.

`ref` holds reactive state, such as the current search query or loaded athletes. `computed` derives information from that state, such as the filtered athlete list or published result count. Vue updates the relevant UI when the state changes.

The templates use `v-for` to render lists, `v-if` to display conditional content, `v-model` to connect inputs to state, and `@click` or `@submit.prevent` to respond to user actions. Stable IDs in `:key` help Vue track each record during updates.

The reusable components have clear responsibilities:

- `AppIcon.vue` renders consistent local SVG icons.
- `CompetitionCard.vue` presents one competition and emits an `open` event.
- `ResultsTable.vue` renders related athlete and event data with calculated places.
- `RecordForm.vue` handles athlete, competition and result forms, validation feedback and saving.
- `App.vue` composes the views, owns navigation and filters, and connects those components to application data.

TypeScript describes what each record contains. For example, the `Competition` type restricts status to `Scheduled`, `Live` or `Completed`. Type checking catches incorrect property access and incompatible values during development. It does not replace API validation at runtime.

The app uses hash navigation for its six views, so a view such as `/#athletes` can be bookmarked without adding a routing dependency. A larger application with nested routes and authentication would benefit from Vue Router.

Be able to answer: **“What is the difference between ref and computed?”** A ref stores reactive state; computed derives a value from other state and updates when its dependencies change.

## Step 6: Connect the browser to the API

Read `client/src/lib/api.ts` and `client/vite.config.ts`.

The Axios instance uses `/api` as its base URL. In development, Vite proxies `/api` to Express on port 5000, so the browser can request the same origin as the frontend. In production, Express serves the built frontend and the API together. `VITE_API_URL` can configure a separately hosted backend at build time.

The `useSportsData` composable holds shared reactive arrays and data-loading functions. It loads independent resource lists in parallel. A mutation sends a POST or PATCH request, waits for the response, reloads the data, and then updates the interface. Loading and saving indicators help the user understand what is happening, and errors appear as readable messages.

Trace **Register athlete** end to end:

1. `v-model` collects the name, country, sport, age and status in `RecordForm.vue`.
2. The form's submit handler calls the supplied `persist` function.
3. Axios sends `POST /api/athletes` with JSON.
4. Express parses the body and rejects unsupported fields.
5. Relationship rules run, then the Mongoose schema validates the athlete.
6. The storage adapter persists the record.
7. Express returns `201` with the created record.
8. The composable reloads resource data, the modal closes, and Vue renders the new athlete and updated count.

Be able to answer: **“What happens if the server fails?”** The request rejects, saving state is cleared, and the form displays the API error without pretending that the operation succeeded. If the write succeeds but a subsequent refresh fails, the page shows the connection error and can retry loading.

## Step 7: Design a coherent sports interface

Read `client/src/assets/main.scss`, `CompetitionCard.vue` and `client/public/`.

The design uses a dark green and navy foundation, lime accents, sports photography, consistent spacing and reusable cards and tables. The goal is to make the primary operations clear: register people, organise competitions and record performances.

Sass variables keep key colours consistent. A breakpoint mixin keeps responsive rules readable. A small loop generates the avatar colour variants. Bootstrap Reboot normalises the browser's default styles, and custom Sass supplies the ARENA appearance.

On smaller screens, the sidebar becomes an off-canvas menu, cards stack, toolbars wrap and wide tables scroll within their container. Accessible labels, visible keyboard focus, a skip link and native modal dialogs support keyboard use. Native dialogs handle focus containment and Escape; forms provide explicit labels and status messages.

The sports photographs, flags and font are bundled locally. Asset credits and the font's license belong in the repository with the files. The interface takes inspiration from sports organisations without presenting itself as their official product.

Browser visual verification was unavailable in this development session. Before presenting, manually check the desktop view, a narrow mobile viewport, form keyboard navigation and each primary workflow. Accessibility and responsive behaviour require actual browser verification beyond a successful build.

Be able to answer: **“Why use Sass if CSS can do the styling?”** CSS could handle it, but Sass gives this project reusable variables, mixins and generated variants, and demonstrates a technology in the original brief.

## Step 8: Calculate rankings and create useful exports

Read `client/src/lib/format.ts`, `ResultsTable.vue` and the Reports view in `App.vue`.

For time-based events, lower performances rank first. For distance and points, higher performances rank first. A result's place is one plus the number of strictly better results in the same competition and publication status. That produces competition ranking for ties: `1, 1, 3`.

Published and provisional results remain separate so an unconfirmed mark does not change a published place. Places are derived from performance rather than saved as another editable field, which avoids stale places when a performance changes. The current implementation calculates rankings in the browser; a production public-results API should expose a shared server-side ranking service for consistency across multiple clients.

The dashboard and reports derive their counts from actual loaded records. The CSV utility quotes cells correctly, preserves Unicode with UTF-8 and prefixes potentially formula-like text. Exported data can then be opened in a spreadsheet.

Be able to answer: **“How would you scale the directory?”** Move filtering, sorting and pagination to indexed database queries. Loading all records and filtering in the browser is appropriate for this small demo, but not for a large event database.

## Step 9: Demonstrate server-side rendering with Pug

Read the `/about` route in `server.js` and `views/about.pug`.

Express loads the current athlete and competition counts and passes them into the Pug template. Pug generates HTML on the server before the browser receives the response. This page does not need Vue to render its content.

The main dashboard follows client rendering: the browser downloads the JavaScript bundle, Vue runs, requests JSON and updates the DOM. The Pug page follows server rendering: the server sends an HTML document with its live counts already included.

Be able to answer: **“Why use both approaches?”** The interactive dashboard benefits from Vue's reactive components. A simple information page demonstrates server rendering and the Pug requirement in the brief without complicating the dashboard.

## Step 10: Test and prepare the GitHub repository

Read `tests/`, `.github/workflows/ci.yml` and the GitHub instructions in the README.

`npm run check` runs 15 tests, TypeScript checking and the production build. The integration suite starts a real Express server on an available local port and sends HTTP requests with Node's built-in fetch. It creates its own temporary demo store, so these default tests cannot alter your application data or MongoDB database. Authentication tests check password hashing, protected writes, CSRF, logout and login rate limiting.

The tests check successful flows and important failures: invalid inputs, sport mismatch, capacity overflow, duplicate submissions, protected relationships and persisted records. Ranking tests check ties, ascending and descending scoring, and publication isolation. The Pug test confirms that server-side counts appear in the rendered HTML.

GitHub Actions repeats the checks on Ubuntu for each push or pull request. This also helps catch Windows/Linux filename differences. Both lockfiles are committed; credentials, generated output and local data are ignored.

Be able to answer: **“Why are these integration tests useful?”** They check that routing, validation, relationship rules and persistence work together over HTTP, rather than only checking isolated functions.

## A three-minute demonstration

1. **First 30 seconds:** show Overview and explain that counts come from API data.
2. **Next 45 seconds:** filter Athletes and register a fictional competitor.
3. **Next 45 seconds:** create an Athletics competition, add the new athlete, and move it to Live.
4. **Next 30 seconds:** record a performance, publish it and explain the calculated place.
5. **Last 30 seconds:** show an export, `/about`, the passing checks and the architecture.

Practise this once before the interview. Check the saved competition dates and update them if necessary.

## Production questions to prepare for

**Does this authenticate administrators?** Yes. One administrator signs in with a password checked against a salted scrypt hash. The server issues a random session token in an HttpOnly cookie and stores only its SHA-256 digest in MongoDB. Sessions expire after eight hours. Writes require the session, a matching CSRF token and an allowed origin. Login attempts are limited using a shared MongoDB counter. This is a single-admin design; granular staff roles, account recovery and MFA would be future improvements.

**Is CORS a security login mechanism?** No. CORS controls which browser origins can read cross-origin responses; it does not stop direct HTTP callers. Authentication, authorisation and server validation are separate responsibilities.

**Does Live mean official real-time scoring?** No. An operator sets the event status. An actual timing integration would receive verified results through a service, validate and audit them, then push updates using WebSockets or server-sent events.

**How would you support many users?** Use MongoDB with database-enforced constraints, transactions for linked operations, server pagination, authentication, audit logs and real-time refresh. The current in-process mutation queue does not coordinate multiple Node instances.

**How would you improve maintainability next?** Extract the larger views into page components, adopt Vue Router when nested navigation is needed, centralise ranking on the server and add browser-level workflow and accessibility tests.

**What did you learn?** Explain the full path from a reactive form to HTTP, validation, persistence and an updated view. Use a specific bug, such as double database startup, duplicate result submission or conflicting athlete entries, to show how you reasoned about correctness.

## Practice exercises

Try these without copying a solution:

1. Add a new supported country in `config/constants.js`. Explain why the API and frontend select both change after reloading.
2. Change the default competition capacity and identify where both browser and server validation apply.
3. Create two equal performances and explain why the next place is third.
4. Explain what changes in configuration when switching from demo mode to MongoDB.
5. Follow one failed API request in the browser's Network panel and describe its request body, status and response.
