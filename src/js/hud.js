import { createBindGroup, createBindGroupLayout, createPipeline, createVBAttributes } from "./wgpuHelpers";

export class HUD {
    static async generate(assetManager, device, format, projectionBuffer, multisamples) {
        const hud = new HUD();
        await hud.initialize(assetManager, device, format, projectionBuffer, multisamples);
        return hud;
    }

    constructor() {}

    async initialize(assetManager, device, format, projectionBuffer, multisamples) {
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

        // shaders
        const [hudVertexModule, hudFragmentModule] = await assetManager.get("shaders/hud.vert.wgsl", "shaders/hud.frag.wgsl");

        // bind group
        const hudBGL = createBindGroupLayout(device, "HUD BGL", { visibility: GPUShaderStage.VERTEX, buffer: {type: "uniform"}});
        this.bindGroup = createBindGroup(device, "HUD Bind Group", hudBGL, { buffer: projectionBuffer });

        // pipeline
        this.pipeline = createPipeline(
            "HUD Pipeline",
            device,
            hudBGL,
            hudVertexModule,
            2,
            hudVBAttributes,
            hudFragmentModule,
            format,
            "line-list",
            "none",
            false,
            multisamples
        );
    }
}