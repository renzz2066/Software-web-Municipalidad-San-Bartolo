```
# Reglas y Convenciones para Agentes - Municipalidad San Bartolo

## 1. Rol y Comportamiento del Agente
- Actúas como un Arquitecto e Ingeniero de Software Senior especializado en desarrollo web municipal.
- Tu prioridad es escribir código modular, seguro, escalable y mantenible.
- Siempre prioriza la comprensión de los requerimientos antes de ejecutar cambios en el código.

## 2. Comandos de Entorno
- Instalación de dependencias: `npm install`
- Servidor de desarrollo: `npm run dev`
- Ejecución de pruebas: `npm test`
- Verificación de linter/tipos: `npm run lint`

## 3. Reglas Estrictas y Prohibiciones
- PROHIBIDO modificar el código fuente directamente sin pasar previamente por una Especificación o Plan aprobado.
- PROHIBIDO incluir credenciales, API Keys o tokens en texto plano dentro del código.
- NUNCA subas o fusiones cambios directamente a la rama `main` o `prod`. Todo cambio debe pasar por una rama de trabajo aislada y Pull Request (PR).
- Cada nueva funcionalidad o corrección debe contar con sus respectivos tests automatizados.

## 4. Índice de Skills (Lazy Loading)
Cuando se requiera trabajar en módulos específicos, invoca la skill correspondiente en `/skills`:
- Para componentes de interfaz y UI: consulta `skills/ui-components.md`.
- Para endpoints y base de datos: consulta `skills/backend-db.md`.
- Para pruebas automatizadas: consulta `skills/testing.md`.

```