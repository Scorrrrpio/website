import { AssetLoadError } from "./errors";
import { createBindGroup, createBindGroupLayout, createPipeline, createShaderModule, createVBAttributes } from "./wgpuHelpers";

// TODO reconcile formats
export async function textToTexture(outputTexture, device, format, text) {
    // CONSTANTS
    // TODO as parameters
    const atlasUrl = "media/text/hackAtlas64.png";
    const metadataUrl = "media/text/hackMetadata64.json";
    //const format = "rgba8unorm";
    const fontSize = 48;
    const MULTISAMPLE = 4;

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
        format: format,
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
    const atlasHeight = 64;
    const scale = fontSize / atlasHeight;
    const margin = 0.1;

    let xPos = -outputTexture.width;
    let yPos = outputTexture.height - fontSize;
    const letterQuads = [];

    // TODO autowrapping?
    for (const ch of text) {
        if (ch === "\n") {
            xPos = -outputTexture.width;
            yPos -= fontSize;
        }
        else {
            let x0 = (xPos + metadata[ch].x * scale) / outputTexture.width + margin;
            let y1 = (yPos + metadata[ch].y * scale) / outputTexture.height - margin;
            let x1 = (xPos + (metadata[ch].x + metadata[ch].width) * scale) / outputTexture.width + margin;
            let y0 = (yPos + (metadata[ch].y - metadata[ch].height) * scale) / outputTexture.height - margin;
            // TODO desperately needs a function
            letterQuads.push(
                // TOP LEFT
                x0, y1, metadata[ch].u0, metadata[ch].v0,
                // BOTTOM LEFT
                x0, y0, metadata[ch].u0, metadata[ch].v1,
                // TOP RIGHT
                x1, y1, metadata[ch].u1, metadata[ch].v0,
                // BOTTOM RIGHT
                x1, y0, metadata[ch].u1, metadata[ch].v1,
                // TOP RIGHT
                x1, y1, metadata[ch].u1, metadata[ch].v0,
                // BOTTOM LEFT
                x0, y0, metadata[ch].u0, metadata[ch].v1,
            );
            xPos += (metadata[ch].advance) * scale;
        }
    }
    const vertices = Float32Array.from(letterQuads);

    // create vertex buffer
	const vertexBuffer = device.createBuffer({
		label: "Text Geometry",
		size: vertices.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
	});
	device.queue.writeBuffer(vertexBuffer, 0, vertices);


    // BIND GROUP and LAYOUT
    // TODO rewrite createBindGroup
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
    const vbAttributes = createVBAttributes(["x", "y", "u", "v"]);
    const pipeline = createPipeline("Text Render Pipeline", device, BGL, vertexModule, 4, vbAttributes, fragmentModule, format, "triangle-list", "none", false, MULTISAMPLE);

    // 4xMSAA TEXTURES
    let msaaTexture = device.createTexture({
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        size: [outputTexture.width, outputTexture.height],
        sampleCount: MULTISAMPLE,
    });


    // RENDER
    function drawText() {
        // create GPUCommandEncoder
		const encoder = device.createCommandEncoder();

        // begin render pass
		const pass = encoder.beginRenderPass({
			colorAttachments: [{
                view: msaaTexture.createView(),  // render to MSAA texture
				loadOp: "clear",
				clearValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store",
                resolveTarget: outputTexture.createView(),  // multisample down to output
			}],
		});

		// render triangle
		pass.setPipeline(pipeline);
        pass.setBindGroup(0, BG);
		pass.setVertexBuffer(0, vertexBuffer);
		pass.draw(vertices.length / 4);

		// end render pass
		pass.end();

		// create and submit GPUCommandBuffer
		device.queue.submit([encoder.finish()]);
    }

    drawText();
}