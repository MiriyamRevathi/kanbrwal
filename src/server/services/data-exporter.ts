import type { KanbrawlData, SafeUser, Task, Project, Activity, TimesheetEntry } from '../types.js';

export type ExportFormat = 'json' | 'csv' | 'xml' | 'html_summary';

export class EnterpriseDataExporter {
  public exportTasksToCSV(tasks: Task[]): string {
    const headers = [
      'ID',
      'Project ID',
      'Title',
      'Column',
      'Priority',
      'Assignee',
      'Due Date',
      'Estimated Hours',
      'Actual Hours',
      'Risk Level',
      'Tags',
      'Created At',
    ];

    const rows = tasks.map((t) => [
      `"${t.id}"`,
      `"${t.projectId || ''}"`,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${t.column}"`,
      `"${t.priority}"`,
      `"${t.assignee || 'Unassigned'}"`,
      `"${t.dueDate || ''}"`,
      String(t.estimatedHours || 8),
      String(t.actualHours || 0),
      `"${t.riskLevel || 'low'}"`,
      `"${(t.tags || []).join(';')}"`,
      `"${t.createdAt}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  public exportProjectsToCSV(projects: Project[]): string {
    const headers = [
      'ID',
      'Key',
      'Name',
      'Status',
      'Priority',
      'Risk Level',
      'Risk Score',
      'Manager',
      'Budget Hours',
      'Start Date',
      'Target Date',
      'Created At',
    ];

    const rows = projects.map((p) => [
      `"${p.id}"`,
      `"${p.key}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.status}"`,
      `"${p.priority}"`,
      `"${p.riskLevel}"`,
      String(p.riskScore || 0),
      `"${p.managerName || ''}"`,
      String(p.budgetHours || 0),
      `"${p.startDate || ''}"`,
      `"${p.targetDate || ''}"`,
      `"${p.createdAt}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  public exportTimesheetsToCSV(timesheets: TimesheetEntry[]): string {
    const headers = ['ID', 'User', 'Project', 'Task Title', 'Date', 'Hours Logged', 'Description', 'Status', 'Created At'];

    const rows = timesheets.map((ts) => [
      `"${ts.id}"`,
      `"${ts.userName}"`,
      `"${ts.projectName}"`,
      `"${(ts.taskTitle || '').replace(/"/g, '""')}"`,
      `"${ts.date}"`,
      String(ts.hours),
      `"${ts.description.replace(/"/g, '""')}"`,
      `"${ts.status}"`,
      `"${ts.createdAt}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  public exportToXML(board: KanbrawlData<SafeUser>): string {
    const xmlParts = ['<?xml version="1.0" encoding="UTF-8"?>', '<kanbrawl_enterprise_backup>'];

    xmlParts.push('  <projects>');
    for (const p of board.projects) {
      xmlParts.push(`    <project id="${p.id}" key="${p.key}">`);
      xmlParts.push(`      <name>${this.escapeXML(p.name)}</name>`);
      xmlParts.push(`      <status>${p.status}</status>`);
      xmlParts.push(`      <priority>${p.priority}</priority>`);
      xmlParts.push(`      <risk_score>${p.riskScore}</risk_score>`);
      xmlParts.push('    </project>');
    }
    xmlParts.push('  </projects>');

    xmlParts.push('  <tasks>');
    for (const t of board.tasks) {
      xmlParts.push(`    <task id="${t.id}" project_id="${t.projectId}">`);
      xmlParts.push(`      <title>${this.escapeXML(t.title)}</title>`);
      xmlParts.push(`      <column>${t.column}</column>`);
      xmlParts.push(`      <priority>${t.priority}</priority>`);
      xmlParts.push(`      <estimated_hours>${t.estimatedHours}</estimated_hours>`);
      xmlParts.push('    </task>');
    }
    xmlParts.push('  </tasks>');

    xmlParts.push('</kanbrawl_enterprise_backup>');
    return xmlParts.join('\n');
  }

  public exportExecutiveHTMLReport(board: KanbrawlData<SafeUser>): string {
    const totalProjects = board.projects.length;
    const totalTasks = board.tasks.length;
    const completedTasks = board.tasks.filter((t) => t.column.toLowerCase() === 'done').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kanbrawl Enterprise Executive Progress & Compliance Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1e293b; padding: 2rem; }
    h1 { font-size: 1.75rem; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1.5rem 0; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 1.25rem; border-radius: 6px; }
    .card-num { font-size: 1.75rem; font-weight: 700; color: #2563eb; }
    table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; }
    th, td { padding: 0.75rem; border: 1px solid #e2e8f0; text-align: left; }
    th { background: #f1f5f9; font-size: 0.75rem; text-transform: uppercase; }
  </style>
</head>
<body>
  <h1>Executive Management & Compliance Report</h1>
  <p>Generated At: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</p>

  <div class="metric-grid">
    <div class="card"><div class="card-num">${totalProjects}</div><div>Active Projects</div></div>
    <div class="card"><div class="card-num">${totalTasks}</div><div>Total Tasks</div></div>
    <div class="card"><div class="card-num">${completedTasks}</div><div>Completed Deliverables</div></div>
    <div class="card"><div class="card-num">${completionRate}%</div><div>Overall Completion Rate</div></div>
  </div>

  <h2>Project Status Breakdown</h2>
  <table>
    <thead>
      <tr><th>Key</th><th>Project Name</th><th>Status</th><th>Priority</th><th>Risk Level</th><th>Risk Score</th></tr>
    </thead>
    <tbody>
      ${board.projects
        .map(
          (p) => `<tr>
        <td><strong>${p.key}</strong></td>
        <td>${p.name}</td>
        <td>${p.status}</td>
        <td>${p.priority}</td>
        <td>${p.riskLevel}</td>
        <td>${p.riskScore}/100</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`;
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export const globalDataExporter = new EnterpriseDataExporter();
