'use client';

import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { Info, Compare, Science } from '@mui/icons-material';

// ---------- Base de dados (funções de propriedades) ----------
const MATERIALS_DATABASE = {
  agua: {
    name: 'Água',
    category: 'Líquido',
    density: (T) => 1000 - 0.3 * (T - 20), // kg/m³
    specificHeat: (T) => 4180 + 0.5 * (T - 20), // J/kg·K
    thermalConductivity: (T) => 0.6 + 0.002 * (T - 20), // W/m·K
    viscosity: (T) => 1e-3 * Math.exp(-0.03 * (T - 20)), // Pa·s
    description: 'Fluido universal para transferência de calor',
  },
  aco: {
    name: 'Aço Carbono',
    category: 'Metal',
    density: (T) => 7850 - 0.4 * (T - 20),
    specificHeat: (T) => 460 + 0.3 * (T - 20),
    thermalConductivity: (T) => 50 - 0.02 * (T - 20),
    viscosity: () => null,
    description: 'Material estrutural comum na engenharia',
  },
  aluminio: {
    name: 'Alumínio',
    category: 'Metal',
    density: (T) => 2700 - 0.6 * (T - 20),
    specificHeat: (T) => 900 + 0.2 * (T - 20),
    thermalConductivity: (T) => 237 - 0.1 * (T - 20),
    viscosity: () => null,
    description: 'Excelente condutor térmico, leve',
  },
  cobre: {
    name: 'Cobre',
    category: 'Metal',
    density: (T) => 8960 - 0.5 * (T - 20),
    specificHeat: (T) => 385 + 0.1 * (T - 20),
    thermalConductivity: (T) => 401 - 0.2 * (T - 20),
    viscosity: () => null,
    description: 'Melhor condutor térmico metálico',
  },
  vidro: {
    name: 'Vidro',
    category: 'Cerâmico',
    density: (T) => 2500 - 0.1 * (T - 20),
    specificHeat: (T) => 840 + 0.4 * (T - 20),
    thermalConductivity: (T) => 1.4 - 0.001 * (T - 20),
    viscosity: () => null,
    description: 'Material transparente, isolante térmico',
  },
  poliestireno: {
    name: 'Poliestireno',
    category: 'Polímero',
    density: (T) => 1050 - 0.8 * (T - 20),
    specificHeat: (T) => 1300 + 2 * (T - 20),
    thermalConductivity: (T) => 0.15 - 0.0005 * (T - 20),
    viscosity: () => null,
    description: 'Excelente isolante térmico',
  },
  ar: {
    name: 'Ar',
    category: 'Gás',
    density: (T) => 1.225 * (293 / (T + 273)),
    specificHeat: (T) => 1005 + 0.01 * (T - 20),
    thermalConductivity: (T) => 0.026 + 0.00008 * (T - 20),
    viscosity: (T) => 1.8e-5 * Math.pow((T + 273) / 293, 0.7),
    description: 'Fluido de trabalho comum em convecção',
  },
};

const PROPERTY_UNITS = {
  density: 'kg/m³',
  specificHeat: 'J/kg·K',
  thermalConductivity: 'W/m·K',
  viscosity: 'Pa·s',
};

const PROPERTY_LABELS = {
  density: 'Densidade',
  specificHeat: 'Calor Específico',
  thermalConductivity: 'Condutividade Térmica',
  viscosity: 'Viscosidade',
};

// ---------- Normalização para o radar (0–100) ----------
function normalizeValue(prop, raw) {
  if (raw == null || !isFinite(raw)) return 0;
  switch (prop) {
    case 'density':             return Math.min(raw / 100, 100);
    case 'specificHeat':        return Math.min(raw / 50, 100);
    case 'thermalConductivity': return Math.min(raw * 2, 100);
    default: return 0;
  }
}

// ---------- Cores sensíveis ao tema e alto contraste ----------
function useMaterialColors() {
  const theme = useTheme();
  const mode = theme.palette.mode;

  // Cores escolhidas para forte contraste no dark e boa distinção no light.
  const paletteLight = {
    agua: theme.palette.primary.main,     // azul forte
    aco: '#424242',                       // cinza escuro
    aluminio: '#546E7A',                  // blueGrey 700
    cobre: '#E64A19',                     // deep orange 800
    vidro: '#00695C',                     // teal 800
    poliestireno: '#F9A825',              // yellow 700
    ar: '#1976D2',                        // blue 700
  };

  const paletteDark = {
    agua: '#4FC3F7',          // light blue 300
    aco: '#EEEEEE',           // quase branco (sai do "cinza morto")
    aluminio: '#FFCA28',      // amber 400 (troca do cinza por tom quente legível)
    cobre: '#FF8A65',         // deep orange 300
    vidro: '#80CBC4',         // teal 200
    poliestireno: '#FFEE58',  // yellow 400
    ar: '#64B5F6',            // light blue 300 (diferente de água)
  };

  return mode === 'dark' ? paletteDark : paletteLight;
}

// tracejados por série ajudam quando as cores ficam parecidas
const SERIES_DASH = ['0', '6 4', '4 4', '12 6', '2 6', '8 4'];

// ---------- Componente ----------
export default function MaterialPropertiesLab() {
  const theme = useTheme();
  const materialColors = useMaterialColors();

  const [temperature, setTemperature] = useState(25);
  const [selectedMaterials, setSelectedMaterials] = useState(['agua', 'aco', 'aluminio']);
  const [selectedProperty, setSelectedProperty] = useState('thermalConductivity');
  const [showComparison, setShowComparison] = useState(true);
  const [temperatureRange, setTemperatureRange] = useState([0, 100]);

  // Dados para o gráfico de linha
  const chartData = useMemo(() => {
    const data = [];
    for (let T = temperatureRange[0]; T <= temperatureRange[1]; T += 5) {
      const point = { temperature: T };
      selectedMaterials.forEach((key) => {
        const m = MATERIALS_DATABASE[key];
        const v = m[selectedProperty](T);
        if (v != null) point[m.name] = Number(v.toFixed(3));
      });
      data.push(point);
    }
    return data;
  }, [selectedMaterials, selectedProperty, temperatureRange]);

  // Dados para o radar
  const radarSubjects = [
    { subject: 'Densidade', prop: 'density' },
    { subject: 'Calor Específico', prop: 'specificHeat' },
    { subject: 'Condutividade Térmica', prop: 'thermalConductivity' },
  ];
  const radarChartData = useMemo(() => {
    return radarSubjects.map(({ subject, prop }) => {
      const row = { subject };
      selectedMaterials.forEach((key) => {
        const m = MATERIALS_DATABASE[key];
        row[m.name] = normalizeValue(prop, m[prop](temperature));
      });
      return row;
    });
  }, [selectedMaterials, temperature]);

  const handleMaterialToggle = (materialKey) => {
    setSelectedMaterials((prev) =>
      prev.includes(materialKey) ? prev.filter((m) => m !== materialKey) : [...prev, materialKey]
    );
  };

  // estilos universais para contraste no gráfico
  const gridStroke = alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.15 : 0.1);
  const axisStroke = alpha(theme.palette.text.primary, 0.8);
  const tickStyle = { fill: theme.palette.text.primary, fontSize: 12 };
  const legendStyle = { color: theme.palette.text.primary };

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3 },
        py: 4,
        minHeight: '100dvh',
        maxWidth: '100%',
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      {/* Header */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography
          variant="h3"
          gutterBottom
          sx={{
            background: 'linear-gradient(45deg, #FF6B6B, #4ECDC4)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            fontWeight: 'bold',
          }}
        >
          <Science sx={{ fontSize: 48, mr: 2, verticalAlign: 'middle', color: '#FF6B6B' }} />
          Laboratório de Propriedades dos Materiais
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Explore como as propriedades dos materiais variam com a temperatura
        </Typography>
      </Box>

      {/* Layout principal */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', gap: 3 }}>
        {/* Sidebar */}
        <Box
          sx={{
            width: { xs: '100%', md: 360, lg: 380 },
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            minHeight: 0,
          }}
        >
          {/* Controles */}
          <Card>
            <CardContent>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12}>
                  <Typography gutterBottom>Temperatura: {temperature}°C</Typography>
                  <Slider
                    value={temperature}
                    onChange={(_, v) => setTemperature(v)}
                    min={-20}
                    max={200}
                    step={1}
                    marks={[
                      { value: 0, label: '0°C' },
                      { value: 100, label: '100°C' },
                      { value: 200, label: '200°C' },
                    ]}
                  />
                </Grid>

                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Propriedade</InputLabel>
                    <Select
                      value={selectedProperty}
                      label="Propriedade"
                      onChange={(e) => setSelectedProperty(e.target.value)}
                    >
                      <MenuItem value="density">Densidade</MenuItem>
                      <MenuItem value="specificHeat">Calor Específico</MenuItem>
                      <MenuItem value="thermalConductivity">Condutividade Térmica</MenuItem>
                      <MenuItem value="viscosity">Viscosidade</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch checked={showComparison} onChange={(e) => setShowComparison(e.target.checked)} />
                    }
                    label="Modo Comparação"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Faixa de Temperatura para Gráficos
                  </Typography>
                  <Slider
                    value={temperatureRange}
                    onChange={(_, v) => setTemperatureRange(v)}
                    min={-20}
                    max={200}
                    step={10}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => `${v}°C`}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Seleção de Materiais */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Compare sx={{ mr: 1, verticalAlign: 'middle' }} />
                Selecione os Materiais
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(MATERIALS_DATABASE).map(([key, material], idx) => {
                  const bg = materialColors[key];
                  const text = theme.palette.getContrastText(bg);
                  const selected = selectedMaterials.includes(key);
                  return (
                    <Chip
                      key={key}
                      label={material.name}
                      onClick={() => handleMaterialToggle(key)}
                      variant={selected ? 'filled' : 'outlined'}
                      sx={{
                        backgroundColor: selected ? bg : 'transparent',
                        color: selected ? text : bg,
                        borderColor: bg,
                        fontWeight: selected ? 700 : 600,
                      }}
                    />
                  );
                })}
              </Box>
            </CardContent>
          </Card>

          {/* Tabela */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Propriedades a {temperature}°C
              </Typography>
              <TableContainer component={Paper} elevation={0}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Material</TableCell>
                      <TableCell>Categoria</TableCell>
                      <TableCell align="right">
                        {PROPERTY_LABELS[selectedProperty]}
                        <br />
                        <Typography variant="caption">({PROPERTY_UNITS[selectedProperty]})</Typography>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedMaterials.map((key) => {
                      const m = MATERIALS_DATABASE[key];
                      const value = m[selectedProperty](temperature);
                      const color = materialColors[key];
                      return (
                        <TableRow key={key}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Box
                                sx={{
                                  width: 16,
                                  height: 16,
                                  backgroundColor: color,
                                  borderRadius: '50%',
                                  boxShadow: `0 0 0 2px ${theme.palette.background.paper} inset`,
                                  mr: 1,
                                }}
                              />
                              {m.name}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={m.category} />
                          </TableCell>
                          <TableCell align="right">{value != null ? value.toFixed(3) : 'N/A'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Descrições */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Info sx={{ mr: 1, verticalAlign: 'middle' }} />
                Informações dos Materiais
              </Typography>
              {selectedMaterials.map((key) => {
                const m = MATERIALS_DATABASE[key];
                const color = materialColors[key];
                return (
                  <Box key={key} sx={{ mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color }}>
                      {m.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {m.description}
                    </Typography>
                    <Chip size="small" label={m.category} sx={{ mt: 1 }} />
                  </Box>
                );
              })}
            </CardContent>
          </Card>
        </Box>

        {/* ÁREA DE GRÁFICOS */}
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Linha */}
          <Card sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <CardHeader
              title={`${PROPERTY_LABELS[selectedProperty]} vs Temperatura`}
              subheader={`Faixa ${temperatureRange[0]}–${temperatureRange[1]} °C`}
              titleTypographyProps={{ align: 'left' }}
              subheaderTypographyProps={{ align: 'left' }}
            />
            <CardContent sx={{ flex: 1, minHeight: 0, p: 0 }}>
              <Box sx={{ width: '100%', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke={gridStroke} />
                    <XAxis
                      dataKey="temperature"
                      tick={tickStyle}
                      axisLine={{ stroke: axisStroke }}
                      tickLine={{ stroke: axisStroke }}
                      label={{ value: 'Temperatura (°C)', position: 'insideBottom', offset: -5, fill: theme.palette.text.primary }}
                    />
                    <YAxis
                      tick={tickStyle}
                      axisLine={{ stroke: axisStroke }}
                      tickLine={{ stroke: axisStroke }}
                      label={{
                        value: `${PROPERTY_LABELS[selectedProperty]} (${PROPERTY_UNITS[selectedProperty]})`,
                        angle: -90,
                        position: 'insideLeft',
                        fill: theme.palette.text.primary,
                      }}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                        color: theme.palette.text.primary,
                      }}
                      itemStyle={{ color: theme.palette.text.primary }}
                      labelStyle={{ color: theme.palette.text.secondary }}
                    />
                    <Legend wrapperStyle={legendStyle} />
                    {selectedMaterials.map((key, i) => {
                      const m = MATERIALS_DATABASE[key];
                      const stroke = materialColors[key];
                      return (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={m.name}
                          stroke={stroke}
                          strokeWidth={3}
                          dot={{
                            r: 4,
                            strokeWidth: 2,
                            stroke,
                            fill: theme.palette.background.paper,
                          }}
                          activeDot={{ r: 6 }}
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          {/* Radar */}
          {showComparison && (
            <Card sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <CardHeader
                title={`Comparação Multidimensional a ${temperature}°C`}
                subheader="Escala normalizada (0–100)"
                titleTypographyProps={{ align: 'left' }}
                subheaderTypographyProps={{ align: 'left' }}
              />
              <CardContent sx={{ flex: 1, minHeight: 0, p: 0 }}>
                <Box sx={{ width: '100%', height: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarChartData}>
                      <PolarGrid stroke={gridStroke} />
                      <PolarAngleAxis dataKey="subject" tick={tickStyle} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={tickStyle} stroke={axisStroke} />
                      {selectedMaterials.map((key, i) => {
                        const m = MATERIALS_DATABASE[key];
                        const stroke = materialColors[key];
                        return (
                          <Radar
                            key={key}
                            name={m.name}
                            dataKey={m.name}
                            stroke={stroke}
                            fill={stroke}
                            fillOpacity={0.25}
                            strokeWidth={2}
                            isAnimationActive={false}
                          />
                        );
                      })}
                      <Legend wrapperStyle={legendStyle} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                          color: theme.palette.text.primary,
                        }}
                        itemStyle={{ color: theme.palette.text.primary }}
                        labelStyle={{ color: theme.palette.text.secondary }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      </Box>

      <Divider />
      <Typography variant="body2" color="text.secondary">
        Observações: Condução e convecção requerem meio material e gradientes de temperatura; a radiação é emitida pela matéria e
        se propaga sem necessidade de meio material (funciona inclusive no vácuo). Os modelos aqui mostrados são simplificados e
        úteis para visualização rápida.
      </Typography>
    </Box>
  );
}
