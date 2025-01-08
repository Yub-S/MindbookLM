# MindbookLM

MindbookLM is your personal digital brain, designed to preserve your memories, thoughts, and experiences. Unlike traditional note-taking tools, it helps you reconnect with your past self by bringing memories to life in a meaningful way.

## Project Structure

- **MindbookLM-backend**: Built with [Modus](https://docs.hypermode.com/modus/overview), handles the backend operations
- **MindbookLM-frontend**: Built using vite and react, provides the frontend interface

## Running Locally

### 1. Clone the Repository

```bash
git clone https://github.com/Yub-S/MindbookLM.git
cd MindbookLM
```

### 2. Backend Setup (MindbookLM-backend)

#### Install modus and hyp CLIs

```bash
# Install Modus CLI
npm i -g @hypermode/modus-cli

# Install Hyp CLI and sign in
npm i -g @hypermode/hyp-cli
hyp login
```

#### Configure Environment

Create a `.env.dev.local` file in the backend directory with the following variables:

```bash
MODUS_OPENAI_API_KEY=<YOUR_GROQ_API_KEY>
MODUS_NEO4J_NEO4J_URI=<YOUR_NEO4J_CONNECTION_URI_HERE>
MODUS_NEO4J_USERNAME=<YOUR_NEO4J_USER_HERE>
MODUS_NEO4J_PASSWORD=<YOUR_NEO4J_PASSWORD_HERE>
```
**Note:** You can create a free Neo4j Sandbox instance to obtain your Neo4j credentials by visiting [Neo4j Sandbox](https://sandbox.neo4j.com/).

#### Run the Backend

```bash
cd mindbooklm-backend
modus dev
```

### 3. Frontend Setup (MindbookLM-frontend)

#### Navigate to Frontend Directory

```bash
cd mindbooklm-frontend
```

#### Configure Environment

Create a `.env` file with the following variables:

```bash
VITE_API_ENDPOINT=<YOUR_GRAPHQL_ENDPOINT>
VITE_CLERK_PUBLISHABLE_KEY=<YOUR_CLERK_PUBLISHABLE_KEY>
VITE_CLERK_SECRET_KEY=<YOUR_CLERK_SECRET_KEY>
```

**Note:** The Clerk keys are required because user authentication has been implemented in the app using Clerk. However, if you don't want to configure Clerk and use user authentication (for example, if you're just testing the app for yourself), you can follow the **Running Without Authentication** section below to skip the authentication setup and use an earlier version of the project where authentication was not yet implemented.

#### Install Dependencies and Run

```bash
npm install
npm run dev
```

### Running Without Authentication

If you prefer to run MindbookLM without the user authentication system (clerk setup), you can use an earlier version of the project where authentication was not yet implemented.

#### Steps to Use the No-Authentication Version:

```bash
# Clone the repository (if not already done)
git clone https://github.com/Yub-S/MindbookLM.git
cd MindbookLM

# Checkout this specific commit 
git checkout 85ba8b8b9997c2d22828b5c10cf5214b98d3ce90
```
**Note:** You can now setup backend and frontend setup as above, but skip the Clerk configuration in the `.env` as it's not needed.
