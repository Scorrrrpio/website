import { AssetLoadError } from "./errors";
import { createBindGroup, createShaderModule } from "./loadAssets";
import { wgpuSetup } from "./wgpuSetup";

export async function textToTexture(outputTexture, device, text) {
    // CONSTANTS
    // TODO as parameters
    const atlasUrl = "media/text/hackAtlas.png";
    const metadataUrl = "media/text/hackMetadata.json";

    // load glyph atlas png
    const img = new Image();
    img.src = atlasUrl;
    try {
        await img.decode();
    }
    catch (error) {
        if (error.name === "EncodingError") {
            throw new AssetLoadError("Failed to load image: " + url);
        }
        else { throw error; }
    };
    // convert to bmp
    const atlasBMP = await createImageBitmap(img);

    const response = await fetch(metadataUrl);
    if (!response.ok) { throw new AssetLoadError("Failed to load Glyph Atlas Metadata"); }
    const metadata = await response.json();


    // GLYPH ATLAS TEXTURE
    const texture = device.createTexture({
        label: "Instance Texture",
        size: [atlasBMP.width, atlasBMP.height, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    device.queue.copyExternalImageToTexture(
        { source: atlasBMP },
        { texture: texture },
        [atlasBMP.width, atlasBMP.height]
    );

    // create texture sampler
    const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
    });


    // SHADERS
    const vertexModule = await createShaderModule(device, "shaders/textV.wgsl", "Text Vertex");
    const fragmentModule = await createShaderModule(device, "shaders/textF.wgsl", "Text Fragment");

    // GEOMETRY
    const lineHeight = 35;
    const lineSpace = 12;
    const margin = 0.1;

    let xPos = -outputTexture.width;
    let yPos = outputTexture.height;
    const letterQuads = [];

    for (const ch of text) {
        if (ch === "\n") {
            console.log("NEWLINE");
            xPos = -outputTexture.width;
            yPos -= lineHeight;
            yPos -= lineSpace;
        }
        else {
            let x0 = xPos / outputTexture.width + margin;
            let y1 = yPos / outputTexture.height - margin;
            let x1 = (xPos + metadata[ch][0].width) / outputTexture.width + margin;
            let y0 = (yPos - metadata[ch][0].height) / outputTexture.height - margin;
            // TODO desperately needs a function
            console.log(ch, metadata[ch]);
            letterQuads.push(
                // TOP LEFT
                x0, y1, metadata[ch][0].u0, metadata[ch][0].v0,
                // BOTTOM LEFT
                x0, y0, metadata[ch][0].u0, metadata[ch][0].v1,
                // TOP RIGHT
                x1, y1, metadata[ch][0].u1, metadata[ch][0].v0,
                // BOTTOM RIGHT
                x1, y0, metadata[ch][0].u1, metadata[ch][0].v1,
                // TOP RIGHT
                x1, y1, metadata[ch][0].u1, metadata[ch][0].v0,
                // BOTTOM LEFT
                x0, y0, metadata[ch][0].u0, metadata[ch][0].v1,
            );
            xPos += metadata[ch][0].advance
        }
    }
    /*
    letterQuads.push(
        -1, 1, metadata["!"][0].u0, metadata["!"][0].v0,  // TL
        -1, -1, metadata["!"][0].u0, metadata["!"][0].v1,  // BL
        1, 1, metadata["!"][0].u1, metadata["!"][0].v0,  // TR
        1, -1, metadata["!"][0].u1, metadata["!"][0].v1,  // BR
        1, 1, metadata["!"][0].u1, metadata["!"][0].v0,  // TR
        -1, -1, metadata["!"][0].u0, metadata["!"][0].v1,  // BL
    )*/
    const vertices = Float32Array.from(letterQuads);

    // create vertex buffer
	const vertexBuffer = device.createBuffer({
		label: "Text Geometry",
		size: vertices.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
	});
	device.queue.writeBuffer(vertexBuffer, 0, vertices);


    // BIND GROUP and LAYOUT
    const BGL = device.createBindGroupLayout({
        label: "Text BGL",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: "float" },
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: { type: "filtering" },
            },
        ],
    });

    const BG = createBindGroup(device, "Text Bind Group", BGL, texture.createView(), sampler);


    // PIPELINE
	const pipeline = device.createRenderPipeline({
		label: "Text Pipeline",
		layout: device.createPipelineLayout({
            label: "Text Pipeline Layout",
            bindGroupLayouts: [BGL],
        }),
		vertex: {
			module: vertexModule,
			entryPoint: "vertexMain",
			buffers: [{
				arrayStride: 4 * 4 /*bytes*/,
				attributes: [{
					format: "float32x2",
					offset: 0,
					shaderLocation: 0
				}, {
					format: "float32x2",
					offset: 4 * 2 /*bytes*/ ,
					shaderLocation: 1
				}]
			}]
		},
		fragment: {
			module: fragmentModule,
			entryPoint: "fragmentMain",
			targets: [{
				format: "rgba8unorm",
			}]
		},
		primitive: {
			topology: "triangle-list"
		}
	});


    // RENDER
    function drawText() {
        // create GPUCommandEncoder
		const encoder = device.createCommandEncoder();

		// begin render pass
		const pass = encoder.beginRenderPass({
			colorAttachments: [{
				view: outputTexture.createView(),
				loadOp: "clear",
				clearValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store"
			}]
		});

		// render triangle
		pass.setPipeline(pipeline);
        pass.setBindGroup(0, BG);
		pass.setVertexBuffer(0, vertexBuffer);
		pass.draw(vertices.length / 4);  // 3 vertices

		// end render pass
		pass.end();

		// create and submit GPUCommandBuffer
		device.queue.submit([encoder.finish()]);
    }

    drawText();
}