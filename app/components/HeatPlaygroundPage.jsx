'use client';

import * as React from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box, Container, Grid, Card, CardContent, CardHeader, Typography,
  Slider, ToggleButtonGroup, ToggleButton, Button, Stack, Tabs, Tab,
  Select, MenuItem, IconButton, Tooltip, Divider
} from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { ThemeModeContext } from '../providers';

// -------------------------------------------------------------
// Utilidades e constantes
// -------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const SIGMA = 5.670374419e-8; // Stefan-Boltzmann

const MATERIAIS = {
  Cobre:    { k: 401,  rho: 8960, cp: 385,  cor: '#b87333' },
  Alumínio: { k: 205,  rho: 2700, cp: 897,  cor: '#adb5bd' },
  Aço:      { k: 50,   rho: 7850, cp: 470,  cor: '#6c757d' },
  Madeira:  { k: 0.12, rho: 500,  cp: 1600, cor: '#cfa37a' },
  Isolante: { k: 0.03, rho: 30,   cp: 1400, cor: '#ffe08a' }
};

function formatNumber(x, digits = 2) {
  if (!Number.isFinite(x)) return '—';
  if (Math.abs(x) >= 1000) return x.toLocaleString('pt-BR', { maximumFractionDigits: digits });
  return x.toLocaleString('pt-BR', { maximumSignificantDigits: digits });
}

function toKelvin(tc) { return tc + 273.15; }

// Paleta térmica simples (azul -> vermelho)
function colorMap(t, tmin, tmax) {
  const u = clamp((t - tmin) / Math.max(1e-6, (tmax - tmin)), 0, 1);
  // gradiente: azul (#1e3a8a) -> ciano -> verde -> amarelo -> vermelho (#b91c1c)
  const stops = [
    [0.0, [30, 58, 138]],
    [0.25, [6, 182, 212]],
    [0.5, [34, 197, 94]],
    [0.75, [250, 204, 21]],
    [1.0, [185, 28, 28]]
  ];
  let c0 = stops[0][1], c1 = stops[stops.length - 1][1], t0 = 0, t1 = 1;
  for (let i = 0; i < stops.length - 1; i++) {
    if (u >= stops[i][0] && u <= stops[i + 1][0]) { c0 = stops[i][1]; c1 = stops[i + 1][1]; t0 = stops[i][0]; t1 = stops[i + 1][0]; break; }
  }
  const v = (u - t0) / (t1 - t0);
  const r = Math.round(lerp(c0[0], c1[0], v));
  const g = Math.round(lerp(c0[1], c1[1], v));
  const b = Math.round(lerp(c0[2], c1[2], v));
  return `rgb(${r},${g},${b})`;
}

// -------------------------------------------------------------
// Página
// -------------------------------------------------------------
export default function HeatPlaygroundPage() {
  const { mode, setMode } = React.useContext(ThemeModeContext);
  const theme = useTheme();

  const [aba, setAba] = React.useState('conducao');
  const [rodando, setRodando] = React.useState(false);
  const [pontuacao, setPontuacao] = React.useState(0);
  const [tempo, setTempo] = React.useState(0);

  // Canvas refs
  const canvasRef = React.useRef(null);
  const containerRef = React.useRef(null);

  // Tamanho responsivo do canvas
  const [dims, setDims] = React.useState({ w: 900, h: 420 });
  React.useEffect(() => {
    const ro = new ResizeObserver(() => {
      const el = containerRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = Math.max(320, Math.round(w * 0.45));
      setDims({ w, h });
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // -----------------------------------------------------------
  // Estado: CONDUÇÃO (joguinho: acerte T no centro)
  // -----------------------------------------------------------
  const [material, setMaterial] = React.useState('Alumínio');
  const [L, setL] = React.useState(0.5); // m
  const [N, setN] = React.useState(80); // pontos
  const [Tleft, setTleft] = React.useState(90); // °C
  const [Tright, setTright] = React.useState(20); // °C
  const [Tini, setTini] = React.useState(20);
  const [alvos, setAlvos] = React.useState({ centro: 45 });

  // malha e estado térmico
  const Tref = React.useRef([]);
  const [tminmax, setTminmax] = React.useState([0, 100]);

  // mouse/drag dos reservatórios
  const dragRef = React.useRef({ lado: null, ativo: false });

  // -----------------------------------------------------------
  // Estado: CONVECÇÃO (resfriar placa com "ventilador")
  // -----------------------------------------------------------
  const [h, setH] = React.useState(15); // W/m²K
  const [Aconv, setAconv] = React.useState(0.3); // m²
  const [mconv, setMconv] = React.useState(2.0); // kg
  const [cpconv, setCpconv] = React.useState(900); // J/kgK (alumínio)
  const [Tplaca, setTplaca] = React.useState(80);
  const [Tinf, setTinf] = React.useState(25);
  const [metaConv, setMetaConv] = React.useState(40);

  // -----------------------------------------------------------
  // Estado: RADIAÇÃO (manter satélite na faixa)
  // -----------------------------------------------------------
  const [eps, setEps] = React.useState(0.85);
  const [Arad, setArad] = React.useState(0.8);
  const [mrad, setMrad] = React.useState(5);
  const [cprad, setCprad] = React.useState(900);
  const [Tbody, setTbody] = React.useState(20);
  const [Tsur, setTsur] = React.useState(-270); // espaço profundo ~3K
  const [sol, setSol] = React.useState(true);
  const [Qsol, setQsol] = React.useState(1000); // W de entrada absorvida quando no sol
  const [faixaAlvo, setFaixaAlvo] = React.useState([15, 25]);

  // -----------------------------------------------------------
  // Inicialização da condução
  React.useEffect(() => {
    const Nsafe = clamp(Math.round(N), 20, 200);
    const arr = Array.from({ length: Nsafe }, () => Tini);
    Tref.current = arr;
  }, [N, Tini]);

  // Reset geral
  const reset = () => {
    setPontuacao(0); setTempo(0); setRodando(false);
    // condução
    setMaterial('Alumínio'); setL(0.5); setN(80); setTleft(90); setTright(20); setTini(20); setAlvos({ centro: 45 });
    // convecção
    setH(15); setAconv(0.3); setMconv(2.0); setCpconv(900); setTplaca(80); setTinf(25); setMetaConv(40);
    // radiação
    setEps(0.85); setArad(0.8); setMrad(5); setCprad(900); setTbody(20); setTsur(-270); setSol(true); setQsol(1000); setFaixaAlvo([15,25]);
  };

  // -----------------------------------------------------------
  // Simulação passo-a-passo
  const lastTsRef = React.useRef(0);

  React.useEffect(() => {
    let raf;
    const loop = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dtReal = (ts - lastTsRef.current) / 1000; // s
      lastTsRef.current = ts;

      if (rodando) {
        setTempo((t) => t + dtReal);
        if (aba === 'conducao') stepConducao(dtReal);
        else if (aba === 'conveccao') stepConveccao(dtReal);
        else if (aba === 'radiacao') stepRadiacao(dtReal);
      }
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodando, aba, material, L, N, Tleft, Tright, h, Aconv, mconv, cpconv, Tplaca, Tinf, eps, Arad, mrad, cprad, Tbody, Tsur, sol, Qsol]);

  // -----------------------------------------------------------
  // Passo de condução (1D explícito FTCS)
  function stepConducao(dtReal) {
    const { k, rho, cp } = MATERIAIS[material];
    const alpha = k / (rho * cp); // m²/s
    const Nn = Tref.current.length;
    const dx = L / (Nn - 1);
    const dtMax = 0.5 * dx * dx / Math.max(1e-9, alpha);
    const dt = Math.min(dtReal, dtMax * 0.9); // estabilidade

    const T = Tref.current.slice();
    // Condições de contorno Dirichlet
    T[0] = Tleft;
    T[Nn - 1] = Tright;

    const r = alpha * dt / (dx * dx);
    for (let i = 1; i < Nn - 1; i++) {
      T[i] = T[i] + r * (T[i + 1] - 2 * T[i] + T[i - 1]);
    }

    Tref.current = T;

    // Alvo de jogo: acertar T_centro próximo ao objetivo
    const Tc = T[Math.floor(Nn / 2)];
    const erro = Math.abs(Tc - alvos.centro);
    if (erro < 0.5) setPontuacao((p) => p + 1); // pontinho por frame quando mantém alvo

    // Atualiza faixa térmica para coloração
    const tmin = Math.min(Tleft, Tright, ...T);
    const tmax = Math.max(Tleft, Tright, ...T);
    setTminmax([tmin, tmax]);
  }

  // -----------------------------------------------------------
  // Passo de convecção (resfriamento de um único nó/sólido)
  function stepConveccao(dt) {
    const UA = h * Aconv;
    const C = mconv * cpconv; // J/K
    const dTdt = -(UA / C) * (Tplaca - Tinf);
    setTplaca((T) => T + dTdt * dt);

    if (Tplaca <= metaConv) setPontuacao((p) => p + 2);
  }

  // -----------------------------------------------------------
  // Passo de radiação (energia líquida)
  function stepRadiacao(dt) {
    const C = mrad * cprad; // J/K
    const TinK = toKelvin(Tbody);
    const TsurK = toKelvin(Tsur);
    const Qout = eps * SIGMA * Arad * (Math.pow(TinK, 4) - Math.pow(TsurK, 4));
    const Qin = sol ? Qsol : 0;
    const dTdt = (Qin - Qout) / C;
    setTbody((T) => T + dTdt * dt);

    const [low, high] = faixaAlvo;
    if (Tbody >= low && Tbody <= high) setPontuacao((p) => p + 3);
  }

  // -----------------------------------------------------------
  // Desenho de cada cena no canvas
  function draw() {
    const cvs = canvasRef.current; if (!cvs) return;
    const ctx = cvs.getContext('2d');
    const W = dims.w, H = dims.h;
    ctx.clearRect(0, 0, W, H);

    if (aba === 'conducao') drawConducao(ctx, W, H);
    else if (aba === 'conveccao') drawConveccao(ctx, W, H);
    else drawRadiacao(ctx, W, H);

    // HUD (pontuação/tempo)
    ctx.font = '600 16px system-ui, -apple-system, Segoe UI, Roboto';
    ctx.fillStyle = theme.palette.text.primary;
    ctx.fillText(`Tempo: ${formatNumber(tempo, 1)} s`, 12, 22);
    ctx.fillText(`Pontuação: ${pontuacao}`, 12, 42);
  }

  function drawThermometer(ctx, x, y, h, value, tmin, tmax, label) {
    const r = 10;
    ctx.save();
    // trilho
    ctx.fillStyle = '#ddd';
    ctx.fillRect(x - 6, y, 12, h);
    // nível
    const u = clamp((value - tmin) / Math.max(1e-6, tmax - tmin), 0, 1);
    const fillH = u * h;
    ctx.fillStyle = colorMap(value, tmin, tmax);
    ctx.fillRect(x - 6, y + h - fillH, 12, fillH);
    // bulbo
    ctx.beginPath(); ctx.arc(x, y + h + r, r, 0, Math.PI * 2); ctx.fill();
    // marca
    ctx.fillStyle = '#555';
    ctx.font = '600 14px system-ui';
    ctx.fillText(`${formatNumber(value)}°C`, x + 18, y + h + r + 5);
    ctx.fillText(label, x + 18, y + h + r + 22);
    ctx.restore();
  }

  function drawConducao(ctx, W, H) {
    const margin = 60;
    const barW = W - margin * 2 - 80; // espaço p/ termômetros
    const barH = 60;
    const cx = margin + 40; // sobra dos termômetros
    const cy = H / 2;

    // Termômetros laterais (arrastáveis)
    drawThermometer(ctx, 30, cy - 100, 160, Tleft, 0, 100, 'Esq');
    drawThermometer(ctx, W - 30, cy - 100, 160, Tright, 0, 100, 'Dir');

    // Barra
    ctx.save();
    ctx.lineWidth = 10; ctx.strokeStyle = '#999';
    ctx.strokeRect(cx, cy - barH / 2, barW, barH);

    // preenchimento por temperatura
    const T = Tref.current;
    const Nn = T.length;
    for (let i = 0; i < Nn; i++) {
      const x0 = cx + (i / (Nn - 1)) * barW;
      const x1 = cx + ((i + 1) / (Nn - 1)) * barW;
      ctx.fillStyle = colorMap(T[i], tminmax[0], tminmax[1]);
      ctx.fillRect(x0, cy - barH / 2, x1 - x0 + 1, barH);
    }

    // alvo no centro
    const xMid = cx + barW / 2; const yMid = cy - barH / 2 - 12;
    ctx.fillStyle = theme.palette.text.primary; ctx.font = '600 14px system-ui';
    ctx.fillText(`Meta no centro: ${alvos.centro}°C`, xMid - 80, yMid);
    ctx.beginPath(); ctx.moveTo(xMid, cy - barH / 2); ctx.lineTo(xMid, cy - barH / 2 - 8); ctx.strokeStyle = '#666'; ctx.stroke();

    // material label
    ctx.fillStyle = MATERIAIS[material].cor;
    ctx.fillRect(cx, cy + barH / 2 + 16, 26, 12);
    ctx.fillStyle = theme.palette.text.primary;
    ctx.fillText(`Material: ${material}`, cx + 34, cy + barH / 2 + 26);

    ctx.restore();
  }

  function drawConveccao(ctx, W, H) {
    const plateW = W * 0.55, plateH = 100;
    const px = (W - plateW) / 2, py = H / 2 - plateH / 2;

    // ar de fundo com partículas (intensidade ~ h)
    const density = clamp(Math.round(h / 2), 5, 120);
    for (let i = 0; i < density; i++) {
      const y = (i / density) * H;
      ctx.strokeStyle = `rgba(100,170,255,${0.1 + 0.3 * Math.random()})`;
      ctx.beginPath();
      const x0 = (Date.now() * 0.06 + i * 40) % W - 100; // fluxo para a direita
      ctx.moveTo(x0, y);
      ctx.bezierCurveTo(x0 + 30, y - 10, x0 + 60, y + 10, x0 + 120, y);
      ctx.stroke();
    }

    // placa
    const u = clamp((Tplaca - Tinf) / 80, 0, 1);
    const col = colorMap(Tplaca, Tinf - 40, Tinf + 80);
    ctx.fillStyle = col;
    ctx.fillRect(px, py, plateW, plateH);

    // contorno e HUD
    ctx.lineWidth = 4; ctx.strokeStyle = '#444'; ctx.strokeRect(px, py, plateW, plateH);
    ctx.font = '600 16px system-ui'; ctx.fillStyle = '#222';
    ctx.fillText(`Tₛ = ${formatNumber(Tplaca)}°C`, px + 12, py + plateH / 2);
    ctx.fillText(`h = ${formatNumber(h)} W/m²K`, px + 12, py + plateH / 2 + 20);
    ctx.fillText(`Meta: ≤ ${metaConv}°C`, px + 12, py + plateH / 2 + 40);
  }

  function drawRadiacao(ctx, W, H) {
    // fundo do espaço
    ctx.fillStyle = theme.palette.mode === 'dark' ? '#0b1020' : '#eaf2ff';
    ctx.fillRect(0, 0, W, H);

    // estrelas
    for (let i = 0; i < 80; i++) {
      const x = (i * 97 + Date.now() * 0.02) % W;
      const y = (i * 53) % H;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(x, y, 2, 2);
    }

    // Sol (quando on)
    if (sol) {
      const sx = 80, sy = 80;
      const grad = ctx.createRadialGradient(sx, sy, 10, sx, sy, 60);
      grad.addColorStop(0, '#ffd166'); grad.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(sx, sy, 60, 0, Math.PI * 2); ctx.fill();

      // raios
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        ctx.strokeStyle = 'rgba(255, 230, 120, 0.65)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a) * (W * 0.35), sy + Math.sin(a) * (H * 0.35));
        ctx.stroke();
      }
    }

    // satélite/corpo
    const cx = W * 0.65, cy = H * 0.55, r = 60;
    const tint = colorMap(Tbody, -50, 100);
    ctx.fillStyle = tint; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#455A64'; ctx.stroke();

    // emissão (círculos ondulantes)
    const waves = 6; const now = Date.now() * 0.004;
    for (let i = 0; i < waves; i++) {
      const rr = r + i * 12 + (now % 12);
      ctx.strokeStyle = `rgba(255,80,80,${0.25 - i * 0.04})`;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
    }

    // HUD
    ctx.fillStyle = theme.palette.text.primary; ctx.font = '600 16px system-ui';
    ctx.fillText(`ε = ${formatNumber(eps, 2)} | A = ${formatNumber(Arad, 2)} m²`, cx - 60, cy + r + 20);
    ctx.fillText(`T = ${formatNumber(Tbody, 1)}°C | Alvo: ${faixaAlvo[0]}–${faixaAlvo[1]}°C`, cx - 80, cy + r + 40);
  }

  // -----------------------------------------------------------
  // Interação de mouse: arrastar Tleft/Tright (condução)
  React.useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    const H = dims.h; const cy = H / 2;
    const onDown = (e) => {
      const rect = cvs.getBoundingClientRect();
      const x = e.clientX - rect.left; const y = e.clientY - rect.top;
      if (Math.hypot(x - 30, y - (cy + 60)) < 40) { dragRef.current = { lado: 'esq', ativo: true }; }
      if (Math.hypot(x - (rect.width - 30), y - (cy + 60)) < 40) { dragRef.current = { lado: 'dir', ativo: true }; }
    };
    const onMove = (e) => {
      if (!dragRef.current.ativo) return;
      const rect = cvs.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const v = clamp(100 - ((y - (cy - 100)) / 160) * 100, 0, 100);
      if (dragRef.current.lado === 'esq') setTleft(v);
      if (dragRef.current.lado === 'dir') setTright(v);
    };
    const onUp = () => { dragRef.current.ativo = false; };

    cvs.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      cvs.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dims.h]);

  // -----------------------------------------------------------
  // UI
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header com tema */}
      <Grid container spacing={3} alignItems="center" sx={{ mb: 1 }}>
        <Grid item xs={12} md="auto">
          <Typography variant="h4" fontWeight={700}>Playground de Transferência de Calor</Typography>
          <Typography variant="body2" color="text.secondary">Aprenda brincando: condução, convecção e radiação com metas e pontuação.</Typography>
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

      {/* Abas de modo */}
      <Tabs value={aba} onChange={(_, v) => setAba(v)} textColor="primary" indicatorColor="primary" sx={{ mb: 2 }}>
        <Tab label="Condução" value="conducao" />
        <Tab label="Convecção" value="conveccao" />
        <Tab label="Radiação" value="radiacao" />
      </Tabs>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              title={aba === 'conducao' ? 'Condução — acerte a temperatura no centro' : aba === 'conveccao' ? 'Convecção — resfrie a placa' : 'Radiação — mantenha na faixa segura'}
              action={
                <Tooltip title={aba === 'conducao' ? "Arraste os termômetros laterais e escolha o material. Atinga a meta de T no centro para marcar pontos." : aba === 'conveccao' ? "Aumente h (vento) para resfriar mais rápido. Ganhe pontos quando Tₛ ≤ meta." : "Ajuste emissividade e área; ligue/desligue o Sol. Ganhe pontos mantendo T dentro da faixa."}>
                  <IconButton><InfoOutlinedIcon /></IconButton>
                </Tooltip>
              }
            />
            <CardContent>
              <Box ref={containerRef} sx={{ width: '100%', height: dims.h }}>
                <canvas ref={canvasRef} width={dims.w} height={dims.h} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Controles" />
            <CardContent>
              {aba === 'conducao' && (
                <Stack spacing={2}>
                  <Typography variant="body2" color="text.secondary">Material</Typography>
                  <Select size="small" value={material} onChange={(e) => setMaterial(e.target.value)}>
                    {Object.keys(MATERIAIS).map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </Select>

                  <Typography variant="body2">Espessura L: {formatNumber(L, 2)} m</Typography>
                  <Slider value={L} min={0.1} max={1.0} step={0.01} onChange={(_, v) => setL(v)} />

                  <Typography variant="body2">Pontos N: {N}</Typography>
                  <Slider value={N} min={40} max={160} step={1} onChange={(_, v) => setN(Math.round(v))} />

                  <Typography variant="body2">Meta no centro: {alvos.centro}°C</Typography>
                  <Slider value={alvos.centro} min={0} max={100} step={1} onChange={(_, v) => setAlvos({ centro: Math.round(v) })} />

                  <Divider />
                  <Typography variant="body2" color="text.secondary">Dica: Materiais com k maior transmitem mais rápido (α = k/ρc).</Typography>
                </Stack>
              )}

              {aba === 'conveccao' && (
                <Stack spacing={2}>
                  <Typography variant="body2">Coeficiente convectivo h: {formatNumber(h)} W/m²K</Typography>
                  <Slider value={h} min={2} max={120} step={1} onChange={(_, v) => setH(v)} />

                  <Typography variant="body2">Área A: {formatNumber(Aconv,2)} m²</Typography>
                  <Slider value={Aconv} min={0.1} max={1.0} step={0.01} onChange={(_, v) => setAconv(v)} />

                  <Typography variant="body2">Massa m: {formatNumber(mconv,2)} kg</Typography>
                  <Slider value={mconv} min={0.5} max={5} step={0.1} onChange={(_, v) => setMconv(v)} />

                  <Typography variant="body2">cₚ: {cpconv} J/kgK</Typography>
                  <Slider value={cpconv} min={400} max={1000} step={10} onChange={(_, v) => setCpconv(v)} />

                  <Typography variant="body2">Temperatura ambiente T∞: {Tinf}°C</Typography>
                  <Slider value={Tinf} min={0} max={40} step={1} onChange={(_, v) => setTinf(v)} />

                  <Typography variant="body2">Meta: ≤ {metaConv}°C</Typography>
                  <Slider value={metaConv} min={20} max={60} step={1} onChange={(_, v) => setMetaConv(v)} />

                  <Divider />
                  <Typography variant="body2" color="text.secondary">Dica: h ↑ com velocidade do ar, turbulência e aletas.</Typography>
                </Stack>
              )}

              {aba === 'radiacao' && (
                <Stack spacing={2}>
                  <Typography variant="body2">Emissividade ε: {formatNumber(eps,2)}</Typography>
                  <Slider value={eps} min={0.05} max={0.98} step={0.01} onChange={(_, v) => setEps(v)} />

                  <Typography variant="body2">Área A: {formatNumber(Arad,2)} m²</Typography>
                  <Slider value={Arad} min={0.2} max={2.0} step={0.05} onChange={(_, v) => setArad(v)} />

                  <Typography variant="body2">Massa m: {formatNumber(mrad,2)} kg</Typography>
                  <Slider value={mrad} min={1} max={20} step={0.5} onChange={(_, v) => setMrad(v)} />

                  <Typography variant="body2">cₚ: {cprad} J/kgK</Typography>
                  <Slider value={cprad} min={400} max={1200} step={20} onChange={(_, v) => setCprad(v)} />

                  <Typography variant="body2">Sol: {sol ? 'Ligado' : 'Desligado'}</Typography>
                  <Slider value={sol ? 1 : 0} min={0} max={1} step={1} onChange={(_, v) => setSol(Boolean(v))} />

                  <Typography variant="body2">Qₛₒₗ (absorvido): {formatNumber(Qsol)} W</Typography>
                  <Slider value={Qsol} min={0} max={1600} step={10} onChange={(_, v) => setQsol(v)} />

                  <Typography variant="body2">Faixa alvo: {faixaAlvo[0]}–{faixaAlvo[1]}°C</Typography>
                  <Stack direction="row" spacing={1}>
                    <Slider value={faixaAlvo[0]} min={-30} max={60} step={1} onChange={(_, v) => setFaixaAlvo([Math.min(v, faixaAlvo[1]-1), faixaAlvo[1]])} />
                    <Slider value={faixaAlvo[1]} min={-20} max={80} step={1} onChange={(_, v) => setFaixaAlvo([faixaAlvo[0], Math.max(v, faixaAlvo[0]+1)])} />
                  </Stack>

                  <Divider />
                  <Typography variant="body2" color="text.secondary">Dica: Q̇rad ∝ ε·A·(T⁴ - Tᵣᵉᶠ⁴). No vácuo, a radiação domina.</Typography>
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardHeader title="Jogo" />
            <CardContent>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={() => setRodando(true)}>Iniciar</Button>
                <Button variant="outlined" startIcon={<PauseIcon />} onClick={() => setRodando(false)}>Pausar</Button>
                <Button variant="text" startIcon={<RestartAltIcon />} onClick={reset}>Resetar</Button>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Pontuação acumula quando você mantém a meta do modo atual. Tente bater seus próprios recordes!
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
