import * as GUI from "@babylonjs/gui";
import * as BABYLON from "@babylonjs/core";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface BentoCell {
    src: string;
    colSpan?: number;
    rowSpan?: number;
    /**
     * Override auto-detection. "image" = PNG/JPG/etc, "video" = MP4/WebM.
     * If omitted, inferred from the file extension.
     */
    type?: "image" | "video";
    /** Video-only: loop playback. Default: true */
    loop?: boolean;
    /** Video-only: mute audio. Default: true */
    muted?: boolean;
    /** Video-only: autoplay. Default: true */
    autoPlay?: boolean;
}

export interface BentoConfig {
    columns: number;
    rows: number;
    gap?: number;
    padding?: number;
    cornerRadius?: number;
    textureWidth?: number;
    textureHeight?: number;
    background?: string;

    /** Draw a border outline around each cell. */
    cellBorder?: {
        color?: string;
        thickness?: number;
        /** 0–1 opacity. Default: 0.35 */
        alpha?: number;
    };

    /** Staggered fade-in + upward slide on first appearance. */
    entrance?: {
        durationMs?: number;
        staggerMs?: number;
        slidePixels?: number;
    };

    /** Subtle idle float — cells gently bob up/down forever. */
    float?: { amplitudePx?: number; periodMs?: number; phaseOffsetMs?: number };
}

export interface BentoLayout {
    texture: GUI.AdvancedDynamicTexture;
    /**
     * Disposes all BABYLON.VideoTextures created by the layout.
     * Call this when the scene or parent mesh is torn down.
     */
    dispose: () => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const VIDEO_EXTS = new Set(["mp4", "webm", "ogg", "mov"]);

function isVideo(cell: BentoCell): boolean {
    if (cell.type) return cell.type === "video";
    const ext = cell.src.split(".").pop()?.toLowerCase() ?? "";
    return VIDEO_EXTS.has(ext);
}

// ─────────────────────────────────────────────
// Main function
// ─────────────────────────────────────────────

/**
 * Attaches a bento-box grid of mixed images and videos onto a BabylonJS plane.
 *
 * Video cells use BABYLON.VideoTexture, which is applied to an invisible
 * sub-plane parented to the main plane and positioned to match each grid slot.
 * Image cells continue to use GUI.Image inside the AdvancedDynamicTexture.
 *
 * Why a sub-plane for video?
 * GUI.Image only accepts a URL string — it has no path to receive a live
 * VideoTexture. The cleanest native solution is to layer a tiny plane mesh
 * per video cell, apply the VideoTexture as its StandardMaterial diffuse, and
 * position it to pixel-perfectly overlap the GUI slot. This is exactly how
 * BabylonJS Playground examples mix video with GUI overlays.
 *
 * @example
 * ```ts
 * const { texture, dispose } = createBentoLayout(plane, [
 *   { src: "/clips/intro.mp4", colSpan: 2, loop: true, muted: true },
 *   { src: "/images/thumb.png" },
 *   { src: "/clips/loop.mp4", rowSpan: 2 },
 *   { src: "/images/photo.png" },
 * ], {
 *   columns: 3, rows: 2,
 *   gap: 16, padding: 20, cornerRadius: 10,
 *   cellBorder: { color: "#fff", thickness: 1.5, alpha: 0.25 },
 *   entrance:   { durationMs: 380, staggerMs: 65, slidePixels: 20 },
 *   float:      { amplitudePx: 4, periodMs: 2800 },
 * });
 *
 * // On teardown:
 * dispose();
 * texture.dispose();
 * ```
 */
export function createBentoLayout(
    plane: BABYLON.AbstractMesh,
    cells: BentoCell[],
    config: BentoConfig,
): BentoLayout {
    const {
        columns,
        rows,
        gap = 12,
        padding = 0,
        cornerRadius = 0,
        textureWidth = 1024,
        textureHeight = 1024,
        background = "transparent",
        cellBorder,
        entrance,
        float: floatCfg,
    } = config;

    const scene = plane.getScene();

    // ── GUI texture + root (used for image cells + border overlays) ─
    const texture = GUI.AdvancedDynamicTexture.CreateForMesh(
        plane,
        textureWidth,
        textureHeight,
    );

    const root = new GUI.Rectangle("bentoRoot");
    root.width = "100%";
    root.height = "100%";
    root.thickness = 0;
    root.background = background;
    texture.addControl(root);

    // ── Grid math ─────────────────────────────────────────────────
    const usableW = textureWidth - padding * 2;
    const usableH = textureHeight - padding * 2;
    const cellW = (usableW - gap * (columns - 1)) / columns;
    const cellH = (usableH - gap * (rows - 1)) / rows;

    // Plane world dimensions — needed to convert texture-pixel offsets
    // into local-space positions for video sub-planes.
    const planeBounds = plane.getBoundingInfo().boundingBox;
    const planeW =
        planeBounds.maximumWorld.x - planeBounds.minimumWorld.x ||
        (plane as BABYLON.Mesh).scaling?.x ||
        1;
    const planeH =
        planeBounds.maximumWorld.y - planeBounds.minimumWorld.y ||
        (plane as BABYLON.Mesh).scaling?.y ||
        1;

    // Pixel-to-local-unit scale factors
    const pxToLocalX = planeW / textureWidth;
    const pxToLocalY = planeH / textureHeight;

    // ── Slot tracker ──────────────────────────────────────────────
    const occupied: boolean[][] = Array.from({ length: rows }, () =>
        Array(columns).fill(false),
    );

    function markOccupied(sc: number, sr: number, cs: number, rs: number) {
        for (let r = sr; r < sr + rs; r++)
            for (let c = sc; c < sc + cs; c++) occupied[r][c] = true;
    }

    function fits(col: number, row: number, cs: number, rs: number): boolean {
        if (col + cs > columns || row + rs > rows) return false;
        for (let r = row; r < row + rs; r++)
            for (let c = col; c < col + cs; c++)
                if (occupied[r][c]) return false;
        return true;
    }

    const placed: Array<{ rect: GUI.Rectangle; baseTop: number }> = [];
    const videoTextures: BABYLON.VideoTexture[] = [];
    const videoPlanes: BABYLON.Mesh[] = [];
    const floatObservers: BABYLON.Observer<BABYLON.Scene>[] = [];

    // ── Place cells ───────────────────────────────────────────────
    cells.forEach((cell, idx) => {
        const cSpan = Math.max(1, Math.round(cell.colSpan ?? 1));
        const rSpan = Math.max(1, Math.round(cell.rowSpan ?? 1));

        let didPlace = false;
        outer: for (let r = 0; r < rows; r++) {
            for (let c = 0; c < columns; c++) {
                if (!occupied[r][c] && fits(c, r, cSpan, rSpan)) {
                    placed.push(buildCell(cell, idx, c, r, cSpan, rSpan));
                    markOccupied(c, r, cSpan, rSpan);
                    didPlace = true;
                    break outer;
                }
            }
        }
        if (!didPlace)
            console.warn(
                `[createBentoLayout] Cell ${idx} ("${cell.src}") couldn't be placed.`,
            );
    });

    // ── Entrance animation ────────────────────────────────────────
    if (entrance) {
        const dur = entrance.durationMs ?? 350;
        const stagger = entrance.staggerMs ?? 50;
        const slide = entrance.slidePixels ?? 16;

        placed.forEach(({ rect, baseTop }, i) => {
            rect.alpha = 0;
            rect.top = baseTop + slide;

            let accDelay = 0,
                started = false,
                startTs = 0;
            const delay = i * stagger;

            const obs = scene.onBeforeRenderObservable.add(() => {
                if (!started) {
                    accDelay += scene.getEngine().getDeltaTime();
                    if (accDelay < delay) return;
                    started = true;
                    startTs = performance.now();
                }
                const t = Math.min((performance.now() - startTs) / dur, 1);
                const ease = 1 - Math.pow(1 - t, 3);
                rect.alpha = ease;
                rect.top = baseTop + slide * (1 - ease);
                if (t >= 1) scene.onBeforeRenderObservable.remove(obs);
            });
        });
    }

    // ── Float animation ───────────────────────────────────────────
    if (floatCfg) {
        const amp = floatCfg.amplitudePx ?? 4;
        const period = floatCfg.periodMs ?? 2600;
        const phaseShift = floatCfg.phaseOffsetMs ?? 280;

        placed.forEach(({ rect, baseTop }, i) => {
            const phase = (i * phaseShift * Math.PI * 2) / period;
            const obs = scene.onBeforeRenderObservable.add(() => {
                const t = (performance.now() / period) * Math.PI * 2;
                rect.top = baseTop + Math.sin(t + phase) * amp;
            });
            floatObservers.push(obs);
        });
    }

    // ── Build one tile ────────────────────────────────────────────
    function buildCell(
        cell: BentoCell,
        idx: number,
        col: number,
        row: number,
        cSpan: number,
        rSpan: number,
    ): { rect: GUI.Rectangle; baseTop: number } {
        const tileW = cellW * cSpan + gap * (cSpan - 1);
        const tileH = cellH * rSpan + gap * (rSpan - 1);

        const offsetX = padding + col * (cellW + gap);
        const offsetY = padding + row * (cellH + gap);

        // GUI coords are centre-relative to the texture
        const centreX = offsetX + tileW / 2 - textureWidth / 2;
        const centreY = offsetY + tileH / 2 - textureHeight / 2;

        // ── GUI container (border + clipping region) ──────────────
        const container = new GUI.Rectangle(`bentoCellRect_${idx}`);
        container.widthInPixels = tileW;
        container.heightInPixels = tileH;
        container.left = centreX;
        container.top = centreY;
        container.cornerRadius = cornerRadius;
        container.clipChildren = true;
        container.background = "transparent";

        if (cellBorder) {
            container.thickness = cellBorder.thickness ?? 1.5;
            container.color = cellBorder.color ?? "#ffffff";
            container.alpha = cellBorder.alpha ?? 0.35;
        } else {
            container.thickness = 0;
        }

        root.addControl(container);

        if (isVideo(cell)) {
            // For video cells, skip GUI.Image — attach a VideoTexture sub-plane instead.
            // The GUI container above still provides the border overlay.
            attachVideoPlane(cell, idx, offsetX, offsetY, tileW, tileH);
        } else {
            const img = new GUI.Image(`bentoImg_${idx}`, cell.src);
            img.width = "100%";
            img.height = "100%";
            img.stretch = GUI.Image.STRETCH_FILL;
            container.addControl(img);
        }

        return { rect: container, baseTop: centreY };
    }

    /**
     * Creates a child plane mesh that sits flush against the parent plane,
     * sized and positioned to match the grid slot, and applies a
     * BABYLON.VideoTexture as its diffuse map.
     *
     * Coordinate mapping:
     *   texture pixels (0,0) = top-left of the GUI texture
     *   local space    (0,0) = centre of the plane mesh
     *   Y axis is inverted between texture space and 3D local space
     */
    function attachVideoPlane(
        cell: BentoCell,
        idx: number,
        offsetX: number, // px from texture left edge to tile left edge
        offsetY: number, // px from texture top  edge to tile top  edge
        tileW: number,
        tileH: number,
    ) {
        // Sub-plane sized to exactly cover the grid slot
        const vPlane = BABYLON.MeshBuilder.CreatePlane(
            `bentoVideoPlane_${idx}`,
            { width: tileW * pxToLocalX, height: tileH * pxToLocalY },
            scene,
        );

        // Parent to the main plane so it inherits transform/rotation
        vPlane.parent = plane;

        // Local position: convert pixel centre → local units
        // X: left-edge px offset + half tile width, shifted to be 0-centred
        // Y: inverted because texture Y grows downward, 3D Y grows upward
        const localX = (offsetX + tileW / 2 - textureWidth / 2) * pxToLocalX;
        const localY = -(offsetY + tileH / 2 - textureHeight / 2) * pxToLocalY;

        vPlane.position = new BABYLON.Vector3(localX, localY, -0.001); // tiny Z offset to avoid z-fighting

        // BABYLON.VideoTexture — plays natively, GPU-decoded, no canvas blit
        const videoTex = new BABYLON.VideoTexture(
            `bentoVideoTex_${idx}`,
            cell.src,
            scene,
            /* generateMipMaps */ false,
            /* invertY */ false,
            BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
            {
                loop: cell.loop ?? true,
                autoPlay: cell.autoPlay ?? true,
                muted: cell.muted ?? true,
            },
        );

        videoTextures.push(videoTex);

        const mat = new BABYLON.StandardMaterial(`bentoVideoMat_${idx}`, scene);
        mat.diffuseTexture = videoTex;
        mat.emissiveColor = BABYLON.Color3.White(); // unlit — matches GUI brightness
        mat.backFaceCulling = false;
        mat.disableLighting = true;

        vPlane.material = mat;
        videoPlanes.push(vPlane);
    }

    // ── Disposer ──────────────────────────────────────────────────
    function dispose() {
        floatObservers.forEach((obs) =>
            scene.onBeforeRenderObservable.remove(obs),
        );
        videoTextures.forEach((vt) => vt.dispose());
        videoPlanes.forEach((vp) => vp.dispose());
    }

    return { texture, dispose };
}
