import { createRoot } from 'react-dom/client';
import { GraphView } from './GraphView';
import { GitCommit } from '../types';

declare global {
    interface Window {
        __COMMITS__: GitCommit[];
        __HAS_MORE__: boolean;
    }
}

const root = document.getElementById('root')!;
createRoot(root).render(<GraphView commits={window.__COMMITS__} hasMore={window.__HAS_MORE__} />);
