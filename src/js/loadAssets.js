import { AssetLoadError } from "./errors";
import { textureTriangle } from "./textureTriangle";
import { plyToTriangleList } from "./plyReader";
import { mat4 } from "gl-matrix";
import { textToTexture } from "./renderText";
import { createBindGroup, createBindGroupLayout, createPipeline, createShaderModule, createVBAttributes } from "./wgpuHelpers";
import { AABB, SphereMesh } from "./collision";

export function createModelMatrix(position, rotation, scale) {
    const model = mat4.create();
    mat4.translate(model, model, position);
    mat4.rotateX(model, model, rotation[0]);
    mat4.rotateY(model, model, rotation[1]);
    mat4.rotateZ(model, model, rotation[2]);
    mat4.scale(model, model, scale);
    return model;
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

// TODO scene class?
// only fetch each asset once
export async function loadAssets(assets, device, viewBuffer, projectionBuffer, format, topology, multisamples, debug=false) {
    // BIND GROUP LAYOUT
    const baseBindGroupLayout = createBindGroupLayout(device, "Default Bind Group Layout", "MVP");

    // RENDERABLES
    const renderables = [];
    for (const asset of assets.objects) {  // each object in scene
        // ASSET FAMILY DEFAULT VALUES
        const [data, baseVertexShaderModule, baseFragmentShaderModule] = await Promise.all([
            plyToTriangleList(asset.file),  // vertices from ply file
            createShaderModule(device, asset.vertexShader, "Base Vertex Shader"),  // shaders from wgsl files
            createShaderModule(device, asset.fragmentShader, "Base Fragment Shader")
        ]);

        //console.log("DATA\n", data);
        // TODO replace
        const vertexProperties = data.vertex.properties;
        //console.log(vertexProperties);
        const floats = data.vertex.values.float32;

        //throw new Error("DEBUGGING");
        
        // collision mesh based on geometry
        const meshGenerators = {
            aabb: AABB.createMesh,
            sphere: SphereMesh.createMesh,  // TODO other types (sphere, mesh)
        }
        const baseMesh = meshGenerators[asset.collision]?.(floats.data, floats.properties);

        // vertex buffer atrributes array
        const vbAttributes = createVBAttributes(floats.properties);
        //console.log("VB ATTRIBUTES\n", vbAttributes);  // TODO grouping

        // INSTANCE-SPECIFIC VALUES
        for (const instance of asset.instances) {
            // VERTEX BUFFER
            const vb = device.createBuffer({
                label: asset.file,
                size: floats.data.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            device.queue.writeBuffer(vb, 0, floats.data);

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
            let collisionMesh;
            if (asset.collision === "aabb") {
                collisionMesh = new AABB(baseMesh.min, baseMesh.max, instance.href, instance.ghost, instance.v);
                collisionMesh.modelTransform(model);
            }

            // OVERRIDE SHADERS
            let vertexShaderModule = baseVertexShaderModule;
            let fragmentShaderModule = baseFragmentShaderModule;
            if (instance.vertexShader && instance.fragmentShader) {
                [vertexShaderModule, fragmentShaderModule] = await Promise.all([  // TODO move this await later?
                    createShaderModule(device, instance.vertexShader, "Vertex Shader Override"),
                    createShaderModule(device, instance.fragmentShader, "Fragment Shader Override")
                ]);
            }

            // OVERRIDE CULL MODE
            const cullMode = instance.cullMode ? instance.cullMode : "back";

            // TEXTURE
            if (instance.texture) {
                let texture;
                if (instance.texture.url) {
                    // image texture
                    const imgBmp = await loadImageToBMP(instance.texture.url);
                    // create texture on device
                    texture = device.createTexture({
                        label: "Instance Texture",
                        size: [imgBmp.width, imgBmp.height, 1],
                        format: format,
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
                        format: format,
                        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                    });
                    if (instance.texture.program === "helloTriangle") {
                        textureTriangle(texture, device, format);
                    }
                    else if (instance.texture.program === "text") {
                        textToTexture(texture, device, format, instance.texture.content);
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
                bindGroupLayout = createBindGroupLayout(
                    device, "Texture Bind Group Layout",
                    "MVP", "texture", "sampler", {visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform"}}
                );
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
                vertexCount: floats.data.length / floats.properties.length,
                model: model,
                modelBuffer: modelBuffer,
                bindGroup: bindGroup,
                pipeline: createPipeline(
                    "FPV Render Pipeline",
                    device,
                    bindGroupLayout,
                    vertexShaderModule,
                    floats.properties.length,
                    vbAttributes,
                    fragmentShaderModule,
                    format,
                    topology,
                    cullMode,
                    true,
                    multisamples
                ),
                baseMesh: baseMesh,
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

    // create debug geometry
    if (debug) {
        createDebugGeometry(renderables, device, format, viewBuffer, projectionBuffer, multisamples);
    }

    return renderables;
}

async function createDebugGeometry(renderables, device, format, viewBuffer, projectionBuffer, multisamples) {
    // SHADERS
    const debugVShader = await createShaderModule(device, "shaders/basicVertex.wgsl", "DEBUG Vertex Module");
    const debugFShader = await createShaderModule(device, "shaders/debugF.wgsl", "DEBUG Fragment Module");

    // BGL
    const debugBGL = createBindGroupLayout(device, "DEBUG BGL", "MVP");

    for (const renderable of renderables) {
        if (renderable.collisionMesh && !renderable.collisionMesh.ghost) {
            // generate geometry (line-list)
            const vertexCount = 24;  // 12 edges, 2 vertices each
            const vertices = renderable.collisionMesh.toVertices();
            
            // VERTEX BUFFER
            const vb = device.createBuffer({
                label: "DEBUG VB",
                size: vertices.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });
            device.queue.writeBuffer(vb, 0, vertices);
            const vbAttributes = createVBAttributes(["x", "y", "z"]);

            // BIND GROUP
            const bg = createBindGroup(device, "DEBUG Bind Group", debugBGL, {buffer: renderable.modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer});

            // PIPELINE
            const pipeline = createPipeline(
                "DEBUG Pipeline",
                device,
                debugBGL,
                debugVShader,
                3,
                vbAttributes,
                debugFShader,
                format,
                "line-list",
                "none",
                true,
                multisamples
            );

            // add debug utilities to renderable object
            renderable.debugVertexCount = vertexCount;
            renderable.debugVB = vb;
            renderable.debugBG = bg;
            renderable.debugPipeline = pipeline;
        }
    }
}