import { GitCommit } from '../types';

export interface RowGraphData {
    passthroughLanes: number[];
    hasIncoming: boolean;
    hasOutgoing: boolean;
    mergeIncomingFromLanes: number[];
    mergeOutgoingToLanes: number[];
}

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

// Precomputes all per-row rendering data in a single O(n * avg_connections) pass,
// eliminating the O(n²) work previously done inside each GraphCanvas useEffect.
export function calculateRowGraphData(
    commits: GitCommit[],
    commitLanes: Map<string, number>,
): RowGraphData[] {
    const n = commits.length;
    if (n === 0) { return []; }

    const commitIndex = new Map<string, number>();
    commits.forEach((c, i) => commitIndex.set(c.hash, i));

    // Build reverse map: commit hash → indices of commits that have it as a parent
    const childMap = new Map<string, number[]>();
    for (let i = 0; i < n; i++) {
        for (const parent of commits[i].parents) {
            let arr = childMap.get(parent);
            if (!arr) { arr = []; childMap.set(parent, arr); }
            arr.push(i);
        }
    }

    const passthroughSets: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
    const rows: RowGraphData[] = commits.map(() => ({
        passthroughLanes: [],
        hasIncoming: false,
        hasOutgoing: false,
        mergeIncomingFromLanes: [],
        mergeOutgoingToLanes: [],
    }));

    for (let i = 0; i < n; i++) {
        const commit = commits[i];
        const lane = commitLanes.get(commit.hash)!;

        // hasIncoming: any child commit above (index < i) connects to this commit
        rows[i].hasIncoming = (childMap.get(commit.hash) ?? []).some(j => j < i);

        for (const parent of commit.parents) {
            const j = commitIndex.get(parent);
            if (j === undefined || j <= i) { continue; }

            rows[i].hasOutgoing = true;
            const parentLane = commitLanes.get(parent)!;

            // Mark parent's lane as a passthrough for all rows between child and parent
            for (let r = i + 1; r < j; r++) {
                passthroughSets[r].add(parentLane);
            }

            // Record bezier endpoints when lanes differ
            if (parentLane !== lane) {
                rows[i].mergeOutgoingToLanes.push(parentLane);
                rows[j].mergeIncomingFromLanes.push(lane);
            }
        }
    }

    // Finalise passthrough lanes, excluding each row's own commit lane
    for (let r = 0; r < n; r++) {
        const commitLane = commitLanes.get(commits[r].hash)!;
        rows[r].passthroughLanes = Array.from(passthroughSets[r]).filter(l => l !== commitLane);
    }

    return rows;
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
