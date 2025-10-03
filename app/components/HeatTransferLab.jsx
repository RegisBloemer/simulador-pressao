'use client';

import * as React from 'react';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Box, Container, Grid, Card, CardContent, CardHeader,
  Typography, TextField, Slider, Select, MenuItem, InputAdornment,
  IconButton, Tooltip, Button, Stack, Tabs, Tab, ToggleButtonGroup, ToggleButton,
  Divider
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';

import PressureChart from '../components/PressureChart';
import { ThemeModeContext } from '../providers';

// ---------- Utilidades ----------
const SIGMA = 5.670374419e-8; // Stefan–Boltzmann [W/m²·K⁴]

function formatNumber(x, digits = 3) {
  if (Number.isNaN(x) || !Number.isFinite(x)) return '—';
  if (Math.abs(x) >= 1000) return x.toLocaleString('pt-BR', { maximumFractionDigits: digits });
  return x.toLocaleString('pt-BR', { maximumSignificantDigits: digits });
}

const toKelvin = (tC) => tC + 273.15;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function HeatTransferLab() {
  const { mode, setMode } = React.useContext(ThemeModeContext);
  const theme = useTheme();

  // Abas: 3 modos de transferência
  const [tab, setTab] = React.useState('conducao');

  // ---------- Estado: Condução (1D, regime permanente, placa plana) ----------
  const [k, setK] = React.useState(205); // W/mK (ex.: alumínio)
  const [L, setL] = React.useState(0.05); // m
  const [Acond, setAcond] = React.useState(0.02); // m²
  const [T1, setT1] = React.useState(100); // °C (x=0)
  const [T2, setT2] = React.useState(20); // °C (x=L)
  const [nPtsCond, setNPtsCond] = React.useState(51);

  const Lsafe = React.useMemo(() => clamp(Number(L) || 0, 1e-6, 10), [L]);
  const ksafe = React.useMemo(() => clamp(Number(k) || 0, 0, 2000), [k]);
  const Acondsafe = React.useMemo(() => clamp(Number(Acond) || 0, 1e-6, 100), [Acond]);

  const xCond = React.useMemo(() => {
    const N = clamp(Math.round(nPtsCond), 2, 500);
    return Array.from({ length: N }, (_, i) => (i / (N - 1)) * Lsafe);
  }, [Lsafe, nPtsCond]);

  const Tprofile = React.useMemo(() => xCond.map(x => T1 + (T2 - T1) * (x / Lsafe)), [xCond, T1, T2, Lsafe]);
  const dTdx = React.useMemo(() => (T2 - T1) / Lsafe, [T1, T2, Lsafe]);
  const qFluxCond = React.useMemo(() => -ksafe * dTdx, [ksafe, dTdx]); // W/m²
  const qCond = React.useMemo(() => qFluxCond * Acondsafe, [qFluxCond, Acondsafe]); // W

  const condChartData = React.useMemo(() => ({
    labels: xCond.map(x => x.toFixed(3)),
    datasets: [{
      label: 'Temperatura (°C)',
      data: Tprofile,
      borderWidth: 2.5,
      borderColor: alpha(theme.palette.primary.main, 0.9),
      fill: false,
      tension: 0.15,
      pointRadius: 0
    }]
  }), [xCond, Tprofile, theme]);

  const condChartOptions = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      title: { display: true, text: 'Condução: T(x) ao longo da placa' },
      tooltip: {
        callbacks: {
          title: (ctx) => `x = ${Number(ctx[0].label).toLocaleString('pt-BR')} m`,
          label: (ctx) => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)} °C`
        }
      }
    },
    scales: {
      x: { title: { display: true, text: 'Posição x (m)' }, grid: { color: alpha(theme.palette.text.primary, 0.08) } },
      y: { title: { display: true, text: 'Temperatura (°C)' }, grid: { color: alpha(theme.palette.text.primary, 0.08) } }
    }
  }), [theme]);

  // ---------- Estado: Convecção (superfície com h constante) ----------
  const [h, setH] = React.useState(25); // W/m²K
  const [Aconv, setAconv] = React.useState(0.5); // m²
  const [Ts, setTs] = React.useState(60); // °C
  const [Tinf, setTinf] = React.useState(25); // °C
  const [nPtsConv, setNPtsConv] = React.useState(31);

  const hsafe = React.useMemo(() => clamp(Number(h) || 0, 0, 1e5), [h]);
  const Aconvsafe = React.useMemo(() => clamp(Number(Aconv) || 0, 1e-6, 1000), [Aconv]);

  const qFluxConv = React.useMemo(() => hsafe * (Ts - Tinf), [hsafe, Ts, Tinf]);
  const qConv = React.useMemo(() => qFluxConv * Aconvsafe, [qFluxConv, Aconvsafe]);

  const xConv = React.useMemo(() => {
    const N = clamp(Math.round(nPtsConv), 2, 300);
    return Array.from({ length: N }, (_, i) => i / (N - 1)); // posição adimensional 0..1
  }, [nPtsConv]);

  const convChartData = React.useMemo(() => ({
    labels: xConv.map(x => x.toFixed(2)),
    datasets: [{
      label: "q'' (W/m²)",
      data: xConv.map(() => qFluxConv), // fluxo uniforme no modelo simples
      borderWidth: 2.5,
      borderColor: alpha(theme.palette.secondary.main, 0.9),
      fill: false,
      tension: 0.0,
      pointRadius: 0
    }]
  }), [xConv, qFluxConv, theme]);

  const convChartOptions = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      title: { display: true, text: 'Convecção: fluxo de calor uniforme' },
      tooltip: {
        callbacks: {
          title: (ctx) => `posição = ${Number(ctx[0].label).toLocaleString('pt-BR')}`,
          label: (ctx) => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)} W/m²`
        }
      }
    },
    scales: {
      x: { title: { display: true, text: 'Posição adimensional' }, grid: { color: alpha(theme.palette.text.primary, 0.08) } },
      y: { title: { display: true, text: "Fluxo q'' (W/m²)" }, grid: { color: alpha(theme.palette.text.primary, 0.08) } }
    }
  }), [theme]);

  // ---------- Estado: Radiação (superfícies cinza, vista para ambiente grande) ----------
  const [eps, setEps] = React.useState(0.9); // emissividade
  const [Arad, setArad] = React.useState(0.5); // m²
  const [TsR, setTsR] = React.useState(80); // °C
  const [Tsur, setTsur] = React.useState(25); // °C
  const [nPtsRad, setNPtsRad] = React.useState(31);

  const epssafe = React.useMemo(() => clamp(Number(eps) || 0, 0, 1), [eps]);
  const Aradsafe = React.useMemo(() => clamp(Number(Arad) || 0, 1e-6, 1000), [Arad]);

  const qFluxRad = React.useMemo(() => epssafe * SIGMA * (Math.pow(toKelvin(TsR), 4) - Math.pow(toKelvin(Tsur), 4)), [epssafe, TsR, Tsur]);
  const qRad = React.useMemo(() => qFluxRad * Aradsafe, [qFluxRad, Aradsafe]);

  const xRad = React.useMemo(() => {
    const N = clamp(Math.round(nPtsRad), 2, 300);
    return Array.from({ length: N }, (_, i) => i / (N - 1));
  }, [nPtsRad]);

  const radChartData = React.useMemo(() => ({
    labels: xRad.map(x => x.toFixed(2)),
    datasets: [{
      label: "q'' (W/m²)",
      data: xRad.map(() => qFluxRad),
      borderWidth: 2.5,
      borderColor: alpha(theme.palette.error.main, 0.9),
      fill: false,
      tension: 0.0,
      pointRadius: 0
    }]
  }), [xRad, qFluxRad, theme]);

  const radChartOptions = React.useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      title: { display: true, text: 'Radiação: fluxo de calor (superfície cinza)' },
      tooltip: {
        callbacks: {
          title: (ctx) => `posição = ${Number(ctx[0].label).toLocaleString('pt-BR')}`,
          label: (ctx) => `${ctx.dataset.label}: ${formatNumber(ctx.parsed.y)} W/m²`
        }
      }
    },
    scales: {
      x: { title: { display: true, text: 'Posição adimensional' }, grid: { color: alpha(theme.palette.text.primary, 0.08) } },
      y: { title: { display: true, text: "Fluxo q'' (W/m²)" }, grid: { color: alpha(theme.palette.text.primary, 0.08) } }
    }
  }), [theme]);

  // ---------- Resets ----------
  const resetConducao = () => { setK(205); setL(0.05); setAcond(0.02); setT1(100); setT2(20); setNPtsCond(51); };
  const resetConveccao = () => { setH(25); setAconv(0.5); setTs(60); setTinf(25); setNPtsConv(31); };
  const resetRadiacao = () => { setEps(0.9); setArad(0.5); setTsR(80); setTsur(25); setNPtsRad(31); };

  return (
    <Container
      maxWidth={false}
      disableGutters
      sx={{
        py: 4,
        px: { xs: 2, sm: 3 },
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header com tema */}
      <Grid container spacing={3} alignItems="center" sx={{ mb: 1 }}>
        <Grid item xs={12} md="auto">
          <Typography variant="h4" fontWeight={700}>Laboratório de Transferência de Calor</Typography>
        </Grid>
        <Grid item xs />
        <Grid item>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => { if (v) setMode(v); }}
            size="small"
          >
            <ToggleButton value="light" aria-label="tema-claro"><LightModeIcon /></ToggleButton>
            <ToggleButton value="dark" aria-label="tema-escuro"><DarkModeIcon /></ToggleButton>
          </ToggleButtonGroup>
        </Grid>
      </Grid>

      {/* Abas */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="primary" indicatorColor="primary" sx={{ mb: 2 }}>
        <Tab label="Condução" value="conducao" />
        <Tab label="Convecção" value="conveccao" />
        <Tab label="Radiação" value="radiacao" />
      </Tabs>

      {/* ---------------- Condução ---------------- */}
      {tab === 'conducao' && (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', gap: 3 }}>
          {/* Sidebar: parâmetros + resultados */}
          <Box sx={{ width: { xs: 320, md: 360, lg: 380 }, flexShrink: 0, display: 'flex', minHeight: 0 }}>
            <Stack spacing={3} sx={{ flex: 1, minHeight: 0 }}>
              <Card>
                <CardHeader title="Parâmetros — Condução (placa plana, 1D)" />
                <CardContent>
                  <Stack spacing={2}>
                    <TextField
                      label="Condutividade térmica k" type="number" value={k}
                      onChange={(e) => setK(Number(e.target.value) || 0)}
                      InputProps={{ endAdornment: <InputAdornment position="end">W/m·K</InputAdornment> }}
                    />
                    <TextField
                      label="Espessura L" type="number" value={L}
                      onChange={(e) => setL(Number(e.target.value) || 0)}
                      InputProps={{ endAdornment: <InputAdornment position="end">m</InputAdornment> }}
                    />
                    <TextField
                      label="Área A" type="number" value={Acond}
                      onChange={(e) => setAcond(Number(e.target.value) || 0)}
                      InputProps={{ endAdornment: <InputAdornment position="end">m²</InputAdornment> }}
                    />
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth label="T(0) = T₁" type="number" value={T1}
                          onChange={(e) => setT1(Number(e.target.value) || 0)}
                          InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth label="T(L) = T₂" type="number" value={T2}
                          onChange={(e) => setT2(Number(e.target.value) || 0)}
                          InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }}
                        />
                      </Grid>
                    </Grid>
                    <Box>
                      <Typography gutterBottom>Pontos no perfil: {nPtsCond}</Typography>
                      <Slider value={nPtsCond} onChange={(_, v) => setNPtsCond(Math.round(v))} min={10} max={400} step={1} valueLabelDisplay="auto" />
                    </Box>
                    <Button variant="outlined" onClick={resetConducao}>Restaurar padrões</Button>
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  title="Resultados"
                  action={
                    <Tooltip title={"Lei de Fourier: q'' = -k dT/dx"}>
                      <IconButton><InfoOutlinedIcon /></IconButton>
                    </Tooltip>
                  }
                />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Gradiente térmico (dT/dx):</Typography>
                      <Typography variant="h5">{formatNumber(dTdx)} °C/m</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Fluxo de calor q'':</Typography>
                      <Typography variant="h5">{formatNumber(qFluxCond)} W/m²</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Taxa de calor Q̇:</Typography>
                      <Typography variant="h5">{formatNumber(qCond)} W</Typography>
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Modelo: <b>T(x) = T₁ + (T₂ - T₁)x/L</b>, q'' = -k (T₂ - T₁)/L.
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Stack>
          </Box>

          {/* Área do gráfico */}
          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
            <Card sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <CardHeader
                title="Perfil de Temperatura"
                subheader="Condução estacionária em placa plana"
                titleTypographyProps={{ align: 'left' }}
                subheaderTypographyProps={{ align: 'left' }}
              />
              <CardContent sx={{ flex: 1, minHeight: 0, p: 0 }}>
                <Box sx={{ width: '100%', height: '100%' }}>
                  <PressureChart data={condChartData} options={condChartOptions} />
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* ---------------- Convecção ---------------- */}
      {tab === 'conveccao' && (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', gap: 3 }}>
          {/* Sidebar */}
          <Box sx={{ width: { xs: 320, md: 360, lg: 380 }, flexShrink: 0, display: 'flex', minHeight: 0 }}>
            <Stack spacing={3} sx={{ flex: 1, minHeight: 0 }}>
              <Card>
                <CardHeader title="Parâmetros — Convecção (h constante)" />
                <CardContent>
                  <Stack spacing={2}>
                    <TextField
                      label="Coeficiente convectivo h" type="number" value={h}
                      onChange={(e) => setH(Number(e.target.value) || 0)}
                      InputProps={{ endAdornment: <InputAdornment position="end">W/m²·K</InputAdornment> }}
                    />
                    <TextField
                      label="Área A" type="number" value={Aconv}
                      onChange={(e) => setAconv(Number(e.target.value) || 0)}
                      InputProps={{ endAdornment: <InputAdornment position="end">m²</InputAdornment> }}
                    />
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth label="Temperatura da superfície Tₛ" type="number" value={Ts}
                          onChange={(e) => setTs(Number(e.target.value) || 0)}
                          InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth label="Temperatura do fluido T∞" type="number" value={Tinf}
                          onChange={(e) => setTinf(Number(e.target.value) || 0)}
                          InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }}
                        />
                      </Grid>
                    </Grid>
                    <Box>
                      <Typography gutterBottom>Pontos na faixa: {nPtsConv}</Typography>
                      <Slider value={nPtsConv} onChange={(_, v) => setNPtsConv(Math.round(v))} min={10} max={300} step={1} valueLabelDisplay="auto" />
                    </Box>
                    <Button variant="outlined" onClick={resetConveccao}>Restaurar padrões</Button>
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  title="Resultados"
                  action={
                    <Tooltip title={"Lei de resfriamento de Newton: q'' = h (Tₛ - T∞)"}>
                      <IconButton><InfoOutlinedIcon /></IconButton>
                    </Tooltip>
                  }
                />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Fluxo convectivo q'':</Typography>
                      <Typography variant="h5">{formatNumber(qFluxConv)} W/m²</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Taxa de calor Q̇:</Typography>
                      <Typography variant="h5">{formatNumber(qConv)} W</Typography>
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Modelo: <b>Q̇ = h·A·(Tₛ - T∞)</b>. Aqui supõe-se h uniforme e escoamento externo simples.
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Stack>
          </Box>

          {/* Área do gráfico */}
          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
            <Card sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <CardHeader
                title="Fluxo ao longo da superfície"
                subheader="Modelo simples com h uniforme"
                titleTypographyProps={{ align: 'left' }}
                subheaderTypographyProps={{ align: 'left' }}
              />
              <CardContent sx={{ flex: 1, minHeight: 0, p: 0 }}>
                <Box sx={{ width: '100%', height: '100%' }}>
                  <PressureChart data={convChartData} options={convChartOptions} />
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {/* ---------------- Radiação ---------------- */}
      {tab === 'radiacao' && (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', gap: 3 }}>
          {/* Sidebar */}
          <Box sx={{ width: { xs: 320, md: 360, lg: 380 }, flexShrink: 0, display: 'flex', minHeight: 0 }}>
            <Stack spacing={3} sx={{ flex: 1, minHeight: 0 }}>
              <Card>
                <CardHeader title="Parâmetros — Radiação (superfície cinza)" />
                <CardContent>
                  <Stack spacing={2}>
                    <TextField
                      label="Emissividade ε" type="number" value={eps}
                      onChange={(e) => setEps(Number(e.target.value) || 0)}
                      inputProps={{ step: 0.01, min: 0, max: 1 }}
                      InputProps={{ endAdornment: <InputAdornment position="end">—</InputAdornment> }}
                    />
                    <TextField
                      label="Área A" type="number" value={Arad}
                      onChange={(e) => setArad(Number(e.target.value) || 0)}
                      InputProps={{ endAdornment: <InputAdornment position="end">m²</InputAdornment> }}
                    />
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth label="Temperatura da superfície Tₛ" type="number" value={TsR}
                          onChange={(e) => setTsR(Number(e.target.value) || 0)}
                          InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth label="Temperatura do entorno Tₛᵤʳ" type="number" value={Tsur}
                          onChange={(e) => setTsur(Number(e.target.value) || 0)}
                          InputProps={{ endAdornment: <InputAdornment position="end">°C</InputAdornment> }}
                        />
                      </Grid>
                    </Grid>
                    <Box>
                      <Typography gutterBottom>Pontos na faixa: {nPtsRad}</Typography>
                      <Slider value={nPtsRad} onChange={(_, v) => setNPtsRad(Math.round(v))} min={10} max={300} step={1} valueLabelDisplay="auto" />
                    </Box>
                    <Button variant="outlined" onClick={resetRadiacao}>Restaurar padrões</Button>
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  title="Resultados"
                  action={
                    <Tooltip title={"Lei de Stefan–Boltzmann (líquido): q'' = εσ (Tₛ⁴ - Tₛᵤʳ⁴)"}>
                      <IconButton><InfoOutlinedIcon /></IconButton>
                    </Tooltip>
                  }
                />
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Fluxo radiativo líquido q'':</Typography>
                      <Typography variant="h5">{formatNumber(qFluxRad)} W/m²</Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">Taxa de calor Q̇:</Typography>
                      <Typography variant="h5">{formatNumber(qRad)} W</Typography>
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      <b>Importante:</b> use Kelvin nos cálculos — aqui as entradas em °C são convertidas automaticamente: T[K] = T[°C] + 273,15.
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Stack>
          </Box>

          {/* Área do gráfico */}
          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
            <Card sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <CardHeader
                title="Fluxo ao longo da superfície"
                subheader="Superfície grande para um entorno a Tₛᵤʳ"
                titleTypographyProps={{ align: 'left' }}
                subheaderTypographyProps={{ align: 'left' }}
              />
              <CardContent sx={{ flex: 1, minHeight: 0, p: 0 }}>
                <Box sx={{ width: '100%', height: '100%' }}>
                  <PressureChart data={radChartData} options={radChartOptions} />
                </Box>
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      <Grid item xs={12} sx={{ mt: 3 }}>
        <Divider sx={{ mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Observações: Condução e convecção requerem meio material e gradientes de temperatura; a radiação é emitida pela matéria e
          se propaga sem necessidade de meio material (funciona inclusive no vácuo). Os modelos aqui mostrados são simplificados e
          úteis para visualização rápida.
        </Typography>
      </Grid>
    </Container>
  );
}
