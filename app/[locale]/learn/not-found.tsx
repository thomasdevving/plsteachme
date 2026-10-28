import Link from 'next/link';
import { LearningShell } from '@/components/learning-shell';

export default function LessonNotFound(){
  return <LearningShell><div className="missing-page container"><h1>Lost your way?</h1><p>This lesson is not available. Choose another skill from your learning library.</p><Link className="button primary" href="/learn">All lessons</Link></div></LearningShell>;
}
