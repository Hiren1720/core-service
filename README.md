## Core Service

## Project Structure

```text
core-service/
│
├── src/
│   │
│   ├── config/
│   ├── infrastructure/
│   │   ├── database/
│   │   ├── redis/
│   │   ├── logger/
│   │   ├── queue/
│   │   └── events/
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── roles/
│   │   └── permissions/
│   │
│   ├── middleware/
│   ├── types/
│   ├── utils/
│   │
│   ├── app.ts
│   └── server.ts
│
├── tests/
│
├── .env
├── .env.example
├── tsconfig.json
├── package.json
├── Dockerfile
└── docker-compose.yml
```
