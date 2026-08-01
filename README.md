# ES-DE Gamelist Editor

Aplicativo de **desktop** para editar **gamelists do ES-DE** (EmulationStation
Desktop Edition) com segurança, pensado para curadoria de coleções grandes.

> **Nenhuma ROM, BIOS ou mídia de jogo é hospedada ou distribuída aqui.** Este é um
> editor que opera apenas sobre os arquivos **que você já possui legalmente** (suas
> gamelists, ROMs e mídias). Nenhum caminho específico da sua máquina vem embutido.

É um **app de janela única** — abre como qualquer programa, sem navegador e sem
servidor. Por baixo usa [pywebview](https://pywebview.flowrl.com/): a interface roda
numa janela nativa e conversa direto com o Python. Funciona em **Windows** e
**Linux**, e pode ser empacotado num **executável único** para distribuir.

> Editar sem medo: nada é apagado de imediato. As remoções vão para uma **lixeira**
> e o `gamelist.xml` recebe **backup automático** antes de cada escrita.

---

## Recursos

- **Tema claro ou escuro**, alternável no botão ☾/☀ da barra superior; a escolha é
  lembrada entre sessões.
- **Ordenação da lista** por Nome (A–Z / Z–A), Data de lançamento (mais antigo / mais
  novo) ou Arquivo — carrega em ordem alfabética por padrão e lembra a escolha.
- **Importar em lote** de um arquivo `.txt` (botão **Importar**): marca jogos para remoção
  **e** atualiza campos da gamelist (ex.: renomear) em vários consoles de uma vez.
- **ES-DE Orphan Cleaner** (botão **Limpeza**): encontra e remove entradas de gamelist sem
  ROM e mídia sem jogo correspondente (com suporte a `.m3u`), com backup e lixeira.
- **Filtro “Somente marcados”** mostra todos os itens marcados (de todos os consoles)
  numa visão única, com coluna de console — ótimo para revisar antes do commit.
- **Barras de rolagem sempre visíveis** nas listagens, para você saber se está no início
  ou no fim.
- **Barras de progresso** ao abrir a coleção e ao trocar de console, com confirmação
  visível de qual console foi carregado.
- **Janela nativa** com seletores de pasta/arquivo do próprio sistema operacional —
  é só clicar em **Procurar…**, sem digitar caminhos.
- **Abrir uma pasta de sistemas** no formato ES-DE (`.../<system>/gamelist.xml`) e
  alternar entre consoles, **ou** abrir **um `gamelist.xml` específico**.
- **Editar qualquer campo** da entrada (`name`, `desc`, `genre`, `rating`, `players`,
  `favorite`, caminhos de mídia, etc.), inclusive adicionar campos novos.
- **Três níveis de remoção**, marcados por cor:
  1. **Só a entrada** — remove o jogo do `gamelist.xml`; mantém ROM e mídia.
  2. **Entrada + ROM** — move o arquivo da ROM para a lixeira.
  3. **Entrada + ROM + mídia** — também move as mídias correspondentes
     (`downloaded_media/<system>/<tipo>/<rom>.<ext>`).
- **Pré-visualização (dry-run)** antes de aplicar: você vê exatamente o que será
  alterado, removido e movido — e só então confirma.
- **Save / Commit** executa o plano: reescreve o `gamelist.xml` (com backup) e move
  os arquivos marcados para a lixeira.
- **Busca instantânea** e **lista com virtual scrolling** — milhares de entradas por
  sistema sem travar.
- **Navegação 100% por teclado**, com atalhos (veja abaixo).

---

## Segurança e preservação de dados

Escolhas deliberadas, pensadas para coleções grandes onde um erro é caro:

- **Lixeira em vez de exclusão.** Por padrão, ROMs e mídias removidas são **movidas**
  para uma pasta de lixeira (`_GAMELIST_EDITOR_TRASH`, configurável), preservando a
  estrutura de subpastas. Há a opção **hard delete** para quem quer exclusão direta.
- **Backup do gamelist.** Antes de reescrever, cria-se uma cópia
  `gamelist.xml.bak-pre-edit-<timestamp>` ao lado do original.
- **Tags do XML preservadas.** O backend usa **lxml**, então `<name>` é gravado como
  `<name>` (e não corrompido para `<n>`, problema conhecido de algumas libs de XML em
  Python). Entidades como `&amp;` são reescritas corretamente.
- **Proteção contra path traversal** ao carregar as mídias para a prévia.
- **Commit stateless.** O arquivo é relido do zero na hora de aplicar, evitando estado
  obsoleto.
- **Commit fiel à pré-visualização.** O que for executado é exatamente o que apareceu no
  dry-run: o conjunto de alterações é congelado ao abrir a janela de commit, então trocar
  de console depois não afeta o que será gravado. O relatório mostra a contagem real de
  entradas removidas (0 se algum id não corresponder à gamelist atual).

---

## Instalação e execução

### Opção A — Executar a partir do código-fonte

Precisa de **Python 3.10+**. As dependências são instaladas automaticamente num
ambiente virtual na primeira execução.

**Windows**
```bat
run.bat
```
Usa o **EdgeChromium / WebView2**, já presente no Windows 10/11 — nada a instalar.

**Linux**
```bash
./run.sh
```
Na primeira execução, instala um backend de janela **Qt** (`pyqt6`) automaticamente,
sem precisar de `sudo`. Alternativa leve via sistema (Debian/Ubuntu):
`sudo apt install python3-gi gir1.2-webkit2-4.1`.

### Opção B — Gerar um executável único (recomendado para distribuir)

Produz um binário que abre com **duplo clique**, sem Python instalado na máquina de
destino.

**Windows**
```bat
build.bat
```
→ gera `dist\esde-gamelist-editor.exe`

**Linux**
```bash
./build.sh
```
→ gera `dist/esde-gamelist-editor`

(O build usa [PyInstaller](https://pyinstaller.org/) e embute a interface e o backend
de janela no próprio executável.)

---

## Uso

1. Ao abrir, o app pede o que carregar. Clique em **Procurar…** para escolher:
   - **Pasta de sistemas** — a `gamelists_root` (que contém `snes/gamelist.xml`, etc.).
     O app lista todos os consoles encontrados; **ou**
   - **Arquivo único** — um `gamelist.xml` específico.
2. Informe (com **Procurar…**) a **pasta de ROMs** e a **downloaded_media** — são
   necessárias para as remoções de nível 2 e 3 e para a prévia de capas.
3. Selecione um sistema, navegue pela lista e edite os campos no painel da direita.
4. Marque entradas para remoção (níveis 1–3) conforme necessário.
5. Clique em **Save & Commit** → revise o **dry-run** → confirme.

---

## Como o ES-DE organiza os arquivos

```
<gamelists_root>/
  snes/gamelist.xml
  psx/gamelist.xml
  ...
<roms_root>/
  snes/Super Mario World.sfc
  ...
<media_root>/            (normalmente ".../downloaded_media")
  snes/
    covers/Super Mario World.png
    screenshots/Super Mario World.png
    ...
```

As mídias são associadas por **stem** (nome do arquivo da ROM sem extensão). A tag
`<box3d>` é mapeada para a pasta `3dboxes/` (mapeamento legado do ES-DE).

---

## Atalhos de teclado

| Ação | Tecla |
|------|-------|
| Navegar na lista | `↑` `↓` ou `J` `K` |
| Pular | `PgUp` `PgDn` `Home` `End` |
| Editar campos da entrada | `Enter` |
| Marcar remoção (só entrada) | `Del` / `X` / `1` |
| Marcar remoção (+ ROM) | `Shift+Del` / `2` |
| Marcar remoção (+ ROM + mídia) | `Alt+Del` / `3` |
| Desmarcar | `U` |
| Buscar | `/` |
| Save / Commit | `Ctrl+S` |
| Ajuda | `?` |
| Fechar modal / cancelar | `Esc` |

---

## Limitações conhecidas

- **Multidisco / M3U.** Na remoção de nível 2, é movido apenas o arquivo referenciado
  em `<path>` (por exemplo, o `.m3u`). O conteúdo da pasta `.discs/` **não** é movido
  automaticamente (comportamento conservador).
- As alterações são aplicadas por sistema selecionado, um `gamelist.xml` por vez.

---

## Estrutura do projeto

```
esde-gamelist-editor/
  app.py            # ponto de entrada (janela pywebview)
  api.py            # API exposta à interface (substitui as rotas HTTP)
  gamelist.py       # parse/serialização do gamelist.xml (lxml)
  fileops.py        # índice de mídia, dry-run, commit, lixeira, backups
  frontend/
    index.html
    css/style.css
    js/app.js       # estado, virtual scrolling, teclado, remoção, edição
  requirements.txt
  run.sh / run.bat            # executar do código-fonte
  build.sh / build.bat        # gerar executável único
  esde-gamelist-editor.spec   # configuração do PyInstaller
  README.md / LICENSE
```

---

## Importar em lote (remoções e edições de campo)

Pelo botão **Importar**, você seleciona um arquivo de texto que pode conter **dois tipos
de linha**, misturados, para vários consoles de uma vez (separador `|`):

```
# remoção:        <console>|<path>|<ação>
nes|./Batman (Japan) (En).zip|3

# edição de campo: <console>|<path>|<campo>|<novo valor>
nes|./D2 (USA).zip|name|D2
```

- **console** — nome do sistema na gamelist (`nes`, `snes`, `psx`…).
- **path** — o valor exato do campo `<path>` da gamelist (a chave).
- **ação** — `1` (só a entrada), `2` (entrada + ROM) ou `3` (entrada + ROM + mídia);
  também aceita `entrada`, `rom`, `midia`.
- **campo / novo valor** — qualquer campo da gamelist (`name`, `genre`, `developer`…);
  o valor pode conter `|`, e um valor vazio limpa o campo.
- O `|` não pode aparecer em nome de arquivo no Windows, então nunca colide com o path.
  Linhas em branco ou começadas por `#` são ignoradas. Também aceita o formato antigo de
  2 campos (`path|ação`), que usa o console aberto.

As marcações e edições são **globais** (valem entre consoles). Edições de campo do console
aberto aparecem na hora (campo destacado com o novo valor); de outros consoles, aparecem no
dry-run. Quando terminar, **Salvar & Commit** agrega tudo, faz backup e aplica por console.
Veja `docs/exemplo_marcacoes.txt`.

---

## ES-DE Orphan Cleaner (botão **Limpeza**)

Tela dedicada para higienizar a coleção, no console atual ou em **todos os consoles**:

1. **Entradas órfãs da gamelist** — `<path>` que não existe mais na pasta de ROMs.
   Arquivos `.m3u` contam como existentes se o próprio `.m3u` está lá; se ele existir
   mas referenciar discos ausentes, aparece na seção informativa **“M3U com discos
   ausentes”** (não é removido pela limpeza — provavelmente é caso de restaurar discos).
2. **Arquivos de mídia órfãos** — arquivos em `downloaded_media/<console>/<tipo>/` cujo
   nome (stem) não corresponde a nenhum jogo da gamelist, nem a nenhum arquivo real da
   pasta de ROMs, nem a discos listados dentro de `.m3u`. (O ES-DE associa mídia por
   basename, então mídia de jogo ainda não catalogado **não** é considerada órfã.)

A varredura mostra tudo com checkboxes (marcados por padrão), contadores e o espaço
recuperável. A limpeza usa as proteções de sempre: **backup** da gamelist na pasta de
backup (por console) antes de escrever, e mídia movida para a **lixeira** (ou hard
delete, se você abriu a coleção nesse modo).

---

## Pastas padrão e backup

Por padrão, os campos do diálogo **Abrir** vêm **vazios** — nada específico da sua
máquina é embutido no app. Use os botões **Procurar…** para escolher as pastas; o app
lembra a última escolha entre sessões.

Se quiser pré-preencher o diálogo com o seu layout (sem editar código), defina estas
variáveis de ambiente antes de abrir o app:

| Campo | Variável de ambiente | Exemplo |
| --- | --- | --- |
| Gamelists | `ESDE_GAMELISTS_ROOT` | `.../ES-DE/gamelists` |
| downloaded_media | `ESDE_MEDIA_ROOT` | `.../ES-DE/downloaded_media` |
| ROMs | `ESDE_ROMS_ROOT` | `.../ROMs` |
| Backup | `ESDE_BACKUP_ROOT` | `.../ES-DE/backup` |

Antes de cada commit, a gamelist do console é copiada para a pasta de backup, organizada
por console (`<backup>/<console>/gamelist.xml.bak-pre-edit-<timestamp>`).

---

## Desempenho em NAS / filesystem remoto

O editor é pensado para rodar sobre coleções grandes em discos de rede (SMB/NFS),
onde cada acesso a arquivo custa uma ida à rede. Para manter a navegação fluida:

- A varredura de mídia usa `os.scandir` (sem um `stat` por arquivo) e é **cacheada
  em memória e em disco local** (`~/.cache/esde-gamelist-editor`), validada pelo
  `mtime` de cada subpasta de tipo — só relê do disco o que mudou.
- O mesmo índice é reaproveitado pela navegação, pelo dry-run e pelo commit (antes
  era refeito três vezes).
- As capas da prévia ficam em cache na sessão.
- Após o commit, apenas a contagem do console afetado é atualizada (não relê todos
  os sistemas).

Para forçar uma releitura completa da mídia, apague a pasta de cache acima.

---

## Testes

A lógica da interface tem testes de integração (jsdom). Para rodá-los:

```bash
npm install
npm test
```

Eles cobrem o tema, as barras de progresso, a troca de console e a confirmação de
alterações pendentes.

---

## Licença

[MIT](LICENSE). Use, modifique e compartilhe livremente.

---

## Contribuindo

Sugestões, issues e pull requests são bem-vindos. Ideias já mapeadas: tratamento
completo de multidisco (`.discs/`), edição em lote e desfazer (undo) pós-commit a
partir da lixeira.
