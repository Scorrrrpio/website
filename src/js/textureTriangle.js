// imports
import { lerpVector } from "./lerp";
import { createPipeline, createVBAttributes } from "./wgpuHelpers";

export async function textureTriangle(assetManager, texture, device, format) {
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


	// SHADERS
	const [vertexModule, fragmentModule] = await assetManager.get("shaders/helloTriangle.vert.wgsl", "shaders/helloTriangle.frag.wgsl");

	// PIPELINE
	const pipeline = createPipeline(
		"Hello Triangle Texture Pipeline",
		device,
		"auto",
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
			lerpVector(vertices, triangleRBG, triangleBGR, frames / 600);
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