# Empire Docker Deployment Guide

This guide explains how to run Empire: Wargame of the Century using Docker.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed (included with Docker Desktop)

## Quick Start

### Production Build

Build and run the containerized web version:

```bash
# Build the container
docker-compose build

# Start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

Access the game at: **http://localhost:8080**

### Development Mode

For development with hot-reloading:

```bash
# Start development container
docker-compose --profile dev up empire-dev

# Access at http://localhost:3000
```

Changes to files in `web/` will automatically reload.

## Docker Commands

### Build Only

```bash
docker build -t empire-web .
```

### Run Without Compose

```bash
docker run -d -p 8080:80 --name empire empire-web
```

### Check Container Health

```bash
docker inspect --format='{{.State.Health.Status}}' empire-empire-1
```

### View Logs

```bash
docker-compose logs empire
```

### Rebuild After Changes

```bash
docker-compose build --no-cache
docker-compose up -d
```

## Configuration

### Change Port

Edit `docker-compose.yml` to change the host port:

```yaml
ports:
  - "3000:80"  # Change 8080 to desired port
```

### Environment Variables

The container doesn't require any environment variables for basic operation.

## Production Deployment

### Using Docker Hub

```bash
# Tag for registry
docker tag empire-web your-registry/empire-web:latest

# Push to registry
docker push your-registry/empire-web:latest
```

### Using Docker Swarm

```bash
docker stack deploy -c docker-compose.yml empire
```

### Using Kubernetes

Create a deployment from the Docker image:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: empire
spec:
  replicas: 2
  selector:
    matchLabels:
      app: empire
  template:
    metadata:
      labels:
        app: empire
    spec:
      containers:
      - name: empire
        image: empire-web:latest
        ports:
        - containerPort: 80
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: empire
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 80
  selector:
    app: empire
```

## Troubleshooting

### Container Won't Start

Check logs:
```bash
docker-compose logs empire
```

### Port Already in Use

Change the port in `docker-compose.yml` or stop the conflicting service:
```bash
# Find what's using port 8080
netstat -ano | findstr :8080  # Windows
lsof -i :8080                 # Linux/Mac
```

### Build Fails

Ensure npm dependencies are up to date:
```bash
cd web
rm -rf node_modules package-lock.json
npm install
```

Then rebuild:
```bash
docker-compose build --no-cache
```

## Architecture

```
┌─────────────────────────────────────────────┐
│              Docker Container               │
│  ┌───────────────────────────────────────┐  │
│  │            nginx:alpine               │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │   /usr/share/nginx/html         │  │  │
│  │  │   - index.html                  │  │  │
│  │  │   - assets/                     │  │  │
│  │  │   - *.js (bundled TypeScript)   │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
│                    │                        │
│                    ▼                        │
│              Port 80 (HTTP)                 │
└─────────────────────────────────────────────┘
                     │
                     ▼
            Host Port 8080
```

## Image Size

The production image is optimized for size:
- Base: `nginx:alpine` (~23MB)
- Built app: ~500KB
- **Total: ~25MB**
