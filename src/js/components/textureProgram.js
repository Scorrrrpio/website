export class TextureProgramComponent {
    static programs = {};

    constructor(outputTexture, aspect=[1, 1]) {
        // TODO Enginception
    }

    // TODO
    update() {}

    render() {}

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