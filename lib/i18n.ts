import { en } from '@/messages/en';
import type { Locale } from './config';
export type Copy = typeof en;
export function getCopy(_locale: Locale): Copy { return en; }
