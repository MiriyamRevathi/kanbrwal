import type { Task, Project, User, Activity, Team } from '../types.js';

export type SearchDocumentType = 'project' | 'task' | 'user' | 'team' | 'activity';

export type IndexedDocument = {
  id: string;
  entityId: string;
  type: SearchDocumentType;
  title: string;
  content: string;
  tags: string[];
  tokens: string[];
  updatedAt: string;
};

export type SearchResultItem = {
  entityId: string;
  type: SearchDocumentType;
  title: string;
  snippet: string;
  score: number;
  matchedTerms: string[];
};

export class FullTextSearchIndexer {
  private index: Map<string, IndexedDocument> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map(); // token -> documentIds

  private tokenize(text: string): string[] {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }

  public indexProjects(projects: Project[]): void {
    for (const p of projects) {
      const content = `${p.key} ${p.name} ${p.description} ${p.managerName} ${p.status} ${p.riskFactors.join(' ')}`;
      const tokens = Array.from(new Set(this.tokenize(content)));

      const doc: IndexedDocument = {
        id: `doc_proj_${p.id}`,
        entityId: p.id,
        type: 'project',
        title: `[${p.key}] ${p.name}`,
        content,
        tags: [p.key, p.status, p.priority, p.riskLevel],
        tokens,
        updatedAt: p.updatedAt || p.createdAt,
      };

      this.insertDocument(doc);
    }
  }

  public indexTasks(tasks: Task[]): void {
    for (const t of tasks) {
      const content = `${t.title} ${t.description} ${t.column} ${t.priority} ${t.assignee || ''} ${t.tags.join(' ')} ${(t.dependencies || []).join(' ')}`;
      const tokens = Array.from(new Set(this.tokenize(content)));

      const doc: IndexedDocument = {
        id: `doc_task_${t.id}`,
        entityId: t.id,
        type: 'task',
        title: t.title,
        content,
        tags: [...t.tags, t.column, t.priority, t.riskLevel],
        tokens,
        updatedAt: t.updatedAt || t.createdAt,
      };

      this.insertDocument(doc);
    }
  }

  public indexUsers(users: User[]): void {
    for (const u of users) {
      const content = `${u.name} ${u.email} ${u.role} ${u.title}`;
      const tokens = Array.from(new Set(this.tokenize(content)));

      const doc: IndexedDocument = {
        id: `doc_usr_${u.id}`,
        entityId: u.id,
        type: 'user',
        title: `${u.name} (${u.role})`,
        content,
        tags: [u.role, u.status],
        tokens,
        updatedAt: u.createdAt,
      };

      this.insertDocument(doc);
    }
  }

  private insertDocument(doc: IndexedDocument): void {
    this.index.set(doc.id, doc);
    for (const token of doc.tokens) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token)!.add(doc.id);
    }
  }

  public search(query: string, filterType?: SearchDocumentType, limit = 20): SearchResultItem[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const candidateDocIds = new Set<string>();

    for (const qToken of queryTokens) {
      for (const [token, docIds] of this.invertedIndex.entries()) {
        if (token.includes(qToken) || qToken.includes(token)) {
          for (const id of docIds) {
            candidateDocIds.add(id);
          }
        }
      }
    }

    const results: SearchResultItem[] = [];

    for (const docId of candidateDocIds) {
      const doc = this.index.get(docId);
      if (!doc) continue;

      if (filterType && doc.type !== filterType) continue;

      let score = 0;
      const matchedTerms: string[] = [];

      for (const qToken of queryTokens) {
        if (doc.title.toLowerCase().includes(qToken)) {
          score += 10;
          matchedTerms.push(qToken);
        }
        if (doc.tokens.includes(qToken)) {
          score += 5;
          matchedTerms.push(qToken);
        } else if (doc.content.toLowerCase().includes(qToken)) {
          score += 2;
          matchedTerms.push(qToken);
        }
      }

      if (score > 0) {
        results.push({
          entityId: doc.entityId,
          type: doc.type,
          title: doc.title,
          snippet: doc.content.slice(0, 140) + '...',
          score,
          matchedTerms: Array.from(new Set(matchedTerms)),
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  public getIndexStats(): { totalDocuments: number; totalUniqueTokens: number } {
    return {
      totalDocuments: this.index.size,
      totalUniqueTokens: this.invertedIndex.size,
    };
  }
}

export const globalSearchIndexer = new FullTextSearchIndexer();
