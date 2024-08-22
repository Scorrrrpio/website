// imports
import { mat4 } from "gl-matrix";
import { wgpuSetup } from "./wgpuSetup";
import { plyToLineList, plyToTriangleList } from "./plyReader";

// inspired by the sphere graphic from lokinet.org
export async function cameraPlayground(canvasID, autoplay) {
    // WEBGPU SETUP
	const canvas = document.getElementById(canvasID);
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.width = 512 * devicePixelRatio;
    canvas.height = 512 * devicePixelRatio;

    const { adapter, device, context, format } = await wgpuSetup(canvas);


    // GEOMETRY
    const TOPOLOGY = "line-list"; const data = await plyToLineList("geometry/cube.ply");
    const vertices = data.vertBuffer;

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
        @group(0) @binding(0) var<uniform> mvp: mat4x4<f32>;

        @vertex
        fn vertexMain(@location(0) pos: vec3<f32>) -> @builtin(position) vec4<f32> {
            return mvp * vec4<f32>(pos, 1);
    }`;

    // fragment shader
    const fragmentShaderCode = `
        @fragment
        fn fragmentMain(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
            return vec4<f32>(1, 1, 1, 1);
        }
    `;

    // create shader modules
	const vertexShaderModule = device.createShaderModule({
		label: "Sphere Vertex Shader",
		code: vertexShaderCode
	});
	const fragmentShaderModule = device.createShaderModule({
		label: "Sphere Fragment Shader",
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
        label: "MVP Bind Group Layout",
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: "uniform" },  // can omit type param
        }]
    });

    // create bind group
    const bindGroup = device.createBindGroup({
        label: "Sphere bind group",
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: uniformBuffer },
        }],
    });


    // CAMERA SETUP
    // view matrix
    function createViewMatrix(pos, rot, positiveY) {
        const view = mat4.create();
        mat4.rotateX(view, view, rot[0]);
        mat4.rotateY(view, view, rot[1]);
        mat4.rotateZ(view, view, rot[2]);
        mat4.translate(view, view, [-pos[0], -pos[1], -pos[2]]);
        return view;
    }

    // projection matrix
    const fov = Math.PI / 6;  // pi/4 radians
    const aspect = canvas.width / canvas.height;
    // clipping planes
    const near = 0.1;
    const far = 100.0;

    const projection = mat4.create();
    mat4.perspective(projection, fov, aspect, near, far);
    // MVP computed in render loop


    // CAMERA CONTROLS
    let cameraPosition = [0, 0, 7];
    let cameraRotation = [0, 0, 0];
    const camSpeed = 0.1;
    const camRotationSpeed = 0.01;
    const keysPressed = {
        w: false,
        a: false,
        s: false,
        d: false,
        r: false,  // rise
        f: false,  // fall
    }

    let view;
    function updateCamera() {
        const forwardX = Math.sin(cameraRotation[1]);
        const forwardZ = Math.cos(cameraRotation[1]);

        if (keysPressed.w) {
            cameraPosition[0] += camSpeed * forwardX;
            cameraPosition[2] -= camSpeed * forwardZ;
        }
        if (keysPressed.a) {
            cameraRotation[1] -= camRotationSpeed;
        }
        if (keysPressed.s) {
            cameraPosition[0] -= camSpeed * forwardX;
            cameraPosition[2] += camSpeed * forwardZ;
        }
        if (keysPressed.d) {
            cameraRotation[1] += camRotationSpeed;
        }
        if (keysPressed.r) {
            cameraPosition[1] += camSpeed;
        }
        if (keysPressed.f) {
            cameraPosition[1] -= camSpeed;
        }
        view = createViewMatrix(cameraPosition, cameraRotation, [0, 1, 0]);
    }
    updateCamera();
    
    // listen for key presses and releases
    document.addEventListener("keydown", (event) => {
        switch(event.code) {
            case "KeyW":
                keysPressed.w = true;
                break;
            case "KeyA":
                keysPressed.a = true;
                break;
            case "KeyS":
                keysPressed.s = true;
                break;
            case "KeyD":
                keysPressed.d = true;
                break;
            case "KeyR":
                keysPressed.r = true;
                break;
            case "KeyF":
                keysPressed.f = true;
                break;
        }
    });
    document.addEventListener("keyup", (event) => {
        switch(event.code) {
            case "KeyW":
                keysPressed.w = false;
                break;
            case "KeyA":
                keysPressed.a = false;
                break;
            case "KeyS":
                keysPressed.s = false;
                break;
            case "KeyD":
                keysPressed.d = false;
                break;
            case "KeyR":
                keysPressed.r = false;
                break;
            case "KeyF":
                keysPressed.f = false;
                break;
        }
    });


    // PIPELINE
	const pipeline = device.createRenderPipeline({
		label: "Sphere Pipeline",
		layout: device.createPipelineLayout({
            label: "Sphere Pipeline Layout",
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
            topology: TOPOLOGY,
            frontFace: "ccw",
            cullMode: "none",
        },
        multisample: {
            count: 4,
        },
	});


    // 4xMSAA TEXTURES
    let canvasTexture = context.getCurrentTexture();
    const msaaTexture = device.createTexture({
        format: canvasTexture.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        size: [canvas.width, canvas.height],
        sampleCount: 4,
    });


    // RENDER LOOP
    let animating = false;
	function renderLoop() {
        // create input texture the size of canvas
        canvasTexture = context.getCurrentTexture();

        // update camera
        updateCamera();

        // mvp matrix
        const mvp = mat4.create();
        mat4.multiply(mvp, projection, view);

        // write mvp matrix to uniform buffer
        device.queue.writeBuffer(uniformBuffer, 0, mvp);

		// create GPUCommandEncoder
		const encoder = device.createCommandEncoder();

		// begin render pass
		const pass = encoder.beginRenderPass({
			colorAttachments: [{
                view: msaaTexture.createView(),  // render to MSAA texture
				//view: context.getCurrentTexture().createView(),
				loadOp: "clear",
				clearValue: { r: 0, g: 0, b: 0, a: 1 },
				storeOp: "store",
                resolveTarget: canvasTexture.createView(),
			}],
		});

        // TODO what is this?
        //pass.setViewport(0, 0, canvas.width, canvas.height, 0, 1);

		// render triangle
		pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
		pass.setVertexBuffer(0, vertexBuffer);
		pass.draw(vertices.length / 3);

		// end render pass
		pass.end();

		// create and submit GPUCommandBuffer
		device.queue.submit([encoder.finish()]);

        if (animating || autoplay) {
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

    renderLoop();
    if (!autoplay) {
	    canvas.addEventListener("mouseenter", startRenderLoop);
        canvas.addEventListener("mouseleave", stopRenderLoop);
    }
}