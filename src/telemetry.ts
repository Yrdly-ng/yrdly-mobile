import { initializeTelemetry } from './lib/telemetry';

// Load before themes and Router so startup failures can be reported too.
initializeTelemetry();
