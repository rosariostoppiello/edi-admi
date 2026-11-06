# Dirección de diseño — "El hall del edificio"

## Para quién y para qué
- **Quién lo usa:** propietarios e inquilinos de todas las edades, casi siempre desde el celular; Portería desde la PC o tablet de recepción; Administración desde escritorio.
- **Qué tiene que lograr:** encontrar la liquidación del mes, reservar la barbacoa y avisar un desperfecto, sin tener que aprender nada.

## La idea
La interfaz toma su vocabulario del hall de entrada de un edificio montevideano: el
**portero eléctrico** (una botonera de teclas grandes, una por función) y la **placa
de bronce** grabada con el número de la unidad. No es un "dashboard": es el panel
del edificio.

- **Lo memorable, en un solo lugar:** la *placa* de la unidad (`2-201-P`). Aparece en
  la cabecera, en la liquidación (con el saldo a pagar) y en cada reserva. Es el único
  elemento con tratamiento "material" (bronce grabado).
- **Todo lo demás es callado:** fondo granito frío, tinta pizarra, mucho aire, sin
  sombras grises genéricas ni degradés decorativos.

## Paleta (tokens en `src/app/globals.css`)

| Token | Hex | Uso | Contraste |
|---|---|---|---|
| `--granito` | `#EDEFEB` | Fondo general (gris frío de piso de granito) | — |
| `--losa` | `#FFFFFF` | Superficies: teclas, formularios, tablas | — |
| `--pizarra` | `#1D2830` | Texto principal, cabecera | 13,0:1 sobre granito; blanco sobre pizarra 15,0:1 |
| `--pizarra-suave` | `#4A5761` | Texto secundario | 6,4:1 sobre granito, 7,4:1 sobre blanco |
| `--bronce` | `#7A5A12` | Acción principal, borde de la placa, foco | 6,4:1 con blanco; 5,5:1 sobre granito |
| `--bronce-claro` | `#E9DDBF` | Fondo de la placa (texto pizarra encima: 11,1:1) | — |
| `--junta` | `#C9CEC8` | Bordes y divisores (la junta entre baldosas; no se usa para texto) | 1,6:1 |
| `--alerta` | `#A1261B` | Errores, deuda, pólizas vencidas | 7,5:1 sobre blanco |
| `--ok` | `#2B6337` | Confirmaciones, al día | 7,1:1 sobre blanco |

**Colores de torre** (solo como marca chica junto al nombre, nunca como fondo):
Avenue `#2F5C87` · Sky `#2F6F6A` · Pilay `#6A5590` · NE `#4C6E2E` · Garajes `#5B5B5B`.
Todos superan 5,8:1 sobre blanco. Sirven para reconocer de un vistazo a qué torre pertenece una unidad o una barbacoa.

## Tipografía
- **Atkinson Hyperlegible Next** (Google Fonts) para todo. Fue diseñada para
  personas con baja visión: letras inconfundibles (I/l/1, 0/O). Es una elección
  funcional para gente de todas las edades, no decorativa.
- **Atkinson Hyperlegible Mono** solo para la placa (código de unidad), donde el
  ancho fijo imita el grabado de las placas.
- Cifras tabulares (`font-variant-numeric: tabular-nums`) en montos y tablas.
- Escala (base 17 px en móvil, 18 px desde tablet): 14 · 17 · 20 · 24 · 30 · 38.
  Interlineado 1,5 en texto, 1,2 en títulos. Línea máxima ~70 caracteres.
- Sin mayúsculas sostenidas en etiquetas, sin "eyebrows" sobre los títulos.

## Componentes
- **Tecla** (home): rectángulo blanco grande, mínimo 112 px de alto, ícono de trazo +
  nombre + una línea que dice qué se hace ahí. Borde de junta y un borde inferior más
  oscuro que da relieve; al presionarla se "hunde" (respuesta a la acción, no adorno).
  Radio 14 px.
- **Placa:** fondo bronce claro, borde bronce de 2 px, tipografía mono, radio 4 px
  (las placas son casi rectas).
- **Botón primario:** bronce con texto blanco, 48 px de alto mínimo. **Secundario:**
  borde pizarra, fondo blanco. Los textos dicen la acción exacta ("Publicar liquidación").
- **Campos:** 48 px de alto, etiqueta arriba siempre visible, ayuda y error debajo
  (error con ícono + texto, nunca solo color). Radio 8 px.
- **Tablas** (liquidación, Administración): primera columna (código) fija al hacer
  scroll horizontal; el scroll queda dentro de la tabla, nunca en la página.
- **Estados:** vacío = qué hacer a continuación; error = qué pasó y cómo seguir;
  carga = esqueleto con la forma del contenido.

- **Recibo** (liquidación de la unidad): la placa grande con el saldo a pagar y el
  vencimiento; debajo, la cuenta renglón por renglón como en una libreta (saldo
  anterior − pagos = saldo; cada cargo; doble raya y saldo a pagar). Solo aparecen
  los cargos que existen. Saldo a favor en verde.
- **Pasos de la confección:** píldoras numeradas (es una secuencia real); en el
  celular la barra se desliza y muestra el paso actual.
- **Avisos de una sección:** el mensaje de éxito queda arriba de la sección aunque el
  formulario que lo generó desaparezca (ej. al confirmar una planilla).

## Disposición
- Mobile-first, alineado a la izquierda, una columna con márgenes de 16 px.
- Home: 2 teclas por fila en móvil (3 filas), 3 por fila desde 768 px.
- Cabecera: barra pizarra con el nombre del complejo y la placa de la unidad activa.
  Si el usuario tiene varias unidades, la placa abre un selector.
- Escritorio (Administración, Portería): contenido hasta 1200 px; Portería tiene un
  acceso directo "Reservar para una unidad" en la cabecera.

```
Móvil 390 px                      Escritorio 1280 px
┌──────────────────────────┐      ┌────────────────────────────────────────────┐
│ Complejo      [2-201-P]  │      │ Complejo                        [2-201-P]  │
├──────────────────────────┤      ├────────────────────────────────────────────┤
│ Hola, Laura              │      │ Hola, Laura                                │
│ ┌──────────┐┌──────────┐ │      │ ┌────────────┐┌────────────┐┌────────────┐ │
│ │Liquidac. ││ Reservas │ │      │ │Liquidación ││ Reservas   ││ Datos      │ │
│ └──────────┘└──────────┘ │      │ └────────────┘└────────────┘└────────────┘ │
│ ┌──────────┐┌──────────┐ │      │ ┌────────────┐┌────────────┐┌────────────┐ │
│ │ Datos    ││Teléfonos │ │      │ │ Teléfonos  ││Solicitudes ││Comunicados │ │
│ └──────────┘└──────────┘ │      │ └────────────┘└────────────┘└────────────┘ │
│ ┌──────────┐┌──────────┐ │      └────────────────────────────────────────────┘
│ │Solicitud.││Comunicad.│ │
│ └──────────┘└──────────┘ │
└──────────────────────────┘
```

## Accesibilidad (piso de calidad)
- Contraste AA en todo texto (ver tabla); foco visible: anillo bronce de 3 px con
  separación de 2 px.
- Áreas táctiles de 44 px como mínimo (teclas y botones, 48 px).
- `prefers-reduced-motion`: se apaga el "hundido" animado.
- Íconos siempre acompañados de texto.

## Voz
Rioplatense, directa, sin tecnicismos: "Tu liquidación de setiembre", "Reservá la
barbacoa", "Avisá un problema". Los errores dicen qué pasó y cómo seguir; no piden
perdón. Botón y confirmación usan el mismo verbo ("Publicar" → "Publicada").

## Qué evitamos (y por qué)
- Fondo crema + serif de display: es el look genérico más común y cuesta más leerlo.
- Tarjetas idénticas con sombra gris y degradés: el patrón de plantilla SaaS.
- Etiquetas en mayúsculas, separadores con punto medio, flechas en botones.
- Modo oscuro: no se incluye en v1 (el público objetivo no lo necesita y duplica
  la verificación de contraste). Los tokens están listos para agregarlo después.
