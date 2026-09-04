/**
 * Types for the schema in supabase/migrations. Hand-written rather than
 * generated, because `supabase gen types` needs a linked project and this has
 * to compile before one exists. Regenerate over the top once the project is
 * linked; the shape below follows the generator's conventions so the diff is
 * readable when you do.
 */
export type SportKey =
  | 'running' | 'padel' | 'tenis' | 'futbol' | 'baloncesto' | 'ciclismo'
  | 'escalada' | 'natacion' | 'hyrox' | 'senderismo' | 'yoga' | 'fuerza';
export type PlanStatus = 'open' | 'full' | 'cancelled' | 'completed';
export type JoinStatus = 'joined' | 'waitlist' | 'left' | 'removed' | 'no_show' | 'attended';
export type ThirdHalf = 'cafe' | 'cana' | 'desayuno' | 'comida' | 'ninguno';
export type Audience = 'todos' | 'solo_mujeres';
export type GenderDecl = 'mujer' | 'hombre' | 'no_binario' | 'prefiero_no_decirlo';

export type ProfileRow = {
  id: string;
  dorsal_number: number;
  display_name: string;
  photo_url: string | null;
  birth_year: number;
  gender: GenderDecl | null;
  distrito: string;
  travel_km: number;
  bio: string | null;
  created_at: string;
  last_active_at: string | null;
  is_suspended: boolean;
  is_seed: boolean;
}

/** The only shape of someone else's profile the app may render. */
export type PublicProfileRow = {
  id: string;
  dorsal_number: number;
  display_name: string;
  photo_url: string | null;
  distrito: string;
  bio: string | null;
  created_at: string;
  is_verified: boolean;
}

export type UserSportRow = {
  user_id: string;
  sport: SportKey;
  level_norm: number;
  level_value: Record<string, unknown>;
}

export type VenueRow = {
  id: string;
  slug: string | null;
  name: string;
  kind: 'parque' | 'polideportivo' | 'rocodromo' | 'pista' | 'cafe' | 'otro';
  distrito: string;
  lat: number;
  lng: number;
  is_public: boolean;
  verified: boolean;
  created_by: string | null;
  is_seed: boolean;
  created_at: string;
}

export type PlanRow = {
  id: string;
  host_id: string | null;
  sport: SportKey;
  title: string | null;
  starts_at: string;
  duration_min: number;
  venue_id: string | null;
  meeting_note: string | null;
  distrito: string;
  level_min: number;
  level_max: number;
  level_display: string;
  capacity: number;
  joined_count: number;
  third_half: ThirdHalf;
  third_half_venue_id: string | null;
  audience: Audience;
  min_plans_required: number;
  status: PlanStatus;
  cancelled_reason: string | null;
  /** 'weekly' or null. Constrained to those two by migration 0008. */
  recurring_rule: string | null;
  /** Occurrences of one weekly plan share this. Null for a one-off. */
  series_id: string | null;
  /** When it first reached capacity. Never rewritten — see migration 0008. */
  filled_at: string | null;
  is_seed: boolean;
  created_at: string;
}

export type PlanParticipantRow = {
  plan_id: string;
  user_id: string;
  status: JoinStatus;
  joined_at: string;
  left_at: string | null;
  host_marked: boolean | null;
  self_marked: boolean | null;
}

export type SwipeRow = {
  user_id: string;
  plan_id: string;
  direction: 'right' | 'left';
  created_at: string;
}

export type ReportReason = 'acoso' | 'peligro' | 'no_aparecio' | 'perfil_falso' | 'spam' | 'otro';
export type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export type ReportRow = {
  id: string;
  reporter_id: string | null;
  subject_user: string | null;
  subject_plan: string | null;
  subject_message: string | null;
  reason: ReportReason;
  detail: string | null;
  status: ReportStatus;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export type VerificationRow = {
  user_id: string;
  kind: 'email' | 'phone' | 'selfie';
  status: VerificationStatus;
  selfie_path: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reject_reason: string | null;
};

export type SafetyCheckRow = {
  user_id: string;
  plan_id: string;
  ok: boolean;
  note: string | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  plan_id: string;
  user_id: string | null;
  body: string;
  is_pinned: boolean;
  created_at: string;
};

export type ChatReadRow = {
  user_id: string;
  plan_id: string;
  last_read_at: string;
};

export type BlockRow = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

type Table<Row extends Record<string, unknown>, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      user_sports: Table<UserSportRow>;
      venues: Table<VenueRow>;
      plans: Table<PlanRow>;
      plan_participants: Table<PlanParticipantRow>;
      swipes: Table<SwipeRow>;
      blocks: Table<BlockRow>;
      messages: Table<MessageRow>;
      chat_reads: Table<ChatReadRow>;
      reports: Table<ReportRow>;
      verifications: Table<VerificationRow>;
      safety_checks: Table<SafetyCheckRow>;
    };
    Views: {
      public_profiles: { Row: PublicProfileRow; Relationships: [] };
    };
    Functions: {
      join_plan: { Args: { p_plan: string }; Returns: JoinStatus };
      leave_plan: { Args: { p_plan: string }; Returns: string };
      leave_cost: { Args: { p_plan: string }; Returns: string };
      cancel_plan: { Args: { p_plan: string; p_reason: string }; Returns: undefined };
      can_use_chat: { Args: { p_plan: string }; Returns: boolean };
      chat_is_open: { Args: { p_plan: string }; Returns: boolean };
      chat_closes_at: { Args: { p_plan: string }; Returns: string };
      pin_message: { Args: { p_message: string }; Returns: undefined };
      unpin_message: { Args: { p_plan: string }; Returns: undefined };
      mark_chat_read: { Args: { p_plan: string }; Returns: undefined };
      my_unread_counts: { Args: Record<string, never>; Returns: { plan_id: string; unread: number }[] };
      public_palabra: {
        Args: { p_user: string };
        Returns: { plans: number; attendance_pct: number | null; is_newcomer: boolean }[];
      };
      public_palabra_many: {
        Args: { p_users: string[] };
        Returns: {
          user_id: string; plans: number; attendance_pct: number | null; is_newcomer: boolean;
        }[];
      };
      mark_attendance: { Args: { p_plan: string; p_user: string; p_came: boolean }; Returns: undefined };
      confirm_attendance: { Args: { p_plan: string; p_came: boolean }; Returns: undefined };
      settle_my_overdue_plans: { Args: Record<string, never>; Returns: number };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      block_user: { Args: { p_user: string }; Returns: { plan_id: string }[] };
      leave_plan_safety: { Args: { p_plan: string }; Returns: string };
      record_safety_check: { Args: { p_plan: string; p_ok: boolean; p_note?: string | null }; Returns: undefined };
      moderate: {
        Args: {
          p_action: string; p_reason: string;
          p_user?: string | null; p_plan?: string | null; p_report?: string | null;
        };
        Returns: undefined;
      };
      export_my_data: { Args: Record<string, never>; Returns: Record<string, unknown> };
      delete_my_account: { Args: { p_reason?: string | null }; Returns: undefined };
      fill_metrics: {
        Args: Record<string, never>;
        Returns: {
          plans_created: number;
          plans_filled: number;
          median_hours_to_fill: number | null;
          median_hours_of_notice: number | null;
        }[];
      };
      materialise_my_recurring: { Args: Record<string, never>; Returns: number };
      my_regulars: {
        Args: Record<string, never>;
        Returns: {
          user_id: string; display_name: string; dorsal_number: number; attended: number;
        }[];
      };
      plans_needing_people: { Args: { p_within_hours?: number }; Returns: string[] };
      /** The only function `anon` may call. Migration 0009. */
      public_plan_preview: {
        Args: { p_plan: string };
        Returns: {
          id: string;
          sport: SportKey;
          starts_at: string;
          duration_min: number;
          distrito: string;
          level_display: string;
          capacity: number;
          joined_count: number;
          third_half: ThirdHalf;
          venue_name: string | null;
          host_name: string | null;
        }[];
      };
      complete_onboarding: {
        Args: {
          p_display_name: string;
          p_birth_year: number;
          p_distrito: string;
          p_travel_km: number;
          p_gender: GenderDecl | null;
          p_photo_url: string | null;
          p_sports: { sport: SportKey; level_norm: number; level_value?: Record<string, unknown> }[];
        };
        Returns: ProfileRow;
      };
    };
    Enums: {
      sport_key: SportKey;
      plan_status: PlanStatus;
      join_status: JoinStatus;
      third_half: ThirdHalf;
      audience: Audience;
      gender_decl: GenderDecl;
    };
    CompositeTypes: Record<string, never>;
  };
}
