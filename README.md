# Hello World: Frontend + Backend + PostgreSQL via ArgoCD

A minimal 3-tier app deployed to a specific worker node (`workder`, label `workload=app`)
using ArgoCD.

## Architecture
- **frontend**: nginx serving a static page, proxies `/api/*` to the backend service
- **backend**: Node/Express, queries Postgres and returns JSON at `/api/hello`
- **postgresql**: single-replica Postgres with a 1Gi PVC

All three Deployments use:
```yaml
nodeSelector:
  workload: app
```
so the scheduler only places pods on nodes carrying that label — which your `workder`
node already has.

## 1. Label the node (if not already)
```bash
kubectl label node workder workload=app
```

## 2. Build & push images
```bash
cd backend
docker build -t YOUR_REGISTRY/hello-backend:latest .
docker push YOUR_REGISTRY/hello-backend:latest

cd ../frontend
docker build -t YOUR_REGISTRY/hello-frontend:latest .
docker push YOUR_REGISTRY/hello-frontend:latest
```
Then update the `image:` fields in:
- `k8s/06-backend-deployment.yaml`
- `k8s/07-frontend-deployment.yaml`

## 3. Push manifests to a git repo
ArgoCD pulls from git, so commit this whole folder (or at least `k8s/`) to a repo
ArgoCD can reach, then update `argocd/application.yaml`:
```yaml
spec:
  source:
    repoURL: https://github.com/YOUR_ORG/YOUR_REPO.git
    targetRevision: main
    path: k8s
```

## 4. Apply the ArgoCD Application
```bash
kubectl apply -f argocd/application.yaml
```
ArgoCD will create the `hello-world` namespace and sync Postgres, backend, and
frontend automatically (`syncPolicy.automated` with prune + self-heal).

## 5. Install ingress-nginx (pinned to `workder`, listening on host port 8080)
```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  -f ingress-nginx-values.yaml
```
`ingress-nginx-values.yaml` runs the controller as a `DaemonSet` with
`hostNetwork: true`, scheduled onto the `workload=app` node (your `workder`
node) and bound directly to host port `8080`. This sidesteps Kubernetes'
default NodePort range (30000-32767) so you get exactly port 8080.

## 6. Access it
```bash
curl -H "Host: hello.local" http://<workder-node-ip>:8080
```
or add `hello.local` to `/etc/hosts` pointing at the node IP and just open
`http://hello.local:8080` in a browser.

The `Ingress` (`k8s/08-ingress.yaml`) routes all traffic to the `frontend`
Service (now `ClusterIP`, since the ingress controller handles the external
port). The frontend's nginx still proxies `/api/*` internally to the backend.

## Notes / things to change before "real" use
- `k8s/01-postgres-secret.yaml` has a placeholder password (`changeme123`) —
  replace it, ideally via a sealed-secret or external secret store rather than
  plain YAML in git.
- `nodeSelector: workload: app` schedules onto *any* node with that label.
  If you specifically want it pinned to the single node named `workder`,
  you can instead/also add `nodeName: workder` to each pod spec, or use
  `kubernetes.io/hostname: workder` as the nodeSelector key.
- PVC uses the cluster's default StorageClass — set `storageClassName`
  explicitly in `02-postgres-pvc.yaml` if you have more than one.
