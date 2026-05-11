param(
  [string]$WorkbookPath = "C:\Users\infouser\Documents\New project\marketing dashboard\marketing dashboard\data\terminal-termination-source.xlsx",
  [string]$SheetName = "26.04.23",
  [string]$StatePath = "C:\Users\infouser\Documents\New project\marketing dashboard\marketing dashboard\data\app-state.json"
)

$ErrorActionPreference = "Stop"

function Get-CellText($ws, [int]$row, [int]$col) {
  $value = $ws.Cells.Item($row, $col).Text
  if ($null -eq $value) { return "" }
  return ([string]$value).Trim()
}

function Get-CellValue($ws, [int]$row, [int]$col) {
  return $ws.Cells.Item($row, $col).Value2
}

function Normalize-Whitespace([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return "" }
  return ($text -replace "\s+", " ").Trim()
}

function Parse-IntFromText([string]$text) {
  $source = if ($null -eq $text) { "" } else { [string]$text }
  $digits = ($source -replace "[^\d\-]", "")
  if ([string]::IsNullOrWhiteSpace($digits)) { return 0 }
  return [int]$digits
}

function Format-DateValue($value, [string]$text) {
  if ($null -ne $value) {
    try {
      if ($value -is [double] -or $value -is [int]) {
        return ([datetime]::FromOADate([double]$value)).ToString("yyyy.MM.dd")
      }
      if ($value -is [datetime]) {
        return ([datetime]$value).ToString("yyyy.MM.dd")
      }
    } catch {}
  }
  $raw = if ($null -eq $text) { "" } else { ([string]$text).Trim() }
  if ([string]::IsNullOrWhiteSpace($raw)) { return "" }
  $digits = $raw -replace "[^\d]", ""
  if ($digits.Length -eq 8) { return "{0}.{1}.{2}" -f $digits.Substring(0,4), $digits.Substring(4,2), $digits.Substring(6,2) }
  if ($digits.Length -eq 6) { return "20{0}.{1}.{2}" -f $digits.Substring(0,2), $digits.Substring(2,2), $digits.Substring(4,2) }
  return $raw.Replace("-", ".").Replace("/", ".")
}

function Test-TerminationSelected($ws, [int]$row) {
  $flagText = Normalize-Whitespace (Get-CellText $ws $row 2)
  if ([string]::IsNullOrWhiteSpace($flagText)) { return $true }
  try {
    $fontColor = [int]$ws.Range(("B{0}:J{0}" -f $row)).Font.Color
    if ($fontColor -eq 255) { return $true }
  } catch {}
  return $false
}

if (-not (Test-Path $WorkbookPath)) {
  throw "Workbook not found: $WorkbookPath"
}
if (-not (Test-Path $StatePath)) {
  throw "State file not found: $StatePath"
}

$excel = $null
$wb = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open($WorkbookPath, 0, $true)

  $allConfirmed = @()
  foreach ($ws in @($wb.Worksheets)) {
    $name = [string]$ws.Name
    if (-not ($name -match "^\d{2}\.\d{2}\.\d{2}$")) { continue }
    $reflectedDate = Format-DateValue $null $name
    $idx = 0
    for ($row = 8; $row -le 31; $row++) {
      $customerId = Normalize-Whitespace (Get-CellText $ws $row 5)
      $companyName = Normalize-Whitespace (Get-CellText $ws $row 8)
      if ([string]::IsNullOrWhiteSpace($customerId) -and [string]::IsNullOrWhiteSpace($companyName)) { continue }
      $idx++
      if (-not (Test-TerminationSelected $ws $row)) { continue }
      $allConfirmed += [ordered]@{
        id = ("{0}-t{1}" -f ($name -replace "\.", ""), $idx)
        no = $idx
        selected = $true
        receivedDate = Format-DateValue (Get-CellValue $ws $row 3) (Get-CellText $ws $row 3)
        manager = Normalize-Whitespace (Get-CellText $ws $row 4)
        customerId = $customerId
        reason = Normalize-Whitespace (Get-CellText $ws $row 6)
        terminationDate = Format-DateValue (Get-CellValue $ws $row 7) (Get-CellText $ws $row 7)
        companyName = $companyName
        departmentName = Normalize-Whitespace (Get-CellText $ws $row 9)
        penalty = Parse-IntFromText (Get-CellText $ws $row 10)
        reflectedDate = $reflectedDate
      }
    }
  }

  $targetWs = $wb.Worksheets.Item($SheetName)
  if ($null -eq $targetWs) {
    throw "Sheet '$SheetName' not found."
  }

  $openItems = @()
  $itemIndex = 0
  for ($row = 8; $row -le 31; $row++) {
    $customerId = Normalize-Whitespace (Get-CellText $targetWs $row 5)
    $companyName = Normalize-Whitespace (Get-CellText $targetWs $row 8)
    if ([string]::IsNullOrWhiteSpace($customerId) -and [string]::IsNullOrWhiteSpace($companyName)) { continue }
    $itemIndex++
    if (Test-TerminationSelected $targetWs $row) { continue }
    $openItems += [ordered]@{
      id = ("{0}-t{1}" -f ($SheetName -replace "\.", ""), $itemIndex)
      no = $itemIndex
      selected = $false
      receivedDate = Format-DateValue (Get-CellValue $targetWs $row 3) (Get-CellText $targetWs $row 3)
      manager = Normalize-Whitespace (Get-CellText $targetWs $row 4)
      customerId = $customerId
      reason = Normalize-Whitespace (Get-CellText $targetWs $row 6)
      terminationDate = Format-DateValue (Get-CellValue $targetWs $row 7) (Get-CellText $targetWs $row 7)
      companyName = $companyName
      departmentName = Normalize-Whitespace (Get-CellText $targetWs $row 9)
      penalty = Parse-IntFromText (Get-CellText $targetWs $row 10)
    }
  }

  $holdItems = @()
  $holdIndex = 0
  for ($row = 35; $row -le 120; $row++) {
    $rowNo = Normalize-Whitespace (Get-CellText $targetWs $row 2)
    if ($rowNo -notmatch '^\d+$') { continue }
    $customerId = Normalize-Whitespace (Get-CellText $targetWs $row 5)
    $companyName = Normalize-Whitespace (Get-CellText $targetWs $row 9)
    if ([string]::IsNullOrWhiteSpace($customerId) -and [string]::IsNullOrWhiteSpace($companyName)) { continue }
    $holdIndex++
    $holdItems += [ordered]@{
      id = ("{0}-h{1}" -f ($SheetName -replace "\.", ""), $holdIndex)
      no = $holdIndex
      receivedDate = Format-DateValue (Get-CellValue $targetWs $row 3) (Get-CellText $targetWs $row 3)
      manager = Normalize-Whitespace (Get-CellText $targetWs $row 4)
      customerId = $customerId
      reason = Normalize-Whitespace (Get-CellText $targetWs $row 6)
      startDate = Format-DateValue (Get-CellValue $targetWs $row 7) (Get-CellText $targetWs $row 7)
      endDate = Format-DateValue (Get-CellValue $targetWs $row 8) (Get-CellText $targetWs $row 8)
      companyName = $companyName
      departmentName = Normalize-Whitespace (Get-CellText $targetWs $row 10)
    }
  }

  $dedupConfirmed = @()
  $seen = @{}
  foreach ($item in $allConfirmed) {
    $key = "{0}|{1}|{2}|{3}" -f $item.customerId, $item.companyName, $item.receivedDate, $item.terminationDate
    if ($seen.ContainsKey($key)) { continue }
    $seen[$key] = $true
    $dedupConfirmed += $item
  }

  $reasonSummary = @{}
  foreach ($item in $openItems) {
    $reasonKey = if ([string]::IsNullOrWhiteSpace($item.reason)) { "Unknown" } else { $item.reason }
    if (-not $reasonSummary.ContainsKey($reasonKey)) { $reasonSummary[$reasonKey] = 0 }
    $reasonSummary[$reasonKey]++
  }

  $state = Get-Content -Raw -Encoding UTF8 $StatePath | ConvertFrom-Json
  if ($null -eq $state.termination) {
    $state | Add-Member -NotePropertyName termination -NotePropertyValue @{} -Force
  }

  $sheetId = "sheet-" + ($SheetName -replace "\.", "")
  $state.termination.currentSheetId = $sheetId
  $state.termination.sheets = @(
    [ordered]@{
      id = $sheetId
      name = $SheetName
      title = "단말기 해지 진행사항"
      weeklyTerminationCount = @($openItems).Count
      weeklyBillingHoldCount = @($holdItems).Count
      teamLabel = "인포Biz본부 인포Biz1팀"
      guidelines = @("1. 해지 발생 시 선보고 진행", "2. CRM 및 해지 리스트 등록")
      items = @($openItems)
      holdItems = @($holdItems)
      confirmedItems = @($dedupConfirmed)
      releasedHoldItems = @()
      reasonSummary = $reasonSummary
    }
  )

  $json = $state | ConvertTo-Json -Depth 40
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($StatePath, $json, $utf8NoBom)

  Write-Output ("Synced termination sheet {0} | open={1}, hold={2}, confirmed={3}" -f $SheetName, $openItems.Count, $holdItems.Count, $dedupConfirmed.Count)
}
finally {
  if ($wb) { $wb.Close($false) | Out-Null }
  if ($excel) {
    $excel.DisplayAlerts = $true
    $excel.Quit()
  }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
