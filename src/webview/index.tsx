import { createRoot } from 'react-dom/client';
import { GraphView } from './graph/GraphView';
import { CommitDetailsView, CommitDetailsData } from './commitDetails/CommitDetailsView';
import { BranchPanel, Branch } from './branches/BranchPanel';
import { GitCommit } from './types';

declare global {
    interface Window {
        __VIEW__: 'graph' | 'commitDetails' | 'branches';
        __COMMITS__: GitCommit[];
        __HAS_MORE__: boolean;
        __COMMIT_DETAILS__: CommitDetailsData;
        __BRANCHES__: Branch[];
    }
}

const root = document.getElementById('root')!;
const r = createRoot(root);

if (window.__VIEW__ === 'graph') {
    r.render(<GraphView commits={window.__COMMITS__} hasMore={window.__HAS_MORE__} />);
} else if (window.__VIEW__ === 'commitDetails') {
    r.render(<CommitDetailsView data={window.__COMMIT_DETAILS__} />);
} else if (window.__VIEW__ === 'branches') {
    r.render(<BranchPanel branches={window.__BRANCHES__} />);
}
