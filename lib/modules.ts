import type { SkillId } from './config';
export const categories = ['All skills', 'Everyday', 'Personal care', 'Make & mend'] as const;
export type Category = typeof categories[number];
export type LessonStep = { title: string; instruction: string; tip: string; check: string };
export type Lesson = { category: Exclude<Category, 'All skills'>; intro: string; materials: string[]; steps: LessonStep[]; outcome: string };
const s = (title: string, instruction: string, tip: string, check: string): LessonStep => ({ title, instruction, tip, check });
export const modules: Record<SkillId, Lesson> = {
 tie: { category:'Everyday', intro:'A four-in-hand knot, from the first cross to the final adjustment.', materials:['A necktie','A mirror'], steps:[
  s('Start with the wide end longer.','Drape the tie around your collar, seam facing in. Let the wide end hang lower than the narrow end.','Keep the fabric flat. You can always start again.','Both ends are flat and the wide end is longer.'),
  s('Cross it over the narrow end.','Bring the wide end across the front of the narrow end. Hold the crossing gently near your collar.','A small move. You’re getting there.','The wide end lies on top.'),
  s('Wrap the wide end behind.','Take the wide end behind the narrow end and out to the other side.','Leave the knot loose enough to work with.','The wide end has wrapped behind.'),
  s('Bring it across the front.','Pass the wide end across the front again. Keep a finger under this band to leave a small opening.','Keep this layer flat and loose.','There is an open band across the front.'),
  s('Lift it through the neck loop.','Bring the wide end up from underneath, through the loop around your neck.','A little space makes the next step easier.','The wide end points up through the neck loop.'),
  s('Pass it through the front loop.','Feed the wide tip down through the opening in the front band. Pull slowly.','Nearly there. Keep the knot relaxed.','The wide end hangs through the front band.'),
  s('Slide the knot up gently.','Hold the narrow end and ease the knot toward your collar. Stop while comfortable. Adjust the wide tip toward your waistband.','Undo and adjust the starting lengths if needed.','The knot is comfortable and the fabric lies flat.')
 ], outcome:'You have practiced a complete four-in-hand knot.' },
 shaving: { category:'Personal care', intro:'A gentle wet shave for facial hair, with a clean manual razor.', materials:['A clean razor','Shaving cream or gel','Water','A clean towel','Moisturizer'], steps:[
  s('Set out your shaving kit.','Wash your hands. Lay out a clean razor, shaving cream and towel by a well-lit mirror. Replace a dull or damaged blade.','Use your own razor. Keep fingers away from the blade.','Your tools are clean and within reach.'),
  s('Soften the hair.','Wet your face with comfortably warm water. Notice the direction your hair grows in each area.','Avoid broken or irritated skin.','Your skin and facial hair are wet.'),
  s('Apply a layer of cream.','Spread shaving cream or gel over the area. Leave it on for the time recommended on the product.','Add water if the cream dries out.','The area has an even layer of cream.'),
  s('Use short, light strokes.','Move the razor with the direction of hair growth, using short strokes without pressing.','Stop if it hurts or pulls. Never move the blade sideways.','You have tried one small area without pressing.'),
  s('Rinse and continue gently.','Rinse the blade after a few strokes. Reapply cream before another pass, or leave the area for another day.','Fewer passes help avoid irritation.','You have rinsed the blade and checked your skin.'),
  s('Rinse and moisturize.','Rinse away cream with cool water, pat dry and apply a gentle moisturizer suitable for your skin.','Avoid rubbing freshly shaved skin.','The cream is gone and your skin feels comfortable.'),
  s('Clean up your kit.','Rinse the razor as its instructions direct. Leave it to dry safely and store blades out of reach of children.','Do not wipe the blade with fingers or a towel.','Your razor is clean and safely stored.')
 ], outcome:'You have practiced a gentle shaving routine, including cleanup.' },
 beard: { category:'Personal care', intro:'Tidy a beard with a guarded trimmer, a little at a time.', materials:['A trimmer and guards','A comb','A mirror','A towel'], steps:[
  s('Start clean and dry.','Wash and fully dry your beard. Set up a mirror and lay a towel below to catch hair.','Dry hair makes the length easier to judge.','Your beard is dry and your workspace is ready.'),
  s('Comb out the tangles.','Comb in the direction of growth. Gently separate tangles before using the trimmer.','Do not pull through a knot.','The comb moves comfortably through your beard.'),
  s('Choose a longer guard.','With the trimmer off, attach a guard longer than you think you need. Check that it clicks securely into place.','Start long. You can take more off later.','The guard is secure before switching on.'),
  s('Try one small section.','Switch on and pass the guarded trimmer through a small area, following the direction in its manual.','Use gentle contact without pressing into your skin.','You have checked the length after one pass.'),
  s('Balance both sides.','Trim a little on one side, then match the other. Comb and compare in the mirror before continuing.','Pause often. A small difference is normal.','Both sides look balanced to you.'),
  s('Tidy stray hairs.','Use the guarded trimmer to tidy stray hairs at the edges. Keep your existing shape while you learn.','Skip close edging if you are unsure.','You have checked the edges without rushing.'),
  s('Brush and clean up.','Switch off and unplug before cleaning as the manual directs. Brush away hair and store the trimmer and guards.','Rinse only parts marked as washable.','The tool is off, clean and put away.')
 ], outcome:'You have practiced a controlled beard trim and cleanup.' },
 ironing: { category:'Everyday', intro:'Press a shirt in small sections, following its care label.', materials:['An iron','A stable ironing board','A shirt with a care label','A hanger'], steps:[
  s('Read the care label.','Find the iron symbol and follow its heat and steam instructions. If ironing is crossed out, stop and choose another shirt.','If the label is unclear, do not guess the heat.','The label allows ironing and you know the setting.'),
  s('Set up the board and iron.','Open the board on a stable surface. Keep the cord clear, set the correct heat and stand the iron upright on its rest.','Fill water only as the manual directs, while unplugged.','The board is stable and the iron is resting safely.'),
  s('Press the collar.','Lay the collar flat. Move the iron steadily from the points inward, following the care instructions.','Keep fingers clear of the hot soleplate and steam.','The collar lies flat.'),
  s('Open out the cuffs.','Unbutton and flatten each cuff. Press around buttons rather than over them.','Rest the iron upright between sections.','Both cuffs have been pressed.'),
  s('Flatten each sleeve.','Align the sleeve seams and smooth out folds before pressing. Repeat on the other sleeve.','Check the underside for folds.','Both sleeves are smooth.'),
  s('Work around the shirt.','Press one front panel, the back and the other front panel, rotating the shirt over the board.','Keep the iron moving and never leave it face down.','You have checked the front and back.'),
  s('Hang up and switch off.','Hang the shirt. Switch off and unplug the iron. Leave it upright in a safe place to cool fully before storing.','Never leave a hot iron unattended.','The shirt is hung and the iron is unplugged.')
 ], outcome:'You have practiced pressing a shirt and cooling the iron safely.' },
 button: { category:'Make & mend', intro:'Reattach a flat, four-hole button with a crossed stitch.', materials:['A four-hole button','A needle','Thread','Scissors','The garment'], steps:[
  s('Find the button’s position.','Lay the garment flat. Align the button with its original position, using the buttonhole and nearby buttons as guides.','Choose a flat four-hole button for this lesson.','The button lines up with the buttonhole.'),
  s('Thread the needle.','Cut a manageable length of thread. Pass it through the needle, bring the ends together and knot them.','Shorter thread is less likely to tangle.','The needle is threaded and the ends are knotted.'),
  s('Anchor from the back.','Push the needle from the back of the fabric through one button hole. Pull until the knot rests against the back.','Keep your other hand clear of the needle.','The thread is anchored behind the fabric.'),
  s('Make the first diagonal.','Pass down through the opposite hole and fabric, then back up through the first hole. Repeat a few times.','Leave a little slack for the button to move.','Stitches join the first pair of holes.'),
  s('Cross the other holes.','Come up through an unused hole and down through its diagonal partner. Repeat to make an X.','Keep the thread untangled.','Both pairs of holes have secure stitches.'),
  s('Secure the thread behind.','Finish on the back. Pass under an existing stitch, then through the thread loop. Tighten gently and repeat.','Avoid sewing through other garment layers.','The thread is secured on the back.'),
  s('Trim and test.','Trim the thread, leaving a short tail. Test the button through its buttonhole and put the needle and scissors away.','The button should fasten without straining.','The button fastens and the needle is safely stored.')
 ], outcome:'You have practiced reattaching a four-hole button.' },
 drill: { category:'Make & mend', intro:'Practice a small hole in clamped scrap wood. This lesson does not cover walls or masonry.', materials:['A drill and its manual','A wood bit','Scrap wood and a backing block','Clamps','Eye protection'], steps:[
  s('Choose a practice task.','Read the drill’s manual. Practice on scrap wood, with an experienced person if this is your first time.','Do not drill into walls; hidden services need separate checks.','Your task is scrap wood, away from hidden pipes and wires.'),
  s('Secure the wood.','Clamp the wood and backing block to a stable bench, with safe clearance below the drilling point.','Never hold a small workpiece in your hand.','The wood cannot shift and the drill will clear the bench.'),
  s('Fit the wood bit.','Disconnect power or remove the battery. Fit and tighten the bit as instructed, then remove any chuck key.','Keep power disconnected during adjustments.','The bit is secure and the chuck key is removed.'),
  s('Prepare and mark the spot.','Wear eye protection, tie back hair and remove loose jewelry. Mark the hole and select drill mode and the recommended low speed.','Keep loose clothes and gloves away from rotating parts.','Protection is on and the setting is correct.'),
  s('Drill slowly and straight.','Reconnect power. Hold the drill firmly as its manual directs, align with the mark and start slowly with light pressure.','Keep hands away from the bit and underside of the wood.','You have drilled without the wood moving.'),
  s('Withdraw and stop.','Ease the bit back out along the same line as the manual directs. Release the trigger and wait for rotation to stop.','The bit may be hot. Do not touch it.','The drill has stopped and is clear of the wood.'),
  s('Disconnect and clear up.','Disconnect power. Let the bit cool before removal, brush away chips and inspect the hole. Put the tools away.','Use a brush rather than your hand for chips.','Power is disconnected and the workspace is clear.')
 ], outcome:'You have practiced a small hole in secured scrap wood.' },
 laundry: { category:'Everyday', intro:'One machine-washable load, from care labels to drying.', materials:['Machine-washable clothes','Detergent','A washing machine','A drying rack or suitable dryer'], steps:[
  s('Read the care labels.','Read the care labels. Separate delicate items and colors. Set aside hand-wash and dry-clean-only items.','Start with clothes that can share a cycle.','The load can be machine washed together.'),
  s('Choose and measure.','Choose a suitable cycle and measure the detergent following its packaging, load size and water hardness.','More detergent does not mean cleaner clothes.','You know the cycle and detergent dose.'),
  s('Check pockets and zips.','Empty pockets, close zips and use laundry bags for delicate machine-washable items when recommended.','Look for tissues, coins and anything that could stain.','The pockets are empty and zips are closed.'),
  s('Load without packing.','Load loosely within the machine’s limit. Add detergent to the compartment specified in its manual.','Leave room for clothes to move.','The drum is not overfilled.'),
  s('Set the cycle and start.','Choose a cycle and temperature allowed by every label in the load. Close the door and start.','Follow the machine’s instructions for its controls.','The program matches your clothes.'),
  s('Unload and dry.','Wait for the door to unlock. Unload promptly, shake out creases and dry each item as its label says.','Tumble dry only when the label allows it.','Every item is drying in a suitable way.'),
  s('Fold and reset.','Fold and store only fully dry clothes. Clean the dryer lint filter if used and care for the washer as its manual directs.','Damp clothes need more drying time.','The clothes are dry and machines are ready for next time.')
 ], outcome:'You have practiced a complete wash, dry and put-away routine.' },
 cooking: { category:'Everyday', intro:'Make an instant couscous bowl with ready-to-eat chickpeas and vegetables.', materials:['Instant couscous and its packet','Canned ready-to-eat chickpeas','Cucumber or tomatoes','A kettle','A heatproof bowl and cover','A fork, knife and board'], steps:[
  s('Read and prepare.','Read the instant couscous packet for portions, water quantity and resting time. Check ingredient labels for allergies.','Choose couscous prepared with boiling water.','Your ingredients and packet instructions are ready.'),
  s('Wash and clear the space.','Wash your hands and vegetables. Clear a stable surface and use a clean board and knife.','Keep the kettle and hot bowl away from the edge.','Hands, vegetables and work surface are clean.'),
  s('Measure the couscous.','Measure a portion into a heatproof bowl. Measure the packet’s water quantity and heat it in the kettle.','Use your packet’s ratio; products vary.','The couscous and water are measured.'),
  s('Add hot water and cover.','Carefully pour in the hot water. Cover with a suitable plate or lid and set a timer for the packet’s resting time.','Hot water and steam can burn. Get help if needed.','The bowl is covered and the timer is set.'),
  s('Prepare the toppings.','Drain and rinse the chickpeas. Cut vegetables on a stable board, keeping fingertips tucked away.','Take your time with the knife.','Your chickpeas and vegetables are ready.'),
  s('Fluff and combine.','When ready, lift the lid away from you. Check the couscous as the packet describes, fluff with a fork and add toppings.','Taste a small cooled bite and season as you like.','The couscous is ready and toppings are mixed in.'),
  s('Serve and clear up.','Serve your bowl. Cool and refrigerate leftovers promptly following ingredient guidance. Wash tools and the work surface.','Do not leave cooked food at room temperature for hours.','Your meal is served and the workspace is clean.')
 ], outcome:'You have practiced making a couscous and chickpea bowl.' },
 bike: { category:'Make & mend', intro:'A basic pre-ride check of tires, wheels, brakes and chain.', materials:['Your bike','A pump with a gauge and matching valve fitting','A rag'], steps:[
  s('Check the tires.','Stand the bike securely. Check both tires for cuts, damage or debris and find the pressure range on each sidewall.','Get help for damaged tires or anything unfamiliar.','Both tires look sound and you know their pressure limits.'),
  s('Match the pump to the valve.','Remove a valve cap and identify the valve. Attach a compatible pump fitting following its instructions.','Some valves need their small tip unscrewed first.','The pump is attached to the correct valve type.'),
  s('Inflate within the limits.','Pump while watching the gauge. Follow bike and tire guidance without exceeding tire or rim limits. Repeat on the other tire.','Ask a bike shop if you do not know the correct pressure.','Both tires are within their allowed limits.'),
  s('Check valves and wheels.','Detach the pump, close the valves as needed and replace caps. Check wheel fastenings as the bike manual describes.','Do not ride with a loose wheel or uncertain fastening.','Valves are closed and both wheels are secure.'),
  s('Test the brakes.','Stand beside the bike. Squeeze each brake separately and gently try to roll it; each should stop its wheel firmly.','Do not ride if a brake does not work. Ask a bike shop.','Both brakes work in this standing test.'),
  s('Look over the chain.','With the bike stationary, check the chain for rust, damage or obvious slack. Wipe accessible grime with a rag.','Keep fingers away from gears and do not turn the pedals.','You have inspected the stationary chain.'),
  s('Make a final check.','Check the saddle and handlebar feel secure and required lights work. Ride only when the bike feels sound and you are confident.','Get help if anything is loose, damaged or uncertain.','You have checked for problems before riding.')
 ], outcome:'You have practiced a basic pre-ride bike check.' }
};
