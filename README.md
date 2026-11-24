# Editor de Máscara de CD

Tela simples em React para posicionar uma imagem dentro da máscara de corte de um CD e baixar o resultado.

## Funcionalidades

- **Upload** por botão ou arrastando a imagem para a tela
- **Modo Editar** (estilo Photoshop): mostra a imagem inteira esmaecida fora da máscara, fundo xadrez na área de impressão, linha de corte (ciano) e área segura (amarelo tracejado)
- **Modo Preview**: só o resultado final recortado, com fundo escuro, claro ou xadrez
- Arrastar para mover, scroll para zoom no cursor, rotação livre, ±90°, espelhar, preencher, centralizar, resetar
- **Baixar PNG** 2048×2048 com transparência, recortado pela máscara de corte

## Atalhos

| Tecla | Ação |
| --- | --- |
| Arrastar | mover |
| Scroll | zoom no cursor |
| ← ↑ → ↓ | mover 1px (Shift = 10px) |
| + / - | zoom |
| 0 | preencher |
| E / P | modo editar / preview |

## Máscaras

Ficam em `public/masks/` (PNG 2048×2048, branco = área visível, preto = recorte):

- `mascara-cd.png` – máscara de corte (usada no download)
- `mascara-cd-segura.png` – área segura (só guia visual)

Para trocar, basta substituir os arquivos mantendo os nomes.

## Rodando

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # gera a pasta dist/
```
