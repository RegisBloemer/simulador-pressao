'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Typography,
  TextField,
  Divider,
  Stack,
  Chip,
  Paper,
  MenuItem,
  LinearProgress,
  Button,
  Snackbar,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
} from '@mui/material';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// -----------------------------------------------------------------------------
// Constantes de Mecânica dos Fluidos e do sistema
// -----------------------------------------------------------------------------
const RHO = 1000; // kg/m³ (água)
const G = 9.81; // m/s²

const NUM_TANKS = 10;
const SIM_TARGET_TIME = 90; // segundos para "sobreviver"
const DT = 0.25; // passo de tempo (segundos)

// Geometria dos tanques
const TANK_AREA = 15; // m²
const TANK_MAX_HEIGHT = 5; // m (altura máxima "de projeto")

// Secura / nível baixo
const LOW_LEVEL_THRESHOLD = 0.2;   // "nível muito baixo" (aviso amarelo)
const DRY_LEVEL_THRESHOLD = 0.05;  // "seco" de verdade (quase zero)
const DRY_TIME_LIMIT = 5;          // não pode ficar seco por mais de 5 s

// Sobrepressão (5 s antes de explodir)
const OVERPRESSURE_TIME_LIMIT = 5; // não pode ficar acima do limite por mais de 5 s

// -----------------------------------------------------------------------------
// Materiais da comporta (global, igual para todos os tanques)
// -----------------------------------------------------------------------------
const GATE_MATERIALS = [
  { id: 'steel', name: 'Aço', description: 'Alta resistência, ideal para altas pressões.', suggestedLimitForce: 60 },
  { id: 'concrete', name: 'Concreto armado', description: 'Resistência intermediária e custo moderado.', suggestedLimitForce: 45 },
  { id: 'wood', name: 'Madeira', description: 'Resistência baixa, apenas para situações didáticas.', suggestedLimitForce: 25 },
];

// -----------------------------------------------------------------------------
// Eventos extremos por tanque
// -----------------------------------------------------------------------------
const TANK_EVENTS = [
  { type: 'inflow_spike', label: 'Aumento súbito de vazão', description: 'A vazão de entrada aumentou drasticamente.', flowMultiplier: 2.3, blockOutflow: false },
  { type: 'relief_failure', label: 'Falha temporária de alívio', description: 'A comporta não alivia por alguns segundos.', flowMultiplier: 1.0, blockOutflow: true },
  { type: 'turbulent_inflow', label: 'Oscilações fortes de vazão', description: 'Entrada mais instável e imprevisível.', flowMultiplier: 1.6, blockOutflow: false },
];

function createRandomTankEvent() {
  const base = TANK_EVENTS[Math.floor(Math.random() * TANK_EVENTS.length)];
  return { ...base, remainingTime: 6 + Math.random() * 6 }; // 6–12 s
}

// -----------------------------------------------------------------------------
// Estados iniciais
// -----------------------------------------------------------------------------
function createInitialTanks() {
  return Array.from({ length: NUM_TANKS }).map((_, i) => ({
    id: i,
    name: `Tanque ${i + 1}`,
    waterVolume: 0,
    waterHeight: 0,
    baseInflow: 0.9 + 0.05 * i, // m³/s (ligeiramente diferentes)
    gateOpening: 0,             // 0–100 % (controlado por switch: 0% ou 100%)
    isFailed: false,
    failureReason: null,        // 'overpressure' | 'dry'
    event: null,
    previousUtilization: 0,
    lowLevelTime: 0,            // tempo acumulado em nível seco
    overpressureTime: 0,        // tempo acumulado acima do limite
  }));
}

const initialGameState = {
  isRunning: false,
  isGameOver: false,
  hasStarted: false,
  timeElapsed: 0,
  result: null, // 'success' | 'fail' | null
};

const initialPopup = { open: false, message: '', severity: 'info' };

// -----------------------------------------------------------------------------
// Componente principal
// -----------------------------------------------------------------------------
function MultiTankPressureControlGamePage() {
  const [tanks, setTanks] = useState(() => createInitialTanks());
  const [game, setGame] = useState(initialGameState);

  const [gateConfig, setGateConfig] = useState({
    materialId: 'steel',
    height: '3.0',  // m
    width: '2.0',   // m
    thickness: '0.25',
    limitForce: '60', // kN
  });

  const [popup, setPopup] = useState(initialPopup);

  // ---------------------------------------------------------------------------
  // Handlers básicos
  // ---------------------------------------------------------------------------
  const handleStart = () => {
    setGame((prev) => (prev.isGameOver ? prev : { ...prev, isRunning: true, hasStarted: true }));
  };
  const handlePause = () => setGame((prev) => ({ ...prev, isRunning: false }));
  const handleRestart = () => {
    setGame(initialGameState);
    setTanks(createInitialTanks());
    setPopup(initialPopup);
  };

  const handleGateFieldChange = (field, value) =>
    setGateConfig((prev) => ({ ...prev, [field]: value }));

  const handleGateMaterialChange = (materialId) => {
    const material = GATE_MATERIALS.find((m) => m.id === materialId);
    setGateConfig((prev) => ({
      ...prev,
      materialId,
      limitForce: prev.limitForce || (material ? String(material.suggestedLimitForce) : prev.limitForce),
    }));
  };

  // Switch: ligado = 100%, desligado = 0%
  const handleSwitchChange = (tankId, checked) => {
    if (game.isGameOver) return;
    setTanks((prev) =>
      prev.map((t) => (t.id === tankId ? { ...t, gateOpening: checked ? 100 : 0 } : t))
    );
  };

  const handlePopupClose = () => setPopup((prev) => ({ ...prev, open: false }));

  // ---------------------------------------------------------------------------
  // Loop de simulação (com timers de 5 s para sobrepressão e seco)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!game.isRunning || game.isGameOver) return;

    const dt = DT;
    const gateHeight = parseFloat(gateConfig.height) || 0;
    const gateWidth = parseFloat(gateConfig.width) || 1;
    const limitForce_kN = parseFloat(gateConfig.limitForce) || 0;

    let simElapsed = 0;

    const interval = setInterval(() => {
      simElapsed += dt;
      const normalized = Math.min(1, simElapsed / SIM_TARGET_TIME);
      const stressFactor = 1 + 0.5 * normalized; // 1.0 → 1.5

      const tickResult = { failEvent: null, savedTankName: null };

      setTanks((prevTanks) =>
        prevTanks.map((tank) => {
          if (tank.isFailed) return tank;

          let {
            waterVolume,
            waterHeight,
            baseInflow,
            gateOpening,
            event,
            previousUtilization,
            lowLevelTime,
            overpressureTime,
          } = tank;

          // Eventos aleatórios
          let newEvent = event;
          if (newEvent) {
            const remaining = (newEvent.remainingTime || 0) - dt;
            newEvent = remaining <= 0 ? null : { ...newEvent, remainingTime: remaining };
          } else if (Math.random() < 0.03) {
            newEvent = createRandomTankEvent();
          }

          // Entrada
          const noise = Math.random() * 0.6 - 0.3;
          const eventMultiplier = newEvent?.flowMultiplier ?? 1;
          const dynamicBaseInflow = baseInflow * stressFactor;
          let Q_in = dynamicBaseInflow * (1 + noise) * eventMultiplier;
          Q_in = Math.max(Q_in, 0);
          waterVolume += Q_in * dt;

          // Saída (orifício) — bloqueada se evento exigir
          const outflowBlocked = newEvent?.blockOutflow ?? false;
          if (gateOpening > 0 && !outflowBlocked) {
            const openingFraction = gateOpening / 100;
            const gateArea = gateWidth * gateHeight * 0.25;
            const Cd = 0.62;
            const hForOutflow = Math.max(waterHeight, 0);
            const Q_out = Cd * gateArea * Math.sqrt(Math.max(0, 2 * G * hForOutflow)) * openingFraction;
            waterVolume = Math.max(0, waterVolume - Q_out * dt);
          }

          // Altura e força
          waterHeight = Math.min(waterVolume / TANK_AREA, TANK_MAX_HEIGHT * 1.3);
          const h_eff = Math.min(waterHeight, gateHeight);
          const F_h_kN = (0.5 * RHO * G * h_eff * h_eff * gateWidth) / 1000;
          const utilization = limitForce_kN > 0 ? F_h_kN / limitForce_kN : 0;

          let isFailed = tank.isFailed;
          let failureReason = tank.failureReason;

          // Timers de falha (5 s)
          if (waterHeight < DRY_LEVEL_THRESHOLD) lowLevelTime += dt;
          else lowLevelTime = 0;

          if (utilization > 1) overpressureTime += dt;
          else overpressureTime = 0;

          if (!isFailed && lowLevelTime > DRY_TIME_LIMIT) {
            isFailed = true;
            failureReason = 'dry';
            if (!tickResult.failEvent) tickResult.failEvent = { tankName: tank.name, reason: 'dry' };
          }
          if (!isFailed && overpressureTime > OVERPRESSURE_TIME_LIMIT) {
            isFailed = true;
            failureReason = 'overpressure';
            if (!tickResult.failEvent) tickResult.failEvent = { tankName: tank.name, reason: 'overpressure' };
          }

          // Feedback "salvou a tempo"
          const savedNow = !isFailed && previousUtilization >= 0.9 && utilization <= 0.7;
          if (savedNow && !tickResult.failEvent && !tickResult.savedTankName) {
            tickResult.savedTankName = tank.name;
          }

          return {
            ...tank,
            waterVolume,
            waterHeight,
            event: newEvent,
            isFailed,
            failureReason,
            previousUtilization: utilization,
            lowLevelTime,
            overpressureTime,
          };
        })
      );

      // Estado global
      setGame((prev) => {
        if (!prev.isRunning || prev.isGameOver) return prev;
        const newTime = prev.timeElapsed + dt;
        let isGameOver = prev.isGameOver;
        let result = prev.result;

        if (!isGameOver) {
          if (tickResult.failEvent) { isGameOver = true; result = 'fail'; }
          else if (newTime >= SIM_TARGET_TIME) { isGameOver = true; result = 'success'; }
        }

        return { ...prev, timeElapsed: newTime, isGameOver, result, isRunning: isGameOver ? false : prev.isRunning };
      });

      // Pop-ups
      if (tickResult.failEvent) {
        const { tankName, reason } = tickResult.failEvent;
        const msg =
          reason === 'overpressure'
            ? `${tankName} explodiu: a força na comporta ficou acima do limite por mais de ${OVERPRESSURE_TIME_LIMIT} s!`
            : `${tankName} ficou seco por mais de ${DRY_TIME_LIMIT} s. Você perdeu o controle hidráulico desse tanque.`;
        setPopup({ open: true, severity: 'error', message: msg });
      } else if (tickResult.savedTankName) {
        setPopup({ open: true, severity: 'success', message: `${tickResult.savedTankName}: você aliviou a pressão a tempo!` });
      }
    }, dt * 1000);

    return () => clearInterval(interval);
  }, [game.isRunning, game.isGameOver, gateConfig]);

  // Pop-up de sucesso geral
  useEffect(() => {
    if (game.result === 'success') {
      setPopup({
        open: true,
        severity: 'success',
        message: 'Parabéns! Você conseguiu controlar todos os tanques dentro dos limites de segurança.',
      });
    }
  }, [game.result]);

  // ---------------------------------------------------------------------------
  // Layout principal — SEMPRE lado a lado: painel (esq.) e tanques (dir.)
  // ---------------------------------------------------------------------------
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        minHeight: 0,
      }}
    >
      <Box>
        <Typography variant="h4" gutterBottom>Painel de Controle – Tanques sob Pressão</Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Use os <strong>switches</strong> para abrir/fechar as comportas. Em sobrepressão/seco, você tem
          <strong> {OVERPRESSURE_TIME_LIMIT} s</strong> / <strong>{DRY_TIME_LIMIT} s</strong> para corrigir.
        </Typography>
      </Box>

      {/* SPLIT: painel à esquerda, tanques à direita (sempre) */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 2,
          // impede quebra para baixo em telas pequenas:
          overflow: 'hidden',
        }}
      >
        {/* Painel (largura controlada por clamp) */}
        <Box
          sx={{
            width: 'clamp(260px, 30vw, 420px)',
            flex: '0 0 auto',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <GameControlPanel
            game={game}
            gateConfig={gateConfig}
            onStart={handleStart}
            onPause={handlePause}
            onRestart={handleRestart}
            onGateFieldChange={handleGateFieldChange}
            onGateMaterialChange={handleGateMaterialChange}
          />
        </Box>

        {/* Área de tanques à direita (sempre ao lado) */}
        <Box
          sx={{
            flex: '1 1 auto',
            minWidth: 0,           // permite que o conteúdo ajuste/role
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <CardHeader
              title="Tanques de água"
            />
            <CardContent
              sx={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                overflow: 'hidden',
              }}
            >
              {/* Grade com 2 linhas fixas + scroll horizontal */}
              <Box sx={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden', pb: 0.5 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridAutoFlow: 'column',
                    gridTemplateRows: 'repeat(2, auto)',            // <= 2 linhas
                    gridAutoColumns: 'minmax(200px, 1fr)',          // cards podem encolher
                    gap: 1.5,
                    alignItems: 'start',
                  }}
                >
                  {tanks.map((tank) => (
                    <TankCard key={tank.id} tank={tank} gateConfig={gateConfig} />
                  ))}
                </Box>
              </Box>

              <Divider />

              {/* Switches (também 2 linhas + scroll horizontal) */}
              <SwitchesRow tanks={tanks} game={game} onSwitchChange={handleSwitchChange} />
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Pop-ups de feedback */}
      <Snackbar
        open={popup.open}
        autoHideDuration={4000}
        onClose={handlePopupClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handlePopupClose} severity={popup.severity} variant="filled" sx={{ width: '100%' }}>
          {popup.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default MultiTankPressureControlGamePage;

// -----------------------------------------------------------------------------
// Painel geral (esquerda) com teoria em Accordion
// -----------------------------------------------------------------------------
function GameControlPanel({
  game,
  gateConfig,
  onStart,
  onPause,
  onRestart,
  onGateFieldChange,
  onGateMaterialChange,
}) {
  const timeProgress = Math.min(100, (game.timeElapsed / SIM_TARGET_TIME) * 100);

  let statusLabel = 'Aguardando início.';
  let statusColor = 'default';
  if (game.result === 'success') { statusLabel = 'SUCESSO – todos os tanques controlados!'; statusColor = 'success'; }
  else if (game.result === 'fail') { statusLabel = 'FALHA – pelo menos um tanque saiu da faixa segura.'; statusColor = 'error'; }
  else if (game.isRunning) { statusLabel = 'Simulação em andamento...'; statusColor = 'info'; }
  else if (game.hasStarted) { statusLabel = 'Simulação pausada.'; statusColor = 'info'; }

  const material = GATE_MATERIALS.find((m) => m.id === gateConfig.materialId);
  const gateHeight = parseFloat(gateConfig.height) || 0;
  const gateWidth = parseFloat(gateConfig.width) || 0;
  const limitForce = parseFloat(gateConfig.limitForce) || 0;
  const gateArea = gateHeight * gateWidth;

  return (
    <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <CardHeader
        title="Painel geral"
        subheader="Defina a comporta global e acompanhe o estado do sistema."
        action={
          <Chip
            icon={<EmojiEventsIcon />}
            label={game.result === 'success' ? 'Resultado: SUCESSO' : game.result === 'fail' ? 'Resultado: FALHA' : 'Resultado: em aberto'}
            color={game.result === 'success' ? 'success' : game.result === 'fail' ? 'error' : 'default'}
            variant="outlined"
          />
        }
      />
      <CardContent sx={{ flex: 1, overflowY: 'auto' }}>
        <Stack spacing={2}>
          {/* Tempo */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Tempo de simulação</Typography>
            <LinearProgress variant="determinate" value={timeProgress} sx={{ height: 10, borderRadius: 5, mb: 0.5 }} />
            <Typography variant="body2">Decorrido: <strong>{game.timeElapsed.toFixed(1)} s</strong> / {SIM_TARGET_TIME} s</Typography>
            <Typography variant="caption" color="text.secondary">
              Falha por sobrepressão ocorre apenas se a força exceder o limite por mais de <strong>{OVERPRESSURE_TIME_LIMIT} s</strong>.
            </Typography>
          </Box>

          <Divider />

          {/* Controles */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Controles da simulação</Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={onStart} disabled={game.isRunning || game.isGameOver}>Iniciar</Button>
              <Button variant="outlined" startIcon={<PauseIcon />} onClick={onPause} disabled={!game.isRunning}>Pausar</Button>
              <Button variant="text" startIcon={<RestartAltIcon />} onClick={onRestart}>Reiniciar</Button>
            </Stack>
            <Chip icon={<PeopleAltIcon />} label={statusLabel} color={statusColor} variant="outlined" size="small" />
          </Box>

          <Divider />

          {/* Configuração da comporta */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Comporta global (igual para todos os tanques)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Defina material e dimensões antes de iniciar. Após iniciar, os valores ficam travados.
            </Typography>

            <Stack spacing={1.5}>
              <TextField
                select
                label="Material"
                size="small"
                value={gateConfig.materialId}
                onChange={(e) => onGateMaterialChange(e.target.value)}
                fullWidth
                disabled={game.hasStarted}
              >
                {GATE_MATERIALS.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
              </TextField>

              {material && (
                <Typography variant="caption" color="text.secondary">
                  {material.description} (limite sugerido: ~{material.suggestedLimitForce} kN)
                </Typography>
              )}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField label="Altura da comporta (m)" size="small" value={gateConfig.height} onChange={(e) => onGateFieldChange('height', e.target.value)} sx={{ flex: 1 }} disabled={game.hasStarted} />
                <TextField label="Largura da comporta (m)" size="small" value={gateConfig.width} onChange={(e) => onGateFieldChange('width', e.target.value)} sx={{ flex: 1 }} disabled={game.hasStarted} />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField label="Espessura (m)" size="small" value={gateConfig.thickness} onChange={(e) => onGateFieldChange('thickness', e.target.value)} sx={{ flex: 1 }} disabled={game.hasStarted} />
                <TextField label="Limite de força (kN)" size="small" value={gateConfig.limitForce} onChange={(e) => onGateFieldChange('limitForce', e.target.value)} sx={{ flex: 1 }} disabled={game.hasStarted} />
              </Stack>

              <Typography variant="body2">Área da comporta: <strong>{gateArea.toFixed(2)} m²</strong></Typography>
            </Stack>
          </Box>

          <Divider />

          {/* Teoria */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>Condições de falha e sucesso</Typography>
            <Typography variant="body2">• Sobrepressão: U = F/F_limite ≥ 1 por mais de {OVERPRESSURE_TIME_LIMIT} s → explosão.</Typography>
            <Typography variant="body2">• Seco: h &lt; limiar por mais de {DRY_TIME_LIMIT} s → falha operacional.</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>• Se ninguém falhar até {SIM_TARGET_TIME}s → sucesso.</Typography>

            <Accordion sx={{ mt: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="subtitle2">Modelagem e fórmulas</Typography></AccordionSummary>
              <AccordionDetails>
                <Typography variant="caption" color="text.secondary" display="block">p = ρ·g·h</Typography>
                <Typography variant="caption" color="text.secondary" display="block">F = ½·ρ·g·h²·b (kN após /1000)</Typography>
                <Typography variant="caption" color="text.secondary" display="block">h = V/A; V(t+Δt)=V(t)+(Q_in−Q_out)·Δt</Typography>
                <Typography variant="caption" color="text.secondary" display="block">Q_out = C_d·A_efetiva·√(2·g·h)·abertura</Typography>
              </AccordionDetails>
            </Accordion>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Cartão de tanque (mantém o visual)
// -----------------------------------------------------------------------------
function TankCard({ tank, gateConfig }) {
  const h = tank.waterHeight;
  const fillPercent = Math.min(100, (h / TANK_MAX_HEIGHT) * 100);
  const bottomPressure_kPa = (RHO * G * h) / 1000;

  const gateHeight = parseFloat(gateConfig.height) || 0;
  const gateWidth = parseFloat(gateConfig.width) || 1;
  const limitForce = parseFloat(gateConfig.limitForce) || 0;

  const h_eff = Math.min(h, gateHeight);
  const F_h_kN = (0.5 * RHO * G * h_eff * h_eff * gateWidth) / 1000;
  const utilization = limitForce > 0 ? F_h_kN / limitForce : 0;

  const isCritical = !tank.isFailed && utilization >= 0.85 && utilization <= 1 && h > 0.1;
  const isOverpress = !tank.isFailed && utilization > 1;
  const isLow = !tank.isFailed && h < LOW_LEVEL_THRESHOLD;
  const isDry = !tank.isFailed && h < DRY_LEVEL_THRESHOLD && (tank.lowLevelTime || 0) > 0;

  const dryTimeRemaining = Math.max(0, DRY_TIME_LIMIT - (tank.lowLevelTime || 0));
  const explosionTimeRemaining = Math.max(0, OVERPRESSURE_TIME_LIMIT - (tank.overpressureTime || 0));

  let statusLabel = 'Estável';
  let chipColor = 'default';
  if (tank.isFailed) { statusLabel = tank.failureReason === 'dry' ? 'Falha: tanque seco' : 'Falha: explosão'; chipColor = 'error'; }
  else if (isOverpress) { statusLabel = 'Pressão crítica'; chipColor = 'error'; }
  else if (isCritical) { statusLabel = 'Quase no limite'; chipColor = 'warning'; }
  else if (isDry) { statusLabel = 'Seco (contagem regressiva)'; chipColor = 'error'; }
  else if (isLow) { statusLabel = 'Nível muito baixo'; chipColor = 'warning'; }
  else if (utilization >= 0.6) { statusLabel = 'Alerta'; chipColor = 'warning'; }
  else if (utilization > 0.1) { statusLabel = 'Seguro'; chipColor = 'success'; }
  else { statusLabel = 'Baixa pressão'; chipColor = 'info'; }

  const limitForceText = limitForce > 0 ? `${limitForce.toFixed(1)} kN` : 'N/D';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.2,
        borderRadius: 2,
        height: 'clamp(160px, 22vw, 210px)', // <- pode encolher um pouco mais
        display: 'flex',
        flexDirection: 'column',
        gap: 0.6,
        position: 'relative',
        borderWidth: 2,
        borderColor: tank.isFailed ? 'error.main' : (isOverpress || isDry || isCritical) ? 'warning.main' : 'divider',
        boxShadow: tank.isFailed ? '0 0 18px rgba(244,67,54,0.9)' : (isOverpress || isDry || isCritical) ? '0 0 12px rgba(255,193,7,0.7)' : 'none',
        '@keyframes criticalPulse': { '0%': { boxShadow: '0 0 4px rgba(255,193,7,0.3)' }, '100%': { boxShadow: '0 0 18px rgba(255,193,7,0.9)' } },
        animation: (isOverpress || isDry || isCritical) && !tank.isFailed ? 'criticalPulse 0.9s ease-in-out infinite alternate' : 'none',
        overflow: 'hidden',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.4 }}>
        <Typography variant="subtitle2" noWrap>{tank.name}</Typography>
        <Chip size="small" label={statusLabel} color={chipColor} variant="filled" />
      </Stack>

      {/* Coluna de água */}
      <Box
        sx={{
          position: 'relative',
          height: 'clamp(64px, 9vw, 92px)',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'grey.600',
          overflow: 'hidden',
          bgcolor: 'grey.900',
          mb: 0.5,
          flexShrink: 0,
        }}
      >
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${fillPercent}%`, bgcolor: tank.isFailed ? 'error.main' : 'primary.main', opacity: 0.85, transition: 'height 0.25s linear' }} />
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.18), transparent)', mixBlendMode: 'screen' }} />
      </Box>

      {/* Dados */}
      <Typography variant="caption">Nível: {h.toFixed(2)} m / {TANK_MAX_HEIGHT} m</Typography>
      <Typography variant="caption">Pressão base: {bottomPressure_kPa.toFixed(1)} kPa</Typography>
      <Typography variant="caption">Força: {F_h_kN.toFixed(1)} kN / limite {limitForceText}</Typography>

      <LinearProgress variant="determinate" value={Math.min(130, utilization * 100)} sx={{ mt: 0.3, height: 6, borderRadius: 3, flexShrink: 0 }} />

      {/* Eventos / contadores */}
      <Box sx={{ mt: 0.4, display: 'flex', flexDirection: 'column', gap: 0.3, minHeight: 32, flexShrink: 0 }}>
        {tank.event ? (
          <Chip size="small" color="info" icon={<WarningAmberIcon fontSize="small" />} label={`${tank.event.label} (${Math.ceil(tank.event.remainingTime)} s)`} />
        ) : (
          <Typography variant="caption" color="text.secondary" noWrap>Sem evento extremo</Typography>
        )}

        {!tank.isFailed && isDry && (
          <Chip size="small" color="error" variant="outlined" label={`Tanque seco – falha em ${dryTimeRemaining.toFixed(1)} s`} />
        )}
        {!tank.isFailed && isOverpress && (
          <Chip size="small" color="error" variant="outlined" label={`Pressão crítica – explosão em ${explosionTimeRemaining.toFixed(1)} s`} />
        )}
      </Box>
    </Paper>
  );
}

// -----------------------------------------------------------------------------
// Linha de switches — também limitada a 2 linhas com scroll horizontal
// -----------------------------------------------------------------------------
function SwitchesRow({ tanks, game, onSwitchChange }) {
  return (
    <Box sx={{ minHeight: 0 }}>
      <Typography variant="subtitle2" gutterBottom>Controles das comportas (switches)</Typography>
      <Typography variant="caption" color="text.secondary">
      <strong>Ligado</strong> = Aberta <strong>Desligado</strong> = Fechada
      </Typography>

      <Box sx={{ mt: 1.5, overflowX: 'auto', overflowY: 'hidden', pb: 0.5 }}>
        <Box
          sx={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridTemplateRows: 'repeat(2, auto)',    // <= no máx 2 linhas
            gridAutoColumns: 'minmax(140px, 1fr)',
            gap: 2,
          }}
        >
          {tanks.map((tank) => (
            <SwitchControl
              key={tank.id}
              tank={tank}
              disabled={game.isGameOver || tank.isFailed}
              onChange={onSwitchChange}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function SwitchControl({ tank, disabled, onChange }) {
  const checked = tank.gateOpening >= 50;
  const handleToggle = (event) => onChange(tank.id, event.target.checked);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="caption" noWrap>{tank.name}</Typography>
      <Paper
        variant="outlined"
        sx={{
          px: 1,
          py: 0.5,
          borderRadius: 2,
          minHeight: 54,
          minWidth: 140,
          bgcolor: 'grey.900',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">Fechada</Typography>
        <Switch checked={checked} onChange={handleToggle} disabled={disabled} />
        <Typography variant="caption" color="text.secondary">Aberta</Typography>
      </Paper>
      <Typography variant="caption" color="text.secondary">
        {checked ? 'Aberta' : 'Fechada'}
      </Typography>
    </Box>
  );
}
