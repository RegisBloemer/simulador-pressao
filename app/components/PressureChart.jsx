'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip as CjsTooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, CjsTooltip, Legend);

export default function PressureChart({ data, options }) {
  return <Line data={data} options={options} />;
}
