# Reglas de negocio — Personas, Direcciones, Predios y DJ

Catálogo vivo para la spec `specs/rentas-nucleo-v2.md`. Cada regla tiene un ID, y la spec y los tests la citan por ese ID.
Si una regla cambia, se edita aquí; no se copia a otro archivo.

## Cómo se decide qué regla aplicar

1. **La ley nacional va en el código**, igual para todas las munis. Es el marco común:
   - TUO de la Ley de Tributación Municipal (D.S. 156-2004-EF, "TUO LTM").
   - TUO del Código Tributario (D.S. 133-2013-EF, "CT").
2. **Lo que fija la ordenanza de cada muni es un dato en su propia base**: un catálogo, o un parámetro del año con su ordenanza. Se siembra con el valor nacional y cada muni lo ajusta. Así el multi-muni no se rompe: el código y el esquema son los mismos en todas las bases.
3. **Las prácticas de Lurín o del manual se adoptan como control por defecto** si no contradicen la ley. Una práctica se vuelve parámetro solo cuando una muni pida otra cosa; no se parametriza por adelantado.

**Leyenda**

- **Fuente:**
  - **LEY**: norma nacional.
  - **LUR**: lo hace el sistema de Lurín, en su base o en sus pantallas.
  - **MAN**: manual SIAF-GL Rentas del MEF (2008). Es antiguo: se toma la idea, no los valores.
  - **SB**: ya existe en nuestro sistema, o es una mejora propia.
- **Aplica:**
  - **Código**: igual en todas las munis.
  - **Parám.**: dato por muni.
  - Las decisiones de diseño están en la spec v2 (§3).
- **Hoy:**
  - ✅ existe
  - ◐ existe en parte
  - ✗ falta

## P — Personas

| ID | Regla | Fuente | Aplica | Hoy |
|---|---|---|---|---|
| P01 | No se puede **inhabilitar** a un contribuyente con deuda vigente, ni a mano ni de forma automática. Mensaje: "mantiene una deuda de S/ X y no puede ser inhabilitado". | LUR | Código | ◐ solo para BAJA (`contribuyentes.service.ts:162`) |
| P02 | Habilitar no tiene restricción. | LUR | Código | ✅ |
| P03 | Al liquidar una DJ: si el contribuyente se queda sin predios activos y sin deuda, pasa a INHABILITADO. Si un inhabilitado vuelve a declarar un predio activo, vuelve a HABILITADO. Lurín no revisa la deuda en este paso ni rehabilita; nosotros sí. | LUR + SB | Código | ✗ |
| P04 | Solo se puede **borrar** una persona sin DJ, sin cuenta corriente y sin deuda, es decir, un error de digitación. Con historia, solo cambia de estado. | LUR + SB | Código | ◐ |
| P05 | El nombre completo se arma solo. Persona natural: apellido paterno + materno + nombres. Sucesión: abreviatura del tipo de sucesión + apellidos. Persona jurídica: razón social. | LUR | Código | ✗ (hoy es un solo campo) |
| P06 | Una persona puede tener **varios documentos** (DNI, RUC, CE, pasaporte…). El par tipo + número no se repite en toda la base. Lurín no lo impide; nosotros sí. | LUR + SB | Código | ◐ (un solo documento, único) |
| P07 | Validación: DNI de 8 dígitos; RUC de 11 con dígito verificador. | SB | Código | ✅ |
| P08 | Se permite la persona **sin documento** (tipo SIN DOCUMENTO, sin número), con justificación obligatoria. Queda PENDIENTE hasta que se le registre un documento o un SUPERVISOR apruebe la excepción. Así nadie inventa números para poder grabar. | MAN | Código | ✗ |
| P09 | Varios contactos por tipo (correo, teléfono de casa, de oficina, celular). | LUR | Código | ◐ (campos fijos) |
| P10 | Relacionados: cónyuge, representante legal y responsable. Sus datos (documento, nombres, domicilio) se guardan en la ficha. Si el documento ya es de una persona registrada, se enlaza a ella y se precarga. No se obliga a registrarlos como contribuyentes. Solo un cónyuge vigente. | LUR + MAN | Código | ◐ (cónyuge y representante como campos sueltos) |
| P11 | Domicilio fiscal: si está en el distrito, se elige del catálogo de direcciones; si es foráneo, se registra ubigeo + texto (CT art. 11). | LEY + MAN | Código | ◐ |
| P12 | Perfil de cumplimiento, perfil de cobranza y clasificación (PRICO / MECO / PECO). | LUR | Parám. (catálogo) | ✗ |
| P13 | Todo cambio en la persona y sus listas queda auditado. | LUR + SB | Código | ✅ (triggers) |
| P14 | Solo es **inafecto** quien está en el art. 17 del TUO LTM. El manual exige además persona jurídica con RUC. | LEY + MAN | Código | ✗ |
| P15 | **Pensionista o adulto mayor**: se deducen 50 UIT de la base imponible si tiene un solo predio, destinado a su vivienda, y un ingreso de hasta 1 UIT mensual. Requiere resolución (base legal, expediente, fecha). Norma: TUO LTM art. 19 (Ley 30490 para adultos mayores). | LEY | Código | ✗ |
| P16 | Estados: HABILITADO, INHABILITADO y PENDIENTE. PENDIENTE significa datos por validar (sin documento, nombre sin separar) y no frena la tributación: se declara, se determina y se cobra igual, porque la obligación nace de la ley y no del registro. "Fiscalizado" no es un estado: sale del módulo de fiscalización. | LUR + SB | Código | ◐ (ACTIVO / INACTIVO / BAJA) |
| P17 | Se rechazan números de documento ficticios: todos los dígitos iguales, 12345678 y similares. | SB | Código | ✗ |
| P18 | Sucesión indivisa: guarda el DNI del causante como referencia, que no cuenta para la unicidad de P06. Su documento propio es su RUC, o ninguno (P08). | SB | Código | ✗ |

## D — Direcciones únicas

| ID | Regla | Fuente | Aplica | Hoy |
|---|---|---|---|---|
| D01 | Una **dirección única** compartida: personas, predios y relacionados apuntan al mismo registro. | LUR | Código | ✗ (cada uno guarda su dirección) |
| D02 | Jerarquía: ubigeo → sector (zona) → habilitación (urb., AA.HH., A.F.) → vía (av., ca., pje.). | LUR | Código | ✅ equivale a Zona → Urbanización → Vía |
| D03 | El sector define la **zona de arbitrios**; la habilitación define la **ubicación respecto a parques**. | LUR | Parám. | ◐ |
| D04 | Componentes ordenados (número, interior, dpto., Mz., Lt., sublote, piso, tienda, block, km, torre…). La dirección literal se arma sola con ellos. | LUR | Código (catálogo de componentes por muni) | ✗ |
| D05 | Referencia (texto) y coordenadas opcionales. | LUR | Código | ✗ |

## R — Predios

| ID | Regla | Fuente | Aplica | Hoy |
|---|---|---|---|---|
| R01 | **Predio maestro**: tipo urbano o rústico, código, dirección única, código catastral, área de terreno, linderos de 4 lados (metros + colindante), Mz./Lt., nombre y coordenadas. | LUR | Código | ◐ |
| R02 | Datos del predio para arbitrios: frecuencia de barrido, zona, ubicación respecto a parques y frontis. | LUR | Parám. (catálogos) | ◐ |
| R03 | **Varios usos por predio**: uso, sub-uso, inquilino, área, frontis, % e inicio y fin de actividad. Los arbitrios se determinan por uso. El manual marca uno como predominante. | LUR + MAN | Código | ✗ (un solo uso) |
| R04 | **Condominio**: se trata como de un solo dueño salvo que se comunique cada condómino con su %. Los condóminos son responsables solidarios (TUO LTM art. 9). En Lurín, cada condómino declara su % en su propia DJ; la suma por predio no pasa de 100. | LEY + LUR | Código | ◐ (hoy el % se suma dentro de una sola DJ) |
| R05 | Condición de propiedad: propietario único, sucesión indivisa, poseedor, sociedad conyugal, condominio, copropietario u otros. | LUR | Parám. (catálogo) | ✗ |
| R06 | Una exoneración o inafectación del predio guarda régimen, %, número y fecha de resolución. Un predio inafecto exige propietario inafecto. | LUR + MAN | Código | ✗ |

## V — Valorización (autoavalúo)

| ID | Regla | Fuente | Aplica | Hoy |
|---|---|---|---|---|
| V01 | Terreno = área × arancel del año. Edificación = valores unitarios oficiales del año (7 categorías) vigentes al 31/10 del año anterior (TUO LTM art. 11). | LEY | Código + Parám. | ✅ |
| V02 | Depreciación por antigüedad, material, clasificación y estado de conservación, según las tablas oficiales vigentes. | LEY | Parám. | ✅ |
| V03 | **Incremento** del valor unitario en edificios de varios pisos (la RM de valores unitarios suele fijar +5% desde el 5.º piso). Verificar la RM vigente. | LEY + LUR + MAN | Parám. | ✗ |
| V04 | **Áreas comunes**: su valor se reparte por % de participación. | LUR | Código | ✗ |
| V05 | Obras complementarias: valor unitario × cantidad × factor de oficialización, con depreciación (TUO LTM art. 11). | LEY + LUR | Código | ◐ (hoy es un valor directo) |
| V06 | No se liquida un predio sin arancel. | LUR + SB | Código | ✅ |
| V07 | Predio rústico: arancel rústico por categoría y clasificación de tierras. | LUR | Parám. | ✗ |

## J — Declaraciones juradas

| ID | Regla | Fuente | Aplica | Hoy |
|---|---|---|---|---|
| J01 | Una DJ es de **un contribuyente** y lleva **un anexo por predio** declarado. | LUR | Código | ✗ (hoy hay una DJ por predio) |
| J02 | Número correlativo por año (AA-NNNNNNN), más el número de formulario físico y los folios. | LUR | Código | ◐ (hay correlativos) |
| J03 | La DJ guarda una **copia** de los datos del contribuyente y su relacionado al momento de presentarla. | LUR + SB | Código | ◐ (`snapshot`) |
| J04 | Estados: PENDIENTE → LIQUIDADA (se puede reabrir a PENDIENTE). EN_REVISION → PENDIENTE o RECHAZADA (J14). ANULADA lleva motivo, usuario y fecha. Si ya generó cuenta, anularla extorna esa cuenta. Nunca se borra. | LUR + SB | Código | ✗ |
| J05 | Solo se reabren DJ de ciertos motivos. | LUR | Parám. | ✗ |
| J06 | El motivo **inscripción** se usa una sola vez por persona. | LUR | Código | ✗ |
| J07 | DJ **informativa**: no genera cuenta corriente y se determina al registrarla. El manual llama informativas a la inscripción, el descargo y el cambio de características, y declarativas a la anual y la sustitutoria. | LUR + MAN | Código (el tipo es un atributo del motivo) | ✗ |
| J08 | Plazos. DJ anual: último día hábil de febrero, salvo prórroga por ordenanza. Por transferencia, o por cambios en el predio de más de 5 UIT: último día hábil del mes siguiente (TUO LTM art. 14). Fuera de plazo se propone la multa 176.1. | LEY | Código + Parám. (prórroga) | ◐ (multa 176.1 existe) |
| J09 | La **actualización anual de valores** por la muni sustituye la DJ anual, si el contribuyente no la objeta en el plazo de pago al contado (TUO LTM art. 14). En Lurín es la "DJ automática". | LEY + LUR | Código | ◐ (cálculo masivo v1) |
| J10 | Sujeto del impuesto al 1 de enero. Si alguien adquiere un predio durante el año, es contribuyente desde el 1 de enero del año siguiente; el que transfiere paga el año en curso (TUO LTM art. 10). | LEY | Código | ✗ |
| J11 | Los arbitrios afectan desde el mes que fija la ordenanza. | LUR | Parám. | ✗ |
| J12 | **Descargo** (venta o baja): fecha de descargo y datos del adquiriente o transferente; el predio deja de estar afecto según J10. | LUR | Código | ◐ |
| J13 | Documentos adjuntos por DJ: tipo, número y fecha. | LUR | Código | ✗ |
| J14 | **DJ que baja la obligación** de un período ya liquidado: al determinarla queda EN_REVISION y no genera cuenta. Un SUPERVISOR la aprueba o la rechaza, con justificación, dentro de los 45 días hábiles desde su recepción (se cuentan con los feriados). Vencido el plazo, surte efecto: se puede liquidar y ya no se puede rechazar; lo que quede por revisar va a fiscalización. Si sube o mantiene la obligación, surte efecto al presentarse (CT art. 88). | LEY + MAN | Código | ✗ |
| J15 | Una DJ puede cubrir **varios años** (tramos): se determina un resultado por año, desde el año de afectación hasta el actual. Los predios no declarados del contribuyente entran a la determinación del año, porque la base es el total (L01). | LUR | Código | ✗ |
| J16 | Prórroga de presentación: se registra y se aprueba o rechaza. | LUR | Parám. | ✗ |
| J17 | Quien registró la DJ no puede aprobar su revisión (J14) ni anularla una vez liquidada. | SB | Código | ✗ |

## L — Determinación y liquidación ("Generar Cta.")

| ID | Regla | Fuente | Aplica | Hoy |
|---|---|---|---|---|
| L01 | La base imponible es la **suma** de los autoavalúos de todos los predios del contribuyente en el distrito, cada uno por su %, menos las deducciones (TUO LTM art. 11). | LEY | Código | ✅ |
| L02 | Escala acumulativa: 0.2% hasta 15 UIT, 0.6% de 15 a 60 UIT, 1.0% sobre 60 UIT (art. 13). | LEY | Código | ✅ |
| L03 | Impuesto mínimo de hasta 0.6% de la UIT, si la muni lo fija (art. 13). | LEY | Parám. | ✅ |
| L04 | Pago al contado hasta fin de febrero, o 4 cuotas trimestrales (feb., may., ago., nov.) con las cuotas 2 a 4 reajustadas por IPM (art. 15). | LEY | Código | ✅ |
| L05 | Derecho de emisión de hasta 0.4% de la UIT, cobrado en la cuota 1 (TUO LTM, disposiciones finales). | LEY + LUR | Parám. | ✅ (falta validar el tope) |
| L06 | Cuota = impuesto anual / 4; la última absorbe el redondeo. | LUR + SB | Código | ✅ |
| L07 | Arbitrios: se **determinan por predio, uso y mes**, y se agrupan en cuotas según `ReglaMuni` (por defecto, 4 trimestrales, como hoy). El mes es la unidad porque compras, descargos y usos empiezan y terminan a mitad de año. Cada concepto se distribuye con los criterios de su ordenanza ratificada (TUO LTM art. 69; TC 0053-2004-PI/TC). En Lurín: RS = zona + uso + área; BC = frecuencia + frontis; PJ = zona + ubicación respecto a parques; SC = zona + uso. | LEY + LUR | Parám. | ◐ (hoy zona + uso para todos) |
| L08 | Al liquidar se elige qué años, y si se liquida impuesto predial, arbitrios o ambos. | LUR | Código | ✗ |
| L09 | No se liquida si la nueva determinación **baja** la deuda de un período que ya tiene valor emitido (OP/RD) o está en coactivo. Eso se corrige por reclamo, no con una DJ. | LUR | Código | ◐ (v1 no toca FRACCIONADO/COACTIVO) |
| L10 | **Reliquidar** un año: las cuotas pendientes sin valor se anulan, las pagadas en parte se cierran por lo pagado y el exceso pagado se aplica a las cuotas nuevas. | LUR | Código | ✗ (límite de v1, Fase D) |
| L11 | Los vencimientos caen el último día **hábil**: requieren el cronograma o los feriados del año. | LEY + MAN | Parám. | ◐ (hoy se usa el último día del mes) |
| L12 | La liquidación es todo o nada: una sola `$transaction`. | LUR + SB | Código | ✅ |
| L13 | Al liquidar, los datos de la persona declarados en la DJ pasan a su ficha **solo si la DJ es más reciente** que la última modificación de la ficha: gana el dato más reciente. La vista previa muestra las diferencias y el cambio queda auditado. Lurín sobrescribe siempre, incluso al reliquidar una DJ antigua. | LUR + SB | Código | ✗ |
| L14 | **Saldo inicial** al incorporar una muni con deuda de otro sistema: se aprueba con documento; la deuda anterior se toma al 31/12 y los intereses corren desde el 01/01. | MAN | Código | ✗ |

## Lo que no se toma

- Del manual 2008: sus montos, el cálculo de intereses cambiando la fecha del servidor y su arquitectura Oracle de escritorio.
- De Lurín: el cambio de estado de la persona sin validación ("Config. Estado"), los borrados físicos y las copias por año del predio (aquí se reconstruyen desde la determinación).
