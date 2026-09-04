import { css } from 'lit';

export const commonStyles = css`
  * {
    box-sizing: border-box;
  }

  /* ── Typography & Reset ── */
  h1, h2, h3, h4, h5, h6 {
    font-weight: 600;
    line-height: 1.25;
    color: var(--text-primary);
  }

  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.25rem; }
  h3 { font-size: 1.1rem; }
  h4 { font-size: 0.95rem; }

  p {
    line-height: 1.5;
    color: var(--text-secondary);
  }

  /* ── Buttons ── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.45rem 0.9rem;
    font-size: 0.8125rem;
    font-weight: 600;
    font-family: inherit;
    border-radius: 4px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    text-decoration: none;
    line-height: 1.2;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--primary);
    color: #ffffff;
    border-color: var(--primary);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-hover);
    border-color: var(--primary-hover);
  }

  .btn-secondary {
    background: var(--surface-secondary);
    color: var(--text-primary);
    border-color: var(--border-subtle);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--border-focus);
  }

  .btn-danger {
    background: var(--danger-bg);
    color: var(--danger-text);
    border-color: var(--danger-border);
  }

  .btn-danger:hover:not(:disabled) {
    background: var(--danger-hover);
  }

  .btn-outline {
    background: transparent;
    color: var(--text-primary);
    border-color: var(--border-default);
  }

  .btn-outline:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--border-focus);
  }

  .btn-sm {
    padding: 0.25rem 0.6rem;
    font-size: 0.75rem;
  }

  .btn-lg {
    padding: 0.65rem 1.25rem;
    font-size: 0.9375rem;
  }

  /* ── Badges ── */
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.18rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 700;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    line-height: 1;
  }

  .badge-p0 {
    background: #3b1419;
    color: #ff7878;
    border: 1px solid #782329;
  }

  .badge-p1 {
    background: #3a2810;
    color: #ffba59;
    border: 1px solid #78521a;
  }

  .badge-p2 {
    background: #122c3e;
    color: #68c0ff;
    border: 1px solid #1f4f6e;
  }

  .badge-risk-high {
    background: #401018;
    color: #ff5252;
    border: 1px solid #821c2c;
  }

  .badge-risk-medium {
    background: #3d2b0e;
    color: #ffaa33;
    border: 1px solid #7a5416;
  }

  .badge-risk-low {
    background: #0f331f;
    color: #4cd987;
    border: 1px solid #1a663b;
  }

  .badge-role {
    background: var(--surface-secondary);
    color: var(--text-muted);
    border: 1px solid var(--border-subtle);
  }

  .badge-status {
    background: var(--surface-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-subtle);
  }

  /* ── Form Controls ── */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-bottom: 1rem;
  }

  .form-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .form-input,
  .form-select,
  .form-textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-family: inherit;
    background: var(--input-bg);
    color: var(--text-primary);
    border: 1px solid var(--border-default);
    border-radius: 4px;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .form-input:focus,
  .form-select:focus,
  .form-textarea:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 1px var(--primary);
  }

  .form-textarea {
    resize: vertical;
    min-height: 80px;
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  /* ── Cards & Surfaces ── */
  .card {
    background: var(--surface-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: 1.25rem;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .card-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  /* ── Metric Stat Tiles ── */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-card {
    background: var(--surface-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .stat-value {
    font-size: 1.625rem;
    font-weight: 700;
    color: var(--text-primary);
    font-family: 'Space Mono', monospace;
  }

  .stat-helper {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  /* ── Tables ── */
  .table-container {
    width: 100%;
    overflow-x: auto;
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    background: var(--surface-primary);
  }

  .table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 0.8125rem;
  }

  .table th {
    background: var(--surface-secondary);
    color: var(--text-secondary);
    font-weight: 600;
    padding: 0.65rem 1rem;
    border-bottom: 1px solid var(--border-default);
    text-transform: uppercase;
    font-size: 0.6875rem;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-subtle);
    color: var(--text-primary);
    vertical-align: middle;
  }

  .table tr:last-child td {
    border-bottom: none;
  }

  .table tr:hover td {
    background: var(--surface-hover);
  }

  /* ── Modal Dialog ── */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-dialog {
    background: var(--surface-primary);
    border: 1px solid var(--border-default);
    border-radius: 8px;
    width: 100%;
    max-width: 640px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-secondary);
  }

  .modal-body {
    padding: 1.25rem;
    overflow-y: auto;
    flex: 1;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border-subtle);
    background: var(--surface-secondary);
  }

  /* ── Filter Bar ── */
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
    padding: 0.75rem 1rem;
    background: var(--surface-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
  }

  .filter-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
  }

  /* ── Alerts & Notices ── */
  .alert {
    padding: 0.75rem 1rem;
    border-radius: 4px;
    font-size: 0.8125rem;
    margin-bottom: 1rem;
    line-height: 1.4;
    border: 1px solid transparent;
  }

  .alert-info {
    background: #0d2838;
    color: #68c0ff;
    border-color: #1a4e6e;
  }

  .alert-warning {
    background: #362208;
    color: #ffb84d;
    border-color: #6e4610;
  }

  .alert-danger {
    background: #361014;
    color: #ff6e78;
    border-color: #6e2029;
  }

  .alert-success {
    background: #0d2b1b;
    color: #55db90;
    border-color: #175435;
  }
`;
