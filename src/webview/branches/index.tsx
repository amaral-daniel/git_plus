import { createRoot } from 'react-dom/client';
import { BranchPanel, Branch } from './BranchPanel';

declare global {
    interface Window {
        __BRANCHES__: Branch[];
    }
}

const root = document.getElementById('root')!;
createRoot(root).render(<BranchPanel branches={window.__BRANCHES__} />);
