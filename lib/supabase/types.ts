export type EducationStage = 'primary' | 'preparatory' | 'secondary';
export type AcademicTrack = 'scientific' | 'literary' | 'general';
export type ThinkingCategory = 'logical_analysis' | 'deduction' | 'critique' | 'problem_solving';

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
  // Cognitive Gamification
  cognitive_level: number;
  academic_track: AcademicTrack | null;
  cognitive_xp: number;
  created_at?: string;
  updated_at?: string;
}

export interface Badge {
  id: number;
  name: string;
  title_en: string;
  title_ar: string;
  description_en: string | null;
  description_ar: string | null;
  emoji: string;
  category: string;
  xp_threshold: number | null;
  created_at: string;
}

export interface UserBadge {
  user_id: string;
  badge_id: number;
  earned_at: string;
  badge?: Badge; // Joined from badges
}

export interface WeeklyChallenge {
  id: number;
  title: string;
  description: string | null;
  category: string;
  difficulty_level: number;
  xp_reward: number;
  week_start: string;
  is_active: boolean;
  created_at: string;
}

export interface ChallengeParticipant {
  id: number;
  challenge_id: number;
  user_id: string;
  score: number;
  completed: boolean;
  joined_at: string;
  challenge?: WeeklyChallenge; // Joined from weekly_challenges
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

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'direct_message'
  | 'mission_completed'
  | 'level_up'
  | 'system';

export interface Notification {
  id: number;
  user_id: string;
  type: NotificationType;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface DirectMessage {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface StudyMaterial {
  id: string;
  user_id: string;
  title: string;
  content: string;
  notebook_id?: string | null;
  created_at: string;
}

