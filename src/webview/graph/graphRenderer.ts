import { GitCommit } from '../types';

export function calculateLanes(commits: GitCommit[]): Map<string, number> {
    const commitLanes = new Map<string, number>();
    const reservedLanes = new Map<string, number>();
    let nextLane = 0;

    for (const commit of commits) {
        let assignedLane: number;

        if (reservedLanes.has(commit.hash)) {
            assignedLane = reservedLanes.get(commit.hash)!;
            reservedLanes.delete(commit.hash);
        } else {
            assignedLane = nextLane++;
        }

        commitLanes.set(commit.hash, assignedLane);

        if (commit.parents.length > 0) {
            const firstParent = commit.parents[0];
            if (!reservedLanes.has(firstParent)) {
                reservedLanes.set(firstParent, assignedLane);
            }
            for (let j = 1; j < commit.parents.length; j++) {
                const parent = commit.parents[j];
                if (!reservedLanes.has(parent)) {
                    const usedLanes = new Set(reservedLanes.values());
                    let newLane = 0;
                    while (usedLanes.has(newLane)) { newLane++; }
                    reservedLanes.set(parent, newLane);
                    nextLane = Math.max(nextLane, newLane + 1);
                }
            }
        }
    }

    return commitLanes;
}

export function areCommitsConsecutive(commits: GitCommit[], sortedIndices: number[]): boolean {
    for (let i = 0; i < sortedIndices.length - 1; i++) {
        const newer = commits[sortedIndices[i]];
        const older = commits[sortedIndices[i + 1]];
        if (newer.parents.length !== 1 || !newer.parents.includes(older.hash)) {
            return false;
        }
    }
    return true;
}
