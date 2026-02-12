export interface User {
    id: number;
    name: string;
    email: string;
}
export interface AuthData {
    user: User;
    token: string;
    tokenType: string;
}
export interface Project {
    id: number;
    name: string;
    description: string | null;
    status: 'active' | 'archived' | 'completed';
    userId: number;
    tasksCount?: number;
    memoriesCount?: number;
    createdAt: string;
    updatedAt: string;
}
export interface Task {
    id: number;
    title: string;
    description: string | null;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    projectId: number;
    parentTaskId: number | null;
    userId: number;
    project?: Project;
    tags?: Tag[];
    memories?: Memory[];
    subtasks?: Task[];
    parent?: Task;
    createdAt: string;
    updatedAt: string;
}
export interface Memory {
    id: number;
    title: string;
    content: string;
    type: 'note' | 'snippet' | 'link' | 'file' | 'image';
    projectId: number;
    userId: number;
    project?: Project;
    tags?: Tag[];
    tasks?: Task[];
    taskIds?: number[];
    tagIds?: number[];
    metadata?: {
        code_flow?: string[];
        [key: string]: unknown;
    } | null;
    createdAt: string;
    updatedAt: string;
}
export interface Tag {
    id: number;
    name: string;
    color: string | null;
    description: string | null;
    userId: number;
    tasksCount?: number;
    memoriesCount?: number;
    createdAt: string;
    updatedAt: string;
}
export interface PaginationMeta {
    currentPage: number;
    from: number | null;
    lastPage: number;
    perPage: number;
    to: number | null;
    total: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    meta: PaginationMeta;
    links: {
        first: string;
        last: string;
        prev: string | null;
        next: string | null;
    };
}
export interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
}
export interface StatsData {
    [key: string]: number;
}
export interface GlobalConfig {
    apiUrl?: string;
    token?: string;
    user?: User;
}
export interface LocalConfig {
    projectId?: number;
    projectName?: string;
}
export type AiPlanStatus = 'generating' | 'ready' | 'approved' | 'modified' | 'rejected';
export interface PlanSubtask {
    title: string;
    priority?: string;
}
export interface PlanTask {
    title: string;
    description?: string;
    priority?: string;
    subtasks?: PlanSubtask[];
}
export interface PlanSection {
    name: string;
    description?: string;
    tasks: PlanTask[];
}
export interface PlanData {
    projectSummary?: string;
    sections: PlanSection[];
    estimatedTotalTasks?: number;
}
export interface AiPlan {
    id: number;
    prompt: string;
    planData: PlanData | null;
    status: AiPlanStatus;
    conversation: Array<{
        role: string;
        content: string;
    }> | null;
    approvedAt: string | null;
    projectId: number;
    project?: Project;
    createdAt: string;
    updatedAt: string;
}
export interface PlanUsage {
    used: number;
    limit: number;
    remaining: number;
}
export interface DependencyItem {
    name: string;
    version: string;
    type: string;
}
export interface StackSection {
    language: string;
    languageVersion?: string;
    dependencies: DependencyItem[];
    devDependencies: DependencyItem[];
}
export interface FrameworkInfo {
    name: string;
    version: string;
    type: string;
}
export interface TechStackData {
    sections: StackSection[];
    frameworks: FrameworkInfo[];
}
export interface DependencyNote {
    id: number;
    techStackId: number;
    packageName: string;
    note: string;
    createdAt: string;
    updatedAt: string;
}
export interface TechStack {
    id: number;
    projectId: number;
    stackData: TechStackData | null;
    parsedAt: string | null;
    dependencyNotes?: DependencyNote[];
    createdAt: string;
    updatedAt: string;
}
export interface CodeSymbol {
    id: number;
    symbolName: string;
    symbolType: string;
    signature: string | null;
    namespace: string | null;
    startLine: number | null;
    endLine: number | null;
}
export interface CodebaseFile {
    id: number;
    filePath: string;
    fileHash: string;
    language: string | null;
    fileType: string;
    contentSummary: string | null;
    lastIndexedAt: string | null;
    codeSymbols?: CodeSymbol[];
}
export interface IndexStatus {
    status: string;
    progress: number;
    total: number;
    message: string;
}
export interface Convention {
    id: number;
    projectId: number;
    category: string;
    title: string;
    description: string;
    codeExample: string | null;
    antiPatternExample: string | null;
    source: string;
    confidenceScore: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface Decision {
    id: number;
    projectId: number;
    userId: number;
    title: string;
    context: string;
    decision: string;
    alternatives: Array<{
        option: string;
        reason: string;
    }> | null;
    consequences: string | null;
    status: string;
    supersededBy: number | null;
    tags: string[] | null;
    createdAt: string;
    updatedAt: string;
}
export interface Snippet {
    id: number;
    projectId: number;
    title: string;
    description: string | null;
    language: string | null;
    code: string;
    tags: string[] | null;
    usageCount: number;
    createdAt: string;
    updatedAt: string;
}
export interface TestPattern {
    id: number;
    projectId: number;
    patternName: string;
    testType: string;
    description: string | null;
    templateCode: string;
    applicableTo: string[] | null;
    createdAt: string;
    updatedAt: string;
}
export interface Checkpoint {
    id: number;
    projectId: number;
    taskId: number | null;
    name: string;
    description: string | null;
    snapshotData: Record<string, unknown> | null;
    gitCommitHash: string | null;
    gitBranch: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
}
export interface AIContext {
    context: string;
    tokenEstimate: number;
}
export interface DependencyGraphNode {
    id: number;
    title: string;
    status: string;
    dependsOn: number[];
    executionOrder: number | null;
}
//# sourceMappingURL=index.d.ts.map