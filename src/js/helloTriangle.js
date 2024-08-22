// imports
import { lerpVector } from "./lerp";
import { wgpuSetup } from "./wgpuSetup";


export async function helloTriangle(canvasID, autoplay) {
	// BOILERPLATE AND SETUP
	// locate canvas
	const canvas = document.getElementById(canvasID);
	const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = 512 * devicePixelRatio;
    canvas.height = 512 * devicePixelRatio;

	// set up WebGPU
    const { adapter, device, context, format } = await wgpuSetup(canvas);


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
	let animating = false;
	function renderLoop() {
		// lerp
		frames %= 1800;
		if (frames < 600) {
			// RBG to BRG
			lerpVector(vertices, triangleRBG, triangleBGR, frames / 600);  // normalize
		}
		else if (frames < 1200) {
			// BGR to GBR
			lerpVector(vertices, triangleBGR, triangleGRB, (frames-600) / 600);
		}
		else {
			// GBR to RGB
			lerpVector(vertices, triangleGRB, triangleRBG, (frames-1200) / 600);
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

		if (autoplay || animating) {
            requestAnimationFrame(renderLoop);
        }
	}


	// ANIMATION CONTROL
    function startRenderLoop() {
        if (!animating) {
            animating = true;
            renderLoop();
        }
    }

    function stopRenderLoop() {
        animating = false;
    }

	if (!autoplay) {
		canvas.addEventListener("mouseenter", startRenderLoop);
		canvas.addEventListener("mouseleave", stopRenderLoop);
	}

	renderLoop();
}