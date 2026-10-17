import { skillIds, type SkillId } from './config';
import { modules } from './modules';

export const realLifeCategories = ['Personal Care', 'Clothing & Appearance', 'Independent Living', 'DIY & Repairs', 'Hobbies & Creativity', 'Everyday Preparedness'] as const;
export type RealLifeCategory = typeof realLifeCategories[number];
export const catalogEntries: Record<SkillId, { categories: readonly RealLifeCategory[]; keywords: string; prerequisite: string; safety: string }> = {
  tie: {categories:['Clothing & Appearance'],keywords:'interview job formal knot necktie',prerequisite:'A necktie and a mirror; no previous knot experience needed.',safety:'Keep the neck loop loose and comfortable. Stop and loosen it if it feels tight.'},
  shaving: {categories:['Personal Care'],keywords:'razor face grooming wet shave',prerequisite:'Your own clean manual razor and suitable shaving product.',safety:'Use light strokes with hair growth. Avoid irritated skin and stop if it hurts or pulls.'},
  beard: {categories:['Personal Care'],keywords:'trimmer grooming facial hair',prerequisite:'A guarded trimmer, its manual, and a clean, dry beard.',safety:'Fit the guard with power off. Keep a longer length while learning; stop for discomfort.'},
  ironing: {categories:['Clothing & Appearance'],keywords:'shirt interview creases heat',prerequisite:'A shirt whose care label permits ironing, and the iron manual.',safety:'Follow the care label. Keep hands away from the soleplate and unplug after use.'},
  button: {categories:['Clothing & Appearance','Hobbies & Creativity'],keywords:'sew sewing mend needle thread repair shirt',prerequisite:'A flat four-hole button, needle, thread and garment.',safety:'Keep fingers clear of the needle and store the needle and scissors safely afterward.'},
  drill: {categories:['DIY & Repairs'],keywords:'wood tools hole repair bench',prerequisite:'Scrap wood, clamps, eye protection and the drill manual. Have an experienced person help if this is your first time.',safety:'Scrap wood only. No walls, masonry or hidden services. Disconnect power for adjustments; the camera cannot certify a safe setup.'},
  laundry: {categories:['Independent Living'],keywords:'wash clothes detergent clean drying machine',prerequisite:'Machine-washable clothes with readable care labels and the machine manual.',safety:'Follow every care label and detergent instructions. Keep detergent out of reach of children.'},
  cooking: {categories:['Independent Living','Hobbies & Creativity'],keywords:'food couscous chickpea vegetables meal kitchen',prerequisite:'Instant couscous prepared with boiling water and ready-to-eat canned chickpeas. Read ingredient labels for allergies.',safety:'Use care with knives, hot water and steam. Camera images cannot verify hygiene, temperature or food safety.'},
  bike: {categories:['Everyday Preparedness'],keywords:'bicycle tires tyre pump brakes chain commute maintenance',prerequisite:'Your bike, a compatible pump with gauge, and the bike and tire guidance.',safety:'Do not ride with uncertain brakes, loose parts or damaged tires. Ask a bike shop; the camera cannot certify the bike is safe.'}
};
export const learningJourneys: readonly {id:string;title:string;description:string;skills:readonly SkillId[]}[] = [
  {id:'first-interview',title:'Ready for your first interview',description:'Prepare a shirt, tie and those little clothing repairs.',skills:['ironing','tie','button']},
  {id:'living-independently',title:'A little more independent',description:'Build a routine for clean clothes and a simple meal.',skills:['laundry','cooking']},
  {id:'personal-routine',title:'Find your grooming routine',description:'Practice a gentle shave or a controlled beard trim.',skills:['shaving','beard']},
  {id:'care-and-repair',title:'Care for what you own',description:'Try a small repair, a scrap-wood practice task and a pre-ride check.',skills:['button','drill','bike']}
];

// Every entry describes only the visible evidence, not a certification of the full task.
// Null entries require the learner's written check and cannot advance automatically.
const evidence: Record<SkillId, readonly (string|null)[]> = {
  tie:['Both ends are in view, lie flat, and the wide end hangs below the narrow end.','The wide end visibly crosses in front of the narrow end.','The wide end emerges from behind the narrow end on the other side.','A flat band crosses the front with its opening visible.','The wide end emerges upward through the neck loop.','The wide end passes down through the front band.',null],
  shaving:[null,null,'An even, visible layer of shaving cream covers the intended area.',null,null,null,null],
  beard:[null,null,null,null,'The visible outer shape and length appear balanced across both sides.','The visible edges have no obvious long stray hairs.',null],
  ironing:[null,null,'The collar is laid flat and its visible creases have been reduced.','The cuffs are open and flat with visible creases reduced.','The visible sleeve is laid flat without an obvious new fold.','The shirt front and back shown are visibly smoother.',null],
  button:['The four-hole button aligns with the garment buttonhole and neighboring buttons.','Thread is visible through the needle eye and the joined ends show a knot.','The thread emerges through the first hole and its anchor knot is visible on the reverse.','Stitches visibly join the first diagonal pair of holes.','The thread forms an X joining both diagonal pairs of holes.',null,null],
  drill:[null,null,null,null,null,null,null],
  laundry:[null,null,null,'The drum opening and clothes are visible with unfilled space; the load is not visibly packed tightly.',null,null,null],
  cooking:[null,null,null,null,'Chopped vegetables and prepared chickpeas are visible beside or in the bowl.',null,null],
  bike:[null,null,null,null,null,null,null]
};
const mistakes: Record<SkillId, readonly string[]> = {
  tie:['Starting with the narrow end longer or twisted fabric.','Crossing the narrow end over the wide end.','Passing across the front again instead of behind.','Closing the front opening or twisting the band.','Pulling the wide end down outside the neck loop.','Passing behind the front band instead of through its opening.','Tightening until uncomfortable or leaving the length unsuitable.'],
  shaving:['Using a shared, dull or damaged razor.','Shaving dry or irritated skin.','Leaving visible uncovered patches or letting cream dry out.','Pressing hard, moving sideways, or shaving against growth.','Repeated passes without reapplying cream.','Rubbing freshly shaved skin.','Wiping the blade with fingers or a towel.'],
  beard:['Judging length while hair is wet.','Pulling the comb through a tangle.','Starting with too short a guard or fitting it while powered.','Removing too much in the first pass.','Continuing on one side without comparing the other.','Rushing close edging or changing the shape too much.','Cleaning while powered or rinsing nonwashable parts.'],
  ironing:['Guessing the heat when the care label is unclear.','An unstable board or a trailing cord.','Pressing a folded collar or leaving the iron still.','Ironing over buttons or folded cuffs.','Pressing an unintended fold into the sleeve.','Ironing over buttons or trapped fabric folds.','Handling or storing the iron before it cools.'],
  button:['Placing the button out of line with the buttonhole.','Using very long thread or forgetting the end knot.','Anchoring through an unintended garment layer.','Using neighboring holes instead of diagonal partners.','Missing a pair of holes or tangling the visible X.','Leaving the thread unsecured or sewing through another layer.','Cutting too close to the knot or leaving the needle out.'],
  drill:['Practicing on a wall or an unknown material.','Holding the workpiece by hand instead of clamping it.','Changing the bit while powered or leaving the chuck key in.','Loose clothes, jewelry or missing eye protection.','Hands under the workpiece or the wood shifting.','Touching a rotating or hot bit.','Clearing chips with bare hands or leaving power connected.'],
  laundry:['Mixing incompatible care labels or colors.','Guessing detergent dose or using too much.','Leaving tissues, coins or open zips.','Packing the drum tightly.','Selecting a temperature forbidden by an item label.','Using a dryer when the label forbids it.','Storing damp clothes or neglecting the lint filter.'],
  cooking:['Ignoring allergy information or using a different couscous type.','Using an unclean board or putting hot items near the edge.','Guessing the water ratio instead of following the packet.','Lifting toward steam or missing the packet resting time.','Cutting with exposed fingertips or leaving toppings unprepared.','Assuming food is ready from appearance alone.','Leaving cooked leftovers at room temperature for hours.'],
  bike:['Ignoring tire damage or guessing pressure limits.','Forcing an incompatible pump fitting.','Exceeding tire or rim pressure limits.','Riding with uncertain wheel fastenings.','Riding when either brake fails its standing test.','Turning pedals while fingers are near gears.','Riding despite loose, damaged or uncertain parts.']
};
export type LearningCheckpoint = {
  id:string; visuallyCheckable:boolean; observableEvidence:string[]; commonMistakes:string[];
  uncertaintyRules:string[]; manualAlternative:string;
};
export function getCheckpoint(skill:SkillId, step:number):LearningCheckpoint {
  const current=modules[skill].steps[step];
  if(!current) throw new RangeError('Unknown lesson checkpoint');
  const visible=evidence[skill][step];
  return {
    id:`${skill}-${step+1}`, visuallyCheckable:Boolean(visible),
    observableEvidence:visible?[visible]:[], commonMistakes:[mistakes[skill][step]],
    uncertaintyRules:visible?[
      'Return uncertain when the relevant object, crossing, edge or result is obscured, blurred, too small or outside the frame.',
      'A still image cannot establish pressure, comfort, temperature, cleanliness, hidden fasteners, product compatibility or safety. Confirm only the listed visible evidence.'
    ]:['This checkpoint depends on information or physical checks that camera images cannot establish. Offer the written self-check and do not confirm or advance it.'],
    manualAlternative:`Check for yourself: ${current.check} ${current.tip}`
  };
}
export function relatedSkills(skill:SkillId):SkillId[] {
  const journey=learningJourneys.find(item=>item.skills.includes(skill));
  const sameCategory=skillIds.filter(item=>item!==skill && catalogEntries[item].categories.some(category=>catalogEntries[skill].categories.includes(category)));
  return [...new Set([...(journey?.skills.filter(item=>item!==skill)??[]),...sameCategory])].slice(0,3);
}
