// imports
import { mat4 } from "gl-matrix";
import { wgpuSetup } from "./wgpuSetup";

export async function cube(canvasID, autoplay) {
    // WEBGPU SETUP
	const canvas = document.getElementById(canvasID);
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    const { adapter, device, context, format } = await wgpuSetup(canvas);


    // GEOMETRY
    /* X,    Y,    Z,   R,   G,   B,   A
     0.5,  0.5,  0.5, 1.0, 1.0, 1.0, 1.0,  // 1
     0.5,  0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 2
     0.5, -0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 3
     0.5, -0.5, -0.5, 0.0, 0.0, 1.0, 1.0,  // 4
    -0.5,  0.5,  0.5, 1.0, 1.0, 0.0, 1.0,  // 5
    -0.5,  0.5, -0.5, 1.0, 0.0, 1.0, 1.0,  // 6
    -0.5, -0.5,  0.5, 0.0, 1.0, 1.0, 1.0,  // 7
    -0.5, -0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 8
    */
    const vertices = new Float32Array([
        // X,    Y,    Z,   R,   G,   B,   A
        // FRONT
        -0.5,  0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 6
         0.5, -0.5, -0.5, 0.0, 1.0, 0.0, 1.0,  // 4
        -0.5, -0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 8
         0.5, -0.5, -0.5, 0.0, 1.0, 0.0, 1.0,  // 4
        -0.5,  0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 6
         0.5,  0.5, -0.5, 0.0, 1.0, 0.0, 1.0,  // 2
        // RIGHT
         0.5,  0.5, -0.5, 0.0, 1.0, 0.0, 1.0,  // 2
         0.5, -0.5,  0.5, 0.0, 0.0, 1.0, 1.0,  // 3
         0.5, -0.5, -0.5, 0.0, 1.0, 0.0, 1.0,  // 4
         0.5, -0.5,  0.5, 0.0, 0.0, 1.0, 1.0,  // 3
         0.5,  0.5, -0.5, 0.0, 1.0, 0.0, 1.0,  // 2
         0.5,  0.5,  0.5, 0.0, 0.0, 1.0, 1.0,  // 1
        // BACK
         0.5,  0.5,  0.5, 0.0, 0.0, 1.0, 1.0,  // 1
        -0.5, -0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 7
         0.5, -0.5,  0.5, 0.0, 0.0, 1.0, 1.0,  // 3
        -0.5, -0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 7
         0.5,  0.5,  0.5, 0.0, 0.0, 1.0, 1.0,  // 1
        -0.5,  0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 5
        // LEFT
        -0.5,  0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 5
        -0.5, -0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 8
        -0.5, -0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 7
        -0.5, -0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 8
        -0.5,  0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 5
        -0.5,  0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 6
        // TOP
        -0.5,  0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 5
         0.5,  0.5, -0.5, 0.0, 1.0, 0.0, 1.0,  // 2
        -0.5,  0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 6
         0.5,  0.5, -0.5, 0.0, 1.0, 0.0, 1.0,  // 2
        -0.5,  0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 5
         0.5,  0.5,  0.5, 0.0, 0.0, 1.0, 1.0,  // 1
        // BOTTOM
        -0.5, -0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 8
         0.5, -0.5,  0.5, 0.0, 0.0, 1.0, 1.0,  // 3
        -0.5, -0.5,  0.5, 0.0, 1.0, 0.0, 1.0,  // 7
         0.5, -0.5,  0.5, 0.0, 0.0, 1.0, 1.0,  // 3
        -0.5, -0.5, -0.5, 1.0, 0.0, 0.0, 1.0,  // 8
         0.5, -0.5, -0.5, 0.0, 1.0, 0.0, 1.0,  // 4
    ]);

    // create vertex buffer
	const vertexBuffer = device.createBuffer({
		label: "Cube Vertices",
		size: vertices.byteLength,
		usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
	});

    // copy vertex data into vertex buffer
	device.queue.writeBuffer(vertexBuffer, 0, vertices);
    

    // SHADERS
	// vertex shader
	const vertexShaderCode = `
    struct vertexOut {
        @builtin(position) position: vec4f,
        @location(0) rawPos: vec4f
    };

    @group(0) @binding(0) var<uniform> mvp: mat4x4<f32>;

    // nightmare code using rawPos to store position
    @vertex
    fn vertexMain(@location(0) pos: vec3f, @location(1) rawPos: vec4f) -> vertexOut {
        var output: vertexOut;
        output.position = mvp * vec4f(pos, 1);
        output.rawPos = vec4f(pos, 1);
        return output;
    }`;

    // fragment shader
    const fragmentShaderCode = `
        struct vertexOut {
            @builtin(position) position: vec4f,
            @location(0) rawPos: vec4f
        };

        @fragment
        fn fragmentMain(fragData: vertexOut) -> @location(0) vec4f {
            if ((fragData.rawPos.x >= 0 && fragData.rawPos.y >= 0 && fragData.rawPos.z >= 0) ||
                (fragData.rawPos.x >= 0 && fragData.rawPos.y < 0  && fragData.rawPos.z < 0 ) ||
                (fragData.rawPos.x < 0  && fragData.rawPos.y < 0  && fragData.rawPos.z >= 0) ||
                (fragData.rawPos.x < 0  && fragData.rawPos.y >= 0 && fragData.rawPos.z < 0 )) {
                return vec4f(1.0, 1.0, 1.0, 1.0);
            }
            else {
                return vec4f(1, 0, 0, 1);
            }
        }
    `;

    // create shader modules
	const vertexShaderModule = device.createShaderModule({
		label: "Cube Vertex Shader",
		code: vertexShaderCode
	});
	const fragmentShaderModule = device.createShaderModule({
		label: "Cube Fragment Shader",
		code: fragmentShaderCode
	});


    // UNIFORM BUFFER AND BIND GROUP
    // create uniform buffer for MVP matrix
    const uniformBuffer = device.createBuffer({
        label: "MVP Uniform",
        size: 64,  // for 4x4 matrix (8 * 16 bytes)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // create bind group layout
    const bindGroupLayout = device.createBindGroupLayout({
        label: "MVP bind group Layout",
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "uniform" },  // can omit type param
        }],
    });

    // create bind group
    const bindGroup = device.createBindGroup({
        label: "Cube bind group",
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer },
        }],
    });


    // CAMERA SETUP
    function createRotationMatrix(angle) {
        const rotationMatrix = mat4.create();
        mat4.fromRotation(rotationMatrix, angle, [0, 1, 0]);
        return rotationMatrix;
    }

    // view matrix
    const view = mat4.create();
    mat4.lookAt(view,
        [1.5, 1.5, 1.5],  // camera position
        [0, 0, 0],  // look at
        [0, 1, 0],  // positive y vector
    );

    const fov = Math.PI / 4;  // pi/4 radians
    const aspect = canvas.width / canvas.height;
    // clipping planes
    const near = 0.1;
    const far = 100.0;

    // projection matrix
    const projection = mat4.create();
    mat4.perspective(projection, fov, aspect, near, far);
    // MVP computed in render loop


    // PIPELINE
	const pipeline = device.createRenderPipeline({
		label: "Cube Pipeline",
		layout: device.createPipelineLayout({
            label: "Cube Pipeline Layout",
            bindGroupLayouts: [bindGroupLayout],
        }),
		vertex: {
			module: vertexShaderModule,
			entryPoint: "vertexMain",
			buffers: [{
				arrayStride: 4 * 7 /*bytes*/,
				attributes: [{
					format: "float32x3",
					offset: 0,
					shaderLocation: 0
				}, {
					format: "float32x4",
					offset: 4 * 3 /*bytes*/ ,
					shaderLocation: 1
				}],
			}],
		},
		fragment: {
			module: fragmentShaderModule,
			entryPoint: "fragmentMain",
			targets: [{
				format: format,
			}],
		},
		primitive: {
            topology: "triangle-list",
            frontFace: "ccw",
            cullMode: "back",
        },
        multisample: {
            count: 4,
        },
	});


    // 4xMSAA TEXTURES
    // create texture the size of canvas
    let canvasTexture = context.getCurrentTexture();
    // create multisample texture
    let msaaTexture = device.createTexture({
        format: canvasTexture.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        size: [canvas.width, canvas.height],
        sampleCount: 4,
    });

    // handle resize
    function handleResize() {
        const parent = canvas.parentElement;

        canvas.width = Math.floor(parent.clientWidth * devicePixelRatio);
        canvas.height = Math.floor(parent.clientHeight * devicePixelRatio);

        mat4.perspective(projection, fov, canvas.width / canvas.height, near, far);

        if (msaaTexture) { msaaTexture.destroy(); }
        msaaTexture = device.createTexture({
            format: canvasTexture.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            size: [canvas.width, canvas.height],
            sampleCount: 4,
        });

        if (!animating && !autoplay) {
            renderLoop();
        }
    }


    // RENDER LOOP
    let angle = 0;
    let animating = false;
	function renderLoop() {
        // update canvasTexture
        canvasTexture = context.getCurrentTexture();

        // spinning cube
        angle += 0.02;

        // create model matrix
        const model = createRotationMatrix(angle);

        // mvp matrix
        const mvp = mat4.create();
        mat4.multiply(mvp, projection, view);
        mat4.multiply(mvp, mvp, model);

        // write mvp matrix to uniform buffer
        device.queue.writeBuffer(uniformBuffer, 0, mvp);

		// create GPUCommandEncoder
		const encoder = device.createCommandEncoder();

		// begin render pass
		const pass = encoder.beginRenderPass({
			colorAttachments: [{
				//view: context.getCurrentTexture().createView(),
                view: msaaTexture.createView(),  // render to MSAA texture
				loadOp: "clear",
				clearValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store",
                resolveTarget: canvasTexture.createView(),  // converts msaaTexture to size of canvas
			}],
		});

        pass.setViewport(0, 0, canvas.width, canvas.height, 0, 1);

		// render triangle
		pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
		pass.setVertexBuffer(0, vertexBuffer);
		pass.draw(vertices.length / 7);

		// end render pass
		pass.end();

		// create and submit GPUCommandBuffer
		device.queue.submit([encoder.finish()]);

        if (autoplay || animating) {
            requestAnimationFrame(renderLoop);
        }
	}


    // ANIMATION CONTROL
    function startRenderLoop() {
        if (!animating) {
            animating = true;
            renderLoop();
        }
    }

    function stopRenderLoop() {
        animating = false;
    }

    if (!autoplay) {
        canvas.addEventListener("mouseenter", startRenderLoop);
        canvas.addEventListener("mouseleave", stopRenderLoop);
    }

    handleResize();
    window.addEventListener("resize", () => { angle -= 0.02; handleResize(); });
    renderLoop();
}