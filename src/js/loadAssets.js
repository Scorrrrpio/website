import { AssetLoadError } from "./errors";
import { plyToTriangleList } from "./plyReader";  // TODO line-list
import { mat4 } from "gl-matrix";

function createPipeline(device, bindGroupLayout, vertexShaderModule, vertexBufferStride, vertexBufferAttributes, fragmentShaderModule, format, topology, multisamples) {
    return device.createRenderPipeline({
		label: "FPV Pipeline",
		layout: device.createPipelineLayout({
            label: "FPV Pipeline Layout",
            bindGroupLayouts: [bindGroupLayout],
        }),
		vertex: {
			module: vertexShaderModule,
			entryPoint: "vertexMain",
			buffers: [{
				arrayStride: 4 * vertexBufferStride /*bytes*/,
				attributes: vertexBufferAttributes,
			}],
		},
		fragment: {
			module: fragmentShaderModule,
			entryPoint: "fragmentMain",
			targets: [{
				format: format,
                blend: {
                    color: {
                        srcFactor: "src-alpha",
                        dstFactor: "one-minus-src-alpha",
                        operation: "add",
                    },
                    alpha: {
                        srcFactor: "one",
                        dstFactor: "one-minus-src-alpha",
                        operation: "add",
                    },
                },
                writeMask: GPUColorWrite.ALL,
			}],
		},
		primitive: {
            topology: topology,
            frontFace: "ccw",
            cullMode: "back",
        },
        depthStencil: {
            format: "depth24plus",
            depthWriteEnabled: true,
            depthCompare: "less",
        },
        multisample: {
            count: multisamples,
        },
	});
}

function createAABB(data) {
    const xIndex = data.properties.indexOf("x");
    const yIndex = data.properties.indexOf("y");
    const zIndex = data.properties.indexOf("z");

    const aabb = {
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
    };
    for (const i in data.floats) {
        if (i % data.properties.length === xIndex) {
            if (data.floats[i] < aabb.min[0]) { aabb.min[0] = data.floats[i]; }
            if (data.floats[i] > aabb.max[0]) { aabb.max[0] = data.floats[i]; }
        }
        if (i % data.properties.length === yIndex) {
            if (data.floats[i] < aabb.min[1]) { aabb.min[1] = data.floats[i]; }
            if (data.floats[i] > aabb.max[1]) { aabb.max[1] = data.floats[i]; }
        }
        if (i % data.properties.length === zIndex) {
            if (data.floats[i] < aabb.min[2]) { aabb.min[2] = data.floats[i]; }
            if (data.floats[i] > aabb.max[2]) { aabb.max[2] = data.floats[i]; }
        }
    }
    return aabb;
}

function createBindGroupLayout(device, label, texture, sampler) {
    const BGLDescriptor = {
        label: label,
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "uniform" },
        }, {
            binding: 1,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "uniform" },
        }, {
            binding: 2,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "uniform" },
        }]
    }
    if (texture && sampler) {
        BGLDescriptor.entries.push({
            binding: 3,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: "float" },
        });
        BGLDescriptor.entries.push({
            binding: 4,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: "filtering" },
        });
        BGLDescriptor.entries.push({
            binding: 5,
            visibility: GPUShaderStage.FRAGMENT,
            buffer: { type: "uniform" },
        });
    }
    return device.createBindGroupLayout(BGLDescriptor);
}

function createVBAttributes(properties) {
    const attributes = [];
    let offset = 0;
    let shaderLocation = 0;
    // TODO upgrade this alongside .ply reader
    for (let i = 0; i < properties.length; i++) {
        const attribute = {};
        if (i < properties.length - 2 && properties[i] === "x" && properties[i+1] === "y" && properties[i+1] === "y") {
            attribute.format = "float32x3";
            attribute.offset = 4 * offset;
            attribute.shaderLocation = shaderLocation;
            offset += 3;
            i += 2;
        }
        else if (i < properties.length - 1 && properties[i] === "s" && properties[i+1] === "t") {
            attribute.format = "float32x2";
            attribute.offset = 4 * offset;
            attribute.shaderLocation = shaderLocation;
            offset += 2;
            i++;
        }
        else {
            attribute.format = "float32x1";
            attribute.offset = 4 * offset;
            attribute.shaderLocation = shaderLocation;
            offset++;
        }
        attributes.push(attribute);
        shaderLocation++;
    }
    return attributes;
}

async function loadShader(url) {
    const response = await fetch(url);
    if (!response.ok) { throw new AssetLoadError("Failed to load shader: " + url); }
    return await response.text();
}

export async function assetsToBuffers(assets, device, format, topology, multisamples) {
    // UNIFORM BUFFERS
    // create uniform buffers for MVP matrices
    const viewBuffer = device.createBuffer({
        label: "View Uniform",
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const projectionBuffer = device.createBuffer({
        label: "Projection Uniform",
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });


    // BIND GROUP LAYOUT
    const baseBindGroupLayout = createBindGroupLayout(device, "Default Bind Group Layout");


    // RENDERABLES
    const renderables = [];
    for (const asset of assets.objects) {  // each object in scene
        // read .ply file
        const data = await plyToTriangleList(asset.file);

        // SHADERS
        // vertex shader
        const vertexShaderCode = await loadShader(asset.vertexShader);
        const baseVertexShaderModule = device.createShaderModule({
            label: "Default Vertex Shader",
            code: vertexShaderCode,
        });
        // fragment shader
        const fragmentShaderCode = await loadShader(asset.fragmentShader);
        const baseFragmentShaderModule = device.createShaderModule({
            label: "Default Fragment Shader",
            code: fragmentShaderCode,
        });

        // generate default collision mesh for geometry
        // TODO other types (sphere, mesh)
        let baseMesh;
        if (asset.collision === "aabb") {
            baseMesh = createAABB(data);
        }

        for (const instance of asset.instances) {
            // create vertex buffer
            const vb = device.createBuffer({
                label: asset.file,
                size: data.floats.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            // write data
            device.queue.writeBuffer(vb, 0, data.floats);
            // create vertex buffer atrributes array
            const vertexBufferAttributes = createVBAttributes(data.properties);

            // generate model matrix
            const model = mat4.create();
            mat4.translate(model, model, instance.p);
            mat4.rotateX(model, model, instance.r[0]);
            mat4.rotateY(model, model, instance.r[1]);
            mat4.rotateZ(model, model, instance.r[2]);
            mat4.scale(model, model, instance.s);
            // create model matrix uniform buffer for object
            const modelBuffer = device.createBuffer({
                label: "Model Uniform " + renderables.length,
                size: 64,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });

            // create bind group for MVP matrices
            let bindGroupLayout = baseBindGroupLayout;
            let bindGroup = device.createBindGroup({
                label: "MVP bind group " + renderables.length,
                layout: bindGroupLayout,
                entries: [{
                    binding: 0,
                    resource: { buffer: modelBuffer },
                }, {
                    binding: 1,
                    resource: { buffer: viewBuffer },
                }, {
                    binding: 2,
                    resource: { buffer: projectionBuffer },
                }],
            });

            // transform collision mesh
            let collisionMesh;
            if (baseMesh) {
                collisionMesh = {
                    min: [
                        baseMesh.min[0] * instance.s[0] + instance.p[0],
                        baseMesh.min[1] * instance.s[1] + instance.p[1],
                        baseMesh.min[2] * instance.s[2] + instance.p[2],
                    ],
                    max: [
                        baseMesh.max[0] * instance.s[0] + instance.p[0],
                        baseMesh.max[1] * instance.s[1] + instance.p[1],
                        baseMesh.max[2] * instance.s[2] + instance.p[2],
                    ],
                };
                if (instance.href) {
                    collisionMesh.href = instance.href;
                }
                if (instance.ghost) {
                    collisionMesh.ghost = true;
                }
            }

            // override shaders
            let vertexShaderModule = baseVertexShaderModule;
            let fragmentShaderModule = baseFragmentShaderModule;
            if (instance.vertexShader && instance.fragmentShader) {
                // vertex shader
                const overrideVertex = await loadShader(instance.vertexShader);
                vertexShaderModule = device.createShaderModule({
                    label: "FPV Vertex Shader OVERRIDE",
                    code: overrideVertex,
                });
                // fragment shader
                const overrideFragment = await loadShader(instance.fragmentShader);
                fragmentShaderModule = device.createShaderModule({
                    label: "FPV Fragment Shader OVERRIDE",
                    code: overrideFragment,
                });
            }

            // load texture
            let texture;
            if (instance.texture) {
                // read image from texture url
                const img = new Image();
                img.src = instance.texture.url;
                await img.decode();

                // convert to bmp
                const imgBmp = await createImageBitmap(img);

                // create texture on device
                texture = device.createTexture({
                    label: "Instance Texture",
                    size: [imgBmp.width, imgBmp.height, 1],
                    format: "rgba8unorm",
                    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
                });
                device.queue.copyExternalImageToTexture(
                    { source: imgBmp },
                    { texture: texture },
                    [imgBmp.width, imgBmp.height, 1],
                );

                // create texture sampler
                const sampler = device.createSampler({
                    magFilter: "linear",
                    minFilter: "linear",
                });

                // create list of faces to texture
                const faceIDs = new Uint32Array([
                    instance.texture.faces.includes("front") ? 1 : 0, 0, 0, 0,
                    instance.texture.faces.includes("back") ? 1 : 0, 0, 0, 0,
                    instance.texture.faces.includes("left") ? 1 : 0, 0, 0, 0,
                    instance.texture.faces.includes("right") ? 1 : 0, 0, 0, 0,
                    instance.texture.faces.includes("top") ? 1 : 0, 0, 0, 0,
                    instance.texture.faces.includes("bottom") ? 1 : 0, 0, 0, 0,
                ]);
                // store in uniform buffer
                const faceIDsBuffer = device.createBuffer({
                    label: "Texture Faces Buffer",
                    size: faceIDs.byteLength,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                });
                device.queue.writeBuffer(faceIDsBuffer, 0, faceIDs);

                // override bind group layout
                bindGroupLayout = createBindGroupLayout(device, "Texture Bind Group Layout", texture, sampler);

                // override bind group
                bindGroup = device.createBindGroup({
                    label: "MVP bind group " + renderables.length,
                    layout: bindGroupLayout,
                    entries: [{
                        binding: 0,
                        resource: { buffer: modelBuffer },
                    }, {
                        binding: 1,
                        resource: { buffer: viewBuffer },
                    }, {
                        binding: 2,
                        resource: { buffer: projectionBuffer },
                    }, {
                        binding: 3,
                        resource: texture.createView(),
                    }, {
                        binding: 4,
                        resource: sampler,
                    }, {
                        binding: 5,
                        resource: { buffer: faceIDsBuffer },
                    }],
                });
            }

            // add to renderables list
            renderables.push({
                id: renderables.length,
                vertexBuffer: vb,
                vertexCount: data.floats.length / data.properties.length,  // TODO hardcoded length
                model: model,
                modelBuffer: modelBuffer,
                bindGroup: bindGroup,
                pipeline: createPipeline(
                    device,
                    bindGroupLayout,
                    vertexShaderModule,
                    data.properties.length,
                    vertexBufferAttributes,
                    fragmentShaderModule,
                    format,
                    topology,
                    multisamples),
                collisionMesh: collisionMesh,
            });
        }
    }

    return { renderables, viewBuffer, projectionBuffer };
}