export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  xp_points: number;
  current_streak: number;
  highest_streak?: number;
  quests_completed?: number;
  created_at?: string;
  updated_at?: string;
}
