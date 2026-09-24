import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

export abstract class BaseRepository<T> {
    constructor(
        protected readonly db: NodePgDatabase,
        protected readonly table: any
    ) {}

    async create(data: Partial<T>): Promise<T> {
        const result = (await this.db.insert(this.table).values(data as any).returning()) as any[];
        return result[0] as T;
    }

    async findById(id: string): Promise<T | null> {
        const result = (await this.db.select().from(this.table).where(eq(this.table.id, id))) as any[];
        return (result[0] as T) || null;
    }

    async findAll(params?: any): Promise<T[]> {
        const result = (await this.db.select().from(this.table)) as any[];
        return result as T[];
    }

    async update(id: string, data: Partial<T>): Promise<T> {
        const result = (await this.db.update(this.table).set(data as any).where(eq(this.table.id, id)).returning()) as any[];
        return result[0] as T;
    }

    async delete(id: string): Promise<boolean> {
        const result = (await this.db.delete(this.table).where(eq(this.table.id, id)).returning()) as any[];
        return result.length > 0;
    }
}
