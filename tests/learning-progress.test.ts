import { describe,expect,it } from 'vitest';
import { skillIds } from '../lib/config';
import { modules } from '../lib/modules';
import { catalogEntries,getCheckpoint,learningJourneys,realLifeCategories,relatedSkills } from '../lib/learning-catalog';
import { cameraCanConfirm,emptyLessonProgress,parseProgress,progressSummary,recordCheckpoint } from '../lib/learning-progress';
import type { CoachFeedback } from '../lib/coaching-contract';

const positive:CoachFeedback={status:'looks_right',confidence:'high',observation:'The wide end is longer.',guidance:'Keep the fabric flat.'};
describe('structured learning checkpoints',()=>{
  it('has meaningful evidence, correction and uncertainty rules for every one of the 63 steps',()=>{
    for(const skill of skillIds)for(let index=0;index<modules[skill].steps.length;index++) {
      const checkpoint=getCheckpoint(skill,index);
      expect(checkpoint.id).toBe(`${skill}-${index+1}`);
      expect(checkpoint.commonMistakes[0].length).toBeGreaterThan(15);
      expect(checkpoint.uncertaintyRules[0].length).toBeGreaterThan(30);
      expect(checkpoint.manualAlternative).toContain(modules[skill].steps[index].check);
      expect(checkpoint.observableEvidence.length>0).toBe(checkpoint.visuallyCheckable);
    }
  });
  it('requires both visible evidence and high confidence before camera advancement',()=>{
    expect(cameraCanConfirm('tie',0,positive)).toBe(true);
    for(const status of ['adjust','unclear','stop','not_verifiable'] as const)expect(cameraCanConfirm('tie',0,{...positive,status})).toBe(false);
    for(const confidence of ['low','medium'] as const)expect(cameraCanConfirm('tie',0,{...positive,confidence})).toBe(false);
    for(const [skill,step] of [['tie',6],['drill',4],['bike',4],['shaving',0],['cooking',2],['cooking',5],['beard',1],['laundry',5]] as const)expect(cameraCanConfirm(skill,step,positive)).toBe(false);
  });
  it('offers six real-life categories and journeys containing only available lessons',()=>{
    expect(realLifeCategories).toHaveLength(6);
    for(const skill of skillIds)expect(catalogEntries[skill].categories.length).toBeGreaterThan(0);
    expect(learningJourneys.find(journey=>journey.id==='first-interview')?.skills).toEqual(['ironing','tie','button']);
    for(const journey of learningJourneys)for(const skill of journey.skills)expect(skillIds).toContain(skill);
    for(const skill of skillIds){expect(relatedSkills(skill)).not.toContain(skill);expect(relatedSkills(skill).length).toBeGreaterThan(0);}
  });
});
describe('local learning records',()=>{
  it('keeps self-checks and unresolved work distinct from camera confirmations',()=>{
    let lesson=emptyLessonProgress('tie');
    lesson=recordCheckpoint(lesson,0,'camera_confirmed');lesson=recordCheckpoint(lesson,1,'self_checked');lesson=recordCheckpoint(lesson,2,'unresolved');
    expect(progressSummary(lesson)).toEqual({camera:1,self:1,unresolved:5});
    const parsed=parseProgress(JSON.stringify({version:1,lessons:{tie:lesson}}));
    expect(parsed.lessons.tie).toEqual(lesson);
    expect(JSON.stringify(parsed)).not.toContain(positive.observation);
  });
  it('ignores corrupted, future-version and structurally invalid storage without throwing',()=>{
    for(const raw of [null,'broken','[]','null',JSON.stringify({version:2,lessons:{tie:emptyLessonProgress('tie')}}),'x'.repeat(20_001)])expect(parseProgress(raw)).toEqual({version:1,lessons:{}});
    for(const patch of [{step:7},{step:-1},{step:1.5},{contentVersion:0},{completed:'true'},{updatedAt:-1},{checkpoints:['camera_confirmed']}]) {
      expect(parseProgress(JSON.stringify({version:1,lessons:{tie:{...emptyLessonProgress('tie'),...patch}}})).lessons.tie).toBeUndefined();
    }
  });
  it('rejects obsolete camera confirmations for nonvisual checkpoints while preserving other lessons',()=>{
    const tie=recordCheckpoint(emptyLessonProgress('tie'),6,'camera_confirmed');
    const bike=recordCheckpoint(emptyLessonProgress('bike'),4,'self_checked');
    const result=parseProgress(JSON.stringify({version:1,lessons:{tie,bike,unknown:{},drill:{...emptyLessonProgress('drill'),step:99}}}));
    expect(result.lessons.tie?.checkpoints[6]).toBe('unresolved');expect(result.lessons.bike).toEqual(bike);expect(result.lessons.drill).toBeUndefined();
  });
  it('recording a retry cannot mutate the previous checkpoint history',()=>{
    const before=recordCheckpoint(emptyLessonProgress('tie'),0,'camera_confirmed');
    const retry=recordCheckpoint(before,0,'unresolved');
    expect(before.checkpoints[0]).toBe('camera_confirmed');expect(retry.checkpoints[0]).toBe('unresolved');
  });
});
