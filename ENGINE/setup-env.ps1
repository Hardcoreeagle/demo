<#
.SYNOPSIS
  Portable environment bootstrap for the Pharma Trace ENGINE workflow.

.DESCRIPTION
  Discovers ENGINE_ROOT dynamically (the directory containing both
  "GS1 ENGINE" and "BLOCKCHAIN ENGINE"), then exports helper variables and,
  when running behind a TLS-inspecting proxy (e.g. Zscaler), makes Node.js
  trust the corporate root CA by generating a PEM next to the Blockchain
  Engine and pointing NODE_EXTRA_CA_CERTS at it.

  NO absolute or user-specific directory is hardcoded anywhere. All paths are
  built at runtime with Join-Path from the discovered ENGINE_ROOT, so this
  works for any Windows username and any install location.

.USAGE
  Dot-source so the variables persist in your shell:
      . .\setup-env.ps1

  After it runs, these are available in the session:
      $ENGINE_ROOT, $GS1_ENGINE, $BLOCKCHAIN_ENGINE
      $env:NODE_EXTRA_CA_CERTS (only if a corporate CA was needed/found)
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Find-EngineRoot {
    # Search upward from this script's directory, then from the current
    # working directory, for a folder that contains BOTH engine folders.
    $starts = @()
    if ($PSScriptRoot) { $starts += $PSScriptRoot }
    $starts += (Get-Location).Path

    foreach ($start in $starts) {
        $dir = Resolve-Path -LiteralPath $start | Select-Object -ExpandProperty Path
        while ($true) {
            $gs1 = Join-Path $dir 'GS1 ENGINE'
            $bc  = Join-Path $dir 'BLOCKCHAIN ENGINE'
            if ((Test-Path -LiteralPath $gs1) -and (Test-Path -LiteralPath $bc)) {
                return $dir
            }
            $parent = Split-Path -LiteralPath $dir -Parent
            if ([string]::IsNullOrEmpty($parent) -or $parent -eq $dir) { break }
            $dir = $parent
        }
    }
    throw "Could not locate ENGINE_ROOT (a folder containing both 'GS1 ENGINE' and 'BLOCKCHAIN ENGINE') from '$($starts -join "', '")'."
}

function Export-CorporateRootCA {
    param([Parameter(Mandatory)][string] $DestinationPem)

    # Collect self-signed root CAs from the machine/user trust stores. This
    # captures Zscaler and any other corporate root that Windows trusts but
    # Node's bundled CA list does not. Never assumes a specific vendor.
    $roots = @()
    foreach ($store in 'Cert:\LocalMachine\Root', 'Cert:\CurrentUser\Root') {
        if (Test-Path $store) {
            $roots += Get-ChildItem $store | Where-Object { $_.Subject -eq $_.Issuer }
        }
    }
    $roots = $roots | Sort-Object Thumbprint -Unique
    if ($roots.Count -eq 0) { return $false }

    $sb = New-Object System.Text.StringBuilder
    foreach ($c in $roots) {
        [void]$sb.AppendLine("# Subject: $($c.Subject)")
        $b64 = [System.Convert]::ToBase64String($c.RawData, 'InsertLineBreaks')
        [void]$sb.AppendLine('-----BEGIN CERTIFICATE-----')
        [void]$sb.AppendLine($b64)
        [void]$sb.AppendLine('-----END CERTIFICATE-----')
    }
    Set-Content -LiteralPath $DestinationPem -Value $sb.ToString() -Encoding ascii
    return $true
}

$script:ENGINE_ROOT = Find-EngineRoot
$global:ENGINE_ROOT       = $script:ENGINE_ROOT
$global:GS1_ENGINE        = Join-Path $global:ENGINE_ROOT 'GS1 ENGINE'
$global:BLOCKCHAIN_ENGINE = Join-Path $global:ENGINE_ROOT 'BLOCKCHAIN ENGINE'

Write-Host "ENGINE_ROOT        = $global:ENGINE_ROOT"
Write-Host "GS1_ENGINE         = $global:GS1_ENGINE"
Write-Host "BLOCKCHAIN_ENGINE  = $global:BLOCKCHAIN_ENGINE"

# Build the CA PEM path dynamically next to the Blockchain Engine.
$caPem = Join-Path $global:BLOCKCHAIN_ENGINE 'corporate-ca.pem'

# Probe whether Node already trusts the VeChain Testnet endpoint. Only if it
# fails do we need to install the corporate root CA for Node.
$rpc = if ($env:VECHAIN_TESTNET_RPC_URL) { $env:VECHAIN_TESTNET_RPC_URL } else { 'https://testnet.vechain.org' }
$probe = "fetch('$rpc/blocks/best').then(r=>r.json()).then(()=>process.exit(0)).catch(()=>process.exit(3))"
$needsCa = $false
try {
    & node -e $probe 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { $needsCa = $true }
} catch { $needsCa = $true }

if ($needsCa) {
    Write-Host "Node cannot verify $rpc (likely a TLS-inspecting proxy). Exporting corporate root CA..."
    if (Export-CorporateRootCA -DestinationPem $caPem) {
        $env:NODE_EXTRA_CA_CERTS = $caPem
        Write-Host "NODE_EXTRA_CA_CERTS = $env:NODE_EXTRA_CA_CERTS"
        try {
            & node -e $probe 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host 'Node now trusts the Testnet endpoint. OK.'
            } else {
                Write-Warning 'Node still cannot verify the endpoint after adding the CA bundle. Check your proxy/root CA.'
            }
        } catch { Write-Warning 'Verification probe failed after adding the CA bundle.' }
    } else {
        Write-Warning 'No self-signed root CAs found in the Windows trust store; cannot build a CA bundle.'
    }
} else {
    Write-Host 'Node already trusts the Testnet endpoint; NODE_EXTRA_CA_CERTS not required.'
}

# Avoid interactive Hardhat telemetry prompts in non-interactive runs.
if (-not $env:HARDHAT_TELEMETRY_CONSENT) { $env:HARDHAT_TELEMETRY_CONSENT = 'false' }
