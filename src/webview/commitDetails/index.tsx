import { createRoot } from 'react-dom/client';
import { CommitDetailsView, CommitDetailsData } from './CommitDetailsView';

declare global {
    interface Window {
        __COMMIT_DETAILS__: CommitDetailsData;
    }
}

const root = document.getElementById('root')!;
createRoot(root).render(<CommitDetailsView data={window.__COMMIT_DETAILS__} />);
