import "server-only";
/** Explicit Bulgarian case folding works even on a PostgreSQL C-collation database.
 * Accept only source-owned SQL expressions; query text is always a bound parameter. */
export function catalogSearchText(expression: string): string {
  return `lower(translate(coalesce(${expression},''),'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ'))`;
}
