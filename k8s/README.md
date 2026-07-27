# COS Graph Engine — Kubernetes Deployment

## Quick Start

```bash
# Deploy to current cluster
kubectl apply -k k8s/

# Check status
kubectl get all -n cos-graph-engine
kubectl get pods -n cos-graph-engine -w

# Scale manually
kubectl scale deployment cos-engine -n cos-graph-engine --replicas=5

# Check autoscaler
kubectl get hpa cos-engine -n cos-graph-engine

# Get logs
kubectl logs -n cos-graph-engine -l app.kubernetes.io/component=engine

# Port forward
kubectl port-forward -n cos-graph-engine service/cos-engine 8080:8080
```

## Manifests

| File | Description |
|------|-------------|
| `namespace.yaml` | Namespace `cos-graph-engine` |
| `serviceaccount.yaml` | ServiceAccount + RBAC (read-only pods) |
| `configmap.yaml` | Environment configuration |
| `deployment.yaml` | 2 replicas, rolling update, liveness/readiness probes |
| `service.yaml` | ClusterIP service on port 8080 |
| `hpa.yaml` | Auto-scale: 2-10 replicas, CPU 70% / memory 80% |
| `ingress.yaml` | TLS ingress via nginx-ingress + cert-manager |
| `kustomization.yaml` | Kustomize bundle |

## Architecture

```
                  ┌──────────────┐
                  │  Ingress     │
                  │  (TLS)       │
                  └──────┬───────┘
                         │
                  ┌──────▼───────┐
                  │  Service     │
                  │  ClusterIP   │
                  └──────┬───────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
      ┌─────▼────┐ ┌────▼────┐ ┌────▼────┐
      │  Pod 1   │ │ Pod 2   │ │  ...    │
      │  engine  │ │ engine  │ │ engine  │
      └──────────┘ └─────────┘ └─────────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
      ┌─────▼────┐ ┌────▼────┐ ┌────▼────┐
      │ HPA      │ │ConfigMap│ │ SA/RBAC │
      │ 2-10 r   │ │  env    │ │  pods   │
      └──────────┘ └─────────┘ └─────────┘
```

## Production Checklist

- [ ] Replace `ghcr.io/higgsfield-cos/graph-engine` with your registry
- [ ] Configure cert-manager ClusterIssuer
- [ ] Set up Prometheus + Grafana in the cluster
- [ ] Configure external DNS for `api.cos-graph-engine.dev`
- [ ] Enable PodDisruptionBudget for HA
- [ ] Set resource quotas on the namespace
- [ ] Configure network policies for zero-trust