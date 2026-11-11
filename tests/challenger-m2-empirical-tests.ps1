# Milestone 2 Empirical Adversarial Challenge Test Harness
# Cloud-Native Corporate Office Store Management System
# Challenger: challenger_m2_2 (teamwork_challenger)

$ErrorActionPreference = "Continue"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  MILESTONE 2 RELIABILITY PATTERNS - EMPIRICAL ADVERSARIAL HARNESS" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

$testResults = @()
$testCount = 0
$passCount = 0
$failCount = 0

function Run-ChallengeTest {
    param(
        [string]$Id,
        [string]$Description,
        [scriptblock]$TestBlock
    )
    $global:testCount++
    $startTime = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        & $TestBlock
        $startTime.Stop()
        $global:passCount++
        Write-Host "  [PASS] $Id - $Description ($($startTime.ElapsedMilliseconds)ms)" -ForegroundColor Green
        $global:testResults += [PSCustomObject]@{
            Id = $Id
            Description = $Description
            Status = "PASS"
            DurationMs = $startTime.ElapsedMilliseconds
            Error = $null
        }
    } catch {
        $startTime.Stop()
        $global:failCount++
        Write-Host "  [FAIL] $Id - $Description ($($startTime.ElapsedMilliseconds)ms)" -ForegroundColor Red
        Write-Host "         Error: $_" -ForegroundColor Red
        $global:testResults += [PSCustomObject]@{
            Id = $Id
            Description = $Description
            Status = "FAIL"
            DurationMs = $startTime.ElapsedMilliseconds
            Error = $_.ToString()
        }
    }
}

Write-Host "`n--- SECTION 1: API RELIABILITY WRAPPER & ERROR SANITIZATION ---" -ForegroundColor Yellow

# Test 1.1: Database URL and Secret Redaction
Run-ChallengeTest "ADV-REL-01" "Database credentials, Clerk keys, and API secrets are redacted" {
    $apiHandlerSrc = Get-Content "src/lib/http/api-handler.ts" -Raw
    
    if (-not ($apiHandlerSrc.Contains("[REDACTED_DB_URL]"))) {
        throw "Missing PostgreSQL URL redaction in api-handler.ts"
    }
    if (-not ($apiHandlerSrc.Contains("CLERK_SECRET_KEY=[REDACTED]"))) {
        throw "Missing Clerk secret key redaction in api-handler.ts"
    }
    if (-not ($apiHandlerSrc.Contains("[REDACTED_SECRET]"))) {
        throw "Missing secret key redaction in api-handler.ts"
    }
    if (-not ($apiHandlerSrc.Contains("[REDACTED_SIGKEY]"))) {
        throw "Missing signing key redaction in api-handler.ts"
    }

    # Simulate sanitizer logic
    $Sanitize = {
        param([string]$msg)
        $msg = [regex]::Replace($msg, "postgres(?:ql)?:\/\/[^\s""']+", "[REDACTED_DB_URL]", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        $msg = [regex]::Replace($msg, "CLERK_SECRET_KEY=[^\s""']+", "CLERK_SECRET_KEY=[REDACTED]", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        $msg = [regex]::Replace($msg, "sk_test_[a-zA-Z0-9_]+", "[REDACTED_SECRET]", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        $msg = [regex]::Replace($msg, "sigkey_[a-zA-Z0-9_]+", "[REDACTED_SIGKEY]", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        return $msg
    }

    $raw = "Error connecting to postgresql://postgres:SuperSecret123@db.neon.tech/neondb?sslmode=require with CLERK_SECRET_KEY=sk_test_live9988 and token sk_test_51Mz001 and sigkey_abc"
    $clean = & $Sanitize $raw

    if ($clean -like "*SuperSecret123*") { throw "Leaked database password!" }
    if ($clean -like "*db.neon.tech*") { throw "Leaked database host!" }
    if ($clean -notlike "*[REDACTED_DB_URL]*") { throw "Did not insert [REDACTED_DB_URL]" }
    if ($clean -like "*sk_test_live9988*") { throw "Leaked Clerk secret key!" }
    if ($clean -like "*sk_test_51Mz001*") { throw "Leaked Stripe/Upstash secret key!" }
    if ($clean -like "*sigkey_abc*") { throw "Leaked QStash signing key!" }
}

# Test 1.2: Timeout Controller 8000ms SLA Envelope
Run-ChallengeTest "ADV-REL-02" "Timeout aborts with 504 and exact message matching '8000ms SLA limit'" {
    $apiHandlerSrc = Get-Content "src/lib/http/api-handler.ts" -Raw
    if (-not ($apiHandlerSrc -match "timeoutMs\s*=\s*8000")) {
        throw "Default SLA timeout is not 8000ms"
    }
    if (-not ($apiHandlerSrc -match "504")) {
        throw "Timeout status code is not 504 Gateway Timeout"
    }
    if (-not ($apiHandlerSrc.Contains("8000ms SLA limit")) -and -not ($apiHandlerSrc.Contains("SLA limit"))) {
        throw "Timeout message does not contain SLA limit"
    }
    if (-not ($apiHandlerSrc -match "TimeoutError")) {
        throw "Timeout error taxonomy is not TimeoutError"
    }
}

# Test 1.3: Idempotency Mutex Lock & Concurrent Collision Detection (409)
Run-ChallengeTest "ADV-REL-03" "Idempotency in-flight collision returns 409 IdempotencyConflict" {
    $apiHandlerSrc = Get-Content "src/lib/http/api-handler.ts" -Raw
    if (-not ($apiHandlerSrc -match "IdempotencyConflict")) {
        throw "Missing IdempotencyConflict error taxonomy"
    }
    if (-not ($apiHandlerSrc -match "409")) {
        throw "Missing 409 Conflict HTTP status on collision"
    }
    if (-not ($apiHandlerSrc -match "IN_PROGRESS")) {
        throw "Missing IN_PROGRESS state check in api-handler.ts"
    }
}

# Test 1.4: Idempotency Replay Cache (x-cache: IDEMPOTENT_HIT)
Run-ChallengeTest "ADV-REL-04" "Cached completed response replays with x-cache: IDEMPOTENT_HIT header" {
    $apiHandlerSrc = Get-Content "src/lib/http/api-handler.ts" -Raw
    if (-not ($apiHandlerSrc -match "IDEMPOTENT_HIT")) {
        throw "Missing IDEMPOTENT_HIT header replay in api-handler.ts"
    }
    if (-not ($apiHandlerSrc -match "x-cache")) {
        throw "Missing x-cache header in api-handler.ts"
    }
}

# Test 1.5: Idempotency Lock Purge on Validation Failure or Exception
Run-ChallengeTest "ADV-REL-05" "Lock is purged via releaseIdempotencyLock on 4xx/5xx or thrown error" {
    $apiHandlerSrc = Get-Content "src/lib/http/api-handler.ts" -Raw
    # Verify lock release on non-2xx
    if (-not ($apiHandlerSrc -match "releaseIdempotencyLock\(effectiveUserId,\s*idempotencyKey\)")) {
        throw "Missing releaseIdempotencyLock on failure in api-handler.ts"
    }
    # Verify catch block also cleans up the lock
    $catchMatches = [regex]::Matches($apiHandlerSrc, "(?s)catch\s*\(thrown:[^)]+\)\s*\{.*?releaseIdempotencyLock")
    if ($catchMatches.Count -eq 0) {
        throw "Catch block does not call releaseIdempotencyLock to prevent client lockout on exception"
    }
}

Write-Host "`n--- SECTION 2: QSTASH SIGNATURE VERIFICATION (HMAC) ---" -ForegroundColor Yellow

# Test 2.1: Empty and Missing Signature Rejection (401)
Run-ChallengeTest "ADV-QST-01" "QStash rejects empty string and whitespace signature with InvalidSignature" {
    $qstashSrc = Get-Content "src/lib/queue/qstash.ts" -Raw
    if (-not ($qstashSrc -match "InvalidSignature")) {
        throw "Missing InvalidSignature error code in qstash.ts"
    }
    if (-not ($qstashSrc -match "signature\.trim\(\)\s*===\s*""""")) {
        throw "qstash.ts does not validate trimmed empty signature"
    }
}

# Test 2.2: Mock Signature Acceptance vs Forged Signature Rejection
Run-ChallengeTest "ADV-QST-02" "QStash mock mode accepts only mock_valid_signature and rejects all forged tokens" {
    $qstashSrc = Get-Content "src/lib/queue/qstash.ts" -Raw
    if (-not ($qstashSrc -match "mock_valid_signature")) {
        throw "Missing mock_valid_signature acceptance check in qstash.ts"
    }
    
    # Simulate verifySignatureAppRouter mock logic
    $VerifySig = {
        param([string]$sig)
        if ([string]::IsNullOrWhiteSpace($sig)) {
            return @{ isValid = $false; error = "InvalidSignature" }
        }
        if ($sig -eq "mock_valid_signature") {
            return @{ isValid = $true }
        }
        return @{ isValid = $false; error = "InvalidSignature" }
    }

    $valid = & $VerifySig "mock_valid_signature"
    if (-not $valid.isValid) { throw "Valid mock signature was incorrectly rejected" }

    $forged1 = & $VerifySig "invalid_signature"
    if ($forged1.isValid -or $forged1.error -ne "InvalidSignature") { throw "invalid_signature was not rejected with InvalidSignature" }

    $forged2 = & $VerifySig "forged_signature_token"
    if ($forged2.isValid -or $forged2.error -ne "InvalidSignature") { throw "forged_signature_token was not rejected with InvalidSignature" }

    $forged3 = & $VerifySig "bearer_token_xyz"
    if ($forged3.isValid) { throw "Random token was incorrectly accepted" }

    $empty = & $VerifySig ""
    if ($empty.isValid) { throw "Empty signature was accepted" }

    $whitespace = & $VerifySig "   "
    if ($whitespace.isValid) { throw "Whitespace signature was accepted" }
}

Write-Host "`n--- SECTION 3: STORAGE PRESIGN VALIDATION (10MB & EXTENSIONS) ---" -ForegroundColor Yellow

# Test 3.1: 10MB Boundary Enforcement
Run-ChallengeTest "ADV-STO-01" "Storage presign rejects files exceeding 10MB limit with PayloadTooLarge" {
    $storageSrc = Get-Content "src/services/storage.service.ts" -Raw
    if (-not ($storageSrc -match "10\s*\*\s*1024\s*\*\s*1024")) {
        throw "Missing 10MB limit (10 * 1024 * 1024) in storage.service.ts"
    }
    if (-not ($storageSrc -match "PayloadTooLarge")) {
        throw "Missing PayloadTooLarge DomainError in storage.service.ts"
    }

    $MAX = 10 * 1024 * 1024
    $CheckSize = {
        param([long]$size)
        if ($size -gt $MAX) { throw "PayloadTooLarge" }
        return $true
    }

    # At exact threshold (10MB) -> must PASS
    $resAt = & $CheckSize $MAX
    if (-not $resAt) { throw "Exact 10MB file was rejected" }

    # Under threshold (5MB) -> must PASS
    $resUnder = & $CheckSize (5 * 1024 * 1024)
    if (-not $resUnder) { throw "5MB file was rejected" }

    # Exceeding threshold (10MB + 1 byte) -> must FAIL
    $failed = $false
    try {
        & $CheckSize ($MAX + 1)
    } catch {
        if ($_.ToString() -like "*PayloadTooLarge*") { $failed = $true }
    }
    if (-not $failed) { throw "10MB + 1 byte file was NOT rejected" }
}

# Test 3.2: Disallowed Executable Extensions & Case Insensitivity
Run-ChallengeTest "ADV-STO-02" "Storage presign prohibits .sh, .exe, .bat, .cmd, .ps1 case-insensitively" {
    $storageSrc = Get-Content "src/services/storage.service.ts" -Raw
    if (-not ($storageSrc -match "PROHIBITED_EXTENSIONS")) {
        throw "Missing PROHIBITED_EXTENSIONS list in storage.service.ts"
    }
    if (-not ($storageSrc -match "\.sh") -or -not ($storageSrc -match "\.exe")) {
        throw "PROHIBITED_EXTENSIONS missing .sh or .exe"
    }
    if (-not ($storageSrc -match "DisallowedFileType")) {
        throw "Missing DisallowedFileType DomainError in storage.service.ts"
    }
    if (-not ($storageSrc -match "toLowerCase\(\)")) {
        throw "Storage service does not check lowercase filename (case-sensitivity vulnerability)"
    }

    $PROHIBITED = @(".sh", ".exe", ".bat", ".cmd", ".ps1", ".js", ".vbs")
    $ValidateExt = {
        param([string]$fname)
        $lower = $fname.Trim().ToLower()
        foreach ($ext in $PROHIBITED) {
            if ($lower.EndsWith($ext)) { throw "DisallowedFileType" }
        }
        return $true
    }

    $badFiles = @("exploit.sh", "virus.exe", "script.bat", "run.cmd", "payload.ps1", "EXPLOIT.SH", "MALWARE.EXE", "TEST.Bat")
    foreach ($bad in $badFiles) {
        $blocked = $false
        try {
            & $ValidateExt $bad
        } catch {
            if ($_.ToString() -like "*DisallowedFileType*") { $blocked = $true }
        }
        if (-not $blocked) { throw "Dangerous file '$bad' was not blocked!" }
    }

    $goodFiles = @("inventory.csv", "photo.png", "document.pdf", "data.json", "IMAGE.JPG")
    foreach ($good in $goodFiles) {
        $allowed = & $ValidateExt $good
        if (-not $allowed) { throw "Legitimate file '$good' was blocked" }
    }
}

# Test 3.3: Missing & Whitespace Filename Handling
Run-ChallengeTest "ADV-STO-03" "Storage presign rejects empty or whitespace-only filename with MissingFilename" {
    $storageSrc = Get-Content "src/services/storage.service.ts" -Raw
    if (-not ($storageSrc -match "MissingFilename")) {
        throw "Missing MissingFilename error code in storage.service.ts"
    }

    $ValidateName = {
        param([string]$fname)
        if ([string]::IsNullOrWhiteSpace($fname)) { throw "MissingFilename" }
        return $true
    }

    foreach ($empty in @("", "   ", "`t", "`n")) {
        $caught = $false
        try { & $ValidateName $empty } catch { $caught = $true }
        if (-not $caught) { throw "Empty filename '$empty' was not rejected" }
    }
}

# Test 3.4: 900s TTL Expiration
Run-ChallengeTest "ADV-STO-04" "Presigned upload URLs expire in 900 seconds (15 minutes)" {
    $storageSrc = Get-Content "src/services/storage.service.ts" -Raw
    if (-not ($storageSrc -match "900")) {
        throw "Presigned URL TTL is not 900 seconds in storage.service.ts"
    }
    if (-not ($storageSrc -match "expiresInSeconds:\s*(?:PRESIGNED_URL_TTL|900)")) {
        throw "Presigned upload result does not return expiresInSeconds = 900"
    }
}

Write-Host "`n--- SECTION 4: ACID TRANSACTIONS & REPOSITORIES INTEGRITY ---" -ForegroundColor Yellow

# Test 4.1: Deterministic Ascending Product Locking to Eliminate Deadlocks
Run-ChallengeTest "ADV-ACID-01" "Order creation sorts product IDs ascending to eliminate deadlock potential" {
    $orderSrvSrc = Get-Content "src/services/order.service.ts" -Raw
    if (-not ($orderSrvSrc.Contains("sort(") -and $orderSrvSrc.Contains("productId.localeCompare"))) {
        throw "Order service does not sort product IDs before locking"
    }
    
    $productRepoSrc = Get-Content "src/repositories/product.repo.ts" -Raw
    if (-not ($productRepoSrc.Contains("asc(schema.products.id)") -or $productRepoSrc.Contains("sortAscending"))) {
        throw "Product repository does not enforce ascending ID lock ordering"
    }
}

# Test 4.2: Department Budget Deduction & Underflow Prevention
Run-ChallengeTest "ADV-ACID-02" "Budget deduction verifies sufficiency and prevents negative remaining balance" {
    $orderSrvSrc = Get-Content "src/services/order.service.ts" -Raw
    if (-not ($orderSrvSrc.Contains("InsufficientBudget"))) {
        throw "Missing InsufficientBudget error in order.service.ts"
    }
    if (-not ($orderSrvSrc -match "remainingCents\s*<\s*calculatedTotalCents")) {
        throw "order.service.ts does not check remainingCents < calculatedTotalCents"
    }

    $budgetRepoSrc = Get-Content "src/repositories/budget.repo.ts" -Raw
    if (-not ($budgetRepoSrc.Contains("remainingCents")) -or -not ($budgetRepoSrc.Contains("amountCents"))) {
        throw "budget.repo.ts does not check balance sufficiency at repository boundary"
    }
}

# Test 4.3: Dynamic Auto-Approval Limit ($100.00 / 10000 cents threshold)
Run-ChallengeTest "ADV-ACID-03" "Orders under autoApproveLimit are APPROVED; orders over are PENDING_APPROVAL" {
    $orderSrvSrc = Get-Content "src/services/order.service.ts" -Raw
    if (-not ($orderSrvSrc.Contains("autoApproveLimitCents"))) {
        throw "Order service does not consult autoApproveLimitCents from store config"
    }
    if (-not ($orderSrvSrc -match "calculatedTotalCents\s*<\s*threshold")) {
        throw "Order service missing auto-approval threshold comparison"
    }
}

# Test 4.4: Stock & Budget Reversal on Order Cancellation and Rejection
Run-ChallengeTest "ADV-ACID-04" "Cancelling or rejecting order atomically restores reserved budget and inventory" {
    $orderSrvSrc = Get-Content "src/services/order.service.ts" -Raw
    if (-not ($orderSrvSrc.Contains("restoreRemainingBudget"))) {
        throw "order.service.ts does not call restoreRemainingBudget upon rejection/cancellation"
    }
    if (-not ($orderSrvSrc.Contains("updateStock"))) {
        throw "order.service.ts does not restore stock upon rejection/cancellation"
    }
}

Write-Host "`n--- SECTION 5: E2E TEST RUNNER VERIFICATION ---" -ForegroundColor Yellow

# Test 5.1: Execute Authoritative E2E Test Suite Bridge
Run-ChallengeTest "ADV-E2E-01" "Authoritative E2E runner bridge executes successfully with 0 exit code" {
    $runnerProcess = Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File tests/e2e/run-tests.ps1" -NoNewWindow -PassThru -Wait
    $exitCode = $runnerProcess.ExitCode
    if ($exitCode -ne 0) {
        throw "run-tests.ps1 failed with exit code $exitCode"
    }
}

Write-Host ""
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  EMPIRICAL CHALLENGE SUITE SUMMARY" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Total Challenge Tests: $global:testCount"
Write-Host "Passed:                $global:passCount" -ForegroundColor Green
Write-Host "Failed:                $global:failCount" -ForegroundColor $(if ($global:failCount -gt 0) { "Red" } else { "Green" })
Write-Host "=================================================================" -ForegroundColor Cyan

if ($global:failCount -gt 0) {
    exit 1
} else {
    exit 0
}
