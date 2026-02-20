import React, { useEffect, useRef } from 'react';
import { RowGraphData } from './graphRenderer';

const COLORS = [
    '#e8832a', '#3d9fd4', '#4faa5e', '#c75dd3', '#e05c5c',
    '#1abc9c', '#9b59b6', '#e8b84b', '#16a085', '#d35400',
];
const LANE_WIDTH = 18;
const ROW_HEIGHT = 28;
const COMMIT_RADIUS = 5;
const LINE_WIDTH = 2;

// Snap to half-pixel so 1-2px lines land exactly on pixel boundaries
const px = (v: number) => Math.round(v) + 0.5;

interface Props {
    lane: number;
    canvasWidth: number;
    isHead: boolean;
    rowGraphData: RowGraphData;
}

export const GraphCanvas = React.memo(function GraphCanvas({
    lane, canvasWidth, isHead, rowGraphData,
}: Props) {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) { return; }

        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvasWidth * dpr;
        canvas.height = ROW_HEIGHT * dpr;

        const ctx = canvas.getContext('2d')!;
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = false;

        const color = COLORS[lane % COLORS.length];
        const x = px(lane * LANE_WIDTH + 10);
        const y = ROW_HEIGHT / 2;

        // 1. Passthrough lines for lanes active at this row (precomputed)
        for (const pl of rowGraphData.passthroughLanes) {
            const plx = px(pl * LANE_WIDTH + 10);
            ctx.strokeStyle = COLORS[pl % COLORS.length];
            ctx.lineWidth = LINE_WIDTH;
            ctx.beginPath();
            ctx.moveTo(plx, 0);
            ctx.lineTo(plx, ROW_HEIGHT);
            ctx.stroke();
        }

        // 2. This commit's lane line
        ctx.strokeStyle = color;
        ctx.lineWidth = LINE_WIDTH;
        if (rowGraphData.hasIncoming) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y); ctx.stroke();
        }
        if (rowGraphData.hasOutgoing) {
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, ROW_HEIGHT); ctx.stroke();
        }

        // 3. Merge/branch bezier connections (precomputed)
        ctx.strokeStyle = color;
        ctx.lineWidth = LINE_WIDTH;
        for (const childLane of rowGraphData.mergeIncomingFromLanes) {
            const childX = px(childLane * LANE_WIDTH + 10);
            ctx.beginPath();
            ctx.moveTo(childX, 0);
            ctx.bezierCurveTo(childX, y, x, 0, x, y);
            ctx.stroke();
        }
        for (const parentLane of rowGraphData.mergeOutgoingToLanes) {
            const parentX = px(parentLane * LANE_WIDTH + 10);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.bezierCurveTo(x, ROW_HEIGHT, parentX, y, parentX, ROW_HEIGHT);
            ctx.stroke();
        }

        // 4. Commit dot (drawn last, on top)
        const dotX = Math.round(lane * LANE_WIDTH + 10);
        const dotY = Math.round(y);
        if (isHead) {
            ctx.clearRect(dotX - COMMIT_RADIUS - 1, dotY - COMMIT_RADIUS - 1, (COMMIT_RADIUS + 1) * 2, (COMMIT_RADIUS + 1) * 2);
            ctx.strokeStyle = color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(dotX, dotY, COMMIT_RADIUS, 0, 2 * Math.PI); ctx.stroke();
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(dotX, dotY, 2, 0, 2 * Math.PI); ctx.fill();
        } else {
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(dotX, dotY, COMMIT_RADIUS, 0, 2 * Math.PI); ctx.fill();
        }
    }, [lane, canvasWidth, isHead, rowGraphData]);

    return (
        <canvas
            ref={ref}
            style={{ display: 'block', width: canvasWidth, height: ROW_HEIGHT }}
        />
    );
});
