import type { SkillId } from './config';
export const categories = ['All skills', 'Everyday', 'Personal care', 'Make & mend'] as const;
export type Category = typeof categories[number];
type Lesson = { category: Exclude<Category, 'All skills'>; steps: [string, string, string]; tip: string };
export const modules: Record<SkillId, Lesson> = {
  tie: { category:'Everyday', steps:['Start with the wide end longer than the narrow end.', 'Cross the wide end over the narrow end.', 'Bring the wide end behind the narrow end.'], tip:'Keep the fabric flat. You can always start again.' },
  shaving: { category:'Personal care', steps:['Lay out a clean razor, shaving cream and a towel.', 'Soften your beard with warm water and apply shaving cream.', 'Use light, short strokes in the direction your hair grows.'], tip:'Go gently. Rinse the blade often and avoid irritated skin.' },
  beard: { category:'Personal care', steps:['Start with a clean, dry beard.', 'Comb through it and choose a longer guard first.', 'Trim a little, then stop and check both sides.'], tip:'Take less off first. You can shorten it gradually.' },
  ironing: { category:'Everyday', steps:['Check the shirt’s care label before switching the iron on.', 'Set up a stable ironing board and the recommended heat.', 'Lay one section flat. Move the iron steadily over it.'], tip:'Never leave a hot iron unattended. Let it cool safely.' },
  button: { category:'Make & mend', steps:['Match the button to its original position.', 'Thread your needle and knot the end.', 'Stitch through the fabric and button holes several times.'], tip:'Leave a little space so the button can move through the buttonhole.' },
  drill: { category:'Make & mend', steps:['Choose a practice task and read your drill’s manual.', 'Match the drill bit to the material. Wear eye protection.', 'Secure the workpiece and get familiar with the controls.'], tip:'Check for hidden pipes and wiring before any wall drilling.' },
  laundry: { category:'Everyday', steps:['Read the care labels. Separate delicate items and colors.', 'Choose a suitable cycle and measure the detergent.', 'Leave room in the drum. Dry each item as its label says.'], tip:'If you’re unsure, choose a gentler cycle and lower temperature.' },
  cooking: { category:'Everyday', steps:['Pick a simple recipe and read it through.', 'Wash your hands. Gather and measure your ingredients.', 'Follow the recipe one step at a time, keeping your workspace clear.'], tip:'Start small. A simple meal you enjoy is a good first win.' },
  bike: { category:'Make & mend', steps:['Check your tires for wear and find the pressure range on the sidewall.', 'Use a suitable pump and stay within that pressure range.', 'Check that the brakes work and the wheels are secure before riding.'], tip:'If something feels loose or the brakes don’t work, ask a bike shop.' }
};
