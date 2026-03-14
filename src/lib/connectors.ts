import { mcpCall } from './api';

const NOTEBOOKLM_SCRIPT = 'scripts/notebooklm_sync.py';

export interface ExternalSource {
  id: string;
  name: string;
  type: 'remarkable' | 'notebooklm' | 'gdrive' | 'web';
  lastSynced: string;
  content?: string;
}

/**
 * reMarkable Cloud Connector
 * Vision: Your handwritten notes flow directly into the Agentic Journal.
 */
export async function syncRemarkableNotes(): Promise<{ text: string; id: string }[]> {
  try {
    // In a real implementation, this would call our MCP bridge for reMarkable
    // tool: 'remarkable.get_latest_handwriting'
    const result = await mcpCall<{ success: boolean; notes: any[] }>('remarkable.get_latest_notes', {
      limit: 3,
      format: 'text'
    });

    if (result.success) {
      return result.notes.map(n => ({ text: n.content, id: n.id }));
    }
    return [];
  } catch (e) {
    console.error('reMarkable sync failed:', e);
    return [];
  }
}

/**
 * NotebookLM Bridge (Direct Hack)
 * Vision: Programmatic control over your NotebookLM notebooks via unofficial API.
 */
export async function syncNotebookLM(): Promise<{ success: boolean; notebookId?: string; error?: string }> {
  try {
    const result = await mcpCall<{ success: boolean; notebook_id?: string; error?: string }>('system.run_python', {
      script: NOTEBOOKLM_SCRIPT
    });
    return { success: result.success, notebookId: result.notebook_id, error: result.error };
  } catch (e) {
    return { success: false, error: 'Kunne ikke kontakte NotebookLM-broen.' };
  }
}

/**
 * Inject Canvas Context into NotebookLM
 */
export async function injectNotebookContext(markdown: string): Promise<boolean> {
  try {
    const result = await mcpCall<{ success: boolean }>('system.run_python', {
      script: NOTEBOOKLM_SCRIPT,
      args: ['--context', markdown]
    });
    return result.success;
  } catch (e) {
    console.error('Context injection failed', e);
    return false;
  }
}

/**
 * Trigger Audio Overview Generation
 */
export async function triggerAudioOverview(): Promise<{ success: boolean; message?: string }> {
  try {
    const result = await mcpCall<{ success: boolean; message?: string }>('system.run_python', {
      script: NOTEBOOKLM_SCRIPT,
      args: ['--generate-audio']
    });
    return result;
  } catch (e) {
    return { success: false, message: 'Audio trigger failed.' };
  }
}

/**
 * Real-time Grounded Query
 */
export async function fetchNotebookContext(topic: string): Promise<string> {
  try {
    const result = await mcpCall<{ success: boolean; answer?: string; error?: string }>('system.run_python', {
      script: NOTEBOOKLM_SCRIPT,
      args: ['--ask', topic]
    });
    
    if (result.success && result.answer) {
      return result.answer;
    }
    return `[NotebookLM Error] ${result.error || 'Intet svar.'}`;
  } catch (e) {
    return 'Ingen specifik Notebook-kontekst fundet (Broen er nede).';
  }
}

export async function saveNotebookLMCookie(cookie: string): Promise<void> {
  await mcpCall('system.save_config', {
    file: 'notebooklm_config.json',
    data: { '__Secure-1PSID': cookie }
  });
}
