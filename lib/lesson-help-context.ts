import 'server-only';
import { modules } from './modules';
import { getCheckpoint } from './learning-catalog';
import type { LessonHelpContext } from './lesson-help';

export class LessonHelpError extends Error {
  constructor(public status:number,public code:string){super(code);}
}

export async function resolveLessonHelp(context:LessonHelpContext) {
  if('skill' in context) {
    const {skill,step}=context;
    return {
      identity:{skill,step},reportTarget:{skill},
      lesson:{skill,intro:modules[skill].intro,materials:modules[skill].materials,current:modules[skill].steps[step],checkpoint:getCheckpoint(skill,step)}
    };
  }
  // The client sends a reference only. Drafts, arbitrary instructions, and earlier
  // versions never replace the currently published, independently reviewed content.
  try {
    const platform=await import('./platform-server');
    let published;
    try {published=await platform.publishedLesson(platform.platformDb(),context.publishedLesson.id);}
    catch(error) {
      if(error instanceof platform.PlatformError && error.status===404)throw new LessonHelpError(404,'not_found');
      throw new LessonHelpError(503,'storage');
    }
    if(published.version!==context.publishedLesson.version)throw new LessonHelpError(409,'version');
    const current=published.document.steps[context.step];
    if(!current)throw new LessonHelpError(400,'validation');
    return {
      identity:{publishedLesson:{id:published.id,version:published.version},step:context.step},
      reportTarget:{skill:'published',lesson_id:published.id,lesson_version:published.version},
      lesson:{id:published.id,version:published.version,title:published.document.title,intro:published.document.objective,materials:published.document.materials,safety:published.document.safety,prerequisites:published.document.prerequisites,current}
    };
  }catch(error) {
    if(error instanceof LessonHelpError)throw error;
    throw new LessonHelpError(503,'storage');
  }
}
