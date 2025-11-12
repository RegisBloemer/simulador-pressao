'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
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
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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

// Sobrepressão
const OVERPRESSURE_TIME_LIMIT = 5; // não pode ficar acima do limite por mais de 5 s

// -----------------------------------------------------------------------------
// Materiais da comporta (global, igual para todos os tanques)
// -----------------------------------------------------------------------------
const GATE_MATERIALS = [
  {
    id: 'steel',
    name: 'Aço',
    description: 'Alta resistência, ideal para altas pressões.',
    suggestedLimitForce: 60, // kN (mais desafiador)
  },
  {
    id: 'concrete',
    name: 'Concreto armado',
    description: 'Resistência intermediária e custo moderado.',
    suggestedLimitForce: 45,
  },
  {
    id: 'wood',
    name: 'Madeira',
    description: 'Resistência baixa, apenas para situações didáticas.',
    suggestedLimitForce: 25,
  },
];

// -----------------------------------------------------------------------------
// Eventos extremos por tanque
// -----------------------------------------------------------------------------
const TANK_EVENTS = [
  {
    type: 'inflow_spike',
    label: 'Aumento súbito de vazão',
    description: 'A vazão de entrada deste tanque aumentou drasticamente.',
    flowMultiplier: 2.3,
    blockOutflow: false,
  },
  {
    type: 'relief_failure',
    label: 'Falha temporária de alívio',
    description:
      'A comporta não consegue aliviar a pressão mesmo aberta por alguns segundos.',
    flowMultiplier: 1.0,
    blockOutflow: true,
  },
  {
    type: 'turbulent_inflow',
    label: 'Oscilações fortes de vazão',
    description:
      'A vazão de entrada deste tanque ficou mais instável e imprevisível.',
    flowMultiplier: 1.6,
    blockOutflow: false,
  },
];

function createRandomTankEvent() {
  const base = TANK_EVENTS[Math.floor(Math.random() * TANK_EVENTS.length)];
  return {
    ...base,
    remainingTime: 6 + Math.random() * 6, // 6–12 s
  };
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
    baseInflow: 0.9 + 0.05 * i, // m³/s – levemente diferentes
    gateOpening: 0, // 0–100 % (controlado pela alavanca)
    isFailed: false,
    failureReason: null, // 'overpressure' | 'dry'
    event: null,
    previousUtilization: 0,
    lowLevelTime: 0,        // tempo acumulado em nível seco
    overpressureTime: 0,    // tempo acumulado em sobrepressão
  }));
}

const initialGameState = {
  isRunning: false,
  isGameOver: false,
  hasStarted: false,
  timeElapsed: 0,
  result: null, // 'success' | 'fail' | null
};

const initialPopup = {
  open: false,
  message: '',
  severity: 'info', // 'success' | 'error' | 'info' | 'warning'
};

// -----------------------------------------------------------------------------
// Componente principal
// -----------------------------------------------------------------------------
function MultiTankPressureControlGamePage() {
  const [tanks, setTanks] = useState(() => createInitialTanks());
  const [game, setGame] = useState(initialGameState);

  const [gateConfig, setGateConfig] = useState({
    materialId: 'steel',
    height: '3.0', // m
    width: '2.0', // m
    thickness: '0.25', // m
    limitForce: '60', // kN (default mais apertado)
  });

  const [popup, setPopup] = useState(initialPopup);

  // ---------------------------------------------------------------------------
  // Handlers básicos
  // ---------------------------------------------------------------------------
  const handleStart = () => {
    setGame((prev) => {
      if (prev.isGameOver) return prev;
      return {
        ...prev,
        isRunning: true,
        hasStarted: true,
      };
    });
  };

  const handlePause = () => {
    setGame((prev) => ({
      ...prev,
      isRunning: false,
    }));
  };

  const handleRestart = () => {
    setGame(initialGameState);
    setTanks(createInitialTanks());
    setPopup(initialPopup);
  };

  const handleGateFieldChange = (field, value) => {
    setGateConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleGateMaterialChange = (materialId) => {
    const material = GATE_MATERIALS.find((m) => m.id === materialId);
    setGateConfig((prev) => ({
      ...prev,
      materialId,
      limitForce:
        prev.limitForce ||
        (material ? String(material.suggestedLimitForce) : prev.limitForce),
    }));
  };

  const handleLeverChange = (tankId, value) => {
    if (game.isGameOver) return;
    setTanks((prev) =>
      prev.map((t) =>
        t.id === tankId
          ? {
              ...t,
              gateOpening: value,
            }
          : t
      )
    );
  };

  const handlePopupClose = () => {
    setPopup((prev) => ({ ...prev, open: false }));
  };

  // ---------------------------------------------------------------------------
  // Loop de simulação
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!game.isRunning || game.isGameOver) return;

    const dt = DT;
    const gateHeight = parseFloat(gateConfig.height) || 0;
    const gateWidth = parseFloat(gateConfig.width) || 1;
    const limitForce_kN = parseFloat(gateConfig.limitForce) || 0;

    let simElapsed = 0; // tempo acumulado nesta execução da simulação

    const interval = setInterval(() => {
      simElapsed += dt;
      const normalized = Math.min(1, simElapsed / SIM_TARGET_TIME);
      // Fator global de "tempestade" / aumento de carga
      const stressFactor = 1 + 0.5 * normalized; // 1.0 → 1.5

      const tickResult = {
        failEvent: null, // { tankName, reason }
        savedTankName: null,
      };

      setTanks((prevTanks) => {
        return prevTanks.map((tank) => {
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

          // Atualiza / gera evento aleatório
          let newEvent = event;
          if (newEvent) {
            const remaining = (newEvent.remainingTime || 0) - dt;
            if (remaining <= 0) {
              newEvent = null;
            } else {
              newEvent = { ...newEvent, remainingTime: remaining };
            }
          } else {
            const eventChance = 0.03; // ~3% por passo
            if (Math.random() < eventChance) {
              newEvent = createRandomTankEvent();
            }
          }

          // Vazão de entrada aleatória com stress global + evento
          const noise = Math.random() * 0.6 - 0.3; // [-0.3, 0.3]
          const eventMultiplier = newEvent?.flowMultiplier ?? 1;
          const dynamicBaseInflow = baseInflow * stressFactor;
          let Q_in = dynamicBaseInflow * (1 + noise) * eventMultiplier;
          Q_in = Math.max(Q_in, 0);

          waterVolume += Q_in * dt;

          // Vazão de saída pela comporta (controlada pela alavanca)
          const outflowBlocked = newEvent?.blockOutflow ?? false;
          if (gateOpening > 0 && !outflowBlocked) {
            const openingFraction = gateOpening / 100; // 0–1
            const gateArea = gateWidth * gateHeight * 0.25; // área efetiva (≈25%)
            const Cd = 0.62;
            const hForOutflow = Math.max(waterHeight, 0);
            const Q_out =
              Cd *
              gateArea *
              Math.sqrt(Math.max(0, 2 * G * hForOutflow)) *
              openingFraction;
            waterVolume = Math.max(0, waterVolume - Q_out * dt);
          }

          // Atualiza altura da água
          waterHeight = Math.min(
            waterVolume / TANK_AREA,
            TANK_MAX_HEIGHT * 1.3
          );

          // Cálculo de pressão e força na comporta
          const h_eff = Math.min(waterHeight, gateHeight);
          const F_h_kN =
            (0.5 * RHO * G * h_eff * h_eff * gateWidth) / 1000;
          const utilization =
            limitForce_kN > 0 ? F_h_kN / limitForce_kN : 0;

          let isFailed = tank.isFailed;
          let failureReason = tank.failureReason;

          // Monitor de nível seco: se h < DRY_LEVEL_THRESHOLD, começa a contar
          if (waterHeight < DRY_LEVEL_THRESHOLD) {
            lowLevelTime += dt;
          } else {
            lowLevelTime = 0;
          }

          // Monitor de sobrepressão: se U > 1, começa a contar
          if (utilization > 1) {
            overpressureTime += dt;
          } else {
            overpressureTime = 0;
          }

          // Falha por tanque seco por mais de 5 s
          if (!isFailed && lowLevelTime > DRY_TIME_LIMIT) {
            isFailed = true;
            failureReason = 'dry';
            if (!tickResult.failEvent) {
              tickResult.failEvent = {
                tankName: tank.name,
                reason: 'dry',
              };
            }
          }

          // Falha por sobrepressão por mais de 5 s
          if (!isFailed && overpressureTime > OVERPRESSURE_TIME_LIMIT) {
            isFailed = true;
            failureReason = 'overpressure';
            if (!tickResult.failEvent) {
              tickResult.failEvent = {
                tankName: tank.name,
                reason: 'overpressure',
              };
            }
          }

          // Feedback de "salvou o tanque a tempo"
          const savedNow =
            !isFailed &&
            previousUtilization >= 0.9 &&
            utilization <= 0.7;
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
        });
      });

      // Atualiza estado global do jogo
      setGame((prev) => {
        if (!prev.isRunning || prev.isGameOver) return prev;

        const newTime = prev.timeElapsed + dt;
        let isGameOver = prev.isGameOver;
        let result = prev.result;

        if (!isGameOver) {
          if (tickResult.failEvent) {
            isGameOver = true;
            result = 'fail';
          } else if (newTime >= SIM_TARGET_TIME) {
            isGameOver = true;
            result = 'success';
          }
        }

        return {
          ...prev,
          timeElapsed: newTime,
          isGameOver,
          result,
          isRunning: isGameOver ? false : prev.isRunning,
        };
      });

      // Pop-ups
      if (tickResult.failEvent) {
        const { tankName, reason } = tickResult.failEvent;
        const msg =
          reason === 'overpressure'
            ? `${tankName} explodiu: a força na comporta ficou acima do limite por mais de ${OVERPRESSURE_TIME_LIMIT} s!`
            : `${tankName} ficou seco por mais de ${DRY_TIME_LIMIT} s. Você perdeu o controle hidráulico desse tanque.`;
        setPopup({
          open: true,
          severity: 'error',
          message: msg,
        });
      } else if (tickResult.savedTankName) {
        setPopup({
          open: true,
          severity: 'success',
          message: `${tickResult.savedTankName}: você aliviou a pressão a tempo!`,
        });
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
        message:
          'Parabéns! Você conseguiu controlar todos os tanques dentro dos limites de segurança.',
      });
    }
  }, [game.result]);

  // ---------------------------------------------------------------------------
  // Layout principal (painel à esquerda, tanques à direita)
  // ---------------------------------------------------------------------------
  const topRowTanks = tanks.slice(0, 5);
  const bottomRowTanks = tanks.slice(5, 10);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Box>
        <Typography variant="h4" gutterBottom>
          Painel de Controle – Tanques sob Pressão
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Controle <strong>10 tanques de água</strong> ao mesmo tempo. Use as
          alavancas na parte inferior para abrir/fechar as comportas, aliviar a
          pressão e evitar tanto explosões quanto tanques secos. Se um tanque
          ficar seco ou em sobrepressão, você terá apenas {DRY_TIME_LIMIT} s /{' '}
          {OVERPRESSURE_TIME_LIMIT} s para corrigir antes da falha.
        </Typography>
      </Box>

      <Grid
        container
        spacing={2}
        sx={{
          flex: 1,
          minHeight: 0,
          flexWrap: 'nowrap',
          alignItems: 'stretch',
        }}
      >
        {/* Painel geral à esquerda */}
        <Grid
          item
          xs={4}
          sx={{
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
        </Grid>

        {/* Tanques + alavancas à direita */}
        <Grid
          item
          xs={8}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <Card
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <CardHeader
              title="Tanques de água"
              subheader="Monitore níveis, pressões e contagens regressivas para tanques secos e em sobrepressão."
            />
            <CardContent
              sx={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {/* Grade fixa 2x5 de tanques */}
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gridTemplateRows: '1fr 1fr',
                  gap: 1.5,
                }}
              >
                {topRowTanks.map((tank, idx) => (
                  <Box
                    key={tank.id}
                    sx={{ gridColumn: idx + 1, gridRow: 1 }}
                  >
                    <TankCard tank={tank} gateConfig={gateConfig} />
                  </Box>
                ))}
                {bottomRowTanks.map((tank, idx) => (
                  <Box
                    key={tank.id}
                    sx={{ gridColumn: idx + 1, gridRow: 2 }}
                  >
                    <TankCard tank={tank} gateConfig={gateConfig} />
                  </Box>
                ))}
              </Box>

              <Divider />

              {/* Linha de alavancas (área inferior) */}
              <LeversRow
                topRowTanks={topRowTanks}
                bottomRowTanks={bottomRowTanks}
                game={game}
                onLeverChange={handleLeverChange}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Pop-ups de feedback */}
      <Snackbar
        open={popup.open}
        autoHideDuration={4000}
        onClose={handlePopupClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handlePopupClose}
          severity={popup.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
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
  const timeProgress = Math.min(
    100,
    (game.timeElapsed / SIM_TARGET_TIME) * 100
  );

  let statusLabel = 'Aguardando início.';
  let statusColor = 'default';

  if (game.result === 'success') {
    statusLabel = 'SUCESSO – todos os tanques controlados!';
    statusColor = 'success';
  } else if (game.result === 'fail') {
    statusLabel = 'FALHA – pelo menos um tanque saiu da faixa segura.';
    statusColor = 'error';
  } else if (game.isRunning) {
    statusLabel = 'Simulação em andamento...';
    statusColor = 'info';
  } else if (game.hasStarted) {
    statusLabel = 'Simulação pausada.';
    statusColor = 'info';
  }

  const material = GATE_MATERIALS.find(
    (m) => m.id === gateConfig.materialId
  );

  const gateHeight = parseFloat(gateConfig.height) || 0;
  const gateWidth = parseFloat(gateConfig.width) || 0;
  const limitForce = parseFloat(gateConfig.limitForce) || 0;
  const gateArea = gateHeight * gateWidth;

  return (
    <Card
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <CardHeader
        title="Painel geral"
        subheader="Defina a comporta global e acompanhe o estado do sistema."
        action={
          <Chip
            icon={<EmojiEventsIcon />}
            label={
              game.result === 'success'
                ? 'Resultado: SUCESSO'
                : game.result === 'fail'
                ? 'Resultado: FALHA'
                : 'Resultado: em aberto'
            }
            color={
              game.result === 'success'
                ? 'success'
                : game.result === 'fail'
                ? 'error'
                : 'default'
            }
            variant="outlined"
          />
        }
      />
      <CardContent sx={{ flex: 1, overflowY: 'auto' }}>
        <Stack spacing={2}>
          {/* Tempo de simulação */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Tempo de simulação
            </Typography>
            <LinearProgress
              variant="determinate"
              value={timeProgress}
              sx={{ height: 10, borderRadius: 5, mb: 0.5 }}
            />
            <Typography variant="body2">
              Decorrido:{' '}
              <strong>{game.timeElapsed.toFixed(1)} s</strong> /{' '}
              {SIM_TARGET_TIME} s
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Você vence se chegar ao fim do tempo sem que nenhum tanque
              ultrapasse o limite de pressão na comporta por mais de{' '}
              {OVERPRESSURE_TIME_LIMIT} s e sem que qualquer tanque permaneça
              seco por mais de {DRY_TIME_LIMIT} s.
            </Typography>
          </Box>

          <Divider />

          {/* Controles da simulação */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Controles da simulação
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={onStart}
                disabled={game.isRunning || game.isGameOver}
              >
                Iniciar
              </Button>
              <Button
                variant="outlined"
                startIcon={<PauseIcon />}
                onClick={onPause}
                disabled={!game.isRunning}
              >
                Pausar
              </Button>
              <Button
                variant="text"
                startIcon={<RestartAltIcon />}
                onClick={onRestart}
              >
                Reiniciar
              </Button>
            </Stack>
            <Chip
              icon={<PeopleAltIcon />}
              label={statusLabel}
              color={statusColor}
              variant="outlined"
              size="small"
            />
          </Box>

          <Divider />

          {/* Configuração global da comporta */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Comporta global (igual para todos os tanques)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Defina o material e os parâmetros de dimensionamento antes de
              iniciar. Depois de iniciado, estes valores ficam travados para
              simular um projeto já construído.
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
                {GATE_MATERIALS.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.name}
                  </MenuItem>
                ))}
              </TextField>

              {material && (
                <Typography variant="caption" color="text.secondary">
                  {material.description} (limite sugerido: ~
                  {material.suggestedLimitForce} kN)
                </Typography>
              )}

              <Stack direction="row" spacing={1}>
                <TextField
                  label="Altura da comporta (m)"
                  size="small"
                  value={gateConfig.height}
                  onChange={(e) =>
                    onGateFieldChange('height', e.target.value)
                  }
                  sx={{ flex: 1 }}
                  disabled={game.hasStarted}
                />
                <TextField
                  label="Largura da comporta (m)"
                  size="small"
                  value={gateConfig.width}
                  onChange={(e) =>
                    onGateFieldChange('width', e.target.value)
                  }
                  sx={{ flex: 1 }}
                  disabled={game.hasStarted}
                />
              </Stack>

              <Stack direction="row" spacing={1}>
                <TextField
                  label="Espessura (m)"
                  size="small"
                  value={gateConfig.thickness}
                  onChange={(e) =>
                    onGateFieldChange('thickness', e.target.value)
                  }
                  sx={{ flex: 1 }}
                  disabled={game.hasStarted}
                />
                <TextField
                  label="Limite de força (kN)"
                  size="small"
                  value={gateConfig.limitForce}
                  onChange={(e) =>
                    onGateFieldChange('limitForce', e.target.value)
                  }
                  sx={{ flex: 1 }}
                  disabled={game.hasStarted}
                />
              </Stack>

              <Typography variant="body2">
                Área da comporta: <strong>{gateArea.toFixed(2)} m²</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Conceito chave: a força hidrostática em uma comporta vertical
                aumenta com o <strong>quadrado</strong> da altura da coluna
                d&apos;água (F ∝ h²).
              </Typography>
            </Stack>
          </Box>

          <Divider />

          {/* Condições de falha, sucesso e teoria usada */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Condições de falha e sucesso
            </Typography>

            {/* Condições práticas do jogo */}
            <Typography variant="body2">
              • Se a <strong>força na comporta</strong> de qualquer tanque
              permanecer acima do limite de projeto por mais de{' '}
              {OVERPRESSURE_TIME_LIMIT} s →{' '}
              <strong>tanque explode por sobrepressão</strong> e o jogo
              termina.
            </Typography>
            <Typography variant="body2">
              • Se o <strong>tanque ficar seco</strong> (nível de água
              praticamente zero) por mais de {DRY_TIME_LIMIT} s →{' '}
              <strong>falha operacional</strong>.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              • Se nenhum tanque falhar até o fim do tempo de simulação →{' '}
              <strong>você conseguiu controlar o sistema</strong>.
            </Typography>

            {/* BLOCO TEÓRICO EXPANSÍVEL */}
            <Accordion sx={{ mt: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">
                  Ver modelagem física e fórmulas de Mecânica dos Fluidos
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2">
                  1. <strong>Pressão hidrostática no fundo do tanque</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  p = ρ · g · h
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  ρ = densidade do fluido (≈ 1000 kg/m³ para água), g =
                  gravidade (≈ 9,81 m/s²), h = altura da coluna d&apos;água
                  acima da base.
                </Typography>

                <Typography variant="body2" sx={{ mt: 1 }}>
                  2. <strong>Força hidrostática resultante na comporta</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  F = ½ · ρ · g · h² · b
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  A comporta é modelada como um painel vertical retangular
                  apoiado no fundo. No código usamos h_eff (altura de água
                  atuante) e b = largura da comporta. F é calculada em N e
                  convertida para kN.
                </Typography>

                <Typography variant="body2" sx={{ mt: 1 }}>
                  3. <strong>Critério de falha por sobrepressão</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Utilização estrutural: U = F / F_limite
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  • U &lt; 1 → comporta dentro do limite estrutural.
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  • U ≥ 1 mantido por mais de {OVERPRESSURE_TIME_LIMIT} s → a
                  força excede o limite por tempo suficiente para caracterizar
                  ruptura da comporta (explosão do tanque no jogo).
                </Typography>

                <Typography variant="body2" sx={{ mt: 1 }}>
                  4. <strong>Altura da água a partir do volume</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  h = V / A
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  V(t) é o volume de água no tanque, A é a área em planta do
                  tanque. O jogo atualiza V a cada passo e converte em altura h.
                </Typography>

                <Typography variant="body2" sx={{ mt: 1 }}>
                  5. <strong>Balanço de volume (entrada e saída)</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  V(t + Δt) = V(t) + (Q_in − Q_out) · Δt
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  • Q_in: vazão de entrada aleatória, afetada por eventos
                  extremos e pelo “stress” global (tempestade).
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  • Q_out: vazão de saída pela comporta, controlada pela
                  alavanca.
                </Typography>

                <Typography variant="body2" sx={{ mt: 1 }}>
                  6. <strong>Vazão de saída pela comporta (tipo orifício)</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Q_out = C_d · A_efetiva · √(2 · g · h) · abertura
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  C_d = coeficiente de descarga; A_efetiva = fração da área da
                  comporta; h = altura de água; abertura = posição da alavanca
                  (0 a 1).
                </Typography>

                <Typography variant="body2" sx={{ mt: 1 }}>
                  7. <strong>Falha por tanque seco (aspecto operacional)</strong>
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  Se h ficar abaixo de um limiar mínimo (tanque praticamente
                  seco) por mais de {DRY_TIME_LIMIT} s, o sistema é considerado
                  fora da faixa segura de operação, e o jogo registra uma falha operacional.
                </Typography>
              </AccordionDetails>
            </Accordion>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Cartão visual de um tanque (grade fixa à direita)
// -----------------------------------------------------------------------------
function TankCard({ tank, gateConfig }) {
  const h = tank.waterHeight;
  const fillPercent = Math.min(100, (h / TANK_MAX_HEIGHT) * 100);

  const bottomPressure_kPa = (RHO * G * h) / 1000;

  const gateHeight = parseFloat(gateConfig.height) || 0;
  const gateWidth = parseFloat(gateConfig.width) || 1;
  const limitForce = parseFloat(gateConfig.limitForce) || 0;

  const h_eff = Math.min(h, gateHeight);
  const F_h_kN =
    (0.5 * RHO * G * h_eff * h_eff * gateWidth) / 1000;
  const utilization = limitForce > 0 ? F_h_kN / limitForce : 0;

  // estados lógicos
  const isCritical =
    !tank.isFailed && utilization >= 0.85 && utilization <= 1 && h > 0.1;
  const isOverpress = !tank.isFailed && utilization > 1;
  const isLow = !tank.isFailed && h < LOW_LEVEL_THRESHOLD;
  // só consideramos "seco com contagem" depois que o tempo seco começou a contar
  const isDry =
    !tank.isFailed &&
    h < DRY_LEVEL_THRESHOLD &&
    (tank.lowLevelTime || 0) > 0;

  const dryTimeRemaining = Math.max(
    0,
    DRY_TIME_LIMIT - (tank.lowLevelTime || 0)
  );
  const explosionTimeRemaining = Math.max(
    0,
    OVERPRESSURE_TIME_LIMIT - (tank.overpressureTime || 0)
  );

  let statusLabel = 'Estável';
  let chipColor = 'default';

  if (tank.isFailed) {
    statusLabel =
      tank.failureReason === 'dry'
        ? 'Falha: tanque seco'
        : 'Falha: explosão';
    chipColor = 'error';
  } else if (isOverpress) {
    statusLabel = 'Pressão crítica';
    chipColor = 'error';
  } else if (isCritical) {
    statusLabel = 'Quase no limite';
    chipColor = 'warning';
  } else if (isDry) {
    statusLabel = 'Seco (contagem regressiva)';
    chipColor = 'error';
  } else if (isLow) {
    statusLabel = 'Nível muito baixo';
    chipColor = 'warning';
  } else if (utilization >= 0.6) {
    statusLabel = 'Alerta';
    chipColor = 'warning';
  } else if (utilization > 0.1) {
    statusLabel = 'Seguro';
    chipColor = 'success';
  } else {
    statusLabel = 'Baixa pressão';
    chipColor = 'info';
  }

  const limitForceText =
    limitForce > 0 ? `${limitForce.toFixed(1)} kN` : 'N/D';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.2,
        borderRadius: 2,
        height: 210,              // <-- altura fixa
        display: 'flex',
        flexDirection: 'column',
        gap: 0.6,
        position: 'relative',
        borderWidth: 2,
        borderColor: tank.isFailed
          ? 'error.main'
          : isOverpress || isDry || isCritical
          ? 'warning.main'
          : 'divider',
        boxShadow: tank.isFailed
          ? '0 0 18px rgba(244,67,54,0.9)'
          : isOverpress || isDry || isCritical
          ? '0 0 12px rgba(255,193,7,0.7)'
          : 'none',
        '@keyframes criticalPulse': {
          '0%': { boxShadow: '0 0 4px rgba(255,193,7,0.3)' },
          '100%': { boxShadow: '0 0 18px rgba(255,193,7,0.9)' },
        },
        animation:
          (isOverpress || isDry || isCritical) && !tank.isFailed
            ? 'criticalPulse 0.9s ease-in-out infinite alternate'
            : 'none',
        overflow: 'hidden',       // <-- impede o card de crescer
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 0.4 }}
      >
        <Typography variant="subtitle2" noWrap>
          {tank.name}
        </Typography>
        <Chip
          size="small"
          label={statusLabel}
          color={chipColor}
          variant="filled"
        />
      </Stack>

      {/* Visual da coluna de água */}
      <Box
        sx={{
          position: 'relative',
          height: 90,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'grey.600',
          overflow: 'hidden',
          bgcolor: 'grey.900',
          mb: 0.5,
          flexShrink: 0,
        }}
      >
        {/* Água */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: `${fillPercent}%`,
            bgcolor: tank.isFailed ? 'error.main' : 'primary.main',
            opacity: 0.85,
            transition: 'height 0.25s linear',
          }}
        />
        {/* Reflexo */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '30%',
            background:
              'linear-gradient(to bottom, rgba(255,255,255,0.18), transparent)',
            mixBlendMode: 'screen',
          }}
        />
      </Box>

      {/* Dados numéricos */}
      <Typography variant="caption">
        Nível de água: {h.toFixed(2)} m / {TANK_MAX_HEIGHT} m
      </Typography>
      <Typography variant="caption">
        Pressão na base: {bottomPressure_kPa.toFixed(1)} kPa
      </Typography>
      <Typography variant="caption">
        Força na comporta: {F_h_kN.toFixed(1)} kN / limite {limitForceText}
      </Typography>

      <LinearProgress
        variant="determinate"
        value={Math.min(130, utilization * 100)}
        sx={{
          mt: 0.3,
          height: 6,
          borderRadius: 3,
          flexShrink: 0,
        }}
      />

      {/* Evento + cronômetros de falha */}
      <Box
        sx={{
          mt: 0.4,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.3,
          minHeight: 32,    // <-- reserva espaço fixo p/ chips / mensagens
          flexShrink: 0,
        }}
      >
        {tank.event ? (
          <Chip
            size="small"
            color="info"
            icon={<WarningAmberIcon fontSize="small" />}
            label={`${tank.event.label} (${Math.ceil(
              tank.event.remainingTime
            )} s)`}
          />
        ) : (
          <Typography variant="caption" color="text.secondary" noWrap>
            Sem evento extremo
          </Typography>
        )}

        {isDry && !tank.isFailed && (
          <Chip
            size="small"
            color="error"
            variant="outlined"
            label={`Tanque seco – falha em ${dryTimeRemaining.toFixed(1)} s`}
          />
        )}

        {isOverpress && !tank.isFailed && (
          <Chip
            size="small"
            color="error"
            variant="outlined"
            label={`Pressão crítica – explosão em ${explosionTimeRemaining.toFixed(
              1
            )} s`}
          />
        )}
      </Box>
    </Paper>
  );
}

// -----------------------------------------------------------------------------
// Linha de alavancas (parte inferior, alinhada com os tanques)
// -----------------------------------------------------------------------------
function LeversRow({
  topRowTanks,
  bottomRowTanks,
  game,
  onLeverChange,
}) {
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Alavancas de controle das comportas
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Cada alavanca controla a abertura da comporta do tanque correspondente.
        Alavanca para frente → comporta mais aberta → maior alívio de pressão.
        Ajuste com cuidado para não deixar a pressão subir demais nem o tanque
        secar por muito tempo.
      </Typography>

      <Box
        sx={{
          mt: 1.5,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 2,
        }}
      >
        {topRowTanks.map((topTank, idx) => {
          const bottomTank = bottomRowTanks[idx];
          return (
            <Box
              key={`col-${idx}`}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
              }}
            >
              {/* Alavanca do tanque de cima */}
              <LeverControl
                tank={topTank}
                disabled={game.isGameOver}
                onChange={onLeverChange}
                labelPosition="top"
              />
              {/* Alavanca do tanque de baixo */}
              <LeverControl
                tank={bottomTank}
                disabled={game.isGameOver}
                onChange={onLeverChange}
                labelPosition="bottom"
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function LeverControl({ tank, disabled, onChange, labelPosition }) {
  const handleChange = (event, value) => {
    if (typeof value === 'number') {
      onChange(tank.id, value);
    }
  };

  const label = `${tank.name}`;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection:
          labelPosition === 'top' ? 'column' : 'column-reverse',
        alignItems: 'center',
        gap: 0.5,
      }}
    >
      <Typography variant="caption" noWrap>
        {label}
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 0.5,
          borderRadius: 2,
          height: 90,
          width: 36,
          bgcolor: 'grey.900',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Alavanca tipo "throttle" (slider vertical) */}
        <Slider
          orientation="vertical"
          value={tank.gateOpening}
          onChange={handleChange}
          min={0}
          max={100}
          disabled={disabled || tank.isFailed}
          sx={{
            height: 70,
            '& .MuiSlider-thumb': {
              width: 18,
              height: 14,
              borderRadius: 1,
            },
          }}
        />
      </Paper>
      <Typography variant="caption" color="text.secondary">
        {tank.gateOpening.toFixed(0)}%
      </Typography>
    </Box>
  );
}
