import { exigirModulo } from "../modulo-activo";

/** El módulo solo existe si está prendido en el edificio activo (decisión 87). */
export default async function LayoutModulo({ children }: { children: React.ReactNode }) {
  await exigirModulo("/solicitudes");
  return children;
}
