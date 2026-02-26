# `@naroto/redis`

This package is responsible for all interactions with Redis, serving two primary functions for the Naroto application:

1.  **Caching**: Provides a centralized Redis client and caching keys for use by the service layer (`@naroto/db`).
2.  **Job Queuing**: Implements a robust background job processing system using BullMQ.

## 📦 Modules

-   **`src/client.ts`**: Exports a singleton instance of the `ioredis` client, configured via environment variables. This client is used by both the caching service and the queue manager.

-   **`src/config.ts`**: Contains default configurations for BullMQ queues, such as retry attempts and job retention policies.

-   **`src/cache-keys.ts`**: A crucial file that centralizes the definition of all cache keys and their Time-To-Live (TTL) values. This prevents key collisions and makes cache management predictable.

-   **`src/queue.ts`**: Contains the `JobQueueManager`, a powerful class that manages all BullMQ queues and workers.

-   **`src/types.ts`**: Defines the TypeScript types for all job data payloads, ensuring type safety when adding and processing jobs.

## 🚀 Using the Job Queue

The job queue is designed to handle asynchronous, long-running, or deferrable tasks like sending emails, generating reports, or processing reminders.

### Adding a Job to the Queue

To enqueue a job from anywhere in the application (typically from a service in `@naroto/db`), use the `addJob` function.

```typescript
import { addJob } from '@naroto/redis';

await addJob('send-email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: '...'
});
```

### How to Add a New Job Type

1.  **Define the Payload**: Open `src/types.ts` and add a new key to the `JobDataMap` interface with its corresponding data payload.

    ```typescript
    // src/types.ts
    export interface JobDataMap {
      // ... existing jobs
      'new-job-type': { recordId: string; userId: string };
    }
    ```

2.  **Add the Job to the List**: In `src/queue.ts`, find the `jobTypes` array inside the `initialize` method and add your new job type string (`'new-job-type'`).

3.  **Create a Handler**: In `src/queue.ts`, create a new private async method to process the job (e.g., `handleNewJobType`). This method will receive the job data as an argument.

4.  **Register the Handler**: In the `registerHandlers` method within `src/queue.ts`, add a line to map your new job type to its handler function.

    ```typescript
    // src/queue.ts in registerHandlers()
    this.handlers.set('new-job-type', this.handleNewJobType.bind(this) as unknown as JobHandler);
    ```