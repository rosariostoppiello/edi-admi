# "Proyecto en gráfico" (transcripción)

Fuente de verdad de qué pantallas y qué botones existen, en qué orden y quién entra
(ver `docs/PLAN.md`). Donde difiere de "Proyecto 1", gana este documento.
No tiene datos personales.

## C.0 Página 0: mapa general de botones

Seis botones principales, en este orden (de izquierda a derecha en el gráfico), cada uno con sus sub-botones debajo, en este orden:

| # | Botón principal | Sub-botones (en orden) |
|---|---|---|
| 1 | LIQUIDACIÓN GASTOS COMUNES | Liquidación mensual · Confección liquidación mensual |
| 2 | RESERVA ESPACIOS COMUNES | Barbacoas · Solarium · Laundry |
| 3 | SOLICITUDES VARIAS | Aviso de desperfectos · Consultas gastos comunes · Inquietudes varias |
| 4 | COMUNICADOS ADMINISTRACIÓN | Avisos importantes · Reglamentos · Actas de asambleas |
| 5 | TELÉFONOS Y DATOS DE INTERÉS | Administración · Comisión administradora · Portería · Empresas · Servicios públicos · Seguro de incendio |
| 6 | DATOS PROPIETARIOS INQUILINOS | Editar |

Visualmente: los botones principales son rectángulos redondeados grandes (en el gráfico, gris azulado con texto en negrita); los sub-botones son rectángulos redondeados blancos con borde negro, apilados en columna debajo de su botón principal. Usuarios posibles: Administración, Comisión administradora, Portería, cada unidad.

## C.1 Página 1: Liquidación gastos comunes

- **Liquidación mensual** → dos sub-botones: Última liquidación · Liquidaciones anteriores.
  - Ingresan todos los usuarios.
  - Una vez que queda pronta la liquidación confeccionada, se sube automáticamente a "Última liquidación" y la que estaba ahí pasa a "Liquidaciones anteriores".
  - Una vez subida, se envía por mail a todos los mails registrados en "Datos propietarios inquilinos".
  - Las liquidaciones son por mes, según el modelo PDF (el de setiembre 2026 que ya se analizó en la Fase 0).
- **Confección liquidación mensual** → dos sub-botones: Egresos · Ingresos (en ese orden en el gráfico).
  - Ingresa solo la Administración.
  - Los egresos pueden extraerse de una planilla Excel.
  - Los ingresos deberían poder extraerse de una planilla que se arme con los datos de los lugares de pago (banco, redes de cobranza, etc.). "Ver tema de código para identificar" (el código de unidad como referencia del pago).
  - Se hace la liquidación con saldos anteriores, egresos y saldo final, por categorías: Gastos comunes, Fondo de reserva, y alguna más si se define.
  - Egresos: la Administración carga cada pago del mes con fecha, ente estatal o proveedor, período al que corresponde y monto. Hay egresos fijos (todos los meses) y variables. Categorías de ejemplo: consumos estatales, mantenimiento, sueldos, portería, limpieza, obras especiales.
  - Por unidad, con posibilidad de dividir entre propietario e inquilino: número de unidad con A al final si no se divide (no alquilada); con P o I si se divide. Cada unidad tiene además el número de torre (2, 3, 4 o 5).
  - Columnas de la liquidación por unidad (imagen embebida en el documento, en este orden): SALDO ANTERIOR | PAGOS | SALDO | INTERESES | GASTO COMÚN UNIDAD | GASTO COMÚN GGE | FONDO DE RESERVA | CUOTA EXTRA FONDO DE RESERVA | BARBACOAS | OTROS | MULTAS | TOTAL A PAGAR. En la imagen, Saldo anterior, Pagos, Saldo, Intereses, Multas y Total a pagar están en amarillo; Gasto común unidad, Gasto común garaje, Fondo de reserva, Cuota extra FR, Barbacoas y Otros en celeste (los cargos del mes).

## C.2 Página 2: Reserva espacios comunes

Sub-botones: Barbacoas · Solarium · Laundry.

- Ingresan todos los usuarios.
- En Barbacoas debe quedar registrado si la reserva la ingresa el propietario o inquilino, o Portería a solicitud del propietario o inquilino.
- Hay 3 barbacoas en 2 turnos (Barbacoa Torre Avenue, Barbacoa Torre Pilay, Barbacoa Torre Sky).
- Cada unidad, con su usuario, entra y reserva viendo qué está libre y qué no. Puede cancelar hasta 48 horas antes. El portero también puede reservar por la unidad cuando el usuario no sabe o no puede usar el sistema.
- Una vez concluido el mes, se carga en la LIQUIDACIÓN el costo de la barbacoa.
- Cada solarium solo se puede usar si no hay reserva de su barbacoa.
- El laundry tiene un sistema especial independiente.

## C.3 Página 3: Solicitudes varias

Sub-botones: Aviso de desperfectos · Consultas gastos comunes · Inquietudes varias.

- Ingresan todos los usuarios.
- Debe quedar registrado quién hace la solicitud. Si es el portero, debe decir si es por sí mismo o a pedido de un propietario o inquilino.
- Ver cómo se gestiona y se da respuesta.
- Ver cómo organizar para que los usuarios de las unidades puedan enviar mail y/o WhatsApp, con las distintas categorías.

## C.4 Página 4: Comunicados Administración

Sub-botones: Avisos importantes · Reglamentos · Actas de asambleas.

- Ingresan todos los usuarios. La Administración es quien sube todos los documentos.
- Avisos: por fecha, los últimos más arriba.
- Actas de asamblea: por fecha, las últimas más arriba.
- Reglamentos (normativa): Reglamento de copropiedad, Reglamento de barbacoas, Reglamento interno, etc.

## C.5 Página 5: Teléfonos y datos de interés

Sub-botones: Administración · Comisión administradora · Portería · Empresas · Servicios públicos · Seguro de incendio.

- Ingresan todos los usuarios. La Administración es quien carga todos los datos.
- Comisión administradora: nombres, unidades y teléfonos.
- Ascensores, empresa de Portería, empresa de Limpieza, Sanitaria, Bombas de agua: nombre de la empresa y teléfono.
- UTE de espacios comunes, OSE, Tarifa de saneamiento: datos de los recibos.
- Seguro de incendio: datos de la vigencia de las pólizas.

## C.6 Página 6: Datos propietarios inquilinos

Sub-botón: Editar.

- Ingresan todos los usuarios, pero solo ven sus datos propios.
- Los usuarios de unidades modifican: nombre, calidad (propietario, promitente comprador, inquilino), teléfono de contacto y mail. Ese mail es el que recibe la liquidación mensual y los comunicados.
- Primero entra el propietario o promitente comprador, carga sus datos y se le pregunta si la unidad está arrendada (sí/no).
  - No: se cierra, y en la liquidación figura con código A.
  - Sí: se abre para cargar los datos del inquilino; al poner el mail del inquilino se le da usuario en el sistema; en la liquidación figuran P (propietario o promitente) e I (inquilino).
- Si hay venta de la unidad y cambia el propietario, se le debe pedir a la Administración la adjudicación de un nuevo usuario.
- El propietario o promitente siempre tiene que tener datos: puede modificarlos pero no dejarlos vacíos.
- El inquilino puede modificar sus datos o darse de baja; también lo puede dar de baja el propietario o promitente. Si queda sin inquilino, pasa a código A.
