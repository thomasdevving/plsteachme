import { z } from 'zod';
import { skillIds } from './config';
import { feedbackSchema } from './coaching-contract';

const publishedReferenceSchema=z.object({id:z.uuid(),version:z.number().int().positive()}).strict();
const builtInContext={skill:z.enum(skillIds),step:z.number().int().min(0).max(6)};
const publishedContext={publishedLesson:publishedReferenceSchema,step:z.number().int().min(0).max(19)};
const questionFields={question:z.string().trim().min(3).max(600),consent:z.literal(true),over16:z.literal(true)};
export const questionSchema = z.union([
  z.object({...builtInContext,...questionFields}).strict(),
  z.object({...publishedContext,...questionFields}).strict()
]);
export const answerSchema = z.object({
  answer:z.string().trim().min(1).max(1400),
  reminder:z.string().trim().min(1).max(350)
}).strict();
const reportFields={feedback:feedbackSchema,reason:z.string().trim().min(10).max(1000),consent:z.literal(true)};
export const reportSchema = z.union([
  z.object({...builtInContext,...reportFields}).strict(),
  z.object({...publishedContext,...reportFields}).strict()
]);
export type PublishedHelpReference=z.infer<typeof publishedReferenceSchema>;
export type LessonHelpContext={skill:typeof skillIds[number];step:number}|{publishedLesson:PublishedHelpReference;step:number};
