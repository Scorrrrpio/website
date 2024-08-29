// TODO big review
export function generateHUD(device, format, projectionBuffer, multisamples) {
    // geometry
    const crosshair = new Float32Array([
        // X,    Y
        -0.02,    0,
         0.02,    0,
           0, -0.02,
           0,  0.02,
    ]);

    // vertex buffer
    const hudVB = device.createBuffer({
		label: "HUD Vertices",
		size: crosshair.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
	});

    device.queue.writeBuffer(hudVB, 0, crosshair);

    // shaders
    const hudVertexShaderCode = `
    @group(0) @binding(0) var<uniform> projection: mat4x4<f32>;

    @vertex
    fn vertexMain(@location(0) pos: vec2f) -> @builtin(position) vec4f {
        return projection * vec4f(pos, -3, 1);
    }`;
    const hudFragmentShaderCode = `
    @fragment
    fn fragmentMain (@builtin(position) pos: vec4f) -> @location(0) vec4f {
        return vec4f(1, 1, 1, 1);
    }`;
    const hudVertexShaderModule = device.createShaderModule({
        label: "HUD Vertex Shader",
        code: hudVertexShaderCode
    });
    const hudFragmentShaderModule = device.createShaderModule({
        label: "HUD Fragment Shader",
        code: hudFragmentShaderCode
    });

    // bind group
    const hudBGL = device.createBindGroupLayout({
        label: "HUD Bind Group Layout",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: "uniform" },
            },
        ],
    });
    const hudBG = device.createBindGroup({
        label: "HUD bind group",
        layout: hudBGL,
        entries: [{
            binding: 0,
            resource: { buffer: projectionBuffer },
        }],
    });

    // pipeline
	const hudPipeline = device.createRenderPipeline({
		label: "HUD Pipeline",
		layout: device.createPipelineLayout({
            label: "HUD Pipeline Layout",
            bindGroupLayouts: [hudBGL],
        }),
		vertex: {
			module: hudVertexShaderModule,
			entryPoint: "vertexMain",
			buffers: [{
				arrayStride: 4 * 2 /*bytes*/,
				attributes: [
                    {
                        format: "float32x2",
                        offset: 0,
                        shaderLocation: 0
                    },
                ]
			}],
		},
		fragment: {
			module: hudFragmentShaderModule,
			entryPoint: "fragmentMain",
			targets: [{
				format: format,
			}]
		},
		primitive: {
			topology: "line-list"
		},
        depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "always",
        },
        multisample: {
            count: multisamples,
        },
	});

    const hudObject = {
        pipeline: hudPipeline,
        bindGroup: hudBG,
        vertexBuffer: hudVB,
        vertexCount: crosshair.length / 2,
    }

    return hudObject;
}