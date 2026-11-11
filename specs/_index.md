# Specs — índice
<!-- Si agregas una spec, registra aquí 1 línea. Las cerradas no se editan. -->

- `template-spec.md`: plantilla vigente (usar para toda spec nueva).
- `modulos-esqueleto-v1.md`: activa. Módulos/submódulos SIMUN como niveles + placeholders.
- `recarga-ruta-protegida-v1.md`: F5 en ruta con `RequireNivel` no redirige a `/`.
- `auditoria-v1.md`: activa. Auditoría de cambios (triggers PG) + sesiones + `GET /auditoria`.
- `auditoria-pantalla-v1.md`: activa. Pantalla `/accesibilidad/auditoria` + logout real.
- `auditoria-gerencial-v1.md`: activa. Auditoría se muda de Accesibilidad a Tablero Gerencial (nivel, ruta, tarjeta y migración de reubicación).
- `rentas-nucleo-v1.md`: activa. Contribuyentes, predios/DJ, maestros, cálculo predial/arbitrios, estado de cuenta.
- `rentas-valores-v1.md`: activa. OP/RD, notificación, fraccionamiento, transferencia a coactivo.
- `caja-v1.md`: activa. Cobros en ventanilla, recibo correlativo, extornos y cierre diario por cajero.
- `utilitarios-v1.md`: activa. Herramientas de apoyo: calculadora (UIT, mora, DNI/RUC, efectivo), calendario, buscador y exportación CSV.
- `rentas-fiscalizacion-v1.md`: activa. Expediente de fiscalización, ficha, RD por diferencias y multas (RM).
- `app-shell-v1.md`: activa. Barra lateral, barra superior, `PageHeader` con "Volver a…" y tokens visuales (`@theme`).
- `coactiva-recepcion-transferencia-v1.md`: activa. Recepción/transferencia de valores a coactiva y asignación a auxiliar (port de `feat/coactiva-recepcion-transferencia`).
- `ia-chat-v1.md`: activa. Chat IA de trámites (RAG pgvector + Gemini) en drawer flotante, nivel `ayuda.chat`, historial propio.
- `contribuyente-domicilio-representante-v1.md`: activa. Domicilio fiscal estructurado (ubigeo/zona/urb/vía) + cónyuge y representante legal opcionales; `direccionFiscal` derivada en backend.
- `consulta-identidad-v1.md`: activa. Botón "Buscar datos" en el formulario: consulta de DNI/RUC (propia BD → caché 30 días → ApiPeruDev) que rellena solo los campos vacíos.
- `multi-muni-v1.md`: activa. Una base por muni elegida por subdominio (`X-Muni` + JWT con `muni`), identidad visual por muni y `db:setup:todas`.
