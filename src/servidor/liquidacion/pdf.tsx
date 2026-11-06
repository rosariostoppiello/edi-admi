import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatearNumero, type Centesimos } from "@/dominio/dinero";
import { COLUMNAS_MONTO, type ColumnaMonto } from "@/dominio/liquidacion/calculo";
import { formatearPorcentaje } from "@/dominio/liquidacion/egresos";
import { formatearFecha, nombrePeriodo, periodoEnFrase, rangoPeriodo, vencimiento } from "@/dominio/liquidacion/periodo";
import type { LiquidacionArmada } from "./armado";

/**
 * PDF de la liquidación mensual, con las 6 secciones del modelo:
 * resumen por rubro, disponibilidades, depósitos no identificados, detalle por
 * unidad, procedimiento de pago y detalle de egresos.
 * Se usa Helvetica (incluida en el PDF estándar): no hay que descargar fuentes.
 */

const PIZARRA = "#1D2830";
const SUAVE = "#4A5761";
const JUNTA = "#C9CEC8";
const GRANITO = "#EDEFEB";
const ALERTA = "#A1261B";

const s = StyleSheet.create({
  pagina: { paddingTop: 54, paddingBottom: 36, paddingHorizontal: 28, fontFamily: "Helvetica", fontSize: 8, color: PIZARRA },
  encabezado: { position: "absolute", top: 20, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between" },
  complejo: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  direccion: { fontSize: 8, color: SUAVE },
  pie: { position: "absolute", bottom: 16, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: SUAVE },
  titulo: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 8 },
  subtitulo: { fontFamily: "Helvetica-Bold", fontSize: 9, marginTop: 10, marginBottom: 4 },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: JUNTA, paddingVertical: 2 },
  filaCabecera: { flexDirection: "row", backgroundColor: GRANITO, borderBottomWidth: 1, borderBottomColor: PIZARRA, paddingVertical: 3 },
  filaTotal: { flexDirection: "row", borderTopWidth: 1, borderTopColor: PIZARRA, paddingVertical: 3, fontFamily: "Helvetica-Bold" },
  negrita: { fontFamily: "Helvetica-Bold" },
  num: { textAlign: "right" },
  sello: { fontFamily: "Helvetica-Bold", fontSize: 11, color: ALERTA, borderWidth: 1.5, borderColor: ALERTA, padding: 6, marginBottom: 10 },
  parrafo: { fontSize: 9, lineHeight: 1.5, marginBottom: 6 },
});

const n = (m: Centesimos | number) => formatearNumero(m as Centesimos);

function Marco({ nombre, direccion, periodo, children, horizontal = true }: {
  nombre: string;
  direccion: string;
  periodo: string;
  children: React.ReactNode;
  horizontal?: boolean;
}) {
  return (
    <Page size="A4" orientation={horizontal ? "landscape" : "portrait"} style={s.pagina} wrap>
      <View style={s.encabezado} fixed>
        <View>
          <Text style={s.complejo}>{nombre}</Text>
          {direccion ? <Text style={s.direccion}>{direccion}</Text> : null}
        </View>
        <Text style={s.direccion}>Liquidación de gastos comunes de {periodoEnFrase(periodo)}</Text>
      </View>
      {children}
      <View style={s.pie} fixed>
        <Text>Montos en pesos uruguayos</Text>
        <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
      </View>
    </Page>
  );
}

function Sello({ l }: { l: LiquidacionArmada }) {
  if (l.estado === "BORRADOR") return <Text style={s.sello}>BORRADOR: vista previa, todavía no es la liquidación oficial.</Text>;
  if (l.estado === "ANULADA") {
    return <Text style={s.sello}>ANULADA{l.anuladaEn ? ` el ${formatearFecha(l.anuladaEn.toISOString())}` : ""}. Motivo: {l.motivoAnulacion}</Text>;
  }
  return null;
}

const COLUMNAS: { clave: ColumnaMonto; titulo: string }[] = [
  { clave: "saldoAnterior", titulo: "Saldo Ant." },
  { clave: "pagos", titulo: "Pagos" },
  { clave: "saldo", titulo: "Saldo" },
  { clave: "intereses", titulo: "Intereses y otros" },
  { clave: "gcUnidad", titulo: "G.C. Unidad" },
  { clave: "gcGaraje", titulo: "G.C. Garaje" },
  { clave: "fondoReserva", titulo: "F.R." },
  { clave: "tag", titulo: "Tag Gge" },
  { clave: "barbacoaOtros", titulo: "Barbacoa / Otros" },
  { clave: "multas", titulo: "Multas" },
  { clave: "saldoAPagar", titulo: "Saldo a pagar" },
];

export function DocumentoLiquidacion({ l, nombre, direccion }: { l: LiquidacionArmada; nombre: string; direccion: string }) {
  const marco = { nombre, direccion, periodo: l.periodo };
  const rango = rangoPeriodo(l.periodo);
  const tasaFr = formatearPorcentaje(l.tasaFondoReservaPb).replace(",00", "");
  const c = l.cuenta;
  const colFondo = { width: 90, ...s.num };

  return (
    <Document title={`Liquidación de gastos comunes ${nombrePeriodo(l.periodo)}`} author={nombre} language="es-UY">
      {/* 1. Resumen por rubro */}
      <Marco {...marco}>
        <Sello l={l} />
        <Text style={s.titulo}>Resumen de {nombrePeriodo(l.periodo)}</Text>
        <View style={s.filaCabecera}>
          <Text style={{ flex: 1, ...s.negrita }}>Rubro</Text>
          <Text style={{ width: 100, ...s.num, ...s.negrita }}>Saldo</Text>
          <Text style={{ width: 60, ...s.num, ...s.negrita }}>%</Text>
        </View>
        {l.resumen.rubros.map((g) => (
          <View key={g.rubro.id} wrap={false}>
            <View style={s.fila}>
              <Text style={{ flex: 1, ...s.negrita }}>{g.rubro.codigo} {g.rubro.nombre}</Text>
              <Text style={{ width: 100, ...s.num, ...s.negrita }}>{n(g.total)}</Text>
              <Text style={{ width: 60, ...s.num }}>{formatearPorcentaje(g.porcentajePb)}</Text>
            </View>
            {g.subrubros.map((sr) => (
              <View key={sr.rubro.id} style={s.fila}>
                <Text style={{ flex: 1, paddingLeft: 14 }}>{sr.rubro.codigo} {sr.rubro.nombre}</Text>
                <Text style={{ width: 100, ...s.num }}>{n(sr.total)}</Text>
                <Text style={{ width: 60 }} />
              </View>
            ))}
          </View>
        ))}
        <View style={s.filaTotal}>
          <Text style={{ flex: 1 }}>TOTAL EGRESOS</Text>
          <Text style={{ width: 100, ...s.num }}>{n(l.resumen.total)}</Text>
          <Text style={{ width: 60, ...s.num }}>{l.resumen.total ? "100,00 %" : ""}</Text>
        </View>
      </Marco>

      {/* 2. Disponibilidades */}
      <Marco {...marco}>
        <Text style={s.titulo}>Disponibilidades al {formatearFecha(rango.hasta)}</Text>
        <Text style={s.subtitulo}>Moneda nacional</Text>
        <View style={s.filaCabecera}>
          <Text style={{ flex: 1, ...s.negrita }}>{l.disponibilidades.nombreCuenta}</Text>
          <Text style={{ ...colFondo, ...s.negrita }}>Fondo gastos comunes</Text>
          <Text style={{ ...colFondo, ...s.negrita }}>Fondo de reserva {tasaFr}</Text>
          <Text style={{ ...colFondo, ...s.negrita }}>Depósitos no identificados</Text>
          <Text style={{ ...colFondo, ...s.negrita }}>Totales</Text>
        </View>
        {(
          [
            [`Saldo inicial al ${formatearFecha(rango.desde)}`, c.saldoInicial],
            ["Ingresos", c.ingresos],
          ] as const
        ).map(([titulo, f]) => (
          <View key={titulo} style={s.fila}>
            <Text style={{ flex: 1 }}>{titulo}</Text>
            <Text style={colFondo}>{n(f.gc)}</Text>
            <Text style={colFondo}>{n(f.fr)}</Text>
            <Text style={colFondo}>{n(f.dni)}</Text>
            <Text style={colFondo}>{n(f.total)}</Text>
          </View>
        ))}
        {c.depositosIdentificados.map((d, i) => (
          <View key={i} style={s.fila}>
            <Text style={{ flex: 1, paddingLeft: 14 }}>Depósito identificado: {d.codigo}</Text>
            <Text style={colFondo}>{n(d.monto)}</Text>
            <Text style={colFondo} />
            <Text style={colFondo}>{n(-d.monto)}</Text>
            <Text style={colFondo}>{n(0)}</Text>
          </View>
        ))}
        <View style={s.fila}>
          <Text style={{ flex: 1 }}>Egresos de gastos comunes</Text>
          <Text style={colFondo}>{n(-c.egresosGastosComunes)}</Text>
          <Text style={colFondo} />
          <Text style={colFondo} />
          <Text style={colFondo}>{n(-c.egresosGastosComunes)}</Text>
        </View>
        <View style={s.fila}>
          <Text style={{ flex: 1 }}>Egresos de gastos de cargo de los propietarios</Text>
          <Text style={colFondo}>{n(-c.egresosCargoPropietarios)}</Text>
          <Text style={colFondo} />
          <Text style={colFondo} />
          <Text style={colFondo}>{n(-c.egresosCargoPropietarios)}</Text>
        </View>
        <View style={s.filaTotal}>
          <Text style={{ flex: 1 }}>Saldo final al {formatearFecha(rango.hasta)}</Text>
          <Text style={colFondo}>{n(c.saldoFinal.gc)}</Text>
          <Text style={colFondo}>{n(c.saldoFinal.fr)}</Text>
          <Text style={colFondo}>{n(c.saldoFinal.dni)}</Text>
          <Text style={colFondo}>{n(c.saldoFinal.total)}</Text>
        </View>

        {l.otrasCuentas.map((o) => (
          <View key={o.nombre} wrap={false}>
            <Text style={s.subtitulo}>{o.nombre} {o.moneda === "USD" ? "(dólares)" : "(pesos)"}</Text>
            <View style={s.fila}>
              <Text style={{ flex: 1 }}>Saldo inicial al {formatearFecha(rango.desde)}</Text>
              <Text style={colFondo}>{n(o.saldoInicial)}</Text>
            </View>
            {o.movimientos.map((m, i) => (
              <View key={i} style={s.fila}>
                <Text style={{ flex: 1, paddingLeft: 14 }}>{m.concepto}</Text>
                <Text style={colFondo}>{n(m.monto)}</Text>
              </View>
            ))}
            <View style={s.filaTotal}>
              <Text style={{ flex: 1 }}>Saldo final al {formatearFecha(rango.hasta)}</Text>
              <Text style={colFondo}>{n(o.saldoFinal)}</Text>
            </View>
          </View>
        ))}
      </Marco>

      {/* 3. Depósitos no identificados */}
      <Marco {...marco}>
        <Text style={s.titulo}>Detalle de depósitos no identificados</Text>
        {l.depositosPendientes.length === 0 ? (
          <Text style={s.parrafo}>No hay depósitos sin identificar al cierre del mes.</Text>
        ) : (
          <>
            <Text style={s.parrafo}>
              Si alguno de estos depósitos es tuyo, avisale a la administración con el comprobante para que lo asigne a tu unidad.
            </Text>
            <View style={s.filaCabecera} fixed>
              <Text style={{ width: 90, ...s.negrita }}>Fecha de cobro</Text>
              <Text style={{ width: 160, ...s.negrita }}>Forma de pago</Text>
              <Text style={{ flex: 1, ...s.negrita }}>Nro. de documento</Text>
              <Text style={{ width: 100, ...s.num, ...s.negrita }}>Valor</Text>
            </View>
            {l.depositosPendientes.map((d) => (
              <View key={d.id} style={s.fila} wrap={false}>
                <Text style={{ width: 90 }}>{formatearFecha(d.fecha)}</Text>
                <Text style={{ width: 160 }}>{d.forma}</Text>
                <Text style={{ flex: 1 }}>{d.documento ?? ""}</Text>
                <Text style={{ width: 100, ...s.num }}>{n(d.monto)}</Text>
              </View>
            ))}
            <View style={s.filaTotal}>
              <Text style={{ flex: 1 }}>Total</Text>
              <Text style={{ width: 100, ...s.num }}>{n(l.totalDepositosPendientes)}</Text>
            </View>
          </>
        )}
      </Marco>

      {/* 4. Detalle por unidad */}
      <Marco {...marco}>
        <Text style={s.titulo}>
          Detalle de gastos comunes a pagar por unidad, período {formatearFecha(rango.desde)} al {formatearFecha(rango.hasta)}
        </Text>
        <View style={{ ...s.filaCabecera, fontSize: 7 }} fixed>
          <Text style={{ width: 52, ...s.negrita }}>Nro. Apto.</Text>
          <Text style={{ width: 92, ...s.negrita }}>Id.</Text>
          {COLUMNAS.map((col) => (
            <Text key={col.clave} style={{ flex: 1, ...s.num, ...s.negrita }}>
              {col.clave === "fondoReserva" ? `F.R. (${tasaFr})` : col.titulo}
            </Text>
          ))}
          <Text style={{ width: 52, ...s.num, ...s.negrita }}>Nro. Apto.</Text>
        </View>
        {l.lineas.map((ln) => (
          <View key={`${ln.unidadId}-${ln.sufijo}`} style={{ ...s.fila, fontSize: 7 }} wrap={false}>
            <Text style={{ width: 52, ...s.negrita }}>{ln.codigo}</Text>
            <Text style={{ width: 92 }}>{ln.descripcion}</Text>
            {COLUMNAS.map((col) => (
              <Text key={col.clave} style={{ flex: 1, ...s.num, ...(col.clave === "saldoAPagar" ? s.negrita : {}) }}>
                {ln[col.clave] === 0 && col.clave !== "saldoAPagar" ? "" : n(ln[col.clave])}
              </Text>
            ))}
            <Text style={{ width: 52, ...s.num, ...s.negrita }}>{ln.codigo}</Text>
          </View>
        ))}
        <View style={{ ...s.filaTotal, fontSize: 7 }} wrap={false}>
          <Text style={{ width: 144 }}>TOTALES</Text>
          {COLUMNAS_MONTO.map((k) => (
            <Text key={k} style={{ flex: 1, ...s.num }}>{n(l.totales[k])}</Text>
          ))}
          <Text style={{ width: 52 }} />
        </View>
      </Marco>

      {/* 5. Procedimiento de pago */}
      <Marco {...marco}>
        <Text style={s.titulo}>Procedimiento para el pago de gastos comunes</Text>
        <Text style={s.parrafo}>Vencimiento: {formatearFecha(vencimiento(l.periodo, l.diaVencimiento))}.</Text>
        {l.procedimientoPago
          .split(/\n{2,}/)
          .filter((p) => p.trim())
          .map((p, i) => (
            <Text key={i} style={s.parrafo}>{p.trim()}</Text>
          ))}
      </Marco>

      {/* 6. Detalle de egresos por rubro */}
      <Marco {...marco}>
        <Text style={s.titulo}>Detalle de egresos en pesos de {periodoEnFrase(l.periodo)} por rubro contable</Text>
        <View style={s.filaCabecera} fixed>
          <Text style={{ width: 190, ...s.negrita }}>Rubro</Text>
          <Text style={{ width: 62, ...s.negrita }}>Fecha</Text>
          <Text style={{ width: 170, ...s.negrita }}>Proveedor / Beneficiario</Text>
          <Text style={{ flex: 1, ...s.negrita }}>Detalle</Text>
          <Text style={{ width: 90, ...s.num, ...s.negrita }}>Valor</Text>
        </View>
        {[...l.egresos]
          .sort((a, b) => a.rubroCodigo.localeCompare(b.rubroCodigo, "es", { numeric: true }) || a.fecha.localeCompare(b.fecha))
          .map((e) => (
            <View key={e.id} style={s.fila} wrap={false}>
              <Text style={{ width: 190 }}>{e.rubroCodigo} {e.rubroNombre}</Text>
              <Text style={{ width: 62 }}>{formatearFecha(e.fecha)}</Text>
              <Text style={{ width: 170 }}>{e.proveedor}</Text>
              <Text style={{ flex: 1 }}>{e.detalle}</Text>
              <Text style={{ width: 90, ...s.num }}>{n(e.monto)}</Text>
            </View>
          ))}
        <View style={s.filaTotal}>
          <Text style={{ flex: 1 }}>Total</Text>
          <Text style={{ width: 90, ...s.num }}>{n(l.resumen.total)}</Text>
        </View>
      </Marco>
    </Document>
  );
}

export async function generarPdf(l: LiquidacionArmada, nombre: string, direccion: string): Promise<Buffer> {
  return renderToBuffer(<DocumentoLiquidacion l={l} nombre={nombre} direccion={direccion} />);
}

export function nombreArchivoPdf(periodo: string, estado: LiquidacionArmada["estado"]) {
  const sufijo = estado === "BORRADOR" ? "-borrador" : estado === "ANULADA" ? "-anulada" : "";
  return `liquidacion-gastos-comunes-${periodo}${sufijo}.pdf`;
}
