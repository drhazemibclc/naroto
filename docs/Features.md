# 🏥 Smart Clinic - Application Features & Architecture

This document provides a comprehensive overview of the features, architecture, and core packages of the Smart Clinic Pediatric Management System.

---

## 📋 Core Application Features

Smart Clinic is a modern, performant, and scalable system designed for pediatric clinics. Key user-facing features include:

- **Patient Management**: Comprehensive patient records, including demographics, medical history, and visit notes.
- **Growth Tracking**: Charting and monitoring patient growth based on WHO Growth Standards.
- **Appointment Scheduling**: An intuitive interface for booking and managing appointments.
- **Secure Data Handling**: Ensuring patient data is kept secure and private through robust authentication and database practices.

---

## 🏗️ Architectural Overview

The application is built on a modern technology stack, leveraging a monorepo structure to manage code across different parts of the system. The core architectural tenets are performance, type safety, and developer experience.

### Next.js 16 with App Router & Cache Components

The frontend is built with Next.js 16, utilizing the App Router for file-based routing. A key feature of our architecture is the deep integration with Next.js's caching capabilities.

- **`'use cache'` Directive**: We extensively use the `'use cache'` directive to memoize data requests across the React component tree within a single request-response lifecycle. This is central to our data fetching strategy.
- **Cache Layer**: The web application (`apps/web`) features a dedicated cache layer (`src/lib/cache/`). Components do not fetch data directly from services; instead, they call functions in the cache layer. These functions wrap service calls with `'use cache'`, applying appropriate cache tags and revalidation logic, thus maximizing performance and minimizing database hits.
- **Partial Prerendering (PPR)**: By enabling `cacheComponents: true` in `next.config.js`, we leverage Partial Prerendering, allowing static parts of a route to be served instantly from the edge while dynamic parts are streamed in.

### Type-Safe API with tRPC

We use tRPC to provide a fully type-safe API layer between the frontend and backend. This eliminates the need for manual API schema synchronization and provides an exceptional developer experience with auto-completion and compile-time error checking.

---

## 📦 Package Breakdown

The monorepo is organized into several key packages:

### `packages/db`

This package is the heart of our data layer. It manages all database interactions and exposes the core business logic.

- **Prisma**: We use Prisma as our ORM for type-safe database access. The schema is defined in `prisma/schema.prisma`.
- **Prisma Client**: The generated Prisma client is used within the service layer to interact with the database.
- **`zodSchemas`**: To ensure data integrity from the database to the client, we define Zod schemas that correspond to our Prisma models. These are used for validation throughout the application.
- **`services`**: This directory contains the core business logic. Functions here are responsible for complex database operations, encapsulating logic that can be reused across the tRPC API and other parts of the system.

### `packages/trpc`

This package defines our API endpoints.

- **`routers`**: Contains the tRPC routers. Each router groups related procedures (queries and mutations) for a specific domain (e.g., `patient`, `appointment`). These routers are combined to form the main app router.

### `packages/auth`

Authentication is handled by this dedicated package.

- **Better-Auth**: We use `better-auth` for our authentication needs, providing a robust and secure way to manage user sessions and protect routes. The configuration is managed via `.mcp.json`, ensuring a streamlined integration.

### `packages/redis`

This package provides a Redis client and related utilities for high-performance caching. It complements the Next.js Data Cache by providing a shared cache for scenarios that require it, such as:

- Session management
- Rate limiting
- Caching expensive database query results that are shared across users.

### `packages/logger`

For observability and debugging, we use a dedicated logging package.

- **Pino**: This package is configured with Pino, a high-performance, low-overhead logger. It produces structured JSON logs, which are ideal for production environments and log analysis tools.

### `packages/utils`

A general-purpose package for common functions and utilities that are shared across the entire monorepo. This includes things like date formatters, string manipulation functions, and other helpers to avoid code duplication.