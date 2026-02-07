# Feature 0.5: The Production Pipeline

**Status:** Draft
**Goal:** Establish a robust CI/CD pipeline that validates code quality and deploys to a Staging environment.

## **1. User Stories**
1.  **Developer:** "When I open a PR, the system automatically runs tests and linting."
2.  **Developer:** "When I merge to `main`, the system automatically deploys the latest version to a Staging URL."
3.  **QA:** "I can test the 'Real AI' integration on a live URL without needing a local dev environment."

## **2. Technical Requirements**
*   **CI Provider:** GitHub Actions.
*   **Build System:** Turborepo (caching).
*   **Targets:**
    *   **Lobby:** Cloudflare Pages (Next.js).
    *   **Game Server:** PartyKit (Cloudflare Durable Objects).
    *   **Client:** Cloudflare Pages (Vite PWA).

## **3. Implementation Steps**

### **Step 1: CI Workflow (Pull Requests)**
*   **Path:** `.github/workflows/ci.yml`
*   **Triggers:** Push to `main`, Pull Request.
*   **Jobs:**
    *   `lint`: Runs `turbo run lint`.
    *   `test`: Runs `turbo run test`.
    *   `build`: Runs `turbo run build`.

### **Step 2: CD Workflow (Staging Deploy)**
*   **Path:** `.github/workflows/deploy-staging.yml`
*   **Triggers:** Push to `main`.
*   **Jobs:**
    *   `deploy-lobby`: Uses `cloudflare/pages-action` to deploy `apps/lobby`.
    *   `deploy-client`: Uses `cloudflare/pages-action` to deploy `apps/client`.
    *   `deploy-party`: Uses `npx partykit deploy` to deploy `apps/game-server`.

### **Step 3: Environment Configuration**
*   **Secrets:**
    *   `CLOUDFLARE_API_TOKEN`
    *   `CLOUDFLARE_ACCOUNT_ID`
    *   `PARTYKIT_TOKEN`
    *   `GEMINI_API_KEY` (for Staging)

## **4. Success Criteria**
*   [ ] A dummy PR triggers the CI workflow and passes.
*   [ ] Merging to `main` triggers a deploy.
*   [ ] `staging.pecking-order.pages.dev` (or similar) is accessible.
