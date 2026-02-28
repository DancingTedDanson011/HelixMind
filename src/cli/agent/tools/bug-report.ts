import { registerTool } from './registry.js';

registerTool({
  definition: {
    name: 'bug_report',
    description: 'Create or update a bug in the bug journal. Use this to track bugs the user reports, update their status when investigating or fixing, and add evidence. The bug journal persists across sessions.',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'update', 'add_evidence', 'mark_fixed', 'mark_verified'],
          description: 'The action to perform on the bug journal',
        },
        bug_id: {
          type: 'number',
          description: 'Bug ID (required for update, add_evidence, mark_fixed, mark_verified)',
        },
        description: {
          type: 'string',
          description: 'Bug description (required for create, optional for update)',
        },
        file: {
          type: 'string',
          description: 'File path related to the bug',
        },
        line: {
          type: 'number',
          description: 'Line number in the file',
        },
        status: {
          type: 'string',
          enum: ['open', 'investigating', 'fixed', 'verified'],
          description: 'New status (for update action)',
        },
        fix_description: {
          type: 'string',
          description: 'Description of what was fixed (for mark_fixed)',
        },
        evidence_type: {
          type: 'string',
          enum: ['error_message', 'stack_trace', 'user_report', 'screenshot', 'test_result'],
          description: 'Type of evidence (for add_evidence)',
        },
        evidence_content: {
          type: 'string',
          description: 'Evidence content (for add_evidence)',
        },
      },
      required: ['action'],
    },
  },

  async execute(input, ctx) {
    const bugJournal = ctx.bugJournal;
    if (!bugJournal) {
      return 'Bug journal is not available in this session.';
    }

    const action = input.action as string;

    switch (action) {
      case 'create': {
        const desc = input.description as string;
        if (!desc) return 'Error: description is required for create action.';

        const bug = bugJournal.create(desc, {
          file: input.file as string | undefined,
          line: input.line as number | undefined,
        });
        return `Bug #${bug.id} created: "${bug.description}"${bug.file ? ` (${bug.file}${bug.line ? ':' + bug.line : ''})` : ''}`;
      }

      case 'update': {
        const id = input.bug_id as number;
        if (!id) return 'Error: bug_id is required for update action.';

        const updates: Record<string, unknown> = {};
        if (input.description) updates.description = input.description;
        if (input.status) updates.status = input.status;
        if (input.file) updates.file = input.file;
        if (input.line) updates.line = input.line;
        if (input.fix_description) updates.fixDescription = input.fix_description;

        const bug = bugJournal.update(id, updates);
        if (!bug) return `Error: Bug #${id} not found.`;
        return `Bug #${bug.id} updated: status=${bug.status}${bug.fixDescription ? ', fix: ' + bug.fixDescription : ''}`;
      }

      case 'add_evidence': {
        const id = input.bug_id as number;
        if (!id) return 'Error: bug_id is required for add_evidence action.';

        const evidenceType = (input.evidence_type as string) || 'user_report';
        const content = input.evidence_content as string;
        if (!content) return 'Error: evidence_content is required for add_evidence action.';

        const bug = bugJournal.addEvidence(id, {
          type: evidenceType as any,
          content,
          timestamp: Date.now(),
        });
        if (!bug) return `Error: Bug #${id} not found.`;
        return `Evidence added to bug #${bug.id} (${bug.evidence.length} total evidence items)`;
      }

      case 'mark_fixed': {
        const id = input.bug_id as number;
        if (!id) return 'Error: bug_id is required for mark_fixed action.';

        const fixDesc = input.fix_description as string;
        const bug = bugJournal.markFixed(id, fixDesc);
        if (!bug) return `Error: Bug #${id} not found.`;
        return `Bug #${bug.id} marked as FIXED${fixDesc ? ': ' + fixDesc : ''}`;
      }

      case 'mark_verified': {
        const id = input.bug_id as number;
        if (!id) return 'Error: bug_id is required for mark_verified action.';

        const bug = bugJournal.markVerified(id);
        if (!bug) return `Error: Bug #${id} not found.`;
        return `Bug #${bug.id} marked as VERIFIED`;
      }

      default:
        return `Unknown action: ${action}. Use create, update, add_evidence, mark_fixed, or mark_verified.`;
    }
  },
});
