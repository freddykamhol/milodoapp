import type {blogPosts} from "@/db/schema";
export type InitialBlogPost=Pick<typeof blogPosts.$inferSelect,"id"|"status"|"title"|"category"|"slug"|"excerpt"|"contentMd"|"contentBlocksJson"|"titleImageKey">;
