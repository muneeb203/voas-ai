import type { WorkspaceRole, Vertical, PlanId } from './constants';

export type { PlanId };

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: PlanId;
  vertical: Vertical;
  status: 'active' | 'suspended' | 'deleted';
  usage_enforcement_disabled?: boolean;
  currency?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
}

export interface WorkspaceMembership {
  workspace_id: string;
  role: WorkspaceRole;
  joined_at: string | null;
  workspace: Workspace;
}

export interface CurrentUserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  memberships: WorkspaceMembership[];
}

export interface DayHours {
  open: string;
  close: string;
}

export type LocationHours = Record<string, DayHours | null>;

export interface Location {
  id: string;
  workspace_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  timezone: string;
  hours: LocationHours | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  email: string | null;
  full_name: string | null;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface InvitationWithUrl extends Invitation {
  url: string;
}

export interface InvitationLookup {
  id: string;
  workspace_id: string;
  workspace_name: string;
  email: string;
  role: WorkspaceRole;
  expires_at: string;
  accepted_at: string | null;
}

export type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'billing' | 'integration' | 'bug' | 'feature_request' | 'other';
export type TicketSenderType = 'user' | 'admin' | 'system';

export interface SupportTicket {
  id: string;
  workspace_id: string;
  created_by: string;
  creator_name: string | null;
  creator_email: string | null;
  assigned_admin_id: string | null;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory | null;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: TicketSenderType;
  sender_id: string;
  sender_name: string | null;
  sender_email: string | null;
  body: string;
  attachments: Array<{ path: string; filename: string; content_type: string; size: number }> | null;
  is_internal_note: boolean;
  created_at: string;
}

export interface SupportTicketWithMessages extends SupportTicket {
  messages: SupportMessage[];
}

// --- V2: conversations / customers / orders / menu ------------------------

export type ConversationChannel = 'voice' | 'whatsapp' | 'chat' | 'sms' | 'kiosk';
export type ConversationStatus = 'active' | 'ended' | 'abandoned' | 'escalated';
export type ConversationOutcome =
  | 'order_placed'
  | 'question_answered'
  | 'booking_made'
  | 'escalated'
  | 'no_resolution';
export type ConversationMessageRole = 'customer' | 'agent' | 'system';

export interface Customer {
  id: string;
  workspace_id: string;
  phone: string | null;
  name: string | null;
  email: string | null;
  total_orders: number;
  total_spent_cents: number;
  first_seen: string;
  last_seen: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: ConversationMessageRole;
  content: string;
  audio_url: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  location_id: string | null;
  customer_id: string | null;
  channel: ConversationChannel;
  customer_phone: string | null;
  customer_name: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: ConversationStatus;
  sentiment: number | null;
  summary: string | null;
  recording_url: string | null;
  outcome: ConversationOutcome | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationDetail extends Conversation {
  messages: ConversationMessage[];
  customer: Customer | null;
  order_id: string | null;
}

export interface CustomerDetail extends Customer {
  recent_orders: Order[];
  recent_conversations: Conversation[];
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'fulfilled'
  | 'cancelled'
  | 'refunded';
export type PaymentStatus = 'unpaid' | 'paid' | 'partial_refund' | 'refunded' | 'failed';

export interface OrderLineModifier {
  name: string;
  price_delta_cents: number;
}

export interface OrderLineItem {
  item_id: string | null;
  name: string;
  quantity: number;
  unit_price_cents: number;
  modifiers: OrderLineModifier[];
  notes: string | null;
}

export interface Order {
  id: string;
  workspace_id: string;
  location_id: string | null;
  conversation_id: string | null;
  customer_id: string | null;
  status: OrderStatus;
  total_cents: number;
  subtotal_cents: number;
  tax_cents: number;
  tip_cents: number;
  items_json: OrderLineItem[];
  customer_phone: string | null;
  customer_name: string | null;
  payment_status: PaymentStatus;
  pos_order_id: string | null;
  order_token: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuModifierOption {
  id: string;
  group_id: string;
  name: string;
  price_delta_cents: number;
  is_default: boolean;
  sort_order: number;
}

export interface MenuModifierGroup {
  id: string;
  item_id: string;
  name: string;
  min_select: number;
  max_select: number;
  required: boolean;
  sort_order: number;
  options: MenuModifierOption[];
}

export interface MenuItem {
  id: string;
  workspace_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  modifier_groups: MenuModifierGroup[];
}

export interface MenuCategory {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  item_count: number;
}

// --- V2 Sprint 2: voice ---------------------------------------------------

export type VoiceLanguage = 'en' | 'ar' | 'ur';

export interface VoiceSettings {
  workspace_id: string;
  vapi_assistant_id: string | null;
  system_prompt: string;
  greeting: string;
  voice: string;
  model: string;
  language: VoiceLanguage;
  end_call_phrases: string[] | null;
  enabled: boolean;
  send_order_confirmations: boolean;
  last_synced_at: string | null;
  sync_status: 'pending' | 'synced' | 'error';
  sync_error: string | null;
  fallback_phone_number: string | null;
  created_at: string;
  updated_at: string;
  menu_dirty: boolean;
  last_menu_update: string | null;
}

export interface LocationVoiceConfigSafe {
  location_id: string;
  workspace_id: string;
  twilio_account_sid: string;
  twilio_auth_token_masked: string;
  twilio_phone_number: string;
  vapi_phone_number_id: string | null;
  enabled: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoiceCapabilities {
  voices: Array<{ id: string; label: string; best_for: VoiceLanguage[] }>;
  models: Array<{ id: string; label: string }>;
  languages: Array<{ id: VoiceLanguage; label: string }>;
  vapi_configured: boolean;
  vapi_public_key: string | null;
}

// --- V2 Sprint 3: WhatsApp -------------------------------------------------

export interface WhatsAppSettings {
  workspace_id: string;
  system_prompt: string;
  greeting: string;
  model: string;
  enabled: boolean;
  session_window_hours: number;
  created_at: string;
  updated_at: string;
}

export interface LocationWhatsAppConfigSafe {
  location_id: string;
  workspace_id: string;
  twilio_account_sid: string;
  twilio_auth_token_masked: string;
  twilio_whatsapp_number: string;
  enabled: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppCapabilities {
  models: Array<{ id: string; label: string }>;
  openai_configured: boolean;
  twilio_configured: boolean;
  sandbox_number: string;
}

// --- Analytics ------------------------------------------------------------

export interface DailyCount {
  date: string;
  count: number;
}

export interface DailyRevenue {
  date: string;
  cents: number;
}

export interface TopItem {
  name: string;
  count: number;
  revenue_cents: number;
}

export interface HourlyCount {
  hour: number;
  count: number;
}

export interface AnalyticsSummary {
  total_conversations: number;
  conversations_by_channel: Record<string, number>;
  conversations_by_status: Record<string, number>;
  conversations_by_outcome: Record<string, number>;
  avg_duration_seconds: number | null;
  avg_sentiment: number | null;
  total_orders: number;
  total_revenue_cents: number;
  avg_order_value_cents: number | null;
  orders_by_status: Record<string, number>;
  total_customers: number;
  new_customers: number;
  returning_customers: number;
  daily_conversations: DailyCount[];
  daily_orders: DailyCount[];
  daily_revenue_cents: DailyRevenue[];
  top_menu_items: TopItem[];
  conversations_by_hour: HourlyCount[];
}

export interface TodayStats {
  conversations_today: number;
  orders_today: number;
  revenue_today_cents: number;
  avg_sentiment_today: number | null;
}

export interface HelpChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface HelpChatReply {
  reply: string;
}

export type NotificationType =
  | 'order_placed'
  | 'product_update'
  | 'usage_limit'
  | 'ticket_reply'
  | 'ticket_resolved'
  | 'kiosk_low'
  | 'appointment_booked'
  | 'admin_signup'
  | 'admin_error'
  | 'admin_ticket'
  | 'admin_limit';

export interface Notification {
  id: string;
  user_id: string;
  workspace_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  resource_type: string | null;
  resource_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationList {
  items: Notification[];
  unread_count: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  link: string | null;
  created_by_admin_id: string | null;
  published_at: string;
  created_at: string;
}

export interface UsageMetric {
  used: number;
  plan_limit: number | null;
  bonus_remaining: number;
  effective_limit: number | null;
  percent_used: number | null;
}

export interface TokenUsage {
  openai_tokens: number;
  gemini_tokens: number;
  total_tokens: number;
}

export interface BillingPeriod {
  start: string;
  end: string;
  days_remaining: number;
}

export interface BillingPlan {
  slug: PlanId;
  name: string;
  price_cents_monthly: number;
  voice_minutes_limit: number | null;
  whatsapp_messages_limit: number | null;
  help_bot_turns_limit: number | null;
  allowed_channels: string[];
}

export interface UsageSummary {
  plan: BillingPlan;
  period: BillingPeriod;
  voice_minutes: UsageMetric;
  whatsapp_messages: UsageMetric;
  help_bot_turns: UsageMetric;
  tokens: TokenUsage;
  usage_enforcement_disabled: boolean;
  enforcement_active: boolean;
  /** True when the workspace was auto-granted a free trial on signup. */
  has_trial_grant: boolean;
}

export type CreditType = 'voice_minutes' | 'whatsapp_messages' | 'help_bot_turns';

export interface CreditGrant {
  id: string;
  workspace_id: string;
  credit_type: CreditType;
  amount_total: number;
  amount_remaining: number;
  reason: string | null;
  granted_by_admin_id: string | null;
  created_at: string;
}

export interface AdminWorkspaceUsageRow {
  workspace_id: string;
  workspace_name: string;
  plan: PlanId;
  status: string;
  voice_used: number;
  voice_limit: number | null;
  whatsapp_used: number;
  whatsapp_limit: number | null;
  help_used: number;
  help_limit: number | null;
  total_tokens: number;
  usage_enforcement_disabled: boolean;
  period_end: string;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  message: string;
  source: string | null;
  status: 'new' | 'contacted' | 'qualified' | 'closed';
  created_at: string;
}

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function isApiError<T>(res: ApiResponse<T>): res is ApiError {
  return 'error' in res;
}
