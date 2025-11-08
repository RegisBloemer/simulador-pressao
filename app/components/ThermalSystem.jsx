'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardHeader,
  CardContent,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  IconButton,
  Divider,
  Stack,
  Chip,
  Paper,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// -----------------------------------------------------------------------------
// Materiais mock (com Vidro adicionado)
// -----------------------------------------------------------------------------
const MATERIALS = [
  {
    id: 'concrete',
    name: 'Concreto',
    k: 1.7,
    defaultThickness: 0.15,
    description: 'Concreto comum para paredes/estruturas.',
  },
  {
    id: 'brick',
    name: 'Tijolo',
    k: 0.72,
    defaultThickness: 0.12,
    description: 'Tijolo cerâmico maciço.',
  },
  {
    id: 'eps',
    name: 'Isolante EPS',
    k: 0.035,
    defaultThickness: 0.05,
    description: 'Isolamento térmico de poliestireno expandido.',
  },
  {
    id: 'glasswool',
    name: 'Lã de vidro',
    k: 0.04,
    defaultThickness: 0.05,
    description: 'Isolante de lã de vidro.',
  },
  {
    id: 'gypsum',
    name: 'Gesso acartonado',
    k: 0.25,
    defaultThickness: 0.015,
    description: 'Revestimento interno de gesso.',
  },
  {
    id: 'glass',
    name: 'Vidro',
    k: 1.0,
    defaultThickness: 0.006, // 6 mm
    description: 'Vidro comum para janelas.',
  },
];

// -----------------------------------------------------------------------------
// Página principal – encaixa direto na aba ThermalSystem
// -----------------------------------------------------------------------------
function ThermalSystemPage() {
  const materialsMap = useMemo(() => {
    const map = {};
    MATERIALS.forEach((m) => {
      map[m.id] = m;
    });
    return map;
  }, []);

  const [composition, setComposition] = useState([]);
  const [contactResistances, setContactResistances] = useState({});
  const [convExt, setConvExt] = useState({ enabled: true, h: '25' });
  const [convInt, setConvInt] = useState({ enabled: true, h: '10' });

  // Estado para DragOverlay
  const [activeDrag, setActiveDrag] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ---------------- Drag & Drop ----------------
  const handleDragStart = (event) => {
    const data = event.active.data?.current;
    if (!data) return;

    if (data.from === 'catalog') {
      setActiveDrag({
        type: 'material',
        materialId: data.materialId,
      });
    } else if (data.from === 'composition') {
      setActiveDrag({
        type: 'layer',
        layerId: data.layerId,
      });
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDrag(null);

    if (!over) return;

    const activeFrom = active.data?.current?.from;
    const overFrom = over.data?.current?.from;
    const isOverContainer = over.id === 'composition-container';
    const isOverLayer = overFrom === 'composition';

    // Reordenar dentro da composição
    if (activeFrom === 'composition' && overFrom === 'composition') {
      if (active.id === over.id) return;

      setComposition((prev) => {
        const oldIndex = prev.findIndex((l) => l.instanceId === active.id);
        let newIndex = prev.findIndex((l) => l.instanceId === over.id);
        if (oldIndex === -1) return prev;
        if (newIndex === -1) newIndex = prev.length - 1;
        return arrayMove(prev, oldIndex, newIndex);
      });
      return;
    }

    // Arrastar do catálogo para a composição
    if (activeFrom === 'catalog') {
      if (!isOverContainer && !isOverLayer) {
        // soltou em lugar que não é composição -> ignora
        return;
      }

      const materialId = active.data?.current?.materialId;
      const material = materialsMap[materialId];
      if (!material) return;

      setComposition((prev) => {
        const newLayer = {
          instanceId: `layer-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
          materialId,
          thickness: material.defaultThickness.toString(),
        };

        let insertIndex = prev.length;
        if (isOverLayer) {
          const idx = prev.findIndex((l) => l.instanceId === over.id);
          insertIndex = idx === -1 ? prev.length : idx;
        }

        const newComp = [...prev];
        newComp.splice(insertIndex, 0, newLayer);
        return newComp;
      });
    }
  };

  const handleDragCancel = () => {
    setActiveDrag(null);
  };

  // ---------------- Camadas ----------------
  const handleThicknessChange = (layerId, value) => {
    setComposition((prev) =>
      prev.map((layer) =>
        layer.instanceId === layerId ? { ...layer, thickness: value } : layer
      )
    );
  };

  const handleRemoveLayer = (layerId) => {
    setComposition((prev) => prev.filter((layer) => layer.instanceId !== layerId));
    setContactResistances((prev) => {
      const newMap = {};
      Object.entries(prev).forEach(([key, val]) => {
        if (!key.includes(layerId)) {
          newMap[key] = val;
        }
      });
      return newMap;
    });
  };

  // ---------------- Contato ----------------
  const handleContactToggle = (contactKey, enabled) => {
    setContactResistances((prev) => ({
      ...prev,
      [contactKey]: {
        enabled,
        rValue: prev[contactKey]?.rValue ?? '0.01',
      },
    }));
  };

  const handleContactValueChange = (contactKey, value) => {
    setContactResistances((prev) => ({
      ...prev,
      [contactKey]: {
        enabled: prev[contactKey]?.enabled ?? true,
        rValue: value,
      },
    }));
  };

  // ---------------- Convecção ----------------
  const handleConvChange = (side, field, value) => {
    if (side === 'ext') {
      setConvExt((prev) => ({ ...prev, [field]: value }));
    } else {
      setConvInt((prev) => ({ ...prev, [field]: value }));
    }
  };

  // ---------------- Cálculo de R_total ----------------
  const { totalFormatted, details, breakdownExpression } = useMemo(() => {
    let total = 0;
    const items = [];

    const addItem = (label, value) => {
      const n = parseFloat(value);
      if (!Number.isFinite(n) || n <= 0) return;
      total += n;
      items.push({ label, value: n });
    };

    // Convecção externa
    if (convExt.enabled) {
      const h = parseFloat(convExt.h);
      if (Number.isFinite(h) && h > 0) {
        addItem('Convecção externa (ambiente → 1º material)', 1 / h);
      }
    }

    // Materiais + contato
    composition.forEach((layer, index) => {
      const mat = materialsMap[layer.materialId];
      if (!mat) return;
      const L = parseFloat(layer.thickness);
      const k = parseFloat(mat.k);
      if (Number.isFinite(L) && Number.isFinite(k) && L > 0 && k > 0) {
        addItem(`Material ${index + 1}: ${mat.name}`, L / k);
      }

      if (index < composition.length - 1) {
        const nextLayer = composition[index + 1];
        const contactKey = `${layer.instanceId}_${nextLayer.instanceId}`;
        const contact = contactResistances[contactKey];
        if (contact && contact.enabled) {
          addItem(`Resistência de contato ${index + 1}`, contact.rValue);
        }
      }
    });

    // Convecção interna
    if (convInt.enabled) {
      const h = parseFloat(convInt.h);
      if (Number.isFinite(h) && h > 0) {
        addItem('Convecção interna (último material → ambiente)', 1 / h);
      }
    }

    const totalFormatted = total.toFixed(4);
    const detailsFormatted = items.map((item) => ({
      ...item,
      valueFormatted: item.value.toFixed(4),
    }));

    const exprParts = detailsFormatted.map(
      (item) => `${item.label} (${item.valueFormatted})`
    );
    const breakdownExpression = detailsFormatted.length
      ? `R_total = ${exprParts.join(' + ')} = ${totalFormatted} m²·K/W`
      : 'Adicione materiais e parâmetros de convecção/contato para calcular R_total.';

    return { totalFormatted, details: detailsFormatted, breakdownExpression };
  }, [composition, contactResistances, convExt, convInt, materialsMap]);

  // ---------------- Layout ----------------
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
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
            Sistema Térmico em Série
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Monte o empilhamento de materiais, configure convecção e resistências de contato
            para obter a resistência térmica total (área = 1 m²).
          </Typography>
        </Box>

        {/* 
          Grid SEMPRE em uma linha (nowrap). 
          Se a tela ficar estreita, surge scroll horizontal,
          mas o card de resultados permanece sempre à direita.
        */}
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
          {/* Coluna esquerda: catálogo */}
          <Grid
            item
            xs={4}
            sx={{
              minWidth: 260,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <MaterialCatalog materials={MATERIALS} />
          </Grid>

          {/* Coluna central: composição */}
          <Grid
            item
            xs={4}
            sx={{
              minWidth: 320,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SystemBuilder
              composition={composition}
              materialsMap={materialsMap}
              convExt={convExt}
              convInt={convInt}
              contactResistances={contactResistances}
              onConvChange={handleConvChange}
              onThicknessChange={handleThicknessChange}
              onRemoveLayer={handleRemoveLayer}
              onContactToggle={handleContactToggle}
              onContactValueChange={handleContactValueChange}
            />
          </Grid>

          {/* Coluna direita: resultado */}
          <Grid
            item
            xs={4}
            sx={{
              minWidth: 280,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ResistanceSummary
              totalFormatted={totalFormatted}
              details={details}
              breakdownExpression={breakdownExpression}
            />
          </Grid>
        </Grid>
      </Box>

      {/* DragOverlay sempre por cima de tudo */}
      <DragOverlay dropAnimation={null}>
        {activeDrag?.type === 'material' && (
          <Box
            sx={{
              cursor: 'grabbing',
              maxWidth: 320,
            }}
          >
            <MaterialCard material={materialsMap[activeDrag.materialId]} />
          </Box>
        )}
        {activeDrag?.type === 'layer' && (() => {
          const layer = composition.find((l) => l.instanceId === activeDrag.layerId);
          if (!layer) return null;
          const material = materialsMap[layer.materialId];
          return (
            <Box
              sx={{
                cursor: 'grabbing',
                maxWidth: 500,
              }}
            >
              <MaterialLayerCard
                layer={layer}
                material={material}
                onThicknessChange={() => {}}
                onRemoveLayer={() => {}}
              />
            </Box>
          );
        })()}
      </DragOverlay>
    </DndContext>
  );
}

export default ThermalSystemPage;

// -----------------------------------------------------------------------------
// Catálogo de materiais (esquerda)
// -----------------------------------------------------------------------------
function MaterialCatalog({ materials }) {
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
        title="Materiais disponíveis"
        subheader="Arraste para a área de composição"
      />
      <CardContent sx={{ flex: 1, overflow: 'auto' }}>
        <Box>
          {materials.map((material) => (
            <CatalogDraggable key={material.id} material={material} />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

function CatalogDraggable({ material }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `catalog-${material.id}`,
    data: { from: 'catalog', materialId: material.id },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.2 : 1,                 // fantasma enquanto overlay aparece
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      sx={{ mb: 1.5 }}
    >
      <MaterialCard material={material} />
    </Box>
  );
}

function MaterialCard({ material }) {
  const Rdefault = material.defaultThickness / material.k;
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600}>
          {material.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {material.description}
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <InfoChip label={`k = ${material.k} W/m·K`} />
          <InfoChip label={`L = ${material.defaultThickness} m`} />
          <InfoChip label={`R ≈ ${Rdefault.toFixed(4)} m²·K/W`} />
        </Stack>
      </CardContent>
    </Card>
  );
}

function InfoChip({ label }) {
  return <Chip size="small" label={label} />;
}

// -----------------------------------------------------------------------------
// Área de composição (centro)
// -----------------------------------------------------------------------------
function SystemBuilder({
  composition,
  materialsMap,
  convExt,
  convInt,
  contactResistances,
  onConvChange,
  onThicknessChange,
  onRemoveLayer,
  onContactToggle,
  onContactValueChange,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'composition-container',
    data: { from: 'composition-container' },
  });

  const itemsIds = composition.map((layer) => layer.instanceId);

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
        title="Composição do sistema"
        subheader="Reordene os materiais e configure contatos e convecção"
      />
      <CardContent sx={{ flex: 1, minHeight: 0 }}>
        <Stack spacing={2} sx={{ height: '100%' }}>
          <ConvectionCard
            label="Convecção externa (ambiente → 1º material)"
            side="ext"
            config={convExt}
            onChange={onConvChange}
          />

          <Box
            ref={setNodeRef}
            sx={{
              flex: 1,
              minHeight: 120,
              borderRadius: 2,
              border: '1px dashed',
              borderColor: isOver ? 'primary.main' : 'divider',
              p: 2,
              bgcolor: isOver ? 'action.hover' : 'background.paper',
              transition: 'background-color 0.2s ease',
              overflowY: 'auto',
            }}
          >
            {composition.length === 0 && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: 'center' }}
              >
                Arraste materiais da lista à esquerda para iniciar o sistema.
              </Typography>
            )}

            <SortableContext
              items={itemsIds}
              strategy={verticalListSortingStrategy}
            >
              {composition.map((layer, index) => {
                const material = materialsMap[layer.materialId];
                const isLast = index === composition.length - 1;

                const nextLayer = !isLast ? composition[index + 1] : null;
                const contactKey = nextLayer
                  ? `${layer.instanceId}_${nextLayer.instanceId}`
                  : null;
                const contact = contactKey
                  ? contactResistances[contactKey] || {
                      enabled: false,
                      rValue: '0.01',
                    }
                  : null;

                return (
                  <React.Fragment key={layer.instanceId}>
                    <SortableLayer
                      layer={layer}
                      material={material}
                      onThicknessChange={onThicknessChange}
                      onRemoveLayer={onRemoveLayer}
                      isLast={isLast}
                    />
                    {!isLast && (
                      <ContactResistanceConnector
                        enabled={contact.enabled}
                        value={contact.rValue}
                        onToggle={(enabled) =>
                          onContactToggle(contactKey, enabled)
                        }
                        onChange={(value) =>
                          onContactValueChange(contactKey, value)
                        }
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </SortableContext>
          </Box>

          <ConvectionCard
            label="Convecção interna (último material → ambiente)"
            side="int"
            config={convInt}
            onChange={onConvChange}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}

// Camada sortable
function SortableLayer({
  layer,
  material,
  onThicknessChange,
  onRemoveLayer,
  isLast,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: layer.instanceId,
    data: { from: 'composition', layerId: layer.instanceId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.2 : 1, // real apagado, overlay por cima
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{ mb: isLast ? 0 : 1.5 }}
    >
      <MaterialLayerCard
        layer={layer}
        material={material}
        onThicknessChange={onThicknessChange}
        onRemoveLayer={onRemoveLayer}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </Box>
  );
}

// Card da camada
function MaterialLayerCard({
  layer,
  material,
  onThicknessChange,
  onRemoveLayer,
  dragHandleProps = {},
}) {
  if (!material) return null;

  const L = parseFloat(layer.thickness);
  const R = Number.isFinite(L) && material.k > 0 ? L / material.k : null;

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}
      {...dragHandleProps}
    >
      <Box sx={{ flexGrow: 1, minWidth: 200 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {material.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          k = {material.k} W/m·K
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
          <Chip
            size="small"
            label={
              R
                ? `R ≈ ${R.toFixed(4)} m²·K/W`
                : 'R indefinido (verifique k e L)'
            }
            color="primary"
            variant="outlined"
          />
        </Stack>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TextField
          label="Espessura L (m)"
          size="small"
          value={layer.thickness}
          onChange={(e) => onThicknessChange(layer.instanceId, e.target.value)}
          sx={{ width: 130 }}
          inputProps={{ inputMode: 'decimal' }}
        />
        <IconButton
          color="error"
          onClick={() => onRemoveLayer(layer.instanceId)}
          aria-label="Remover camada"
        >
          <DeleteIcon />
        </IconButton>
      </Box>
    </Paper>
  );
}

// Conector de resistência de contato – cor bem visível
function ContactResistanceConnector({ enabled, value, onToggle, onChange }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ my: 1 }}>
      <Box
        sx={{
          flexGrow: 1,
          borderBottom: '1px dashed',
          borderColor: enabled ? 'warning.main' : 'divider',
        }}
      />
      <Paper
        elevation={enabled ? 6 : 1}
        sx={{
          px: 2,
          py: 1,
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: enabled ? 'warning.light' : 'background.paper',
          border: enabled ? '1px solid' : '1px dashed',
          borderColor: enabled ? 'warning.dark' : 'divider',
        }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={enabled}
              onChange={(e) => onToggle(e.target.checked)}
              size="small"
              color="warning"
            />
          }
          label="Contato"
        />
        <TextField
          label="R_cont (m²·K/W)"
          size="small"
          value={value}
          disabled={!enabled}
          onChange={(e) => onChange(e.target.value)}
          sx={{ width: 140 }}
          inputProps={{ inputMode: 'decimal' }}
        />
      </Paper>
      <Box
        sx={{
          flexGrow: 1,
          borderBottom: '1px dashed',
          borderColor: enabled ? 'warning.main' : 'divider',
        }}
      />
    </Stack>
  );
}

// Card de convecção
function ConvectionCard({ label, side, config, onChange }) {
  const h = parseFloat(config.h);
  const R = Number.isFinite(h) && h > 0 ? 1 / h : null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 2,
      }}
    >
      <Box sx={{ flexGrow: 1, minWidth: 220 }}>
        <Typography variant="subtitle2" fontWeight={600}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          R_conv = 1 / h (área = 1 m²)
        </Typography>
      </Box>
      <FormControlLabel
        control={
          <Switch
            checked={config.enabled}
            onChange={(e) => onChange(side, 'enabled', e.target.checked)}
          />
        }
        label="Considerar convecção"
      />
      <TextField
        label="h (W/m²·K)"
        size="small"
        value={config.h}
        onChange={(e) => onChange(side, 'h', e.target.value)}
        disabled={!config.enabled}
        sx={{ width: 140 }}
        inputProps={{ inputMode: 'decimal' }}
      />
      <Chip
        size="small"
        color="primary"
        variant="outlined"
        label={
          R
            ? `R_conv ≈ ${R.toFixed(4)} m²·K/W`
            : 'R_conv indefinido (verifique h)'
        }
      />
    </Paper>
  );
}

// Resumo (coluna da direita)
function ResistanceSummary({ totalFormatted, details, breakdownExpression }) {
  return (
    <Card
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <CardHeader title="Resultados de resistência térmica" />
      <CardContent sx={{ flex: 1, overflowY: 'auto' }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              R_total = {totalFormatted} m²·K/W
            </Typography>
            <Typography variant="body2" color="text.secondary">
              (Considerando área de 1 m²)
            </Typography>
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Detalhamento por elemento
            </Typography>
            {details.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum elemento considerado ainda.
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {details.map((item, idx) => (
                  <Typography key={idx} variant="body2">
                    • {item.label}: R = {item.valueFormatted} m²·K/W
                  </Typography>
                ))}
              </Stack>
            )}
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Expressão:
            </Typography>
            <Typography variant="body2">{breakdownExpression}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
