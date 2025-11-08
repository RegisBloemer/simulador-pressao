# FETRANS Lab — Simulador de Pressão e Transferência de Calor

Aplicação Next.js (App Router) que reúne simuladores interativos para apoiar aulas de Fenômenos de Transporte. Utiliza componentes client-side em React com Material UI, Chart.js, Recharts e dnd-kit para visualização dinâmica de fenômenos de mecânica dos fluidos, transferência de calor e análise de composições térmicas.

## ℹ️ Principais conhecimentos aplicados

- **Front-end:** Next.js 13+, React 18, Context API para tema, CSS Modules/`@mui/material`, componentes client-side.
- **UI/UX:** Material UI (layout responsivo, cards, abas), ícones, sliders, chips, tooltips, drag-and-drop com dnd-kit.
- **Visualização de dados:** Chart.js (via `react-chartjs-2`) e Recharts para gráficos de linha e radar.
- **Modelagem numérica:** Hooks (`useMemo`, `useState`) para gerar perfis discretizados, clamp de domínios e formatação internacionalizada.
- **Física aplicada:** Hidrostática, condução, convecção, radiação térmica, propriedades termofísicas dependentes da temperatura, resistências térmicas em série.

## 🔬 Modelos físicos implementados

### 1. Simulador de Pressão Hidrostática (`app/page.js`)

Pressão absoluta ao longo da profundidade para fluidos incompressíveis:

- **Equação básica:** $$P(h) = P_0 + \rho\,g\,h$$
- Conversão automática entre unidades (Pa, kPa, bar, atm, psi).
- Ajuste de densidade (`ρ`), gravidade (`g`), profundidade máxima (`h`) e pontos de discretização.

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

### 4. Sistema Térmico em Série (`ThermalSystem.jsx`)

Montagem interativa de sanduíche térmico com convecções e resistências de contato:

- **Resistência de camada:** $$R_{\text{cond}} = \frac{L}{k}$$
- **Resistência convectiva:** $$R_{\text{conv}} = \frac{1}{h}$$
- **Resistência de contato (se habilitada):** valor informado em \( \text{m}^2\cdot K/W \)
- **Resistência total:** soma de todas as parcelas em série $$R_\text{total} = \sum_i R_i$$
- Interface drag-and-drop, cálculo dinâmico e detalhamento dos termos.

## 🗂️ Estrutura relevante

```
app/
 ├── page.js                    # Página principal com abas e simulador hidrostático
 ├── layout.js, globals.css     # Shell do Next.js e estilos globais
 ├── providers.jsx              # Contexto de tema (light/dark)
 └── components/
      ├── HeatTransferLab.jsx
      ├── MaterialPropertiesLab.jsx
      ├── ThermalSystem.jsx
      ├── HeatPlaygroundPage.jsx (placeholder)
      └── PressureChart.jsx     # Wrapper do Line Chart (Chart.js)
```

## ▶️ Execução

```bash
npm install
npm run dev
# abrir http://localhost:3000
```

> **Observação:** Para temas claro/escuro a aplicação usa `ThemeModeContext` com Material UI; os gráficos são recalculados em tempo real conforme os controles são ajustados.

## 📚 Referências

- Incropera & DeWitt, _Fundamentals of Heat and Mass Transfer_
- White, _Fluid Mechanics_
- Documentação oficial: [Next.js](https://nextjs.org), [Material UI](https://mui.com), [Chart.js](https://www.chartjs.org), [Recharts](https://recharts.org), [dnd-kit](https://docs.dndkit.com)
