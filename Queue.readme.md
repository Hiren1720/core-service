# Redis & BullMQ Queue Architecture

## Overview

This project uses **Redis + BullMQ** for background jobs and asynchronous task processing.

The main purpose of the queue system is to prevent heavy operations from blocking API requests and to allow the application to scale when the number of companies and employees increases.

### Current / Planned Use Cases

* Daily attendance generation
* Payroll generation
* Email processing
* Notifications
* Other heavy background operations

---

# Architecture

```text
                    ┌──────────────────┐
                    │    Node.js API   │
                    └────────┬─────────┘
                             │
                             │ Add Job
                             ▼
                    ┌──────────────────┐
                    │     BullMQ       │
                    │      Queue       │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │      Redis       │
                    │  Queue Storage   │
                    └────────┬─────────┘
                             │
                             │ Consume Job
                             ▼
                    ┌──────────────────┐
                    │      Worker      │
                    │   BullMQ Worker  │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │     MongoDB      │
                    │  Business Data   │
                    └──────────────────┘
```

The API should generally **create jobs**, while workers should perform the actual heavy work.

---

# Why Redis + BullMQ?

Without a queue:

```text
API Request
    │
    ▼
Process 50,000 employees
    │
    ▼
MongoDB operations
    │
    ▼
Response
```

This can cause:

* Long API response times
* Request timeouts
* High memory usage
* High CPU usage
* Difficult retry handling
* Poor scalability

With BullMQ:

```text
API Request
    │
    ▼
Create Queue Job
    │
    ▼
Return Response
    │
    ▼
Redis
    │
    ▼
Worker
    │
    ▼
Process Data
```

The API remains fast while workers handle background processing.

---

# Directory Structure

Recommended structure:

```text
src/
│
├── config/
│   └── redis.config.ts
│
├── queues/
│   ├── attendance.queue.ts
│   ├── payroll.queue.ts
│   ├── email.queue.ts
│   └── notification.queue.ts
│
├── workers/
│   ├── attendance.worker.ts
│   ├── payroll.worker.ts
│   ├── email.worker.ts
│   └── notification.worker.ts
│
├── schedulers/
│   ├── attendance.scheduler.ts
│   └── payroll.scheduler.ts
│
├── services/
│   ├── attendance.service.ts
│   └── payroll.service.ts
│
├── server.ts
└── index.worker.ts
```

---

# Redis Configuration

Redis is responsible for storing queue information and job state.

Example:

```ts
// config/redis.config.ts

import { Redis } from "ioredis";

let redis: Redis | null = null;

export const getRedisConnection = () => {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
    });
  }

  return redis;
};
```

Environment:

```env
REDIS_URL=redis://localhost:6379
```

For production:

```env
REDIS_URL=redis://username:password@redis-host:6379
```

---

# Queue Structure

Each major background operation should have its own queue.

```text
Redis
 │
 ├── attendance
 │
 ├── payroll
 │
 ├── email
 │
 └── notification
```

Do not put unrelated workloads into one queue.

For example, payroll processing should not block attendance processing.

---

# Queue Definition

Example attendance queue:

```ts
// queues/attendance.queue.ts

import { Queue } from "bullmq";
import { getRedisConnection } from "../config/redis.config";

export const attendanceQueue = new Queue("attendance", {
  connection: getRedisConnection(),
});
```

---

# Adding Jobs

The application should add jobs to the queue.

Example:

```ts
await attendanceQueue.add(
  "createCompanyDailyAttendance",
  {
    companyId,
    date,
  },
  {
    attempts: 3,

    backoff: {
      type: "exponential",
      delay: 5000,
    },

    removeOnComplete: true,
    removeOnFail: false,
  },
);
```

The API does not perform the heavy operation directly.

Instead:

```text
API
 ↓
attendanceQueue.add()
 ↓
Redis
 ↓
Worker
```

---

# Worker

Workers consume jobs from Redis.

Example:

```ts
// workers/attendance.worker.ts

import { Worker } from "bullmq";
import { getRedisConnection } from "../config/redis.config";
import { createCompanyDailyAttendance } from "../services/attendance.service";

new Worker(
  "attendance",

  async (job) => {
    switch (job.name) {
      case "createCompanyDailyAttendance":

        await createCompanyDailyAttendance(
          job.data.companyId,
          job.data.date,
        );

        break;
    }
  },

  {
    connection: getRedisConnection(),

    concurrency: 5,
  },
);
```

---

# Worker Concurrency

BullMQ allows multiple jobs to be processed concurrently.

Example:

```ts
concurrency: 5
```

means the worker can process multiple jobs at the same time.

For example:

```text
Worker
 │
 ├── Company A
 ├── Company B
 ├── Company C
 ├── Company D
 └── Company E
```

The correct concurrency depends on:

* MongoDB capacity
* Redis capacity
* CPU
* RAM
* Job processing time
* Number of employees

Start conservatively:

```ts
concurrency: 5
```

Then increase after monitoring production performance.

---

# Horizontal Worker Scaling

Workers can also be scaled horizontally.

For example:

```text
Worker 1 ─┐
Worker 2  │
Worker 3  ├── Redis/BullMQ
Worker 4 ─┘
```

With PM2:

```bash
pm2 start dist/index.worker.js \
  --name core-worker \
  -i 2
```

This creates two worker processes.

You can increase them later:

```bash
pm2 scale core-worker 4
```

The workers share the queue through Redis.

---

# Scheduler

Schedulers are responsible for creating jobs at specific times.

They should **not perform heavy processing themselves**.

For example:

```text
Scheduler
    │
    │ Every morning
    ▼
Find active companies
    │
    ▼
Create attendance jobs
    │
    ▼
Redis
    │
    ▼
Workers
```

The scheduler should be lightweight.

---

# Attendance Queue Architecture

Daily attendance is a good example of queue processing.

Do NOT create one job containing all employees:

```text
createDailyAttendance
    │
    └── 100,000 employees
```

Instead, create one job per company:

```text
createDailyAttendance
        │
        ├── Company A
        ├── Company B
        ├── Company C
        ├── Company D
        └── Company E
```

Each company job then processes its employees in batches.

---

# Employee Batching

Do not load every employee into memory.

Use batches:

```text
Company A
   │
   ├── 500 employees
   ├── 500 employees
   ├── 500 employees
   ├── 500 employees
   └── ...
```

Example:

```ts
const BATCH_SIZE = 500;
```

Each batch should use MongoDB `bulkWrite()` rather than inserting employees one-by-one.

---

# Idempotent Jobs

Queue jobs must be safe to retry.

A worker can fail because of:

* MongoDB temporary failure
* Redis connection issue
* Server restart
* Worker crash
* Network issue

BullMQ may retry the job.

Therefore, attendance creation should not blindly create duplicate records.

Use a unique index:

```ts
AttendanceSchema.index(
  {
    userId: 1,
    attendanceDate: 1,
  },
  {
    unique: true,
  },
);
```

And use:

```ts
$setOnInsert
```

when appropriate.

This makes the operation safe to execute multiple times.

---

# Job Retry

Jobs should have retry configuration.

```ts
{
  attempts: 3,

  backoff: {
    type: "exponential",
    delay: 5000,
  }
}
```

Example:

```text
Attempt 1
   │
   ▼
Failed
   │
   ▼
5 seconds
   │
   ▼
Attempt 2
   │
   ▼
Failed
   │
   ▼
10 seconds
   │
   ▼
Attempt 3
```

This prevents temporary failures from immediately marking jobs as permanently failed.

---

# Job ID

Important jobs should have deterministic job IDs when duplicate scheduling must be prevented.

For attendance:

```ts
const jobId = `attendance:${companyId}:${dateKey}`;
```

Example:

```text
attendance:company123:2026-08-13
```

If the scheduler accidentally runs twice, the same job ID can prevent duplicate scheduling.

---

# Attendance Flow

```text
                    Scheduler
                        │
                        ▼
              Get Active Companies
                        │
                        ▼
                  addBulk()
                        │
                        ▼
                     Redis
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
      Company A     Company B     Company C
          │             │             │
          ▼             ▼             ▼
       Worker        Worker        Worker
          │             │             │
          ▼             ▼             ▼
       MongoDB       MongoDB       MongoDB
```

---

# Payroll Flow

Payroll should also use BullMQ.

Instead of:

```text
POST /payroll/generate

     ↓

Generate payroll for 10,000 employees

     ↓

HTTP request waits
```

Use:

```text
POST /payroll/generate
        │
        ▼
Create payroll jobs
        │
        ▼
Return 202 Accepted
        │
        ▼
Redis
        │
        ▼
Payroll Workers
        │
        ▼
MongoDB
```

Example job:

```text
payroll:companyA:user123:2026-08
```

This allows payroll processing to scale independently from attendance.

---

# Separate Queues

Recommended queues:

```text
                    Redis
                      │
        ┌─────────────┼──────────────┐
        │             │              │
        ▼             ▼              ▼
   Attendance      Payroll         Email
      Queue         Queue          Queue
        │             │              │
        ▼             ▼              ▼
   Attendance      Payroll         Email
    Workers        Workers         Workers
```

Later:

```text
Notification Queue
Report Queue
Export Queue
Webhook Queue
```

can be added without changing the existing architecture.

---

# Production Process

The application should have separate API and worker processes.

```text
                    PM2
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
    core-service            core-worker
    API Server              BullMQ Worker
          │                     │
          │                     │
          └──────────┬──────────┘
                     │
                     ▼
                   Redis
                     │
                     ▼
                  MongoDB
```

Start API:

```bash
pm2 start dist/server.js --name core-service
```

Start workers:

```bash
pm2 start dist/index.worker.js --name core-worker -i 2
```

Save PM2 configuration:

```bash
pm2 save
```

---

# Worker Entry Point

Keep workers separate from the HTTP server.

Example:

```ts
// index.worker.ts

import "./workers/attendance.worker";
import "./workers/payroll.worker";
import "./workers/email.worker";
```

Then:

```bash
npm run build
```

and:

```bash
npm run start:worker
```

The API server does not need to execute queue-processing code.

---

# Development

Run API:

```bash
npm run dev
```

Run worker:

```bash
npm run dev:worker
```

Both processes should be running during development when testing background jobs.

---

# Production

Build:

```bash
npm run build
```

Start API:

```bash
pm2 start dist/server.js --name core-service
```

Start workers:

```bash
pm2 start dist/index.worker.js --name core-worker -i 2
```

Check:

```bash
pm2 status
```

Logs:

```bash
pm2 logs core-service
```

```bash
pm2 logs core-worker
```

---

# Scaling Strategy

The queue architecture is designed to scale independently.

### Small installation

```text
1 API
1 Worker
Redis
MongoDB
```

### Medium installation

```text
1 API
2 Workers
Redis
MongoDB
```

### Large installation

```text
Multiple API instances
        │
        ▼
Load Balancer
        │
        ▼
     Redis
        │
 ┌──────┼──────┐
 ▼      ▼      ▼
Worker Worker Worker
  1      2      3
        │
        ▼
     MongoDB
```

Workers can be increased without changing the API.

---

# Important Rules

## 1. API should not perform heavy background work

Bad:

```ts
await generatePayrollForAllEmployees();
```

Better:

```ts
await payrollQueue.add(...);
```

---

## 2. Workers should be idempotent

A job can execute more than once.

Always design jobs so retrying them does not corrupt data.

---

## 3. Use bulk operations

Avoid:

```ts
for (const user of users) {
  await Model.create(user);
}
```

Prefer:

```ts
await Model.bulkWrite(operations);
```

---

## 4. Use batches

Avoid loading huge datasets:

```text
100,000 employees → memory
```

Prefer:

```text
500
500
500
...
```

---

## 5. Separate queues by workload

Don't use one queue for everything.

Use:

```text
attendance
payroll
email
notification
```

---

## 6. Keep concurrency controlled

Do not immediately configure:

```ts
concurrency: 100;
```

Start with something like:

```ts
concurrency: 5;
```

and increase based on actual MongoDB and server performance.

---

# Monitoring

Monitor:

* Waiting jobs
* Active jobs
* Completed jobs
* Failed jobs
* Retry count
* Worker CPU
* Worker memory
* Redis memory
* MongoDB CPU
* MongoDB connections
* Job processing time

The queue should be treated as a separate infrastructure component and monitored independently.

---

# Final Architecture

```text
                         ┌───────────────┐
                         │   Client App  │
                         └───────┬───────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │   Node API    │
                         └───────┬───────┘
                                 │
                         Create Background Job
                                 │
                                 ▼
                         ┌───────────────┐
                         │    BullMQ     │
                         └───────┬───────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │     Redis     │
                         └───────┬───────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
                ▼                ▼                ▼
          Attendance          Payroll           Email
           Worker             Worker            Worker
                │                │                │
                └────────────────┼────────────────┘
                                 │
                                 ▼
                           ┌────────────┐
                           │  MongoDB   │
                           └────────────┘
```

## Goal

The queue system should provide:

* **Fast APIs**
* **Reliable background processing**
* **Automatic retries**
* **Idempotent jobs**
* **Controlled concurrency**
* **Horizontal worker scaling**
* **Independent workload processing**
* **Support for large numbers of companies and employees**

The most important design principle is:

> **The API schedules work. Redis stores the work. BullMQ manages the work. Workers execute the work. MongoDB stores the result.**
