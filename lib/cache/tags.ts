/**
 * Next.js cache tags for revalidation
 */
export const CACHE_TAGS = {
  TASKS: "tasks",
  DASHBOARD: "dashboard",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
