import { AssetLoadError } from "./errors";
import { textureTriangle } from "./textureTriangle";
import { plyToTriangleList } from "./plyReader";
import { mat4 } from "gl-matrix";
import { textToTexture } from "./renderText";

// TODO make versatile (no MSAA, no depth stencil)
export function createPipeline(label, device, bindGroupLayout, vertexShaderModule, vertexBufferStride, vertexBufferAttributes, fragmentShaderModule, format, topology, cullMode, depthTest, multisamples) {
    const pipelineDescriptor = {
		label: label,
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
            cullMode: cullMode,
        },
	};
    if (multisamples) {
        pipelineDescriptor.multisample = { count: multisamples };
    }
    if (depthTest) {
        pipelineDescriptor.depthStencil = {
            format: "depth24plus",
            depthWriteEnabled: cullMode === "back",
            depthCompare: "less",
        };
    }
    return device.createRenderPipeline(pipelineDescriptor);
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

// TODO not reusable
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

export function createBindGroup(device, label, layout, ...resources) {
    const bgDescriptor = {
        label: label,
        layout: layout,
        entries: [],
    };
    let binding = 0;
    for (const resource of resources) {
        bgDescriptor.entries.push({
            binding: binding,
            resource: resource,
        });
        binding++;
    }
    return device.createBindGroup(bgDescriptor);
}

export function createVBAttributes(properties) {
    const attributes = [];
    let offset = 0;
    let shaderLocation = 0;
    // TODO upgrade this alongside .ply reader (e.g. different types)
    for (let i = 0; i < properties.length; i++) {
        const attribute = {};
        if (properties[i] === "x") {
            if (i < properties.length - 1 && properties[i+1] === "y") {
                if (i < properties.length - 2 && properties[i+2] === "z") {
                    // x, y, z
                    attribute.format = "float32x3";
                    attribute.offset = 4 * offset;
                    attribute.shaderLocation = shaderLocation;
                    offset += 3;
                    i += 2;
                }
                else {
                    // x, y
                    attribute.format = "float32x2";
                    attribute.offset = 4 * offset;
                    attribute.shaderLocation = shaderLocation;
                    offset += 2;
                    i++;
                }
            }
            else {
                // x
                attribute.format = "float32x2";
                attribute.offset = 4 * offset;
                attribute.shaderLocation = shaderLocation;
                offset++;
            }
        }
        else if (i < properties.length - 1 && properties[i] === "s" && properties[i+1] === "t") {
            attribute.format = "float32x2";
            attribute.offset = 4 * offset;
            attribute.shaderLocation = shaderLocation;
            offset += 2;
            i++;
        }
        else if (i < properties.length - 1 && properties[i] === "u" && properties[i+1] === "v") {
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

export async function createShaderModule(device, url, label) {
    const shaderCode = await loadShader(url);
    const shaderModule = device.createShaderModule({
        label: label,
        code: shaderCode,
    });
    return shaderModule;
}

export function createModelMatrix(position, rotation, scale) {
    const model = mat4.create();
    mat4.translate(model, model, position);
    mat4.rotateX(model, model, rotation[0]);
    mat4.rotateY(model, model, rotation[1]);
    mat4.rotateZ(model, model, rotation[2]);
    mat4.scale(model, model, scale);
    return model;
}

function transformCollision(mesh, position, rotation, scale, href, ghost) {
    if (!mesh) return null;
    const newMesh = {
        min: [
            mesh.min[0] * scale[0] + position[0],
            mesh.min[1] * scale[1] + position[1],
            mesh.min[2] * scale[2] + position[2],
        ],
        max: [
            mesh.max[0] * scale[0] + position[0],
            mesh.max[1] * scale[1] + position[1],
            mesh.max[2] * scale[2] + position[2],
        ],
    };
    newMesh.href = href;
    newMesh.ghost = ghost;
    return newMesh;
}

async function loadImageToBMP(url) {
    // read image from texture url
    const img = new Image();
    img.src = url;
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
    return await createImageBitmap(img);
}

export async function loadAssets(assets, device, viewBuffer, projectionBuffer, format, topology, multisamples) {
    // BIND GROUP LAYOUT
    const baseBindGroupLayout = createBindGroupLayout(device, "Default Bind Group Layout");

    // RENDERABLES
    const renderables = [];
    for (const asset of assets.objects) {  // each object in scene
        // ASSET FAMILY DEFAULT VALUES
        // vertices from ply file
        const data = await plyToTriangleList(asset.file);
        // shaders from wgsl files
        const baseVertexShaderModule = await createShaderModule(device, asset.vertexShader, "Base Vertex Shader");
        const baseFragmentShaderModule = await createShaderModule(device, asset.fragmentShader, "Base Fragment Shader");
        // collision mesh based on geometry
        let baseMesh;
        if (asset.collision === "aabb") {
            // TODO other types (sphere, mesh)
            // sphere should be easy: radius to furthest point
            baseMesh = createAABB(data);
        }


        // INSTANCE-SPECIFIC VALUES
        for (const instance of asset.instances) {
            // VERTEX BUFFER
            const vb = device.createBuffer({
                label: asset.file,
                size: data.floats.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            device.queue.writeBuffer(vb, 0, data.floats);
            // create vertex buffer atrributes array
            const vbAttributes = createVBAttributes(data.properties);

            // MODEL MATRIX
            const model = createModelMatrix(instance.p, instance.r, instance.s);
            const modelBuffer = device.createBuffer({
                label: "Model Uniform " + renderables.length,
                size: 64,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });

            // BIND GROUP
            let bindGroupLayout = baseBindGroupLayout;
            let bindGroup = createBindGroup(
                device, "Base Bind Group " + renderables.length, bindGroupLayout,
                {buffer: modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer}  // MVP
            );

            // TRANSFORM COLLISION MESH
            const collisionMesh = transformCollision(baseMesh, instance.p, instance.r, instance.s, instance.href, instance.ghost);

            // OVERRIDE SHADERS
            let vertexShaderModule = baseVertexShaderModule;
            let fragmentShaderModule = baseFragmentShaderModule;
            if (instance.vertexShader && instance.fragmentShader) {
                vertexShaderModule = await createShaderModule(device, instance.vertexShader, "Vertex Shader Override");
                fragmentShaderModule = await createShaderModule(device, instance.fragmentShader, "Fragment Shader Override");
            }

            // OVERRIDE CULL MODE
            const cullMode = instance.cullMode ? instance.cullMode : "back";

            // TEXTURE
            if (instance.texture) {
                // TODO I don't understand textures well enough to compress this code
                let texture;
                if (instance.texture.url) {
                    // image texture
                    const imgBmp = await loadImageToBMP(instance.texture.url);
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
                }
                else if (instance.texture.program) {
                    // program texture
                    const textureSize = [512, 512];
                    texture = device.createTexture({
                        label: "Program Texture",
                        size: textureSize,
                        format: 'rgba8unorm',
                        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                    });
                    if (instance.texture.program === "helloTriangle") {
                        textureTriangle(texture, device);
                    }
                    else if (instance.texture.program === "text") {
                        textToTexture(texture, device, instance.texture.content);
                    }
                }

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

                // OVERRIDE BIND GROUP
                bindGroupLayout = createBindGroupLayout(device, "Texture Bind Group Layout", texture, sampler);
                bindGroup = createBindGroup(
                    device, "OVERRIDE Bind Group", bindGroupLayout,
                    {buffer: modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer},  // MVP
                    texture.createView(), sampler, {buffer: faceIDsBuffer}  // texture
                );
            }

            // ANIMATION
            const animation = instance.animation;

            // add to renderables list
            renderables.push({
                id: renderables.length,
                vertexBuffer: vb,
                vertexCount: data.floats.length / data.properties.length,
                model: model,
                modelBuffer: modelBuffer,
                bindGroup: bindGroup,
                pipeline: createPipeline(
                    "FPV Render Pipeline",
                    device,
                    bindGroupLayout,
                    vertexShaderModule,
                    data.properties.length,
                    vbAttributes,
                    fragmentShaderModule,
                    format,
                    topology,
                    cullMode,
                    true,
                    multisamples),
                collisionMesh: collisionMesh,
                animation: animation,
                transforms: {
                    position: instance.p,
                    rotation: instance.r,
                    scale: instance.s,
                },
            });
        }
    }

    return renderables;
}