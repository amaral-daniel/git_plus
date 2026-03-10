export interface GitCommit {
    hash: string;
    shortHash: string;
    message: string;
    date: string;
    author: string;
    parents: string[];
    refs: string[];
}

export function parseGitLogOutput(stdout: string): GitCommit[] {
    return stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
            const [fullHash, shortHash, parents, author, date, refs, ...messageParts] = line.split('|');
            const refList = refs
                .trim()
                .split(',')
                .map((r) => r.trim())
                .filter((r) => r);
            return {
                hash: fullHash.trim(),
                shortHash: shortHash.trim(),
                message: messageParts.join('|').trim(),
                date: new Date(date).toLocaleString(),
                author: author.trim(),
                parents: parents
                    .trim()
                    .split(' ')
                    .map((p) => p.trim())
                    .filter((p) => p),
                refs: refList,
            };
        });
}
