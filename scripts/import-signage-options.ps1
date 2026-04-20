param(
  [string]$ExcelPath = "",
  [string]$MockPath = "C:\Users\infouser\Documents\New project\marketing dashboard\marketing dashboard\data\options-dashboard.mock.json"
)

$ErrorActionPreference = "Stop"

function To-Text([object]$value) {
  if ($null -eq $value) { return "" }
  return $value.ToString().Replace("`r", " ").Replace("`n", " ").Trim()
}

function Merge-Text([string]$left, [string]$right) {
  $a = To-Text $left
  $b = To-Text $right
  if ([string]::IsNullOrWhiteSpace($a)) { return $b }
  if ([string]::IsNullOrWhiteSpace($b)) { return $a }
  if ($a.Contains($b)) { return $a }
  return "$a / $b"
}

function Build-Counts([object[]]$records, [object[]]$categories) {
  $counts = @{}
  foreach ($cat in $categories) {
    $counts[$cat.category_code] = 0
  }

  $active = @($records | Where-Object { [int]($_.is_active) -eq 1 })

  foreach ($cat in $categories) {
    $code = $cat.category_code
    if ($code -eq "SOFR") {
      $sum = 0
      foreach ($row in $active | Where-Object { $_.category_code -eq $code }) {
        $raw = To-Text $row.apply_count
        $digits = [System.Text.RegularExpressions.Regex]::Replace($raw, "[^0-9]", "")
        if (-not [string]::IsNullOrWhiteSpace($digits)) {
          $sum += [int]$digits
        }
      }
      $counts[$code] = $sum
      continue
    }

    if ($code -eq "BOND") {
      $counts[$code] = @($active | Where-Object { $_.category_code -eq $code }).Count
      continue
    }

    if (@("INDEX", "LME") -contains $code) {
      $uniqueIds = New-Object "System.Collections.Generic.HashSet[string]"
      foreach ($row in $active | Where-Object { $_.category_code -eq $code }) {
        $id = To-Text $row.user_id
        if (-not [string]::IsNullOrWhiteSpace($id)) {
          [void]$uniqueIds.Add($id)
        }
      }
      $counts[$code] = $uniqueIds.Count
      continue
    }

    if ($code -eq "STOCK") {
      $counts[$code] = @($active | Where-Object { $_.category_code -eq $code }).Count
      continue
    }

    $counts[$code] = @($active | Where-Object { $_.category_code -eq $code }).Count
  }

  return $counts
}

if ([string]::IsNullOrWhiteSpace($ExcelPath)) {
  throw "ExcelPath is required."
}
if (-not (Test-Path -LiteralPath $ExcelPath)) {
  throw "Excel file not found: $ExcelPath"
}
if (-not (Test-Path -LiteralPath $MockPath)) {
  throw "Mock json file not found: $MockPath"
}

$excel = $null
$workbook = $null
$sheet = $null
$usedRange = $null
$signageRows = New-Object System.Collections.Generic.List[object]
$current = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $workbook = $excel.Workbooks.Open($ExcelPath, $null, $true)
  $sheet = $workbook.Worksheets.Item(2)
  $usedRange = $sheet.UsedRange
  $rowCount = $usedRange.Rows.Count

  for ($row = 3; $row -le $rowCount; $row++) {
    $col1 = To-Text $sheet.Cells.Item($row, 1).Text
    $col2 = To-Text $sheet.Cells.Item($row, 2).Text
    $col3 = To-Text $sheet.Cells.Item($row, 3).Text
    $col4 = To-Text $sheet.Cells.Item($row, 4).Text
    $col5 = To-Text $sheet.Cells.Item($row, 5).Text
    $col6 = To-Text $sheet.Cells.Item($row, 6).Text
    $col7 = To-Text $sheet.Cells.Item($row, 7).Text
    $col9 = To-Text $sheet.Cells.Item($row, 9).Text
    $col10 = To-Text $sheet.Cells.Item($row, 10).Text
    $col11 = To-Text $sheet.Cells.Item($row, 11).Text
    $col12 = To-Text $sheet.Cells.Item($row, 12).Text
    $col13 = To-Text $sheet.Cells.Item($row, 13).Text

    $isMainRow = $false
    if (-not [string]::IsNullOrWhiteSpace($col1)) {
      $n = 0
      $isMainRow = [int]::TryParse($col1, [ref]$n)
    }

    if ($isMainRow) {
      $status = $col4
      $isActive = 1

      $noteText = ""
      $noteText = Merge-Text $noteText $col3
      $noteText = Merge-Text $noteText $col10
      $noteText = Merge-Text $noteText $col11
      $noteText = Merge-Text $noteText $col12

      $current = [ordered]@{
        record_id         = "signage-" + ([guid]::NewGuid().ToString())
        category_code     = "SIGNAGE"
        category_name_ko  = ""
        sub_type          = ""
        industry          = ""
        company_name      = $col5
        user_id           = $col2
        department        = $col6
        requester_name    = $col13
        contact           = ""
        request_date      = ""
        real_apply        = ""
        billing_month     = $col9
        status            = $status
        agreement         = ""
        customer_type     = ""
        tr_cd             = ""
        dedicated         = $col7
        quantity          = ""
        recommender       = ""
        receiver          = ""
        apply_count       = ""
        apply_ids         = $col2
        amount            = ""
        note              = $noteText
        is_active         = $isActive
      }

      $signageRows.Add([pscustomobject]$current) | Out-Null
      continue
    }

    if ($null -ne $current -and -not [string]::IsNullOrWhiteSpace($col2)) {
      $current.user_id = Merge-Text $current.user_id $col2
      $current.apply_ids = Merge-Text $current.apply_ids $col2
      $current.department = Merge-Text $current.department $col6
      $current.note = Merge-Text $current.note $col11
      $current.note = Merge-Text $current.note $col12
      continue
    }
  }
}
finally {
  if ($null -ne $workbook) { $workbook.Close($false) }
  if ($null -ne $excel) { $excel.Quit() }
  if ($null -ne $usedRange) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($usedRange) }
  if ($null -ne $sheet) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($sheet) }
  if ($null -ne $workbook) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($workbook) }
  if ($null -ne $excel) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

$mockRaw = Get-Content -LiteralPath $MockPath -Encoding UTF8 -Raw
$mock = $mockRaw | ConvertFrom-Json

$existingRecords = @($mock.optionRecords)
$withoutSignage = @($existingRecords | Where-Object { $_.category_code -ne "SIGNAGE" })
$nextRecords = @($signageRows.ToArray()) + @($withoutSignage)
$mock.optionRecords = $nextRecords

$categories = @($mock.categories)
$counts = Build-Counts -records $nextRecords -categories $categories

$seedRows = New-Object System.Collections.Generic.List[object]
foreach ($cat in $categories) {
  $code = $cat.category_code
  $seedRows.Add([pscustomobject]@{
      category_code = $code
      count_value   = [int]($counts[$code] | ForEach-Object { $_ })
    }) | Out-Null
}
$mock.seedCounts = @($seedRows.ToArray())

$historyRows = @($mock.historyCounts)
$dates = @($historyRows | Select-Object -ExpandProperty snapshot_date -Unique)
if ($dates.Count -eq 0) {
  $dates = @((Get-Date).ToString("yyyy-MM-dd"))
}

$updatedHistory = New-Object System.Collections.Generic.List[object]
foreach ($row in $historyRows) {
  if ($row.category_code -ne "SIGNAGE") {
    $updatedHistory.Add($row) | Out-Null
  }
}

foreach ($d in $dates) {
  $updatedHistory.Add([pscustomobject]@{
      snapshot_date = $d
      category_code = "SIGNAGE"
      count_value   = [int]($counts["SIGNAGE"] | ForEach-Object { $_ })
    }) | Out-Null
}
$mock.historyCounts = @($updatedHistory.ToArray())

$json = $mock | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($MockPath, $json, (New-Object System.Text.UTF8Encoding($false)))

Write-Output ("Imported SIGNAGE records: {0}" -f $signageRows.Count)
Write-Output ("SIGNAGE seed count: {0}" -f ([int]$counts["SIGNAGE"]))
