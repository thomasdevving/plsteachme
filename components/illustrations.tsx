import {
  Scissors,
  Drill,
  WashingMachine,
  CookingPot,
  Bike,
  Smartphone,
  Hand,
  MessageCircle,
  Play,
} from "lucide-react";
import { type SkillId } from "@/lib/config";
export function SkillIcon({
  skill,
  size = 64,
}: {
  skill: SkillId;
  size?: number;
}) {
  const props = { size, strokeWidth: 1.25, "aria-hidden": true as const };
  if (skill === "tie")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m24 8 16 0-3 12H27L24 8Zm3 12-6 30 11 9 11-9-6-30" />
        <path d="m27 20 10 0M24 35l15 12M27 25l14 12" />
      </svg>
    );
  if (skill === "shaving")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <rect x="15" y="9" width="34" height="14" rx="3" />
        <path d="M18 14h28M18 18h28M28 23v8h8v-8M28 31l-2 23a6 6 0 0 0 12 0l-2-23" />
      </svg>
    );
  if (skill === "button")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <circle cx="29" cy="34" r="19" />
        <circle cx="24" cy="29" r="2" />
        <circle cx="34" cy="29" r="2" />
        <circle cx="24" cy="39" r="2" />
        <circle cx="34" cy="39" r="2" />
        <path d="m40 20 13-13m-4-1 5 5M34 29 24 39" />
      </svg>
    );
  if (skill === "ironing")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 45h50l-5-15H25C17 30 10 36 6 45Zm0 0v5h50v-5M25 30v-9h17l6 9M37 21v-4c0-10 17-9 18-15" />
        <circle cx="45" cy="38" r="2" />
      </svg>
    );
  const Icon = {
    beard: Scissors,
    drill: Drill,
    laundry: WashingMachine,
    cooking: CookingPot,
    bike: Bike,
  }[skill];
  return <Icon {...props} />;
}
export const StepIcons = [Hand, Smartphone, Play, MessageCircle];
