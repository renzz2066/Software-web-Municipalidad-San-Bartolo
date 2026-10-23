-- Rentas núcleo v1 (specs/rentas-nucleo-v1.md §5): auditar las cuotas que genera el cálculo.
-- El autor de cuenta_corriente ya lo fija auditoria_autor; faltaba el registro de cambios.
SELECT auditoria_habilitar('cuenta_corriente');
