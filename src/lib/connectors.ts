import { mcpCall } from './api';

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
    // Mock for demo/vision if API fails
    return [
      { 
        id: 'rm-mock-1', 
        text: 'Møde med LEGO: Vi skal kigge på deres supply chain i Billund. Fokus på bæredygtighed.' 
      }
    ];
  }
}

/**
 * NotebookLM Bridge
 * Vision: Ground the Oracle's reasoning in a specific set of documents.
 */
export async function fetchNotebookContext(topic: string): Promise<string> {
  try {
    // Call MCP tool to fetch grounded knowledge from our NotebookLM equivalent (Meilisearch or RAG)
    const result = await mcpCall<{ answer: string }>('knowledge.search_grounded', {
      query: topic,
      source_type: 'curated_library'
    });
    return result.answer;
  } catch (e) {
    return 'Ingen specifik Notebook-kontekst fundet for dette emne.';
  }
}
