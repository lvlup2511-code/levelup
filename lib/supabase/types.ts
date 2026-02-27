export type EducationStage = 'primary' | 'preparatory' | 'secondary';

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  xp_points: number;
  coins: number;
  current_streak: number;
  highest_streak?: number;
  quests_completed?: number;
  education_stage: EducationStage | null;
  grade_number: number | null;
  onboarding_completed: boolean;
  last_active_date: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ApiUsage {
  id: number;
  user_id: string;
  usage_date: string;
  request_count: number;
}

export type MissionType =
  | 'ask_questions'
  | 'use_voice'
  | 'upload_image'
  | 'earn_xp'
  | 'login_streak'
  | 'complete_quests';

export interface DailyMission {
  id: number;
  mission_type: MissionType;
  title_ar: string;
  title_en: string;
  description_ar: string | null;
  description_en: string | null;
  target_value: number;
  xp_reward: number;
  coin_reward: number;
  emoji: string;
  difficulty: number;
  is_active: boolean;
}

export interface UserMission {
  id: number;
  user_id: string;
  mission_id: number;
  assigned_date: string;
  current_value: number;
  is_completed: boolean;
  is_claimed: boolean;
  completed_at: string | null;
  created_at: string;
  mission?: DailyMission; // Joined from daily_missions
}

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export interface Friendship {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
  // Optional joins
  requester?: Profile;
  addressee?: Profile;
}

export interface WeeklyXP {
  id: number;
  user_id: string;
  week_start: string;
  xp_earned: number;
  created_at: string;
  updated_at: string;
}
