# Plan — Sistema de administración y liquidación de gastos comunes

Fase 0. Documento vivo: se actualiza con las respuestas a las dudas.
Fuentes: `docs/Proyecto 1.doc.md` (spec) y el PDF modelo de liquidación (setiembre 2026).

**Desde la Fase 4, la fuente de verdad de qué pantallas y botones existen, en qué orden
y quién entra es [`docs/PROYECTO-EN-GRAFICO.md`](PROYECTO-EN-GRAFICO.md).** Donde difiere
de "Proyecto 1", gana ese documento.
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
| Reservar / cancelar en nombre de cualquier unidad | ✔ | — | ✔ (cancelar, dentro de las 48 h) | — | — |
| Cancelar fuera de plazo (menos de 48 h) | ✔ | — | — | — | — |
| Ver qué unidad reservó cada turno | ✔ | — | ✔ | solo las propias | solo las propias |
| Configurar espacios, tarifas y reglas | ✔ | — | — | — | — |
| Ver datos personales de su unidad | ✔ | solo de su unidad (decisión 36) | — | ✔ | solo los propios |
| Ver código + nombre del ocupante de todas | ✔ | ✔ | ✔ | — | — |
| Avisar venta de la unidad | — | — | — | ✔ (propietario o promitente) | — |
| Alta / baja de inquilino | ✔ | — | — | ✔ | baja propia |
| Teléfonos: ver / editar | ✔ / ✔ | ✔ / — | ✔ / — | ✔ / — | ✔ / — |
| Solicitudes: crear / ver propias / gestionar todas | — / — / ✔ | si tiene unidad / ✔ / ver (sin notas internas) | por sí o a pedido de una unidad / ✔ / — | ✔ / ✔ / — | ✔ / ✔ / — |
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

Las fases 0 a 3 se hicieron con "Proyecto 1". Desde la 4, siguen "Proyecto en gráfico".

| Fase | Entrega | Estado |
|---|---|---|
| 1. Base | Proyecto, Postgres + Prisma, auth (login, sesión, reset, invitación), roles + matriz de permisos con tests, auditoría, layout, `docs/design.md` + componentes base, home con 6 botones | Hecha |
| 2. Unidades y datos | ABM de torres/unidades, flujo propietario → ¿arrendado? → inquilino + invitación, baja de inquilino (A ↔ P+I), mails extra | Hecha |
| 3. Liquidación | Rubros, egresos fijos/variables, ingresos manuales + planilla con vista previa, cálculo, revisión, publicación (PDF + envío), anulación y rectificación, recibo por unidad | Hecha |
| 4. Estructura según "Proyecto en gráfico" | Home en el orden de C.0, sub-botones por módulo, Liquidación mensual (última / anteriores), Confección con Egresos e Ingresos, egresos por planilla, columnas del gráfico (Barbacoas, Otros, Cuota extra F.R.), Datos con "Editar" y "Avisar venta", Comisión sin datos personales ajenos | Hecha |
| 5. Reserva de espacios comunes | Barbacoas (3, 2 turnos, 48 h, Portería a pedido), Solarium atado a su barbacoa, Laundry informativo, cargo de barbacoas en la liquidación, configuración de espacios | Hecha |
| 6. Solicitudes varias | Desperfectos, consultas de GC, inquietudes; Portería propia o a pedido; bandeja de Administración con respuestas y notas internas; mail y wa.me; aviso de venta como solicitud | Hecha |
| 7. Comunicados de la Administración | Avisos, reglamentos y actas con PDF, orden por fecha, envío por mail opcional | Hecha |
| 8. Teléfonos y datos de interés | Administración, Comisión (con consentimiento), Portería, empresas, servicios públicos, seguro de incendio con alerta de vencimiento | Hecha |
| 9. Pulido y producción | Accesibilidad AA, estados vacío/carga/error, e2e por rol, seed completo, docs, deploy (Vercel + Neon + Blob), mail real, rama `main` | Hecha, salvo el deploy y la rama `main` (esperan OK) |
| 10. Pagos en línea (posterior) | Mercado Pago con webhook, archivos de cobranza de Abitab/Redpagos (decisión 11) | No arrancar sin pedido |

Cierre de cada fase: lint, typecheck, unitarios, build + e2e, revisión con Playwright en 390/768/1280, docs al día, commit y push, resumen y OK antes de seguir.

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

### Decisiones de implementación de la Fase 3 (liquidación)

21. **Cuotas:** cada unidad tiene tres montos fijos (gasto común ordinario, parte de cargo del propietario, garaje) y quién paga el garaje si está alquilada. Se editan en el paso "Cuotas" de la confección y valen desde ese mes en adelante.
22. **Cambio P+I → A:** si se va el inquilino con deuda, su saldo pasa a la línea A (el propietario responde por los gastos comunes de la unidad). A → P+I: el saldo queda en P y el inquilino arranca en cero.
23. **Qué ve cada uno:** el responsable ve todas las líneas de su unidad; el inquilino solo la I, y solo desde el mes en que entró. El consolidado en pantalla, solo Administración y Comisión. El PDF completo, todos (decisión 13).
24. **Planillas:** si una fila tiene errores no se carga ninguna (se corrige la planilla y se sube de nuevo). Los avisos (fecha de otro mes, pago repetido) no bloquean. Formato: `Fecha | Unidad | Monto | Referencia`; saldos iniciales: `Unidad | Saldo`. Acepta .xlsx y .csv.
25. **Disponibilidades:** se cargan a mano los saldos iniciales (se arrastran solos del mes anterior) y la parte de los ingresos que va al fondo de reserva; ingresos, depósitos identificados, egresos y saldo final se calculan.
26. **Publicación:** líneas + PDF + bandeja de mails en una sola transacción; los mails salen después, de a 10, cada uno con la línea de la persona y el PDF adjunto. Los que fallan se reintentan desde la pantalla de la liquidación.
27. **Anulación:** solo la última publicada (y si no hay un borrador de un mes posterior). Queda como historia con su motivo y se abre una copia en borrador que, al publicarse, sale como "rectificada".
28. **PDF:** @react-pdf con Helvetica (no descarga fuentes), guardado en la base (tabla `archivo`). Simple y suficiente para ~12 PDFs por año; si crece, se pasa a Vercel Blob detrás de la misma interfaz.
29. **Pendiente para más adelante:** columna "Cuota extra FR" (no se usa hoy), cargo automático de barbacoa desde Reservas (Fase 4) y buscador en la pantalla de cuotas para las ~370 líneas reales.

### Decisiones de la Fase 4 (estructura según "Proyecto en gráfico")

30. **Fuente de verdad:** `docs/PROYECTO-EN-GRAFICO.md` para pantallas, botones, orden y acceso.
31. **Navegación de dos niveles:** cada módulo tiene una pantalla con sus sub-botones (la misma tecla, más chica y sin descripción), en el orden de C.0 y filtrados por permiso. Si el usuario ve un solo sub-botón, se salta ese nivel.
32. **Liquidación:** `Liquidación mensual` (Última liquidación / Liquidaciones anteriores) y `Confección de la liquidación mensual` (solo Administración). La última es la publicada más nueva (por consulta: al publicar, la anterior pasa sola a "anteriores"). La confección es una pantalla del borrador con dos teclas, Egresos e Ingresos, y como acciones secundarias Cargos del mes, Cuotas, Fondos y textos y Revisar y publicar. **Reemplaza** la barra de pasos numerados de la Fase 3.
33. **Columnas** (tabla, recibo y PDF), como el gráfico: Saldo anterior, Pagos, Saldo, Intereses, G.C. unidad, G.C. garaje, Fondo de reserva, Cuota extra F.R., Barbacoas, Otros, Multas, Total a pagar. Tag pasa a Otros; los cargos "Barbacoa / otros" ya cargados pasan a Otros. "Intereses" es solo el interés calculado; los ajustes manuales (incluso negativos, para bonificar) van a Otros. **Cambia** las decisiones 9 y 29.
34. **Cuota extra F.R.:** monto fijo por unidad que se arrastra como las cuotas (cero si no se usa). La paga A, o P si está alquilada. No lleva el 5 % del fondo. En el PDF la columna sale siempre; en el recibo, solo si hay monto. **Cambia** la decisión 8.
35. **Agrupación de columnas:** sin fondos de color; encabezado de dos niveles "Estado de cuenta" y "Cargos del mes" en pantalla y PDF.
36. **Comisión y datos personales:** la Comisión ve las unidades como Portería (código + nombre del ocupante). Si tiene unidad propia, ve sus datos. Sigue viendo el consolidado de la liquidación (montos por código, sin teléfonos ni mails). **Cambia** la tabla de permisos (§4) en "Ver datos personales".
37. **Egresos por planilla:** `Fecha | Rubro (código) | Proveedor | Período | Monto`, .xlsx o .csv, con vista previa; si una fila tiene error no se carga ninguna. El rubro tiene que ser un subrubro (ej. 3.3). El período va al detalle del egreso.
38. **Datos:** la pantalla de la unidad muestra los datos propios y la tecla Editar, que abre el flujo existente (responsable → ¿alquilada? → inquilino). Los mails extra quedan dentro de Editar.
39. **Avisar venta de la unidad** (propietario o promitente): crea una `Solicitud` de categoría VENTA_UNIDAD (tabla mínima que la Fase 6 completa) y manda mail a los usuarios de Administración. Administración ve el aviso pendiente en la ficha de la unidad y lo cierra al hacer el cambio de propietario (que ya existía: baja del anterior, alta del nuevo con invitación, saldo en la línea de la unidad, auditado).
40. **Estilo:** se mantiene "El hall del edificio" (no el gris azulado del gráfico).
41. **Rutas:** `/liquidaciones` → `/liquidaciones/mensual` → `/liquidaciones/ultima` y `/liquidaciones/anteriores`; el detalle de un mes sigue en `/liquidaciones/AAAA-MM`. Los sub-botones de módulos sin hacer van a `/{modulo}/{sub}` con el aviso "en construcción". Datos: `/datos` (ver) y `/datos/editar`.
42. **Al publicar** se redirige a Última liquidación. Los mails siguen enlazando al mes (`/liquidaciones/AAAA-MM`), que es una dirección que no cambia.
43. **Liquidaciones ya publicadas:** guardan su foto. Al migrar, Tag y Barbacoa/otros pasaron a Otros; sus intereses quedan como estaban (incluían los ajustes de "Intereses y otros"). Los PDF ya guardados no se regeneran.
44. **PDF:** sin cortar palabras con guion en los encabezados angostos.

### Decisiones de la Fase 5 (reservas)

45. **Solarium (F.4):** uno por barbacoa (`Espacio.barbacoaId`), no se reserva. La pantalla muestra, por día y turno, si está disponible (su barbacoa sin reserva activa) o no.
46. **Tarifa y a quién se cobra (F.5):** tarifa fija por barbacoa (por turno), editable por Administración en *Configurar los espacios* (seed: $U 800, inventado). Se cobra a la línea de quien reservó (I si fue el inquilino; A o P si fue el dueño); si reservó Portería o Administración, a la línea que eligieron por código. Si la unidad cambió de situación, se ajusta: sin alquilar → A; alquilada y reservó A → P.
47. **Qué ven las demás unidades:** solo libre u ocupado. Administración y Portería ven el código de la unidad que reservó y quién lo pidió (`reserva.verQuien`).
48. **Turnos y plazos:** hora de Uruguay (UTC−3, sin horario de verano). Mediodía 11–17, noche 19–2 del día siguiente. Las 48 h se cuentan desde el inicio del turno. Una reserva cuenta para el máximo por unidad hasta que termina su turno. Se puede reservar el mismo día si el turno no empezó.
49. **Cancelar:** la unidad y Portería, hasta 48 h antes; Administración, siempre (`reserva.cancelarFueraDePlazo`). Una reserva ya cobrada en una liquidación no se cancela: primero se quita el cargo en la confección.
50. **Reglas por espacio:** JSON validado con Zod (`anticipacionDias`, `maxActivasPorUnidad`, `horasCancelacion`); si falta o está mal, valen las de la decisión 15. El máximo de reservas activas es por unidad, sumando todas las barbacoas.
51. **Doble reserva:** índice único parcial `(espacioId, fecha, turno) WHERE estado = 'ACTIVA'` en la base; la unidad se bloquea (`FOR UPDATE`) al reservar para que dos pedidos simultáneos no salteen el máximo.
52. **Cobro en la liquidación:** botón "Traer las reservas de barbacoa del mes" en *Cargos del mes*. Cada cargo BARBACOAS guarda su reserva (`CargoExtra.reservaId`, en lugar de `Reserva.liquidacionId`): así repetir no duplica, quitar el cargo libera la reserva para volver a traerla, y al anular la copia conserva el vínculo. Si un espacio no tiene tarifa, se avisa y no se cobra.
53. **Laundry:** espacio informativo con un texto que edita Administración. El reglamento de barbacoas se enlaza en la Fase 7.

### Decisiones de la Fase 6 (solicitudes)

54. **Rutas:** `/solicitudes/desperfectos`, `/consultas` e `/inquietudes` (formulario de la categoría y, abajo, "Mis solicitudes"); `/solicitudes/ver/{id}` (detalle con historial); `/solicitudes/bandeja` (Administración y Comisión). Administración y la Comisión sin unidad no crean solicitudes: al tocar una categoría van a la bandeja filtrada.
55. **Qué ve cada uno:** "Mis solicitudes" son las que hizo el usuario y las que Portería cargó a pedido de sus unidades. Una unidad no ve las de otra (ni las de otra persona de su misma unidad). La Comisión lee la bandeja sin las notas internas.
56. **Portería:** al crear elige "Por mí (Portería)" (sin unidad) o "A pedido de una unidad" (código `2-201` y quién lo pidió). Matriz: `solicitud.crear` incluye a Portería sobre cualquier unidad y `solicitud.crearPorteria` es la propia.
57. **Historial:** `SolicitudEvento` (RESPUESTA, CAMBIO_ESTADO, NOTA_INTERNA). Responder pasa una solicitud nueva a "en curso" (o a resuelta si se marca) y le manda un mail al autor. Los cambios de estado se auditan.
58. **Mail y WhatsApp:** al crear, mail a los usuarios de Administración. El número de WhatsApp (decisión 19) se guarda en `Configuracion.whatsapp` y se edita en la bandeja; con número cargado, la unidad ve "Escribir por WhatsApp" (enlace wa.me con categoría + unidad + asunto) al enviar y en el detalle. Sin API de WhatsApp.
59. **Aviso de venta:** es una solicitud VENTA_UNIDAD (Fase 4); aparece en la bandeja con un enlace a la ficha de la unidad y se resuelve al cambiar de propietario.
60. **Foto en desperfectos:** no se hizo (era opcional). Queda como pendiente si se quiere: usaría la tabla `Archivo` con límite de tamaño.

### Decisiones de la Fase 7 (comunicados)

61. **Modelo:** `Comunicado(tipo, titulo, fecha, cuerpo, archivoId, publicadoPorId, enviadoPorMail, orden, activo)`. La baja es lógica (`activo = false`): deja de verse y queda la historia. Publicar, editar y dar de baja se auditan.
62. **PDF:** en la tabla `Archivo` (como la liquidación), hasta 3 MB (límite de las server actions y de una función de Vercel), validado por contenido (`%PDF-`), no por extensión. Se baja por `/api/comunicados/{id}/pdf` con sesión (`comunicado.ver`). Si se reemplaza en una edición, el anterior se borra. Archivos más grandes: pasar a subida directa a Vercel Blob en la Fase 9.
63. **Qué lleva cada tipo:** aviso y acta, texto, PDF o las dos cosas; reglamento, PDF obligatorio. Avisos y actas por fecha (lo último arriba); reglamentos en el orden que elige Administración (subir/bajar).
64. **Mail:** casilla "Enviar por mail a todos", marcada por defecto en avisos y desmarcada en actas; los reglamentos no se mandan. Mismos destinatarios que la liquidación (sin repetir), por la bandeja `EnvioMail` (tipo `comunicado`), de a 10, con el PDF adjunto y un enlace. Si alguno falla, se reintenta desde el comunicado.
65. **Reglamento de barbacoas:** el reglamento cuyo título dice "barbacoa" se enlaza desde la pantalla de Barbacoas.

### Decisiones de la Fase 8 (teléfonos y datos de interés)

66. **Modelo:** `FichaContacto` (una fila por Administración y Portería, JSON validado con Zod), `Contacto` (Comisión, empresas y servicios públicos) y `Poliza` (seguro de incendio). Todo lo carga Administración (`telefonos.editar`), con auditoría; los demás ven (`telefonos.ver`).
67. **Comisión y consentimiento (Ley 18.331):** Administración carga a cada integrante y marca "Dio su consentimiento"; se guarda la fecha y quién lo registró. Sin consentimiento, el integrante solo lo ve Administración. Si se quita, deja de mostrarse.
68. **Llamar:** cada teléfono es un botón `tel:` de 48 px. Si hay varios en un campo (separados con `/`, `,` u `o`), sale un botón por cada uno.
69. **Servicios públicos:** servicio, dirección, número de cuenta y titular (datos del recibo), sin montos.
70. **Seguro de incendio:** se muestra la póliza con la vigencia más reciente. Con 30 días o menos para el vencimiento (o vencida), aviso en la pantalla del seguro (para todos) y en el inicio de Administración, y un mail a Administración una sola vez por vigencia (`Poliza.avisoVencimientoEn`). Sin colas ni workers: la revisión corre cuando Administración entra al inicio o al seguro, y también está `/api/cron/seguro` (con `CRON_SECRET`) para programarla en el hosting. "Cargar la renovación" crea una póliza nueva; "Corregir los datos" edita la actual. El seed deja una póliza que vence en 20 días para ver el aviso.
71. **Rutas genéricas:** con todos los módulos hechos, se quitó `/[modulo]/[sub]` ("en construcción").

### Decisiones de la Fase 9 (pulido y producción)

72. **Accesibilidad:** `tests/e2e/roles.spec.ts` recorre con los 4 roles el inicio, los 6 módulos y cada sub-botón (más las pantallas internas de Administración), en 390 y 1280 px, con axe (WCAG 2.1 A y AA), título visible y sin scroll horizontal. Hoy no hay errores.
73. **Mail real:** driver `resend` por la API HTTP (sin SDK), con adjuntos en base64 y timeout de 15 s. En Vercel es el driver por defecto (el disco es de solo lectura). Un rechazo de Resend deja el envío con error para reintentar. Sigue pendiente elegir el dominio del remitente (decisión 17).
74. **Estados:** `loading.tsx` (esqueleto con la forma de una pantalla de teclas), `error.tsx` (qué pasó, "Probar de nuevo" y el código para los logs, sin detalle técnico) y `global-error.tsx`. Los vacíos de cada lista dicen qué hacer.
75. **Producción:** `vercel-build` aplica las migraciones antes de compilar; `DIRECT_URL` opcional para migrar sin el pooler de Neon; `vercel.json` con región `gru1` (a confirmar con el asesor) y el cron diario del seguro; `scripts/crear-admin.ts` crea el primer usuario de Administración sin seed (crea su clave con "Me olvidé la contraseña"). Archivos en la base (decisión 28): Vercel Blob no hace falta con el volumen actual. Guía: `docs/DEPLOY.md`.
76. **Seed completo:** liquidación de setiembre publicada, espacios y reservas, solicitudes con respuesta y nota, comunicados con PDF, teléfonos, Comisión con y sin consentimiento y una póliza que vence en 20 días. Todo inventado (`@example.com`).

### Decisiones después de la Fase 9

77. **Mail desde Gmail:** Resend no puede mandar desde `gmail.com` (pide un dominio propio verificado), así que el driver de producción es **SMTP de Gmail** con contraseña de aplicación (`SMTP_USER`, `SMTP_PASS`). Gmail pone siempre la cuenta como remitente; `MAIL_FROM` da el nombre. Resend queda disponible para un dominio propio. **Cambia** la decisión 73.
78. **Mails ficticios:** a `example.com` (dominio reservado, RFC 2606) nunca se manda nada, con ningún driver real: la demo no rebota mails ni perjudica la cuenta de Gmail.
79. **Avisos que no fallan:** los mails sueltos (solicitud nueva, respuesta, aviso de venta, seguro, invitación) no hacen fallar la acción si el mail no sale: queda en el log. Los envíos masivos (liquidación, comunicados) siguen en `EnvioMail` con reintento.
80. **Foto en desperfectos:** opcional, una por solicitud. El navegador la achica (lado mayor 1600 px, JPEG) antes de subir; el servidor acepta JPG, PNG o WebP de hasta 3 MB, por contenido. Se guarda en `Archivo` y se ve en el detalle con el mismo acceso que la solicitud (`/api/solicitudes/{id}/foto`). Resuelve la decisión 60.
81. **Demo:** Vercel + Neon con el seed ficticio, región São Paulo (`gru1` / `sa-east-1`), acceso con el enlace (sin la protección de Vercel) y los usuarios de prueba.

### PropiedadH y varios edificios

82. **Botón de emergencia:** en la cabecera, para todos. Primero "¿Ya llamaste al 911?" con llamada directa al 911, a Portería y a la Administración; después el tipo (gas, incendio, agua, ascensor, seguridad, otra), dónde y un detalle, y una segunda confirmación manteniendo apretado el botón 2 s. Llega al instante (mail y franja roja que se actualiza cada 15 s y suena) a Portería, Administración y Comisión del edificio, con quién avisó. El aviso a todas las unidades lo da Portería o Administración, tildando que lo comprobó, sin decir quién avisó (Ley 18.331). Se cierra como "Atendida" o "Falsa alarma" (si se había avisado a todos, les llega el fin). Una misma persona puede avisar cada 5 minutos. Sin servicios pagos (sin SMS ni llamadas automáticas por ahora).
83. **Marca PropiedadH:** "Propiedad" con la H en una placa de bronce. `/` es la pantalla de inicio pública ("Administración de Edificios de Propiedad Horizontal", cómo funciona, qué ve cada uno); el panel pasó a `/inicio`, sin saludo. Con sesión, `/` muestra "Ingresar", que lleva al panel.
84. **Pedido de acceso:** quien no tiene usuario lo pide desde el login (`/pedir-acceso`: nombre, mail, teléfono, edificio si hay más de uno, unidad, calidad y permiso para usar los datos). Siempre responde lo mismo (no revela quién tiene usuario); campo trampa, un pedido pendiente por mail y tope por hora. La Administración lo revisa en Datos → Unidades → Pedidos de acceso: aprobar carga a la persona (como inquilino, o como responsable en reemplazo del anterior, avisándolo antes) y le llega la invitación; rechazar le avisa por mail.
85. **Varios edificios:** una sola app y una sola base, con `edificioId` en los datos raíz. Cada edificio es independiente (unidades, liquidación, cobranza, espacios, comunicados, teléfonos, emergencias). La sesión tiene un **edificio activo** (cookie validada contra los edificios del usuario) y todo servicio filtra por él; `exigirPermiso` además controla que una unidad pedida sea del edificio activo. Las torres guardan su número visible (`numero`, el "2" de 2-201) aparte de la clave interna, para que dos edificios puedan tener una torre 2. El nombre y el color de cada torre están en la base.
86. **Roles por edificio y alta de edificios:** Administración, Comisión y Portería son membresías por edificio; quien solo tiene unidades es "Unidad" en ese edificio. Quien tiene varios edificios elige al entrar (`/edificios`) y cambia desde la cabecera. Un edificio nuevo lo pide un administrador (`/edificios/nuevo`, con sus torres) y lo aprueba el **dueño del sistema** (`User.duenoSistema`, `/sistema`); al aprobarlo, quien lo pidió queda como su Administración. `npm run dueno:crear -- mail` marca al dueño del sistema.
87. **Módulos por edificio:** la Administración prende o apaga Liquidación, Reservas, Solicitudes, Comunicados y Teléfonos (`/edificio`); Datos está siempre. Un módulo apagado no aparece en el inicio y su sección da "no encontrado". La **piscina** es un espacio informativo de Reservas (horarios y reglas, como el laundry) y aparece solo en los edificios que la tienen. "Mucamas" queda para más adelante.
88. **Torres por letra:** en los datos de ejemplo las torres se llaman A, B, C y D (y Garajes), y sus colores son variables neutras (`--torre-a`…), para no mostrar nombres reales.
89. **Verificación del mail al pedir acceso:** el pedido queda "sin verificar" y le llega a la persona un código de 6 números (vale 30 minutos, 5 intentos, se guarda solo su hash). Recién con el código correcto el pedido pasa a la Administración. Quien es dado de alta por la Administración confirma su mail al usar el enlace de la invitación.
90. **Nombre y apellido por separado** en personas y pedidos de acceso (lo existente se partió en el primer espacio; cada uno lo corrige desde "Editar mis datos").
91. **Venta con datos del comprador:** el propietario o promitente avisa la venta cargando calidad, nombre, apellido, teléfono y mail del comprador. La Administración la confirma en la ficha (el comprador entra como responsable con su invitación, el vendedor sale; la unidad nunca queda sin dueño; el inquilino sigue) o la rechaza con motivo. Administración y Comisión ven el **historial de la unidad**: quiénes fueron responsables e inquilinos, con fechas de alta y baja.

## 8. Manejo de los documentos sensibles

- `.gitignore` excluye los PDF/planillas de `docs/` y la spec (tiene una imagen embebida); nada de eso se commitea salvo que lo indiques.
- El texto del PDF se extrajo solo localmente para analizar la estructura y se borró al terminar.
- El seed y los tests usan nombres, montos y mails inventados (dominio `example.com`).
- A las consultas a Context7 solo van nombres de librerías y APIs, nunca datos del edificio.
