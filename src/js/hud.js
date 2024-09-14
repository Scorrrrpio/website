import { createBindGroup, createBindGroupLayout, createPipeline, createShaderModule, createVBAttributes } from "./wgpuHelpers";

export async function generateHUD(device, format, projectionBuffer, multisamples) {
    // geometry
    const crosshair = new Float32Array([
        // X,    Y
        -0.00015,    0,
         0.00015,    0,
           0, -0.00015,
           0,  0.00015,
    ]);

    // vertex buffer
    const hudVB = device.createBuffer({
		label: "HUD Vertices",
		size: crosshair.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
	});
    device.queue.writeBuffer(hudVB, 0, crosshair);
    const hudVBAttributes = createVBAttributes(["x", "y"]);

    // shaders
    // TODO crosshair size is defined in shaders using z position
    const [hudVertexModule, hudFragmentModule] = await Promise.all([
        createShaderModule(device, "shaders/hud.vert.wgsl", "HUD Vertex"),
        createShaderModule(device, "shaders/hud.frag.wgsl", "HUD Fragment")
    ]);

    // bind group
    const hudBGL = createBindGroupLayout(device, "HUD BGL", { visibility: GPUShaderStage.VERTEX, buffer: {type: "uniform"}});
    const hudBG = createBindGroup(device, "HUD Bind Group", hudBGL, { buffer: projectionBuffer });

    // pipeline
    const hudPipeline = createPipeline(
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
        true,
        multisamples
    );

    const hudObject = {
        pipeline: hudPipeline,
        bindGroup: hudBG,
        vertexBuffer: hudVB,
        vertexCount: crosshair.length / 2,
    }

    return hudObject;
}