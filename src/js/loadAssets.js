import { AssetLoadError } from "./errors";
import { textureTriangle } from "./textureTriangle";
import { plyToTriangleList } from "./plyReader";
import { textToTexture } from "./renderText";
import { createBindGroup, createBindGroupLayout, createPipeline, createShaderModule, createVBAttributes } from "./wgpuHelpers";
import { AABB, SphereMesh } from "./collision";
import { Mesh, MeshInstance, Entity } from "./entity";
import { mat4 } from "gl-matrix";

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

async function fetchSceneFile(url) {
    // Scene assets as JSON
    const assetsResponse = await fetch(url);
    if (!assetsResponse.ok) { throw new AssetLoadError("Failed to fetch scene from " + url); }
    return assetsResponse.json();
}

async function assetToMesh(asset, cache, device, debug=false) {
    // ASSET FAMILY DEFAULT VALUES
    const data = await fetchOnce(cache, asset.file, plyToTriangleList(asset.file), debug);

    // TODO change ply reader AGAIN
    const floats = data.vertex.values.float32;
    const vCount = floats.data.length / floats.properties.length;
    const vProps = floats.properties.length;
    
    // collision mesh based on geometry
    const meshGenerators = {
        aabb: AABB.createMesh,
        sphere: SphereMesh.createMesh,  // TODO other types (sphere, mesh)
    }
    const baseMesh = meshGenerators[asset.collision]?.(floats.data, floats.properties);
    let collider;
    if (asset.collision === "aabb") {
        collider = new AABB(baseMesh.min, baseMesh.max);
    }

    // vertex buffer atrributes array
    const vbAttributes = createVBAttributes(floats.properties);
    //console.log("VB ATTRIBUTES\n", vbAttributes);  // TODO grouping

    // VERTEX BUFFER
    const vb = device.createBuffer({
        label: asset.file,
        size: floats.data.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vb, 0, floats.data);

    return new Mesh(vb, vbAttributes, vProps, vCount, collider);
}

// TODO proof of concept implementation
async function fetchOnce(cache, url, fetcher, debug=false) {
    if (cache.has(url)) {
        return cache.get(url);
    }
    if (debug) console.log("FETCH: " + url);
    const data = await fetcher;
    cache.set(url, data);
    return data;
}

// TODO logic belongs in Scene class
export async function loadScene(sceneURL, cache, device, viewBuffer, projectionBuffer, format, topology, multisamples, debug=false) {
    const assets = await fetchSceneFile(sceneURL);  // TODO too much in one function

    // BIND GROUP LAYOUT
    const baseBindGroupLayout = createBindGroupLayout(device, "Default Bind Group Layout", "MVP");

    // RENDERABLES
    const renderables = [];  // TODO restructure
    // TODO break into functions
    for (const asset of assets.objects) {  // each object in scene
        // ASSET FAMILY DEFAULT VALUES
        const [mesh, baseVertexShaderModule, baseFragmentShaderModule] = await Promise.all([
            assetToMesh(asset, cache, device, debug),
            fetchOnce(cache, asset.vertexShader, createShaderModule(device, asset.vertexShader, "Base Vertex Shader"), debug),  // shaders from wgsl files
            fetchOnce(cache, asset.fragmentShader, createShaderModule(device, asset.fragmentShader, "Base Fragment Shader"), debug)
        ]);

        const renderable = {
            asset: mesh,
            instances: [],
        };

        // INSTANCE-SPECIFIC VALUES
        for (const instance of asset.instances) {
            // MODEL BUFFER
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

            // OVERRIDE SHADERS
            let vertexShaderModule = baseVertexShaderModule;
            let fragmentShaderModule = baseFragmentShaderModule;
            if (instance.vertexShader && instance.fragmentShader) {
                [vertexShaderModule, fragmentShaderModule] = await Promise.all([
                    fetchOnce(cache, instance.vertexShader, createShaderModule(device, instance.vertexShader, "Vertex Shader Override"), debug),
                    fetchOnce(cache, instance.fragmentShader, createShaderModule(device, instance.fragmentShader, "Fragment Shader Override"), debug)
                ]);
            }

            // OVERRIDE COLLIDER
            let collider = mesh.collider ? mesh.collider.copy() : null;
            if (collider) {
                collider.setProperties(instance.href, instance.ghost, instance.v);
            }

            // OVERRIDE CULL MODE
            const cullMode = instance.cullMode ? instance.cullMode : "back";

            // TEXTURE
            if (instance.texture) {
                let texture;
                if (instance.texture.url) {
                    // image texture
                    const imgBmp = await fetchOnce(cache, instance.texture.url, loadImageToBMP(instance.texture.url), debug);
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

            // Pipeline
            const pipeline = createPipeline(
                "FPV Render Pipeline",
                device,
                bindGroupLayout,
                vertexShaderModule,
                mesh.propertyCount,
                mesh.vbAttributes,
                fragmentShaderModule,
                format,
                topology,
                cullMode,
                true,
                multisamples
            );

            const meshInstance = new MeshInstance(
                renderable.instances.length,  // ID
                modelBuffer,
                bindGroup,
                pipeline,
                collider,
                animation,
                {  // transforms
                    position: instance.p || [0, 0, 0],
                    rotation: instance.r || [0, 0, 0],
                    scale: instance.s || [1, 1, 1],
                }
            )

            // add to renderables list
            renderable.instances.push(meshInstance);
        }
        renderables.push(renderable);
    }

    // create debug geometry
    if (debug) {
        createDebugGeometry(cache, renderables, device, format, viewBuffer, projectionBuffer, multisamples);
    }

    return renderables;
}


// TODO COMPLETELY COOKED
// TODO move into Mesh class
// TODO hardcoded for AABB
async function createDebugGeometry(cache, renderables, device, format, viewBuffer, projectionBuffer, multisamples) {
    // SHADERS
    const [debugVShader, debugFShader] = await Promise.all([
        fetchOnce(cache, "shaders/basic.vert.wgsl", createShaderModule(device, "shaders/basic.vert.wgsl", "DEBUG vertex module"), true),
        fetchOnce(cache, "shaders/debug.frag.wgsl", createShaderModule(device, "shaders/debug.frag.wgsl", "DEBUG fragment module"), true),
    ])

    // BGL
    const debugBGL = createBindGroupLayout(device, "DEBUG BGL", "MVP");

    // MODEL BUFFER (identity)
    const modelBuffer = device.createBuffer({
        label: "DEBUG Model Uniform",
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const model = mat4.create();
    console.log(model);
    device.queue.writeBuffer(modelBuffer, 0, model);

    for (const mesh of renderables) {
        for (const instance of mesh.instances) {
            if (instance.collider && !instance.collider.ghost) {
                // generate geometry (line-list)
                const vertexCount = 24;  // 12 edges, 2 vertices each
                const vertices = instance.collider.toVertices();
                
                // VERTEX BUFFER
                const vb = device.createBuffer({
                    label: "DEBUG VB",
                    size: vertices.byteLength,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                });
                device.queue.writeBuffer(vb, 0, vertices);
                const vbAttributes = createVBAttributes(["x", "y", "z"]);
                
                // BIND GROUP
                const bg = createBindGroup(device, "DEBUG Bind Group", debugBGL, {buffer: modelBuffer}, {buffer: viewBuffer}, {buffer: projectionBuffer});
    
                // PIPELINE
                const pipeline = createPipeline(
                    "DEBUG Pipeline",
                    device,
                    debugBGL,
                    debugVShader,
                    3,  // vertex properties
                    vbAttributes,
                    debugFShader,
                    format,
                    "line-list",
                    "none",
                    true,
                    multisamples
                );

                instance.debug(vb, vertexCount, bg, pipeline);
            }
        }
    }
}