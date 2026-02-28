import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'bug_list',
    description: 'List bugs from the bug journal. Filter by status to see open, investigating, fixed, verified, or all bugs. Use this to check the current state of tracked bugs.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['open', 'investigating', 'fixed', 'verified', 'all'],
          description: 'Filter bugs by status (default: all)',
        },
        bug_id: {
          type: 'number',
          description: 'Get details for a specific bug by ID',
        },
      },
    },
  },

  async execute(input, ctx) {
    const bugJournal = ctx.bugJournal;
    if (!bugJournal) {
      return 'Bug journal is not available in this session.';
    }

    // Single bug detail
    if (input.bug_id) {
      const bug = bugJournal.get(input.bug_id as number);
      if (!bug) return `Bug #${input.bug_id} not found.`;

      const lines: string[] = [
        `Bug #${bug.id}: ${bug.description}`,
        `Status: ${bug.status}`,
      ];
      if (bug.file) lines.push(`File: ${bug.file}${bug.line ? ':' + bug.line : ''}`);
      if (bug.fixDescription) lines.push(`Fix: ${bug.fixDescription}`);
      if (bug.relatedFiles.length > 0) lines.push(`Related files: ${bug.relatedFiles.join(', ')}`);
      if (bug.evidence.length > 0) {
        lines.push(`Evidence (${bug.evidence.length}):`);
        for (const ev of bug.evidence.slice(-3)) {
          lines.push(`  [${ev.type}] ${ev.content.slice(0, 100)}`);
        }
      }
      lines.push(`Created: ${new Date(bug.createdAt).toLocaleString()}`);
      if (bug.fixedAt) lines.push(`Fixed: ${new Date(bug.fixedAt).toLocaleString()}`);
      if (bug.verifiedAt) lines.push(`Verified: ${new Date(bug.verifiedAt).toLocaleString()}`);
      return lines.join('\n');
    }

    // List by status
    const statusFilter = (input.status as string) || 'all';
    const bugs = statusFilter === 'all'
      ? bugJournal.getAllBugs()
      : bugJournal.getByStatus(statusFilter as any);

    if (bugs.length === 0) {
      return statusFilter === 'all'
        ? 'No bugs tracked yet.'
        : `No bugs with status "${statusFilter}".`;
    }

    const statusIcons: Record<string, string> = {
      open: '[OPEN]',
      investigating: '[INVESTIGATING]',
      fixed: '[FIXED]',
      verified: '[VERIFIED]',
    };

    const lines: string[] = [`Bug Journal (${bugs.length} bugs):`];
    for (const bug of bugs) {
      const icon = statusIcons[bug.status] || bug.status;
      const loc = bug.file ? ` (${bug.file}${bug.line ? ':' + bug.line : ''})` : '';
      lines.push(`  #${bug.id} ${icon} ${bug.description}${loc}`);
    }

    const summary = bugJournal.getStatusLine();
    if (summary) lines.push(`\nSummary: ${summary}`);

    return lines.join('\n');
  },
});
