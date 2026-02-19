# ⚡ MANIBOL PRO - Ultra Scouting Engine

Sistema de monitoramento e análise de futebol em tempo real, focado em detecção de pressão extrema e alertas de eventos críticos.

## 🛠️ Tecnologias Utilizadas
- **Frontend:** HTML5, Tailwind CSS
- **Interatividade:** JavaScript (ES6+)
- **Gráficos:** Chart.js
- **Ícones:** Font Awesome
- **Persistence:** LocalStorage (Favoritos)

## 🧠 Arquitetura do Sistema
O projeto utiliza um motor de ciclo fechado que executa a cada 10 segundos:
1. **Fetch**: Captura de dados da API.
2. **Snapshot**: Clonagem de memória para comparação de estados (Passado vs Presente).
3. **Auditoria**: Verificação de gols e mudanças de estatísticas.
4. **Render**: Atualização dinâmica da interface sem refresh.

## 📈 Funcionalidades Implementadas
- [x] Motor de alertas sonoros e visuais de GOL.
- [x] Indicador visual de "Fogo" 🔥 para pressão acima de 90 AP.
- [x] Gráfico de pressão dinâmico por partida.
- [x] Bot de Insights com análise preditiva básica.
- [x] Filtros por Ligas e Estratégias (Cartão Vermelho/Pressão).

---
*Documentação gerada em Fevereiro de 2026 - Versão Estável V1.0*
