'use client';

import * as React from 'react';
import Editor from '@monaco-editor/react';
import nerdamer from 'nerdamer/all.min';
import { create, all } from 'mathjs';
import {
  Card, CardHeader, CardContent,
  Box, Stack, Button, Typography, Tooltip, IconButton, Divider
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const math = create(all, {});

// ---- helpers de exibição (evitam "Objects are not valid as a React child")
function display(val) {
  if (val == null) return '';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
  // nerdamer costuma ter .text()
  if (typeof val?.text === 'function') {
    try { return val.text(); } catch {}
  }
  if (typeof val?.toString === 'function') {
    try { return val.toString(); } catch {}
  }
  try { return JSON.stringify(val); } catch { return String(val); }
}

const tokenRegex = /[A-Za-z_]\w*/g;
const RESERVED = new Set(['pi','PI','e','E','sin','cos','tan','asin','acos','atan','log','ln','exp','sqrt','abs','min','max','pow']);
const uniq = (arr) => Array.from(new Set(arr));

function extractVars(exprs) {
  const tokens = exprs.flatMap(e => (String(e).match(tokenRegex) || []));
  return uniq(tokens.filter(t => !RESERVED.has(t)));
}
function toResidual(expr) {
  const s = String(expr);
  const p = s.split('=');
  if (p.length === 1) return s;
  const lhs = p[0], rhs = p.slice(1).join('=');
  return `(${lhs}) - (${rhs})`;
}

function parseProgram(text) {
  const equations = [];
  const guesses = {};
  const lines = (text || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const m = line.match(/^(?:@guess|guess)\s+(.+)$/i);
    if (m) {
      const parts = m[1].split(/[,;]+/);
      for (const part of parts) {
        const [name, rhs] = part.split('=').map(s => s && s.trim());
        if (!name || rhs == null) continue;
        try {
          const val = math.evaluate(rhs, guesses);
          if (Number.isFinite(val)) guesses[name] = Number(val);
        } catch {}
      }
      continue;
    }

    if (line.includes('=')) equations.push(line);
  }
  return { equations, guesses };
}

async function solveNumeric(equations, varNames, initial, { maxIter=60, tol=1e-10 } = {}) {
  const residualsExpr = equations.map(toResidual);
  const compiled = residualsExpr.map(e => math.compile(e));
  const names = varNames.length ? varNames : extractVars(residualsExpr);

  const x0 = names.map(n => Number.isFinite(initial[n]) ? Number(initial[n]) : 1);

  const f = (x) => {
    const scope = Object.fromEntries(names.map((n,i)=>[n, x[i]]));
    return compiled.map(c => Number(c.evaluate(scope)));
  };

  const jac = (x) => {
    const eps = 1e-6;
    const fx = f(x);
    const m = fx.length, n = x.length;
    const J = Array.from({length:m}, () => Array(n).fill(0));
    for (let j=0;j<n;j++){
      const xp = x.slice(); xp[j]+=eps;
      const xm = x.slice(); xm[j]-=eps;
      const fp = f(xp), fm = f(xm);
      for (let i=0;i<m;i++) J[i][j] = (fp[i]-fm[i])/(2*eps);
    }
    return {J, fx};
  };

  let x = x0.slice();
  const hist = [];

  for (let k=0;k<maxIter;k++){
    const {J, fx} = jac(x);
    const JT = math.transpose(J);
    const JTJ = math.multiply(JT, J);
    const JTJreg = math.add(JTJ, math.multiply(1e-8, math.identity(x.length)));
    const rhs = math.multiply(JT, math.multiply(-1, fx));
    const dx = math.lusolve(JTJreg, rhs).map(r => r[0]);

    const norm = (v) => Math.hypot(...v);
    const fNorm = norm(fx);
    hist.push({ iter:k, norm:fNorm });
    if (fNorm < tol) break;

    let lambda = 1.0, best = fNorm, xNew = x;
    for (let t=0;t<8;t++){
      const trial = x.map((xi,i)=>xi + lambda*dx[i]);
      const nrm = norm(f(trial));
      if (nrm <= best) { best = nrm; xNew = trial; break; }
      lambda *= 0.5;
    }
    x = xNew;
    if (best < tol) { hist.push({iter:k+1, norm:best}); break; }
  }

  const finalScope = Object.fromEntries(names.map((n,i)=>[n,x[i]]));
  const finalF = compiled.map(c => Number(c.evaluate(finalScope)));

  return {
    type: 'numeric',
    names,
    solution: Object.fromEntries(names.map((n,i)=>[n, x[i]])),
    residuals: equations.map((eq,i)=>({ expr: eq, value: finalF[i] })),
    history: hist,
  };
}

function trySolveSymbolic(equations) {
  try {
    const sol = nerdamer.solveEquations(equations);
    if (!sol || !sol.length) return null;
    const out = {};
    for (const pair of sol) {
      const k = String(pair[0]);
      // pair[1] pode ser objeto; sempre vira string
      const txt = typeof pair[1]?.text === 'function' ? pair[1].text() : String(pair[1]);
      const num = Number(nerdamer(txt).evaluate().text());
      out[k] = Number.isFinite(num) ? num : txt; // se não der número, guarda string
    }
    return { type: 'symbolic', names: Object.keys(out), solution: out, residuals: [], history: [] };
  } catch {
    return null;
  }
}

const EXAMPLE = `# Solucionador UFSC - digite como um arquivo
# comentários começam com '#'
x^2 + y^2 = 10
x*y = 3
# guess x=2, y=1
`;

export default function UfscSolver() {
  const [code, setCode] = React.useState(EXAMPLE);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [parsed, setParsed] = React.useState({ equations: [], guesses: {} });

  const run = async () => {
    setBusy(true);
    setResult(null);
    const p = parseProgram(code);
    setParsed(p);

    // simbólico primeiro
    const sym = trySolveSymbolic(p.equations);
    if (sym) {
      setResult(sym);
      setBusy(false);
      return;
    }

    // numérico
    const names = extractVars(p.equations.map(toResidual));
    const num = await solveNumeric(p.equations, names, p.guesses);
    setResult(num);
    setBusy(false);
  };

  const copy = async () => {
    if (!result) return;
    const txt = Object.entries(result.solution)
      .map(([k,v]) => `${k} = ${typeof v === 'number' ? Number(v).toPrecision(10) : display(v)}`)
      .join('\n');
    try { await navigator.clipboard.writeText(txt); } catch {}
  };

  return (
    <Card>
      <CardHeader
        title="Solucionador UFSC (arquivo editável)"
        subheader="Digite variáveis e equações; clique em Executar. Suporta #comentários e 'guess x=1, y=2'."
        action={
          <Tooltip title="Tentamos simbólico (Nerdamer); se falhar, caímos no numérico (Gauss-Newton LS).">
            <IconButton><InfoOutlinedIcon /></IconButton>
          </Tooltip>
        }
      />
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            <Editor
              height="220px"
              language="python"
              theme="vs-dark"
              value={code}
              onChange={v => setCode(v ?? '')}
              options={{ fontSize: 14, minimap:{enabled:false}, lineNumbers:'on', wordWrap:'on', scrollBeyondLastLine:false }}
            />
          </Box>

          <Stack direction="row" spacing={1}>
            <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={run} disabled={busy}>
              {busy ? 'Executando...' : 'Executar'}
            </Button>
            <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={copy} disabled={!result}>
              Copiar resultados
            </Button>
          </Stack>

          <Divider />

          <Typography variant="subtitle2">Equações interpretadas</Typography>
          {parsed.equations.length ? (
            <Box sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1 }}>
              {parsed.equations.map((e,i)=>(
                <Typography key={i} variant="body2">{i+1}. {display(e)}</Typography>
              ))}
            </Box>
          ) : (
            <Typography color="text.secondary">Nenhuma equação válida detectada ainda.</Typography>
          )}

          {Object.keys(parsed.guesses).length > 0 && (
            <>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>Chutes iniciais (guess)</Typography>
              <Box sx={{ bgcolor: 'background.paper', p: 1, borderRadius: 1, border: '1px solid', borderColor:'divider' }}>
                {Object.entries(parsed.guesses).map(([k,v])=>(
                  <Typography key={k} variant="body2">{k} ≈ {display(v)}</Typography>
                ))}
              </Box>
            </>
          )}

          <Divider />

          <Typography variant="h6">Resultados</Typography>
          {!result ? (
            <Typography color="text.secondary">Digite seu sistema e clique em Executar.</Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                Modo: <b>{result.type === 'symbolic' ? 'Simbólico' : 'Numérico (Gauss-Newton)'}</b>
              </Typography>
              <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2 }}>
                {Object.entries(result.solution).map(([k,v])=>(
                  <Typography key={k} variant="body1">
                    <b>{k}</b> = {typeof v === 'number' ? Number(v).toPrecision(10) : display(v)}
                  </Typography>
                ))}
              </Box>

              {result.residuals?.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 2 }}>Resíduos (→ 0):</Typography>
                  <Box sx={{ p:1, border:'1px solid', borderColor:'divider', borderRadius:1 }}>
                    {result.residuals.map((r,i)=>(
                      <Typography key={i} variant="body2">{display(r.expr)} → <b>{Number(r.value).toExponential(3)}</b></Typography>
                    ))}
                  </Box>
                </>
              )}

              {result.history?.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mt: 2 }}>Convergência:</Typography>
                  <Box sx={{ p:1, border:'1px solid', borderColor:'divider', borderRadius:1 }}>
                    {result.history.map(h=>(
                      <Typography key={h.iter} variant="body2">it {h.iter}: ||f|| = {h.norm.toExponential(3)}</Typography>
                    ))}
                  </Box>
                </>
              )}
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
