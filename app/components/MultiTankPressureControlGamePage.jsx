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
} from '@mui/material';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';

// -----------------------------------------------------------------------------
// Constantes de Mecânica dos Fluidos e do sistema
// -----------------------------------------------------------------------------
const RHO = 1000; // kg/m³ (água)
const G = 9.81; // m/s²

const NUM_TANKS = 10;
const SIM_TARGET_TIME = 90; // segundos para "sobreviver"
const DT = 0.25; // passo de tempo (segundos)

// Geometria simples dos tanques
const TANK_AREA = 15; // m²
const TANK_MAX_HEIGHT = 5; // m (altura máxima "de projeto")

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

// Evento determinístico de "comporta travada" por alavanca parada
function createStuckGateEvent() {
  return {
    type: 'stuck_gate',
    label: 'Comporta travada',
    description:
      'A comporta travou por ficar muito tempo na mesma posição. É necessário redobrar a atenção.',
    flowMultiplier: 1.0,
    blockOutflow: true,
    remainingTime: 6 + Math.random() * 4, // 6–10 s
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
    lowLevelTime: 0, // tempo acumulado em nível muito baixo
    staticTime: 0, // tempo desde a última mudança de alavanca
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
              staticTime: 0, // mexeu na alavanca → zera tempo parado
            }
          : t
      )
    );
  };

  const handlePopupClose = () => {
    setPopup((prev) => ({ ...prev, open: false }));
  };

  // ---------------------------------------------------------------------------
  // Loop de simulação: dinâmica dos tanques + eventos + falhas/sucesso
  //  - stressFactor: aumenta gradualmente a vazão média do sistema.
  //  - staticTime: se a alavanca ficar muito tempo parada → evento de comporta travada.
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
            staticTime,
          } = tank;

          // Acumula tempo sem mexer na alavanca
          staticTime += dt;

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

          // Evento determinístico: comporta travada por alavanca parada
          const STATIC_TIME_LIMIT = 18; // s
          if (!newEvent && staticTime > STATIC_TIME_LIMIT) {
            newEvent = createStuckGateEvent();
            staticTime = 0; // reseta após disparar o evento
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

          // Monitor de nível muito baixo (falha operacional se operar quase seco por muito tempo)
          const LOW_LEVEL_THRESHOLD = 0.2; // m
          const DRY_TIME = 8; // s em nível muito baixo até falhar

          if (waterHeight < LOW_LEVEL_THRESHOLD) {
            lowLevelTime += dt;
          } else {
            lowLevelTime = 0;
          }

          // Falha por ultrapassar o limite de pressão/força
          if (!isFailed && utilization > 1) {
            isFailed = true;
            failureReason = 'overpressure';
            if (!tickResult.failEvent) {
              tickResult.failEvent = {
                tankName: tank.name,
                reason: 'overpressure',
              };
            }
          }

          // Falha por operar quase seco muito tempo
          if (!isFailed && lowLevelTime > DRY_TIME) {
            isFailed = true;
            failureReason = 'dry';
            if (!tickResult.failEvent) {
              tickResult.failEvent = {
                tankName: tank.name,
                reason: 'dry',
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
            staticTime,
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
            ? `${tankName} explodiu por excesso de pressão na comporta!`
            : `${tankName} ficou praticamente seco por muito tempo. Você perdeu o controle hidráulico desse tanque.`;
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
          pressão e evitar tanto explosões quanto operação quase seca. Cuidado:
          deixar tudo na mesma posição por muito tempo pode travar a comporta.
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
              subheader="Monitore níveis e pressões em uma grade fixa de 10 tanques."
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
// Painel geral (esquerda)
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
              ultrapasse o limite de pressão na comporta e sem operar quase
              seco por muito tempo.
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
                d&apos;água (F ∝ h²). Um pequeno aumento em altura pode
                provocar um grande aumento de força.
              </Typography>
            </Stack>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Condições de falha e sucesso
            </Typography>
            <Typography variant="body2">
              • Se a força na comporta de qualquer tanque ultrapassar o limite
              de projeto → <strong>tanque explode</strong> e o jogo termina.
            </Typography>
            <Typography variant="body2">
              • Se o nível de água de um tanque ficar muito baixo por muito
              tempo → <strong>falha operacional</strong> (tanque operando
              praticamente seco).
            </Typography>
            <Typography variant="body2">
              • Se você deixar uma alavanca na mesma posição por muito tempo, a
              comporta pode <strong>travar</strong>, impedindo o alívio de
              pressão.
            </Typography>
            <Typography variant="body2">
              • Se nenhum tanque falhar até o fim do tempo de simulação →
              <strong> você conseguiu controlar o sistema</strong>.
            </Typography>
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

  const isCritical = !tank.isFailed && utilization >= 0.85 && h > 0.1;
  const isLow = !tank.isFailed && h < 0.2;

  let statusLabel = 'Estável';
  let chipColor = 'default';

  if (tank.isFailed) {
    statusLabel =
      tank.failureReason === 'dry'
        ? 'Falha: tanque seco'
        : 'Falha: explosão';
    chipColor = 'error';
  } else if (isCritical) {
    statusLabel = 'Crítico';
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
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.6,
        position: 'relative',
        borderWidth: 2,
        borderColor: tank.isFailed
          ? 'error.main'
          : isCritical
          ? 'warning.main'
          : 'divider',
        boxShadow: tank.isFailed
          ? '0 0 18px rgba(244,67,54,0.9)'
          : isCritical
          ? '0 0 12px rgba(255,193,7,0.7)'
          : 'none',
        '@keyframes criticalPulse': {
          '0%': { boxShadow: '0 0 4px rgba(255,193,7,0.3)' },
          '100%': { boxShadow: '0 0 18px rgba(255,193,7,0.9)' },
        },
        animation:
          isCritical && !tank.isFailed
            ? 'criticalPulse 0.9s ease-in-out infinite alternate'
            : 'none',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 0.4 }}
      >
        <Typography variant="subtitle2">{tank.name}</Typography>
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
          height: 110,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'grey.600',
          overflow: 'hidden',
          bgcolor: 'grey.900',
          mb: 0.7,
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
          mt: 0.4,
          height: 6,
          borderRadius: 3,
        }}
      />

      {/* Evento ativo */}
      <Box sx={{ mt: 0.5 }}>
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
          <Typography variant="caption" color="text.secondary">
            Sem evento extremo
          </Typography>
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
        Mas cuidado: abrir sempre igual em todos os tanques e não mexer mais
        pode travar comportas e levar à falha.
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
      <Typography variant="caption">{label}</Typography>
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
