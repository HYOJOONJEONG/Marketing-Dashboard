create table users (
  id bigserial primary key,
  login_id varchar(50) not null unique,
  name varchar(100) not null,
  role varchar(30) not null check (role in ('ADMIN', 'EDITOR', 'VIEWER')),
  department_name varchar(100),
  is_active boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table industries (
  id bigserial primary key,
  code varchar(30) not null unique,
  name varchar(100) not null,
  display_order int not null default 0,
  is_active boolean not null default true
);

create table referrers (
  id bigserial primary key,
  name varchar(100) not null unique,
  display_order int not null default 0,
  is_active boolean not null default true
);

create table replacement_types (
  id bigserial primary key,
  code varchar(30) not null unique,
  name varchar(100) not null,
  is_active boolean not null default true
);

create table option_products (
  id bigserial primary key,
  code varchar(30) not null unique,
  name varchar(100) not null,
  display_order int not null default 0,
  is_active boolean not null default true
);

create table report_settings (
  id bigserial primary key,
  setting_key varchar(100) not null unique,
  setting_value text not null,
  updated_by bigint references users(id),
  updated_at timestamp not null default now()
);

create table contracts (
  id bigserial primary key,
  contract_no varchar(50) unique,
  external_id varchar(50) not null,
  company_name varchar(200) not null,
  department_name varchar(200) not null,
  industry_id bigint not null references industries(id),
  contract_month date not null,
  contract_year smallint not null,
  contract_month_no smallint not null check (contract_month_no between 1 and 12),
  document_status varchar(20) not null default 'UNKNOWN' check (document_status in ('RECEIVED', 'NOT_RECEIVED', 'UNKNOWN')),
  referrer_id bigint not null references referrers(id),
  replacement_type_id bigint references replacement_types(id),
  remarks varchar(500),
  include_in_performance boolean not null default true,
  source_type varchar(20) not null default 'MANUAL' check (source_type in ('MANUAL', 'IMPORT')),
  source_file_name varchar(255),
  created_by bigint references users(id),
  updated_by bigint references users(id),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index idx_contracts_month on contracts(contract_year, contract_month_no);
create index idx_contracts_referrer on contracts(referrer_id);
create index idx_contracts_industry on contracts(industry_id);
create index idx_contracts_include_perf on contracts(include_in_performance);
create index idx_contracts_external_id on contracts(external_id);

create table contract_documents (
  id bigserial primary key,
  contract_id bigint not null references contracts(id) on delete cascade,
  document_status varchar(20) not null check (document_status in ('RECEIVED', 'NOT_RECEIVED', 'UNKNOWN')),
  file_name varchar(255),
  file_path varchar(500),
  checked_by bigint references users(id),
  checked_at timestamp,
  notes varchar(500)
);

create table contract_status_history (
  id bigserial primary key,
  contract_id bigint not null references contracts(id) on delete cascade,
  field_name varchar(100) not null,
  old_value text,
  new_value text,
  changed_by bigint references users(id),
  changed_at timestamp not null default now()
);

create table weekly_reports (
  id bigserial primary key,
  report_year smallint not null,
  report_week smallint not null,
  base_date date not null,
  title varchar(200) not null default '주간 실적 보고',
  status varchar(20) not null default 'DRAFT' check (status in ('DRAFT', 'REVIEW', 'CONFIRMED', 'ARCHIVED')),
  is_locked boolean not null default false,
  notes text,
  created_by bigint references users(id),
  updated_by bigint references users(id),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique (report_year, report_week)
);

create table weekly_report_contracts (
  id bigserial primary key,
  weekly_report_id bigint not null references weekly_reports(id) on delete cascade,
  contract_id bigint not null references contracts(id) on delete cascade,
  is_included boolean not null default true,
  selected_by bigint references users(id),
  selected_at timestamp not null default now(),
  notes varchar(300),
  unique (weekly_report_id, contract_id)
);

create table weekly_revenue_items (
  id bigserial primary key,
  weekly_report_id bigint not null references weekly_reports(id) on delete cascade,
  target_year smallint not null,
  target_month smallint not null check (target_month between 1 and 12),
  revenue_type varchar(20) not null check (revenue_type in ('NET_INCREASE', 'PENALTY', 'TRANSFER_FEE')),
  amount_million numeric(12, 2) not null default 0,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique (weekly_report_id, target_year, target_month, revenue_type)
);

create table weekly_additional_revenues (
  id bigserial primary key,
  weekly_report_id bigint not null references weekly_reports(id) on delete cascade,
  seq_no int not null,
  contract_external_id varchar(50),
  company_name varchar(200) not null,
  amount_won bigint not null default 0,
  description varchar(300) not null,
  remarks varchar(500),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table weekly_terminal_metrics (
  id bigserial primary key,
  weekly_report_id bigint not null references weekly_reports(id) on delete cascade,
  metric_key varchar(100) not null,
  metric_value numeric(12, 2),
  metric_text varchar(500),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique (weekly_report_id, metric_key)
);

create table weekly_goal_metrics (
  id bigserial primary key,
  weekly_report_id bigint not null references weekly_reports(id) on delete cascade,
  target_year smallint not null,
  target_month smallint not null check (target_month between 1 and 12),
  net_target_count int not null default 0,
  target_terminal_count int not null default 0,
  quarter_target_count int,
  monthly_actual_count int,
  quarterly_actual_count int,
  achievement_gap_count int,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique (weekly_report_id, target_year, target_month)
);

create table weekly_option_metrics (
  id bigserial primary key,
  weekly_report_id bigint not null references weekly_reports(id) on delete cascade,
  option_product_id bigint not null references option_products(id),
  industry_id bigint not null references industries(id),
  usage_count int not null default 0,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique (weekly_report_id, option_product_id, industry_id)
);

create table weekly_termination_reasons (
  id bigserial primary key,
  weekly_report_id bigint not null references weekly_reports(id) on delete cascade,
  reason_code varchar(30) not null,
  weekly_count int not null default 0,
  cumulative_count int not null default 0,
  ratio_percent numeric(5, 2),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique (weekly_report_id, reason_code)
);

create table weekly_industry_metrics (
  id bigserial primary key,
  weekly_report_id bigint not null references weekly_reports(id) on delete cascade,
  industry_id bigint not null references industries(id),
  new_count int not null default 0,
  net_increase_count int not null default 0,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique (weekly_report_id, industry_id)
);

create table weekly_report_snapshots (
  id bigserial primary key,
  weekly_report_id bigint not null references weekly_reports(id) on delete cascade,
  snapshot_version int not null,
  snapshot_json jsonb not null,
  created_by bigint references users(id),
  created_at timestamp not null default now(),
  unique (weekly_report_id, snapshot_version)
);

create table weekly_report_pdfs (
  id bigserial primary key,
  weekly_report_id bigint not null references weekly_reports(id) on delete cascade,
  snapshot_id bigint references weekly_report_snapshots(id),
  file_name varchar(255) not null,
  file_path varchar(500) not null,
  generated_by bigint references users(id),
  generated_at timestamp not null default now()
);

create table validation_rules (
  id bigserial primary key,
  code varchar(50) not null unique,
  name varchar(200) not null,
  severity varchar(20) not null check (severity in ('ERROR', 'WARN', 'INFO')),
  is_active boolean not null default true,
  description varchar(500)
);

create table validation_results (
  id bigserial primary key,
  weekly_report_id bigint not null references weekly_reports(id) on delete cascade,
  validation_rule_id bigint not null references validation_rules(id),
  result_status varchar(20) not null check (result_status in ('PASS', 'FAIL', 'SKIP')),
  detail_message varchar(1000) not null,
  related_entity_type varchar(50),
  related_entity_id bigint,
  checked_at timestamp not null default now()
);

create table audit_logs (
  id bigserial primary key,
  user_id bigint references users(id),
  entity_type varchar(50) not null,
  entity_id bigint not null,
  action_type varchar(30) not null check (action_type in ('CREATE', 'UPDATE', 'DELETE', 'CONFIRM', 'PDF_EXPORT')),
  payload_json jsonb,
  created_at timestamp not null default now()
);
