import { plyToTriangleList } from "./plyReader";  // TODO line-list
import { mat4 } from "gl-matrix";

function createPipeline(device, bindGroupLayout, vertexShaderModule, fragmentShaderModule, format, topology, multisamples) {
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
				arrayStride: 4 * 3 /*bytes*/,
				attributes: [{
					format: "float32x3",
					offset: 0,
					shaderLocation: 0
				}],
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

function generateAABB(vertices) {
    const aabb = {
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
    };
    for (const i in vertices) {
        if (vertices[i] < aabb.min[i % 3]) { aabb.min[i % 3] = vertices[i]; }
        if (vertices[i] > aabb.max[i % 3]) { aabb.max[i % 3] = vertices[i]; }
    }
    return aabb;
}

async function loadShader(url) {
    const response = await fetch(url);
    if (!response) { throw new Error("Failed to load shader: ", url); }
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
    const bindGroupLayout = device.createBindGroupLayout({
        label: "MVP Bind Group Layout",
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
    });


    // VERTEX BUFFERS
    const renderables = [];
    for (const asset of assets.objects) {  // each object
        // read .ply file
        const data = await plyToTriangleList(asset.file);

        // SHADERS
        // TODO distinct for instances? Override asset.shader with asset.instance.shader?
        // vertex shader
        const vertexShaderCode = await loadShader(asset.vertexShader);
        // fragment shader
        const fragmentShaderCode = await loadShader(asset.fragmentShader);

        // create shader modules
        const vertexShaderModule = device.createShaderModule({
            label: "FPV Vertex Shader",
            code: vertexShaderCode
        });
        const fragmentShaderModule = device.createShaderModule({
            label: "FPV Fragment Shader",
            code: fragmentShaderCode
        });

        // generate collision mesh for geometry
        // TODO other types (sphere, mesh)
        let baselineMesh;
        if (asset.collision === "aabb") {
            baselineMesh = generateAABB(data.vertFloats);
        }

        for (const instance of asset.instances) {
            // generate model matrix
            const model = mat4.create();
            mat4.translate(model, model, instance.position);
            mat4.rotateX(model, model, instance.rotation[0]);
            mat4.rotateY(model, model, instance.rotation[1]);
            mat4.rotateZ(model, model, instance.rotation[2]);
            mat4.scale(model, model, instance.scale);

            // transform collision mesh
            let collisionMesh;
            if (baselineMesh) {
                collisionMesh = {
                    min: [
                        baselineMesh.min[0] * instance.scale[0] + instance.position[0],
                        baselineMesh.min[1] * instance.scale[1] + instance.position[1],
                        baselineMesh.min[2] * instance.scale[2] + instance.position[2],
                    ],
                    max: [
                        baselineMesh.max[0] * instance.scale[0] + instance.position[0],
                        baselineMesh.max[1] * instance.scale[1] + instance.position[1],
                        baselineMesh.max[2] * instance.scale[2] + instance.position[2],
                    ],
                };
            }

            // create vertex buffer
            const vb = device.createBuffer({
                label: asset.file,
                size: data.vertFloats.byteLength,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            });

            // write data
            device.queue.writeBuffer(vb, 0, data.vertFloats);

            // create model matrix uniform buffer for object
            const modelBuffer = device.createBuffer({
                label: "Model Uniform " + renderables.length,
                size: 64,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            });

            // create bind group for object's model matrix
            const bindGroup = device.createBindGroup({
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

            // add to vertex buffer list
            renderables.push({
                id: renderables.length,
                vertexBuffer: vb,
                vertexCount: data.topologyVerts,
                model: model,
                modelBuffer: modelBuffer,
                bindGroup: bindGroup,
                pipeline: createPipeline(
                    device,
                    bindGroupLayout,
                    vertexShaderModule,
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