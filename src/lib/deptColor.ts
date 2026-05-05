import type { CSSProperties } from 'react';

export const DEPT_FAMILIES = [
  'sage', 'rose', 'peach', 'sand', 'lime', 'teal', 'sky', 'lav', 'berry',
] as const;
export type DeptFamily = typeof DEPT_FAMILIES[number];

export const DEPT_FAMILY_LABELS: Record<DeptFamily, string> = {
  sage: 'Sage',
  rose: 'Rose',
  peach: 'Peach',
  sand: 'Sand',
  lime: 'Lime',
  teal: 'Teal',
  sky: 'Sky',
  lav: 'Lavender',
  berry: 'Berry',
};

const FAMILY_CLASSES: Record<DeptFamily, string> = {
  sage:  'bg-sage-bg text-sage-fg',
  rose:  'bg-rose-bg text-rose-fg',
  peach: 'bg-peach-bg text-peach-fg',
  sand:  'bg-sand-bg text-sand-fg',
  lime:  'bg-lime-bg text-lime-fg',
  teal:  'bg-teal-bg text-teal-fg',
  sky:   'bg-sky-bg text-sky-fg',
  lav:   'bg-lav-bg text-lav-fg',
  berry: 'bg-berry-bg text-berry-fg',
};

const FAMILY_CHIP_CLASSES: Record<DeptFamily, string> = {
  sage:  'bg-sage-bg text-sage-fg border-sage-fg/30',
  rose:  'bg-rose-bg text-rose-fg border-rose-fg/30',
  peach: 'bg-peach-bg text-peach-fg border-peach-fg/30',
  sand:  'bg-sand-bg text-sand-fg border-sand-fg/30',
  lime:  'bg-lime-bg text-lime-fg border-lime-fg/30',
  teal:  'bg-teal-bg text-teal-fg border-teal-fg/30',
  sky:   'bg-sky-bg text-sky-fg border-sky-fg/30',
  lav:   'bg-lav-bg text-lav-fg border-lav-fg/30',
  berry: 'bg-berry-bg text-berry-fg border-berry-fg/30',
};

const FAMILY_DOT_CLASSES: Record<DeptFamily, string> = {
  sage:  'bg-sage-fg',
  rose:  'bg-rose-fg',
  peach: 'bg-peach-fg',
  sand:  'bg-sand-fg',
  lime:  'bg-lime-fg',
  teal:  'bg-teal-fg',
  sky:   'bg-sky-fg',
  lav:   'bg-lav-fg',
  berry: 'bg-berry-fg',
};

export function isDeptFamily(value: unknown): value is DeptFamily {
  return typeof value === 'string' && (DEPT_FAMILIES as readonly string[]).includes(value);
}

/** Resolve dept.color (family name or legacy hex) into Tailwind classes + inline style. */
export function deptColorClasses(color: string | null | undefined): {
  className: string;
  style?: CSSProperties;
} {
  if (isDeptFamily(color)) return { className: FAMILY_CLASSES[color] };
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) {
    return { className: '', style: { backgroundColor: color, color: '#fff' } };
  }
  return { className: 'bg-muted text-muted-foreground' };
}

/** Resolve dept.color into a tinted-chip (bg + text + border) treatment. */
export function deptChipClasses(color: string | null | undefined): {
  className: string;
  style?: CSSProperties;
} {
  if (isDeptFamily(color)) return { className: FAMILY_CHIP_CLASSES[color] };
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) {
    return {
      className: '',
      style: {
        backgroundColor: `${color}15`,
        borderColor: `${color}40`,
        color,
      },
    };
  }
  return { className: 'bg-muted text-muted-foreground border-border' };
}

/** Resolve dept.color into a small dot-pip className. */
export function deptDotClasses(color: string | null | undefined): {
  className: string;
  style?: CSSProperties;
} {
  if (isDeptFamily(color)) return { className: FAMILY_DOT_CLASSES[color] };
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) {
    return { className: '', style: { backgroundColor: color } };
  }
  return { className: 'bg-muted-foreground' };
}
