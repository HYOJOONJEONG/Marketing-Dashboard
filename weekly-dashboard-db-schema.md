# 정보사업본부 주간실적 대시보드 DB 테이블 설계안

## 1. 설계 목표

이 설계는 현재 엑셀 파일의 3가지 역할을 데이터베이스로 분리하는 것을 목표로 한다.

- `신규계약리스트` -> 계약 원장 테이블
- `옵션정보입력` -> 주간 입력 테이블
- `주간실적보고` -> 조회용 보고서 스냅샷 및 PDF 이력 테이블

핵심 원칙

- 계약 원장과 주간 보고 입력을 분리
- 사람이 입력하는 값과 자동 집계 결과를 분리
- 보고서 생성 시점의 값을 스냅샷으로 보관
- 파생 엑셀 없이 단일 원천 데이터로 재사용 가능하게 설계

## 2. 권장 DB 구조 개요

권장 방식은 아래 5개 영역으로 나누는 것이다.

1. 기준정보 마스터
2. 계약 원장
3. 주간 보고 입력
4. 보고서 스냅샷/PDF
5. 검증 및 감사 로그

## 3. 핵심 테이블 목록

### 기준정보

- `users`
- `industries`
- `referrers`
- `replacement_types`
- `option_products`
- `report_settings`

### 계약 원장

- `contracts`
- `contract_documents`
- `contract_status_history`
- `weekly_report_contracts`

### 주간 보고 입력

- `weekly_reports`
- `weekly_revenue_items`
- `weekly_additional_revenues`
- `weekly_terminal_metrics`
- `weekly_goal_metrics`
- `weekly_option_metrics`
- `weekly_termination_reasons`
- `weekly_industry_metrics`

### 보고서 결과물

- `weekly_report_snapshots`
- `weekly_report_pdfs`

### 운영/검증

- `validation_rules`
- `validation_results`
- `audit_logs`

## 4. 테이블 상세 설계

## 4-1. users

사용자 계정.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | 사용자 ID |
| login_id | varchar(50) unique | 로그인 계정 |
| name | varchar(100) | 이름 |
| role | varchar(30) | `ADMIN`, `EDITOR`, `VIEWER` |
| department_name | varchar(100) | 부서명 |
| is_active | boolean | 사용 여부 |
| created_at | datetime | 생성일시 |
| updated_at | datetime | 수정일시 |

## 4-2. industries

업종 마스터.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | 업종 ID |
| code | varchar(30) unique | 업종 코드 |
| name | varchar(100) | 업종명 |
| display_order | int | 정렬 순서 |
| is_active | boolean | 사용 여부 |

예시 데이터

- 국내증권
- 국내은행
- 외국계
- 자산운용
- 보험사
- 일반기업
- 공사/정부
- 연기금
- 기타금융

## 4-3. referrers

권유자 마스터.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | 권유자 ID |
| name | varchar(100) unique | 권유자명 |
| display_order | int | 정렬 순서 |
| is_active | boolean | 사용 여부 |

예시 데이터

- 이상철
- 이홍민
- 신무길
- 정효준
- 조홍희
- 정진영
- 박혜리
- 기타

## 4-4. replacement_types

대체유형 마스터.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | 유형 ID |
| code | varchar(30) unique | 유형 코드 |
| name | varchar(100) | 유형명 |
| is_active | boolean | 사용 여부 |

예시 데이터

- 신규
- 체크
- 블룸
- 로이터
- 마켓포인트
- 기타

## 4-5. option_products

유료 옵션 상품 마스터.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | 옵션 ID |
| code | varchar(30) unique | 옵션 코드 |
| name | varchar(100) | 옵션명 |
| display_order | int | 정렬 순서 |
| is_active | boolean | 사용 여부 |

예시 데이터

- 해외채권
- 해외지수
- 해외종목
- LME
- 전광판
- API
- SOFR

## 4-6. contracts

신규 계약 원장 핵심 테이블.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | 내부 PK |
| contract_no | varchar(50) unique null | 내부 관리번호 |
| external_id | varchar(50) | 엑셀의 ID 컬럼 |
| company_name | varchar(200) | 회사명 |
| department_name | varchar(200) | 부서명 |
| industry_id | bigint fk | 업종 |
| contract_month | date | 계약월의 기준일, 예: `2026-04-01` |
| contract_year | smallint | 연도 조회용 |
| contract_month_no | tinyint | 월 조회용 |
| document_status | varchar(20) | `RECEIVED`, `NOT_RECEIVED`, `UNKNOWN` |
| referrer_id | bigint fk | 권유자 |
| replacement_type_id | bigint fk | 대체유형 |
| remarks | varchar(500) null | 비고 |
| include_in_performance | boolean | 실적 반영 여부 |
| source_type | varchar(20) | `MANUAL`, `IMPORT` |
| source_file_name | varchar(255) null | 업로드 파일명 |
| created_by | bigint fk | 등록자 |
| updated_by | bigint fk | 수정자 |
| created_at | datetime | 생성일시 |
| updated_at | datetime | 수정일시 |

인덱스 권장

- `idx_contracts_month`
- `idx_contracts_referrer`
- `idx_contracts_industry`
- `idx_contracts_include_perf`
- `idx_contracts_external_id`

## 4-7. contract_documents

계약서 회수 상태 이력 또는 첨부 관리용.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| contract_id | bigint fk | 계약 |
| document_status | varchar(20) | 회수, 미회수, 확인필요 |
| file_name | varchar(255) null | 첨부파일명 |
| file_path | varchar(500) null | 저장 경로 |
| checked_by | bigint fk null | 확인자 |
| checked_at | datetime null | 확인일시 |
| notes | varchar(500) null | 메모 |

## 4-8. contract_status_history

원장 변경 이력 테이블.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| contract_id | bigint fk | 계약 |
| field_name | varchar(100) | 변경 필드 |
| old_value | text null | 이전값 |
| new_value | text null | 변경값 |
| changed_by | bigint fk | 변경자 |
| changed_at | datetime | 변경일시 |

## 4-9. weekly_reports

주간 보고서의 상위 헤더 테이블. 모든 입력은 이 레코드를 기준으로 묶인다.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | 주간 보고 PK |
| report_year | smallint | 보고 연도 |
| report_week | tinyint | ISO 또는 사내 기준 주차 |
| base_date | date | 보고 기준일 |
| title | varchar(200) | 기본값 `주간 실적 보고` |
| status | varchar(20) | `DRAFT`, `REVIEW`, `CONFIRMED`, `ARCHIVED` |
| is_locked | boolean | 확정 잠금 여부 |
| notes | text null | 메모 |
| created_by | bigint fk | 생성자 |
| updated_by | bigint fk | 수정자 |
| created_at | datetime | 생성일시 |
| updated_at | datetime | 수정일시 |

유니크 권장

- `(report_year, report_week)`

## 4-10. weekly_report_contracts

현재 엑셀의 `실적반영(A열)` + `Update` + `계약호출` 개념을 대체하는 핵심 테이블.

의미

- 계약 원장 전체를 바로 보고서에 넣지 않고
- 특정 주차 보고서에 포함할 계약만 운영 담당자가 선택

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| weekly_report_id | bigint fk | 주간 보고 |
| contract_id | bigint fk | 계약 원장 |
| is_included | boolean | 이번 주 반영 여부 |
| selected_by | bigint fk | 반영 선택자 |
| selected_at | datetime | 반영 선택 일시 |
| notes | varchar(300) null | 메모 |

유니크 권장

- `(weekly_report_id, contract_id)`

## 4-11. weekly_revenue_items

월별 매출 항목 입력.

엑셀의 `매출순증`, `위약금`, `이전비`를 정규화해서 저장한다.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| weekly_report_id | bigint fk | 주간 보고 |
| target_year | smallint | 귀속 연도 |
| target_month | tinyint | 귀속 월 |
| revenue_type | varchar(20) | `NET_INCREASE`, `PENALTY`, `TRANSFER_FEE` |
| amount_million | decimal(12,2) | 백만 원 단위 금액 |
| created_at | datetime | 생성일시 |
| updated_at | datetime | 수정일시 |

유니크 권장

- `(weekly_report_id, target_year, target_month, revenue_type)`

## 4-12. weekly_additional_revenues

추가 매출 리스트 저장.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| weekly_report_id | bigint fk | 주간 보고 |
| seq_no | int | 화면 순번 |
| contract_external_id | varchar(50) null | 관련 ID |
| company_name | varchar(200) | 회사명 |
| amount_won | bigint | 원 단위 금액 |
| description | varchar(300) | 내용 |
| remarks | varchar(500) null | 비고 |
| created_at | datetime | 생성일시 |
| updated_at | datetime | 수정일시 |

## 4-13. weekly_terminal_metrics

단말기 순증/해지 관련 요약 수치.

엑셀의 `단말기 순증 및 해지`, `경쟁사 단말기 교체 현황`, `해지대기 및 청구보류`, `단말기 해지 유형`을 한 테이블에 metric key 방식으로 저장한다.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| weekly_report_id | bigint fk | 주간 보고 |
| metric_key | varchar(100) | 지표 키 |
| metric_value | decimal(12,2) | 수치 값 |
| metric_text | varchar(500) null | 설명 문구 |
| created_at | datetime | 생성일시 |
| updated_at | datetime | 수정일시 |

권장 metric_key 예시

- `weekly_new_contracts`
- `weekly_terminations`
- `weekly_net_increase`
- `cumulative_new_contracts`
- `cumulative_terminations`
- `cumulative_net_increase`
- `total_active_terminals`
- `replacement_total`
- `replacement_new`
- `replacement_from_competitor`
- `replacement_detail_text`
- `termination_pending`
- `billing_hold`
- `termination_progress_text`
- `termination_type_total`
- `termination_type_contract_end`
- `termination_type_replace`
- `termination_type_detail_text`

## 4-14. weekly_goal_metrics

연간 목표 및 월간 실적 저장.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| weekly_report_id | bigint fk | 주간 보고 |
| target_year | smallint | 연도 |
| target_month | tinyint | 월 |
| net_target_count | int | 월별 순증 목표 |
| target_terminal_count | int | 목표 계약대수 |
| quarter_target_count | int null | 분기 목표 |
| monthly_actual_count | int null | 월간 실적 |
| quarterly_actual_count | int null | 분기 실적 |
| achievement_gap_count | int null | 목표 대비 차이 |
| created_at | datetime | 생성일시 |
| updated_at | datetime | 수정일시 |

유니크 권장

- `(weekly_report_id, target_year, target_month)`

## 4-15. weekly_option_metrics

유료 옵션 건수 저장.

한 옵션에 대해 업종별 건수를 저장하는 구조다.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| weekly_report_id | bigint fk | 주간 보고 |
| option_product_id | bigint fk | 옵션 |
| industry_id | bigint fk | 업종 |
| usage_count | int | 건수 |
| created_at | datetime | 생성일시 |
| updated_at | datetime | 수정일시 |

유니크 권장

- `(weekly_report_id, option_product_id, industry_id)`

## 4-16. weekly_termination_reasons

해지 사유별 현황 저장.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| weekly_report_id | bigint fk | 주간 보고 |
| reason_code | varchar(30) | 해지 사유 |
| weekly_count | int | 주간 건수 |
| cumulative_count | int | 누적 건수 |
| ratio_percent | decimal(5,2) null | 비율 |
| created_at | datetime | 생성일시 |
| updated_at | datetime | 수정일시 |

권장 reason_code 예시

- `CONTRACT_END`
- `COST_REDUCTION`
- `RESIGNATION`
- `REORG`
- `LEAVE_OR_TRIP`
- `MERGER_OR_SALE`
- `LOW_USAGE`
- `COMPETITOR_REPLACEMENT`
- `UNPAID`

## 4-17. weekly_industry_metrics

업종별 실적 저장.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| weekly_report_id | bigint fk | 주간 보고 |
| industry_id | bigint fk | 업종 |
| new_count | int | 신규 |
| net_increase_count | int | 순증 |
| created_at | datetime | 생성일시 |
| updated_at | datetime | 수정일시 |

유니크 권장

- `(weekly_report_id, industry_id)`

## 4-18. weekly_report_snapshots

PDF 생성 또는 보고 확정 시점의 전체 JSON 스냅샷.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| weekly_report_id | bigint fk | 주간 보고 |
| snapshot_version | int | 버전 |
| snapshot_json | json | 보고서 전체 렌더링 데이터 |
| created_by | bigint fk | 생성자 |
| created_at | datetime | 생성일시 |

## 4-19. weekly_report_pdfs

PDF 생성 이력.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| weekly_report_id | bigint fk | 주간 보고 |
| snapshot_id | bigint fk | 스냅샷 |
| file_name | varchar(255) | 파일명 |
| file_path | varchar(500) | 저장경로 |
| generated_by | bigint fk | 생성자 |
| generated_at | datetime | 생성일시 |

## 4-20. validation_rules

검증 규칙 마스터.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| code | varchar(50) unique | 규칙 코드 |
| name | varchar(200) | 규칙명 |
| severity | varchar(20) | `ERROR`, `WARN`, `INFO` |
| is_active | boolean | 활성 여부 |
| description | varchar(500) | 설명 |

예시 규칙

- 원장 신규 건수와 보고서 신규 건수 일치
- 해지 사유 합계와 해지 총계 일치
- 옵션 업종 합계와 옵션 총계 일치
- 권유자 미지정 계약 존재 여부
- 계약서 회수 상태 미입력 존재 여부

## 4-21. validation_results

주간 보고 단위 검증 결과.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| weekly_report_id | bigint fk | 주간 보고 |
| validation_rule_id | bigint fk | 규칙 |
| result_status | varchar(20) | `PASS`, `FAIL`, `SKIP` |
| detail_message | varchar(1000) | 상세 메시지 |
| related_entity_type | varchar(50) null | 관련 엔터티 |
| related_entity_id | bigint null | 관련 ID |
| checked_at | datetime | 검사일시 |

## 4-22. audit_logs

주요 변경 이력 로그.

| 컬럼명 | 타입 | 설명 |
| --- | --- | --- |
| id | bigint pk | PK |
| user_id | bigint fk | 수행 사용자 |
| entity_type | varchar(50) | 대상 테이블 |
| entity_id | bigint | 대상 ID |
| action_type | varchar(30) | `CREATE`, `UPDATE`, `DELETE`, `CONFIRM`, `PDF_EXPORT` |
| payload_json | json null | 변경 데이터 |
| created_at | datetime | 생성일시 |

## 5. 핵심 관계도

관계는 아래처럼 보면 된다.

- `weekly_reports` 1:N `weekly_revenue_items`
- `weekly_reports` 1:N `weekly_report_contracts`
- `weekly_reports` 1:N `weekly_additional_revenues`
- `weekly_reports` 1:N `weekly_terminal_metrics`
- `weekly_reports` 1:N `weekly_goal_metrics`
- `weekly_reports` 1:N `weekly_option_metrics`
- `weekly_reports` 1:N `weekly_termination_reasons`
- `weekly_reports` 1:N `weekly_industry_metrics`
- `weekly_reports` 1:N `validation_results`
- `weekly_reports` 1:N `weekly_report_snapshots`
- `weekly_reports` 1:N `weekly_report_pdfs`
- `contracts` N:1 `industries`
- `contracts` N:1 `referrers`
- `contracts` N:1 `replacement_types`
- `weekly_report_contracts` N:1 `contracts`

## 6. 구현 관점에서 중요한 기준 키

실제 운영상 가장 중요한 식별 기준은 아래 조합이다.

- 계약 원장: `external_id`
- 주간 보고: `(report_year, report_week)` 또는 `base_date`
- 옵션 집계: `(weekly_report_id, option_product_id, industry_id)`
- 업종 실적: `(weekly_report_id, industry_id)`

추천

- 엑셀의 `ID` 컬럼은 가능하면 시스템 내 고유 계약 키처럼 사용
- 계약월은 문자열이 아니라 `date`로 저장

## 7. 추천 저장 방식

DB는 PostgreSQL 기준을 권장한다.

이유

- JSON 스냅샷 저장이 편함
- 집계 쿼리 작성이 유리함
- 향후 검증 로직과 이력 관리 확장성이 좋음

## 8. MVP 범위에서 먼저 만들 테이블

처음부터 모든 테이블을 만들 필요는 없다.

1차 MVP 권장 테이블

- `users`
- `industries`
- `referrers`
- `replacement_types`
- `option_products`
- `contracts`
- `weekly_reports`
- `weekly_report_contracts`
- `weekly_revenue_items`
- `weekly_additional_revenues`
- `weekly_terminal_metrics`
- `weekly_goal_metrics`
- `weekly_option_metrics`
- `weekly_termination_reasons`
- `weekly_industry_metrics`
- `validation_results`
- `weekly_report_pdfs`

## 9. 다음 단계

이 설계 다음으로 바로 이어질 수 있는 작업은 아래다.

1. PostgreSQL용 실제 `CREATE TABLE` SQL 작성
2. 화면별 입력 폼 항목 정의서 작성
3. API 엔드포인트 설계
4. 샘플 화면 프로토타입 구현
