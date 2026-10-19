import type { personalQuestionnaires, personalQuestionnaireFiles } from "@/db/schema";
export type QuestionnaireWithFiles = typeof personalQuestionnaires.$inferSelect & { files: (typeof personalQuestionnaireFiles.$inferSelect)[] };
