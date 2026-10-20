# Dobha-Dobha

#DO NOT REMOVE :
WTC-VKUSCGQL

## Project status

Dobha-Dobha is a South African marketplace with a Flutter mobile app, a
React/Vite website, and backend code under `server/`. The React website
currently mounts the existing marketplace markup through a compatibility
bridge; its interactive code has not yet been fully migrated into React
components.

The repository contains an existing Lambda/DynamoDB backend and a separate,
incomplete Fastify/PostgreSQL foundation for a possible ECS Fargate migration.
They are not interchangeable: the ECS API has no production client cutover,
payment-provider integration, or complete marketplace routes. See
[the server guide](./server/README.md) and
[the ECS API foundation](./server/ecs-api/README.md) before deploying.

Payments, wallet deposits/withdrawals, order checkout, fulfillment, escrow
settlement, and paid listing boosts are disabled in the current source until
verified payment processing is implemented. Source changes do not change a
deployed service until a reviewed release is deployed; verify the active
runtime and release these protections before treating them as live.