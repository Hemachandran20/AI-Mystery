# AI Mystery Room

AI Mystery Room is a detective game. Players provide a premise, investigate AI-generated clues, request limited hints, and submit one accusation. Gemini generation, case persistence, accusation checks, and scoring run on the server.

## Requirements

- Node.js 20 or newer and npm
- A MongoDB database (local or MongoDB Atlas)
- A Google Gemini API key

## Install

Install each app's dependencies:

```sh
cd server
npm install
cd ../client
npm install
```

Copy `server/.env.example` to `server/.env`. Set `MONGODB_URI`, `GEMINI_API_KEY`, and `CLIENT_ORIGIN` there. Copy `client/.env.example` to `client/.env.local`; its `VITE_API_BASE_URL` points to the backend. The root `.env.example` lists the backend variables as a reference. Never put server secrets in a `VITE_` variable or in the client environment.

## Run locally

Start the API in one terminal:

```sh
cd server
npm run dev
```

Start the client in another:

```sh
cd client
npm run dev
```

Open `http://localhost:5173`. Check the API at `http://localhost:5000/api/health`.

## Tests and build

Run backend unit tests and the frontend production build:

```sh
cd server
npm test
cd ../client
npm run build
```

The automated backend suite covers score calculation, generated-case shape and difficulty counts, bounded generation retries, and solution omission from public case objects. Live MongoDB and Gemini integration checks require configured credentials.

## Deployment

### MongoDB Atlas

1. Create a database and database user in Atlas.
2. Configure the network access list for the backend host.
3. Copy the connection string into the backend's `MONGODB_URI` environment variable. Do not add it to the client project.

### Backend on Render

Create a Node web service using `server` as the root directory. Use `npm install` as the build command and `npm start` as the start command. Configure these environment variables in the host dashboard:

- `PORT` (provided by Render)
- `MONGODB_URI`
- `GEMINI_API_KEY`
- Optional `GEMINI_FALLBACK_MODEL=gemini-3.6-flash` to use the verified stable fallback after repeated primary-model 503s or an explicit unavailable-model response
- `CLIENT_ORIGIN` (the deployed frontend origin, such as `https://your-app.vercel.app`)

After deployment, verify `/api/health` on the backend URL.

### Frontend on Vercel

Import the repository with `client` as the project root, `npm run build` as the build command, and `dist` as the output directory. Set `VITE_API_BASE_URL` to the deployed backend URL, without a trailing slash. `client/vercel.json` rewrites direct page URLs to the React application entry point.

After both deployments, test mystery creation, clue discovery, hint limits, accusation, results access, and Play Again on the live site. Deployment and live integration have not been performed from this workspace.

## Security notes

- Gemini and MongoDB credentials are read by the server only.
- The Mongoose solution field is excluded from normal queries.
- The case API builds explicit public response objects; the solution is included only in completed result responses.
- The server validates generated content and client input, limits API requests, and computes all scores.
