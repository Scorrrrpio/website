// LERP FUNCTION
export function lerpVector(vOut, v1, v2, t) {
    if (vOut.length != v1.length || vOut.length != v2.length) {
        return;
    }
    for (let i = 0; i < v1.length; i++) {
        vOut[i] = lerpValue(v1[i], v2[i], t);
    }
}

export function lerpValue(v1, v2, t) {
    return v1 * (1-t) + v2 * t;
}