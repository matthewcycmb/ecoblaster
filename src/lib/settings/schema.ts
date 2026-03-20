import { z } from "zod/v4";

export const leaderboardNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(32, "Name must be 32 characters or fewer")
  .regex(/^[a-zA-Z0-9]+$/, "Name must be letters or numbers only");
