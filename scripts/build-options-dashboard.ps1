$ErrorActionPreference = "Stop"

$desktopFiles = Get-ChildItem -Path "$env:USERPROFILE\Desktop" -Filter "*.xlsx"
$sofrFile = $null
$optionsFile = $null

$preferredOptionsFile = "$env:USERPROFILE\Desktop\2025년 옵션정보 리스트 현황.xlsx"
if (Test-Path -LiteralPath $preferredOptionsFile) {
  $optionsFile = $preferredOptionsFile
}

if ([string]::IsNullOrWhiteSpace($sofrFile)) {
  $sofrFile = ($desktopFiles | Where-Object { $_.Name -match "SOFR" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
}
if ([string]::IsNullOrWhiteSpace($optionsFile)) {
  $optionsFile = ($desktopFiles | Where-Object { $_.Name -notmatch "SOFR" -and $_.Length -gt 100000 } | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
  if (-not $optionsFile) {
    $optionsFile = ($desktopFiles | Where-Object { $_.Name -notmatch "SOFR" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
  }
}

if (-not $optionsFile) { throw "옵션 정보 엑셀 파일을 찾지 못했습니다. Desktop에 옵션정보 파일이 있어야 합니다." }
if (-not (Test-Path -LiteralPath $optionsFile)) { throw "옵션 정보 엑셀 파일 경로가 유효하지 않습니다: $optionsFile" }
$outputPath = "C:\Users\infouser\Documents\New project\marketing dashboard\marketing dashboard\data\options-dashboard.mock.json"

$existingRecords = @()
if (Test-Path -LiteralPath $outputPath) {
  try {
    $existingJson = Get-Content -Raw -Encoding UTF8 $outputPath | ConvertFrom-Json -Depth 8
    if ($existingJson -and $existingJson.optionRecords) {
      $existingRecords = @($existingJson.optionRecords)
    }
  } catch {
    $existingRecords = @()
  }
}

function Get-CellText {
  param(
    [__ComObject]$Sheet,
    [int]$Row,
    [int]$Col
  )
  return [string]$Sheet.Cells.Item($Row, $Col).Text
}

function Is-UserId {
  param(
    [string]$Text
  )
  if ([string]::IsNullOrWhiteSpace($Text)) { return $false }
  return ($Text.Trim() -match '^E\d+')
}

function Get-LastRow {
  param(
    [__ComObject]$Sheet,
    [int]$Col
  )
  if ($null -eq $Sheet) { return 0 }
  $used = 0
  try {
    $used = $Sheet.UsedRange.Rows.Count
  } catch {
    $used = 0
  }
  if ($used -gt 1) { return $used }
  $xlUp = -4162
  try {
    return $Sheet.Cells.Item($Sheet.Rows.Count, $Col).End($xlUp).Row
  } catch {
    return $used
  }
}

function Get-WorksheetByNameOrIndex {
  param(
    [Parameter(Mandatory=$true)]$Workbook,
    [Parameter(Mandatory=$true)][string]$NamePattern,
    [Parameter(Mandatory=$true)][int]$Index
  )
  $sheet = $null
  foreach ($ws in $Workbook.Worksheets) {
    if ($ws.Name -match $NamePattern) {
      $sheet = $ws
      break
    }
  }
  if (-not $sheet) {
    try { $sheet = $Workbook.Worksheets.Item($Index) } catch {}
  }
  if (-not $sheet) {
    $names = @()
    foreach ($ws in $Workbook.Worksheets) { $names += $ws.Name }
    throw ("옵션 엑셀 시트를 찾지 못했습니다. 시트 목록: {0}" -f ($names -join ", "))
  }
  return $sheet
}

function Add-Record {
  param(
    [hashtable]$Data
  )
  $record = [ordered]@{
    record_id = $Data.record_id
    category_code = $Data.category_code
    sub_type = $Data.sub_type
    industry = $Data.industry
    company_name = $Data.company_name
    user_id = $Data.user_id
    department = $Data.department
    requester_name = $Data.requester_name
    contact = $Data.contact
    request_date = $Data.request_date
    real_apply = $Data.real_apply
    billing_month = $Data.billing_month
    status = $Data.status
    agreement = $Data.agreement
    customer_type = $Data.customer_type
    tr_cd = $Data.tr_cd
    dedicated = $Data.dedicated
    quantity = $Data.quantity
    recommender = $Data.recommender
    receiver = $Data.receiver
    apply_count = $Data.apply_count
    apply_ids = $Data.apply_ids
    amount = $Data.amount
    note = $Data.note
    is_active = $Data.is_active
  }
  $script:Records += $record
}

function Add-ExistingRecord {
  param(
    [Parameter(Mandatory = $true)]$Source
  )
  Add-Record @{
    record_id = [string]$Source.record_id
    category_code = [string]$Source.category_code
    sub_type = [string]$Source.sub_type
    industry = [string]$Source.industry
    company_name = [string]$Source.company_name
    user_id = [string]$Source.user_id
    department = [string]$Source.department
    requester_name = [string]$Source.requester_name
    contact = [string]$Source.contact
    request_date = [string]$Source.request_date
    real_apply = [string]$Source.real_apply
    billing_month = [string]$Source.billing_month
    status = [string]$Source.status
    agreement = [string]$Source.agreement
    customer_type = [string]$Source.customer_type
    tr_cd = [string]$Source.tr_cd
    dedicated = [string]$Source.dedicated
    quantity = [string]$Source.quantity
    recommender = [string]$Source.recommender
    receiver = [string]$Source.receiver
    apply_count = [string]$Source.apply_count
    apply_ids = [string]$Source.apply_ids
    amount = [string]$Source.amount
    note = [string]$Source.note
    is_active = [int]([string]$Source.is_active)
  }
}

$categories = @(
  [ordered]@{ category_code = "BOND"; display_order = 1 },
  [ordered]@{ category_code = "INDEX"; display_order = 2 },
  [ordered]@{ category_code = "STOCK"; display_order = 3 },
  [ordered]@{ category_code = "LME"; display_order = 4 },
  [ordered]@{ category_code = "SIGNAGE"; display_order = 5 },
  [ordered]@{ category_code = "API"; display_order = 6 },
  [ordered]@{ category_code = "SOFR"; display_order = 7 }
)

$Records = @()

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false

try {
  $wbOptions = $excel.Workbooks.Open($optionsFile)
  $wbOptions.Activate() | Out-Null
# Sheet index 1: 해외지수
$wsIndex = $wbOptions.Worksheets.Item(1)
if ($null -eq $wsIndex) {
  $wsIndex = ($wbOptions.Worksheets | Where-Object { $_.Name -match "해외지수" } | Select-Object -First 1)
}
if ($null -eq $wsIndex) { throw "INDEX sheet not found." }
  $indexRows = Get-LastRow -Sheet $wsIndex -Col 4
  $indexGroup = ""
  $indexGroupAllow = @("기업","은행","증권","보험","자산운용","공제회","외국계","선물","정부기관","공기관","공사","연기금/공공기관","연기금","공공기관")
    $indexAdded = 0
    for ($r = 4; $r -le $indexRows; $r++) {
      $col2 = (Get-CellText -Sheet $wsIndex -Row $r -Col 2).Trim()
      if ($col2 -and ($indexGroupAllow -contains $col2)) { $indexGroup = $col2 }

      $col3 = (Get-CellText -Sheet $wsIndex -Row $r -Col 3).Trim()
      $col4 = (Get-CellText -Sheet $wsIndex -Row $r -Col 4).Trim()
      $col5 = (Get-CellText -Sheet $wsIndex -Row $r -Col 5).Trim()

      $isShifted = (Is-UserId $col3) -and ($col4 -match '전환|미전환|해지')
      $isNormal = (Is-UserId $col4)

      if (-not $isShifted -and -not $isNormal) { continue }

      $userId = ""
      $company = ""
      $status = ""
      $requestDate = ""
      $realApply = ""
      $billingMonth = ""
      $agreement = ""
      $note = ""
      $subType = ""

      if ($isShifted) {
        $userId = $col3
        $company = $col2
        $status = $col4
        $requestDate = $col5
        $realApply = (Get-CellText -Sheet $wsIndex -Row $r -Col 6)
        $billingMonth = (Get-CellText -Sheet $wsIndex -Row $r -Col 7)
        $agreement = (Get-CellText -Sheet $wsIndex -Row $r -Col 8)
        $note = (Get-CellText -Sheet $wsIndex -Row $r -Col 9)
        $subType = ""
      } else {
        $userId = $col4
        $company = $col3
        $status = $col5
        $requestDate = (Get-CellText -Sheet $wsIndex -Row $r -Col 6)
        $realApply = (Get-CellText -Sheet $wsIndex -Row $r -Col 7)
        $billingMonth = (Get-CellText -Sheet $wsIndex -Row $r -Col 8)
        $agreement = (Get-CellText -Sheet $wsIndex -Row $r -Col 9)
        $note = (Get-CellText -Sheet $wsIndex -Row $r -Col 10)
        $subType = $col2
        if ([string]::IsNullOrWhiteSpace($subType)) { $subType = $indexGroup }
      }
      if ([string]::IsNullOrWhiteSpace($userId)) { continue }
      Add-Record @{
        record_id = [guid]::NewGuid().ToString()
        category_code = "INDEX"
        sub_type = $subType
        company_name = $company
        user_id = $userId
        department = ""
        requester_name = ""
        contact = ""
        request_date = $requestDate
        real_apply = $realApply
        billing_month = $billingMonth
        status = $status
        agreement = $agreement
        note = $note
        industry = ""
        customer_type = ""
        tr_cd = ""
        dedicated = ""
        quantity = ""
        recommender = ""
        receiver = ""
      apply_count = ""
      apply_ids = ""
      amount = ""
      is_active = $(if ($status -eq "전환") { 1 } else { 0 })
    }
    $indexAdded++
  }
  if ($indexAdded -eq 0) {
    for ($r = 4; $r -le $indexRows; $r++) {
      $userId = [string]$wsIndex.Cells.Item($r, 4).Text
      if ([string]::IsNullOrWhiteSpace($userId)) { continue }
      $status = [string]$wsIndex.Cells.Item($r, 5).Text
      Add-Record @{
        record_id = [guid]::NewGuid().ToString()
        category_code = "INDEX"
        sub_type = [string]$wsIndex.Cells.Item($r, 2).Text
        company_name = [string]$wsIndex.Cells.Item($r, 3).Text
        user_id = $userId
        department = ""
        requester_name = ""
        contact = ""
        request_date = [string]$wsIndex.Cells.Item($r, 6).Text
        real_apply = [string]$wsIndex.Cells.Item($r, 7).Text
        billing_month = [string]$wsIndex.Cells.Item($r, 8).Text
        status = $status
        agreement = [string]$wsIndex.Cells.Item($r, 9).Text
        note = [string]$wsIndex.Cells.Item($r, 10).Text
        industry = ""
        customer_type = ""
        tr_cd = ""
        dedicated = ""
        quantity = ""
        recommender = ""
        receiver = ""
        apply_count = ""
        apply_ids = ""
        amount = ""
        is_active = $(if ($status -eq "전환") { 1 } else { 0 })
      }
      $indexAdded++
    }
  }

  # Sheet index 2: 해외종목
  $wsStock = $wbOptions.Worksheets.Item(2)
  if ($null -eq $wsStock) {
    $wsStock = ($wbOptions.Worksheets | Where-Object { $_.Name -match "해외종목" } | Select-Object -First 1)
  }
  if ($null -eq $wsStock) { throw "STOCK sheet not found." }
  $stockRows = Get-LastRow -Sheet $wsStock -Col 4
  for ($r = 2; $r -le $stockRows; $r++) {
    $userId = Get-CellText -Sheet $wsStock -Row $r -Col 4
    if ([string]::IsNullOrWhiteSpace($userId)) { continue }
    $status = (Get-CellText -Sheet $wsStock -Row $r -Col 11).Trim()
    Add-Record @{
      record_id = [guid]::NewGuid().ToString()
      category_code = "STOCK"
      sub_type = (Get-CellText -Sheet $wsStock -Row $r -Col 3)
      company_name = (Get-CellText -Sheet $wsStock -Row $r -Col 5)
      user_id = $userId
      department = (Get-CellText -Sheet $wsStock -Row $r -Col 6)
      requester_name = (Get-CellText -Sheet $wsStock -Row $r -Col 7)
      contact = (Get-CellText -Sheet $wsStock -Row $r -Col 8)
      request_date = (Get-CellText -Sheet $wsStock -Row $r -Col 2)
      billing_month = (Get-CellText -Sheet $wsStock -Row $r -Col 9)
      amount = (Get-CellText -Sheet $wsStock -Row $r -Col 10)
      status = $status
      receiver = (Get-CellText -Sheet $wsStock -Row $r -Col 12)
      note = (Get-CellText -Sheet $wsStock -Row $r -Col 13)
      industry = ""
      real_apply = ""
      agreement = ""
      customer_type = ""
      tr_cd = ""
      dedicated = ""
      quantity = ""
      recommender = ""
      apply_count = ""
      apply_ids = ""
      is_active = $(if ($status -eq "유") { 1 } else { 0 })
    }
  }

  # Sheet index 3: LME
  $wsLme = $wbOptions.Worksheets.Item(3)
  if ($null -eq $wsLme) {
    $wsLme = ($wbOptions.Worksheets | Where-Object { $_.Name -match "LME" } | Select-Object -First 1)
  }
  if ($null -eq $wsLme) { throw "LME sheet not found." }
  $lmeRows = Get-LastRow -Sheet $wsLme -Col 2
  for ($r = 6; $r -le $lmeRows; $r++) {
    $userId = Get-CellText -Sheet $wsLme -Row $r -Col 2
    if ([string]::IsNullOrWhiteSpace($userId)) { continue }
    $customerType = (Get-CellText -Sheet $wsLme -Row $r -Col 3).Trim()
    $status = (Get-CellText -Sheet $wsLme -Row $r -Col 4).Trim()
    Add-Record @{
      record_id = [guid]::NewGuid().ToString()
      category_code = "LME"
      sub_type = (Get-CellText -Sheet $wsLme -Row $r -Col 8)
      company_name = (Get-CellText -Sheet $wsLme -Row $r -Col 5)
      user_id = $userId
      department = (Get-CellText -Sheet $wsLme -Row $r -Col 6)
      requester_name = (Get-CellText -Sheet $wsLme -Row $r -Col 5)
      customer_type = $customerType
      tr_cd = (Get-CellText -Sheet $wsLme -Row $r -Col 7)
      status = $status
      industry = ""
      contact = ""
      request_date = ""
      real_apply = ""
      billing_month = ""
      agreement = ""
      dedicated = ""
      quantity = ""
      recommender = ""
      receiver = ""
      apply_count = ""
      apply_ids = ""
      amount = ""
      note = ""
      is_active = $(if ($customerType -eq "계약") { 1 } else { 0 })
    }
  }

  # Sheet index 4: 해외채권 유료독자
  $wsBond = $wbOptions.Worksheets.Item(4)
  if ($null -eq $wsBond) {
    $wsBond = ($wbOptions.Worksheets | Where-Object { $_.Name -match "해외채권|유료독자" } | Select-Object -First 1)
  }
  if ($null -eq $wsBond) { throw "BOND sheet not found." }
  $bondRows = Get-LastRow -Sheet $wsBond -Col 2
  for ($r = 3; $r -le $bondRows; $r++) {
    $userId = Get-CellText -Sheet $wsBond -Row $r -Col 2
    if ([string]::IsNullOrWhiteSpace($userId)) { continue }
    Add-Record @{
      record_id = [guid]::NewGuid().ToString()
      category_code = "BOND"
      sub_type = "해외채권"
      company_name = (Get-CellText -Sheet $wsBond -Row $r -Col 3)
      user_id = $userId
      department = (Get-CellText -Sheet $wsBond -Row $r -Col 4)
      requester_name = (Get-CellText -Sheet $wsBond -Row $r -Col 5)
      billing_month = (Get-CellText -Sheet $wsBond -Row $r -Col 6)
      dedicated = (Get-CellText -Sheet $wsBond -Row $r -Col 7)
      quantity = (Get-CellText -Sheet $wsBond -Row $r -Col 8)
      recommender = (Get-CellText -Sheet $wsBond -Row $r -Col 9)
      note = (Get-CellText -Sheet $wsBond -Row $r -Col 10)
      industry = ""
      contact = ""
      request_date = ""
      real_apply = ""
      status = ""
      agreement = ""
      customer_type = ""
      tr_cd = ""
      receiver = ""
      apply_count = ""
      apply_ids = ""
      amount = ""
      is_active = 1
    }
  }

  $wbOptions.Close($false)

  if ($sofrFile -and (Test-Path -LiteralPath $sofrFile)) {
    $wbSofr = $excel.Workbooks.Open($sofrFile)
    $wsSofr = $wbSofr.Worksheets.Item(1)
    $sofrRows = Get-LastRow -Sheet $wsSofr -Col 2
    for ($r = 4; $r -le $sofrRows; $r++) {
      $userId = Get-CellText -Sheet $wsSofr -Row $r -Col 2
      if ([string]::IsNullOrWhiteSpace($userId)) { continue }
      Add-Record @{
        record_id = [guid]::NewGuid().ToString()
        category_code = "SOFR"
        sub_type = "SOFR"
        industry = (Get-CellText -Sheet $wsSofr -Row $r -Col 3)
        company_name = (Get-CellText -Sheet $wsSofr -Row $r -Col 4)
        user_id = $userId
        department = (Get-CellText -Sheet $wsSofr -Row $r -Col 5)
        requester_name = (Get-CellText -Sheet $wsSofr -Row $r -Col 6)
        contact = (Get-CellText -Sheet $wsSofr -Row $r -Col 7)
        billing_month = (Get-CellText -Sheet $wsSofr -Row $r -Col 8)
        receiver = (Get-CellText -Sheet $wsSofr -Row $r -Col 9)
        note = (Get-CellText -Sheet $wsSofr -Row $r -Col 10)
        apply_count = (Get-CellText -Sheet $wsSofr -Row $r -Col 11)
        apply_ids = (Get-CellText -Sheet $wsSofr -Row $r -Col 12)
        status = ""
        request_date = ""
        real_apply = ""
        agreement = ""
        customer_type = ""
        tr_cd = ""
        dedicated = ""
        quantity = ""
        recommender = ""
        amount = ""
        is_active = 1
      }
    }
    $wbSofr.Close($false)
  } else {
    $fallbackSofr = @($existingRecords | Where-Object { $_.category_code -eq "SOFR" })
    foreach ($row in $fallbackSofr) {
      Add-ExistingRecord -Source $row
    }
  }
} finally {
  $excel.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
}

$preserveCategoryCodes = @("SIGNAGE", "API")
foreach ($code in $preserveCategoryCodes) {
  $rows = @($existingRecords | Where-Object { $_.category_code -eq $code })
  foreach ($row in $rows) {
    Add-ExistingRecord -Source $row
  }
}

$counts = @{}
foreach ($cat in $categories) {
  $code = $cat.category_code
  $active = $Records | Where-Object { $_.category_code -eq $code -and $_.is_active -eq 1 }
  switch ($code) {
    "BOND" {
      # 해외채권은 사용자ID 중복이 있어도 "건수" 기준으로 카운트합니다.
      $counts[$code] = $active.Count
    }
    "INDEX" {
      $ids = $active |
        Where-Object { $indexGroupAllow -contains ([string]$_.sub_type).Trim() } |
        ForEach-Object { $_.user_id } |
        Where-Object { $_ } |
        Sort-Object -Unique
      $counts[$code] = $ids.Count
    }
    "STOCK" {
      $counts[$code] = $active.Count
    }
    "LME" {
      $ids = $active | ForEach-Object { $_.user_id } | Where-Object { $_ } | Sort-Object -Unique
      $counts[$code] = $ids.Count
    }
    "SOFR" {
      $sum = 0
      foreach ($row in $active) {
        $raw = [string]$row.apply_count
        $digits = $raw -replace "[^0-9]", ""
        if ($digits) { $sum += [int]$digits }
      }
      $counts[$code] = $sum
    }
    Default {
      $counts[$code] = $active.Count
    }
  }
}


$seedCounts = @()
foreach ($cat in $categories) {
  $seedCounts += [ordered]@{ category_code = $cat.category_code; count_value = [int]$counts[$cat.category_code] }
}

$today = (Get-Date).ToString("yyyy-MM-dd")
$historyCounts = @()
foreach ($cat in $categories) {
  $historyCounts += [ordered]@{ snapshot_date = $today; category_code = $cat.category_code; count_value = [int]$counts[$cat.category_code] }
}

$result = [ordered]@{
  categories = $categories
  seedCounts = $seedCounts
  historyCounts = $historyCounts
  optionRecords = $Records
}

$json = $result | ConvertTo-Json -Depth 7
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outputPath, $json, $utf8NoBom)
Write-Output "Saved: $outputPath"

