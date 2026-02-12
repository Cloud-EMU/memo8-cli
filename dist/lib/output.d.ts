import type { Project, Task, Memory, Tag, PaginationMeta, StatsData } from '../types/index.js';
export declare function success(message: string): void;
export declare function error(message: string): void;
export declare function warn(message: string): void;
export declare function info(message: string): void;
export declare function printTable(headers: string[], rows: string[][]): void;
export declare function printProjectList(projects: Project[]): void;
export declare function printTaskList(tasks: Task[]): void;
export declare function printMemoryList(memories: Memory[]): void;
export declare function printTagList(tags: Tag[]): void;
export declare function printProjectDetail(project: Project): void;
export declare function printTaskDetail(task: Task): void;
export declare function printMemoryDetail(memory: Memory): void;
export declare function printTagDetail(tag: Tag): void;
export declare function printPagination(meta?: PaginationMeta): void;
export declare function printStats(title: string, stats: StatsData): void;
export declare function handleError(err: unknown): void;
//# sourceMappingURL=output.d.ts.map