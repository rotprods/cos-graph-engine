import { EntityId, Version } from '@cos/core';
import { generateId } from '@cos/core';

export interface OntologyClass {
  id: EntityId;
  name: string;
  description: string;
  parent: EntityId | null;
  properties: OntologyProperty[];
  constraints: string[];
  version: Version;
}

export interface OntologyProperty {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'entity' | 'array' | 'object';
  required: boolean;
  description: string;
  constraints?: string[];
}

export interface OntologyRelation {
  id: EntityId;
  name: string;
  description: string;
  domain: EntityId[];  // valid source classes
  range: EntityId[];   // valid target classes
  properties: OntologyProperty[];
}

export class OntologySystem {
  private classes: Map<EntityId, OntologyClass> = new Map();
  private relations: Map<EntityId, OntologyRelation> = new Map();
  private nameIndex: Map<string, EntityId> = new Map();

  // Define a class
  async defineClass(
    name: string,
    description: string,
    parent?: EntityId,
    properties: OntologyProperty[] = [],
  ): Promise<EntityId> {
    const id = generateId();
    const cls: OntologyClass = {
      id,
      name,
      description,
      parent: parent || null,
      properties,
      constraints: [],
      version: { major: 1, minor: 0, patch: 0 },
    };

    this.classes.set(id, cls);
    this.nameIndex.set(name.toLowerCase(), id);

    return id;
  }

  // Define a relation
  async defineRelation(
    name: string,
    description: string,
    domain: EntityId[],
    range: EntityId[],
    properties: OntologyProperty[] = [],
  ): Promise<EntityId> {
    const id = generateId();
    const rel: OntologyRelation = {
      id, name, description, domain, range, properties,
    };

    this.relations.set(id, rel);
    this.nameIndex.set(name.toLowerCase(), id);

    return id;
  }

  // Get class by name
  async getClass(name: string): Promise<OntologyClass | null> {
    const id = this.nameIndex.get(name.toLowerCase());
    if (!id) return null;
    return this.classes.get(id) || null;
  }

  // Get class by ID
  async getClassById(id: EntityId): Promise<OntologyClass | null> {
    return this.classes.get(id) || null;
  }

  // Get relation by name
  async getRelation(name: string): Promise<OntologyRelation | null> {
    const id = this.nameIndex.get(name.toLowerCase());
    if (!id) return null;
    return this.relations.get(id) || null;
  }

  // Get class hierarchy
  async getClassHierarchy(): Promise<Map<EntityId, EntityId[]>> {
    const hierarchy = new Map<EntityId, EntityId[]>();

    for (const cls of this.classes.values()) {
      if (cls.parent) {
        if (!hierarchy.has(cls.parent)) hierarchy.set(cls.parent, []);
        hierarchy.get(cls.parent)!.push(cls.id);
      }
    }

    return hierarchy;
  }

  // Validate an entity against a class
  validate(instance: Record<string, unknown>, className: string): { valid: boolean; errors: string[] } {
    const classId = this.nameIndex.get(className.toLowerCase());
    if (!classId) return { valid: false, errors: [`Class '${className}' not found`] };

    const cls = this.classes.get(classId);
    if (!cls) return { valid: false, errors: ['Class not found'] };

    const errors: string[] = [];

    for (const prop of cls.properties) {
      const value = instance[prop.name];

      if (prop.required && (value === undefined || value === null)) {
        errors.push(`Required property '${prop.name}' is missing`);
      }

      if (value !== undefined && value !== null) {
        const typeMatch = this.checkType(value, prop.type);
        if (!typeMatch) {
          errors.push(`Property '${prop.name}' expected ${prop.type}, got ${typeof value}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private checkType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number';
      case 'boolean': return typeof value === 'boolean';
      case 'entity': return typeof value === 'string'; // entity ID
      case 'array': return Array.isArray(value);
      case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
      default: return true;
    }
  }

  get classCount(): number { return this.classes.size; }
  get relationCount(): number { return this.relations.size; }
}