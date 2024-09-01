// imports
import { lerpVector } from "./lerp";
import { createBindGroup, createBindGroupLayout, createPipeline, createShaderModule, createVBAttributes } from "./wgpuHelpers";

// TODO reconcile format
export async function textureTriangle(texture, device, format) {
	//const format = "rgba8unorm";
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
	device.queue.writeBuffer(vertexBuffer, 0, vertices);
	const vbAttributes = createVBAttributes(["x", "y", "r", "g", "b", "a"]);

	// BIND GROUP
	// TODO pointless
	const BGL = createBindGroupLayout(device, "Hello Triangle Texture BGL");
	const BG = createBindGroup(device, "hello Triangle BG", BGL);


	// SHADERS
	const vertexModule = await createShaderModule(device, "shaders/helloTriangleV.wgsl", "Hello Triangle Vertex");
	const fragmentModule = await createShaderModule(device, "shaders/helloTriangleF.wgsl", "Hello Triangle Fragment");

	// PIPELINE
	const pipeline = createPipeline(
		"Hello Triangle Texture Pipeline",
		device,
		BGL,
		vertexModule,
		6,
		vbAttributes,
		fragmentModule,
		format,
		"triangle-list",
		"none",
		null,
		null
	);


	// RENDER LOOP
	let frames = 0;
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
				view: texture.createView(),
				loadOp: "clear",
				clearValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store"
			}]
		});

		// render triangle
		pass.setPipeline(pipeline);
		pass.setVertexBuffer(0, vertexBuffer);
		pass.setBindGroup(0, BG);
		pass.draw(vertices.length / 6);  // 3 vertices

		// end render pass
		pass.end();

		// create and submit GPUCommandBuffer
		device.queue.submit([encoder.finish()]);

		frames++;

		requestAnimationFrame(renderLoop);
	}

	renderLoop();
}