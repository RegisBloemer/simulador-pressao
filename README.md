# FETRANS Lab — Simulador de Pressão e Transferência de Calor

Aplicação Next.js (App Router) que reúne simuladores interativos para apoiar aulas de Fenômenos de Transporte. Utiliza componentes client-side em React com Material UI, Chart.js, Recharts e dnd-kit para visualização dinâmica de fenômenos de mecânica dos fluidos, transferência de calor e análise de composições térmicas.

## ℹ️ Principais conhecimentos aplicados

- **Front-end:** Next.js 13+, React 18, Context API para tema, CSS Modules/`@mui/material`, componentes client-side.
- **UI/UX:** Material UI (layout responsivo, cards, abas), ícones, sliders, chips, tooltips, drag-and-drop com dnd-kit.
- **Visualização de dados:** Chart.js (via `react-chartjs-2`) e Recharts para gráficos de linha e radar.
- **Modelagem numérica:** Hooks (`useMemo`, `useState`, `useEffect`) para gerar perfis discretizados, clamp de domínios, formatação internacionalizada e simulações em tempo real.
- **Física aplicada:** Hidrostática, condução, convecção, radiação térmica, propriedades termofísicas dependentes da temperatura, resistências térmicas em série, dinâmica de fluidos em tanques, força hidrostática em comportas.
- **Simulação dinâmica:** Métodos numéricos explícitos (FTCS), equações diferenciais ordinárias, balanços de massa e energia em regime transiente.

## 🔬 Modelos físicos implementados

### 1. Simulador de Pressão Hidrostática (`app/page.js`)

Pressão absoluta ao longo da profundidade para fluidos incompressíveis:

- **Equação básica:** $$P(h) = P_0 + \rho\,g\,h$$
- Conversão automática entre unidades (Pa, kPa, bar, atm, psi).
- Ajuste de densidade (`ρ`), gravidade (`g`), profundidade máxima (`h`) e pontos de discretização.
- Interface com card de resultados flutuante e arrastável.
- Banco de fluidos pré-configurados (água, óleo, mercúrio) ou densidade personalizada.

### 2. Laboratório de Transferência de Calor (`HeatTransferLab.jsx`)

| Modo                                             | Hipóteses                                            | Fórmulas principais                                                                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Condução (placa plana 1D, regime permanente)     | k constante, área A uniforme                         | Perfil linear: $$T(x) = T_1 + (T_2 - T_1)\,\frac{x}{L}$$ Fluxos: $$\frac{dT}{dx} = \frac{T_2 - T_1}{L}, \quad q'' = -k\,\frac{dT}{dx}, \quad \dot{Q} = q''\,A$$ |
| Convecção (Lei de Newton)                        | h constante, superfície uniforme                     | $$q'' = h\,(T_s - T_\infty), \quad \dot{Q} = h\,A\,(T_s - T_\infty)$$                                                                                           |
| Radiação (superfície cinza para ambiente grande) | Emissividade ε constante, visão para cavidade grande | $$q'' = \varepsilon\,\sigma\,(T_s^4 - T_{\text{sur}}^4), \quad \dot{Q} = q''\,A$$ Conversão automática: $$T[K] = T[^\circ C] + 273{,}15$$                       |

### 3. Laboratório de Propriedades dos Materiais (`MaterialPropertiesLab.jsx`)

- Banco de materiais com propriedades dependentes da temperatura `T` (funções polinomiais/exponenciais simplificadas).
- Gráfico de variação com a temperatura e radar normalizado.
- Propriedades tratadas: densidade `ρ(T)`, calor específico `c_p(T)`, condutividade térmica `k(T)`, viscosidade dinâmica `μ(T)`.

### 4. Cálculadora de Resistência Térmica (`ThermalSystem.jsx`)

Montagem interativa de sanduíche térmico com convecções e resistências de contato:

- **Resistência de camada:** $$R_{\text{cond}} = \frac{L}{k}$$
- **Resistência convectiva:** $$R_{\text{conv}} = \frac{1}{h}$$
- **Resistência de contato (se habilitada):** valor informado em \( \text{m}^2\cdot K/W \)
- **Resistência total:** soma de todas as parcelas em série $$R_\text{total} = \sum_i R_i$$
- Interface drag-and-drop, cálculo dinâmico e detalhamento dos termos.

### 5. Controle de Tanques Pressurizados — Jogo Interativo (`MultiTankPressureControlGamePage.jsx`)

Simulador gamificado de controle de 10 tanques hidráulicos em tempo real com mecânica dos fluidos aplicada:

**Fundamentos físicos:**
- **Volume e altura:** $$V = A \cdot h$$ onde $A = 15\,\text{m}^2$ (área do tanque)
- **Força hidrostática na comporta:** $$F_h = \frac{1}{2}\,\rho\,g\,h_{\text{eff}}^2\,w$$ onde $h_{\text{eff}} = \min(h_{\text{água}}, h_{\text{comporta}})$ e $w$ é a largura da comporta
- **Escoamento por orifício (equação de Torricelli):** $$Q_{\text{out}} = C_d\,A_{\text{comporta}}\,\sqrt{2\,g\,h}$$ com $C_d = 0{,}62$
- **Balanço de massa:** $$\frac{dV}{dt} = Q_{\text{in}} - Q_{\text{out}}$$

**Mecânicas do jogo:**
- Controle binário (ON/OFF) de comportas por tanque via switches.
- Configuração de material da comporta (aço, concreto, madeira) com limite de força suportado.
- Eventos aleatórios: aumento súbito de vazão, falha de alívio, oscilações turbulentas.
- **Condições de falha:**
  - **Sobrepressão:** força na comporta acima do limite por mais de 5 segundos → explosão do tanque.
  - **Nível seco:** altura de água abaixo de 0,05 m por mais de 5 segundos → perda de controle hidráulico.
- Objetivo: manter os 10 tanques operando por 90 segundos sem falhas.
- Sistema de feedback visual com barras de progresso, avisos de nível baixo e alertas de sobrepressão.
- Indicadores em tempo real: vazão de entrada/saída, altura de água, utilização da comporta (%), força aplicada.

### 6. Playground de Calor — Simulação Térmica Interativa (`HeatPlaygroundPage.jsx`) *[Comentado/Em desenvolvimento]*

Ambiente de simulação com três modos de transferência de calor e elementos de gamificação:

**Modo Condução 1D (FTCS explícito):**
- Solução numérica da equação de difusão térmica: $$\frac{\partial T}{\partial t} = \alpha\,\frac{\partial^2 T}{\partial x^2}$$
- Discretização por diferenças finitas com condições de contorno Dirichlet ajustáveis.
- Visualização térmica em cores com gradiente azul-vermelho.
- Termômetros interativos arrastáveis para ajuste das temperaturas de contorno.
- Objetivo do jogo: acertar temperatura no centro da barra.

**Modo Convecção (resfriamento de corpo sólido):**
- Solução da equação de resfriamento de Newton: $$\frac{dT}{dt} = -\frac{h\,A}{m\,c_p}\,(T - T_\infty)$$
- Controle de coeficiente convectivo $h$, área $A$, massa $m$ e calor específico $c_p$.
- Objetivo: resfriar placa até temperatura-alvo com ventilador virtual.

**Modo Radiação (controle térmico de satélite):**
- Balanço de energia com radiação térmica: $$\frac{dT}{dt} = \frac{\dot{Q}_{\text{sol}} - \varepsilon\,\sigma\,A\,(T^4 - T_{\text{sur}}^4)}{m\,c_p}$$
- Simulação de exposição solar intermitente (dia/noite orbital).
- Objetivo: manter temperatura do satélite dentro da faixa operacional (15–25°C).

**Características comuns:**
- Renderização em Canvas HTML5 com animação em 60 FPS via `requestAnimationFrame`.
- Sistema de pontuação dinâmico baseado em performance.
- Seleção de materiais (cobre, alumínio, aço, madeira, isolante) com propriedades termo-físicas.
- Ajustes responsivos de dimensões e interface interativa completa.

## 🗂️ Estrutura relevante

```
app/
 ├── page.js                    # Página principal com sistema de abas e roteamento
 ├── layout.js, globals.css     # Shell do Next.js e estilos globais
 ├── providers.jsx              # Contexto de tema (light/dark) com ThemeModeContext
 └── components/
      ├── PressureChart.jsx                      # Wrapper do Line Chart (Chart.js)
      ├── HeatTransferLab.jsx                    # Laboratório de modos de transferência
      ├── MaterialPropertiesLab.jsx              # Análise de propriedades termodinâmicas
      ├── ThermalSystem.jsx                      # Calculadora de resistências térmicas
      ├── MultiTankPressureControlGamePage.jsx   # Jogo de controle hidráulico
      └── HeatPlaygroundPage.jsx                 # Playground térmico interativo (dev)
```

## 🎮 Funcionalidades interativas

- **Sistema de abas responsivo** com Material UI Tabs para navegação entre simuladores.
- **Tema claro/escuro** controlado por Context API com persistência.
- **Cards arrastáveis** para organização livre de painéis de resultados.
- **Sliders e controles dinâmicos** para ajuste de parâmetros em tempo real.
- **Gráficos reativos** que atualizam instantaneamente com mudanças de entrada.
- **Simulações em tempo real** com loop de animação via `requestAnimationFrame`.
- **Sistema de gamificação** com pontuação, timers, eventos aleatórios e condições de vitória/derrota.
- **Feedback visual rico:** barras de progresso, alertas coloridos, tooltips informativos.
- **Drag-and-drop** para montagem de sistemas térmicos complexos.
- **Formatação internacionalizada** (pt-BR) para números e unidades.

## ▶️ Execução

```bash
npm install
npm run dev
# abrir http://localhost:3000
```

> **Observação:** Para temas claro/escuro a aplicação usa `ThemeModeContext` com Material UI; os gráficos são recalculados em tempo real conforme os controles são ajustados. As simulações dinâmicas utilizam métodos numéricos estáveis com passo de tempo adaptativo.

## 🎯 Aplicações educacionais

- **Fenômenos de Transporte:** Demonstração visual de princípios de hidrostática, transferência de calor e dinâmica de fluidos.
- **Métodos Numéricos:** Implementação prática de diferenças finitas (FTCS), métodos explícitos e balanços diferenciais.
- **Engenharia de Sistemas:** Análise de resistências térmicas em série, dimensionamento de comportas e controle de processos.
- **Aprendizado ativo:** Elementos de gamificação para engajamento e experimentação hands-on.
- **Análise de sensibilidade:** Exploração do impacto de parâmetros físicos em sistemas reais.

## 📚 Referências

- Incropera & DeWitt, _Fundamentals of Heat and Mass Transfer_
- White, _Fluid Mechanics_
- Documentação oficial: [Next.js](https://nextjs.org), [Material UI](https://mui.com), [Chart.js](https://www.chartjs.org), [Recharts](https://recharts.org), [dnd-kit](https://docs.dndkit.com)
