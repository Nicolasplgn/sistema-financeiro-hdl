/** Junta classes CSS ignorando valores falsos. */
export const cx = (...classes) => classes.filter(Boolean).join(' ');
