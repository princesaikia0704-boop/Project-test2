# Empirical Stress Test: Concurrent Idempotency Mutex Race Condition
$ErrorActionPreference = "Stop"

Write-Host "--- STRESS TEST: Concurrent Idempotency Mutex Interleaving ---" -ForegroundColor Cyan

class MockRedisStore {
    [System.Collections.Concurrent.ConcurrentDictionary[string, string]]$store = 
        [System.Collections.Concurrent.ConcurrentDictionary[string, string]]::new()

    [string] Get([string]$key) {
        $val = ""
        if ($this.store.TryGetValue($key, [ref]$val)) {
            return $val
        }
        return $null
    }

    [bool] SetNX([string]$key, [string]$value) {
        return $this.store.TryAdd($key, $value)
    }
}

$global:store = [MockRedisStore]::new()
$userId = "user-alice"
$idempKey = "test-concurrent-key-1"
$cacheKey = "idemp:$userId`:$idempKey"

# Trace of acquireIdempotencyLock as written in src/lib/cache/redis.ts lines 127-148:
# Step 1: Request A calls redis.get
$reqA_existing = $global:store.Get($cacheKey)
Write-Host "Request A: initial get -> $(if ($null -eq $reqA_existing) {'null'} else {$reqA_existing})"

# Step 2: Request B calls redis.get before Request A sets lock
$reqB_existing = $global:store.Get($cacheKey)
Write-Host "Request B: initial get -> $(if ($null -eq $reqB_existing) {'null'} else {$reqB_existing})"

# Step 3: Request A executes set NX
$reqA_set = $global:store.SetNX($cacheKey, '{"status":200,"state":"IN_PROGRESS"}')
$reqA_acquired = $reqA_set
$reqA_lock = @{ acquired = $reqA_acquired; existing = $reqA_existing }
Write-Host "Request A: set NX result -> $reqA_set, acquired -> $($reqA_lock.acquired)"

# Step 4: Request B executes set NX (fails because Request A already set it)
$reqB_set = $global:store.SetNX($cacheKey, '{"status":200,"state":"IN_PROGRESS"}')
$reqB_acquired = $reqB_set
# In src/lib/cache/redis.ts line 147:
# return { acquired: lockResult === "OK", existing: existing ?? undefined };
# Notice: 'existing' was null at Step 2!
$reqB_lock = @{ acquired = $reqB_acquired; existing = $reqB_existing }
Write-Host "Request B: set NX result -> $reqB_set, acquired -> $($reqB_lock.acquired), existing -> $(if ($null -eq $reqB_lock.existing) {'null/undefined'} else {$reqB_lock.existing})"

Write-Host "`nNow evaluating src/lib/http/api-handler.ts line 117 on Request B:"
Write-Host "Code: if (!lock.acquired && lock.existing)"
$b_condition = (-not $reqB_lock.acquired) -and ($null -ne $reqB_lock.existing)
Write-Host "Result of condition on Request B: $b_condition"

if (-not $b_condition) {
    Write-Host "`n[VULNERABILITY CONFIRMED] CRITICAL CONCURRENCY FLAW:" -ForegroundColor Red
    Write-Host "Request B's lock acquisition failed (acquired = false), but lock.existing was null." -ForegroundColor Yellow
    Write-Host "Because api-handler.ts checked 'if (!lock.acquired && lock.existing)', the check evaluated to FALSE." -ForegroundColor Yellow
    Write-Host "As a result, Request B skipped the 409 conflict return AND executed handler(req, context) in parallel with Request A!" -ForegroundColor Red
} else {
    Write-Host "[SAFE] Request B returned 409." -ForegroundColor Green
}
