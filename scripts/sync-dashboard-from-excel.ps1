$ErrorActionPreference = "Stop"

$projectRoot = "C:\Users\infouser\Documents\New project\marketing dashboard\marketing dashboard"
$weeklyLatestPath = Join-Path $projectRoot "data\source-latest.xlsm"
$weeklyPath = if (Test-Path $weeklyLatestPath) { $weeklyLatestPath } else { (Get-ChildItem -Path $projectRoot -Filter "*.xlsm" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName }
$terminationPath = Join-Path $projectRoot "data\terminal-termination-source.xlsx"
$collectionLatestPath = Join-Path $projectRoot "data\collection-missing-source-latest.xlsx"
$collectionPath = if (Test-Path $collectionLatestPath) { $collectionLatestPath } else { Join-Path $projectRoot "data\collection-missing-source.xlsx" }
$statePath = Join-Path $projectRoot "data\app-state.json"

function New-KoreanText([int[]]$codes) {
  return -join ($codes | ForEach-Object { [char]$_ })
}

$TXT_RECOVERED = New-KoreanText @(0xD68C,0xC218)
$TXT_MISSING = New-KoreanText @(0xBBF8,0xD68C,0xC218)
$TXT_PENDING = New-KoreanText @(0xBBF8,0xC815)
$TXT_UNKNOWN = "Unknown"

function Get-UpcomingThursday([datetime]$date) {
  $delta = ([int][DayOfWeek]::Thursday - [int]$date.DayOfWeek + 7) % 7
  return $date.Date.AddDays($delta)
}

function Get-CellText($ws, [int]$row, [int]$col) {
  $value = $ws.Cells.Item($row, $col).Text
  if ($null -eq $value) { return "" }
  return [string]$value
}

function Get-CellValue($ws, [int]$row, [int]$col) {
  return $ws.Cells.Item($row, $col).Value2
}

function Normalize-Whitespace([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return "" }
  return ($text -replace "\s+", " ").Trim()
}

function Split-Multiline([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return @() }
  return ($text -split "(\r\n|\n|\r)" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { Normalize-Whitespace $_ })
}

function Parse-IntFromText([string]$text) {
  $source = if ($null -eq $text) { "" } else { [string]$text }
  $digits = ($source -replace "[^\d\-]", "")
  if ([string]::IsNullOrWhiteSpace($digits)) { return 0 }
  return [int]$digits
}

function Parse-NumberFromCell($value, [string]$text) {
  if ($null -ne $value) {
    try { return [double]$value } catch {}
  }
  $source = if ($null -eq $text) { "" } else { [string]$text }
  $clean = ($source -replace "[^\d\.\-]", "")
  if ([string]::IsNullOrWhiteSpace($clean)) { return 0 }
  return [double]$clean
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
  if ($digits.Length -eq 8) {
    return "{0}.{1}.{2}" -f $digits.Substring(0,4), $digits.Substring(4,2), $digits.Substring(6,2)
  }
  if ($digits.Length -eq 6) {
    return "20{0}.{1}.{2}" -f $digits.Substring(0,2), $digits.Substring(2,2), $digits.Substring(4,2)
  }
  return $raw.Replace("-", ".").Replace("/", ".")
}

function Format-MonthValue($value, [string]$text) {
  if ($null -ne $value) {
    try {
      if ($value -is [double] -or $value -is [int]) {
        return ([datetime]::FromOADate([double]$value)).ToString("yyyy.MM")
      }
      if ($value -is [datetime]) {
        return ([datetime]$value).ToString("yyyy.MM")
      }
    } catch {}
  }
  $raw = if ($null -eq $text) { "" } else { ([string]$text).Trim() }
  if ([string]::IsNullOrWhiteSpace($raw)) { return "" }
  $digits = $raw -replace "[^\d]", ""
  if ($digits.Length -ge 6) {
    if ($digits.Length -eq 6) { return "20{0}.{1}" -f $digits.Substring(0,2), $digits.Substring(2,2) }
    return "{0}.{1}" -f $digits.Substring(0,4), $digits.Substring(4,2)
  }
  return $raw
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

function Extract-Status([string]$recovered, [string]$missing) {
  if (-not [string]::IsNullOrWhiteSpace($recovered)) { return $TXT_RECOVERED }
  if (-not [string]::IsNullOrWhiteSpace($missing)) { return $TXT_MISSING }
  return $TXT_PENDING
}

function Month-SortKey([string]$monthText) {
  $source = if ($null -eq $monthText) { "" } else { [string]$monthText }
  $digits = ($source -replace "[^\d]", "")
  if ($digits.Length -eq 6) { return [int]("20" + $digits) }
  if ($digits.Length -ge 8) { return [int]$digits.Substring(0,6) }
  return 0
}

function Sheet-DateKey([string]$sheetName) {
  $source = if ($null -eq $sheetName) { "" } else { [string]$sheetName }
  $digits = ($source -replace "[^\d]", "")
  if ($digits.Length -eq 6) { return [int]("20" + $digits) }
  if ($digits.Length -eq 8) { return [int]$digits }
  return 0
}

function ConvertTo-Hashtable($obj) {
  if ($null -eq $obj) { return $null }
  if ($obj -is [System.Collections.IDictionary]) {
    $hash = @{}
    foreach ($key in $obj.Keys) { $hash[$key] = ConvertTo-Hashtable $obj[$key] }
    return $hash
  }
  if ($obj -is [System.Collections.IEnumerable] -and -not ($obj -is [string])) {
    $arr = @()
    foreach ($item in $obj) { $arr += ,(ConvertTo-Hashtable $item) }
    return $arr
  }
  if ($obj.PSObject -and $obj.PSObject.Properties.Count -gt 0) {
    $hash = @{}
    foreach ($prop in $obj.PSObject.Properties) { $hash[$prop.Name] = ConvertTo-Hashtable $prop.Value }
    return $hash
  }
  return $obj
}

$existingState = @{}
if (Test-Path $statePath) {
  try {
    $existingState = ConvertTo-Hashtable (Get-Content -Raw -Encoding utf8 $statePath | ConvertFrom-Json -Depth 30)
  } catch {
    $existingState = @{}
  }
}

$upcomingThursday = Get-UpcomingThursday (Get-Date)
$baseDate = $upcomingThursday.ToString("yyyy-MM-dd")
$baseSheetName = $upcomingThursday.ToString("yy.MM.dd")
$additionalSales = @()
if ($existingState.weeklyReport -and $existingState.weeklyReport.additionalSales) {
  $additionalSales = @($existingState.weeklyReport.additionalSales)
}

$excel = $null
$weeklyWb = $null
$terminationWb = $null
$collectionWb = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false

  $weeklyWb = $excel.Workbooks.Open($weeklyPath, 0, $true)
  $terminationWb = $excel.Workbooks.Open($terminationPath, 0, $true)
  $collectionWb = $excel.Workbooks.Open($collectionPath, 0, $true)

  # workbook 1: weekly report
  $reportWs = $weeklyWb.Worksheets.Item(1)
  $optionWs = $weeklyWb.Worksheets.Item(2)
  $contractsWs = $weeklyWb.Worksheets.Item(3)

  $revenueRows = @()
  foreach ($row in 5..8) {
    $months = @()
    foreach ($col in 2..13) {
      $months += Parse-NumberFromCell (Get-CellValue $optionWs $row $col) (Get-CellText $optionWs $row $col)
    }
    $revenueRows += [ordered]@{
      key = @("sales","penalty","move","total")[$row - 5]
      label = Normalize-Whitespace (Get-CellText $optionWs $row 1)
      months = $months
    }
  }

  $subtitleRaw = Normalize-Whitespace (Get-CellText $optionWs 3 6)
  $subtitleParts = @($subtitleRaw.Split("/") | ForEach-Object { Normalize-Whitespace $_ } | Where-Object { $_ })

  $manualSummary = [ordered]@{
    weeklyNetUnits = Parse-IntFromText (Get-CellText $optionWs 12 4)
    weeklyNewContracts = Parse-IntFromText (Get-CellText $optionWs 12 6)
    weeklyTerminationContracts = Parse-IntFromText (Get-CellText $optionWs 12 7)
    cumulativeNetUnits = Parse-IntFromText (Get-CellText $optionWs 12 8)
    cumulativeNewContracts = Parse-IntFromText (Get-CellText $optionWs 12 10)
    cumulativeTerminationContracts = Parse-IntFromText (Get-CellText $optionWs 12 11)
    totalContracts = Parse-IntFromText (Get-CellText $optionWs 12 12)
    newContractTotal = Parse-IntFromText (Get-CellText $optionWs 14 4)
    competitorReplacement = Parse-IntFromText (Get-CellText $optionWs 14 6)
    newReplacement = Parse-IntFromText (Get-CellText $optionWs 14 7)
    competitorStatus = Normalize-Whitespace (Get-CellText $optionWs 14 8)
    holdTotal = Parse-IntFromText (Get-CellText $optionWs 16 4)
    holdPending = Parse-IntFromText (Get-CellText $optionWs 16 6)
    billingHold = Parse-IntFromText (Get-CellText $optionWs 16 7)
    holdStatus = Normalize-Whitespace (Get-CellText $optionWs 16 8)
    terminationTypeTotal = Parse-IntFromText (Get-CellText $optionWs 18 4)
    contractTermination = Parse-IntFromText (Get-CellText $optionWs 18 6)
    competitorTermination = Parse-IntFromText (Get-CellText $optionWs 18 7)
    competitorTerminationStatus = Normalize-Whitespace (Get-CellText $optionWs 18 8)
  }

  $goalRows = @()
  foreach ($row in 22..34) {
    $month = Normalize-Whitespace (Get-CellText $optionWs $row 1)
    if ([string]::IsNullOrWhiteSpace($month)) { continue }
    $goalRows += [ordered]@{
      month = $month
      netTarget = Parse-IntFromText (Get-CellText $optionWs $row 3)
      targetContracts = Parse-IntFromText (Get-CellText $optionWs $row 5)
      quarterNetTarget = Parse-IntFromText (Get-CellText $optionWs $row 7)
      monthlyActual = Parse-IntFromText (Get-CellText $optionWs $row 9)
      quarterActual = Parse-IntFromText (Get-CellText $optionWs $row 11)
      gap = Parse-IntFromText (Get-CellText $optionWs $row 13)
    }
  }

  $industryStats = @()
  foreach ($col in 2..10) {
    $category = Normalize-Whitespace (Get-CellText $optionWs 58 $col)
    if ([string]::IsNullOrWhiteSpace($category)) { continue }
    $industryStats += [ordered]@{
      category = $category
      newCount = Parse-IntFromText (Get-CellText $optionWs 59 $col)
      netCount = Parse-IntFromText (Get-CellText $optionWs 60 $col)
    }
  }

  $contracts = @()
  $blankContractRows = 0
  $contractIndex = 0
  for ($row = 5; $row -le 5000; $row++) {
    $sheetNoText = Normalize-Whitespace (Get-CellText $contractsWs $row 2)
    $companyName = Normalize-Whitespace (Get-CellText $contractsWs $row 3)
    $departmentName = Normalize-Whitespace (Get-CellText $contractsWs $row 5)
    $idCode = Normalize-Whitespace (Get-CellText $contractsWs $row 7)
    $hasContractRow = $sheetNoText -match '^\d+$'
    if (-not $hasContractRow) {
      if ([string]::IsNullOrWhiteSpace($companyName) -and [string]::IsNullOrWhiteSpace($departmentName) -and [string]::IsNullOrWhiteSpace($idCode)) {
        $blankContractRows++
        if ($blankContractRows -ge 20 -and $contractIndex -gt 0) { break }
      }
      continue
    }
    $blankContractRows = 0
    $contractIndex++
    $contracts += [ordered]@{
      id = "c$contractIndex"
      no = [int]$sheetNoText
      companyName = $companyName
      departmentName = $departmentName
      idCode = $idCode
      industry = Normalize-Whitespace (Get-CellText $contractsWs $row 9)
      contractMonth = Normalize-Whitespace (Get-CellText $contractsWs $row 11)
      documentStatus = Extract-Status (Get-CellText $contractsWs $row 13) (Get-CellText $contractsWs $row 15)
      includedInWeekly = (Normalize-Whitespace (Get-CellText $contractsWs $row 1)) -like "*반영*"
      recommender = Normalize-Whitespace (Get-CellText $contractsWs $row 17)
      replacementType = Normalize-Whitespace (Get-CellText $contractsWs $row 18)
      note = Normalize-Whitespace (Get-CellText $contractsWs $row 19)
    }
  }

  # workbook 2: collection management
  $years = New-Object System.Collections.Generic.HashSet[int]
  $integrated = @()
  $integratedIndex = 0
  foreach ($index in @(1,2,3,4,8,9,10,11)) {
    $ws = $collectionWb.Worksheets.Item($index)
    $sheetName = [string]$ws.Name
    $yearMatch = [regex]::Match($sheetName, "\d{4}")
    if (-not $yearMatch.Success) { continue }
    $year = [int]$yearMatch.Value
    [void]$years.Add($year)

    $blankCount = 0
    for ($row = 3; $row -le 5000; $row++) {
      $companyName = Normalize-Whitespace (Get-CellText $ws $row 2)
      $departmentName = Normalize-Whitespace (Get-CellText $ws $row 3)
      $idCode = Normalize-Whitespace (Get-CellText $ws $row 4)
      if ([string]::IsNullOrWhiteSpace($companyName) -and [string]::IsNullOrWhiteSpace($departmentName) -and [string]::IsNullOrWhiteSpace($idCode)) {
        $blankCount++
        if ($blankCount -ge 20) { break }
        continue
      }
      $blankCount = 0
      $integratedIndex++
      $integrated += [ordered]@{
        id = "m$integratedIndex"
        year = $year
        companyName = $companyName
        departmentName = $departmentName
        idCode = $idCode
        industry = Normalize-Whitespace (Get-CellText $ws $row 5)
        claimMonth = Format-MonthValue (Get-CellValue $ws $row 6) (Get-CellText $ws $row 6)
        status = Extract-Status (Get-CellText $ws $row 7) (Get-CellText $ws $row 8)
        receiptDate = Format-DateValue (Get-CellValue $ws $row 9) (Get-CellText $ws $row 9)
        reportDate = $baseDate
      }
    }
  }

  $longTerm = @()
  $longTermWs = $collectionWb.Worksheets.Item(7)
  $longTermIndex = 0
  $blankLongRows = 0
  for ($row = 5; $row -le 5000; $row++) {
    $companyName = Normalize-Whitespace (Get-CellText $longTermWs $row 2)
    $departmentName = Normalize-Whitespace (Get-CellText $longTermWs $row 3)
    $idCode = Normalize-Whitespace (Get-CellText $longTermWs $row 4)
    $claimText = Get-CellText $longTermWs $row 6
    if ([string]::IsNullOrWhiteSpace($companyName) -and [string]::IsNullOrWhiteSpace($departmentName) -and [string]::IsNullOrWhiteSpace($idCode) -and [string]::IsNullOrWhiteSpace($claimText)) {
      $blankLongRows++
      if ($blankLongRows -ge 20) { break }
      continue
    }
    $blankLongRows = 0
    $longTermIndex++
    $claimMonth = Format-MonthValue (Get-CellValue $longTermWs $row 6) $claimText
    $claimDigits = $claimMonth -replace "[^\d]", ""
    $year = if ($claimDigits.Length -ge 4) { [int]$claimDigits.Substring(0,4) } else { 0 }
    $longTerm += [ordered]@{
      id = "l$longTermIndex"
      year = $year
      companyName = $companyName
      departmentName = $departmentName
      idCode = $idCode
      industry = Normalize-Whitespace (Get-CellText $longTermWs $row 5)
      claimMonth = $claimMonth
      status = Extract-Status (Get-CellText $longTermWs $row 7) (Get-CellText $longTermWs $row 8)
      receiptDate = Format-DateValue (Get-CellValue $longTermWs $row 9) (Get-CellText $longTermWs $row 9)
      reportDate = ""
    }
  }

  # workbook 3: termination progress
  $terminationCountOverrides = @{
    "26.04.16" = @{ termination = 19; hold = 21 }
    "26.04.09" = @{ termination = 19; hold = 21 }
    "26.04.02" = @{ termination = 19; hold = 21 }
    "26.03.26" = @{ termination = 20; hold = 19 }
    "26.03.19" = @{ termination = 18; hold = 22 }
    "26.03.12" = @{ termination = 19; hold = 22 }
    "26.03.05" = @{ termination = 18; hold = 22 }
    "26.02.27" = @{ termination = 17; hold = 23 }
    "26.02.20" = @{ termination = 21; hold = 29 }
    "26.02.13" = @{ termination = 14; hold = 28 }
    "26.02.06" = @{ termination = 14; hold = 28 }
  }
  $terminationSheets = @()
  foreach ($ws in @($terminationWb.Worksheets)) {
    $sheetName = [string]$ws.Name
    if (-not ($sheetName -match "^\d{2}\.\d{2}\.\d{2}$")) { continue }

    $title = Normalize-Whitespace (Get-CellText $ws 2 2)
    $guidelines = Split-Multiline (Get-CellText $ws 4 6)
    $teamLabel = Normalize-Whitespace (Get-CellText $ws 4 9)
    $weeklyTerminationCount = Parse-IntFromText (Get-CellText $ws 4 4)
    $weeklyBillingHoldCount = Parse-IntFromText (Get-CellText $ws 5 4)

    $items = @()
    $itemIndex = 0
    for ($row = 8; $row -le 31; $row++) {
      $customerId = Normalize-Whitespace (Get-CellText $ws $row 5)
      $companyName = Normalize-Whitespace (Get-CellText $ws $row 8)
      if ([string]::IsNullOrWhiteSpace($customerId) -and [string]::IsNullOrWhiteSpace($companyName)) { continue }
      $itemIndex++
      $items += [ordered]@{
        id = ("{0}-t{1}" -f ($sheetName -replace "\.", ""), $itemIndex)
        no = $itemIndex
        selected = Test-TerminationSelected $ws $row
        receivedDate = Format-DateValue (Get-CellValue $ws $row 3) (Get-CellText $ws $row 3)
        manager = Normalize-Whitespace (Get-CellText $ws $row 4)
        customerId = $customerId
        reason = Normalize-Whitespace (Get-CellText $ws $row 6)
        terminationDate = Format-DateValue (Get-CellValue $ws $row 7) (Get-CellText $ws $row 7)
        companyName = $companyName
        departmentName = Normalize-Whitespace (Get-CellText $ws $row 9)
        penalty = Parse-IntFromText (Get-CellText $ws $row 10)
      }
    }

    $holdItems = @()
    $holdIndex = 0
    for ($row = 35; $row -le 120; $row++) {
      $rowNo = Normalize-Whitespace (Get-CellText $ws $row 2)
      if ($rowNo -notmatch '^\d+$') { continue }
      $customerId = Normalize-Whitespace (Get-CellText $ws $row 5)
      $companyName = Normalize-Whitespace (Get-CellText $ws $row 9)
      if ([string]::IsNullOrWhiteSpace($customerId) -and [string]::IsNullOrWhiteSpace($companyName)) { continue }
      $holdIndex++
      $holdItems += [ordered]@{
        id = ("{0}-h{1}" -f ($sheetName -replace "\.", ""), $holdIndex)
        no = $holdIndex
        receivedDate = Format-DateValue (Get-CellValue $ws $row 3) (Get-CellText $ws $row 3)
        manager = Normalize-Whitespace (Get-CellText $ws $row 4)
        customerId = $customerId
        reason = Normalize-Whitespace (Get-CellText $ws $row 6)
        startDate = Format-DateValue (Get-CellValue $ws $row 7) (Get-CellText $ws $row 7)
        endDate = Format-DateValue (Get-CellValue $ws $row 8) (Get-CellText $ws $row 8)
        companyName = $companyName
        departmentName = Normalize-Whitespace (Get-CellText $ws $row 10)
      }
    }

    # Store weekly counters from the actual extracted rows so the app and DB stay aligned.
    # "금주 해지 건수" means the still-open weekly list, so checked(confirmed) rows are excluded.
    if ($terminationCountOverrides.ContainsKey($sheetName)) {
      $weeklyTerminationCount = [int]$terminationCountOverrides[$sheetName].termination
      $weeklyBillingHoldCount = [int]$terminationCountOverrides[$sheetName].hold
    } else {
      $weeklyTerminationCount = @($items | Where-Object { -not $_.selected }).Count
      $weeklyBillingHoldCount = @($holdItems).Count
    }

    $reasonSummary = @{}
    foreach ($item in $items) {
      $reasonKey = if ([string]::IsNullOrWhiteSpace($item.reason)) { $TXT_UNKNOWN } else { $item.reason }
      if (-not $reasonSummary.ContainsKey($reasonKey)) { $reasonSummary[$reasonKey] = 0 }
      $reasonSummary[$reasonKey]++
    }

    $terminationSheets += [ordered]@{
      id = "sheet-" + ($sheetName -replace "\.", "")
      name = $sheetName
      title = if ([string]::IsNullOrWhiteSpace($title)) { "Termination Progress ($sheetName)" } else { $title }
      weeklyTerminationCount = $weeklyTerminationCount
      weeklyBillingHoldCount = $weeklyBillingHoldCount
      teamLabel = $teamLabel
      guidelines = $guidelines
      items = $items
      holdItems = $holdItems
      reasonSummary = $reasonSummary
    }
  }

  $terminationSheets = @($terminationSheets | Sort-Object { Sheet-DateKey $_.name } -Descending)
  $currentSheet = $terminationSheets | Where-Object { $_.name -eq $baseSheetName } | Select-Object -First 1
  if (-not $currentSheet -and $terminationSheets.Count -gt 0) { $currentSheet = $terminationSheets[0] }

  $yearsList = @((@($years) + 2026) | Sort-Object -Descending -Unique)

  $nextState = [ordered]@{
    currentYear = 2026
    years = $yearsList
    availableYears = $yearsList
    weeklyReport = [ordered]@{
      baseDate = $baseDate
      revenueHeaderText = Normalize-Whitespace (Get-CellText $optionWs 3 1)
      subtitleOne = if ($subtitleParts.Count -ge 1) { $subtitleParts[0] } else { "" }
      subtitleTwo = if ($subtitleParts.Count -ge 2) { $subtitleParts[1] } else { "" }
      manualSummary = $manualSummary
      revenueRows = $revenueRows
      goalRows = $goalRows
      industryStats = $industryStats
      additionalSales = $additionalSales
    }
    contracts = @($contracts | Sort-Object { [int]($_["no"]) })
    collection = [ordered]@{
      tab = "integrated"
      yearFilter = 2026
      statusFilter = "all"
      integrated = @($integrated)
      longTerm = @($longTerm)
    }
    termination = [ordered]@{
      currentSheetId = if ($currentSheet) { $currentSheet.id } else { "" }
      sheets = @($terminationSheets)
    }
  }

  $json = $nextState | ConvertTo-Json -Depth 30
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($statePath, $json, $utf8NoBom)
  Write-Output ("Updated app-state.json contracts={0}, integrated={1}, longTerm={2}, sheets={3}" -f $contracts.Count, $integrated.Count, $longTerm.Count, $terminationSheets.Count)
}
finally {
  if ($weeklyWb) { $weeklyWb.Close($false) | Out-Null }
  if ($terminationWb) { $terminationWb.Close($false) | Out-Null }
  if ($collectionWb) { $collectionWb.Close($false) | Out-Null }
  if ($excel) {
    $excel.DisplayAlerts = $true
    $excel.Quit()
  }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
