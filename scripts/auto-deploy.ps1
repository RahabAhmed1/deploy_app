# ─────────────────────────────────────────────────────────────
# PharmaFlow Auto Deploy Script
# Watches Docker Hub for new images and restarts minikube pods
# Usage: PowerShell as Admin → .\scripts\auto-deploy.ps1
# ─────────────────────────────────────────────────────────────

$DOCKERHUB_USERNAME = "rahab123"
$CHECK_INTERVAL = 60  # seconds between checks

function Get-RemoteDigest($image) {
    try {
        $result = docker manifest inspect "docker.io/${image}:latest" 2>$null | ConvertFrom-Json
        return ($result.manifests[0].digest ?? $result.config.digest ?? "unknown")
    } catch {
        return "unknown"
    }
}

function Get-LocalDigest($image) {
    try {
        $result = docker inspect "${image}:latest" 2>$null | ConvertFrom-Json
        return $result[0].Id ?? "none"
    } catch {
        return "none"
    }
}

Write-Host "==> PharmaFlow Auto Deploy started" -ForegroundColor Green
Write-Host "==> Checking every $CHECK_INTERVAL seconds for new images..." -ForegroundColor Cyan

# Point to minikube docker
& minikube docker-env --shell powershell | Invoke-Expression

$lastBackendDigest = ""
$lastFrontendDigest = ""

while ($true) {
    Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] Checking for updates..." -ForegroundColor Yellow

    # Pull latest images
    docker pull "$DOCKERHUB_USERNAME/pharmaflow-backend:latest" 2>$null | Out-Null
    docker pull "$DOCKERHUB_USERNAME/pharmaflow-frontend:latest" 2>$null | Out-Null

    $backendDigest = (docker inspect "$DOCKERHUB_USERNAME/pharmaflow-backend:latest" 2>$null | ConvertFrom-Json)[0].Id
    $frontendDigest = (docker inspect "$DOCKERHUB_USERNAME/pharmaflow-frontend:latest" 2>$null | ConvertFrom-Json)[0].Id

    if ($backendDigest -ne $lastBackendDigest -and $lastBackendDigest -ne "") {
        Write-Host "==> New backend image detected! Restarting..." -ForegroundColor Green
        kubectl rollout restart deployment/backend -n pharmaflow
        $lastBackendDigest = $backendDigest
    } elseif ($lastBackendDigest -eq "") {
        $lastBackendDigest = $backendDigest
    }

    if ($frontendDigest -ne $lastFrontendDigest -and $lastFrontendDigest -ne "") {
        Write-Host "==> New frontend image detected! Restarting..." -ForegroundColor Green
        kubectl rollout restart deployment/frontend -n pharmaflow
        $lastFrontendDigest = $frontendDigest
    } elseif ($lastFrontendDigest -eq "") {
        $lastFrontendDigest = $frontendDigest
    }

    Write-Host "==> No changes. Next check in $CHECK_INTERVAL seconds..." -ForegroundColor Gray
    Start-Sleep $CHECK_INTERVAL
}
