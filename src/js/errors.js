export class UnsupportedWebGPUError extends Error {
    constructor(message) {
        super(message);
        this.name =  "UnsupportedWebGPUError";
    }
}

export class AssetLoadError extends Error {
    constructor(message) {
        super(message);
        this.name = "AssetLoadError";
    }
}

export class BundleError extends Error {
    constructor(message) {
        super(message);
        this.name = "BundleError";
    }
}