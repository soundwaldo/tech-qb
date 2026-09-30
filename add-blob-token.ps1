#!/usr/bin/env pwsh
# add-blob-token.ps1 - Add Vercel Blob token to .env.local and deploy

param(
  [Parameter(Mandatory=$true)]
  [string]$BlobToken
)

$envFile = ".env.local"
$envContent = Get-Content $envFile -Raw

# Check if token already exists
if ($envContent -match 'BLOB_READ_WRITE_TOKEN=') {
  Write-Host "⚠️  BLOB_READ_WRITE_TOKEN already in .env.local. Replacing..." -ForegroundColor Yellow
  $envContent = $envContent -replace 'BLOB_READ_WRITE_TOKEN=.*', "BLOB_READ_WRITE_TOKEN=$BlobToken"
} else {
  Write-Host "✓ Adding BLOB_READ_WRITE_TOKEN to .env.local" -ForegroundColor Green
  $envContent += "`n`n# Vercel Blob Storage`nBLOB_READ_WRITE_TOKEN=$BlobToken`n"
}

# Write back to .env.local
Set-Content $envFile $envContent

Write-Host "✓ Token added to .env.local" -ForegroundColor Green

# Add to Vercel production environment
Write-Host "⏳ Adding token to Vercel production environment..." -ForegroundColor Cyan
Push-Location .
vercel env add BLOB_READ_WRITE_TOKEN --production
Pop-Location

# Deploy
Write-Host "`n⏳ Deploying to production..." -ForegroundColor Cyan
Push-Location .
vercel --prod --yes
Pop-Location

Write-Host "`n✓ Blob storage is live!" -ForegroundColor Green
Write-Host "📦 Token is now in:" -ForegroundColor Cyan
Write-Host "  - .env.local (local development)" 
Write-Host "  - Vercel production secrets (prepthetech/cam2verify)"
