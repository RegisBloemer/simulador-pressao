'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
} from '@mui/material';

import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';

// -----------------------------------------------------------------------------
// Constantes básicas de Mecânica dos Fluidos
// -----------------------------------------------------------------------------
const RHO = 1000; // kg/m³ (água)
const G = 9.81; // m/s²

// -----------------------------------------------------------------------------
// Configuração dos níveis
// -----------------------------------------------------------------------------
const LEVELS = [
  {
    id: 1,
    name: 'Nível 1 – Introdução',
    description: 'Baixa profundidade, enchimento bem rápido.',
    reservoirArea: 25, // m²
    reservoirHeightMax: 4, // m
    maxFlows: [3, 2, 1], // m³/s por válvula
    targetTime: 40, // s
    drainRate: 8, // m³/s quando rompe
  },
  {
    id: 2,
    name: 'Nível 2 – Vazão moderada',
    description: 'Reservatório maior, enchimento muito dinâmico.',
    reservoirArea: 40,
    reservoirHeightMax: 5,
    maxFlows: [4, 3, 2],
    targetTime: 60,
    drainRate: 12,
  },
  {
    id: 3,
    name: 'Nível 3 – Desafio',
    description: 'Alta vazão, reservatório profundo e respostas rápidas.',
    reservoirArea: 60,
    reservoirHeightMax: 7,
    maxFlows: [5, 4, 3],
    targetTime: 80,
    drainRate: 15,
  },
];

// -----------------------------------------------------------------------------
// Materiais da comporta (didático)
// -----------------------------------------------------------------------------
const GATE_MATERIALS = [
  {
    id: 'steel',
    name: 'Aço',
    description: 'Alta resistência, ideal para grandes profundidades.',
    suggestedLimit: 400, // kN
  },
  {
    id: 'concrete',
    name: 'Concreto armado',
    description: 'Resistência intermediária e custo razoável.',
    suggestedLimit: 280,
  },
  {
    id: 'wood',
    name: 'Madeira',
    description: 'Baixa resistência, usada em níveis introdutórios.',
    suggestedLimit: 120,
  },
];

// -----------------------------------------------------------------------------
// Estado inicial do jogo
// -----------------------------------------------------------------------------
const initialGameState = {
  waterVolume: 0, // m³
  waterHeight: 0, // m
  isRunning: false,
  isBroken: false,
  timeElapsed: 0, // s
  peopleAlive: true,
  score: 0,
  lastEvent:
    'Ajuste as propriedades da comporta. As vazões das válvulas variam aleatoriamente ao longo do tempo.',
  hasAwarded: false,
  maxForceExperienced: 0,
  nearFailureTime: 0,
  emergencyActionsUsed: 0,
};

// -----------------------------------------------------------------------------
// Função auxiliar: criar evento aleatório
// -----------------------------------------------------------------------------
function createRandomEvent(levelConfig) {
  const baseDuration = 6 + levelConfig.id * 2; // 8,10,12 s
  const eventsPool = [
    {
      id: 'extreme_rain',
      title: 'Chuva extrema a montante',
      description: 'As vazões aumentam bastante por alguns segundos.',
      remainingTime: baseDuration,
      flowMultiplier: 1.5 + 0.1 * levelConfig.id,
      limitMultiplier: 1,
    },
    {
      id: 'microcracks',
      title: 'Microfissuras na comporta',
      description:
        'A comporta enfraquece temporariamente – cuidado com a força hidrostática!',
      remainingTime: baseDuration,
      flowMultiplier: 1,
      limitMultiplier: 0.7,
    },
    {
      id: 'upstream_control',
      title: 'Controle a montante',
      description:
        'Um operador reduz as vazões a montante – ótima chance para aliviar a pressão.',
      remainingTime: baseDuration,
      flowMultiplier: 0.7,
      limitMultiplier: 1,
    },
  ];

  const index = Math.floor(Math.random() * eventsPool.length);
  return eventsPool[index];
}

function FluidMechanicsMinigamePage() {
  const [level, setLevel] = useState(1);

  // Válvulas: agora são só lidas (flow aleatório), não controladas pelo usuário
  const [valves, setValves] = useState([
    { id: 'v1', name: 'Válvula A', open: 40 },
    { id: 'v2', name: 'Válvula B', open: 20 },
    { id: 'v3', name: 'Válvula C', open: 10 },
  ]);

  // Propriedades da comporta
  const [gate, setGate] = useState({
    materialId: 'steel',
    thickness: '0.20', // m
    height: '3.0', // m
    width: '3.0', // m
    limitForce: '300', // kN
  });

  const [gameState, setGameState] = useState(initialGameState);

  // Eventos extremos (chuva, microfissuras, etc.)
  const [eventState, setEventState] = useState({
    current: null,
    log: [],
  });

  const levelConfig = useMemo(
    () => LEVELS.find((l) => l.id === level) || LEVELS[0],
    [level]
  );

  // ---------------------------------------------------------------------------
  // Handlers básicos
  // ---------------------------------------------------------------------------
  const handleLevelChange = (newLevel) => {
    setLevel(newLevel);
    setGameState({
      ...initialGameState,
      lastEvent:
        'Novo nível selecionado. Observe as vazões aleatórias e dimensione a comporta.',
    });
    setValves([
      { id: 'v1', name: 'Válvula A', open: 40 },
      { id: 'v2', name: 'Válvula B', open: 20 },
      { id: 'v3', name: 'Válvula C', open: 10 },
    ]);
    setEventState({
      current: null,
      log: [],
    });
  };

  const handleGateFieldChange = (field, value) => {
    setGate((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleGateMaterialChange = (materialId) => {
    const material = GATE_MATERIALS.find((m) => m.id === materialId);
    setGate((prev) => ({
      ...prev,
      materialId,
      limitForce:
        material && !prev.limitForce
          ? String(material.suggestedLimit)
          : prev.limitForce,
    }));
  };

  const handleStart = () => {
    setGameState((prev) => {
      if (prev.isBroken && prev.waterVolume <= 0.0001) {
        return {
          ...prev,
          lastEvent:
            'A comporta já rompeu e o reservatório esvaziou. Reinicie o nível para tentar novamente.',
        };
      }
      return {
        ...prev,
        isRunning: true,
        lastEvent: prev.isBroken
          ? 'A água está vazando pela comporta rompida...'
          : 'Simulação em andamento. Observe as vazões e ajuste a comporta!',
      };
    });
  };

  const handlePause = () => {
    setGameState((prev) => ({
      ...prev,
      isRunning: false,
      lastEvent: 'Simulação pausada.',
    }));
  };

  const handleRestart = () => {
    setGameState({
      ...initialGameState,
      lastEvent:
        'Nível reiniciado. As vazões voltarão a variar quando você iniciar a simulação.',
    });
    setValves([
      { id: 'v1', name: 'Válvula A', open: 40 },
      { id: 'v2', name: 'Válvula B', open: 20 },
      { id: 'v3', name: 'Válvula C', open: 10 },
    ]);
    setEventState({
      current: null,
      log: [],
    });
  };

  // Ação emergencial: abrir um "vertedouro" que reduz rapidamente o nível
  // com custo de pontuação (decisão estratégica do jogador).
  const handleEmergencySpill = () => {
    setGameState((prev) => {
      const cfg = levelConfig;

      if (prev.isBroken) {
        return {
          ...prev,
          lastEvent:
            'A comporta já rompeu, não há mais como usar o vertedouro de emergência.',
        };
      }

      if (prev.waterHeight <= 0.2) {
        return {
          ...prev,
          lastEvent:
            'O reservatório está praticamente vazio — o vertedouro de emergência não teria efeito.',
        };
      }

      // Remove cerca de 25% do volume de projeto
      const spillVolume = 0.25 * cfg.reservoirArea * cfg.reservoirHeightMax;
      const newVolume = Math.max(0, prev.waterVolume - spillVolume);
      const newHeight = Math.max(0, newVolume / cfg.reservoirArea);
      const penalty = 10 * cfg.id;

      return {
        ...prev,
        waterVolume: newVolume,
        waterHeight: newHeight,
        score: prev.score - penalty,
        emergencyActionsUsed: (prev.emergencyActionsUsed || 0) + 1,
        lastEvent:
          'Você abriu o vertedouro de emergência! A altura da água caiu, mas isso custou pontos na sua pontuação.',
      };
    });
  };

  // ---------------------------------------------------------------------------
  // Efeito: VÁLVULAS ALEATÓRIAS (mudam ao longo do tempo, sem controle do usuário)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!gameState.isRunning || gameState.isBroken) return;

    const interval = setInterval(() => {
      setValves((prev) =>
        prev.map((v) => {
          const randomDelta = Math.random() * 40 - 20; // -20 a +20
          let newOpen = v.open + randomDelta;

          // Às vezes muda bastante de repente
          if (Math.random() < 0.2) {
            newOpen = Math.random() * 100;
          }

          newOpen = Math.max(0, Math.min(100, newOpen));
          return { ...v, open: newOpen };
        })
      );
    }, 800); // a cada 0.8 s, as vazões mudam

    return () => clearInterval(interval);
  }, [gameState.isRunning, gameState.isBroken]);

  // ---------------------------------------------------------------------------
  // Cálculo da vazão total atual (com base nas aberturas aleatórias)
  // + dificuldade progressiva + efeito de eventos
  // ---------------------------------------------------------------------------
  const flowInfo = useMemo(() => {
    const baseQ_in = valves.reduce((sum, v, idx) => {
      const max = levelConfig.maxFlows[idx] || 0;
      return sum + max * (v.open / 100);
    }, 0);

    const timeRatio =
      levelConfig.targetTime > 0
        ? Math.min(1, gameState.timeElapsed / levelConfig.targetTime)
        : 0;
    const timeMultiplier = 1 + 0.5 * timeRatio; // até ~ +50% de vazão com o tempo

    const eventFlowMultiplier = eventState.current?.flowMultiplier ?? 1;

    const Q_in = baseQ_in * timeMultiplier * eventFlowMultiplier;

    const perValve = valves.map((v, idx) => {
      const max = levelConfig.maxFlows[idx] || 0;
      const q = max * (v.open / 100) * timeMultiplier * eventFlowMultiplier;
      return {
        id: v.id,
        name: v.name,
        q,
        open: v.open,
      };
    });

    return {
      Q_in,
      Q_in_Ls: Q_in * 1000,
      perValve,
    };
  }, [valves, levelConfig, gameState.timeElapsed, eventState]);

  // ---------------------------------------------------------------------------
  // Indicadores principais (pressão, força, risco, etc.)
  // incluindo efeito de eventos (redução de resistência)
  // ---------------------------------------------------------------------------
  const indicators = useMemo(() => {
    const h = gameState.waterHeight;
    const thickness = parseFloat(gate.thickness) || 0;
    const gateHeight = parseFloat(gate.height) || 0;
    const gateWidth = parseFloat(gate.width) || 1;
    const limitForce = parseFloat(gate.limitForce) || 0;

    const area = gateHeight * gateWidth;

    const bottomPressure_Pa = RHO * G * h;
    const bottomPressure_kPa = bottomPressure_Pa / 1000;
    const maxPressure_kPa =
      (RHO * G * levelConfig.reservoirHeightMax) / 1000 || 1;

    const hEff = Math.min(h, gateHeight);
    const F_h_N = 0.5 * RHO * G * hEff * hEff * gateWidth;
    const F_h_kN = F_h_N / 1000;

    const eventLimitMultiplier = eventState.current?.limitMultiplier ?? 1;
    const effectiveLimitForce = limitForce * eventLimitMultiplier;

    const utilization =
      effectiveLimitForce > 0 ? F_h_kN / effectiveLimitForce : 0;

    let riskLabel = 'Defina um limite de força (kN) para a comporta.';
    let riskColor = 'default';

    if (effectiveLimitForce > 0) {
      if (utilization < 0.4) {
        riskLabel = 'Seguro';
        riskColor = 'success';
      } else if (utilization < 0.7) {
        riskLabel = 'Confortável';
        riskColor = 'info';
      } else if (utilization < 1.0) {
        riskLabel = 'Quase no limite';
        riskColor = 'warning';
      } else {
        riskLabel = 'Acima do limite! Ruptura iminente.';
        riskColor = 'error';
      }
    }

    const fillPercent = Math.min(
      100,
      (h / levelConfig.reservoirHeightMax) * 100
    );

    return {
      bottomPressure_kPa,
      maxPressure_kPa,
      F_h_kN,
      limitForce_kN: limitForce,
      effectiveLimitForce_kN: effectiveLimitForce,
      utilization,
      riskLabel,
      riskColor,
      fillPercent,
      gateHeight,
      gateWidth,
      gateArea: area,
      thickness,
    };
  }, [gameState.waterHeight, gate, levelConfig, eventState]);

  // ---------------------------------------------------------------------------
  // Loop da simulação (integração em passos de tempo) com dificuldade dinâmica
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!gameState.isRunning) return;

    const dt = 0.2; // segundos por passo
    const interval = setInterval(() => {
      setGameState((prev) => {
        if (!prev.isRunning) return prev;

        const cfg = levelConfig;
        const gateHeight = parseFloat(gate.height) || 0;
        const gateWidth = parseFloat(gate.width) || 1;
        const limitForce = parseFloat(gate.limitForce) || 0;

        let {
          waterVolume,
          isBroken,
          timeElapsed,
          peopleAlive,
          score,
          hasAwarded,
          maxForceExperienced,
          nearFailureTime,
          emergencyActionsUsed,
        } = prev;

        let lastEvent = prev.lastEvent;

        // Já perdeu? (comporta quebrada e simulação parada)
        if (isBroken && !prev.isRunning) {
          return prev;
        }

        const eventFlowMultiplier = eventState.current?.flowMultiplier ?? 1;
        const eventLimitMultiplier = eventState.current?.limitMultiplier ?? 1;

        if (!isBroken) {
          // Vazão base
          const baseQ_in = valves.reduce((sum, v, idx) => {
            const max = cfg.maxFlows[idx] || 0;
            return sum + max * (v.open / 100);
          }, 0);

          const timeRatio =
            cfg.targetTime > 0 ? Math.min(1, timeElapsed / cfg.targetTime) : 0;
          const timeMultiplier = 1 + 0.5 * timeRatio;

          const Q_in = baseQ_in * timeMultiplier * eventFlowMultiplier;

          // Enchendo reservatório (bem dinâmico)
          waterVolume = Math.max(0, waterVolume + Q_in * dt);

          let waterHeight = Math.min(
            waterVolume / cfg.reservoirArea,
            cfg.reservoirHeightMax * 1.2 // um pouco acima para mostrar "quase transbordando"
          );

          // Cálculo da força hidrostática na comporta
          const hEff = Math.min(waterHeight, gateHeight);
          const F_h_N = 0.5 * RHO * G * hEff * hEff * gateWidth;
          const F_h_kN = F_h_N / 1000;

          const effectiveLimitForce = limitForce * eventLimitMultiplier;

          maxForceExperienced = Math.max(maxForceExperienced || 0, F_h_kN);

          if (effectiveLimitForce > 0 && F_h_kN > 0.9 * effectiveLimitForce) {
            nearFailureTime += dt;
          }

          let isBrokenNow = isBroken;
          let peopleAliveNow = peopleAlive;

          // Verifica ruptura (condição de derrota)
          if (
            effectiveLimitForce > 0 &&
            F_h_kN > effectiveLimitForce &&
            !isBroken
          ) {
            isBrokenNow = true;
            peopleAliveNow = false;
            score -= 50 * cfg.id;
            lastEvent =
              'Simulação encerrada: FALHA — a comporta não suportou a força hidrostática e rompeu antes do fim do tempo. A água atingiu as pessoas 😵';
            return {
              ...prev,
              waterVolume,
              waterHeight,
              isBroken: isBrokenNow,
              peopleAlive: peopleAliveNow,
              timeElapsed,
              score,
              lastEvent,
              isRunning: false, // para a simulação ao romper
              maxForceExperienced,
              nearFailureTime,
            };
          }

          timeElapsed += dt;

          // Verifica sucesso (comporta estável até o fim do tempo)
          if (!isBrokenNow && !hasAwarded && timeElapsed >= cfg.targetTime) {
            hasAwarded = true;

            const baseScore = 100 * cfg.id;

            const referenceLimit =
              effectiveLimitForce || limitForce || 1; // fallback para não dividir por zero
            const utilizationRatio =
              referenceLimit > 0 ? maxForceExperienced / referenceLimit : 0;

            let bonus = 0;

            // Bônus por eficiência de dimensionamento
            if (utilizationRatio > 0.6 && utilizationRatio <= 0.95) {
              bonus += 30 * cfg.id;
            } else if (utilizationRatio < 0.3) {
              // Muito superdimensionado
              bonus -= 20 * cfg.id;
            } else if (utilizationRatio > 0.95) {
              // Muito perto da ruptura: arriscado
              bonus -= 10 * cfg.id;
            }

            // Bônus/penalidade por ações emergenciais
            if (emergencyActionsUsed === 0) {
              bonus += 10 * cfg.id;
            } else {
              bonus -= 5 * cfg.id * emergencyActionsUsed;
            }

            // Penalidade se passou muito tempo perto da ruptura
            if (nearFailureTime > cfg.targetTime * 0.3) {
              bonus -= 15 * cfg.id;
            }

            const gained = baseScore + bonus;
            score += gained;

            lastEvent = `Simulação encerrada: SUCESSO! Você dimensionou a comporta e manteve as pessoas a salvo durante ${cfg.targetTime}s, apesar das vazões aleatórias e eventos extremos. Pontuação desta rodada: ${
              gained >= 0 ? '+' : ''
            }${gained} pts. 🏅`;

            return {
              ...prev,
              waterVolume,
              waterHeight,
              isBroken: isBrokenNow,
              peopleAlive: peopleAliveNow,
              timeElapsed,
              score,
              lastEvent,
              hasAwarded,
              isRunning: false, // para ao vencer
              maxForceExperienced,
              nearFailureTime,
            };
          }

          return {
            ...prev,
            waterVolume,
            waterHeight,
            isBroken: isBrokenNow,
            peopleAlive: peopleAliveNow,
            timeElapsed,
            score,
            lastEvent,
            hasAwarded,
            maxForceExperienced,
            nearFailureTime,
          };
        } else {
          // Comporta já rompeu: a água continua a sair,
          const Q_out = cfg.drainRate;
          waterVolume = Math.max(0, waterVolume - Q_out * dt);
          const waterHeight = Math.max(0, waterVolume / cfg.reservoirArea);

          if (waterVolume <= 0.0001) {
            return {
              ...prev,
              waterVolume: 0,
              waterHeight: 0,
            };
          } else {
            return {
              ...prev,
              waterVolume,
              waterHeight,
            };
          }
        }
      });
    }, dt * 1000);

    return () => clearInterval(interval);
  }, [gameState.isRunning, levelConfig, valves, gate, eventState]);

  // ---------------------------------------------------------------------------
  // Efeito: eventos aleatórios (chuva extrema, microfissuras, etc.)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!gameState.isRunning || gameState.isBroken) return;

    const eventInterval = setInterval(() => {
      setEventState((prev) => {
        const current = prev.current;

        // Atualiza evento ativo
        if (current) {
          const remainingTime = current.remainingTime - 1;
          if (remainingTime <= 0) {
            // Evento terminou
            setGameState((prevGame) => ({
              ...prevGame,
              lastEvent: prevGame.isBroken
                ? prevGame.lastEvent
                : `Evento encerrado: ${current.title}.`,
            }));
            return {
              current: null,
              log: [...prev.log, { ...current, remainingTime: 0 }],
            };
          }

          return {
            ...prev,
            current: { ...current, remainingTime },
          };
        }

        // Nenhum evento ativo: chance de disparar um novo
        const randomChance = 0.15 + 0.05 * (levelConfig.id - 1); // maior chance em níveis altos

        if (Math.random() < randomChance) {
          const newEvent = createRandomEvent(levelConfig);

          setGameState((prevGame) => ({
            ...prevGame,
            lastEvent: `${newEvent.title}: ${newEvent.description}`,
          }));

          return {
            ...prev,
            current: newEvent,
          };
        }

        return prev;
      });
    }, 1000);

    return () => clearInterval(eventInterval);
  }, [gameState.isRunning, gameState.isBroken, levelConfig]);

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------
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
          Minigame – Mecânica dos Fluidos
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Agora as vazões nas válvulas mudam aleatoriamente e eventos extremos
          podem ocorrer. Observe o sistema, use ações emergenciais com
          cuidado e dimensione a comporta para evitar a ruptura.
        </Typography>
      </Box>

      <Grid
        container
        spacing={2}
        sx={{
          flex: 1,
          minHeight: 0,
          alignItems: 'stretch',
          flexWrap: 'nowrap',
          overflowX: 'auto',
        }}
      >
        {/* Coluna esquerda: controles e nível */}
        <Grid
          item
          xs={4}
          sx={{
            minWidth: 320,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ControlsPanel
            level={level}
            levelConfig={levelConfig}
            valves={valves}
            flowInfo={flowInfo}
            gameState={gameState}
            eventState={eventState}
            onLevelChange={handleLevelChange}
            onStart={handleStart}
            onPause={handlePause}
            onRestart={handleRestart}
            onEmergencyAction={handleEmergencySpill}
          />
        </Grid>

        {/* Coluna central: visual do reservatório */}
        <Grid
          item
          xs={4}
          sx={{
            minWidth: 360,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ReservoirView
            levelConfig={levelConfig}
            gameState={gameState}
            indicators={indicators}
            valves={valves}
            flowInfo={flowInfo}
          />
        </Grid>

        {/* Coluna direita: comporta, pressão, risco */}
        <Grid
          item
          xs={4}
          sx={{
            minWidth: 340,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <GateAndStatsPanel
            gate={gate}
            indicators={indicators}
            levelConfig={levelConfig}
            gameState={gameState}
            onGateFieldChange={handleGateFieldChange}
            onGateMaterialChange={handleGateMaterialChange}
          />
        </Grid>
      </Grid>
    </Box>
  );
}

export default FluidMechanicsMinigamePage;

// -----------------------------------------------------------------------------
// Painel de controles (nível, vazões aleatórias, play/pause, eventos)
// -----------------------------------------------------------------------------
function ControlsPanel({
  level,
  levelConfig,
  valves,
  flowInfo,
  gameState,
  eventState,
  onLevelChange,
  onStart,
  onPause,
  onRestart,
  onEmergencyAction,
}) {
  const timeRemaining = Math.max(
    0,
    levelConfig.targetTime - gameState.timeElapsed
  );
  const timeProgress = Math.min(
    100,
    (gameState.timeElapsed / levelConfig.targetTime) * 100
  );

  const currentEvent = eventState?.current;

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
        title="Controles do sistema"
        subheader={levelConfig.description}
        action={
          <Chip
            icon={<EmojiEventsIcon />}
            label={`Score: ${gameState.score}`}
            color="primary"
            variant="outlined"
          />
        }
      />
      <CardContent sx={{ flex: 1, overflowY: 'auto' }}>
        <Stack spacing={2}>
          {/* Seleção de nível */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Níveis de dificuldade
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {LEVELS.map((lvl) => (
                <Chip
                  key={lvl.id}
                  label={lvl.name}
                  color={lvl.id === level ? 'primary' : 'default'}
                  onClick={() => onLevelChange(lvl.id)}
                  clickable
                  size="small"
                />
              ))}
            </Stack>
          </Box>

          <Divider />

          {/* Contador de tempo */}
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
              <strong>{gameState.timeElapsed.toFixed(1)} s</strong> /{' '}
              {levelConfig.targetTime} s
            </Typography>
            <Typography variant="body2">
              Restante:{' '}
              <strong>{timeRemaining.toFixed(1)} s</strong>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Você vence se chegar ao fim do tempo com a comporta intacta e as
              pessoas a salvo. Quanto mais eficiente e menos emergências usar,
              maior a pontuação.
            </Typography>
          </Box>

          <Divider />

          {/* Válvulas (somente leitura) */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Vazões nas válvulas (aleatórias)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              As aberturas das válvulas variam aleatoriamente com o tempo. A
              dificuldade aumenta conforme o tempo passa e eventos extremos
              podem multiplicar as vazões.
            </Typography>
            <Stack spacing={1.5}>
              {valves.map((v, idx) => {
                const flow = flowInfo.perValve[idx]?.q || 0;
                return (
                  <Paper
                    key={v.id}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.5,
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Typography variant="body2" fontWeight={600}>
                        {v.name}
                      </Typography>
                      <Chip
                        size="small"
                        icon={<WaterDropIcon fontSize="small" />}
                        label={`${flow.toFixed(2)} m³/s`}
                        variant="outlined"
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Abertura instantânea: {v.open.toFixed(0)}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.max(0, Math.min(100, v.open))}
                      sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                    />
                  </Paper>
                );
              })}
            </Stack>
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2">
                Vazão total:{' '}
                <strong>{flowInfo.Q_in.toFixed(2)} m³/s</strong> (
                {flowInfo.Q_in_Ls.toFixed(0)} L/s)
              </Typography>
            </Box>
          </Box>

          <Divider />

          {/* Controles de simulação */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Simulação
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ mb: 1, flexWrap: 'wrap' }}
            >
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={onStart}
                disabled={gameState.isRunning}
              >
                Iniciar
              </Button>
              <Button
                variant="outlined"
                startIcon={<PauseIcon />}
                onClick={onPause}
                disabled={!gameState.isRunning}
              >
                Pausar
              </Button>
              <Button
                variant="text"
                startIcon={<RestartAltIcon />}
                onClick={onRestart}
              >
                Reiniciar nível
              </Button>
            </Stack>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<WarningAmberIcon />}
              onClick={onEmergencyAction}
              disabled={gameState.isBroken || gameState.waterHeight < 0.5}
            >
              Emergência: abrir vertedouro
            </Button>
            <Typography variant="caption" color="text.secondary">
              Reduz rapidamente o nível de água, mas aplica penalidade de
              pontuação. Tente vencer sem usar ou usando o mínimo possível.
            </Typography>
          </Box>

          <Divider />

          {/* Eventos extremos */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Eventos extremos
            </Typography>
            {currentEvent ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <WarningAmberIcon fontSize="small" />
                  <Typography variant="body2" fontWeight={600}>
                    {currentEvent.title}
                  </Typography>
                </Stack>
                <Typography variant="body2">
                  {currentEvent.description}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Restam aproximadamente{' '}
                  {Math.ceil(currentEvent.remainingTime)} s
                </Typography>
              </Paper>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Nenhum evento ativo no momento. Fique atento a chuvas extremas,
                microfissuras e outras surpresas durante a simulação!
              </Typography>
            )}
          </Box>

          <Divider />

          {/* Feedback textual */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Feedback do sistema
            </Typography>
            <Typography variant="body2">{gameState.lastEvent}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Visual do reservatório, água, comporta e pessoas
// -----------------------------------------------------------------------------
function ReservoirView({ levelConfig, gameState, indicators, valves, flowInfo }) {
  const fillPercent = indicators.fillPercent;
  const gateHeight = indicators.gateHeight;
  const gateHeightPercent =
    levelConfig.reservoirHeightMax > 0
      ? Math.min(100, (gateHeight / levelConfig.reservoirHeightMax) * 100)
      : 0;

  const peopleDead = !gameState.peopleAlive;

  const valvePositions = ['25%', '50%', '75%'];

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
        title="Visual do reservatório"
        subheader="Veja o fluxo saindo das válvulas, entrando no reservatório e a ação da comporta."
      />
      <CardContent sx={{ flex: 1 }}>
        <Box
          sx={{
            position: 'relative',
            height: 320,
          }}
        >
          {/* Válvulas no topo */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: '10%',
              right: '10%',
              height: 70,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              zIndex: 3,
            }}
          >
            {valves.map((valve, idx) => {
              const flow = flowInfo.perValve[idx]?.q || 0;
              const isActive = flow > 0.0001;
              const open = valve.open;
              return (
                <Box
                  key={valve.id}
                  sx={{
                    width: 80,
                    height: 40,
                    borderRadius: 2,
                    border: '2px solid',
                    borderColor: isActive ? 'primary.main' : 'grey.500',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.paper',
                    boxShadow: isActive
                      ? '0 0 12px rgba(33,150,243,0.7)'
                      : 'none',
                    transition: 'box-shadow 0.2s, border-color 0.2s',
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    sx={{ mb: 0.3 }}
                  >
                    <WaterDropIcon
                      fontSize="small"
                      sx={{ opacity: isActive ? 1 : 0.4 }}
                    />
                    <Typography variant="caption">
                      {open.toFixed(0)}%
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {valve.name}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          {/* Tubos verticais com fluxo interno animado */}
          {valves.map((valve, idx) => {
            const flow = flowInfo.perValve[idx]?.q || 0;
            const isActive = flow > 0.0001;
            const max = levelConfig.maxFlows[idx] || 1;
            const intensity = Math.min(1, flow / (max || 1));
            const left = valvePositions[idx] || '50%';

            return (
              <Box
                key={`${valve.id}-pipe`}
                sx={{
                  position: 'absolute',
                  top: 60,
                  left,
                  transform: 'translateX(-50%)',
                  width: 12,
                  height: 80,
                  borderRadius: 6,
                  bgcolor: 'grey.800',
                  overflow: 'hidden',
                  opacity: isActive ? 0.9 : 0.25,
                  transition: 'opacity 0.2s',
                  '@keyframes flowWave': {
                    '0%': {
                      transform: 'translateY(-15%)',
                    },
                    '100%': {
                      transform: 'translateY(15%)',
                    },
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to bottom, rgba(33,150,243,0.15), rgba(33,150,243,0.95))',
                    opacity: isActive ? 0.3 + 0.7 * intensity : 0,
                    animation: isActive
                      ? 'flowWave 0.5s ease-in-out infinite alternate'
                      : 'none',
                  },
                }}
              />
            );
          })}

          {/* Fluxo visível caindo no reservatório */}
          {valves.map((valve, idx) => {
            const flow = flowInfo.perValve[idx]?.q || 0;
            const isActive = flow > 0.0001;
            const max = levelConfig.maxFlows[idx] || 1;
            const intensity = Math.min(1, flow / (max || 1));
            const left = valvePositions[idx] || '50%';

            return (
              <Box
                key={`${valve.id}-stream`}
                sx={{
                  position: 'absolute',
                  top: 80,
                  left,
                  transform: 'translateX(-50%)',
                  width: 22,
                  height: 80,
                  pointerEvents: 'none',
                  '@keyframes fallFlow': {
                    '0%': {
                      transform: 'translateX(-50%) translateY(-10%)',
                    },
                    '100%': {
                      transform: 'translateX(-50%) translateY(10%)',
                    },
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to bottom, rgba(33,150,243,0.0), rgba(33,150,243,0.9))',
                    borderRadius: '12px',
                    opacity: isActive ? 0.3 + 0.7 * intensity : 0,
                    animation: isActive
                      ? 'fallFlow 0.45s linear infinite alternate'
                      : 'none',
                  },
                }}
              />
            );
          })}

          {/* Reservatório */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 70,
              left: '15%',
              width: '70%',
              height: 200,
              borderRadius: 3,
              border: '3px solid',
              borderColor: 'grey.500',
              overflow: 'hidden',
              bgcolor: 'background.default',
              zIndex: 2,
            }}
          >
            {/* Água (nível interno) */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: `${fillPercent}%`,
                transition: 'height 0.25s linear',
                bgcolor: 'primary.main',
                opacity: 0.75,
              }}
            />

            {/* Comporta */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '42%',
                height: `${gateHeightPercent || 30}%`,
                bgcolor: gameState.isBroken ? 'error.dark' : 'grey.700',
                borderTop: '2px solid',
                borderColor: 'grey.300',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'common.white',
                fontSize: 12,
                textAlign: 'center',
              }}
            >
              {gameState.isBroken ? 'Comporta rompida' : 'Comporta'}
            </Box>
          </Box>

          {/* Jato de água ao romper (saindo pela comporta) */}
          {gameState.isBroken && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 70,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '22%',
                height: 90,
                borderRadius: '0 0 24px 24px',
                background:
                  'linear-gradient(to bottom, rgba(33,150,243,0.4), rgba(33,150,243,0.9))',
                '@keyframes jetPulse': {
                  '0%': {
                    opacity: 0.7,
                    transform: 'translateX(-50%) scaleY(0.9)',
                  },
                  '100%': {
                    opacity: 1,
                    transform: 'translateX(-50%) scaleY(1.05)',
                  },
                },
                animation: 'jetPulse 0.7s ease-in-out infinite alternate',
              }}
            />
          )}

          {/* Pessoas abaixo da comporta */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 2,
              alignItems: 'flex-end',
              zIndex: 4,
            }}
          >
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.2,
                }}
              >
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    bgcolor: peopleDead ? 'grey.600' : 'success.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'common.white',
                    fontSize: 14,
                  }}
                >
                  {peopleDead ? '✕' : <PeopleAltIcon fontSize="small" />}
                </Box>
                <Typography variant="caption">
                  {peopleDead ? 'Morto' : 'Seguro'}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Barra de preenchimento geral */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Altura da água no reservatório
          </Typography>
          <LinearProgress
            variant="determinate"
            value={fillPercent}
            sx={{ height: 10, borderRadius: 5 }}
          />
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            h = <strong>{gameState.waterHeight.toFixed(2)} m</strong> /{' '}
            {levelConfig.reservoirHeightMax} m (altura máxima de projeto)
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Painel à direita: comporta, pressão, risco e configuração da comporta
// -----------------------------------------------------------------------------
function GateAndStatsPanel({
  gate,
  indicators,
  levelConfig,
  gameState,
  onGateFieldChange,
  onGateMaterialChange,
}) {
  const material = GATE_MATERIALS.find((m) => m.id === gate.materialId);

  const riskColorMap = {
    default: 'default',
    success: 'success',
    info: 'info',
    warning: 'warning',
    error: 'error',
  };

  const riskChipColor = riskColorMap[indicators.riskColor] || 'default';

  const pressurePercent =
    indicators.maxPressure_kPa > 0
      ? Math.min(
          130,
          (indicators.bottomPressure_kPa / indicators.maxPressure_kPa) * 100
        )
      : 0;

  const utilizationPercent = Math.min(130, indicators.utilization * 100);

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
        title="Comporta & pressões"
        subheader="Avalie a pressão, a força hidrostática e o risco de ruptura."
      />
      <CardContent sx={{ flex: 1, overflowY: 'auto' }}>
        <Stack spacing={2}>
          {/* Pressão no fundo */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Pressão hidrostática no fundo
            </Typography>
            <Typography variant="h6">
              {indicators.bottomPressure_kPa.toFixed(1)} kPa
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pressão de projeto (~ h máx):{' '}
              {indicators.maxPressure_kPa.toFixed(1)} kPa
            </Typography>
            <LinearProgress
              variant="determinate"
              value={pressurePercent}
              sx={{ mt: 1, height: 10, borderRadius: 5 }}
            />
          </Box>

          {/* Força na comporta */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Força hidrostática na comporta
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6">
                {indicators.F_h_kN.toFixed(1)} kN
              </Typography>
              <Typography variant="body2" color="text.secondary">
                (limite de projeto: {indicators.limitForce_kN.toFixed(1)} kN
                {indicators.effectiveLimitForce_kN &&
                indicators.effectiveLimitForce_kN !==
                  indicators.limitForce_kN
                  ? ` | limite efetivo: ${indicators.effectiveLimitForce_kN.toFixed(
                      1
                    )} kN`
                  : ''}
                )
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={utilizationPercent}
              sx={{
                mt: 1,
                height: 10,
                borderRadius: 5,
              }}
            />
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mt: 1 }}
            >
              <Chip
                icon={<WarningAmberIcon />}
                label={indicators.riskLabel}
                color={riskChipColor}
                variant="outlined"
                size="small"
              />
              {gameState.isBroken && (
                <Chip
                  label="Comporta rompida"
                  color="error"
                  size="small"
                  variant="filled"
                />
              )}
              {!gameState.peopleAlive && (
                <Chip
                  label="Pessoas atingidas"
                  color="error"
                  size="small"
                  variant="filled"
                />
              )}
            </Stack>
          </Box>

          <Divider />

          {/* Configuração da comporta */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Dimensionamento da comporta
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Agora seu principal controle é a comporta: ajuste material,
              espessura, dimensões e limite de força para resistir às variações
              de vazão e aos eventos extremos.
            </Typography>

            <Stack spacing={1.5}>
              <TextField
                select
                label="Material"
                size="small"
                value={gate.materialId}
                onChange={(e) => onGateMaterialChange(e.target.value)}
                fullWidth
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
                  {material.suggestedLimit} kN)
                </Typography>
              )}

              <Stack direction="row" spacing={1}>
                <TextField
                  label="Espessura (m)"
                  size="small"
                  value={gate.thickness}
                  onChange={(e) =>
                    onGateFieldChange('thickness', e.target.value)
                  }
                  sx={{ flex: 1 }}
                  inputProps={{ inputMode: 'decimal' }}
                />
                <TextField
                  label="Altura (m)"
                  size="small"
                  value={gate.height}
                  onChange={(e) => onGateFieldChange('height', e.target.value)}
                  sx={{ flex: 1 }}
                  inputProps={{ inputMode: 'decimal' }}
                />
              </Stack>

              <Stack direction="row" spacing={1}>
                <TextField
                  label="Largura (m)"
                  size="small"
                  value={gate.width}
                  onChange={(e) => onGateFieldChange('width', e.target.value)}
                  sx={{ flex: 1 }}
                  inputProps={{ inputMode: 'decimal' }}
                />
                <TextField
                  label="Limite de força (kN)"
                  size="small"
                  value={gate.limitForce}
                  onChange={(e) =>
                    onGateFieldChange('limitForce', e.target.value)
                  }
                  sx={{ flex: 1 }}
                  inputProps={{ inputMode: 'decimal' }}
                />
              </Stack>

              <Typography variant="body2">
                Área da comporta:{' '}
                <strong>{indicators.gateArea.toFixed(2)} m²</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Conceito chave: para uma comporta vertical apoiada no fundo, a
                força hidrostática cresce com o quadrado da altura da coluna
                d&apos;água sobre a base (F ∝ h²). Eventos de chuva extrema e
                redução de resistência deixam o dimensionamento ainda mais
                desafiador.
              </Typography>
            </Stack>
          </Box>

          <Divider />

          {/* Resumo final */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Resumo rápido
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                • Altura da água: {gameState.waterHeight.toFixed(2)} m
              </Typography>
              <Typography variant="body2">
                • Tempo de simulação: {gameState.timeElapsed.toFixed(1)} s de{' '}
                {levelConfig.targetTime}s alvo
              </Typography>
              <Typography variant="body2">
                • Situação das pessoas:{' '}
                <strong>
                  {gameState.peopleAlive ? 'Seguras' : 'Atingidas pela água'}
                </strong>
              </Typography>
              <Typography variant="body2">
                • Pico de força registrado:{' '}
                {gameState.maxForceExperienced.toFixed(1)} kN
              </Typography>
              <Typography variant="body2">
                • Tempo próximo do limite (&gt; 90%):{' '}
                {gameState.nearFailureTime.toFixed(1)} s
              </Typography>
              <Typography variant="body2">
                • Ações de emergência usadas:{' '}
                {gameState.emergencyActionsUsed}
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: 'block' }}
            >
              Objetivos extras: (1) sobreviver ao tempo alvo, (2) manter a
              força máxima entre ~60% e 95% do limite e (3) usar poucas ou
              nenhuma ação emergencial para maximizar a pontuação.
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
