import React, { useRef, useEffect, useCallback, memo, useImperativeHandle, forwardRef } from 'react';
import { stopDvrPreview } from '../services/api';

const API_HOST = window.location.hostname;
const DEFAULT_FRAME = { width: 1280, height: 720 };

/**
 * Background layer — polls DVR frames and updates ONLY the <img> via ref.
 * No React state updates per frame, so the overlay never re-renders.
 */
const CameraFrameLayer = memo(function CameraFrameLayer({
  channelId,
  snapshotUrl,
  useLegacySnapshot,
  onDimensionsReady,
  onFirstFrame,
  onUnmount,
}) {
  const imgRef = useRef(null);
  const frameTimerRef = useRef(null);
  const lastObjectUrlRef = useRef(null);
  const dimensionsSetRef = useRef(false);
  const pollGenRef = useRef(0);
  const activeChannelRef = useRef(channelId);

  const revokeLastUrl = () => {
    if (lastObjectUrlRef.current) {
      URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = null;
    }
  };

  const clearBackgroundImage = useCallback(() => {
    const img = imgRef.current;
    if (img) {
      img.removeAttribute('src');
    }
    revokeLastUrl();
  }, []);

  const applyFrameUrl = useCallback(
    (url, naturalWidth, naturalHeight, expectedChannel) => {
      if (expectedChannel !== activeChannelRef.current) return;

      const img = imgRef.current;
      if (!img) return;

      img.src = url;

      if (!dimensionsSetRef.current && naturalWidth && naturalHeight) {
        dimensionsSetRef.current = true;
        onDimensionsReady?.({ width: naturalWidth, height: naturalHeight });
      }
      onFirstFrame?.();
    },
    [onDimensionsReady, onFirstFrame]
  );

  const loadBlobFrame = useCallback(
    (blob, expectedChannel) => {
      if (!blob?.size || expectedChannel !== activeChannelRef.current) return;

      const url = URL.createObjectURL(blob);
      const probe = new Image();
      probe.onload = () => {
        if (expectedChannel !== activeChannelRef.current) {
          URL.revokeObjectURL(url);
          return;
        }
        revokeLastUrl();
        lastObjectUrlRef.current = url;
        applyFrameUrl(url, probe.naturalWidth, probe.naturalHeight, expectedChannel);
      };
      probe.onerror = () => URL.revokeObjectURL(url);
      probe.src = url;
    },
    [applyFrameUrl]
  );

  useEffect(() => {
    if (useLegacySnapshot || !channelId) return undefined;

    activeChannelRef.current = channelId;
    dimensionsSetRef.current = false;
    const pollGen = ++pollGenRef.current;
    clearBackgroundImage();

    const pollFrame = async () => {
      if (pollGen !== pollGenRef.current) return;

      try {
        const res = await fetch(
          `http://${API_HOST}:8000/dvr/frame/${channelId}?t=${Date.now()}`
        );
        if (pollGen !== pollGenRef.current) return;
        if (res.status === 204 || !res.ok) return;

        const blob = await res.blob();
        if (pollGen !== pollGenRef.current) return;
        if (blob.size) loadBlobFrame(blob, channelId);
      } catch (e) {
        if (pollGen === pollGenRef.current) {
          console.warn('Frame poll failed', e);
        }
      }
    };

    pollFrame();
    frameTimerRef.current = setInterval(pollFrame, 500);

    return () => {
      pollGenRef.current += 1;
      if (frameTimerRef.current) {
        clearInterval(frameTimerRef.current);
        frameTimerRef.current = null;
      }
      clearBackgroundImage();
      onUnmount?.();
    };
  }, [channelId, useLegacySnapshot, loadBlobFrame, clearBackgroundImage, onUnmount]);

  useEffect(() => {
    if (!useLegacySnapshot || !snapshotUrl) return undefined;

    dimensionsSetRef.current = false;
    const img = imgRef.current;
    if (!img) return undefined;

    const handleLoad = () => {
      if (!dimensionsSetRef.current) {
        dimensionsSetRef.current = true;
        onDimensionsReady?.({
          width: img.naturalWidth || DEFAULT_FRAME.width,
          height: img.naturalHeight || DEFAULT_FRAME.height,
        });
      }
      onFirstFrame?.();
    };

    img.addEventListener('load', handleLoad);
    img.src = snapshotUrl;

    return () => img.removeEventListener('load', handleLoad);
  }, [useLegacySnapshot, snapshotUrl, onDimensionsReady, onFirstFrame]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        overflow: 'hidden',
      }}
    >
      <img
        ref={imgRef}
        alt="Camera preview"
        draggable={false}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
    </div>
  );
});

/**
 * Line overlay — separate layer. Canvas sized once; line redrawn on coord changes only.
 */
const LineDrawOverlay = memo(function LineDrawOverlay({
  dimensions,
  lineCoords,
  onLineStart,
  onLineMove,
  onLineEnd,
}) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);

  const getCanvasCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dimensions) return;
    if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
    }
  }, [dimensions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dimensions) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = dimensions;
    ctx.clearRect(0, 0, width, height);

    const { x1, y1, x2, y2 } = lineCoords;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#00E5FF';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00E5FF';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x1, y1, 8, 0, 2 * Math.PI);
    ctx.arc(x2, y2, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#ff0055';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#ff0055';
    ctx.fill();
  }, [dimensions, lineCoords]);

  const handleMouseDown = (e) => {
    isDrawingRef.current = true;
    onLineStart?.(getCanvasCoords(e));
  };

  const handleMouseMove = (e) => {
    if (!isDrawingRef.current) return;
    onLineMove?.(getCanvasCoords(e));
  };

  const handleMouseUp = () => {
    isDrawingRef.current = false;
    onLineEnd?.();
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 2,
        cursor: 'crosshair',
        background: 'transparent',
        touchAction: 'none',
      }}
    />
  );
});

const LineDrawViewer = forwardRef(function LineDrawViewer(
  { channelId, snapshotUrl, useLegacySnapshot, initialLineCoords },
  ref
) {
  const [dimensions, setDimensions] = React.useState(null);
  const [hasFrame, setHasFrame] = React.useState(false);
  const [lineCoords, setLineCoords] = React.useState(
    initialLineCoords || { x1: 50, y1: 200, x2: 590, y2: 200 }
  );
  const lineCoordsRef = useRef(lineCoords);

  useEffect(() => {
    lineCoordsRef.current = lineCoords;
  }, [lineCoords]);

  useEffect(() => {
    if (initialLineCoords) {
      setLineCoords(initialLineCoords);
    }
    setDimensions(null);
    setHasFrame(false);
  }, [channelId, snapshotUrl]);

  const handlePreviewUnmount = useCallback(() => {
    if (!useLegacySnapshot) {
      stopDvrPreview().catch(() => {});
    }
  }, [useLegacySnapshot]);

  useImperativeHandle(ref, () => ({
    getLineCoords: () => lineCoordsRef.current,
  }));

  const handleDimensionsReady = useCallback((dims) => {
    setDimensions(dims);
  }, []);

  const handleFirstFrame = useCallback(() => {
    setHasFrame(true);
  }, []);

  const handleLineStart = useCallback((coords) => {
    setLineCoords({
      x1: coords.x,
      y1: coords.y,
      x2: coords.x,
      y2: coords.y,
    });
  }, []);

  const handleLineMove = useCallback((coords) => {
    setLineCoords((prev) => ({
      x1: prev.x1,
      y1: prev.y1,
      x2: coords.x,
      y2: coords.y,
    }));
  }, []);

  const activeDimensions = dimensions || DEFAULT_FRAME;

  return (
    <div
      style={{
        border: '2px dashed var(--glass-border)',
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative',
        background: '#000',
        width: '100%',
        maxWidth: '1280px',
        margin: '0 auto',
        minHeight: '360px',
        aspectRatio: `${activeDimensions.width} / ${activeDimensions.height}`,
      }}
    >
      {!hasFrame && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            zIndex: 0,
            pointerEvents: 'none',
            fontSize: '0.95rem',
          }}
        >
          Waiting for camera frame...
        </div>
      )}

      <CameraFrameLayer
        channelId={channelId}
        snapshotUrl={snapshotUrl}
        useLegacySnapshot={useLegacySnapshot}
        onDimensionsReady={handleDimensionsReady}
        onFirstFrame={handleFirstFrame}
        onUnmount={handlePreviewUnmount}
      />

      <LineDrawOverlay
        dimensions={dimensions}
        lineCoords={lineCoords}
        onLineStart={handleLineStart}
        onLineMove={handleLineMove}
        onLineEnd={() => {}}
      />
    </div>
  );
});

export default LineDrawViewer;
