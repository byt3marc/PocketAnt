import { MODELO } from '../config';

// Sin `@types/node` en el proyecto: se piden `fs` y `path` a Jest con el tipo mínimo que se usa.
const { readFileSync } = jest.requireActual('fs') as { readFileSync: (ruta: string, codificacion: 'utf8') => string };
const { join } = jest.requireActual('path') as { join: (...partes: string[]) => string };

/**
 * La descarga del modelo la hace la app, pero el modelo lo carga `expo-ai-kit`, que lo busca en una ruta fija.
 * Estas pruebas leen la librería instalada y fallan si cambia esa ruta o el archivo que pide, para no enterarse
 * en el teléfono con un modelo que «no existe».
 */
const raiz = join(process.cwd(), 'node_modules', 'expo-ai-kit');
const leer = (...partes: string[]) => readFileSync(join(raiz, ...partes), 'utf8');

describe('contrato con expo-ai-kit', () => {
  it('busca el modelo en <filesDir>/models/<id>.litertlm y su parcial en .litertlm.tmp', () => {
    const kotlin = leer('android', 'src', 'main', 'java', 'expo', 'modules', 'aikit', 'LlmModelFiles.kt');
    expect(kotlin).toContain('File(context.filesDir, "models")');
    expect(kotlin).toContain('File(modelsDirectory(context), "$modelId.litertlm")');
    expect(kotlin).toContain('File(modelsDirectory(context), "$modelId.litertlm.tmp")');
  });

  it('el modelo del catálogo es el mismo archivo que baja la app (mismo id, tamaño y SHA-256)', () => {
    const registro = leer('build', 'models.js');
    const entrada = registro.slice(registro.indexOf(`id: '${MODELO.id}'`));
    const bloque = entrada.slice(0, entrada.indexOf('},'));
    expect(bloque).toContain("name: 'Gemma 4 E2B'");
    expect(bloque).toContain('gemma-4-E2B-it.litertlm');
    expect(MODELO.sha256).toBe('181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c');
    expect(bloque).toContain(`sha256: '${MODELO.sha256}'`);
    expect(bloque.replace(/_/g, '')).toContain(String(MODELO.tamanoBytes));
  });

  it('la URL fijada lleva el commit del repositorio y apunta al mismo archivo', () => {
    expect(MODELO.url).toMatch(
      /^https:\/\/huggingface\.co\/litert-community\/gemma-4-E2B-it-litert-lm\/resolve\/[0-9a-f]{40}\/gemma-4-E2B-it\.litertlm$/,
    );
    expect(MODELO.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('la versión instalada es la que se probó (0.18.2)', () => {
    const { version } = JSON.parse(leer('package.json')) as { version: string };
    expect(version).toBe('0.18.2');
  });
});
