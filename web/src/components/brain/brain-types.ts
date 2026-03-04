export interface DemoNode {
  id: string;
  label: string;
  type: string;
  level: number;
  relevance: number;
}

export interface DemoEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
}
