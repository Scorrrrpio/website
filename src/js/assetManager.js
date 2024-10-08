import { AssetLoadError } from "./errors";
import { plyToTriangleList } from "./plyReader";

export class AssetManager {
    constructor(device) {
        this.device = device;
        this.cache = new Map();
    }

    async get(url) {
        if (this.cache.has(url)) { return this.cache.get(url); }
        let data;
        const fileType = url.slice(url.lastIndexOf("."));
        switch (fileType) {
            case ".json":
                data = this.#loadJson(url);
                break;
            case ".wgsl":
                data = this.#loadShaderModule(url);
                break;
            case ".ply":
                data = plyToTriangleList(url);
                break;
            case ".png": case ".jpg":
                data = this.#loadImageToBmp(url);
                break;
            case ".txt":
                data = this.loadTxt(url);
                break;
            default:
                throw new AssetLoadError(`Failed to load from ${url}. No loader method for file extension ${fileType}.`);
        }
        this.cache.set(url, data);
        return data;
    }

    async #loadJson(url) {
        const response = await fetch(url);
        if (!response.ok) { throw new AssetLoadError(`Failed to load from ${url}`); }
        return response.json();
    }

    async #loadImageToBmp(url) {
        // read image from texture url
        const img = new Image();
        img.src = url;
        try {
            await img.decode();
            return await createImageBitmap(img);  // convert to bmp
        }
        catch (error) {
            if (error.name === "EncodingError") {
                throw new AssetLoadError(`Failed to load image: ${url}`);
            }
            else { throw error; }
        };
    }
    
    async #loadShaderModule(url) {
        const response = await fetch(url);
        if (!response.ok) { throw new AssetLoadError(`Failed to load shader: ${url}`); }
        const shaderCode = await response.text();
        const shaderModule = this.device.createShaderModule({
            label: url.slice(url.lastIndexOf("/") + 1),
            code: shaderCode,
        });
        return shaderModule;
    }

    async loadTxt(url) {
        const response = await fetch(url);
        if (!response.ok) { throw new AssetLoadError(`Failed to fetch text file: ${url}`); }
        return await response.text();
    }
}