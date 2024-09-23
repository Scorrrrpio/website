import { TextureEngine } from "../engine";

export class TextureProgramComponent {
    static programs = {};

    constructor(outputTexture, scene, assetManager, device, format, aspect=[1, 1]) {
        // TODO Enginception
        this.textureEngine = new TextureEngine(outputTexture, scene, assetManager, device, format);
    }

    async init() {
        await this.textureEngine.init();
    }

    render() {
        //this.textureEngine.update();  // TODO defined in module
        this.textureEngine.render();
    }

    // TODO meaningless
    static async loadCustom(...paths) {
        for (const path of paths) {
            const module = await import(/* webpackIgnore: true */ path).catch(() =>
                { throw new AssetLoadError("Failed to load custom animation script from " + path); }
            );
            for (const [name, fn] of Object.entries(module)) {
                TextureProgramComponent.programs[name] = fn;
            }
            debugger;
        }
    }
}