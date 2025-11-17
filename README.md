# FETRANS Lab — Simulador de Pressão e Transferência de Calor

Aplicação **Next.js (App Router)** que reúne simuladores interativos para apoiar as aulas de **EES7527 – Fenômenos de Transporte** (UFSC – Engenharia de Computação).  

A aplicação utiliza componentes client-side em **React** com **Material UI, Chart.js, Recharts** e **dnd-kit** para visualização dinâmica de fenômenos de **mecânica dos fluidos**, **transferência de calor** e **análise de propriedades termofísicas**.

---

## 🎓 Alinhamento com o plano de ensino da disciplina EES7527

A disciplina está organizada em três blocos principais. O FETRANS Lab foi estruturado para apoiar diretamente cada um deles:

### 🔹 Parte 1 – Introdução térmica, trabalho, calor e balanços de massa/energia
(Conteúdos: propriedades da matéria, pressão, trabalho, calor, formas de transferência de calor, conservação de energia e massa em sistemas e volumes de controle.)

**Simuladores/recursos usados:**

- **HeatTransferLab.jsx**  
  - Introdução às formas de transferência de calor (condução, convecção, radiação).  
  - Cálculo de fluxos de calor (𝑞ʺ, Q̇) a partir de diferenças de temperatura.
- **MultiTankPressureControlGamePage.jsx**  
  - Balanço de massa em volume de controle:  
    \[
    \frac{dV}{dt} = Q_{\text{in}} - Q_{\text{out}}
    \]
  - Intuição sobre armazenamento, entrada e saída de massa em sistemas hidráulicos.
- **MaterialPropertiesLab.jsx**  
  - Visualização de propriedades termofísicas (ρ, k, cₚ, μ) e sua relação com energia armazenada e escoamento.

---

### 🔹 Parte 2 – Transferência de Calor (condução 1D em regime permanente)
(Conteúdos: mecanismos de transmissão de calor, condução unidimensional permanente, parede plana, equivalência elétrica.)

**Simuladores/recursos usados:**

- **HeatTransferLab.jsx**  
  - **Condução 1D em placa plana, regime permanente**  
    - Perfil de temperatura:  
      \[
      T(x) = T_1 + (T_2 - T_1)\frac{x}{L}
      \]
    - Gradiente e fluxo de calor:  
      \[
      \frac{dT}{dx} = \frac{T_2 - T_1}{L}, \quad
      q'' = -k\frac{dT}{dx}, \quad
      \dot{Q} = q''A
      \]
  - **Convecção (Lei de Newton)**  
    \[
    q'' = h(T_s - T_\infty), \quad \dot{Q} = hA(T_s - T_\infty)
    \]
  - **Radiação térmica (superfície cinza)**  
    \[
    q'' = \varepsilon\sigma(T_s^4 - T_{\text{sur}}^4), \quad \dot{Q} = q''A
    \]
- **ThermalSystem.jsx** (Calculadora de resistência térmica)  
  - **Equivalência elétrica da transferência de calor**:  
    - Condução: \(R_{\text{cond}} = \dfrac{L}{k}\)  
    - Convecção: \(R_{\text{conv}} = \dfrac{1}{h}\)  
    - Resistência de contato: valor informado em \(\text{m}^2\cdot K/W\)  
    - Série térmica:  
      \[
      R_\text{total} = \sum_i R_i
      \]
- **MaterialPropertiesLab.jsx**  
  - Variação de \(k(T)\), \(c_p(T)\) e ρ(T) com a temperatura para diferentes materiais, relacionando propriedades termofísicas com a capacidade de condução e armazenamento de energia.

---

### 🔹 Parte 3 – Mecânica dos Fluidos
(Conteúdos: definição de fluido, propriedades, manometria, forças em superfícies submersas, empuxo, equações de conservação na forma integral, escoamento em dutos, equação de Bernoulli.)

**Simuladores/recursos usados:**

- **Simulador de Pressão Hidrostática (`app/page.js`)**  
  - Pressão em função da profundidade para fluidos incompressíveis:  
    \[
    P(h) = P_0 + \rho g h
    \]
  - Comparação de fluidos (água, óleo, mercúrio) e conversão de unidades (Pa, kPa, bar, atm, psi).  
  - Apoia os tópicos de **manometria**, **pressão em um ponto** e **variação de pressão em fluido estático**.
- **MultiTankPressureControlGamePage.jsx**  
  - **Força hidrostática em comportas**:  
    \[
    F_h = \frac{1}{2}\rho g h_{\text{eff}}^2 w
    \]
  - **Escoamento por orifício (Torricelli)**:  
    \[
    Q_{\text{out}} = C_d A_{\text{comporta}}\sqrt{2gh}, \quad C_d = 0{,}62
    \]
  - **Balanço de massa** em sistemas de múltiplos tanques, com condições de falha por sobrepressão e esvaziamento.  
  - Conecta com **forças em corpos submersos**, **empuxo**, **escoamento interno** e noções de escoamento em dutos.
- **MaterialPropertiesLab.jsx**  
  - **ρ(T)** e **μ(T)** → suporte à discussão de **propriedades dos fluidos**, regimes laminar/turbulento e influência da temperatura no escoamento.

---

## ℹ️ Principais conhecimentos aplicados

### 🔧 Computação / Engenharia de Software

- **Front-end:** Next.js 13+, React 18, Context API para tema, CSS Modules/`@mui/material`, componentes client-side.
- **UI/UX:** Material UI (layout responsivo, cards, abas), ícones, sliders, chips, tooltips, drag-and-drop com dnd-kit.
- **Visualização de dados:** Chart.js (via `react-chartjs-2`) e Recharts para gráficos de linha e radar.
- **Modelagem numérica no front-end:**  
  - Hooks (`useMemo`, `useState`, `useEffect`) para gerar perfis discretizados.  
  - Controle de domínios (clamp), formatação internacionalizada e simulações em tempo real.

### 🔬 Fenômenos de Transporte / Física aplicada

- Hidrostática (pressão com a profundidade, força em comportas).  
- Propriedades termofísicas dependentes da temperatura.  
- Condução, convecção e radiação térmica.  
- Resistências térmicas em série e equivalência elétrica.  
- Dinâmica de fluidos em tanques, escoamento por orifício.  
- Balanços de massa e energia em regime estacionário e transiente.  
- Métodos numéricos (diferenças finitas – FTCS, resolução de ODEs).

---

## 🔬 Modelos físicos implementados

### 1. Simulador de Pressão Hidrostática (`app/page.js`)

Pressão absoluta ao longo da profundidade para fluidos incompressíveis:

- **Equação básica:**  
  \[
  P(h) = P_0 + \rho g h
  \]
- Conversão automática entre unidades (Pa, kPa, bar, atm, psi).
- Ajuste de densidade (`ρ`), gravidade (`g`), profundidade máxima (`h`) e número de pontos.
- Interface com card de resultados flutuante e arrastável.
- Banco de fluidos pré-configurados (água, óleo, mercúrio) ou densidade personalizada.

> **Relaciona-se com:** manometria, pressão em um ponto, variação de pressão em fluido estático, estática dos fluidos.

---

### 2. Laboratório de Transferência de Calor (`HeatTransferLab.jsx`)

| Modo                                             | Hipóteses                                            | Fórmulas principais                                                                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Condução (placa plana 1D, regime permanente)     | k constante, área A uniforme                         | Perfil linear: \(T(x) = T_1 + (T_2 - T_1)\frac{x}{L}\)  /  Fluxos: \(\frac{dT}{dx} = \frac{T_2 - T_1}{L}\), \(q'' = -k\frac{dT}{dx}\), \(\dot{Q} = q''A\) |
| Convecção (Lei de Newton)                        | h constante, superfície uniforme                     | \(q'' = h(T_s - T_\infty)\), \(\dot{Q} = hA(T_s - T_\infty)\)                                                                                           |
| Radiação (superfície cinza p/ ambiente grande)   | ε constante, visão para cavidade grande             | \(q'' = \varepsilon \sigma (T_s^4 - T_{\text{sur}}^4)\), \(\dot{Q} = q''A\)  com conversão automática \(T[K] = T[^\circ C] + 273{,}15\)                       |

> **Relaciona-se com:** mecanismos de transmissão de calor, condução 1D em regime permanente, fluxos de calor, 1ª lei da termodinâmica (energia trocada como calor).

---

### 3. Laboratório de Propriedades dos Materiais (`MaterialPropertiesLab.jsx`)

- Banco de materiais com propriedades dependentes da temperatura `T` (funções polinomiais/exponenciais simplificadas).
- Gráficos de variação com a temperatura e gráfico radar normalizado.
- Propriedades tratadas:
  - densidade `ρ(T)`
  - calor específico `c_p(T)`
  - condutividade térmica `k(T)`
  - viscosidade dinâmica `μ(T)`

> **Relaciona-se com:** propriedades da matéria, influência de ρ, μ, k e cₚ em escoamentos e transferência de calor.

---

### 4. Calculadora de Resistência Térmica (`ThermalSystem.jsx`)

Montagem interativa de “sanduíche térmico” com convecções e resistências de contato:

- **Resistência de camada:**  
  \[
  R_{\text{cond}} = \frac{L}{k}
  \]
- **Resistência convectiva:**  
  \[
  R_{\text{conv}} = \frac{1}{h}
  \]
- **Resistência de contato (opcional):** valor informado em \(\text{m}^2\cdot K/W\)
- **Resistência total:** soma de todas as parcelas em série  
  \[
  R_\text{total} = \sum_i R_i
  \]
- Interface drag-and-drop, cálculo dinâmico e detalhamento dos termos.

> **Relaciona-se com:** equivalência elétrica para transferência de calor, condução 1D em parede plana, combinação de resistências térmicas em série.

---

### 5. Controle de Tanques Pressurizados — Jogo Interativo (`MultiTankPressureControlGamePage.jsx`)

Simulador gamificado de controle de **10 tanques hidráulicos** em tempo real com mecânica dos fluidos aplicada.

**Fundamentos físicos:**

- **Volume e altura:**  
  \[
  V = A \cdot h, \quad A = 15\,\text{m}^2
  \]
- **Força hidrostática na comporta:**  
  \[
  F_h = \frac{1}{2}\rho g h_{\text{eff}}^2 w
  \]
- **Escoamento por orifício (Torricelli):**  
  \[
  Q_{\text{out}} = C_d A_{\text{comporta}}\sqrt{2gh}, \quad C_d = 0{,}62
  \]
- **Balanço de massa:**  
  \[
  \frac{dV}{dt} = Q_{\text{in}} - Q_{\text{out}}
  \]

**Mecânicas do jogo:**

- Controle binário (ON/OFF) de comportas por tanque via switches.
- Configuração de material da comporta (aço, concreto, madeira) com limite de força suportado.
- Eventos aleatórios: aumento súbito de vazão, falha de alívio, oscilações turbulentas.
- **Condições de falha:**
  - **Sobrepressão:** força na comporta acima do limite por > 5 s → explosão do tanque.
  - **Nível seco:** altura de água abaixo de 0,05 m por > 5 s → perda de controle hidráulico.
- Objetivo: manter os 10 tanques operando por **90 s** sem falhas.
- Sistema de feedback visual com barras de progresso, avisos de nível baixo e alertas de sobrepressão.
- Indicadores em tempo real: vazão de entrada/saída, altura de água, utilização da comporta (%), força aplicada.

> **Relaciona-se com:** forças hidrostáticas e empuxo, escoamento em dutos/orifícios, balanços de massa em volume de controle, dinâmica de fluidos em tanques.

---

## 🗂️ Estrutura relevante do projeto

```bash
app/
 ├── page.js                    # Página principal com sistema de abas e roteamento
 ├── layout.js, globals.css     # Shell do Next.js e estilos globais
 ├── providers.jsx              # Contexto de tema (light/dark) com ThemeModeContext
 └── components/
      ├── PressureChart.jsx                      # Wrapper do Line Chart (Chart.js)
      ├── HeatTransferLab.jsx                    # Laboratório de modos de transferência de calor
      ├── MaterialPropertiesLab.jsx              # Análise de propriedades termofísicas
      ├── ThermalSystem.jsx                      # Calculadora de resistências térmicas
      └── MultiTankPressureControlGamePage.jsx   # Jogo de controle hidráulico em tanques
