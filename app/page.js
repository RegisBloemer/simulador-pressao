// app/page.js
'use client';

import * as React from 'react';
import PressureChart from './components/PressureChart';
import UfscSolver from './components/UfscSolver';
import HeatPlaygroundPage from './components/HeatPlaygroundPage';
import HeatTransferLab from './components/HeatTransferLab';
import MaterialPropertiesLab from './components/MaterialPropertiesLab';
import { ThemeModeContext } from './providers';
import { useTheme, alpha } from '@mui/material/styles';

import {
  Box, Container, Grid, Card, CardContent, CardHeader,
  Typography, TextField, Slider, ToggleButtonGroup, ToggleButton,
  Select, MenuItem, InputAdornment, FormControlLabel, Switch,
  IconButton, Divider, Tooltip, Button, Stack, Tabs, Tab
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';

// ---------- Utilidades ----------
const FLUIDOS = {
  'Água (20°C)': 998,
  'Óleo (mineral)': 850,
  'Mercúrio': 13546,
  'Personalizado': null
};
const UNIDADES = ['Pa', 'kPa', 'bar', 'atm', 'psi'];

function toSelectedUnit(valuePa, unit) {
  switch (unit) {
    case 'kPa': return valuePa / 1e3;
    case 'bar': return valuePa / 1e5;
    case 'atm': return valuePa / 101325;
    case 'psi': return valuePa / 6894.757293168;
    default:    return valuePa;
  }
}
function fromSelectedUnit(value, unit) {
  switch (unit) {
    case 'kPa': return value * 1e3;
    case 'bar': return value * 1e5;
    case 'atm': return value * 101325;
    case 'psi': return value * 6894.757293168;
    default:    return value;
  }
}
function formatNumber(x, digits = 3) {
  if (Math.abs(x) >= 1000) return x.toLocaleString('pt-BR', { maximumFractionDigits: digits });
  return x.toLocaleString('pt-BR', { maximumSignificantDigits: digits });
}

export default function Home() {
  const { mode, setMode } = React.useContext(ThemeModeContext);
  const theme = useTheme();

  // ---- Abas
  const [tab, setTab] = React.useState('simulador');

  // ---- Estado do simulador
  const [fluido, setFluido] = React.useState('Água (20°C)');
  const [rho, setRho] = React.useState(FLUIDOS['Água (20°C)']);
  const [g, setG] = React.useState(9.80665);
  const [altura, setAltura] = React.useState(5);
  const [p0Ativo, setP0Ativo] = React.useState(true);
  const [p0Unidade, setP0Unidade] = React.useState('atm');
  const [p0Valor, setP0Valor] = React.useState(1);
  const [unidadeSaida, setUnidadeSaida] = React.useState('kPa');
  const [nPontos, setNPontos] = React.useState(51);

  React.useEffect(() => {
    if (fluido !== 'Personalizado') setRho(FLUIDOS[fluido]);
  }, [fluido]);

  const p0Pa = p0Ativo ? fromSelectedUnit(p0Valor, p0Unidade) : 0;

  const depths = React.useMemo(() => {
    const arr = [];
    const N = Math.max(2, Math.min(500, nPontos));
    for (let i = 0; i < N; i++) arr.push((i / (N - 1)) * altura);
    return arr;
  }, [altura, nPontos]);

  const pressuresPa = React.useMemo(() => depths.map(h => p0Pa + rho * g * h), [depths, rho, g, p0Pa]);
  const pressuresOut = React.useMemo(() => pressuresPa.map(p => toSelectedUnit(p, unidadeSaida)), [pressuresPa, unidadeSaida]);

  const topoPa = pressuresPa[0];
  const fundoPa = pressuresPa[pressuresPa.length - 1];

  const chartData = {
    labels: depths.map(d => d.toFixed(2)),
    datasets: [{
      label: `Pressão (${unidadeSaida})`,
      data: pressuresOut,
      borderWidth: 2.5,
      borderColor: alpha(theme.palette.primary.main, 0.9),
      fill: false,
      tension: 0.15,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointHitRadius: 12,
      pointBackgroundColor: theme.palette.background.paper,
      pointBorderColor: theme.palette.primary.main,
      pointBorderWidth: 2,
      pointStyle: 'circle',
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    plugins: {
      legend: { display: true },
      title: { display: true, text: 'Pressão × Profundidade' },
      tooltip: {
        callbacks: {
          title: ctx => `h = ${Number(ctx[0].label).toLocaleString('pt-BR')} m`,
          label: ctx => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)}`
        }
      }
    },
    scales: {
      x: { title: { display: true, text: 'Profundidade (m)' },
           grid: { color: alpha(theme.palette.text.primary, 0.08) } },
      y: { title: { display: true, text: `Pressão (${unidadeSaida})` },
           grid: { color: alpha(theme.palette.text.primary, 0.08) } }
    }
  };

  const setRhoSafe = v => setRho(Math.max(0, Number(v) || 0));
  const setGSafe = v => setG(Math.max(0, Number(v) || 0));
  const setAlturaSafe = v => setAltura(Math.max(0, Number(v) || 0));

  const resetPadroes = () => {
    setFluido('Água (20°C)');
    setRho(FLUIDOS['Água (20°C)']);
    setG(9.80665);
    setAltura(5);
    setP0Ativo(true);
    setP0Unidade('atm');
    setP0Valor(1);
    setUnidadeSaida('kPa');
    setNPontos(51);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header com tema */}
      <Grid container spacing={3} alignItems="center" sx={{ mb: 1 }}>
        <Grid item xs={12} md="auto">
          <Typography variant="h4" fontWeight={700}>Laboratório Hidro & Solver</Typography>
        </Grid>
        <Grid item xs />
        <Grid item>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, val) => { if (val) setMode(val); }}
            size="small"
          >
            <ToggleButton value="light" aria-label="tema-claro"><LightModeIcon /></ToggleButton>
            <ToggleButton value="dark" aria-label="tema-escuro"><DarkModeIcon /></ToggleButton>
          </ToggleButtonGroup>
        </Grid>
      </Grid>

      {/* Abas */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        textColor="primary"
        indicatorColor="primary"
        sx={{ mb: 2 }}
      >
        <Tab label="Simulador de Pressão" value="simulador" />
        <Tab label="Solucionador UFSC" value="solver" />
        <Tab label="Laboratório de Transferência de Calor" value="HeatTransferLab" />
        <Tab label="Playground de Calor" value="HeatPlayground" />
        <Tab label="Laboratório de Propriedades" value="MaterialPropertiesLab" />
      </Tabs>

      {tab === 'simulador' && (
        <Grid container spacing={3}>
          {/* Parâmetros */}
          <Grid item xs={12} md={5} lg={4}>
            <Card>
              <CardHeader title="Parâmetros" />
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Typography gutterBottom>Fluido</Typography>
                    <Select fullWidth value={fluido} onChange={e => setFluido(e.target.value)}>
                      {Object.keys(FLUIDOS).map(k => (
                        <MenuItem key={k} value={k}>{k}</MenuItem>
                      ))}
                    </Select>
                  </Box>

                  <TextField
                    label="Densidade (ρ)"
                    type="number"
                    value={rho}
                    onChange={e => setRhoSafe(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end">kg/m³</InputAdornment> }}
                    helperText="Use 'Personalizado' para editar livremente."
                    disabled={fluido !== 'Personalizado'}
                  />

                  <Box>
                    <Typography gutterBottom>Aceleração da gravidade (g): {g.toFixed(4)} m/s²</Typography>
                    <Slider
                      value={g}
                      onChange={(_, v) => setGSafe(v)}
                      min={0}
                      max={20}
                      step={0.0001}
                      valueLabelDisplay="auto"
                    />
                  </Box>

                  <Box>
                    <Typography gutterBottom>Profundidade máxima (m): {altura.toFixed(2)} m</Typography>
                    <Slider
                      value={altura}
                      onChange={(_, v) => setAlturaSafe(v)}
                      min={0}
                      max={100}
                      step={0.01}
                      valueLabelDisplay="auto"
                    />
                  </Box>

                  <Divider />

                  <FormControlLabel
                    control={<Switch checked={p0Ativo} onChange={e => setP0Ativo(e.target.checked)} />}
                    label="Incluir pressão atmosférica P₀ (pressão absoluta)"
                  />

                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <TextField
                        label="P₀"
                        type="number"
                        value={p0Valor}
                        onChange={e => setP0Valor(Math.max(0, Number(e.target.value) || 0))}
                        disabled={!p0Ativo}
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Select fullWidth value={p0Unidade} onChange={e => setP0Unidade(e.target.value)} disabled={!p0Ativo}>
                        {UNIDADES.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                      </Select>
                    </Grid>
                  </Grid>

                  <Divider />

                  <Box>
                    <Typography gutterBottom>Unidade de saída</Typography>
                    <Select fullWidth value={unidadeSaida} onChange={e => setUnidadeSaida(e.target.value)}>
                      {UNIDADES.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                    </Select>
                  </Box>

                  <Box>
                    <Typography gutterBottom>Pontos no gráfico: {nPontos}</Typography>
                    <Slider
                      value={nPontos}
                      onChange={(_, v) => setNPontos(Math.round(v))}
                      min={10}
                      max={300}
                      step={1}
                      valueLabelDisplay="auto"
                    />
                  </Box>

                  <Button variant="outlined" onClick={resetPadroes}>Restaurar padrões</Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Resultado & Gráfico */}
          <Grid item xs={12} md={7} lg={8}>
            <Card sx={{ mb: 3 }}>
              <CardHeader
                title="Resultados instantâneos"
                action={
                  <Tooltip title="Modelo: P(h) = P₀ + ρ·g·h">
                    <IconButton><InfoOutlinedIcon /></IconButton>
                  </Tooltip>
                }
              />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">Pressão no topo (h = 0):</Typography>
                    <Typography variant="h5">
                      {formatNumber(toSelectedUnit(topoPa, unidadeSaida))} {unidadeSaida}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">Pressão no fundo (h = {altura.toFixed(2)} m):</Typography>
                    <Typography variant="h5">
                      {formatNumber(toSelectedUnit(fundoPa, unidadeSaida))} {unidadeSaida}
                    </Typography>
                  </Grid>
                </Grid>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Fórmula: <b>P(h) = P₀ + ρ·g·h</b>, onde P₀ = {p0Ativo ? `${formatNumber(toSelectedUnit(p0Pa, unidadeSaida))} ${unidadeSaida}` : '0'} ·
                    {' '}ρ = {formatNumber(rho)} kg/m³ · g = {g.toFixed(4)} m/s² · h em metros.
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Gráfico" subheader="Pressão em função da profundidade" />
              <CardContent>
                <Box sx={{ width: '100%', height: 420 }}>
                  <PressureChart data={chartData} options={chartOptions} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Observação: este simulador assume fluido incompressível e temperatura constante.
                Para gases ou variações grandes de pressão/temperatura, use modelos termodinâmicos adequados.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      )}

      {tab === 'solver' && (
        <Box>
          <UfscSolver />
        </Box>
      )}
      {tab === 'HeatTransferLab' && (
        <Box>
          <HeatTransferLab />
        </Box>
      )}
      {tab === 'HeatPlayground' && (
        <Box>
          <HeatPlaygroundPage />
        </Box>
      )}
      {tab === 'MaterialPropertiesLab' && (
        <Box>
          <MaterialPropertiesLab />
        </Box>
      )}
    </Container>
  );
}
