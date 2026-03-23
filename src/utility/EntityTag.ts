import { Entity } from "./Entity";

export class EntityTag {
    tag: string;
    subtags: string[];

    constructor(tag: string, subtags: string[] = []) {
        this.tag = tag;
        this.subtags = subtags;
    }
}

// ─────────────────────────────────────────────
// EntityTag CRUD
// ─────────────────────────────────────────────

/** Add a new top-level tag to an entity. No-ops if the tag already exists. */
export function addTag(
    entity: Entity,
    tag: string,
    subtags: string[] = [],
): void {
    if (!hasTag(entity, tag)) {
        entity.tags.push(new EntityTag(tag, subtags));
    }
}

/** Remove a top-level tag (and all its subtags) from an entity. */
export function removeTag(entity: Entity, tag: string): void {
    entity.tags = entity.tags.filter((t) => t.tag !== tag);
}

/** Replace a tag's subtags entirely, or update its name. */
export function updateTag(
    entity: Entity,
    tag: string,
    updates: Partial<{ newName: string; subtags: string[] }>,
): void {
    const entry = getTag(entity, tag);
    if (!entry) return;

    if (updates.newName !== undefined) {
        entry.tag = updates.newName;
    }
    if (updates.subtags !== undefined) {
        entry.subtags = updates.subtags;
    }
}

// ─────────────────────────────────────────────
// Subtag CRUD
// ─────────────────────────────────────────────

/** Add a subtag under an existing tag. No-ops if the subtag already exists. */
export function addSubtag(entity: Entity, tag: string, subtag: string): void {
    const entry = getTag(entity, tag);
    if (entry && !entry.subtags.includes(subtag)) {
        entry.subtags.push(subtag);
    }
}

/** Remove a subtag from a tag. */
export function removeSubtag(
    entity: Entity,
    tag: string,
    subtag: string,
): void {
    const entry = getTag(entity, tag);
    if (entry) {
        entry.subtags = entry.subtags.filter((s) => s !== subtag);
    }
}

/** Replace a specific subtag value with a new one. */
export function renameSubtag(
    entity: Entity,
    tag: string,
    oldSubtag: string,
    newSubtag: string,
): void {
    const entry = getTag(entity, tag);
    if (entry) {
        const idx = entry.subtags.indexOf(oldSubtag);
        if (idx !== -1) entry.subtags[idx] = newSubtag;
    }
}

// ─────────────────────────────────────────────
// Getters
// ─────────────────────────────────────────────

/** Get the EntityTag object for a given tag name, or undefined. */
export function getTag(entity: Entity, tag: string): EntityTag | undefined {
    return entity.tags.find((t) => t.tag === tag);
}

/** Get all subtags for a given tag, or an empty array if the tag doesn't exist. */
export function getSubtags(entity: Entity, tag: string): string[] {
    return getTag(entity, tag)?.subtags ?? [];
}

/** Get all top-level tag names on an entity. */
export function getTagNames(entity: Entity): string[] {
    return entity.tags.map((t) => t.tag);
}

/** Get every subtag across all tags, deduplicated. */
export function getAllSubtags(entity: Entity): string[] {
    return [...new Set(entity.tags.flatMap((t) => t.subtags))];
}

// ─────────────────────────────────────────────
// Boolean checks
// ─────────────────────────────────────────────

/** Check whether an entity has a specific top-level tag. */
export function hasTag(entity: Entity, tag: string): boolean {
    return entity.tags.some((t) => t.tag === tag);
}

/** Check whether an entity has a specific subtag under a given tag. */
export function hasSubtag(
    entity: Entity,
    tag: string,
    subtag: string,
): boolean {
    return getTag(entity, tag)?.subtags.includes(subtag) ?? false;
}

/** Check whether an entity has a subtag anywhere, regardless of which tag owns it. */
export function hasSubtagAnywhere(entity: Entity, subtag: string): boolean {
    return entity.tags.some((t) => t.subtags.includes(subtag));
}

/** Returns true if the entity has no tags. */
export function isEmpty(entity: Entity): boolean {
    return entity.tags.length === 0;
}

// ─────────────────────────────────────────────
// Search & filtering
// ─────────────────────────────────────────────

/** Find all EntityTags that contain a given subtag. */
export function findTagsBySubtag(entity: Entity, subtag: string): EntityTag[] {
    return entity.tags.filter((t) => t.subtags.includes(subtag));
}

/** Filter an entity's tags down to only those matching the given tag names. */
export function filterTags(entity: Entity, tags: string[]): EntityTag[] {
    const set = new Set(tags);
    return entity.tags.filter((t) => set.has(t.tag));
}

/** Check that an entity has ALL of the specified tags. */
export function hasAllTags(entity: Entity, tags: string[]): boolean {
    return tags.every((tag) => hasTag(entity, tag));
}

/** Check that an entity has AT LEAST ONE of the specified tags. */
export function hasAnyTag(entity: Entity, tags: string[]): boolean {
    return tags.some((tag) => hasTag(entity, tag));
}

// ─────────────────────────────────────────────
// Merge & copy
// ─────────────────────────────────────────────

/**
 * Merge tags from `source` into `target`.
 * Existing tags in `target` have source's subtags appended (deduplicated).
 * New tags from `source` are added wholesale.
 */
export function mergeTags(target: Entity, source: Entity): void {
    for (const srcTag of source.tags) {
        const existing = getTag(target, srcTag.tag);
        if (existing) {
            const combined = new Set([...existing.subtags, ...srcTag.subtags]);
            existing.subtags = [...combined];
        } else {
            target.tags.push(new EntityTag(srcTag.tag, [...srcTag.subtags]));
        }
    }
}

/** Return a deep copy of an entity's tags as a new Entity. */
export function cloneTags(entity: Entity): Entity {
    return {
        tags: entity.tags.map((t) => new EntityTag(t.tag, [...t.subtags])),
    };
}

/** Clear all tags from an entity. */
export function clearTags(entity: Entity): void {
    entity.tags = [];
}

// ─────────────────────────────────────────────
// Serialisation helpers
// ─────────────────────────────────────────────

/**
 * Serialise tags to a flat record for easy storage/transport.
 * e.g. { "role": ["admin", "editor"], "status": ["active"] }
 */
export function tagsToRecord(entity: Entity): Record<string, string[]> {
    return Object.fromEntries(entity.tags.map((t) => [t.tag, t.subtags]));
}

/**
 * Rebuild an entity's tags from a flat record.
 * Replaces any existing tags.
 */
export function tagsFromRecord(
    entity: Entity,
    record: Record<string, string[]>,
): void {
    entity.tags = Object.entries(record).map(
        ([tag, subtags]) => new EntityTag(tag, subtags),
    );
}

export function tagKey(tag: string, subtag: string): string {
    return `${tag}:${subtag}`;
}

export function* tagKeys(entity: Entity): Iterable<string> {
    for (const { tag, subtags } of entity.tags) {
        for (const subtag of subtags) {
            yield tagKey(tag, subtag);
        }
    }
}
