'use client';

import React, { useState } from 'react';
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
  Tooltip,
  IconButton,
  Divider,
} from '@mui/material';
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

// Base de dados de materiais com propriedades dependentes da temperatura
const MATERIALS_DATABASE = {
  agua: {
    name: 'Água',
    color: '#2196F3',
    category: 'Líquido',
    density: (T) => 1000 - 0.3 * (T - 20), // kg/m³
    specificHeat: (T) => 4180 + 0.5 * (T - 20), // J/kg·K
    thermalConductivity: (T) => 0.6 + 0.002 * (T - 20), // W/m·K
    viscosity: (T) => 1e-3 * Math.exp(-0.03 * (T - 20)), // Pa·s
    description: 'Fluido universal para transferência de calor',
  },
  aco: {
    name: 'Aço Carbono',
    color: '#424242',
    category: 'Metal',
    density: (T) => 7850 - 0.4 * (T - 20),
    specificHeat: (T) => 460 + 0.3 * (T - 20),
    thermalConductivity: (T) => 50 - 0.02 * (T - 20),
    viscosity: () => null, // Sólido
    description: 'Material estrutural comum na engenharia',
  },
  aluminio: {
    name: 'Alumínio',
    color: '#90A4AE',
    category: 'Metal',
    density: (T) => 2700 - 0.6 * (T - 20),
    specificHeat: (T) => 900 + 0.2 * (T - 20),
    thermalConductivity: (T) => 237 - 0.1 * (T - 20),
    viscosity: () => null,
    description: 'Excelente condutor térmico, leve',
  },
  cobre: {
    name: 'Cobre',
    color: '#FF7043',
    category: 'Metal',
    density: (T) => 8960 - 0.5 * (T - 20),
    specificHeat: (T) => 385 + 0.1 * (T - 20),
    thermalConductivity: (T) => 401 - 0.2 * (T - 20),
    viscosity: () => null,
    description: 'Melhor condutor térmico metálico',
  },
  vidro: {
    name: 'Vidro',
    color: '#4FC3F7',
    category: 'Cerâmico',
    density: (T) => 2500 - 0.1 * (T - 20),
    specificHeat: (T) => 840 + 0.4 * (T - 20),
    thermalConductivity: (T) => 1.4 - 0.001 * (T - 20),
    viscosity: () => null,
    description: 'Material transparente, isolante térmico',
  },
  poliestireno: {
    name: 'Poliestireno',
    color: '#FFF59D',
    category: 'Polímero',
    density: (T) => 1050 - 0.8 * (T - 20),
    specificHeat: (T) => 1300 + 2 * (T - 20),
    thermalConductivity: (T) => 0.15 - 0.0005 * (T - 20),
    viscosity: () => null,
    description: 'Excelente isolante térmico',
  },
  ar: {
    name: 'Ar',
    color: '#E1F5FE',
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

// normalização para o radar (0–100)
function normalizeValue(prop, raw) {
  if (raw == null || !isFinite(raw)) return 0;
  switch (prop) {
    case 'density':             return Math.min(raw / 100, 100);
    case 'specificHeat':        return Math.min(raw / 50, 100);
    case 'thermalConductivity': return Math.min(raw * 2, 100);
    default: return 0;
  }
}

export default function MaterialPropertiesLab() {
  const [temperature, setTemperature] = useState(25);
  const [selectedMaterials, setSelectedMaterials] = useState(['agua', 'aco', 'aluminio']);
  const [selectedProperty, setSelectedProperty] = useState('thermalConductivity');
  const [showComparison, setShowComparison] = useState(true);
  const [temperatureRange, setTemperatureRange] = useState([0, 100]);

  // Dados para o gráfico de linha
  const generateChartData = () => {
    const data = [];
    for (let T = temperatureRange[0]; T <= temperatureRange[1]; T += 5) {
      const point = { temperature: T };
      selectedMaterials.forEach(materialKey => {
        const material = MATERIALS_DATABASE[materialKey];
        const value = material[selectedProperty](T);
        if (value !== null) point[material.name] = Number(value.toFixed(3));
      });
      data.push(point);
    }
    return data;
  };

  // Dados para o RadarChart (um array com subjects e colunas por material)
  const radarSubjects = [
    { subject: 'Densidade', prop: 'density' },
    { subject: 'Calor Específico', prop: 'specificHeat' },
    { subject: 'Condutividade Térmica', prop: 'thermalConductivity' },
  ];

  const generateRadarChartData = () => {
    return radarSubjects.map(({ subject, prop }) => {
      const row = { subject };
      selectedMaterials.forEach(materialKey => {
        const material = MATERIALS_DATABASE[materialKey];
        const raw = material[prop](temperature);
        row[material.name] = normalizeValue(prop, raw);
      });
      return row;
    });
  };

  const handleMaterialToggle = (materialKey) => {
    setSelectedMaterials(prev =>
      prev.includes(materialKey)
        ? prev.filter(m => m !== materialKey)
        : [...prev, materialKey]
    );
  };

  const chartData = generateChartData();
  const radarChartData = generateRadarChartData();

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
        gap: 3
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
            fontWeight: 'bold'
          }}
        >
          <Science sx={{ fontSize: 48, mr: 2, verticalAlign: 'middle', color: '#FF6B6B' }} />
          Laboratório de Propriedades dos Materiais
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Explore como as propriedades dos materiais variam com a temperatura
        </Typography>
      </Box>

      {/* Layout principal: sidebar à esquerda + área de gráficos à direita */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', gap: 3 }}>
        {/* Sidebar (controles, seleção, tabela, descrições) */}
        <Box sx={{ width: { xs: '100%', md: 360, lg: 380 }, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0 }}>
          {/* Controles */}
          <Card>
            <CardContent>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12}>
                  <Typography gutterBottom>Temperatura: {temperature}°C</Typography>
                  <Slider
                    value={temperature}
                    onChange={(_, value) => setTemperature(value)}
                    min={-20}
                    max={200}
                    step={1}
                    marks={[
                      { value: 0, label: '0°C' },
                      { value: 100, label: '100°C' },
                      { value: 200, label: '200°C' }
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
                      <Switch
                        checked={showComparison}
                        onChange={(e) => setShowComparison(e.target.checked)}
                      />
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
                    onChange={(_, value) => setTemperatureRange(value)}
                    min={-20}
                    max={300}
                    step={10}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}°C`}
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
                {Object.entries(MATERIALS_DATABASE).map(([key, material]) => (
                  <Chip
                    key={key}
                    label={material.name}
                    onClick={() => handleMaterialToggle(key)}
                    color={selectedMaterials.includes(key) ? 'primary' : 'default'}
                    variant={selectedMaterials.includes(key) ? 'filled' : 'outlined'}
                    sx={{
                      backgroundColor: selectedMaterials.includes(key) ? material.color : 'transparent',
                      color: selectedMaterials.includes(key) ? 'white' : 'inherit',
                      fontWeight: selectedMaterials.includes(key) ? 'bold' : 'normal'
                    }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>

          {/* Tabela de Propriedades */}
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
                        <Typography variant="caption">
                          ({PROPERTY_UNITS[selectedProperty]})
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedMaterials.map(materialKey => {
                      const material = MATERIALS_DATABASE[materialKey];
                      const value = material[selectedProperty](temperature);
                      return (
                        <TableRow key={materialKey}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Box
                                sx={{
                                  width: 16,
                                  height: 16,
                                  backgroundColor: material.color,
                                  borderRadius: '50%',
                                  mr: 1
                                }}
                              />
                              {material.name}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={material.category} />
                          </TableCell>
                          <TableCell align="right">
                            {value !== null ? value.toFixed(3) : 'N/A'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Descrições dos Materiais */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Info sx={{ mr: 1, verticalAlign: 'middle' }} />
                Informações dos Materiais
              </Typography>
              {selectedMaterials.map(materialKey => {
                const material = MATERIALS_DATABASE[materialKey];
                return (
                  <Box key={materialKey} sx={{ mb: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: material.color }}>
                      {material.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {material.description}
                    </Typography>
                    <Chip size="small" label={material.category} sx={{ mt: 1 }} />
                  </Box>
                );
              })}
            </CardContent>
          </Card>
        </Box>

        {/* Área de gráficos (direita) */}
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Gráfico de Variação com Temperatura */}
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
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="temperature"
                      label={{ value: 'Temperatura (°C)', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                      label={{
                        value: `${PROPERTY_LABELS[selectedProperty]} (${PROPERTY_UNITS[selectedProperty]})`,
                        angle: -90,
                        position: 'insideLeft'
                      }}
                    />
                    <RechartsTooltip />
                    <Legend />
                    {selectedMaterials.map(materialKey => {
                      const material = MATERIALS_DATABASE[materialKey];
                      return (
                        <Line
                          key={materialKey}
                          type="monotone"
                          dataKey={material.name}
                          stroke={material.color}
                          strokeWidth={3}
                          dot={{ fill: material.color, strokeWidth: 2, r: 3 }}
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          {/* Radar Chart para Comparação */}
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
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      {selectedMaterials.map((materialKey) => {
                        const m = MATERIALS_DATABASE[materialKey];
                        return (
                          <Radar
                            key={materialKey}
                            name={m.name}
                            dataKey={m.name}      // <- cada coluna é um material
                            stroke={m.color}
                            fill={m.color}
                            fillOpacity={0.1}
                            strokeWidth={2}
                            isAnimationActive={false}
                          />
                        );
                      })}
                      <Legend />
                      <RechartsTooltip />
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
