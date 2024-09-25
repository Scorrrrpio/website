import { createBindGroup, createBindGroupLayout, createPipeline, createVBAttributes } from "../wgpuHelpers";

export class HUDComponent {
    static async generate(assetManager, device, format, projectionBuffer, multisamples) {
        const hud = new HUDComponent();
        await hud.initialize(assetManager, device, format, projectionBuffer, multisamples);
        return hud;
    }

    constructor() {}

    async initialize(assetManager, device, format, projectionBuffer, multisamples) {
        // shaders
        const [vertPromise, fragPromise] = assetManager.get("shaders/hud.vert.wgsl", "shaders/hud.frag.wgsl");

        // TODO read from file
        // geometry
        const crosshair = new Float32Array([
            // X,    Y
            -0.02,    0,
            0.02,    0,
            0, -0.02,
            0,  0.02,
        ]);
        this.vertexCount = crosshair.length / 2;

        // vertex buffer
        this.vertexBuffer = device.createBuffer({
            label: "HUD Vertices",
            size: crosshair.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        device.queue.writeBuffer(this.vertexBuffer, 0, crosshair);
        const hudVBAttributes = createVBAttributes(["x", "y"]);

        // bind group
        const hudBGL = createBindGroupLayout(device, "HUD BGL", { visibility: GPUShaderStage.VERTEX, buffer: {type: "uniform"}});
        this.bindGroup = createBindGroup(device, "HUD Bind Group", hudBGL, { buffer: projectionBuffer });

        // pipeline
        this.pipeline = createPipeline(
            "HUD Pipeline",
            device,
            hudBGL,
            await vertPromise,
            2,
            hudVBAttributes,
            await fragPromise,
            format,
            "line-list",
            "none",
            false,
            multisamples
        );
    }
}