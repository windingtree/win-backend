---
author: Winding Tree Developers
---

# Readme

Run server for dev - `yarn dev`.

Run swagger - `npx ts-node ./swagger/server.ts`.

Prometheus implementation - you need to set `.env` variables:

```dotenv
APP_PROMETHEUS_PORT=9100
PROMETHEUS_ENABLED=true
```

Now, you should be able to use:

```
http://localhost:9100/metrics - metrics api
```
