// Genera la página web de la política de privacidad (tienda/politica-privacidad.html) desde src/legal/privacidad.json,
// el mismo texto que muestra la app. Google Play pide su URL pública en Play Console: esta página se sube tal cual a
// cualquier alojamiento (no necesita nada externo).
//
// Uso: node scripts/politica-html.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const datos = JSON.parse(readFileSync(join(raiz, 'src/legal/privacidad.json'), 'utf8'));
const destino = join(raiz, 'tienda/politica-privacidad.html');

const escapar = (texto) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const correo = datos.contacto.trim();
if (!correo) {
  console.warn('⚠ Falta el correo de contacto ("contacto" en src/legal/privacidad.json): Google Play lo exige.');
}

function idioma(codigo) {
  const texto = datos[codigo];
  const secciones = texto.secciones
    .map(
      (seccion) =>
        `      <h2>${escapar(seccion.titulo)}</h2>\n` +
        seccion.parrafos.map((parrafo) => `      <p>${escapar(parrafo)}</p>`).join('\n'),
    )
    .join('\n');
  const contacto = correo
    ? `      <p class="contacto">${escapar(texto.contacto).replace(
        '{correo}',
        `<a href="mailto:${escapar(correo)}">${escapar(correo)}</a>`,
      )}</p>`
    : '';
  return [
    `    <section id="${codigo}" lang="${codigo}">`,
    `      <h1>${escapar(texto.titulo)} · Pocketant</h1>`,
    `      <p class="fecha">${escapar(texto.fecha)}</p>`,
    `      <p>${escapar(texto.intro)}</p>`,
    secciones,
    contacto,
    '    </section>',
  ]
    .filter(Boolean)
    .join('\n');
}

const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pocketant · Política de privacidad / Privacy policy</title>
    <style>
      :root { color-scheme: light dark; --fondo: #f5f7f6; --texto: #1c1c1e; --tenue: #5f6368; --borde: #dfe3e1; --primario: #1a73e8; }
      @media (prefers-color-scheme: dark) { :root { --fondo: #151517; --texto: #f2f2f2; --tenue: #a8adb3; --borde: #2c2c30; --primario: #8ab4f8; } }
      body { margin: 0; background: var(--fondo); color: var(--texto); font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
      main { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
      nav { display: flex; gap: 16px; font-size: 14px; }
      a { color: var(--primario); }
      section + section { border-top: 1px solid var(--borde); margin-top: 40px; padding-top: 8px; }
      h1 { font-size: 26px; line-height: 1.25; margin: 24px 0 4px; }
      h2 { font-size: 18px; margin: 28px 0 4px; }
      p { margin: 8px 0; }
      .fecha { color: var(--tenue); font-size: 14px; margin-top: 0; }
      .contacto { margin-top: 28px; }
    </style>
  </head>
  <body>
    <main>
      <nav><a href="#es">Español</a><a href="#en">English</a></nav>
${idioma('es')}
${idioma('en')}
    </main>
  </body>
</html>
`;

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, html);
console.log(`Página generada: ${destino}`);
