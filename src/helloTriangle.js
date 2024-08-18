// imports
import { lerpVector } from "./lerp";
import { noWGPU } from "./noWGPU";


export async function helloTriangle() {
	// BOILERPLATE AND SETUP
	// locate canvas
	const canvas = document.querySelector("canvas");

	// check for browser WebGPU compatibility
	if (!navigator.gpu) {
		noWGPU(canvas);
		throw new Error("WebGPU is not supported in this browser");
	}

	// request GPUAdapter
	const adapter = await navigator.gpu.requestAdapter();
	if (!adapter) {
		noWGPU(canvas);
		throw new Error("No appropriate GPUAdapter found");
	}

	// request device
	const device = await adapter.requestDevice();

	// configure canvas
	const context = canvas.getContext("webgpu");
	const format = navigator.gpu.getPreferredCanvasFormat();
	context.configure({
		device: device,
		format: format
	});


	// GEOMETRY
	const vertices = new Float32Array([
		// X,  Y,    R    G    B    A
		0.0,  1.0,  1.0, 0.0, 0.0, 1.0,
		1.0, -0.73, 0.0, 1.0, 0.0, 1.0,
		-1.0, -0.73, 0.0, 0.0, 1.0, 1.0
	]);

	// arrays for lerping
	const triangleRBG = new Float32Array([
		// X,  Y,    R    G    B    A
		0.0,  1.0,  1.0, 0.0, 0.0, 1.0,
		1.0, -0.73, 0.0, 1.0, 0.0, 1.0,
		-1.0, -0.73, 0.0, 0.0, 1.0, 1.0
	]);

	const triangleGRB = new Float32Array([
		// X,  Y,    R    G    B    A
		0.0,  1.0,  0.0, 0.0, 1.0, 1.0,
		1.0, -0.73, 1.0, 0.0, 0.0, 1.0,
		-1.0, -0.73, 0.0, 1.0, 0.0, 1.0
	]);

	const triangleBGR = new Float32Array([
		// X,  Y,    R    G    B    A
		0.0,  1.0,  0.0, 1.0, 0.0, 1.0,
		1.0, -0.73, 0.0, 0.0, 1.0, 1.0,
		-1.0, -0.73, 1.0, 0.0, 0.0, 1.0
	]);

	// create vertex buffer
	const vertexBuffer = device.createBuffer({
		label: "Triangle Vertices",
		size: vertices.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
	});

	// copy vertex data into vertex buffer
	device.queue.writeBuffer(vertexBuffer, 0, vertices);

	// define vertex layout
	const vertexBufferLayout = {
		arrayStride: 4 * 6 /*bytes*/,
		attributes: [{
			format: "float32x2",
			offset: 0,
			shaderLocation: 0
		}, {
			format: "float32x4",
			offset: 4 * 2 /*bytes*/ ,
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
		fn vertexMain(@location(0) pos: vec2f, @location(1) color: vec4f) -> vertexOut {
			var output: vertexOut;
			output.position = vec4f(pos, 0, 1);
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
		label: "Triangle Vertex Shader",
		code: vertexShaderCode
	});
	const fragmentShaderModule = device.createShaderModule({
		label: "Triangle Fragment Shader",
		code: fragmentShaderCode
	});


	// PIPELINE
	const pipeline = device.createRenderPipeline({
		label: "Triangle Pipeline",
		layout: "auto",
		vertex: {
			module: vertexShaderModule,
			entryPoint: "vertexMain",
			buffers: [{
				arrayStride: 4 * 6 /*bytes*/,
				attributes: [{
					format: "float32x2",
					offset: 0,
					shaderLocation: 0
				}, {
					format: "float32x4",
					offset: 4 * 2 /*bytes*/ ,
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
	let frames = 0;
	function renderLoop() {
		// lerp
		frames %= 300;
		if (frames < 100) {
			// RBG to BRG
			lerpVector(vertices, triangleRBG, triangleBGR, frames / 100);  // normalize
		}
		else if (frames < 200) {
			// BGR to GBR
			lerpVector(vertices, triangleBGR, triangleGRB, (frames-100) / 100);
		}
		else {
			// GBR to RGB
			lerpVector(vertices, triangleGRB, triangleRBG, (frames-200) / 100);
		}
		// copy data to vertices buffer
		device.queue.writeBuffer(vertexBuffer, 0, vertices);

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
		pass.draw(vertices.length / 6);  // 3 vertices

		// end render pass
		pass.end();

		// create and submit GPUCommandBuffer
		device.queue.submit([encoder.finish()]);

		frames++;
	}

	// schedule renderLoop()
	renderLoop();
	const UPDATE_INTERVAL = 100;  // 10 fps
	setInterval(renderLoop, UPDATE_INTERVAL);
}