<script lang="ts">
  import { Cell, Universe, wasm_memory } from "../pkg/vite_rust_wasm";
  import { onMount, onDestroy } from 'svelte';
  import { Pane } from 'tweakpane';

  let canvas: HTMLCanvasElement;
  let universe: Universe;
  let animationId: number;
  let tickIntervalId: ReturnType<typeof setInterval>;
  let isDrawing = false;

  let params = {
    isPaused: false,
    scale: 1,
    tickSpeed: 100, // Default tick speed in milliseconds
    fps: 0, // For displaying FPS in graph
  };

  const CELL_SIZE = 10; // Base cell size in px
  const GRID_COLOR = "#DDDDDD";
  const DEAD_COLOR = "#FFFFFF";
  const ALIVE_COLOR = "#000000";

  function createPane(params: { isPaused: boolean, scale: number, tickSpeed: number, fps: number }) {
    const pane = new Pane({
      title: 'Game of Life',
      expanded: true,
    });
  
    pane.addButton({
      title: 'Pause/Resume',
    }).on('click', () => {
      togglePause();
    });
    pane.addBinding(params, 'scale', {
      label: 'Zoom',
      min: 1,
      max: 5,
      step: 0.1,
    });
    pane.addBinding(params, 'tickSpeed', {
      label: 'Tick Speed (ms)',
      min: 1,
      max: 5000,
      step: 100,
    }).on('change', (ev) => {
      updateTickSpeed(ev.value);
    });
    pane.addBinding(params, 'fps', {
      readonly: true,
      min: 0,
      // max: 60, // Assuming a max FPS of 60
    });
  }

  const getIndex = (row: number, col: number) => {
    return row * universe.width() + col;
  };

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const cellSize = CELL_SIZE * params.scale;
    ctx.beginPath();
    ctx.strokeStyle = GRID_COLOR;

    // Vertical lines.
    for (let i = 0; i <= universe.width(); i++) {
      ctx.moveTo(i * (cellSize + 1) + 1, 0);
      ctx.lineTo(i * (cellSize + 1) + 1, (cellSize + 1) * universe.height() + 1);
    }

    // Horizontal lines.
    for (let j = 0; j <= universe.height(); j++) {
      ctx.moveTo(0, j * (cellSize + 1) + 1);
      ctx.lineTo((cellSize + 1) * universe.width() + 1, j * (cellSize + 1) + 1);
    }

    ctx.stroke();
  };

  const drawCells = (ctx: CanvasRenderingContext2D) => {
    const cellSize = CELL_SIZE * params.scale;
    const cellsPtr = universe.cells();
    const cells = new Uint8Array(wasm_memory().buffer, cellsPtr, universe.width() * universe.height());

    ctx.beginPath();

    for (let row = 0; row < universe.height(); row++) {
      for (let col = 0; col < universe.width(); col++) {
        const idx = getIndex(row, col);
        ctx.fillStyle = cells[idx] === Cell.Dead ? DEAD_COLOR : ALIVE_COLOR;
        ctx.fillRect(
          col * (cellSize + 1) + 1,
          row * (cellSize + 1) + 1,
          cellSize,
          cellSize
        );
      }
    }

    ctx.stroke();
  };

  let lastFrameTimeStamp = performance.now();

  const renderLoop = (ctx: CanvasRenderingContext2D) => {
    const now = performance.now();
    const delta = now - lastFrameTimeStamp;
    lastFrameTimeStamp = now;
    params.fps = Math.round(1000 / delta);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx);
    drawCells(ctx);

    animationId = requestAnimationFrame(() => renderLoop(ctx));
  };

  const startTicking = () => {
    tickIntervalId = setInterval(() => {
      if (!params.isPaused) {
        universe.tick();
      }
    }, params.tickSpeed);
  };

  const stopTicking = () => {
    clearInterval(tickIntervalId);
  };

  const updateTickSpeed = (newSpeed: number) => {
    stopTicking();
    params.tickSpeed = newSpeed;
    startTicking();
  };

  const togglePause = () => {
    params.isPaused = !params.isPaused;
  };

  const handleCanvasClick = (event: MouseEvent) => {
    const boundingRect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / boundingRect.width;
    const scaleY = canvas.height / boundingRect.height;

    const canvasLeft = (event.clientX - boundingRect.left) * scaleX;
    const canvasTop = (event.clientY - boundingRect.top) * scaleY;

    const cellSize = CELL_SIZE * params.scale;
    const row = Math.min(Math.floor(canvasTop / (cellSize + 1)), universe.height() - 1);
    const col = Math.min(Math.floor(canvasLeft / (cellSize + 1)), universe.width() - 1);

    universe.set_alive(row, col);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx);
    drawCells(ctx);
  };

  const handleMouseDown = (event: MouseEvent) => {
    isDrawing = true;
    handleCanvasClick(event);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (isDrawing) {
      handleCanvasClick(event);
    }
  };

  const handleMouseUp = () => {
    isDrawing = false;
  };

  const handleScroll = (event: WheelEvent) => {
    if (event.deltaY < 0) {
      params.scale = Math.min(params.scale + 0.1, 5); // Zoom in
    } else {
      params.scale = Math.max(params.scale - 0.1, 1); // Zoom out
    }
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.save();
    ctx.scale(params.scale, params.scale);
    drawGrid(ctx);
    drawCells(ctx);
    ctx.restore();
  };

  onMount(() => {
    createPane(params);
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space') {
        togglePause();
      }
    });
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('wheel', handleScroll);

    resizeCanvas();
    universe = Universe.new(canvas.width / CELL_SIZE + 1, canvas.height / CELL_SIZE + 1);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    drawGrid(ctx);
    drawCells(ctx);
    animationId = requestAnimationFrame(() => renderLoop(ctx));
    startTicking();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', togglePause);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('wheel', handleScroll);
      cancelAnimationFrame(animationId);
      stopTicking();
    };
  });
</script>

<main>
  <canvas id="canvas" width="400" height="400" bind:this={canvas}></canvas>
</main>

<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: 'Arial', sans-serif;
    background-color: #f0f0f0;
  }
  canvas {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>