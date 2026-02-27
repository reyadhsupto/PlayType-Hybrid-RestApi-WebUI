import express from 'express';
import fs from 'fs';
import path from 'path';
import { Registry, collectDefaultMetrics, Gauge } from 'prom-client';

const app = express();
const port = 9464;
const metricsPath = path.resolve('metrics/playwright-metrics.prom');

// Create a Registry for Prometheus
const registry = new Registry();
collectDefaultMetrics({ register: registry });

// Serve static `.prom` file
app.get('/metrics', (req, res) => {
  if (!fs.existsSync(metricsPath)) {
    return res.status(404).send('Metrics file not found. Run generateMetrics.ts first.');
  }
  const metrics = fs.readFileSync(metricsPath, 'utf-8');
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics);
});

app.listen(port, () => {
  console.log(`🚀 Metrics server running at http://localhost:${port}/metrics`);
});
