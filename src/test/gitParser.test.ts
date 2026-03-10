import { describe, it, expect } from 'vitest';
import { parseGitLogOutput } from '../gitParser';

describe('parseGitLogOutput', () => {
    it('returns empty array for empty input', () => {
        expect(parseGitLogOutput('')).toEqual([]);
        expect(parseGitLogOutput('\n\n')).toEqual([]);
    });

    it('parses a single commit with no refs', () => {
        const line = 'abc123def456|abc123|parent111|Jane Doe|2024-01-15 10:30:00 +0000||Fix bug in parser';
        const [commit] = parseGitLogOutput(line);

        expect(commit.hash).toBe('abc123def456');
        expect(commit.shortHash).toBe('abc123');
        expect(commit.message).toBe('Fix bug in parser');
        expect(commit.author).toBe('Jane Doe');
        expect(commit.parents).toEqual(['parent111']);
        expect(commit.refs).toEqual([]);
    });

    it('parses a commit with HEAD and branch refs', () => {
        const line = 'abc123|abc|parent1|Alice|2024-01-15 10:00:00 +0000|HEAD -> main, origin/main|Initial commit';
        const [commit] = parseGitLogOutput(line);

        expect(commit.refs).toEqual(['HEAD -> main', 'origin/main']);
    });

    it('parses a merge commit with multiple parents', () => {
        const line = 'merge111|mer111|parent1 parent2|Bob|2024-01-15 12:00:00 +0000||Merge feature into main';
        const [commit] = parseGitLogOutput(line);

        expect(commit.parents).toEqual(['parent1', 'parent2']);
    });

    it('parses a commit message containing pipe characters', () => {
        const line = 'abc123|abc|parent1|Carol|2024-01-15 09:00:00 +0000||feat: add a|b|c support';
        const [commit] = parseGitLogOutput(line);

        expect(commit.message).toBe('feat: add a|b|c support');
    });

    it('parses multiple commits', () => {
        const input = [
            'hash1|sh1|par1|Alice|2024-01-15 10:00:00 +0000|HEAD -> main|First commit',
            'hash2|sh2|par2|Bob|2024-01-14 09:00:00 +0000||Second commit',
        ].join('\n');

        const commits = parseGitLogOutput(input);
        expect(commits).toHaveLength(2);
        expect(commits[0].hash).toBe('hash1');
        expect(commits[1].hash).toBe('hash2');
    });

    it('parses a root commit with no parent', () => {
        const line = 'root111|root11||Alice|2024-01-01 00:00:00 +0000||Initial commit';
        const [commit] = parseGitLogOutput(line);

        expect(commit.parents).toEqual([]);
    });

    it('trims whitespace from hash, author, and message', () => {
        const line = ' abc123 | abc | par1 | Alice Smith | 2024-01-15 10:00:00 +0000 | | Fix thing ';
        const [commit] = parseGitLogOutput(line);

        expect(commit.hash).toBe('abc123');
        expect(commit.author).toBe('Alice Smith');
        expect(commit.message).toBe('Fix thing');
    });

    it('parses tag refs correctly', () => {
        const line = 'abc123|abc|par1|Alice|2024-01-15 10:00:00 +0000|tag: v1.0.0, HEAD -> main|Release';
        const [commit] = parseGitLogOutput(line);

        expect(commit.refs).toEqual(['tag: v1.0.0', 'HEAD -> main']);
    });
});
