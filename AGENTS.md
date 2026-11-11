# Repository Guidance

## Project Structure

- `server.js` is the application entry point. It configures Express, connects to MongoDB, mounts API routes, and starts the server.
- `routes/` contains HTTP route modules; `middleware/` contains request and plan checks; `models/` contains Mongoose models.
- `services/`, `utils/`, `config/`, and `cron/` hold application logic, shared helpers, configuration, and scheduled jobs.
- `public/` and `admin/` contain static HTML, CSS, and browser JavaScript served by the backend.

## Conventions

- Use Node.js CommonJS (`require`/`module.exports`) and follow the surrounding file's formatting and patterns.
- Keep changes scoped to the owning route, middleware, model, service, or frontend module. Preserve existing API paths and response shapes unless the task requires a contract change.
- In `server.js`, mount the Razorpay webhook routes before `express.json()` so the webhook can read the raw request body.
- Load configuration through the existing dotenv setup. Do not commit `.env` values or expose secrets in logs or responses.
- Avoid changing scheduler startup or database connection behavior as part of unrelated work.

## Commands and Validation

- `npm run dev` starts the server with nodemon.
- `npm start` starts the server with Node.js.
- There are currently no test or lint scripts in `package.json`. For JavaScript-only changes, run `node --check <changed-file>` where applicable; for behavior changes, exercise the affected endpoint or workflow when its required environment and services are available.