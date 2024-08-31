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

// TODO not reusable
export function createBindGroupLayout(device, label, texture, sampler) {
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