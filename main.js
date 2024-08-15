// NO GPU SUPPORT
function noWGPU() {
	const canvas = document.querySelector("canvas");
	const dialogue = document.getElementById("no-webgpu");
	canvas.style.display = "none";
	dialogue.style.display = "block";
}

// BOILERPLATE AND SETUP
// check for browser WebGPU compatibility
if (!navigator.gpu) {
	//alert("Your browser does not support WebGPU");
	noWGPU();
	throw new Error("WebGPU is not supported in this browser");
}

// request GPUAdapter
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) {
	alert("Failed to find GPUAdapter");
	throw new Error("No appropriate GPUAdapter found");
}

// request device
const device = await adapter.requestDevice();

// configure canvas
const canvas = document.querySelector("canvas");
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
let t = 0;
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
	pass.draw(vertices.length / 6);  // 3 vertices

	// end render pass
	pass.end();

	// create and submit GPUCommandBuffer
	device.queue.submit([encoder.finish()]);
}

// schedule renderLoop()
const UPDATE_INTERVAL = 200;  // 5 fps
setInterval(renderLoop, UPDATE_INTERVAL);
