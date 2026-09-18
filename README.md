# ArogyaSync

**SIH26133 — Accessibility and quality of public healthcare services, particularly in rural and underserved areas**

## Problem
*TBD - Awaiting Proposal Analysis*

## Solution
*TBD - Awaiting Proposal Analysis*

## Architecture
*TBD - Awaiting Architecture Decision*

## Tech Stack
*TBD - Awaiting Tech Stack Decision*

## Repository Structure
```text
/
├── docs/           # Architecture, API, DB specs, and PRD
├── agents/         # AI Agent responsibilities and bounds
├── rules.md        # Strict engineering and security rules
└── README.md       # Project overview and setup
```

## Local Setup
*TBD*

## Environment Variables
*TBD*

## Running the Application
*TBD*

## Running Tests
*TBD*

## Development Workflow
Follow the Git workflow using Conventional Commits. See `rules.md` for full guidelines.

### ⚠️ The Golden Rule for AI Context Sharing
Because 3 teammates are using 3 different AI agents on different devices, **your AI only knows what is on your local machine.** 

Before you start a new task, or before you ask your AI to write new code, you **MUST** run this command to get the latest context from your team:

```bash
git pull origin main && npm install
```
*(If you are using a different branch name, replace `main` with your branch name).*

Once you finish a task, always commit and push so your teammates can pull your context.

## Agent Ownership
See `/agents` directory for detailed breakdown of agent responsibilities.

## ⚠️ Important Security Warnings
* **NEVER** commit real patient data.
* **NEVER** commit secrets, API keys, or `.env` files.
* **NEVER** expose Supabase service-role credentials to the frontend.
* **ALWAYS** use synthetic data for development.