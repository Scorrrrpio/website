export class Animation {
    static requiredComponents = [];

    static animate(...params) {
        throw new Error("The 'animate' method must be implemented in subclasses of Animation");
    }
}