import { expect, it } from 'vitest';
import { recommendedSkills } from '../lib/learning-catalog';
import { emptyLessonProgress } from '../lib/learning-progress';
import { skillIds } from '../lib/config';
it('shows starter choices without claiming they are personal recommendations', () => {
  expect(recommendedSkills({version:1,lessons:{}})).toEqual(['tie','laundry','button']);
});
it('ranks related unstarted skills and excludes previously practiced ones', () => {
  const result = recommendedSkills({version:1,lessons:{tie:{...emptyLessonProgress('tie'),updatedAt:10,completed:true}}});
  expect(result.slice(0,2)).toEqual(['ironing','button']); expect(result).not.toContain('tie');
});
it('does not recommend completed skills when the whole catalog has been practiced', () => {
  expect(recommendedSkills({version:1,lessons:Object.fromEntries(skillIds.map(skill=>[skill,{...emptyLessonProgress(skill),updatedAt:10,completed:true}]))})).toEqual([]);
});
