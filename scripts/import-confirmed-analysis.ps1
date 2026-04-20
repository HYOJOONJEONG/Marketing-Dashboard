param(
  [string]$WorkbookPath = "C:\Users\infouser\Desktop\2026년 신규, 대체, 해지 유형 분석 자료(주간업무보고용).xlsx",
  [string]$SheetName = "2026년 해지 유형 분석",
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

function Parse-IntFromAny($value, [string]$text) {
  if ($null -ne $value) {
    try { return [int]([double]$value) } catch {}
  }
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

function Find-HeaderColumn($ws, [string[]]$candidates, [ref]$headerRowRef) {
  for ($r = 1; $r -le 15; $r++) {
    for ($c = 1; $c -le 60; $c++) {
      $cell = Normalize-Whitespace (Get-CellText $ws $r $c)
      if ([string]::IsNullOrWhiteSpace($cell)) { continue }
      foreach ($candidate in $candidates) {
        if ($cell -eq $candidate) {
          $headerRowRef.Value = $r
          return $c
        }
      }
    }
  }
  return 0
}

if (-not (Test-Path $WorkbookPath)) { throw "Workbook not found: $WorkbookPath" }
if (-not (Test-Path $StatePath)) { throw "State file not found: $StatePath" }

$excel = $null
$wb = $null

try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open($WorkbookPath, 0, $true)
  $ws = $wb.Worksheets.Item($SheetName)
  if ($null -eq $ws) { throw "Sheet not found: $SheetName" }

  $reasonCols = @(
    @{ colName = "사"; reason = "퇴사" },
    @{ colName = "비"; reason = "비용절감" },
    @{ colName = "활"; reason = "활용도 저조" },
    @{ colName = "콘,타"; reason = "타사대체" },
    @{ colName = "조직"; reason = "조직개편" },
    @{ colName = "휴직"; reason = "휴직/장기출장" },
    @{ colName = "합병"; reason = "합병매각" },
    @{ colName = "만료"; reason = "계약만료" },
    @{ colName = "미수"; reason = "비용미납" }
  )

  $today = (Get-Date).ToString("yyyy.MM.dd")
  $confirmedItems = @()
  $index = 0
  $headerRows = @()
  $usedRows = [int]$ws.UsedRange.Rows.Count
  for ($r = 1; $r -le $usedRows; $r++) {
    $c1 = Normalize-Whitespace (Get-CellText $ws $r 1)
    $c2 = Normalize-Whitespace (Get-CellText $ws $r 2)
    $c3 = Normalize-Whitespace (Get-CellText $ws $r 3)
    $c4 = Normalize-Whitespace (Get-CellText $ws $r 4)
    if ($c1 -eq "NO" -and $c2 -eq "날짜" -and $c3 -eq "아이디" -and $c4 -eq "회사명") {
      $headerRows += $r
    }
  }
  if ($headerRows.Count -eq 0) {
    throw "필수 헤더(아이디)를 찾지 못했습니다."
  }

  $reasonColumnMap = @{
    "사" = 7
    "비" = 8
    "활" = 9
    "콘,타" = 10
    "조직" = 11
    "휴직" = 12
    "합병" = 13
    "만료" = 14
    "미수" = 15
  }

  for ($h = 0; $h -lt $headerRows.Count; $h++) {
    $start = [int]$headerRows[$h] + 2
    $end = if ($h -lt $headerRows.Count - 1) { [int]$headerRows[$h + 1] - 1 } else { $usedRows }
    for ($r = $start; $r -le $end; $r++) {
      $noText = Normalize-Whitespace (Get-CellText $ws $r 1)
      $idText = Normalize-Whitespace (Get-CellText $ws $r 3)
      if ([string]::IsNullOrWhiteSpace($idText)) { continue }
      if ($noText -notmatch "^\d+$") { continue }

      $company = Normalize-Whitespace (Get-CellText $ws $r 4)
      $dept = Normalize-Whitespace (Get-CellText $ws $r 5)
      $manager = Normalize-Whitespace (Get-CellText $ws $r 6)
      $dateText = Format-DateValue (Get-CellValue $ws $r 2) (Get-CellText $ws $r 2)

      $reasonType = ""
      foreach ($reason in $reasonCols) {
        $col = [int]$reasonColumnMap[$reason.colName]
        $num = Parse-IntFromAny (Get-CellValue $ws $r $col) (Get-CellText $ws $r $col)
        if ($num -eq 1) { $reasonType = $reason.reason }
      }
      if ([string]::IsNullOrWhiteSpace($reasonType)) { $reasonType = "기타" }

      $penalty = Parse-IntFromAny (Get-CellValue $ws $r 24) (Get-CellText $ws $r 24)

      $index++
      $confirmedItems += [ordered]@{
        id = "confirmed-import-$index"
        no = $index
        selected = $true
        receivedDate = $dateText
        manager = $manager
        customerId = $idText
        reason = $reasonType
        terminationDate = $dateText
        companyName = $company
        departmentName = $dept
        penalty = $penalty
        reflectedDate = $today
      }
    }
  }

  $state = Get-Content -Raw -Encoding UTF8 $StatePath | ConvertFrom-Json
  if ($null -eq $state.termination) {
    $state | Add-Member -NotePropertyName termination -NotePropertyValue @{} -Force
  }
  if ($null -eq $state.termination.sheets -or $state.termination.sheets.Count -eq 0) {
    $state.termination.sheets = @([ordered]@{
      id = "sheet-260423"
      name = "26.04.23"
      title = "단말기 해지 진행사항"
      weeklyTerminationCount = 0
      weeklyBillingHoldCount = 0
      teamLabel = "인포Biz본부 인포Biz1팀"
      guidelines = @("1. 해지 발생 시 본부장님 보고 진행", "2. CRM 및 해지 리스트 등록")
      items = @()
      holdItems = @()
      confirmedItems = @()
      releasedHoldItems = @()
      reasonSummary = @{}
    })
    $state.termination.currentSheetId = "sheet-260423"
  }

  $state.termination.sheets[0].confirmedItems = @($confirmedItems)
  $state.termination.sheets[0].title = "단말기 해지 진행사항"

  $json = $state | ConvertTo-Json -Depth 60
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($StatePath, $json, $utf8NoBom)

  Write-Output ("Imported confirmed list: {0} rows" -f $confirmedItems.Count)
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


