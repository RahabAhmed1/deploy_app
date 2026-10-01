# PharmaFlow Startup Script
# Starts minikube and deploys all pods automatically

Write-Host "==> Starting Docker Desktop..." -ForegroundColor Cyan
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
Start-Sleep 20

Write-Host "==> Starting minikube..." -ForegroundColor Cyan
minikube start --driver=docker 2>&1 | Out-Null

Write-Host "==> Applying manifests..." -ForegroundColor Cyan
kubectl apply -f "$PSScriptRoot\..\k8s\namespace.yaml" 2>&1 | Out-Null
kubectl apply -f "$PSScriptRoot\..\k8s\secrets.yaml" 2>&1 | Out-Null
kubectl apply -f "$PSScriptRoot\..\k8s\uploads-pvc.yaml" 2>&1 | Out-Null
kubectl apply -f "$PSScriptRoot\..\k8s\mongodb.yaml" 2>&1 | Out-Null
kubectl apply -f "$PSScriptRoot\..\k8s\backend.yaml" 2>&1 | Out-Null
kubectl apply -f "$PSScriptRoot\..\k8s\frontend.yaml" 2>&1 | Out-Null

Write-Host "==> PharmaFlow is running!" -ForegroundColor Green
Write-Host "==> Starting auto-deploy watcher..." -ForegroundColor Cyan

# Auto-deploy watcher — checks every 60s for new Docker Hub images
$DOCKERHUB_USERNAME = "rahab123"
$lastFrontendId = ""
$lastBackendId  = ""

while ($true) {
    try {
        docker pull "$DOCKERHUB_USERNAME/pharmaflow-frontend:latest" 2>&1 | Out-Null
        docker pull "$DOCKERHUB_USERNAME/pharmaflow-backend:latest"  2>&1 | Out-Null

        $fid = (docker inspect "$DOCKERHUB_USERNAME/pharmaflow-frontend:latest" 2>$null | ConvertFrom-Json)[0].Id
        $bid = (docker inspect "$DOCKERHUB_USERNAME/pharmaflow-backend:latest"  2>$null | ConvertFrom-Json)[0].Id

        if ($fid -ne $lastFrontendId -and $lastFrontendId -ne "") {
            Write-Host "[$(Get-Date -f 'HH:mm:ss')] New frontend image — restarting..." -ForegroundColor Green
            kubectl rollout restart deployment/frontend -n pharmaflow 2>&1 | Out-Null
        }
        if ($bid -ne $lastBackendId -and $lastBackendId -ne "") {
            Write-Host "[$(Get-Date -f 'HH:mm:ss')] New backend image — restarting..." -ForegroundColor Green
            kubectl rollout restart deployment/backend -n pharmaflow 2>&1 | Out-Null
        }

        $lastFrontendId = $fid
        $lastBackendId  = $bid
    } catch {}

    Start-Sleep 60
}
