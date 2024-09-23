import { TextureEngine } from "../engine";

// TODO merge with TextureEngine
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
}