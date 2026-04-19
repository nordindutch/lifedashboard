export type UnixTimestamp = number;
export type DateString = string; // YYYY-MM-DD
export type Priority = 1 | 2 | 3 | 4;
export type GoalStatus = 'active' | 'completed' | 'paused' | 'archived';
export type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'archived';
export type TaskStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'in_review'
  | 'done'
  | 'cancelled';
export type LogType = 'activity' | 'reflection' | 'win' | 'blocker' | 'idea' | 'mood';
export type PlanType = 'morning' | 'evening' | 'weekly' | 'adhoc';
export type NoteFormat = 'markdown' | 'plain' | 'html';
export type BudgetCategory =
  | 'Vaste Last'
  | 'Abonnement'
  | 'Tijdelijke Last'
  | 'Persoonlijk'
  | 'Politiek/Vakbond'
  | 'Overig';

export const BUDGET_CATEGORIES: BudgetCategory[] = [
  'Vaste Last',
  'Abonnement',
  'Tijdelijke Last',
  'Persoonlijk',
  'Politiek/Vakbond',
  'Overig',
];

export const CATEGORY_COLORS: Record<BudgetCategory, string> = {
  'Vaste Last': '#3b82f6',
  Abonnement: '#f59e0b',
  'Tijdelijke Last': '#ef4444',
  Persoonlijk: '#10b981',
  'Politiek/Vakbond': '#8b5cf6',
  Overig: '#71717a',
};

export interface Goal {
  id: number;
  title: string;
  description: string | null;
  color: string;
  icon: string | null;
  status: GoalStatus;
  target_date: UnixTimestamp | null;
  completed_at: UnixTimestamp | null;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
  deleted_at: UnixTimestamp | null;
}
export interface GoalWithRelations extends Goal {
  projects: Project[];
  notes: Note[];
  progress?: number;
}

export interface Project {
  id: number;
  goal_id: number | null;
  title: string;
  description: string | null;
  color: string;
  icon: string | null;
  status: ProjectStatus;
  priority: Priority;
  target_date: UnixTimestamp | null;
  completed_at: UnixTimestamp | null;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
  deleted_at: UnixTimestamp | null;
}
export interface ProjectWithRelations extends Project {
  goal?: Goal;
  tasks: Task[];
  notes: Note[];
  task_counts: { total: number; completed: number; in_progress: number };
}

export interface CanvasPosition {
  canvas_x: number;
  canvas_y: number;
  canvas_width: number;
  canvas_color: string;
  canvas_pinned: boolean;
}

export interface Task extends Partial<CanvasPosition> {
  id: number;
  project_id: number | null;
  project_color: string | null;
  project_title: string | null;
  goal_id: number | null;
  parent_task_id: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  display_order: number;
  estimated_mins: number | null;
  actual_mins: number | null;
  due_date: UnixTimestamp | null;
  completed_at: UnixTimestamp | null;
  recurrence_rule: string | null;
  recurrence_parent_id: number | null;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
  deleted_at: UnixTimestamp | null;
}
export interface TaskWithRelations extends Task {
  project?: Project;
  goal?: Goal;
  parent_task?: Task;
  subtasks: Task[];
  labels: Label[];
  notes: Note[];
  dependencies: Task[];
}

export interface Label {
  id: number;
  name: string;
  color: string;
}

export interface Note {
  id: number;
  goal_id: number | null;
  project_id: number | null;
  task_id: number | null;
  title: string | null;
  body: string;
  body_format: NoteFormat;
  is_pinned: boolean;
  labels: Label[];
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
  deleted_at: UnixTimestamp | null;
}

export interface DiaryLog {
  id: number;
  goal_id: number | null;
  project_id: number | null;
  task_id: number | null;
  log_type: LogType;
  body: string;
  mood_score: number | null;
  energy_score: number | null;
  duration_mins: number | null;
  logged_at: UnixTimestamp;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
  deleted_at: UnixTimestamp | null;
}

export interface ScheduleBlock {
  start_time: string;
  end_time: string;
  task_id: number | null;
  task_title: string;
  notes: string;
  is_break: boolean;
}
export interface AISuggestedTaskMod {
  task_id: number;
  action: 'defer' | 'reschedule' | 'prioritize' | 'split' | 'delegate' | 'drop';
  reason: string;
  suggested_due_date?: UnixTimestamp;
}
export interface AIPlan {
  id: number;
  plan_date: DateString;
  plan_type: PlanType;
  tasks_snapshot: number[];
  logs_snapshot: number[];
  weather_context: WeatherData | null;
  calendar_context: CalendarEvent[] | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  model_used: string;
  raw_response: string | null;
  parsed_schedule: ScheduleBlock[] | null;
  reflection: string | null;
  suggested_tasks: AISuggestedTaskMod[] | null;
  score: number | null;
  created_at: UnixTimestamp;
}

export interface EveningPlanContent {
  reflection: string;
  close_prompt: string;
}

export interface DailySnapshot {
  id: number;
  snapshot_date: DateString;
  tasks_planned: number;
  tasks_completed: number;
  tasks_added: number;
  tasks_deferred: number;
  total_estimated_mins: number;
  total_actual_mins: number;
  log_count: number;
  avg_mood_score: number | null;
  avg_energy_score: number | null;
  unread_emails: number | null;
  calendar_events: number | null;
  ai_plan_id: number | null;
  diary_streak?: number;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
}

export interface BudgetMonth {
  id: number;
  month: string;
  current_balance: number;
  /** When set, `current_balance` follows this betaalrekening’s balance. */
  current_balance_account_id?: number | null;
  minimum_balance: number;
  notes: string | null;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
}

export interface BudgetIncomeRow {
  id: number;
  month_id: number;
  name: string;
  amount: number;
  received: boolean;
  sort_order: number;
}

export interface BudgetExpenseRow {
  id: number;
  month_id: number;
  name: string;
  amount: number;
  category: BudgetCategory;
  paid: boolean;
  sort_order: number;
}

export interface BudgetSummary {
  total_income: number;
  total_expenses: number;
  received: number;
  paid: number;
  pending_income: number;
  pending_expenses: number;
  projected_balance: number;
  by_category: { category: BudgetCategory; amount: number }[];
}

export interface BudgetMonthPayload {
  month: BudgetMonth;
  income: BudgetIncomeRow[];
  expenses: BudgetExpenseRow[];
  summary: BudgetSummary;
}

export interface BudgetLineSeriesPoint {
  month: string;
  total_income: number;
  total_expenses: number;
  net: number;
  balance_trajectory: number;
  projected: boolean;
}

export interface BudgetProjectionPoint {
  month: string;
  balance_trajectory: number;
  avg_net_assumption: number;
  projected: boolean;
}

export type BudgetTrendDirection = 'drifting' | 'stable' | 'growing';

export interface BudgetAnalyticsPayload {
  month_keys: string[];
  line_series: BudgetLineSeriesPoint[];
  projection: BudgetProjectionPoint[];
  trend: {
    direction: BudgetTrendDirection;
    slope_euros_per_month: number;
    label_nl: string;
  };
  runway: {
    liquid_total: number;
    avg_monthly_expenses_3m: number;
    months: number | null;
  };
  savings_rate: { month: string; rate_pct: number | null }[];
  category_by_month: {
    month: string;
    by_category: Record<BudgetCategory, number>;
  }[];
}

export interface BudgetInsightsPayload {
  text: string;
  generated_at: number;
}

export type AccountKind = 'checking' | 'savings' | 'cash' | 'investment' | 'other';

export const ACCOUNT_KINDS: { value: AccountKind; label: string }[] = [
  { value: 'checking', label: 'Betaalrekening' },
  { value: 'savings', label: 'Spaarrekening' },
  { value: 'cash', label: 'Contant' },
  { value: 'investment', label: 'Beleggen' },
  { value: 'other', label: 'Overig' },
];

export interface Account {
  id: number;
  name: string;
  kind: AccountKind;
  balance: number;
  sort_order: number;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
}

export interface AccountsPayload {
  items: Account[];
  total: number;
}

export interface Debt {
  id: number;
  name: string;
  /** Original / total debt amount */
  amount: number;
  /** Cumulative amount paid (including partial payments) */
  paid_amount: number;
  /** Outstanding balance: amount - paid_amount (server-computed) */
  remaining: number;
  deadline: UnixTimestamp | null;
  paid: boolean;
  notes: string | null;
  sort_order: number;
  created_at: UnixTimestamp;
  updated_at: UnixTimestamp;
}

export interface DebtsPayload {
  items: Debt[];
  outstanding: number;
}

export interface WeatherData {
  city: string;
  country: string;
  temp_c: number;
  feels_like_c: number;
  humidity: number;
  wind_speed_ms: number;
  conditions: { id: number; main: string; description: string; icon: string }[];
  sunrise: UnixTimestamp;
  sunset: UnixTimestamp;
  fetched_at: UnixTimestamp;
}

export interface CalendarEvent {
  id: number;
  external_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: UnixTimestamp;
  end_at: UnixTimestamp;
  is_all_day: boolean;
  calendar_name: string | null;
  color: string | null;
  meet_link: string | null;
  fetched_at: UnixTimestamp;
}

export interface EmailSummary {
  id: number;
  external_id: string;
  thread_id: string | null;
  subject: string | null;
  sender_name: string | null;
  sender_email: string | null;
  snippet: string | null;
  is_unread: boolean;
  has_attachment: boolean;
  received_at: UnixTimestamp;
  fetched_at: UnixTimestamp;
}

export interface DailyBriefing {
  date: DateString;
  weather: WeatherData | null;
  events: CalendarEvent[];
  emails: EmailSummary[];
  tasks_today: Task[];
  tasks_overdue: Task[];
  /** Open tasks on the board not already listed under overdue / due today */
  tasks_active: Task[];
  recent_logs: DiaryLog[];
  ai_plan: AIPlan | null;
  evening_plan: AIPlan | null;
  snapshot: DailySnapshot | null;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: { total?: number; page?: number; per_page?: number };
}
export interface ApiError {
  success: false;
  error: { code: string; message: string; field?: string };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface AppSettings {
  app_name: string;
  timezone: string;
  theme: 'dark' | 'light' | 'system';
  openweather_api_key: string;
  openweather_lat: string;
  openweather_lon: string;
  anthropic_api_key: string;
  google_client_id: string;
  google_client_secret: string;
  ai_morning_plan_enabled: boolean;
  ai_evening_plan_enabled: boolean;
  work_start_hour: number;
  work_end_hour: number;
  kanban_columns: TaskStatus[];
}
