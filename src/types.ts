export type ContextType = 'code' | 'decision' | 'error' | 'pattern' | 'architecture' | 'module' | 'summary';

export type RelationType =
  | 'depends_on'
  | 'related_to'
  | 'caused_by'
  | 'fixes'
  | 'supersedes'
  | 'part_of'
  | 'imports'
  | 'calls'
  | 'belongs_to'
  | 'implements'
  | 'similar_to'
  | 'summarizes';

export type SpiralLevel = 1 | 2 | 3 | 4 | 5;

/** Level semantics: 1=Focus, 2=Active, 3=Reference, 4=Archive, 5=Deep Archive */
export const LEVEL_NAMES: Record<SpiralLevel, string> = {
  1: 'Focus',
  2: 'Active',
  3: 'Reference',
  4: 'Archive',
  5: 'Deep Archive',
};

export type EmbeddingStatus = 'loaded' | 'loading' | 'fallback';

export interface NodeMetadata {
  file?: string;
  function?: string;
  language?: string;
  tags?: string[];
  error_type?: string;
  project?: string;
  [key: string]: unknown;
}

export interface ContextNode {
  id: string;
  type: ContextType;
  content: string;
  summary: string | null;
  level: SpiralLevel;
  relevance_score: number;
  token_count: number;
  metadata: NodeMetadata;
  created_at: number;
  updated_at: number;
  accessed_at: number;
}

export interface Edge {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: RelationType;
  weight: number;
  metadata: Record<string, unknown>;
  created_at: number;
}

export interface SpiralQueryResult {
  level_1: SpiralResultNode[];
  level_2: SpiralResultNode[];
  level_3: SpiralResultNode[];
  level_4: SpiralResultNode[];
  level_5: SpiralResultNode[];
  total_tokens: number;
  node_count: number;
}

export interface SpiralResultNode {
  id: string;
  type: ContextType;
  content: string;
  relevance: number;
}

export interface SpiralStoreResult {
  node_id: string;
  level: SpiralLevel;
  connections: number;
  token_count: number;
}

export interface SpiralStatusResult {
  total_nodes: number;
  per_level: Record<SpiralLevel, number>;
  total_edges: number;
  storage_size_bytes: number;
  oldest_node: string | null;
  newest_node: string | null;
  embedding_status: EmbeddingStatus;
}

export interface SpiralCompactResult {
  compacted_nodes: number;
  freed_tokens: number;
  nodes_deleted: number;
}

export interface SpiralConfig {
  dataDir: string;
  maxTokens: number;
  model: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  embeddingDimensions: number;
  levelThresholds: {
    l1Min: number;
    l2Min: number;
    l3Min: number;
    l4Min: number;
  };
  decayRate: number;
  decayIntervalHours: number;
}

export interface VectorSearchResult {
  node_id: string;
  distance: number;
}
