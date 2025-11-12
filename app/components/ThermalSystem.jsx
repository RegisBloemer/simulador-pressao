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
  MenuItem,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

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

  // Cada camada agora pode ter parallelGroupId (string ou null)
  const [composition, setComposition] = useState([]);
  const [contactResistances, setContactResistances] = useState({});
  const [convExt, setConvExt] = useState({ enabled: true, h: '25' });
  const [convInt, setConvInt] = useState({ enabled: true, h: '10' });

  // Estado para DragOverlay
  const [activeDrag, setActiveDrag] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Helper para criar uma camada
  const createLayer = (materialId, options = {}) => {
    const material = materialsMap[materialId];
    if (!material) return null;

    return {
      instanceId: `layer-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      materialId,
      thickness: material.defaultThickness.toString(),
      parallelGroupId: options.parallelGroupId ?? null,
    };
  };

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
        const moved = arrayMove(prev, oldIndex, newIndex);
        return moved;
      });
      return;
    }

    // Arrastar do catálogo para a composição
    if (activeFrom === 'catalog') {
      if (!isOverContainer && !isOverLayer) {
        return;
      }

      const materialId = active.data?.current?.materialId;
      const newLayer = createLayer(materialId);
      if (!newLayer) return;

      setComposition((prev) => {
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

  const handleMaterialChange = (layerId, newMaterialId) => {
    if (!materialsMap[newMaterialId]) return;
    setComposition((prev) =>
      prev.map((layer) =>
        layer.instanceId === layerId
          ? { ...layer, materialId: newMaterialId }
          : layer
      )
    );
  };

  const handleAddParallelLayer = (layerId) => {
    setComposition((prev) => {
      const index = prev.findIndex((l) => l.instanceId === layerId);
      if (index === -1) return prev;

      const baseLayer = prev[index];
      const baseMaterial = materialsMap[baseLayer.materialId];
      if (!baseMaterial) return prev;

      const groupId =
        baseLayer.parallelGroupId ||
        `pg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const newLayer = {
        instanceId: `layer-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        materialId: baseLayer.materialId,
        thickness: baseLayer.thickness,
        parallelGroupId: groupId,
      };

      const newComp = [...prev];

      if (!baseLayer.parallelGroupId) {
        newComp[index] = { ...baseLayer, parallelGroupId: groupId };
      }

      let insertIndex = index + 1;
      while (
        insertIndex < newComp.length &&
        newComp[insertIndex].parallelGroupId === groupId
      ) {
        insertIndex++;
      }

      newComp.splice(insertIndex, 0, newLayer);
      return newComp;
    });
  };

  const handleRemoveLayer = (layerId) => {
    setComposition((prev) => {
      const layerToRemove = prev.find((l) => l.instanceId === layerId);
      if (!layerToRemove) return prev;

      const groupId = layerToRemove.parallelGroupId || null;

      let next = prev.filter((layer) => layer.instanceId !== layerId);

      if (groupId) {
        const remaining = next.filter((l) => l.parallelGroupId === groupId);
        if (remaining.length <= 1) {
          next = next.map((l) =>
            l.parallelGroupId === groupId ? { ...l, parallelGroupId: null } : l
          );
        }
      }

      return next;
    });

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

  // ---------------- Cálculo de R_total (série + paralelo) ----------------
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

    const nLayers = composition.length;
    let i = 0;

    while (i < nLayers) {
      const layer = composition[i];

      // Início de grupo em paralelo?
      const pgId = layer.parallelGroupId;
      if (pgId) {
        let j = i + 1;
        while (j < nLayers && composition[j].parallelGroupId === pgId) {
          j++;
        }
        const groupSize = j - i;

        if (groupSize > 1) {
          const groupLayers = composition.slice(i, j);

          let invSum = 0;
          const branchLabels = [];

          groupLayers.forEach((gLayer) => {
            const mat = materialsMap[gLayer.materialId];
            if (!mat) return;
            const L = parseFloat(gLayer.thickness);
            const k = parseFloat(mat.k);
            if (Number.isFinite(L) && Number.isFinite(k) && L > 0 && k > 0) {
              const R = L / k;
              if (R > 0) {
                invSum += 1 / R;
                branchLabels.push(`${mat.name} (R=${R.toFixed(4)})`);
              }
            }
          });

          if (invSum > 0) {
            const Rpar = 1 / invSum;
            const label = branchLabels.length
              ? `Grupo em paralelo: ${branchLabels.join(' || ')}`
              : `Grupo em paralelo (${groupSize} camadas)`;
            addItem(label, Rpar);
          }

          // Resistência de contato APÓS o grupo paralelo (se existir próxima camada)
          if (j < nLayers) {
            const lastLayer = composition[j - 1];
            const nextLayer = composition[j];
            const contactKey = `${lastLayer.instanceId}_${nextLayer.instanceId}`;
            const contact = contactResistances[contactKey];
            if (contact && contact.enabled) {
              const lastMat = materialsMap[lastLayer.materialId];
              const nextMat = materialsMap[nextLayer.materialId];
              const contactLabel =
                lastMat && nextMat
                  ? `Resistência de contato entre grupo paralelo (${lastMat.name} na borda) e ${nextMat.name}`
                  : 'Resistência de contato após grupo em paralelo';
              addItem(contactLabel, contact.rValue);
            }
          }

          i = j;
          continue;
        }
        // Se groupSize === 1, volta pro caso normal (série)
      }

      // Camada em série (normal)
      const mat = materialsMap[layer.materialId];
      if (mat) {
        const L = parseFloat(layer.thickness);
        const k = parseFloat(mat.k);
        if (Number.isFinite(L) && Number.isFinite(k) && L > 0 && k > 0) {
          addItem(`Camada: ${mat.name}`, L / k);
        }
      }

      // Resistência de contato entre esta camada e a próxima (se houver)
      if (i < nLayers - 1) {
        const nextLayer = composition[i + 1];
        const contactKey = `${layer.instanceId}_${nextLayer.instanceId}`;
        const contact = contactResistances[contactKey];
        if (contact && contact.enabled) {
          const matA = mat;
          const matB = materialsMap[nextLayer.materialId];
          const contactLabel =
            matA && matB
              ? `Resistência de contato entre ${matA.name} e ${matB.name}`
              : 'Resistência de contato entre camadas';
          addItem(contactLabel, contact.rValue);
        }
      }

      i += 1;
    }

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
      : 'Adicione materiais (em série ou em paralelo) e parâmetros de convecção/contato para calcular R_total.';

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
            Sistema Térmico (Série e Paralelo)
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Monte o empilhamento de materiais (incluindo grupos em paralelo),
            configure convecção e resistências de contato para obter a
            resistência térmica total (área = 1 m²).
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
              onMaterialChange={handleMaterialChange}
              onAddParallelLayer={handleAddParallelLayer}
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
        {activeDrag?.type === 'layer' &&
          (() => {
            const layer = composition.find(
              (l) => l.instanceId === activeDrag.layerId
            );
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
                  allMaterials={MATERIALS}
                  onThicknessChange={() => {}}
                  onRemoveLayer={() => {}}
                  onMaterialChange={() => {}}
                  onAddParallel={() => {}}
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
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `catalog-${material.id}`,
      data: { from: 'catalog', materialId: material.id },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.2 : 1,
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
  onMaterialChange,
  onAddParallelLayer,
  onRemoveLayer,
  onContactToggle,
  onContactValueChange,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'composition-container',
    data: { from: 'composition-container' },
  });

  const itemsIds = composition.map((layer) => layer.instanceId);
  const allMaterials = MATERIALS;

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
        subheader="Reordene materiais, crie grupos em paralelo, configure contatos e convecção"
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

                const prevLayer = index > 0 ? composition[index - 1] : null;
                const nextLayer = !isLast ? composition[index + 1] : null;

                const isInParallelGroup =
                  !!layer.parallelGroupId &&
                  ((prevLayer &&
                    prevLayer.parallelGroupId === layer.parallelGroupId) ||
                    (nextLayer &&
                      nextLayer.parallelGroupId === layer.parallelGroupId));

                const isParallelGroupStart =
                  !!layer.parallelGroupId &&
                  (!prevLayer ||
                    prevLayer.parallelGroupId !== layer.parallelGroupId) &&
                  nextLayer &&
                  nextLayer.parallelGroupId === layer.parallelGroupId;

                const isParallelGroupEnd =
                  !!layer.parallelGroupId &&
                  (!nextLayer ||
                    nextLayer.parallelGroupId !== layer.parallelGroupId) &&
                  prevLayer &&
                  prevLayer.parallelGroupId === layer.parallelGroupId;

                const sameParallelAsNext =
                  nextLayer &&
                  layer.parallelGroupId &&
                  nextLayer.parallelGroupId === layer.parallelGroupId;

                const shouldShowContact = !isLast && !sameParallelAsNext;

                const contactKey =
                  shouldShowContact && nextLayer
                    ? `${layer.instanceId}_${nextLayer.instanceId}`
                    : null;
                const contact =
                  contactKey && contactResistances[contactKey]
                    ? contactResistances[contactKey]
                    : {
                        enabled: false,
                        rValue: '0.01',
                      };

                return (
                  <React.Fragment key={layer.instanceId}>
                    <SortableLayer
                      layer={layer}
                      material={material}
                      allMaterials={allMaterials}
                      onThicknessChange={onThicknessChange}
                      onMaterialChange={onMaterialChange}
                      onAddParallel={onAddParallelLayer}
                      onRemoveLayer={onRemoveLayer}
                      isLast={isLast}
                      isInParallelGroup={isInParallelGroup}
                      isParallelGroupStart={isParallelGroupStart}
                      isParallelGroupEnd={isParallelGroupEnd}
                    />
                    {shouldShowContact && !isLast && (
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
  allMaterials,
  onThicknessChange,
  onMaterialChange,
  onAddParallel,
  onRemoveLayer,
  isLast,
  isInParallelGroup,
  isParallelGroupStart,
  isParallelGroupEnd,
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
    opacity: isDragging ? 0.2 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        mb: isInParallelGroup ? 0.5 : isLast ? 0 : 1.5,
        display: isInParallelGroup ? 'inline-block' : 'block',
        verticalAlign: 'top',
        mr: isInParallelGroup ? 1.5 : 0,
        width: isInParallelGroup ? { xs: '100%', sm: 'calc(50% - 12px)' } : '100%',
      }}
    >
      <MaterialLayerCard
        layer={layer}
        material={material}
        allMaterials={allMaterials}
        onThicknessChange={onThicknessChange}
        onMaterialChange={onMaterialChange}
        onAddParallel={onAddParallel}
        onRemoveLayer={onRemoveLayer}
        isInParallelGroup={isInParallelGroup}
        isParallelGroupStart={isParallelGroupStart}
        isParallelGroupEnd={isParallelGroupEnd}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </Box>
  );
}

// Card da camada
function MaterialLayerCard({
  layer,
  material,
  allMaterials,
  onThicknessChange,
  onMaterialChange,
  onAddParallel,
  onRemoveLayer,
  isInParallelGroup = false,
  isParallelGroupStart = false,
  isParallelGroupEnd = false,
  dragHandleProps = {},
}) {
  if (!material) return null;

  const L = parseFloat(layer.thickness);
  const R = Number.isFinite(L) && material.k > 0 ? L / material.k : null;

  const parallelLabel = isParallelGroupStart
    ? 'Início de grupo em paralelo'
    : isParallelGroupEnd
    ? 'Fim de grupo em paralelo'
    : 'Camada em paralelo';

  return (
    <Paper
      elevation={isInParallelGroup ? 4 : 2}
      sx={{
        p: 2,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
        border: isInParallelGroup ? '1px solid' : '1px solid transparent',
        borderColor: isInParallelGroup ? 'primary.main' : 'divider',
        bgcolor: isInParallelGroup ? 'action.selected' : 'background.paper',
      }}
      {...dragHandleProps}
    >
      <Box sx={{ flexGrow: 1, minWidth: 220 }}>
        {isInParallelGroup && (
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}
            color="primary.main"
          >
            {parallelLabel}
          </Typography>
        )}

        <Typography variant="subtitle1" fontWeight={600}>
          {material.name}
        </Typography>

        <TextField
          select
          label="Material"
          size="small"
          value={layer.materialId}
          onChange={(e) => onMaterialChange(layer.instanceId, e.target.value)}
          sx={{ mt: 1, mb: 1, maxWidth: 260 }}
        >
          {allMaterials.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.name}
            </MenuItem>
          ))}
        </TextField>

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

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <TextField
          label="Espessura L (m)"
          size="small"
          value={layer.thickness}
          onChange={(e) => onThicknessChange(layer.instanceId, e.target.value)}
          sx={{ width: 130 }}
          inputProps={{ inputMode: 'decimal' }}
          onClick={(e) => e.stopPropagation()}
        />
        <IconButton
          color="primary"
          onClick={(e) => {
            e.stopPropagation();
            onAddParallel(layer.instanceId);
          }}
          aria-label="Adicionar camada em paralelo"
        >
          <AddIcon />
        </IconButton>
        <IconButton
          color="error"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveLayer(layer.instanceId);
          }}
          aria-label="Remover camada"
        >
          <DeleteIcon />
        </IconButton>
      </Box>
    </Paper>
  );
}

// Conector de resistência de contato
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

// -----------------------------------------------------------------------------
// Resumo teórico das fórmulas utilizadas
// -----------------------------------------------------------------------------
function TheoreticalSummary() {
  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        Fundamentos teóricos utilizados
      </Typography>

      <Typography variant="body2" color="text.secondary" paragraph>
        Considera-se área A = 1 m² em todos os cálculos.
      </Typography>

      <Stack spacing={1.5}>
        <Box>
          <Typography variant="subtitle2">
            1. Condução em uma camada (em série)
          </Typography>
          <Typography variant="body2">
            • Condutividade térmica: <b>k</b> [W/m·K]
          </Typography>
          <Typography variant="body2">
            • Espessura da camada: <b>L</b> [m]
          </Typography>
          <Typography variant="body2">
            • Resistência da camada: <b>R = L / k</b> [m²·K/W]
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2">
            2. Convecção (superfície – ambiente)
          </Typography>
          <Typography variant="body2">
            • Coeficiente de convecção: <b>h</b> [W/m²·K]
          </Typography>
          <Typography variant="body2">
            • Resistência de convecção:{' '}
            <b>
              R<sub>conv</sub> = 1 / h
            </b>{' '}
            [m²·K/W]
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2">
            3. Resistência de contato entre camadas
          </Typography>
          <Typography variant="body2">
            • Valor definido pelo usuário:{' '}
            <b>
              R<sub>cont</sub>
            </b>{' '}
            [m²·K/W]
          </Typography>
          <Typography variant="body2">
            • Entra na soma como mais um termo em série:{' '}
            <b>
              R<sub>total</sub> += R<sub>cont</sub>
            </b>
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2">
            4. Grupo de camadas em paralelo
          </Typography>
          <Typography variant="body2">
            Cada camada do grupo em paralelo tem resistência{' '}
            <b>
              R<sub>i</sub> = L<sub>i</sub> / k<sub>i</sub>
            </b>
            . O equivalente do grupo é:
          </Typography>
          <Typography variant="body2" sx={{ ml: 2 }}>
            • <b>1 / R<sub>eq</sub> = Σ (1 / R<sub>i</sub>)</b>
          </Typography>
          <Typography variant="body2" sx={{ ml: 2 }}>
            • <b>R<sub>eq</sub> = 1 / Σ (1 / R<sub>i</sub>)</b>
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2">
            5. Combinação em série (sistema completo)
          </Typography>
          <Typography variant="body2">
            Todos os elementos em série (convecções, camadas simples e grupos
            em paralelo já equivalentes) são somados:
          </Typography>
          <Typography variant="body2" sx={{ ml: 2 }}>
            • <b>R<sub>total</sub> = Σ R<sub>elemento</sub></b>
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2">
            6. (Opcional) Coeficiente global de transmissão
          </Typography>
          <Typography variant="body2">
            A partir da resistência total, pode-se obter o coeficiente U:
          </Typography>
          <Typography variant="body2" sx={{ ml: 2 }}>
            • <b>U = 1 / R<sub>total</sub></b> [W/m²·K]
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Resumo (coluna da direita)
// -----------------------------------------------------------------------------
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
      <CardContent
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              R_total = {totalFormatted} m²·K/W
            </Typography>
            <Typography variant="body2" color="text.secondary">
              (Considerando área de 1 m² e combinação série/paralelo)
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

          <Divider />

          <TheoreticalSummary />
        </Stack>
      </CardContent>
    </Card>
  );
}
