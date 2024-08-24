import { plyToTriangleList } from "./plyReader";  // TODO line-list
import { mat4 } from "gl-matrix";

export async function assetsToBuffers(assets, device) {
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
    const vertexBuffers = [];
    for (const asset of assets.objects) {  // each object
        // read .ply file
        // TODO line-list
        const data = await plyToTriangleList(asset.file);
        // generate model matrix
        const model = mat4.create();
        mat4.translate(model, model, asset.position);
        mat4.rotateX(model, model, asset.rotation[0]);
        mat4.rotateY(model, model, asset.rotation[1]);
        mat4.rotateZ(model, model, asset.rotation[2]);
        mat4.scale(model, model, asset.scale);

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
            label: "Model Uniform " + vertexBuffers.length,
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // create bind group for object's model matrix
        const bindGroup = device.createBindGroup({
            label: "MVP bind group " + vertexBuffers.length,
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
        vertexBuffers.push({
            id: vertexBuffers.length,
            buffer: vb,
            model: model,
            modelBuffer: modelBuffer,
            bindGroup: bindGroup,
            bindGroupLayout: bindGroupLayout,
            vertexCount: data.topologyVerts,
        });
    }

    return { vertexBuffers, viewBuffer, projectionBuffer };
}