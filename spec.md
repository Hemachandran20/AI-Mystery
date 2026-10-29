# AI Mystery Room — SPEC.md
## Spec-Driven Development Specification

**Project:** AI Mystery Room  
**Type:** AI-powered detective mystery web game  
**Version:** 1.0  
**Development approach:** Spec-Driven Development (module by module)

---

## 1. Project Overview

AI Mystery Room is a web game where players solve AI-generated detective mysteries.

The player enters a mystery premise, selects a difficulty, investigates suspects, discovers clues, requests hints, and accuses a suspect. The application then reveals whether the accusation was correct, identifies the culprit, explains the evidence, and calculates the final score.

Google Gemini generates the mystery content. The backend validates the generated content and controls the game rules.

**Critical rule:** The culprit and secret solution must remain on the backend until the player submits an accusation.

## 2. Project Goals

- Build a complete, playable mystery-solving website.
- Generate unique mysteries using Google Gemini.
- Support Easy, Medium, and Hard difficulties.
- Allow players to investigate clues and request hints.
- Validate accusations on the backend.
- Calculate scores automatically.
- Provide a results page and a Play Again option.
- Deploy the website so it can be accessed online.

## 3. Required Technology Stack

### Frontend
- React
- Vite
- Tailwind CSS
- React Router
- Fetch API or Axios

### Backend
- Node.js
- Express.js

### Database
- MongoDB Atlas
- Mongoose

### AI and Validation
- Google Gemini API
- `@google/genai`
- `zod`

### Development Tools
- Git and GitHub
- npm
- A suitable testing framework, such as Vitest or Jest

Do not change the required technology stack without approval.

## 4. Target Users

- People who enjoy detective games and mystery stories.
- Puzzle-solving enthusiasts.
- Students and casual players.

The interface should be beginner-friendly, responsive, and easy to understand.

## 5. Difficulty Rules

| Difficulty | Suspects | Clues | Allowed hints | Base score |
|---|---:|---:|---:|---:|
| Easy | 3 | 5 | 2 | 100 |
| Medium | 4 | 7 | 3 | 150 |
| Hard | 5 | 9 | 3 | 200 |

The backend must enforce these values.

## 6. Scoring System

For a correct accusation:

`Score = max(0, Base Score + (Discovered Clues × 5) − (Hints Used × 10))`

Rules:

- Each valid discovered clue adds 5 points.
- Each hint used subtracts 10 points.
- Easy base score: 100.
- Medium base score: 150.
- Hard base score: 200.
- An incorrect accusation receives 0 points.
- The minimum score is 0.
- Calculate the score on the backend only.
- Never trust a score sent from the frontend.

## 7. User Flow

1. Player opens the Home page.
2. Player clicks **Create Mystery**.
3. Player enters a mystery premise.
4. Player selects Easy, Medium, or Hard.
5. Gemini generates the mystery through the backend.
6. The player enters the Investigation Room.
7. The player reviews suspects and discovers clues.
8. The player may request available hints.
9. The player selects a suspect and submits an accusation.
10. The Results page reveals the verdict, culprit, explanation, and score.
11. The player clicks Play Again to start another mystery.

## 8. Pages and Features

### Page 1: Home (`/`)

Must include:
- Game title and short description.
- Create Mystery button.
- How to Play instructions.
- Difficulty overview.
- Responsive design.

### Page 2: Create Mystery (`/create`)

Must include:
- Textarea for entering a mystery premise.
- Example premise.
- Difficulty selector.
- Generate Mystery button.
- Input validation.
- Loading indicator.
- Error message and retry option.

Validation:
- Premise cannot be empty.
- Trim unnecessary whitespace.
- Maximum premise length: 500 characters.
- Only Easy, Medium, and Hard are accepted.

### Page 3: Investigation Room (`/case/:id`)

Must include:
- Case title and summary.
- Suspect cards.
- Clue list.
- Discover Clue buttons.
- Hint button.
- Remaining hints count.
- Discovered clues progress.
- Make an Accusation button.

The secret culprit and full solution must not appear before the accusation.

### Page 4: Accusation

Can be a separate page or a modal.

Must include:
- List of suspects.
- Suspect selection.
- Confirmation before submission.
- Loading and error states.
- Protection against duplicate submissions.

### Page 5: Results (`/case/:id/result`)

Must include:
- Correct or incorrect verdict.
- Culprit's name.
- Explanation of the mystery.
- Important supporting clues.
- Final score.
- Score breakdown.
- Play Again button.

A completed accusation cannot be changed.

## 9. Backend API Requirements

### `POST /api/cases`

Creates a new mystery.

Request:

```json
{
  "premise": "A diamond disappears during a locked-room dinner.",
  "difficulty": "Medium"
}
```

Requirements:
- Validate the request.
- Generate a mystery using Gemini.
- Validate Gemini's response.
- Check suspect, clue, and hint counts.
- Save the case in MongoDB.
- Return only public information.
- Keep the secret solution on the server.

### `GET /api/cases/:id`

Returns the public case information and current investigation progress.

Must not expose the culprit or secret solution before accusation.

### `POST /api/cases/:id/clues/:clueId/discover`

Requirements:
- Validate the case and clue IDs.
- Confirm the clue belongs to the case.
- Record the discovery on the backend.
- Prevent duplicate clue rewards.
- Return the discovered clue and updated progress.

### `POST /api/cases/:id/hints`

Requirements:
- Check whether the game is still active.
- Enforce the hint limit.
- Record hint usage on the backend.
- Return a helpful hint without revealing the full solution.

### `POST /api/cases/:id/accuse`

Request:

```json
{
  "suspectId": "suspect-2"
}
```

Requirements:
- Validate the selected suspect.
- Check the accusation against the stored solution.
- Calculate the score on the backend.
- Save the final result.
- Prevent another accusation.
- Reveal the culprit and explanation only after the accusation.

### `GET /api/cases/:id/result`

Returns the final result only after the case is completed.

### `GET /api/health`

Returns the backend health status for deployment checks.

## 10. Database Requirements

Create a Mongoose Case model.

Required fields:

- Case ID
- Title
- Premise
- Difficulty
- Public summary
- Suspects
- Clues
- Hints
- Hidden solution
- Discovered clue IDs
- Number of hints used
- Accused suspect ID
- Game status
- Final score
- Creation and completion timestamps

Each suspect should contain:
- ID
- Name
- Description
- Motive
- Alibi

Each clue should contain:
- ID
- Title
- Public teaser
- Full clue text

The hidden solution should contain:
- Culprit suspect ID
- Explanation
- Key evidence references

Use explicit public response objects. Never return the complete database document directly to the frontend.

## 11. Gemini AI Requirements

Use `@google/genai` in the backend only.

Gemini must generate:
- A case title and summary.
- The exact number of suspects for the selected difficulty.
- The exact number of clues for the selected difficulty.
- The permitted number of hints.
- A single intended culprit.
- A logically consistent solution.
- An explanation supported by the clues.

### Mystery quality rules

1. Every mystery must have one intended culprit.
2. Evidence must logically support the solution.
3. Suspects should have plausible motives or suspicious details.
4. Clues should help players investigate.
5. The explanation must reference real clues.
6. The story must not contain major contradictions.
7. Early hints must not directly reveal the culprit.
8. Generated IDs must be unique.
9. Validate Gemini output with Zod.
10. If generated content is invalid, retry a limited number of times and return a safe error if it still fails.

Do not rely on the AI prompt alone to enforce game rules. Validate critical requirements in code.

## 12. Security Requirements

- Store `GEMINI_API_KEY` on the backend only.
- Store `MONGODB_URI` in environment variables.
- Never commit real API keys or `.env` files to GitHub.
- Validate every request.
- Add request rate limits.
- Restrict production CORS to the frontend domain.
- Do not expose stack traces or secrets to users.
- Keep solution validation and scoring on the backend.
- Handle database and Gemini errors safely.

## 13. Suggested Project Structure

```text
ai-mystery-room/
├── client/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       ├── App.jsx
│       └── main.jsx
├── server/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── services/
│       ├── validators/
│       ├── app.js
│       └── server.js
├── SPEC.md
├── .env.example
├── .gitignore
└── README.md
```

Adapt this structure if the repository already contains working files.

## 14. Testing Requirements

Test the following:

- Valid mystery creation.
- Invalid premise and difficulty.
- Correct suspect, clue, and hint counts.
- Clue discovery and duplicate discovery.
- Hint limits.
- Correct accusation.
- Incorrect accusation.
- Score calculation.
- Attempts to submit multiple accusations.
- Results access before accusation.
- Gemini API failures.
- MongoDB connection failures.
- Prevention of secret-solution leakage.
- Responsive frontend and navigation.

All core tests must pass before deployment.

## 15. Acceptance Criteria

The project is complete when:

- All five user-facing flows work.
- Gemini generates validated mysteries.
- All API endpoints work.
- Difficulty rules are correct.
- Hints are limited correctly.
- Clues can be discovered.
- Accusations are validated on the backend.
- Scores are calculated correctly.
- The secret solution stays private until accusation.
- Results show the culprit and supporting explanation.
- Play Again starts a new mystery.
- The frontend and backend work together.
- The app is deployed and tested online.
- README contains setup and deployment instructions.
- GitHub repository and live website URLs are ready for submission.

## 16. Spec-Driven Development Plan

Build the application in small modules instead of asking Codex to build everything at once.

### Phase 0: Understand the spec

- Read this entire file.
- Inspect the existing project.
- Summarize the requirements.
- Identify missing dependencies and conflicts.
- Propose a phased implementation plan.

### Phase 1: Project setup

- Set up React, Vite, and Tailwind.
- Set up Node.js and Express.
- Add the health endpoint.
- Confirm that frontend and backend start successfully.

### Phase 2: Database

- Connect MongoDB.
- Create the Mongoose Case model.
- Add input and output validation.
- Test database operations.

### Phase 3: Gemini integration

- Connect Gemini on the backend.
- Generate structured mystery data.
- Validate generated cases.
- Check all difficulty levels.
- Keep the solution private.

### Phase 4: Backend game logic

- Implement the case APIs.
- Implement clue discovery.
- Implement hints.
- Implement accusation validation.
- Implement score calculation.
- Write API tests.

### Phase 5: Frontend

- Build Home.
- Build Create Mystery.
- Build Investigation Room.
- Build Accusation.
- Build Results.
- Connect all pages to the API.

### Phase 6: Testing

- Test every difficulty.
- Test correct and incorrect accusations.
- Check score calculations.
- Inspect network responses for secret leakage.
- Fix bugs before deployment.

### Phase 7: Deployment

- Create a MongoDB Atlas database.
- Deploy the backend, for example on Render.
- Configure production environment variables.
- Deploy the frontend, for example on Vercel.
- Configure API URL and CORS.
- Test the complete live game.
- Update README and prepare submission links.

## 17. Instructions for Codex

Read `SPEC.md` completely before coding. Treat it as the source of truth.

First inspect the existing repository and report its structure, missing pieces, and any conflicts with this specification.

Then propose a phased plan. Do not implement the entire application in one step.

For each phase:
1. State the goal of the module.
2. List the files to create or modify.
3. Implement only that module.
4. Run relevant tests or checks.
5. Report changed files and test results.
6. Compare the result with the acceptance criteria.
7. Wait for approval before starting the next phase.

Do not silently change the required stack, difficulty values, API contracts, or score formula.

Keep Gemini secrets and the hidden solution on the backend. Never claim a test passed unless it was actually run.

## 18. Environment Variables

Create `.env.example` with placeholder values:

```dotenv
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/ai-mystery-room
GEMINI_API_KEY=replace_me
CLIENT_ORIGIN=http://localhost:5173
```

Frontend `.env.example`:

```dotenv
VITE_API_BASE_URL=http://localhost:5000
```

Never commit real secret values.

## 19. Submission Checklist

- [ ] Code is pushed to GitHub.
- [ ] `.gitignore` excludes secrets and build artifacts.
- [ ] MongoDB Atlas is configured.
- [ ] Gemini API key is configured securely.
- [ ] Backend is deployed and health check works.
- [ ] Frontend is deployed.
- [ ] Full game is tested online.
- [ ] README includes setup and deployment instructions.
- [ ] GitHub repository URL is ready.
- [ ] Live website URL is ready.
- [ ] Submission form is completed: https://bit.ly/ai-mystery-room-sub-form

## Final Rule

A mystery is not valid just because Gemini returns text. Validate its structure, difficulty counts, IDs, culprit reference, evidence references, and consistency. Never reveal the solution before the player submits an accusation. Keep game rules and scoring on the backend.
