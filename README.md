# FETRANS Lab — Trabalho de Fenômenos de Transporte

## Resumo do projeto

Esta aplicação feita com **Next.js** e reúne telas interativos para apoiar estudantes a entender e visualizar conceitos da materia de **Fenômenos de Transporte**. A plicação por ter um intuito educacional, exibe as formulas principais que são utilizadas em cada simulação bem como legendas explicativas em alguns momentos, também conta com um switch de tema claro/escuro para melhor usabilidade.

Nos meios técnicos, a aplicação utiliza componentes client-side em **React** com **Material UI, Chart.js, Recharts** e **dnd-kit** para visualização dinâmica de fenômenos de **mecânica dos fluidos**, **transferência de calor** e **análise de propriedades**.

A aplicação que esta descrita neste documento esta acessível em: [https://fetrans-lab.vercel.app/](https://fetrans-lab.vercel.app/)

---

## Alinhamento com o plano de ensino

### 🔹 Parte 1 – Introdução térmica, trabalho, calor e balanços de massa/energia

Conteudos que utilizamos nas telas a seguir: propriedades da matéria, pressão, trabalho, calor, formas de transferência de calor, conservação de energia e massa em sistemas e volumes de controle.

**Telas e conteúdos utilizados especificadamente**

- **HeatTransferLab.jsx**

  - Introdução às formas de transferência de calor (condução, convecção, radiação).
  - Cálculo de fluxos de calor (q'', Q̇) a partir de diferenças de temperatura.

- **MultiTankPressureControlGamePage.jsx**

  - Balanço de massa em volume de controle:

    $$\dfrac{dV}{dt} = Q_{\text{in}} - Q_{\text{out}}$$

  - Intuição sobre armazenamento, entrada e saída de massa em sistemas hidráulicos.

- **MaterialPropertiesLab.jsx**

  - Visualização de propriedades (ρ, k, c_p, μ) e sua relação com energia armazenada e escoamento.

---

### 🔹 Parte 2 – Transferência de Calor (condução 1D em regime permanente)

Conteudos que utilizamos nas telas a seguir: mecanismos de transmissão de calor, condução unidimensional permanente, parede plana, equivalência elétrica.

**Telas e conteúdos utilizados especificadamente**

- **HeatTransferLab.jsx**

  - **Condução 1D em placa plana, regime permanente**

    Perfil de temperatura:

    $$T(x) = T_1 + (T_2 - T_1)\dfrac{x}{L}$$

    Gradiente e fluxo de calor:

    $$\dfrac{dT}{dx} = \dfrac{T_2 - T_1}{L}, \quad q'' = -k\dfrac{dT}{dx}, \quad \dot{Q} = q''A$$

  - **Convecção (Lei de Newton)**

    $$q'' = h(T_s - T_\infty), \quad \dot{Q} = hA(T_s - T_\infty)$$

  - **Radiação térmica (superfície cinza)**

    $$q'' = \varepsilon\sigma(T_s^4 - T_{\text{sur}}^4), \quad \dot{Q} = q''A$$

- **ThermalSystem.jsx** (Calculadora de resistência térmica)

  - **Equivalência elétrica da transferência de calor**:

    Condução:

    $$R_{\text{cond}} = \dfrac{L}{k}$$

    Convecção:

    $$R_{\text{conv}} = \dfrac{1}{h}$$

    Resistência de contato: valor informado em m²·K/W

    Série térmica:

    $$R_\text{total} = \sum_i R_i$$

- **MaterialPropertiesLab.jsx**

  - Variação de k(T), c_p(T) e ρ(T) com a temperatura para diferentes materiais, relacionando propriedades termofísicas com a capacidade de condução e armazenamento de energia.

---

### 🔹 Parte 3 – Mecânica dos Fluidos

Conteudos que utilizamos nas telas a seguir: definição de fluido, propriedades, manometria, forças em superfícies submersas, empuxo, equações de conservação na forma integral, escoamento em dutos, equação de Bernoulli.

**Telas e conteúdos utilizados especificadamente**

- **Simulador de Pressão Hidrostática (`app/page.js`)**

  - Pressão em função da profundidade para fluidos incompressíveis:

    $$P(h) = P_0 + \rho gh$$

  - Comparação de fluidos (água, óleo, mercúrio) e conversão de unidades (Pa, kPa, bar, atm, psi).

  - Apoia os tópicos de **manometria**, **pressão em um ponto** e **variação de pressão em fluido estático**.

- **MultiTankPressureControlGamePage.jsx**

  - **Força hidrostática em comportas**:

    $$F_h = \dfrac{1}{2}\rho g h_{\text{eff}}^2 w$$

  - **Escoamento por orifício**:

    $$Q_{\text{out}} = C_d A_{\text{comporta}}\sqrt{2gh}, \quad C_d = 0{,}62$$

  - **Balanço de massa** em sistemas de múltiplos tanques, com condições de falha por sobrepressão e esvaziamento:

    $$\dfrac{dV}{dt} = Q_{\text{in}} - Q_{\text{out}}$$

  - Conecta com **forças em corpos submersos**, **empuxo**, **escoamento interno** e noções de escoamento em dutos.

- **MaterialPropertiesLab.jsx**

  - ρ(T) e μ(T) → Visualização de **propriedades dos fluidos**.

---

### Computação e tecnologias utilizadas

- **Front-end:** Next.js 13+, React 18, Context API para tema, CSS Modules/`@mui/material`, componentes client-side.
- **UI/UX:** Material UI (layout responsivo, cards, abas), ícones, sliders, chips, tooltips, drag-and-drop com dnd-kit.
- **Visualização de dados:** Chart.js (via `react-chartjs-2`) e Recharts para gráficos de linha e radar.
- **Modelagem numérica no front-end:**

  - Hooks (`useMemo`, `useState`, `useEffect`) para gerar perfis discretizados.
  - Controle de domínios (_clamp_), formatação internacionalizada e simulações em tempo real.

---

## Telas da aplicação e funcionalidades principais

### 1. Simulador de Pressão Hidrostática (`app/page.js`)

![Simulador de Pressão](/public/simulador-pressao.png)

Pressão absoluta ao longo da profundidade para fluidos incompressíveis:

$$P(h) = P_0 + \rho gh$$

- Conversão automática entre unidades (Pa, kPa, bar, atm, psi).
- Ajuste de densidade (ρ), gravidade (g), profundidade máxima (h) e número de pontos.
- Interface com card de resultados flutuante e arrastável.
- Banco de fluidos pré-configurados (água, óleo, mercúrio) ou densidade personalizada.

> **Relaciona-se com:** manometria, pressão em um ponto, variação de pressão em fluido estático, estática dos fluidos.

#### Como usar esta tela

1. **Escolher o fluido**

   - No topo da tela há uma lista com opções como _água_, _óleo_, _mercúrio_.
   - Clique no fluido desejado.
   - Se quiser outro fluido, escolha a opção de **densidade personalizada** e digite o valor de ρ.

2. **Ajustar as condições**

   - Use os campos/controles para:

     - Definir a **gravidade (g)**.
     - Definir a **profundidade máxima (h)** que deseja analisar.
     - Definir o **número de pontos** do gráfico (quanto maior, mais suave o gráfico).

3. **Escolher a unidade de pressão**

   - Há uma seleção de unidades (Pa, kPa, bar, atm, psi).
   - Clique na unidade que o professor prefere visualizar.

4. **Ler o gráfico e o card de resultados**

   - O **gráfico** mostra como a pressão aumenta com a profundidade.
   - O **card de resultados** (caixinha com números) mostra os valores calculados; ele pode ser arrastado com o mouse para não atrapalhar a visualização.

---

### 2. Laboratório de Transferência de Calor (`HeatTransferLab.jsx`)

![Laboratório de Transferência de Calor](/public/heat-transfer-lab.png)

| Modo                                           | Hipóteses                                           | Fórmulas principais                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Condução (placa plana 1D, regime permanente)   | $k$ constante, área $A$ uniforme                    | Perfil linear: $T(x) = T_1 + (T_2 - T_1)\dfrac{x}{L}$ • Fluxos: $\dfrac{dT}{dx} = \dfrac{T_2 - T_1}{L}$, $q'' = -k\dfrac{dT}{dx}$, $\dot{Q} = q''A$ |
| Convecção (Lei de Newton)                      | $h$ constante, superfície uniforme                  | $q'' = h(T_s - T_\infty)$, $\dot{Q} = hA(T_s - T_\infty)$                                                                                           |
| Radiação (superfície cinza p/ ambiente grande) | $\varepsilon$ constante, visão para cavidade grande | $q'' = \varepsilon \sigma (T_s^4 - T_{\text{sur}}^4)$, $\dot{Q} = q''A$                                                                             |

> **Relaciona-se com:** mecanismos de transmissão de calor, condução 1D em regime permanente, fluxos de calor, 1ª lei da termodinâmica (energia trocada como calor).

#### Como usar esta tela

1. **Escolher o modo de transferência de calor**

   - Na parte superior há abas ou botões com os modos **Condução**, **Convecção** e **Radiação**.
   - Clique no modo que deseja estudar.

2. **Preencher as temperaturas**

   - Para **condução**: informar as temperaturas nas faces (T₁ e T₂), o comprimento L da placa e a condutividade térmica k.
   - Para **convecção**: informar a temperatura da superfície (Tₛ), a temperatura do fluido (T∞) e o coeficiente de convecção h.
   - Para **radiação**: informar Tₛ, T_sur (temperatura do ambiente), emissividade ε.

3. **Informar área e demais parâmetros**

   - Quando houver campo para **área A**, preencher com o valor desejado (por exemplo, área da parede ou superfície).
   - Os campos numéricos geralmente aparecem com caixas ou _sliders_ (barrinhas que se arrastam).

4. **Observar os resultados no gráfico e nos textos**

   - O simulador mostra:

     - O **perfil de temperatura** (no caso da condução).
     - O **fluxo de calor q''**.
     - A **taxa total de calor Q̇**.

   - Os resultados são recalculados automaticamente ao mudar qualquer valor.

---

### 3. Laboratório de Propriedades dos Materiais (`MaterialPropertiesLab.jsx`)

![Laboratório de Propriedades](/public/material-properties-lab.png)

- Banco de materiais com propriedades dependentes da temperatura T.
- Gráficos de variação com a temperatura e gráfico radar.
- Propriedades tratadas:

  - densidade ρ(T)
  - calor específico c_p(T)
  - condutividade térmica k(T)
  - viscosidade dinâmica μ(T)

> **Relaciona-se com:** propriedades da matéria, influência de ρ, μ, k e c_p em escoamentos e transferência de calor.

#### Como usar esta tela

1. **Escolher o material**

   - À esquerda (ou no topo) há uma lista de materiais (por exemplo: água, ar, aço, etc.).
   - Clique no material que deseja analisar.

2. **Ajustar a faixa de temperatura**

   - Use o controle (caixas ou _slider_) para definir:

     - **Temperatura mínima** e **máxima** da análise.

   - Isso faz os gráficos mostrarem como as propriedades mudam nesse intervalo.

3. **Ler os gráficos individuais**

   - São exibidos gráficos de:

     - **ρ(T)** – densidade.
     - **c_p(T)** – calor específico.
     - **k(T)** – condutividade térmica.
     - **μ(T)** – viscosidade dinâmica.

   - Cada gráfico mostra a **dependência com a temperatura**.

4. **Interpretar o gráfico em “radar”**

   - O gráfico em formato de radar mostra as propriedades **normalizadas** (sem unidade) para facilitar comparação entre materiais.
   - Quanto maior o “braço” no radar, maior é a propriedade relativa naquele ponto.

5. **Comparar materiais**

   - Troque o material na lista e observe como:

     - Materiais com **alta condutividade térmica (k)** são melhores condutores de calor.
     - Materiais com **alta viscosidade (μ)** tendem a escoar com mais “resistência”.

---

### 4. Calculadora de Resistência Térmica (`ThermalSystem.jsx`)

![Calculadora de Resistência Térmica](/public/thermal-system.png)

Montagem interativa de sistemas térmicos com suporte a **resistências em série e em paralelo**, convecção e resistências de contato.

**Cálculo de resistências individuais:**

- **Resistência de camada (condução):**

  $$R_{\text{cond}} = \dfrac{L}{k}$$

- **Resistência convectiva:**

  $$R_{\text{conv}} = \dfrac{1}{h}$$

- **Resistência de contato (opcional):** valor informado em m²·K/W

**Combinação de resistências:**

- **Em série (empilhamento vertical):**

  $$R_{\text{série}} = R_1 + R_2 + R_3 + \ldots = \sum_i R_i$$

  _Exemplo:_ Parede de concreto → isolamento EPS → gesso = $R_{\text{total}} = R_{\text{concreto}} + R_{\text{EPS}} + R_{\text{gesso}}$

- **Em paralelo (caminhos alternativos):**

  $$\dfrac{1}{R_{\text{paralelo}}} = \dfrac{1}{R_1} + \dfrac{1}{R_2} + \ldots \quad \Rightarrow \quad R_{\text{paralelo}} = \dfrac{1}{\sum_i \frac{1}{R_i}}$$

  _Exemplo:_ Duas camadas lado a lado (50% tijolo, 50% concreto) = $R_{\text{equiv}} = \dfrac{1}{\frac{1}{R_{\text{tijolo}}} + \frac{1}{R_{\text{concreto}}}}$

- **Sistemas mistos (série + paralelo):**

  Grupos paralelos são primeiro reduzidos a uma resistência equivalente, depois somados em série com as demais camadas.

  _Exemplo:_ Convecção externa → [Tijolo || Concreto] → Isolamento → Convecção interna

  $$R_{\text{total}} = R_{\text{conv,ext}} + R_{\text{paralelo}} + R_{\text{isolamento}} + R_{\text{conv,int}}$$

> **Relaciona-se com:** equivalência elétrica para transferência de calor, condução 1D em parede plana, combinação de resistências térmicas em série e paralelo, análise de sistemas térmicos complexos.

---

#### Como usar esta tela

#### Como usar esta tela (passo a passo)

1. **Entender a tela (3 colunas)**

   - **Esquerda – “Materiais disponíveis”**
     Lista de cartões com materiais (Concreto, Tijolo, EPS, Vidro etc.). Cada cartão mostra k, espessura padrão e R aproximado.
   - **Centro – “Composição do sistema”**
     Área onde você monta a parede/sistema térmico: convecção externa → camadas → contatos → convecção interna.
   - **Direita – “Resultados de resistência térmica”**
     Mostra o **R_total** e o detalhamento de cada parte (camadas, convecções, contatos, grupos em paralelo).

2. **Montar uma parede simples (camadas em série)**

   1. Na coluna da **esquerda**, clique e **arraste** um material (por exemplo, _Concreto_) para a área central cinza onde aparece o texto _“Arraste materiais da lista à esquerda para iniciar o sistema”_.
   2. Para adicionar outras camadas (Tijolo, EPS, Gesso etc.), basta **arrastar mais materiais** um abaixo do outro para essa mesma área.
   3. Em cada cartão de camada, ajuste a **espessura L (m)** no campo `Espessura L (m)`.
   4. Se quiser trocar o material de uma camada já criada, use o campo **“Material”** dentro do próprio cartão.

3. **Configurar convecção externa e interna**

   - Acima das camadas há o cartão **“Convecção externa (ambiente → 1º material)”**.
   - Abaixo das camadas há o cartão **“Convecção interna (último material → ambiente)”**.
   - Em cada um deles:

     1. Use o interruptor **“Considerar convecção”** para ligar/desligar a convecção daquele lado.
     2. Preencha o valor de **h (W/m²·K)**.
     3. A calculadora mostra automaticamente o valor de **R_conv ≈ 1/h** no _chip_ ao lado.

4. **Adicionar resistência de contato entre camadas**

   - Entre duas camadas consecutivas aparece um conector com o rótulo **“Contato”**.
   - Para considerar resistência de contato:

     1. Ative o interruptor **“Contato”**.
     2. Preencha o campo **`R_cont (m²·K/W)`**.

   - Esse valor passa a ser somado automaticamente em série ao sistema.

5. **Criar camadas em paralelo (grupo em paralelo)**

   1. Escolha uma camada que será a “base” do grupo em paralelo.
   2. No cartão dessa camada, clique no botão com o ícone **“+”** (dica de ferramenta: _“Adicionar camada em paralelo”_).
   3. A calculadora cria uma nova camada **ao lado**, formando um grupo em paralelo (bordas destacadas e fundo levemente colorido).
   4. Você pode mudar o material e a espessura dessa nova camada normalmente.
   5. Todas as camadas com borda destacada fazem parte do **mesmo grupo em paralelo**, e a ferramenta calcula automaticamente o **R_eq** desse grupo.

6. **Reorganizar ou remover camadas**

   - Para **mudar a ordem** das camadas (por exemplo, colocar o gesso antes do EPS), clique e **arraste o cartão** da camada para cima ou para baixo.
   - Para **remover** uma camada, clique no ícone de **lixeira** (vermelho) no canto direito do cartão.

7. **Ler o resultado final**

   - Na coluna da **direita**, a parte superior mostra:

     - `R_total = ... m²·K/W` (considerando área de 1 m²).

   - Abaixo, em **“Detalhamento por elemento”**, aparece uma lista indicando:

     - Convecção externa, cada camada (Concreto, Tijolo, etc.), grupos em paralelo e resistências de contato, **cada uma** com seu valor de R.

   - A expressão final mostrada em texto indica a soma de todos os termos usados para chegar ao **R_total**.

---

### 5. Controle de Tanques Pressurizados — Jogo Interativo (`MultiTankPressureControlGamePage.jsx`)

![Jogo de Controle de Tanques](/public/multitank-game.png)

Jogo interativo para controlar 10 tanques hidráulicos com comportas, evitando falhas por sobrepressão ou esvaziamento.

**Fundamentos físicos:**

- **Volume e altura:**

  $$V = A \cdot h, \quad A = 15\text{ m}^2$$

- **Força hidrostática na comporta:**

  $$F_h = \dfrac{1}{2}\rho g h_{\text{eff}}^2 w$$

- **Escoamento por orifício:**

  $$Q_{\text{out}} = C_d A_{\text{comporta}}\sqrt{2gh}, \quad C_d = 0{,}62$$

- **Balanço de massa:**

  $$\dfrac{dV}{dt} = Q_{\text{in}} - Q_{\text{out}}$$

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

#### Como usar esta tela

1. **Iniciar o jogo**

   - Clique no botão **“Iniciar”** ou **“Start”** (dependendo do rótulo da interface).
   - O cronômetro começa a contar até **90 segundos**.

2. **Entender o que aparece para cada tanque**
   Cada um dos 10 tanques costuma mostrar:

   - Altura de água (em forma de **barra** ou desenho do tanque).
   - Um **interruptor ON/OFF** para abrir/fechar a comporta.
   - Indicadores numéricos de:

     - Vazão de entrada (Q_in).
     - Vazão de saída (Q_out).
     - Força na comporta e/ou utilização em %.

3. **Controlar as comportas**

   - Clique no **switch ON/OFF** de cada tanque:

     - **ON** → comporta aberta → aumenta o escoamento de saída.
     - **OFF** → comporta fechada → acumula volume/altura no tanque.

4. **Observar os alertas**

   - **Sobrepressão:** aparece algum aviso visual (cor vermelha, ícone de alerta) quando a força na comporta está muito alta.
   - **Nível seco:** aparece alerta quando a altura de água fica muito baixa.
   - Se a situação crítica permanecer por mais de alguns segundos, o tanque “falha” (explosão ou perda de controle).

5. **Objetivo**

   - Manter **todos os tanques funcionando** sem falha até o fim dos **90 segundos**.
   - Isso exige equilibrar **entrada** e **saída** em cada tanque, usando apenas os switches.

---

## Estrutura relevante do projeto

```bash
app/
├── page.js                    # Página principal com sistema de abas e roteamento
├── layout.js, globals.css     # Shell do Next.js e estilos globais
├── providers.jsx              # Contexto de tema (light/dark) com ThemeModeContext
└── components/
      ├── PressureChart.jsx                      # Wrapper do Line Chart (Chart.js)
      ├── HeatTransferLab.jsx                    # Laboratório de modos de transferência de calor
      ├── MaterialPropertiesLab.jsx              # Análise de propriedades termofísicas
      └── ThermalSystem.jsx                      # Calculadora de resistências térmicas
      └── MultiTankPressureControlGamePage.jsx   # Jogo de controle hidráulico em tanques
```
