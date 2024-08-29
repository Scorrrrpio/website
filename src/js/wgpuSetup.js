import { UnsupportedWebGPUError } from "./errors";

export async function wgpuSetup(canvas) {
	// check for browser WebGPU compatibility
	if (!navigator.gpu) {
		throw new UnsupportedWebGPUError("WebGPU is not supported in this browser");
	}

	// request GPUAdapter
	const adapter = await navigator.gpu.requestAdapter();
	if (!adapter) {
		throw new UnsupportedWebGPUError("No appropriate GPUAdapter found");
	}

	// request device
	const device = await adapter.requestDevice();

	// configure canvas
	const context = canvas.getContext("webgpu");
	const format = navigator.gpu.getPreferredCanvasFormat();
	context.configure({
		device: device,
		format: format,
		size: [canvas.width, canvas.height],
		usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
	});

    return { adapter, device, context, format };
}