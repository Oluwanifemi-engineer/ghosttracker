# Magneetar Kubernetes Deployment

Production-grade Kubernetes deployment for horizontal scaling.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │   Ingress   │    │   Ingress   │    │   Ingress   │    │
│  │  Controller │    │  Controller │    │  Controller │    │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    │
│         │                  │                  │            │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐    │
│  │   Server    │    │   Server    │    │   Server    │    │
│  │   Pod 1     │    │   Pod 2     │    │   Pod 3     │    │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    │
│         │                  │                  │            │
│         └──────────────────┼──────────────────┘            │
│                            │                               │
│  ┌─────────────────────────▼─────────────────────────┐    │
│  │              PostgreSQL Cluster                    │    │
│  │         (Primary + 2 Read Replicas)                │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │              Redis Cluster                         │    │
│  │         (Sentinel for HA)                          │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │              Persistent Storage (S3/NFS)           │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Create namespace
kubectl apply -f namespace.yml

# 2. Create secrets
kubectl apply -f secrets.yml

# 3. Deploy PostgreSQL
kubectl apply -f postgresql/

# 4. Deploy Redis
kubectl apply -f redis/

# 5. Deploy server
kubectl apply -f server/

# 6. Deploy dashboard
kubectl apply -f dashboard/

# 7. Configure ingress
kubectl apply -f ingress.yml
```

## Components

### Server Deployment
- **Replicas**: 3 (auto-scales 3-10 based on CPU)
- **Resources**: 500m CPU, 512Mi memory
- **Health Checks**: Liveness + Readiness probes

### PostgreSQL
- **Primary**: Read/Write
- **Replicas**: 2 Read-only
- **Backup**: Daily to S3

### Redis
- **Sentinel**: 3 nodes for HA
- **Replicas**: 2 per master

## Scaling

### Horizontal Pod Autoscaler (HPA)
```yaml
minReplicas: 3
maxReplicas: 10
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Manual Scaling
```bash
kubectl scale deployment magneetar-server --replicas=5
```

## Monitoring

- **Prometheus**: Metrics collection
- **Grafana**: Dashboards
- **AlertManager**: PagerDuty/Slack alerts

## Troubleshooting

### Pod Not Starting
```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name> --previous
```

### Database Connection Issues
```bash
kubectl exec -it <server-pod> -- python -c "import psycopg2; print('OK')"
```

### High Memory Usage
```bash
kubectl top pods
kubectl describe node <node-name>
```
