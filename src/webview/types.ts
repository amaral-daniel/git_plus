// Must match the GitCommit interface in gitOperations.ts
export interface GitCommit {
    hash: string;
    shortHash: string;
    message: string;
    date: string;
    author: string;
    parents: string[];
    refs: string[];
}
