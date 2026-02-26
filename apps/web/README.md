# Naroto Web Application

This is the main front-end application for Naroto, built with Next.js and the App Router. It provides the user interface for clinics, doctors, and patients.

## ✨ Tech Stack

-   **Framework**: [Next.js](https://nextjs.org/) (with App Router)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)
-   **API**: [tRPC](https://trpc.io/) for end-to-end typesafe communication with the backend.
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **UI Components**: [Shadcn/ui](https://ui.shadcn.com/)
-   **State Management**: [Zustand](https://zustand-demo.pmnd.rs/) (for minimal client-side state)
-   **Forms**: [React Hook Form](https://react-hook-form.com/) with [Zod](https://zod.dev/) for validation.

## 🚀 Getting Started

1.  **Install Dependencies**: From the root of the monorepo, run:
    ```bash
    pnpm install
    ```

2.  **Run the Development Server**:
    ```bash
    pnpm dev
    ```

The application will be available at `http://localhost:3000`.

## 📂 Key Directories

This application follows a feature-driven structure within the `src` directory.

-   **`src/app/`**: Contains all the routes, pages, and layouts, following the Next.js App Router conventions.

-   **`src/components/`**: Home to all shared UI components, organized by feature or type (e.g., `ui/`, `dashboard/`, `forms/`).

-   **`src/lib/`**: Contains core utilities, services, and integration logic.
    -   **`lib/actions/`**: Houses all Next.js Server Actions. These are used for mutations (form submissions, button clicks) and are the primary way the client writes data to the server.
    -   **`lib/cache/`**: The **Cache Layer**. This is a critical part of the architecture. It contains functions that wrap service calls with the `'use cache'` directive, applying appropriate cache tags and revalidation profiles. **Components should almost always fetch data through this layer.**
    -   **`lib/services/`**: A lightweight service layer specific to the web app. It may contain logic that is not pure business logic (e.g., formatting data for a specific chart) or act as a pass-through to the core services in `@naroto/db`.
    -   **`lib/trpc/`**: Contains the tRPC client setup, allowing the frontend to call the API in a typesafe manner.

## 🔄 Data Fetching and Caching Flow

The application uses a layered approach to data fetching to maximize performance and leverage Next.js caching.

1.  **Component**: A React Server Component needs data.
2.  **Cache Layer Call**: The component calls a function from `src/lib/cache/` (e.g., `getCachedPatientById(id)`).
3.  **`'use cache'`**: The cache function, marked with `'use cache'`, applies cache tags and revalidation logic. It then calls the appropriate service.
4.  **Service Layer Call**: The cache function calls a method from a service (either in `src/lib/services/` or `@naroto/db/services/`).
5.  **Data Retrieval**: The service executes its business logic, calling repositories from `@naroto/db` to fetch data from the database.
6.  **Return & Cache**: The data is returned up the chain, and Next.js caches the result of the `getCached...` function call based on the tags and lifetime specified.