// Copia a fonte Inter (variável, latin + latin-ext) para assets/fonts.
// Os arquivos copiados são versionados: a aplicação não depende deste script em tempo de execução.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const origem = join('node_modules', '@fontsource-variable', 'inter', 'files');
const destino = join('assets', 'fonts');
mkdirSync(destino, { recursive: true });
for (const sub of ['latin', 'latin-ext']) {
  const nome = `inter-${sub}-wght-normal.woff2`;
  copyFileSync(join(origem, nome), join(destino, nome));
  console.log('Copiado', nome);
}
copyFileSync(join('node_modules', '@fontsource-variable', 'inter', 'LICENSE'), join(destino, 'LICENSE-Inter.txt'));
