# Plan — Sistema de administración y liquidación de gastos comunes

Fase 0. Documento vivo: se actualiza con las respuestas a las dudas.
Fuentes: `docs/Proyecto 1.doc.md` (spec) y el PDF modelo de liquidación (setiembre 2026).
**Ningún dato real del PDF se copia a este repo, al seed ni a los tests.**

---

## 1. Lo que sale del PDF modelo (estructura, sin datos)

El PDF tiene 6 secciones, en este orden:

1. **Resumen del mes por rubro**: rubros contables de dos niveles (ej. `2 Personal tercerizado` → `2.1 Portería fija`), subtotal por rubro, % sobre el total y TOTAL EGRESOS.
2. **Disponibilidades al cierre**: cuenta corriente en $ con columnas *Fondo gastos comunes / Fondo de reserva / Depósitos no identificados / Totales*, con filas saldo inicial → ingresos → depósitos identificados → egresos de gastos comunes → egresos de cargo de propietarios (seguro) → saldo final. Además, caja chica y cuenta en USD.
3. **Detalle de depósitos no identificados** (fecha, forma de pago, nro. de documento, valor) y su total.
4. **Detalle por unidad** del período (la tabla principal, varias páginas):
   `Nro. Apto. | Id. | Saldo Ant. | Pagos | Saldo | Intereses y otros | G.C. Unidad | G.C. Garaje | F.R. (5%) | Tag Gge | Barbacoa/Otros | Multas | Saldo a pagar | Nro. Apto.`, más la fila de TOTALES.
5. **Procedimiento de pago** (texto fijo editable: cuenta, vencimiento el 25, recargo).
6. **Detalle de egresos por rubro**: rubro, fecha, proveedor/beneficiario, detalle (período), valor, y el total.

Reglas que verifiqué contra los números del PDF (cierran en todas las filas que revisé y en la fila de totales):

- `Saldo = Saldo anterior − Pagos`
- `Intereses = redondeo(1% × Saldo)` si el saldo es positivo; 0 si no.
- `Saldo a pagar = Saldo + Intereses + GC unidad + GC garaje + FR + Tag + Barbacoa/Otros + Multas`
- `FR = 5% × (GC unidad + GC garaje)` de la unidad completa (P + I juntos), redondeado al peso.
- Cuando la unidad está dividida en P/I: el **I** paga el gasto común ordinario (y casi siempre el garaje). El **P** paga el FR y un GC unidad chico (parece la parte "de cargo de propietarios", el seguro). El garaje a veces lo paga P.
- Todos los cargos van en pesos enteros; los saldos pueden tener centavos.
- Código de unidad en el PDF: `{torre}-{nro}-{A|P|I}`, con guion (ej. `2-201-P`). Hay locales (`2-001`), una oficina (`444`) y una "torre" 6 que son garajes sueltos.
- Universo real: unas 370 líneas (torre 2 ≈ 82 unidades, 3 ≈ 33, 4 ≈ 64, 5 ≈ 107, 6 garajes ≈ 84, más la oficina).
- Los egresos del mes suelen corresponder al período anterior ("Agosto 2026" pagado en setiembre), así que el campo **período** del egreso es texto/mes independiente de la fecha de pago.
- El total de GC cobrado **no** es igual al total de egresos del mes. El GC no es un prorrateo directo del gasto real (ver dudas).

## 2. Stack y por qué

| Pieza | Elección | Por qué |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | Una sola app para UI, server actions y endpoints; SSR rápido en celulares. |
| DB | **PostgreSQL + Prisma** (Postgres local en desarrollo, ya está instalado) | Mismo motor en dev y prod. Índices únicos parciales para evitar doble reserva. |
| Auth | **Better Auth** (email + contraseña, sesiones en DB, reset por mail); alternativa: Auth.js | El proveedor *credentials* de Auth.js obliga a usar JWT y no trae recuperación de contraseña. Better Auth sí: sesiones revocables con expiración y adapter de Prisma. Se valida con Context7 antes de usarlo. |
| Validación | **Zod** en cada server action y endpoint | Toda entrada se valida en servidor. |
| Estilos | **Tailwind** + tokens propios (dirección en `docs/design.md`) | |
| PDF | **@react-pdf/renderer** server-side | No necesita Chromium, así que el deploy es simple; maneja bien tablas largas paginadas con encabezado repetido. |
| Excel | **exceljs** | Lee .xlsx en servidor con tipos de celda; vista previa y errores antes de confirmar. |
| Mail | **Resend** (o SMTP con Nodemailer, según la respuesta 14) | Envío por lotes al publicar (~370 destinatarios). |
| Dinero | **Enteros en centésimos** (`Int` en DB) + módulo `dinero.ts` | Nunca floats. Redondeo explícito y testeado. |
| Tests | **Vitest** (unitarios) + **Playwright** (e2e) | |

Simplificaciones elegidas (se avisan explícitamente):
- Sin colas ni workers: los mails salen al publicar, en lotes, registrados en una tabla `EnvioMail` (outbox) con reintento manual desde la UI.
- Sin multi-edificio: un solo complejo, configurable.
- Las reglas de cada espacio se guardan como JSON validado con Zod, no como un motor de reglas.

## 3. Modelo de datos (borrador)

```
Torre(id, codigo:int [2..6, 444?], nombre)                // Avenue, Sky, Pilay, ...
Unidad(id, torreId, numero:string, tipo[APTO|LOCAL|GARAJE|OFICINA],
       etiqueta, coefGC, coefGarage, tieneGarage, arrendada:bool)
Persona(id, unidadId, calidad[PROPIETARIO|PROMITENTE|INQUILINO],
        nombre, telefono, email, activa, altaEn, bajaEn)
Usuario(id, email, hash, rol[ADMINISTRACION|COMISION|PORTERIA|UNIDAD],
        personaId?, activo) + Sesion + Verificacion (invitación/reset)

-- Liquidación
Liquidacion(id, periodo 'AAAA-MM', estado[BORRADOR|PUBLICADA|ANULADA],
            tasaInteres, tasaFR, publicadaEn, publicadaPor, pdfKey, motivoAnulacion)
LineaLiquidacion(liquidacionId, unidadId, sufijo[A|P|I], saldoAnterior, pagos,
                 intereses, gcUnidad, gcGarage, fondoReserva, tag, barbacoaOtros,
                 multas, total)                            // centésimos
Ingreso(liquidacionId, unidadId, sufijo, fecha, monto, referencia, origen[EXCEL|MANUAL], importacionId?)
ImportacionIngresos(id, archivoNombre, filas, errores, confirmadaEn, usuarioId)
DepositoNoIdentificado(fecha, forma, documento, monto, identificadoEn?, unidadId?, sufijo?)
Rubro(id, codigo '4.6', nombre, padreId?, cargoPropietario:bool, activo)
Proveedor(id, nombre)
Egreso(liquidacionId, rubroId, proveedorId, fecha, periodo, detalle, monto, fijoId?)
EgresoFijo(rubroId, proveedorId, detalle, montoSugerido, activo)   // se precarga cada mes
MovimientoFondo(...)                                       // disponibilidades (según duda 10)

-- Reservas
Espacio(id, nombre, torreId?, tipo[BARBACOA|LAUNDRY|OTRO], estado[ACTIVO|PENDIENTE_DEFINICION|INACTIVO],
        reglas:json, tarifa)
Reserva(id, espacioId, fecha, franja, unidadId, sufijo, creadaPorId, estado[ACTIVA|CANCELADA], canceladaPorId)
   UNIQUE (espacioId, fecha, franja) WHERE estado = 'ACTIVA'   // anti doble reserva en la base

-- Otros módulos
Contacto(categoria, nombre, telefono, detalle:json, orden)   // comisión, ascensores, etc.
Servicio(tipo[UTE|OSE|SANEAMIENTO], cuenta, direccion, detalle)
Poliza(aseguradora, numero, vigenciaDesde, vigenciaHasta, detalle)
Solicitud(id, unidadId, autorId, categoria, asunto, texto, estado[NUEVA|EN_CURSO|RESUELTA]) + SolicitudEvento
Comunicado(tipo[AVISO|ACTA|NORMATIVA], titulo, fecha, cuerpo?, archivoKey?, publicadoPor)
EnvioMail(tipo, destinatario, asunto, estado, error, refId)
Auditoria(usuarioId, accion, entidad, entidadId, antes:json, despues:json, ip, fecha)
```

Notas:
- El sufijo A/P/I se deriva de `Unidad.arrendada`. No se guarda como texto libre.
- El saldo arrastra por (unidad, sufijo): cada liquidación toma el saldo final de la anterior.
- Archivos (PDFs) detrás de una interfaz `storage` (disco local en dev; Blob/S3 según el hosting).

## 4. Permisos (matriz, se testea en `permisos.test.ts`)

| Acción | Administración | Comisión | Portería | Unidad (P/A) | Unidad (I) |
|---|---|---|---|---|---|
| Ver liquidación propia (línea + secciones generales) | ✔ | ✔ | — | ✔ | ✔ |
| Ver consolidado de todas las unidades | ✔ | ✔ (lectura) | — | — | — |
| Confeccionar / publicar / anular liquidación | ✔ | — | — | — | — |
| Reservar / cancelar para su unidad | ✔ | — | — | ✔ | ✔ |
| Reservar / cancelar en nombre de cualquier unidad | ✔ | — | ✔ | — | — |
| Ver datos personales de su unidad | ✔ | ✔ | — | ✔ | solo los propios |
| Alta / baja de inquilino | ✔ | — | — | ✔ | baja propia |
| Teléfonos: ver / editar | ✔ / ✔ | ✔ / — | ✔ / — | ✔ / — | ✔ / — |
| Solicitudes: crear / ver propias / gestionar todas | — / — / ✔ | ✔ / ✔ / ver | ✔ / ✔ / — | ✔ / ✔ / — | ✔ / ✔ / — |
| Comunicados: ver / publicar | ✔ / ✔ | ✔ / — | ✔ / — | ✔ / — | ✔ / — |

Se implementa como una función `puede(usuario, accion, recurso)` que llaman **todas** las server actions y endpoints, más filtros de consulta por `unidadId` (nunca se confía en la UI).

## 5. Estructura de carpetas

```
prisma/            schema.prisma, migrations/, seed.ts (datos ficticios)
src/
  app/
    (publico)/ingresar, recuperar, invitacion/[token]
    (app)/page.tsx                      home con los 6 botones
    (app)/liquidaciones/                listado y detalle por mes
    (app)/liquidaciones/confeccion/[periodo]/{ingresos,egresos,revision}
    (app)/reservas/  (app)/datos/  (app)/telefonos/  (app)/solicitudes/  (app)/comunicados/
    (app)/admin/                        unidades, usuarios, rubros, espacios, auditoría
    api/archivos/[id]/route.ts          descarga con control de acceso
  dominio/          lógica pura y testeable: dinero.ts, codigos.ts, liquidacion/calculo.ts, reservas/reglas.ts
  servidor/         db.ts, auth.ts, permisos.ts, auditoria.ts, mail/, pdf/, storage/, acciones por módulo
  componentes/      ui/ (sistema de diseño) + por módulo
tests/unit/  tests/e2e/
docs/design.md  docs/PLAN.md
```

## 6. Fases

| Fase | Entrega | Cierre |
|---|---|---|
| 1. Base | Proyecto, Postgres + Prisma, auth (login, sesión, reset, invitación), roles + matriz de permisos con tests, auditoría, layout, `docs/design.md` + componentes base, home con 6 botones | tests + build + revisión con Playwright en 390/768/1280 |
| 2. Unidades y datos | ABM de torres/unidades (admin), flujo propietario → ¿arrendado? → inquilino + invitación, baja de inquilino (A ↔ P+I), mails de destinatarios | e2e alta/baja de inquilino |
| 3. Liquidación | Rubros, egresos fijos/variables, ingresos manuales + importación Excel con vista previa, cálculo, revisión, publicación (PDF + envío), anulación auditada, vista por unidad | unitarios del cálculo (incluye replicar las reglas del PDF con datos ficticios) + e2e publicar |
| 4. Reservas | Espacios configurables, calendario, reglas, 48 h, portería en nombre de unidad, Laundry "pendiente de definición" | e2e reservar/cancelar, test de concurrencia |
| 5. Teléfonos/servicios | Contactos, UTE/OSE/saneamiento, pólizas con alerta de vencimiento | |
| 6. Solicitudes | Formulario, estados, mail a Administración, botón wa.me, historial | |
| 7. Comunicados | Avisos, actas, normativa, subida de PDF, mail opcional | |
| 8. Pulido | Accesibilidad AA, estados vacíos/carga/error, e2e completos, README, CLAUDE.md, deploy | |

## 7. Decisiones tomadas (respuestas a las dudas de la Fase 0)

1. Código de línea: `{torre}-{nro}-{A|P|I}` (formato del PDF, ej. `2-201-P`).
2. Torres: 2 Avenue, 3 Sky, 4 Pilay, 5 NE (Sky Nueva Etapa). Los garajes se gestionan aparte (sector 6 en el PDF). Locales y oficina son unidades dentro de una torre. Unidad.tipo = APTO | LOCAL | GARAJE | OFICINA.
3. Una persona puede tener varias unidades con un solo usuario.
4. Un responsable con usuario + mails extra que solo reciben envíos.
5. GC unidad: método **sin definir**. Por ahora es un **monto fijo por unidad** (GC unidad, GC garaje, parte de cargo del propietario), editable por Administración, que se arrastra de mes a mes. El cálculo queda aislado en `dominio/liquidacion` para poder cambiar el método después.
6. División P/I: FR + rubros de cargo del propietario → P; ordinario → I; garaje configurable por unidad.
7. Cambio A ↔ P+I: el saldo queda en P (o vuelve a A); el I arranca en 0.
8. FR = 5% (configurable). Columna "Cuota extra FR" visible solo si se usa.
9. Tag = cargo extra puntual (ej. tag de la puerta). Las reservas de barbacoa generan el cargo automático en Barbacoa/Otros.
10. Fondos: saldos cargados a mano + lista de depósitos no identificados con "identificar → asignar".
11. Pagos: hoy no hay sistema. Se guarda todo en `Ingreso(fecha, código unidad, monto, origen, referencia)`. **v1:** carga manual + importación Excel/CSV con ese formato. **Fase 9 (nueva):** pagos en línea (Mercado Pago con webhook) y archivos de cobranza de Abitab/Redpagos; cada uno necesita un convenio comercial del edificio.
12. La primera liquidación toma los saldos anteriores de un Excel inicial.
13. El PDF de la liquidación lo ve **completo** todo usuario (como hoy). Las pantallas igual restringen nombres, teléfonos y mails por unidad.
14. Anulación: solo Administración, con motivo obligatorio, auditada; se reenvía como "rectificada".
15. Barbacoas: turnos mediodía 11–17 y noche 19–02, hasta 60 días de anticipación, máx. 2 reservas activas por unidad, reservan I/A y P, cancelación hasta 48 h. Bloqueo a morosos: más adelante (se deja el punto de extensión).
16. Laundry: funciona con tarjeta prepaga; no hay nada que reservar. Queda como espacio **informativo** (sin reservas) y su consumo eléctrico es gasto común general.
17. Mail: pendiente (ver explicación en el chat). En desarrollo, los mails no salen: se ven en un buzón local de prueba.
18. Hosting: Vercel + Neon + Vercel Blob (la ubicación de los datos queda a confirmar por el asesor, Ley 18.331).
19. WhatsApp: número de Administración, configurable.
20. Portería ve solo el código de la unidad y el nombre del ocupante.

## 8. Manejo de los documentos sensibles

- `.gitignore` excluye los PDF/planillas de `docs/` y la spec (tiene una imagen embebida); nada de eso se commitea salvo que lo indiques.
- El texto del PDF se extrajo solo localmente para analizar la estructura y se borró al terminar.
- El seed y los tests usan nombres, montos y mails inventados (dominio `example.com`).
- A las consultas a Context7 solo van nombres de librerías y APIs, nunca datos del edificio.
