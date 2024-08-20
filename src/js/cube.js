// imports
import { lerpVector } from "./lerp";
import { wgpuSetup } from "./wgpuSetup";

export async function cube() {
    // WEBGPU SETUP
	const canvas = document.querySelector("canvas");
    const { adapter, device, context, format } = await wgpuSetup(canvas);


    // GEOMETRY
    /* X,    Y,    Z,   R,   G,   B,   A
     0.5,  0.5,  0.5, 1.0, 1.0, 1.0, 1.0,  // 1
     0.5,  0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 2
     0.5, -0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 3
     0.5, -0.5, -0.5, 0.0, 0.0, 1.0, 1.0,  // 4
    -0.5,  0.5,  0.5, 1.0, 1.0, 0.0, 1.0,  // 5
    -0.5,  0.5, -0.5, 1.0, 0.0, 1.0, 1.0,  // 6
    -0.5, -0.5,  0.5, 0.0, 1.0, 1.0, 1.0,  // 7
    -0.5, -0.5, -0.5, 1.0, 1.0, 1.0, 1.0,  // 8
    */
    const vertices = new Float32Array([
        // X,    Y,    Z,   R,   G,   B,   A
        // FRONT
        -0.5, -0.5, -0.5, 1.0, 1.0, 1.0, 1.0,  // 8
         0.5, -0.5, -0.5, 0.0, 0.0, 1.0, 1.0,  // 4
        -0.5,  0.5, -0.5, 1.0, 0.0, 1.0, 1.0,  // 6
         0.5,  0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 2
        -0.5,  0.5, -0.5, 1.0, 0.0, 1.0, 1.0,  // 6
         0.5, -0.5, -0.5, 0.0, 0.0, 1.0, 1.0,  // 4
        // RIGHT
         0.5, -0.5, -0.5, 0.0, 0.0, 1.0, 1.0,  // 4
         0.5, -0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 3
         0.5,  0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 2
         0.5,  0.5,  0.5, 1.0, 1.0, 1.0, 1.0,  // 1
         0.5,  0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 2
         0.5, -0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 3
        // BACK
         0.5, -0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 3
        -0.5, -0.5,  0.5, 0.0, 1.0, 1.0, 1.0,  // 7
         0.5,  0.5,  0.5, 1.0, 1.0, 1.0, 1.0,  // 1
        -0.5,  0.5,  0.5, 1.0, 1.0, 0.0, 1.0,  // 5
         0.5,  0.5,  0.5, 1.0, 1.0, 1.0, 1.0,  // 1
        -0.5, -0.5,  0.5, 0.0, 1.0, 1.0, 1.0,  // 7
        // LEFT
        -0.5, -0.5,  0.5, 0.0, 1.0, 1.0, 1.0,  // 7
        -0.5, -0.5, -0.5, 1.0, 1.0, 1.0, 1.0,  // 8
        -0.5,  0.5,  0.5, 1.0, 1.0, 0.0, 1.0,  // 5
        -0.5,  0.5, -0.5, 1.0, 0.0, 1.0, 1.0,  // 6
        -0.5,  0.5,  0.5, 1.0, 1.0, 0.0, 1.0,  // 5
        -0.5, -0.5, -0.5, 1.0, 1.0, 1.0, 1.0,  // 8
        // TOP
        -0.5,  0.5, -0.5, 1.0, 0.0, 1.0, 1.0,  // 6
         0.5,  0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 2
        -0.5,  0.5,  0.5, 1.0, 1.0, 0.0, 1.0,  // 5
         0.5,  0.5,  0.5, 1.0, 1.0, 1.0, 1.0,  // 1
        -0.5,  0.5,  0.5, 1.0, 1.0, 0.0, 1.0,  // 5
         0.5,  0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 2
        // BOTTOM
        -0.5, -0.5,  0.5, 0.0, 1.0, 1.0, 1.0,  // 7
         0.5, -0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 3
        -0.5, -0.5, -0.5, 1.0, 1.0, 1.0, 1.0,  // 8
         0.5, -0.5, -0.5, 0.0, 0.0, 1.0, 1.0,  // 4
        -0.5, -0.5, -0.5, 1.0, 1.0, 1.0, 1.0,  // 8
         0.5, -0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 3
    ]);

    // create vertex buffer
	const vertexBuffer = device.createBuffer({
		label: "Cube Vertices",
		size: vertices.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
	});

    // copy vertex data into vertex buffer
	device.queue.writeBuffer(vertexBuffer, 0, vertices);

    // define vertex layout
	const vertexBufferLayout = {
		arrayStride: 4 * 7 /*bytes*/,
		attributes: [{
			format: "float32x3",
			offset: 0,
			shaderLocation: 0
		}, {
			format: "float32x4",
			offset: 4 * 3 /*bytes*/ ,
			shaderLocation: 1
		}]
	};

    // SHADERS
	// vertex shader
	const vertexShaderCode = `
    struct vertexOut {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f
    };

    @vertex
    fn vertexMain(@location(0) pos: vec3f, @location(1) color: vec4f) -> vertexOut {
        var output: vertexOut;
        output.position = vec4f(pos, 1);
        output.color = color;
        return output;
    }`;

    // fragment shader
    const fragmentShaderCode = `
        struct vertexOut {
            @builtin(position) position: vec4f,
            @location(0) color: vec4f
        };

        @fragment
        fn fragmentMain(fragData: vertexOut) -> @location(0) vec4f {
            return fragData.color;
        }
    `;

    // create shader modules
	const vertexShaderModule = device.createShaderModule({
		label: "Cube Vertex Shader",
		code: vertexShaderCode
	});
	const fragmentShaderModule = device.createShaderModule({
		label: "Cube Fragment Shader",
		code: fragmentShaderCode
	});

    // PIPELINE
	const pipeline = device.createRenderPipeline({
		label: "Cube Pipeline",
		layout: "auto",
		vertex: {
			module: vertexShaderModule,
			entryPoint: "vertexMain",
			buffers: [{
				arrayStride: 4 * 7 /*bytes*/,
				attributes: [{
					format: "float32x3",
					offset: 0,
					shaderLocation: 0
				}, {
					format: "float32x4",
					offset: 4 * 3 /*bytes*/ ,
					shaderLocation: 1
				}]
			}]
		},
		fragment: {
			module: fragmentShaderModule,
			entryPoint: "fragmentMain",
			targets: [{
				format: format,
			}]
		},
		primitive: {
			topology: "triangle-list"
		}
	});


    // RENDER LOOP
	function renderLoop() {
		// create GPUCommandEncoder
		const encoder = device.createCommandEncoder();

		// begin render pass
		const pass = encoder.beginRenderPass({
			colorAttachments: [{
				view: context.getCurrentTexture().createView(),
				loadOp: "clear",
				clearValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store"
			}]
		});

		// render triangle
		pass.setPipeline(pipeline);
		pass.setVertexBuffer(0, vertexBuffer);
		pass.draw(vertices.length / 7);

		// end render pass
		pass.end();

		// create and submit GPUCommandBuffer
		device.queue.submit([encoder.finish()]);
	}

	// schedule renderLoop()
	renderLoop();
	const UPDATE_INTERVAL = 100;  // 10 fps
	setInterval(renderLoop, UPDATE_INTERVAL);
}