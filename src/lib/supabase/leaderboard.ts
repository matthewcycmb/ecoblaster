import { getSupabase } from "./client";

export interface LeaderboardEntry {
  id: string;
  player_name: string;
  score: number;
  created_at: string;
}

// ─── Validation ───

const NAME_REGEX = /^[a-zA-Z0-9]{1,32}$/;
const MAX_REASONABLE_SCORE = 10_000_000;
const SUBMIT_COOLDOWN_MS = 10_000; // 10 seconds between submissions
let lastSubmitTime = 0;

function isValidEntry(entry: unknown): entry is LeaderboardEntry {
  if (!entry || typeof entry !== "object") return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.player_name === "string" &&
    NAME_REGEX.test(e.player_name) &&
    typeof e.score === "number" &&
    e.score >= 0 &&
    e.score <= MAX_REASONABLE_SCORE &&
    typeof e.created_at === "string"
  );
}

// ─── localStorage fallback ───

const LOCAL_LEADERBOARD_KEY = "zombie-flick-leaderboard";

function getLocalScores(): LeaderboardEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry).slice(0, 50);
  } catch {
    return [];
  }
}

function saveLocalScore(name: string, score: number): void {
  if (typeof window === "undefined") return;
  try {
    const entries = getLocalScores();
    entries.push({
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      player_name: name,
      score,
      created_at: new Date().toISOString(),
    });
    entries.sort((a, b) => b.score - a.score);
    localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(entries.slice(0, 50)));
  } catch {
    // silently fail
  }
}

// ─── Public API ───

export async function submitScore(
  name: string,
  score: number
): Promise<{ success: boolean; error?: string }> {
  // Validate inputs
  if (!NAME_REGEX.test(name)) {
    return { success: false, error: "Invalid name" };
  }
  if (score < 0 || score > MAX_REASONABLE_SCORE || !Number.isFinite(score)) {
    return { success: false, error: "Invalid score" };
  }

  // Client-side rate limiting
  const now = Date.now();
  if (now - lastSubmitTime < SUBMIT_COOLDOWN_MS) {
    return { success: false, error: "Please wait before submitting again" };
  }
  lastSubmitTime = now;

  const supabase = getSupabase();
  if (!supabase) {
    saveLocalScore(name, score);
    return { success: true };
  }

  const { error } = await supabase
    .from("leaderboard_entry")
    .insert({ player_name: name, score });

  if (error) {
    saveLocalScore(name, score);
    return { success: true };
  }

  return { success: true };
}

export async function getTopScores(
  limit = 10
): Promise<LeaderboardEntry[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return getLocalScores().slice(0, limit);
  }

  const { data, error } = await supabase
    .from("leaderboard_entry")
    .select("id, player_name, score, created_at")
    .order("score", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return getLocalScores().slice(0, limit);
  }
  return data as LeaderboardEntry[];
}

export function isLeaderboardAvailable(): boolean {
  return true;
}
