#!/usr/bin/env node
import { startServer } from '../dist/server/index.js';

startServer().catch((err) => {
  console.error('Failed to start Kanbrawl server:', err);
  process.exit(1);
});
