$ErrorActionPreference = "Stop"

$failures = 0

function Check([string]$label, [bool]$condition, [string]$detail = "") {
    if ($condition) {
        Write-Host "[PASS] $label" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] $label $(if ($detail) { "-> $detail" })" -ForegroundColor Red
        $script:failures++
    }
}

Write-Host "=== Security Hardening Verification (Static + Config Audit) ===" -ForegroundColor Cyan

# 1. Gitignore & Public Hygiene
$gitignore = Get-Content ".gitignore" -Raw
Check ".gitignore ignores .env* while keeping .env.example" ($gitignore -match "\.env" -and $gitignore -match "!\*\.env\.example" -and $gitignore -match "/public/uploads/\*")

$publicFiles = Get-ChildItem "public" -Recurse -File -Force | Select-Object -ExpandProperty FullName
$suspiciousPublic = $publicFiles | Where-Object { $_ -match '(\.env($|\.)|[\\/]\.git([\\/]|$)|\.log$|\.bak$|\.sql$)' }
Check "No sensitive files in public/" ($null -eq $suspiciousPublic -or $suspiciousPublic.Count -eq 0) "$($suspiciousPublic -join ', ')"

# 2. .env.example placeholder hygiene
$envExample = Get-Content ".env.example" -Raw
Check ".env.example includes SESSION_SECRET, ALLOWED_ORIGINS, ALLOW_DEMO_AUTH=false, ALLOW_ADMIN_SEED=false" (
    $envExample -match 'SESSION_SECRET=' -and
    $envExample -match 'ALLOWED_ORIGINS=' -and
    $envExample -match 'ALLOW_DEMO_AUTH="false"' -and
    $envExample -match 'ALLOW_ADMIN_SEED="false"' -and
    $envExample -match 'DEFAULT_MOCK_ROLE="EMPLOYEE"'
)
Check ".env.example contains zero real secrets" (-not ($envExample -match '(sk_live_|npg_|gQAAAAAAA|eyJVc2VySUQi|sig_7PKPS|sig_4vYKB)'))

# 3. No client-side mock cookie auth spoofing or FileReader fallback
$uiFiles = Get-ChildItem -Path "src/app", "src/components", "src/hooks", "src/middleware.ts" -Recurse -File -Include *.ts,*.tsx
$badClientAuth = $uiFiles | Select-String -Pattern '(document\.cookie\s*=|mock_token|mock_user_role|mock_persona|readAsDataURL|dangerouslySetInnerHTML)' -CaseSensitive
Check "Zero client cookie auth spoofing, readAsDataURL fallback, or dangerouslySetInnerHTML in UI/Middleware" ($null -eq $badClientAuth -or $badClientAuth.Count -eq 0) "$($badClientAuth | ForEach-Object { "$($_.Filename):$($_.LineNumber)" } | Out-String)"

# 4. No SVG upload accept attributes in UI
$svgAccept = $uiFiles | Select-String -Pattern 'image/svg\+xml'
Check "SVG removed from client image upload accept filters" ($null -eq $svgAccept -or $svgAccept.Count -eq 0)

# 5. No x-user-* header trust in API routes or middleware
$apiFiles = Get-ChildItem -Path "src/app/api", "src/lib/http", "src/middleware.ts" -Recurse -File -Include *.ts
$headerTrust = $apiFiles | Select-String -Pattern 'headers\.get\(["'']x-user-'
Check "API routes & middleware never trust x-user-* headers" ($null -eq $headerTrust -or $headerTrust.Count -eq 0)

# 6. Zero CORS wildcards in codebase
$allSrc = Get-ChildItem -Path "src" -Recurse -File -Include *.ts,*.tsx
$corsWildcard = $allSrc | Select-String -Pattern 'Access-Control-Allow-Origin[''"]\s*,\s*[''"]\*[''"]'
Check "No Access-Control-Allow-Origin wildcard (*)" ($null -eq $corsWildcard -or $corsWildcard.Count -eq 0)

# 7. DB SSL enforcement & zero raw SQL interpolation
$dbFiles = Get-Content "src/lib/db/index.ts" -Raw
$drizzleCfg = Get-Content "drizzle.config.ts" -Raw
$seedScript = Get-Content "scripts/seed-neon.ts" -Raw
Check "Database SSL/TLS enforced across runtime, Drizzle, and seed script" (
    $dbFiles -match "rejectUnauthorized:\s*true" -and
    $drizzleCfg -match "sslmode" -and
    $seedScript -match "sslmode"
)
$rawSql = $allSrc | Select-String -Pattern 'sql\.raw'
Check "Zero sql.raw calls in src/" ($null -eq $rawSql -or $rawSql.Count -eq 0)

# 8. Dependencies cleanup & security packages
$pkg = Get-Content "package.json" -Raw
Check "package.json has bcryptjs, patched Next.js floor, and unused UI libs removed" (
    $pkg -match '"bcryptjs":' -and
    $pkg -match '"next":\s*"\^15\.5\.29"' -and
    -not ($pkg -match '@radix-ui/') -and
    -not ($pkg -match '"sonner"') -and
    -not ($pkg -match '"date-fns"') -and
    -not ($pkg -match '"class-variance-authority"')
)

# 9. Zero GET calls to /api/admin/seed without POST method
$seedGetCalls = $uiFiles | Select-String -Pattern 'fetch\("/api/admin/seed"\)'
Check "Client seed calls use POST (not CSRF-prone GET)" ($null -eq $seedGetCalls -or $seedGetCalls.Count -eq 0)

Write-Host ""
if ($failures -gt 0) {
    Write-Host "FAILED: $failures check(s) failed." -ForegroundColor Red
    exit 1
} else {
    Write-Host "ALL SECURITY STATIC & CONFIG CHECKS PASSED." -ForegroundColor Green
    exit 0
}
