import type { Metadata } from "next";
import { BotonEnlace } from "@/componentes/ui/boton";
import { Tecla, TeclaChica, Teclado } from "@/componentes/ui/teclas";
import { centesimos, formatearPesos } from "@/dominio/dinero";
import { resumenBorrador } from "@/servidor/liquidacion/confeccion";

export const metadata: Metadata = { title: "Confección de la liquidación" };

const cantidad = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
// "$U" y el número no se separan en dos renglones.
const pesos = (n: number) => formatearPesos(centesimos(n)).replace(/\s/g, "\u00a0");

/**
 * Pantalla de la confección (decisión 32): Egresos e Ingresos como teclas
 * principales, en el orden del gráfico, y el resto como acciones secundarias.
 */
export default async function PaginaConfeccionBorrador({ params }: PageProps<"/liquidaciones/confeccion/[id]">) {
  const { id } = await params;
  const r = await resumenBorrador(id);
  const base = `/liquidaciones/confeccion/${id}`;

  return (
    <>
      <nav aria-label="Egresos e ingresos">
        <ul className="grid grid-cols-2 gap-3 md:gap-5">
          <li>
            <Tecla
              href={`${base}/egresos`}
              nombre="Egresos"
              descripcion={`${cantidad(r.egresos.cantidad, "egreso", "egresos")} por ${pesos(r.egresos.total)}`}
            />
          </li>
          <li>
            <Tecla
              href={`${base}/ingresos`}
              nombre="Ingresos"
              descripcion={`${cantidad(r.ingresos.cantidad, "pago", "pagos")} por ${pesos(r.ingresos.total)}`}
            />
          </li>
        </ul>
      </nav>

      <section aria-labelledby="mas" className="flex flex-col gap-3">
        <h2 id="mas" className="text-medio font-bold">
          También en esta liquidación
        </h2>
        <Teclado etiqueta="Otras partes de la liquidación">
          <li>
            <TeclaChica href={`${base}/cargos`} nombre={`Cargos del mes (${r.cargos})`} />
          </li>
          <li>
            <TeclaChica href={`${base}/cuotas`} nombre="Cuotas por unidad" />
          </li>
          <li>
            <TeclaChica href={`${base}/fondos`} nombre="Fondos y textos" />
          </li>
        </Teclado>
      </section>

      <div className="flex flex-col items-start gap-2 rounded-[var(--radius-tecla)] border-2 border-bronce bg-losa p-4 md:p-6">
        <p className="max-w-prose text-pizarra-suave">
          Cuando esté todo cargado, revisá los totales y el PDF. Al publicar, la liquidación pasa a ser la última y se manda por mail.
        </p>
        <BotonEnlace href={`${base}/revision`}>Revisar y publicar</BotonEnlace>
      </div>
    </>
  );
}
