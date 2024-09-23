import { AssetLoadError } from "../errors";

export class AnimationComponent {
    static lookup = {};

    constructor(name, ...parameters) {
        this.name = name;
        this.parameters = parameters;
    }

    animate() {
        AnimationComponent.lookup[this.name]?.(...this.parameters);
    }

    // import custom animations
    static async loadCustom(...paths) {
        for (const path of paths) {
            const module = await import(/* webpackIgnore: true */ path).catch(() =>
                { throw new AssetLoadError("Failed to load custom animation script from " + path); }
            );
            for (const [name, fn] of Object.entries(module)) {
                AnimationComponent.lookup[name] = fn;
            }
        }
    }
}