# Quick Update Script for Contract Address
# Run this after deploying contract v23

param(
    [Parameter(Mandatory = $true)]
    [string]$ContractAddress
)

# Validate address format
if ($ContractAddress -notmatch '^AS1[a-zA-Z0-9]{48}$') {
    Write-Host "❌ Invalid contract address format!" -ForegroundColor Red
    Write-Host "Expected: AS1 followed by 48 characters" -ForegroundColor Yellow
    Write-Host "Example: AS1oVUJJbhe8qShhhvfhsPwL5RjqVD8i4RQ4F7Sd7wsNW3iMsWVM" -ForegroundColor Gray
    exit 1
}

Write-Host "🔧 Updating SIV Contract Address..." -ForegroundColor Cyan
Write-Host "New Address: $ContractAddress" -ForegroundColor Green

# Path to env.ts file
$envFile = "web\src\config\env.ts"

if (-not (Test-Path $envFile)) {
    Write-Host "❌ File not found: $envFile" -ForegroundColor Red
    exit 1
}

# Read file content
$content = Get-Content $envFile -Raw

# Replace the VITE_SIV_VAULT_ADDRESS default value
$pattern = '(VITE_SIV_VAULT_ADDRESS:.*?\.default\(")AS1[a-zA-Z0-9]{48}("\))'
$replacement = "`${1}$ContractAddress`${2}"

if ($content -match $pattern) {
    $newContent = $content -replace $pattern, $replacement
    
    # Write back to file
    Set-Content -Path $envFile -Value $newContent -NoNewline
    
    Write-Host "✅ Updated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Changes made to: $envFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. cd web" -ForegroundColor Gray
    Write-Host "2. npm run dev" -ForegroundColor Gray
    Write-Host "3. Test at http://localhost:5173" -ForegroundColor Gray
    Write-Host ""
    Write-Host "📖 See TESTING-GUIDE.md for full testing checklist" -ForegroundColor Cyan
}
else {
    Write-Host "❌ Could not find VITE_SIV_VAULT_ADDRESS in $envFile" -ForegroundColor Red
    Write-Host "Please update manually" -ForegroundColor Yellow
    exit 1
}
